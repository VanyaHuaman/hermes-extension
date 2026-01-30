// Hermes - Web Crawler
// Handles page content extraction and crawling

export class HermesCrawler {
  constructor(maxPages = 50, delay = 2000, respectRobotsTxt = true) {
    this.maxPages = maxPages;
    this.delay = delay;
    this.respectRobotsTxt = respectRobotsTxt;
    this.robotsCache = new Map(); // Cache robots.txt per domain
  }

  // Extract content from current page
  async extractCurrentPage(tabId) {
    try {
      console.log('Attempting to extract content from tab:', tabId);

      // First, test basic injection
      let testResults;
      try {
        testResults = await chrome.scripting.executeScript({
          target: { tabId },
          func: () => "test"
        });
        console.log('Basic test injection worked:', testResults);
      } catch (testError) {
        console.error('Basic injection failed:', testError);
        throw new Error(`Script injection not allowed: ${testError.message}`);
      }

      // Now try the real extraction
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          return {
            url: window.location.href,
            title: document.title,
            content: document.body.innerText,
            description: '',
            timestamp: Date.now()
          };
        }
      });

      console.log('Execute script results:', results);

      if (!results || results.length === 0) {
        throw new Error('No results from script execution');
      }

      if (!results[0] || !results[0].result) {
        throw new Error('Script returned no result');
      }

      return results[0].result;
    } catch (error) {
      console.error('Error extracting page content:', error);
      throw new Error(`Cannot extract content: ${error.message}`);
    }
  }

  // Function that runs in page context to extract content
  extractPageContentFunction() {
    try {
      const title = document.title || '';
      const url = window.location.href;

      // Get main content - try common content containers first
      let mainContent = null;
      const contentSelectors = [
        'main',
        '[role="main"]',
        'article',
        '#content',
        '.content',
        '#main',
        '.main',
        'body'
      ];

      for (const selector of contentSelectors) {
        mainContent = document.querySelector(selector);
        if (mainContent) break;
      }

      if (!mainContent) {
        mainContent = document.body;
      }

      // Clone to manipulate
      const clone = mainContent.cloneNode(true);

      // Remove unwanted elements
      const unwantedTags = ['script', 'style', 'nav', 'footer', 'header', 'iframe', 'noscript', 'svg', 'button'];
      unwantedTags.forEach(tag => {
        const elements = clone.getElementsByTagName(tag);
        Array.from(elements).forEach(el => el.remove());
      });

      // Get text content
      const text = clone.textContent || clone.innerText || '';

      // Clean up whitespace
      const cleanText = text
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join('\n');

      // Extract meta description
      const metaDesc = document.querySelector('meta[name="description"]');
      const description = metaDesc ? metaDesc.content : '';

      return {
        url: url,
        title: title.trim(),
        content: cleanText,
        description: description,
        timestamp: Date.now()
      };
    } catch (error) {
      // Return error info for debugging
      return {
        url: window.location.href,
        title: document.title || 'Error',
        content: 'Error extracting content: ' + error.message,
        description: '',
        timestamp: Date.now(),
        error: error.message
      };
    }
  }

  // Extract links from current page
  async extractLinks(tabId) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const currentDomain = window.location.hostname;

          const links = Array.from(document.querySelectorAll('a[href]'))
            .map(a => {
              try {
                const url = new URL(a.href, window.location.href);
                return url.href;
              } catch (e) {
                return null;
              }
            })
            .filter(href => href !== null)
            .filter(href => {
              const url = new URL(href);
              return url.hostname === currentDomain;
            })
            .filter(href => !href.includes('#'))
            .filter(href => {
              const extensions = ['.pdf', '.jpg', '.png', '.gif', '.zip', '.exe'];
              return !extensions.some(ext => href.toLowerCase().endsWith(ext));
            });

          return [...new Set(links)];
        }
      });

      if (!results || !results[0]) {
        console.log('No link extraction results');
        return [];
      }

      console.log('Found links:', results[0].result);
      return results[0].result || [];
    } catch (error) {
      console.error('Error extracting links:', error);
      return [];
    }
  }

  // Function that runs in page context to extract links
  extractLinksFunction() {
    const currentDomain = window.location.hostname;
    const currentProtocol = window.location.protocol;

    const links = Array.from(document.querySelectorAll('a[href]'))
      .map(a => {
        try {
          const url = new URL(a.href, window.location.href);
          return url.href;
        } catch (e) {
          return null;
        }
      })
      .filter(href => href !== null)
      .filter(href => {
        // Only same domain
        const url = new URL(href);
        return url.hostname === currentDomain;
      })
      .filter(href => !href.includes('#')) // No fragments
      .filter(href => {
        // No file downloads
        const extensions = ['.pdf', '.jpg', '.png', '.gif', '.zip', '.exe', '.doc', '.xls'];
        return !extensions.some(ext => href.toLowerCase().endsWith(ext));
      });

    // Remove duplicates
    return [...new Set(links)];
  }

  // Check robots.txt for a given URL
  async checkRobotsTxt(url) {
    const urlObj = new URL(url);
    const domain = urlObj.origin;
    const robotsUrl = `${domain}/robots.txt`;

    // Check cache first
    if (this.robotsCache.has(domain)) {
      const cached = this.robotsCache.get(domain);
      return this.isPathAllowed(url, cached);
    }

    try {
      const response = await fetch(robotsUrl);

      if (!response.ok) {
        // No robots.txt found - assume allowed
        this.robotsCache.set(domain, { rules: [], crawlDelay: null });
        return { allowed: true, reason: 'No robots.txt found' };
      }

      const robotsTxt = await response.text();
      const parsed = this.parseRobotsTxt(robotsTxt);
      this.robotsCache.set(domain, parsed);

      return this.isPathAllowed(url, parsed);
    } catch (error) {
      console.error('Error fetching robots.txt:', error);
      // If we can't fetch robots.txt, assume allowed
      return { allowed: true, reason: 'Could not fetch robots.txt' };
    }
  }

  // Parse robots.txt content
  parseRobotsTxt(robotsTxt) {
    const lines = robotsTxt.split('\n');
    const rules = {
      disallowed: [],
      allowed: [],
      crawlDelay: null
    };

    let currentUserAgent = null;
    let applyToAll = false;

    for (let line of lines) {
      line = line.trim();

      // Skip comments and empty lines
      if (!line || line.startsWith('#')) continue;

      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;

      const directive = line.substring(0, colonIndex).trim().toLowerCase();
      const value = line.substring(colonIndex + 1).trim();

      if (directive === 'user-agent') {
        currentUserAgent = value.toLowerCase();
        applyToAll = (value === '*');
      } else if (applyToAll || currentUserAgent === 'hermesbot') {
        if (directive === 'disallow') {
          if (value) {
            rules.disallowed.push(value);
          }
        } else if (directive === 'allow') {
          if (value) {
            rules.allowed.push(value);
          }
        } else if (directive === 'crawl-delay') {
          const delay = parseFloat(value);
          if (!isNaN(delay)) {
            rules.crawlDelay = delay * 1000; // Convert to ms
          }
        }
      }
    }

    return rules;
  }

  // Check if a specific path is allowed by robots.txt rules
  isPathAllowed(url, rules) {
    const urlObj = new URL(url);
    const path = urlObj.pathname;

    // Check if explicitly allowed first
    for (const allowPattern of rules.allowed) {
      if (this.matchesPattern(path, allowPattern)) {
        return {
          allowed: true,
          crawlDelay: rules.crawlDelay,
          reason: 'Explicitly allowed by robots.txt'
        };
      }
    }

    // Then check if disallowed
    for (const disallowPattern of rules.disallowed) {
      if (this.matchesPattern(path, disallowPattern)) {
        return {
          allowed: false,
          crawlDelay: rules.crawlDelay,
          reason: 'Disallowed by robots.txt',
          disallowedPattern: disallowPattern
        };
      }
    }

    // Not explicitly allowed or disallowed - default to allowed
    return {
      allowed: true,
      crawlDelay: rules.crawlDelay,
      reason: 'Not restricted by robots.txt'
    };
  }

  // Check if path matches a robots.txt pattern
  matchesPattern(path, pattern) {
    // Handle wildcard patterns
    if (pattern.includes('*')) {
      const regexPattern = pattern
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*');
      const regex = new RegExp('^' + regexPattern);
      return regex.test(path);
    }

    // Exact prefix match
    return path.startsWith(pattern);
  }

  // Crawl multiple pages starting from current page
  async crawlSite(startTabId, onProgress = null) {
    const visited = new Set();
    const toVisit = [];
    const crawled = [];

    // Get starting URL
    const tab = await chrome.tabs.get(startTabId);
    const startUrl = tab.url;
    const domain = new URL(startUrl).hostname;

    // Check robots.txt before starting crawl
    if (this.respectRobotsTxt) {
      const robotsCheck = await this.checkRobotsTxt(startUrl);

      if (!robotsCheck.allowed) {
        throw new Error(`Crawling blocked by robots.txt\n\nThis site's robots.txt file indicates that automated crawling is not allowed for this section.\n\nPattern blocked: ${robotsCheck.disallowedPattern}\n\nYou can:\n• Index individual pages manually ("Index This Page")\n• Enable "Override robots.txt" in Settings (⚙️)\n• Try crawling a different section of the site`);
      }

      // Use crawl delay from robots.txt if specified
      if (robotsCheck.crawlDelay) {
        console.log(`Using crawl delay from robots.txt: ${robotsCheck.crawlDelay}ms (configured: ${this.delay}ms)`);
        this.delay = robotsCheck.crawlDelay;
      }
    }

    toVisit.push(startUrl);

    while (toVisit.length > 0 && crawled.length < this.maxPages) {
      const url = toVisit.shift();

      if (visited.has(url)) continue;
      visited.add(url);

      try {
        // Report progress
        if (onProgress) {
          onProgress({
            current: crawled.length + 1,
            total: Math.min(this.maxPages, crawled.length + toVisit.length + 1),
            currentUrl: url
          });
        }

        // Navigate to URL
        await chrome.tabs.update(startTabId, { url });

        // Wait for page to load
        await this.waitForPageLoad(startTabId);

        // Small delay to ensure content is rendered
        await this.sleep(this.delay);

        // Extract content
        const pageData = await this.extractCurrentPage(startTabId);
        crawled.push(pageData);

        // Extract and queue links
        const links = await this.extractLinks(startTabId);
        console.log(`Found ${links.length} links on ${url}`);

        let addedLinks = 0;
        links.forEach(link => {
          if (!visited.has(link) && !toVisit.includes(link)) {
            toVisit.push(link);
            addedLinks++;
          }
        });

        console.log(`Added ${addedLinks} new links to queue. Queue size: ${toVisit.length}`);

      } catch (error) {
        console.error(`Error crawling ${url}:`, error);
      }
    }

    console.log(`Crawl complete. Visited ${visited.size} URLs, crawled ${crawled.length} pages`);

    return {
      domain,
      pages: crawled,
      pagesCount: crawled.length
    };
  }

  // Wait for page to finish loading
  async waitForPageLoad(tabId, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      const checkInterval = setInterval(async () => {
        try {
          const tab = await chrome.tabs.get(tabId);

          if (tab.status === 'complete') {
            clearInterval(checkInterval);
            resolve();
          }

          if (Date.now() - startTime > timeout) {
            clearInterval(checkInterval);
            reject(new Error('Page load timeout'));
          }
        } catch (error) {
          clearInterval(checkInterval);
          reject(error);
        }
      }, 100);
    });
  }

  // Sleep utility
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
