// Hermes - Storage Management
// Handles all data storage operations

export class HermesStorage {
  constructor() {
    this.STORAGE_KEYS = {
      API_KEY: 'apiKey',
      DOMAINS: 'domains',  // List of indexed domains with metadata
      PAGES: 'pages',      // All indexed pages
      CHAT_HISTORY: 'chatHistory',
      SETTINGS: 'settings'
    };
  }

  // API Key
  async getApiKey() {
    const result = await chrome.storage.local.get(this.STORAGE_KEYS.API_KEY);
    return result[this.STORAGE_KEYS.API_KEY] || null;
  }

  async setApiKey(apiKey) {
    await chrome.storage.local.set({ [this.STORAGE_KEYS.API_KEY]: apiKey });
  }

  // Domains
  async getDomains() {
    const result = await chrome.storage.local.get(this.STORAGE_KEYS.DOMAINS);
    return result[this.STORAGE_KEYS.DOMAINS] || [];
  }

  async addDomain(domain, metadata = {}) {
    const domains = await this.getDomains();

    // Check if domain already exists
    const existing = domains.find(d => d.domain === domain);
    if (existing) {
      // Update metadata
      existing.lastCrawled = Date.now();
      existing.pageCount = (existing.pageCount || 0) + (metadata.pageCount || 0);
    } else {
      domains.push({
        domain,
        addedAt: Date.now(),
        lastCrawled: Date.now(),
        pageCount: metadata.pageCount || 0,
        ...metadata
      });
    }

    await chrome.storage.local.set({ [this.STORAGE_KEYS.DOMAINS]: domains });
  }

  async removeDomain(domain) {
    const domains = await this.getDomains();
    const filtered = domains.filter(d => d.domain !== domain);
    await chrome.storage.local.set({ [this.STORAGE_KEYS.DOMAINS]: filtered });

    // Also remove all pages from this domain
    await this.removePagesByDomain(domain);
  }

  async updateDomainStats(domain, stats) {
    const domains = await this.getDomains();
    const domainObj = domains.find(d => d.domain === domain);
    if (domainObj) {
      Object.assign(domainObj, stats);
      await chrome.storage.local.set({ [this.STORAGE_KEYS.DOMAINS]: domains });
    }
  }

  // Pages
  async getPages(domain = null) {
    const result = await chrome.storage.local.get(this.STORAGE_KEYS.PAGES);
    const allPages = result[this.STORAGE_KEYS.PAGES] || [];

    if (domain) {
      return allPages.filter(page => this.extractDomain(page.url) === domain);
    }

    return allPages;
  }

  async addPage(pageData) {
    const pages = await this.getPages();
    const domain = this.extractDomain(pageData.url);

    // Remove duplicate if exists
    const filtered = pages.filter(p => p.url !== pageData.url);

    filtered.push({
      ...pageData,
      domain,
      indexedAt: Date.now()
    });

    await chrome.storage.local.set({ [this.STORAGE_KEYS.PAGES]: filtered });

    // Update domain stats
    const domainPages = filtered.filter(p => p.domain === domain);
    await this.updateDomainStats(domain, {
      pageCount: domainPages.length,
      lastCrawled: Date.now()
    });
  }

  async removePagesByDomain(domain) {
    const pages = await this.getPages();
    const filtered = pages.filter(p => p.domain !== domain);
    await chrome.storage.local.set({ [this.STORAGE_KEYS.PAGES]: filtered });
  }

  async clearAllPages() {
    await chrome.storage.local.set({ [this.STORAGE_KEYS.PAGES]: [] });

    // Reset all domain page counts
    const domains = await this.getDomains();
    domains.forEach(d => d.pageCount = 0);
    await chrome.storage.local.set({ [this.STORAGE_KEYS.DOMAINS]: domains });
  }

  // Chat History
  async getChatHistory() {
    const result = await chrome.storage.local.get(this.STORAGE_KEYS.CHAT_HISTORY);
    return result[this.STORAGE_KEYS.CHAT_HISTORY] || [];
  }

  async addChatMessage(message) {
    const history = await this.getChatHistory();
    history.push({
      ...message,
      timestamp: Date.now()
    });
    await chrome.storage.local.set({ [this.STORAGE_KEYS.CHAT_HISTORY]: history });
  }

  async clearChatHistory() {
    await chrome.storage.local.set({ [this.STORAGE_KEYS.CHAT_HISTORY]: [] });
  }

  // Settings
  async getSettings() {
    const result = await chrome.storage.local.get(this.STORAGE_KEYS.SETTINGS);
    return result[this.STORAGE_KEYS.SETTINGS] || {
      maxPagesPerCrawl: 50,
      crawlDelay: 2000,
      enableCookies: true,
      respectRobotsTxt: true
    };
  }

  async updateSettings(settings) {
    const current = await this.getSettings();
    await chrome.storage.local.set({
      [this.STORAGE_KEYS.SETTINGS]: { ...current, ...settings }
    });
  }

  // Utilities
  extractDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (e) {
      return '';
    }
  }

  // Get stats
  async getStats() {
    const pages = await this.getPages();
    const domains = await this.getDomains();
    const apiKey = await this.getApiKey();

    return {
      totalPages: pages.length,
      totalDomains: domains.length,
      hasApiKey: !!apiKey,
      domains: domains.map(d => ({
        domain: d.domain,
        pageCount: d.pageCount || 0,
        lastCrawled: d.lastCrawled
      }))
    };
  }
}
