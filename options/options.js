// Hermes - Options Page

document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  loadStats();
  setupEventListeners();
});

function setupEventListeners() {
  // Save API key
  document.getElementById('saveBtn').addEventListener('click', saveApiKey);

  // Save crawl settings
  document.getElementById('saveCrawlSettings').addEventListener('click', saveCrawlSettings);

  // Toggle API key visibility
  document.getElementById('toggleKey').addEventListener('click', toggleKeyVisibility);

  // Clear data buttons
  document.getElementById('clearDataBtn').addEventListener('click', clearAllData);
  document.getElementById('clearChatBtn').addEventListener('click', clearChatHistory);
  document.getElementById('exportDataBtn').addEventListener('click', exportData);

  // Enter key to save
  document.getElementById('apiKey').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      saveApiKey();
    }
  });
}

async function loadSettings() {
  // Load API key
  chrome.storage.local.get('apiKey', (result) => {
    if (result.apiKey) {
      document.getElementById('apiKey').value = result.apiKey;
    }
  });

  // Load crawl settings
  chrome.storage.local.get('settings', (result) => {
    const settings = result.settings || {};
    document.getElementById('maxPages').value = settings.maxPagesPerCrawl || 50;
    document.getElementById('crawlDelay').value = settings.crawlDelay || 2000;
  });
}

async function loadStats() {
  try {
    const stats = await chrome.runtime.sendMessage({ action: 'getStats' });

    document.getElementById('totalPages').textContent = stats.totalPages;
    document.getElementById('totalDomains').textContent = stats.totalDomains;
  } catch (error) {
    console.error('Error loading stats:', error);
  }
}

function saveApiKey() {
  const apiKey = document.getElementById('apiKey').value.trim();

  if (!apiKey) {
    showStatus('Please enter an API key', 'error');
    return;
  }

  if (!apiKey.startsWith('sk-ant-')) {
    showStatus('Invalid API key format. Should start with sk-ant-', 'error');
    return;
  }

  chrome.storage.local.set({ apiKey }, () => {
    showStatus('API key saved successfully!', 'success');
  });
}

function saveCrawlSettings() {
  const maxPages = parseInt(document.getElementById('maxPages').value);
  const crawlDelay = parseInt(document.getElementById('crawlDelay').value);

  if (maxPages < 1 || maxPages > 100) {
    alert('Max pages must be between 1 and 100');
    return;
  }

  if (crawlDelay < 500 || crawlDelay > 10000) {
    alert('Crawl delay must be between 500 and 10000 ms');
    return;
  }

  chrome.storage.local.get('settings', (result) => {
    const settings = result.settings || {};
    settings.maxPagesPerCrawl = maxPages;
    settings.crawlDelay = crawlDelay;

    chrome.storage.local.set({ settings }, () => {
      showStatus('Crawl settings saved!', 'success');
    });
  });
}

function toggleKeyVisibility() {
  const input = document.getElementById('apiKey');
  const button = document.getElementById('toggleKey');

  if (input.type === 'password') {
    input.type = 'text';
    button.textContent = 'Hide';
  } else {
    input.type = 'password';
    button.textContent = 'Show';
  }
}

async function clearAllData() {
  if (!confirm('Are you sure you want to clear ALL indexed pages from ALL domains? This cannot be undone.')) {
    return;
  }

  try {
    await chrome.runtime.sendMessage({ action: 'clearAllData' });
    showStatus('All data cleared successfully!', 'success');
    loadStats();
  } catch (error) {
    showStatus(`Error: ${error.message}`, 'error');
  }
}

async function clearChatHistory() {
  if (!confirm('Are you sure you want to clear your chat history? This cannot be undone.')) {
    return;
  }

  try {
    await chrome.storage.local.set({ chatHistory: [] });
    showStatus('Chat history cleared successfully!', 'success');
  } catch (error) {
    showStatus(`Error: ${error.message}`, 'error');
  }
}

async function exportData() {
  try {
    const data = await chrome.storage.local.get(['pages', 'domains', 'chatHistory']);

    const exportData = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      pages: data.pages || [],
      domains: data.domains || [],
      chatHistory: data.chatHistory || [],
      stats: {
        totalPages: (data.pages || []).length,
        totalDomains: (data.domains || []).length
      }
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `hermes-export-${Date.now()}.json`;
    a.click();

    URL.revokeObjectURL(url);

    showStatus('Data exported successfully!', 'success');
  } catch (error) {
    showStatus(`Error: ${error.message}`, 'error');
  }
}

function showStatus(message, type) {
  const status = document.getElementById('saveStatus');
  status.textContent = message;
  status.className = `status ${type}`;
  status.classList.remove('hidden');

  setTimeout(() => {
    status.classList.add('hidden');
  }, 3000);
}
