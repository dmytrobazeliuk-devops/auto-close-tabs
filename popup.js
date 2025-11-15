// DOM elements
const loadingEl = document.getElementById('loading');
const contentEl = document.getElementById('content');
const messageEl = document.getElementById('message');
const footerTextEl = document.getElementById('footerText');

// Statistics
const totalTabsEl = document.getElementById('totalTabs');
const activeTabsEl = document.getElementById('activeTabs');
const inactiveTabsEl = document.getElementById('inactiveTabs');
const detailsBtn = document.getElementById('detailsBtn');

// Buttons
const refreshBtn = document.getElementById('refreshBtn');
const cleanupBtn = document.getElementById('cleanupBtn');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');

// Settings
const enabledToggle = document.getElementById('enabledToggle');
const inactiveDaysInput = document.getElementById('inactiveDays');

// Tabs
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  await loadStats();
  setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
  // Refresh statistics button
  refreshBtn.addEventListener('click', loadStats);
  
  // Force cleanup button
  cleanupBtn.addEventListener('click', async () => {
    showMessage('Closing inactive tabs...', 'info');
    
    try {
      const response = await sendMessage({ action: 'forceCleanup' });
      if (response.success) {
        showMessage('Inactive tabs closed successfully!', 'success');
        await loadStats();
      } else {
        showMessage('Error closing tabs', 'error');
      }
    } catch (error) {
      showMessage('Error: ' + error.message, 'error');
    }
  });
  
  // Save settings button
  saveSettingsBtn.addEventListener('click', saveSettings);
  
  // Detailed stats button
  detailsBtn.addEventListener('click', () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL('stats.html')
    });
  });
  
  // Enable/disable toggle
  enabledToggle.addEventListener('click', () => {
    enabledToggle.classList.toggle('active');
  });
  
  // Tab handlers
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.dataset.tab;
      switchTab(targetTab);
    });
  });
}

// Switch between tabs
function switchTab(tabName) {
  // Remove active class from all tabs
  tabs.forEach(tab => tab.classList.remove('active'));
  tabContents.forEach(content => content.classList.remove('active'));
  
  // Add active class to selected tab
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
  document.getElementById(`${tabName}-tab`).classList.add('active');
}

// Load settings
async function loadSettings() {
  try {
    const settings = await sendMessage({ action: 'getSettings' });
    
    // Update UI
    enabledToggle.classList.toggle('active', settings.enabled);
    inactiveDaysInput.value = settings.inactiveDays;
    
    // Update footer text
    footerTextEl.textContent = `Inactive tabs are closed automatically every 24 hours (after ${settings.inactiveDays} days of inactivity)`;
    
  } catch (error) {
    console.error('Error loading settings:', error);
    showMessage('Error loading settings', 'error');
  }
}

// Save settings
async function saveSettings() {
  try {
    const inactiveDays = parseInt(inactiveDaysInput.value);
    
    // Validation
    if (isNaN(inactiveDays) || inactiveDays < 1 || inactiveDays > 365) {
      showMessage('Number of days must be between 1 and 365', 'error');
      return;
    }
    
    const settings = {
      enabled: enabledToggle.classList.contains('active'),
      inactiveDays: inactiveDays
    };
    
    const response = await sendMessage({ 
      action: 'saveSettings', 
      settings: settings 
    });
    
    if (response.success) {
      showMessage('Settings saved!', 'success');
      await loadStats(); // Update statistics
    } else {
      showMessage('Error saving settings', 'error');
    }
    
  } catch (error) {
    console.error('Error saving settings:', error);
    showMessage('Error: ' + error.message, 'error');
  }
}

// Load statistics
async function loadStats() {
  try {
    loadingEl.style.display = 'block';
    contentEl.style.display = 'none';
    
    const stats = await sendMessage({ action: 'getTabStats' });
    
    if (stats.error) {
      showMessage('Error loading statistics: ' + stats.error, 'error');
      return;
    }
    
    // Update statistics
    totalTabsEl.textContent = stats.totalTabs;
    activeTabsEl.textContent = stats.activeTabs;
    inactiveTabsEl.textContent = stats.inactiveTabs;
    
    // Update footer text with current number of days
    footerTextEl.textContent = `Inactive tabs are closed automatically every 24 hours (after ${stats.inactiveDays} days of inactivity)`;
    
    loadingEl.style.display = 'none';
    contentEl.style.display = 'block';
    
  } catch (error) {
    console.error('Error loading statistics:', error);
    showMessage('Error loading statistics', 'error');
    loadingEl.style.display = 'none';
    contentEl.style.display = 'block';
  }
}

// Send message to background script
function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

// Show messages
function showMessage(text, type = 'info') {
  messageEl.textContent = text;
  messageEl.className = type;
  messageEl.style.display = 'block';
  
  // Auto-hide message after 3 seconds
  setTimeout(() => {
    messageEl.style.display = 'none';
  }, 3000);
}

// Auto-update statistics every 30 seconds
setInterval(loadStats, 30000);
