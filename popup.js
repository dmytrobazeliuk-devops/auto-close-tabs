// DOM elements
const loadingEl = document.getElementById('loading');
const contentEl = document.getElementById('content');
const messageEl = document.getElementById('message');
// Footer removed

// Statistics
const totalTabsEl = document.getElementById('totalTabs');
const activeTabsEl = document.getElementById('activeTabs');
const inactiveTabsEl = document.getElementById('inactiveTabs');
const perTabListEl = document.getElementById('perTabList');

// Buttons
const refreshBtn = document.getElementById('refreshBtn');
const cleanupBtn = document.getElementById('cleanupBtn');
const testModeBtn = document.getElementById('testModeBtn');
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
    
    // Footer removed - no longer needed
    
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
    // Render per-tab details if available
    try {
      renderPerTabList(stats.tabDetails || []);
    } catch (err) {
      console.error('Error rendering per-tab list:', err);
    }
    
    // Footer removed - no longer needed
    
    loadingEl.style.display = 'none';
    contentEl.style.display = 'block';
    
  } catch (error) {
    console.error('Error loading statistics:', error);
    showMessage('Error loading statistics', 'error');
    loadingEl.style.display = 'none';
    contentEl.style.display = 'block';
  }
}

// Render per-tab list
function renderPerTabList(tabDetails) {
  if (!perTabListEl) return;
  perTabListEl.innerHTML = '';

  if (!Array.isArray(tabDetails) || tabDetails.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'tab-row';
    empty.textContent = 'No tabs available';
    perTabListEl.appendChild(empty);
    return;
  }

  for (const detail of tabDetails) {
    const row = document.createElement('div');
    row.className = 'tab-row';
    row.dataset.tabId = detail.id;

    const img = document.createElement('img');
    img.className = 'tab-favicon';
    img.alt = '';
    img.src = detail.favicon || 'icons/icon16.png';

    const title = document.createElement('div');
    title.className = 'tab-title';
    title.title = detail.title || detail.url || '';
    title.textContent = detail.title || detail.url || 'Untitled';

    const hours = document.createElement('div');
    hours.className = 'tab-hours tab-status ' + (detail.status === 'inactive' ? 'inactive' : 'active');
    const hrs = Number(detail.inactiveHours) || 0;
    // Display in minutes if less than 1 hour, otherwise in hours
    if (hrs >= 1) {
      hours.textContent = `${hrs.toFixed(1)} h`;
    } else {
      const minutes = Math.round(hrs * 60);
      hours.textContent = minutes > 0 ? `${minutes} min` : '<1 min';
    }

    row.appendChild(img);
    row.appendChild(title);
    row.appendChild(hours);
    perTabListEl.appendChild(row);
  }
}

// Click-to-focus behavior: clicking a row focuses that tab and closes the popup
if (perTabListEl) {
  perTabListEl.addEventListener('click', (e) => {
    const row = e.target.closest('.tab-row');
    if (!row) return;
    const tabId = Number(row.dataset.tabId);
    if (!tabId) return;

    try {
      chrome.tabs.update(tabId, { active: true });
      // close popup after focusing tab
      window.close();
    } catch (err) {
      console.error('Error focusing tab:', err);
    }
  });
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
  // Test mode button
  testModeBtn.addEventListener('click', async () => {
    showMessage('Creating test tabs...', 'info');
    try {
      const response = await sendMessage({ action: 'startTestMode' });
      if (response.success) {
        showMessage(`Created ${response.created || 0} test tabs. Closing them now...`, 'success');
        const cleanupResponse = await sendMessage({ action: 'forceCleanup' });
        if (cleanupResponse && cleanupResponse.success) {
          showMessage('Test tabs closed successfully!', 'success');
        } else {
          showMessage('Created test tabs but cleanup failed.', 'error');
        }
        await loadStats();
      } else {
        showMessage(response.error || 'Could not start test mode', 'error');
      }
    } catch (error) {
      showMessage('Error: ' + error.message, 'error');
    }
  });
  
