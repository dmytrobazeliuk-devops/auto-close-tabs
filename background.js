// Constants
const DEFAULT_INACTIVE_DAYS = 3;
const CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const STORAGE_KEY = 'tabActivity';
const SETTINGS_KEY = 'extensionSettings';
const TEST_TABS_KEY = 'testTabs';

let testTabIds = new Set();

// Helper function to check if URL is a system page
function isSystemPage(url) {
  if (!url) return true;
  return url.startsWith('chrome://') || 
         url.startsWith('chrome-extension://') ||
         url.startsWith('edge://') ||
         url.startsWith('about:') ||
         url.startsWith('moz-extension://') ||
         url.startsWith('safari-extension://');
}

async function loadTestTabs() {
  try {
    const data = await chrome.storage.local.get(TEST_TABS_KEY);
    const ids = data[TEST_TABS_KEY] || [];
    testTabIds = new Set(ids.map(Number));
  } catch (error) {
    console.error('Error loading test tabs:', error);
    testTabIds = new Set();
  }
}

async function saveTestTabs() {
  try {
    await chrome.storage.local.set({
      [TEST_TABS_KEY]: Array.from(testTabIds)
    });
  } catch (error) {
    console.error('Error saving test tabs:', error);
  }
}

// Initialize existing tabs with current timestamps to avoid accidental cleanup
async function initializeTabActivity() {
  try {
    const [data, tabs] = await Promise.all([
      chrome.storage.local.get(STORAGE_KEY),
      chrome.tabs.query({})
    ]);
    
    const tabActivity = data[STORAGE_KEY] || {};
    const now = Date.now();
    const openTabIds = new Set();
    
    for (const tab of tabs) {
      if (tab.id === chrome.tabs.TAB_ID_NONE || isSystemPage(tab.url)) {
        continue;
      }
      
      openTabIds.add(tab.id);
      
      if (!tabActivity[tab.id]) {
        tabActivity[tab.id] = now;
      }
    }
    
    // Remove records for tabs that are no longer open
    for (const tabId of Object.keys(tabActivity)) {
      const numericId = Number(tabId);
      if (!openTabIds.has(numericId)) {
        delete tabActivity[tabId];
      }
    }
    
    await chrome.storage.local.set({
      [STORAGE_KEY]: tabActivity
    });
  } catch (error) {
    console.error('Error initializing tab activity:', error);
  }
}

// Extension initialization
chrome.runtime.onInstalled.addListener(() => {
  console.log('Simple Auto Close Inactive Tabs extension installed');
  
  // Create alarm for daily check
  chrome.alarms.create('checkInactiveTabs', {
    delayInMinutes: 1, // Check after 1 minute of installation
    periodInMinutes: 24 * 60 // Then every 24 hours
  });
  
  initializeTabActivity();
  loadTestTabs();
});

// Re-sync tab data when the browser starts
chrome.runtime.onStartup.addListener(() => {
  initializeTabActivity();
  loadTestTabs();
});

// Alarm handler
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkInactiveTabs') {
    checkAndCloseInactiveTabs();
  }
});

// Tab activity tracking
chrome.tabs.onActivated.addListener((activeInfo) => {
  updateTabActivity(activeInfo.tabId);
});

chrome.tabs.onCreated.addListener((tab) => {
  if (tab.id === chrome.tabs.TAB_ID_NONE || isSystemPage(tab.url)) {
    return;
  }
  updateTabActivity(tab.id);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && !isSystemPage(tab.url)) {
    updateTabActivity(tabId);
  }
});

// Update tab activity
async function updateTabActivity(tabId) {
  try {
    // Skip invalid tab IDs
    if (!tabId || tabId === chrome.tabs.TAB_ID_NONE) {
      return;
    }
    
    if (testTabIds.has(tabId)) {
      return;
    }
    
    const now = Date.now();
    const data = await chrome.storage.local.get(STORAGE_KEY);
    const tabActivity = data[STORAGE_KEY] || {};
    
    tabActivity[tabId] = now;
    
    await chrome.storage.local.set({
      [STORAGE_KEY]: tabActivity
    });
    
    console.log(`Updated activity for tab ${tabId}`);
  } catch (error) {
    console.error('Error updating tab activity:', error);
  }
}

