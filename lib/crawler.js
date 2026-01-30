// Hermes - Web Crawler
// Handles page content extraction and crawling

export class HermesCrawler {
  constructor(maxPages = 50, delay = 2000) {
    this.maxPages = maxPages;
    this.delay = delay;
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

  // Crawl multiple pages starting from current page
  async crawlSite(startTabId, onProgress = null) {
    const visited = new Set();
    const toVisit = [];
    const crawled = [];

    // Get starting URL
    const tab = await chrome.tabs.get(startTabId);
    toVisit.push(tab.url);

    const domain = new URL(tab.url).hostname;

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
