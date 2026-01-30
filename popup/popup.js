// Hermes - Popup Script

let currentDomain = null;
let domains = [];

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadStats();
  await loadDomains();
  setupEventListeners();
  checkCurrentTab();
});

function setupEventListeners() {
  // Index page button
  document.getElementById('indexPageBtn').addEventListener('click', indexCurrentPage);

  // Crawl site button
  document.getElementById('crawlSiteBtn').addEventListener('click', crawlSite);

  // Send question
  document.getElementById('sendBtn').addEventListener('click', sendQuestion);

  // Enter key in input
  document.getElementById('questionInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendQuestion();
    }
  });

  // Settings button
  document.getElementById('settingsBtn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Domains button
  document.getElementById('domainsBtn').addEventListener('click', showDomainsPanel);

  // Close domains panel
  document.getElementById('closePanelBtn').addEventListener('click', hideDomainsPanel);

  // Domain filter
  document.getElementById('domainFilter').addEventListener('change', (e) => {
    currentDomain = e.target.value || null;
  });
}

// Check current tab URL
async function checkCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab.url.startsWith('http')) {
    document.getElementById('indexPageBtn').disabled = true;
    document.getElementById('crawlSiteBtn').disabled = true;
    showToast('Cannot index this page (not a website)', 'error');
  }
}

// Load statistics
async function loadStats() {
  try {
    const stats = await chrome.runtime.sendMessage({ action: 'getStats' });

    const statsText = `${stats.totalPages} pages • ${stats.totalDomains} domains`;
    document.getElementById('statsText').textContent = statsText;

    // Show domain selector if multiple domains
    if (stats.totalDomains > 1) {
      document.getElementById('domainSelector').classList.remove('hidden');
    }

    // Check API key
    if (!stats.hasApiKey) {
      showToast('API key not configured. Click ⚙️ to set it up.', 'error');
    }
  } catch (error) {
    console.error('Error loading stats:', error);
  }
}

// Load domains for filter
async function loadDomains() {
  try {
    domains = await chrome.runtime.sendMessage({ action: 'getDomains' });

    // Populate domain filter
    const select = document.getElementById('domainFilter');
    select.innerHTML = '<option value="">All Domains</option>';

    domains.forEach(domain => {
      const option = document.createElement('option');
      option.value = domain.domain;
      option.textContent = `${domain.domain} (${domain.pageCount || 0} pages)`;
      select.appendChild(option);
    });
  } catch (error) {
    console.error('Error loading domains:', error);
  }
}

// Index current page
async function indexCurrentPage() {
  const btn = document.getElementById('indexPageBtn');
  btn.disabled = true;
  btn.textContent = '⏳ Indexing...';

  showStatus('Extracting page content...');

  try {
    // Get active tab to ensure we have permission
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    console.log('Active tab:', tab);

    if (!tab) {
      throw new Error('No active tab found');
    }

    const response = await chrome.runtime.sendMessage({ action: 'indexCurrentPage' });

    if (response.error) {
      throw new Error(response.error);
    }

    hideStatus();
    showToast(`Page indexed from ${response.domain}`, 'success');

    await loadStats();
    await loadDomains();

  } catch (error) {
    hideStatus();
    showToast(error.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '📄 Index This Page';
  }
}

// Crawl site
async function crawlSite() {
  const maxPages = prompt('How many pages to crawl? (max 100)', '20');
  if (!maxPages) return;

  const pages = parseInt(maxPages);
  if (isNaN(pages) || pages < 1) {
    showToast('Please enter a valid number', 'error');
    return;
  }

  const btn = document.getElementById('crawlSiteBtn');
  btn.disabled = true;
  btn.textContent = '⏳ Crawling...';

  showStatus('Starting crawl...');
  showProgress(0);

  // Listen for progress updates
  const progressListener = (message) => {
    if (message.type === 'crawlProgress') {
      const percent = Math.round((message.progress.current / message.progress.total) * 100);
      showProgress(percent);
      showStatus(`Crawling: ${message.progress.current}/${message.progress.total} - ${new URL(message.progress.currentUrl).pathname}`);
    }
  };

  chrome.runtime.onMessage.addListener(progressListener);

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'crawlSite',
      maxPages: Math.min(pages, 100)
    });

    if (response.error) {
      throw new Error(response.error);
    }

    hideStatus();
    showToast(`Crawled ${response.pagesCount} pages from ${response.domain}`, 'success');

    await loadStats();
    await loadDomains();

  } catch (error) {
    hideStatus();
    showToast(error.message, 'error');
  } finally {
    chrome.runtime.onMessage.removeListener(progressListener);
    btn.disabled = false;
    btn.textContent = '🕷️ Crawl Site';
  }
}