// Get settings
async function getSettings() {
  try {
    const data = await chrome.storage.local.get(SETTINGS_KEY);
    const settings = data[SETTINGS_KEY] || {
      inactiveDays: DEFAULT_INACTIVE_DAYS,
      enabled: true
    };
    return settings;
  } catch (error) {
    console.error('Error getting settings:', error);
    return { inactiveDays: DEFAULT_INACTIVE_DAYS, enabled: true };
  }
}

// Check and close inactive tabs
async function checkAndCloseInactiveTabs() {
  try {
    const settings = await getSettings();
    
    // If extension is disabled, do nothing
    if (!settings.enabled) {
      console.log('Extension is disabled');
      return;
    }
    
    const data = await chrome.storage.local.get(STORAGE_KEY);
    const tabActivity = data[STORAGE_KEY] || {};
    const now = Date.now();
    const inactiveThreshold = now - (settings.inactiveDays * 24 * 60 * 60 * 1000);
    
    // Get all tabs
    const tabs = await chrome.tabs.query({});
    const tabsToClose = [];
    
    for (const tab of tabs) {
      // Skip closed tabs and system pages
      if (tab.id === chrome.tabs.TAB_ID_NONE || isSystemPage(tab.url)) {
        continue;
      }
      
      const lastActivity = tabActivity[tab.id];
      
      if (!lastActivity) {
        continue; // No recorded activity yet; treat as active
      }
      
      // If tab is inactive for more than set time
      if (lastActivity < inactiveThreshold) {
        tabsToClose.push(tab.id);
      }
    }
    
    // Close inactive tabs
    if (tabsToClose.length > 0) {
      console.log(`Closing ${tabsToClose.length} inactive tabs`);
      
      let closedCount = 0;
      for (const tabId of tabsToClose) {
        try {
          await chrome.tabs.remove(tabId);
          // Remove activity record
          delete tabActivity[tabId];
          closedCount++;
          console.log(`Closed tab ${tabId}`);
        } catch (error) {
          console.error(`Error closing tab ${tabId}:`, error);
        }
      }
      
      console.log(`Successfully closed ${closedCount} out of ${tabsToClose.length} tabs`);
      
      // Update saved data
      await chrome.storage.local.set({
        [STORAGE_KEY]: tabActivity
      });
      
      // Show notification
      try {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: 'Simple Auto Close Inactive Tabs',
          message: `Closed ${closedCount} inactive tabs`
        });
      } catch (notificationError) {
        console.log('Could not show notification:', notificationError);
      }
    } else {
      console.log('No inactive tabs to close');
    }
    
  } catch (error) {
    console.error('Error checking inactive tabs:', error);
  }
}

// Clean up data for closed tabs
chrome.tabs.onRemoved.addListener(async (tabId) => {
  try {
    const data = await chrome.storage.local.get(STORAGE_KEY);
    const tabActivity = data[STORAGE_KEY] || {};
    
    if (tabActivity[tabId]) {
      delete tabActivity[tabId];
      await chrome.storage.local.set({
        [STORAGE_KEY]: tabActivity
      });
      console.log(`Removed data for tab ${tabId}`);
    }
    
    if (testTabIds.delete(tabId)) {
      await saveTestTabs();
    }
  } catch (error) {
    console.error('Error cleaning up tab data:', error);
  }
});

