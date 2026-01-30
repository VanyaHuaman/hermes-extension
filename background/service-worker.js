// Hermes - Background Service Worker
// Main orchestrator for crawling, indexing, and querying

import { HermesStorage } from '../lib/storage.js';
import { HermesRAG } from '../lib/rag.js';
import { HermesCrawler } from '../lib/crawler.js';

const storage = new HermesStorage();

// Initialize extension
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Hermes extension installed');
});

// Listen for messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Handle async operations
  handleMessage(request, sender).then(sendResponse);
  return true; // Keep channel open for async response
});

async function handleMessage(request, sender) {
  try {
    switch (request.action) {
      case 'indexCurrentPage':
        return await indexCurrentPage();

      case 'crawlSite':
        return await crawlSite(request.maxPages || 50);

      case 'askQuestion':
        return await askQuestion(request.question, request.domain);

      case 'getStats':
        return await getStats();

      case 'getDomains':
        return await storage.getDomains();

      case 'removeDomain':
        return await removeDomain(request.domain);

      case 'clearAllData':
        return await clearAllData();

      default:
        return { error: 'Unknown action' };
    }
  } catch (error) {
    console.error('Error handling message:', error);
    return { error: error.message };
  }
}

// Index the current active page
async function indexCurrentPage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab) {
    return { success: false, error: 'No active tab found' };
  }

  if (!tab.url || !tab.url.startsWith('http')) {
    return { success: false, error: 'Cannot index this page (not a website)' };
  }

  if (!tab.id) {
    return { success: false, error: 'Cannot access tab' };
  }

  const crawler = new HermesCrawler();
  const pageData = await crawler.extractCurrentPage(tab.id);

  if (!pageData) {
    return { success: false, error: 'Failed to extract page content' };
  }

  // Save page
  await storage.addPage(pageData);

  // Add domain if new
  const domain = storage.extractDomain(pageData.url);
  await storage.addDomain(domain);

  return {
    success: true,
    page: pageData,
    domain
  };
}

// Crawl entire site
async function crawlSite(maxPages) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab) {
    return { success: false, error: 'No active tab found' };
  }

  if (!tab.url || !tab.url.startsWith('http')) {
    return { success: false, error: 'Cannot crawl this page (not a website)' };
  }

  if (!tab.id) {
    return { success: false, error: 'Cannot access tab' };
  }

  const settings = await storage.getSettings();
  const crawler = new HermesCrawler(
    Math.min(maxPages, settings.maxPagesPerCrawl),
    settings.crawlDelay,
    settings.respectRobotsTxt !== false // Default to true if not set
  );

  // Send progress updates to popup
  const result = await crawler.crawlSite(tab.id, (progress) => {
    chrome.runtime.sendMessage({
      type: 'crawlProgress',
      progress
    }).catch(() => {
      // Popup might be closed, ignore
    });
  });

  // Save all pages
  for (const page of result.pages) {
    await storage.addPage(page);
  }

  // Add domain
  await storage.addDomain(result.domain, {
    pageCount: result.pagesCount
  });

  return {
    success: true,
    domain: result.domain,
    pagesCount: result.pagesCount
  };
}

// Ask a question
async function askQuestion(question, domain = null) {
  const apiKey = await storage.getApiKey();
  if (!apiKey) {
    throw new Error('API key not configured. Please set it in settings.');
  }

  const pages = await storage.getPages();
  if (pages.length === 0) {
    throw new Error('No pages indexed. Please index some pages first.');
  }

  const rag = new HermesRAG(apiKey);
  const result = await rag.ask(question, pages, domain);

  // Save to chat history
  await storage.addChatMessage({
    role: 'user',
    content: question,
    domain
  });

  await storage.addChatMessage({
    role: 'assistant',
    content: result.answer,
    sources: result.sources,
    domain
  });

  return result;
}

// Get statistics
async function getStats() {
  return await storage.getStats();
}

// Remove a domain and its pages
async function removeDomain(domain) {
  await storage.removeDomain(domain);
  return { success: true };
}

// Clear all indexed data
async function clearAllData() {
  await storage.clearAllPages();
  await chrome.storage.local.set({ domains: [] });
  return { success: true };
}