// Send question
async function sendQuestion() {
  const input = document.getElementById('questionInput');
  const question = input.value.trim();

  if (!question) return;

  // Clear input
  input.value = '';

  // Hide welcome if present
  const welcome = document.querySelector('.welcome');
  if (welcome) {
    welcome.remove();
  }

  // Add user message
  addMessage('user', question);

  // Disable input
  disableInput(true);

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'askQuestion',
      question,
      domain: currentDomain
    });

    if (response.error) {
      throw new Error(response.error);
    }

    // Add assistant message
    addMessage('assistant', response.answer, response.sources);

  } catch (error) {
    addMessage('assistant', `Sorry, I encountered an error: ${error.message}`);
  } finally {
    disableInput(false);
  }
}

// Add message to UI
function addMessage(role, content, sources = []) {
  const messagesContainer = document.getElementById('messages');

  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${role}`;

  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  contentDiv.textContent = content;

  // Add sources if present
  if (sources && sources.length > 0) {
    const sourcesDiv = document.createElement('div');
    sourcesDiv.className = 'sources';

    const sourcesTitle = document.createElement('div');
    sourcesTitle.className = 'sources-title';
    sourcesTitle.textContent = 'Sources:';
    sourcesDiv.appendChild(sourcesTitle);

    sources.forEach(source => {
      const link = document.createElement('a');
      link.className = 'source-link';
      link.href = source.url;
      link.target = '_blank';
      link.textContent = `${source.domain}: ${source.title || source.url}`;
      link.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: source.url });
      });
      sourcesDiv.appendChild(link);
    });

    contentDiv.appendChild(sourcesDiv);
  }

  messageDiv.appendChild(contentDiv);
  messagesContainer.appendChild(messageDiv);

  // Scroll to bottom
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Show domains panel
async function showDomainsPanel() {
  const panel = document.getElementById('domainsPanel');
  const domainsList = document.getElementById('domainsList');

  // Clear existing content
  domainsList.innerHTML = '';

  if (domains.length === 0) {
    domainsList.innerHTML = '<p style="text-align:center;color:#6b7280;padding:40px;">No domains indexed yet</p>';
  } else {
    domains.forEach(domain => {
      const card = createDomainCard(domain);
      domainsList.appendChild(card);
    });
  }

  panel.classList.remove('hidden');
}

// Hide domains panel
function hideDomainsPanel() {
  document.getElementById('domainsPanel').classList.add('hidden');
}

// Create domain card
function createDomainCard(domain) {
  const card = document.createElement('div');
  card.className = 'domain-card';

  const header = document.createElement('div');
  header.className = 'domain-card-header';

  const name = document.createElement('div');
  name.className = 'domain-name';
  name.textContent = domain.domain;

  const removeBtn = document.createElement('button');
  removeBtn.className = 'remove-domain-btn';
  removeBtn.textContent = '🗑️ Remove';
  removeBtn.addEventListener('click', () => removeDomain(domain.domain));

  header.appendChild(name);
  header.appendChild(removeBtn);

  const stats = document.createElement('div');
  stats.className = 'domain-stats';

  const pageCount = document.createElement('div');
  pageCount.className = 'domain-stat';
  pageCount.innerHTML = `<span>📄</span><span>${domain.pageCount || 0} pages</span>`;

  const lastCrawled = document.createElement('div');
  lastCrawled.className = 'domain-stat';
  const date = domain.lastCrawled ? new Date(domain.lastCrawled).toLocaleDateString() : 'Never';
  lastCrawled.innerHTML = `<span>🕒</span><span>${date}</span>`;

  stats.appendChild(pageCount);
  stats.appendChild(lastCrawled);

  card.appendChild(header);
  card.appendChild(stats);

  return card;
}

// Remove domain
async function removeDomain(domain) {
  if (!confirm(`Remove all pages from ${domain}? This cannot be undone.`)) {
    return;
  }

  try {
    await chrome.runtime.sendMessage({
      action: 'removeDomain',
      domain
    });

    showToast(`Removed ${domain}`, 'success');
    await loadStats();
    await loadDomains();
    await showDomainsPanel(); // Refresh panel
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// UI utilities
function disableInput(disabled) {
  document.getElementById('questionInput').disabled = disabled;
  document.getElementById('sendBtn').disabled = disabled;
}

function showStatus(text) {
  const statusBar = document.getElementById('statusBar');
  const statusText = document.getElementById('statusText');

  statusText.textContent = text;
  statusBar.classList.remove('hidden');
}

function hideStatus() {
  document.getElementById('statusBar').classList.add('hidden');
}

function showProgress(percent) {
  const progressBar = document.getElementById('progressBar');
  const progressFill = document.getElementById('progressFill');

  progressBar.classList.remove('hidden');
  progressFill.style.width = `${percent}%`;
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}