// Message handler from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getTabStats') {
    getTabStats().then(sendResponse);
    return true; // Indicate that response will be asynchronous
  } else if (request.action === 'forceCleanup') {
    checkAndCloseInactiveTabs().then(() => {
      sendResponse({success: true});
    });
    return true;
  } else if (request.action === 'getSettings') {
    getSettings().then(sendResponse);
    return true;
  } else if (request.action === 'saveSettings') {
    saveSettings(request.settings).then(sendResponse);
    return true;
  } else if (request.action === 'startTestMode') {
    startTestMode().then(sendResponse);
    return true;
  }
});

// Save settings
async function saveSettings(settings) {
  try {
    await chrome.storage.local.set({
      [SETTINGS_KEY]: settings
    });
    console.log('Settings saved:', settings);
    return { success: true };
  } catch (error) {
    console.error('Error saving settings:', error);
    return { success: false, error: error.message };
  }
}

// Get tab statistics
async function getTabStats() {
  try {
    const settings = await getSettings();
    const data = await chrome.storage.local.get(STORAGE_KEY);
    const tabActivity = data[STORAGE_KEY] || {};
    const now = Date.now();
    const inactiveThreshold = now - (settings.inactiveDays * 24 * 60 * 60 * 1000);
    
    const tabs = await chrome.tabs.query({});
    let activeTabs = 0;
    let inactiveTabs = 0;
    const tabDetails = [];
    
    for (const tab of tabs) {
      if (tab.id === chrome.tabs.TAB_ID_NONE || isSystemPage(tab.url)) {
        continue;
      }
      
      const lastActivity = tabActivity[tab.id];
      const inactiveHours = lastActivity
        ? Math.max(0, (now - lastActivity) / (60 * 60 * 1000))
        : 0;
      const title = tab.title || tab.url || 'Untitled tab';
      const tabDetail = {
        id: tab.id,
        title,
        url: tab.url || '',
        favicon: tab.favIconUrl || '',
        lastActivity: lastActivity || null,
        inactiveHours: Number(inactiveHours.toFixed(2)),
        status: 'active'
      };
      
      if (!lastActivity) {
        activeTabs++;
        tabDetail.status = 'tracking';
        tabDetails.push(tabDetail);
        continue;
      }
      
      if (lastActivity < inactiveThreshold) {
        inactiveTabs++;
        tabDetail.status = 'inactive';
      } else {
        activeTabs++;
        tabDetail.status = 'active';
      }
      
      tabDetails.push(tabDetail);
    }
    
    tabDetails.sort((a, b) => b.inactiveHours - a.inactiveHours);
    
    return {
      totalTabs: tabs.length,
      activeTabs,
      inactiveTabs,
      inactiveDays: settings.inactiveDays,
      enabled: settings.enabled,
      tabDetails
    };
  } catch (error) {
    console.error('Error getting tab statistics:', error);
    return { error: error.message };
  }
}

// Create overdue test tabs
async function startTestMode() {
  try {
    const settings = await getSettings();
    const data = await chrome.storage.local.get(STORAGE_KEY);
    const tabActivity = data[STORAGE_KEY] || {};
    const tabsToCreate = 5;
    const outdatedTimestamp = Date.now() - ((settings.inactiveDays + 1) * 24 * 60 * 60 * 1000);
    let created = 0;
    
    for (let i = 0; i < tabsToCreate; i++) {
      try {
        const tab = await chrome.tabs.create({
          url: `https://example.com/?auto-close-test=${Date.now()}-${i}`,
          active: false
        });
        if (tab && tab.id !== chrome.tabs.TAB_ID_NONE) {
          tabActivity[tab.id] = outdatedTimestamp;
          testTabIds.add(tab.id);
          created++;
        }
      } catch (createError) {
        console.error('Error creating test tab:', createError);
      }
    }
    
    await chrome.storage.local.set({
      [STORAGE_KEY]: tabActivity,
      [TEST_TABS_KEY]: Array.from(testTabIds)
    });
    
    return { success: true, created };
  } catch (error) {
    console.error('Error starting test mode:', error);
    return { success: false, error: error.message };
  }
}
