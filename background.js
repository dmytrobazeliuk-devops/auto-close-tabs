// Constants
const DEFAULT_INACTIVE_DAYS = 3;
const CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const STORAGE_KEY = 'tabActivity';
const SETTINGS_KEY = 'extensionSettings';
const TEST_TABS_KEY = 'testTabs';
const SYNC_INTERVAL = 5 * 60 * 1000; // Sync every 5 minutes

let testTabIds = new Set();
let lastSyncTime = 0;
let tabPreviousUrls = new Map(); // Track previous URLs to detect actual navigation (not reloads)

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

// Initialize existing tabs and restore timestamps after browser/PC restart
// Uses URL-based tracking to preserve timestamps across browser/PC restarts
// IMPORTANT: Timers continue from where they left off - they are NOT reset after restart
async function initializeTabActivity() {
  try {
    const [data, tabs] = await Promise.all([
      chrome.storage.local.get([STORAGE_KEY, 'urlActivity']),
      chrome.tabs.query({})
    ]);
    
    const tabActivity = data[STORAGE_KEY] || {};
    const urlActivity = data['urlActivity'] || {}; // Track by URL to survive restarts
    const now = Date.now();
    const openTabIds = new Set();
    const openTabUrls = new Set();
    
    // First pass: restore timestamps from URL-based tracking for existing tabs
    // This preserves inactivity time across browser/PC restarts
    for (const tab of tabs) {
      if (tab.id === chrome.tabs.TAB_ID_NONE) {
        continue;
      }
      
      // Skip system pages
      if (tab.url && isSystemPage(tab.url)) {
        continue;
      }
      
      openTabIds.add(tab.id);
      if (tab.url) {
        openTabUrls.add(tab.url);
        // Initialize previous URL tracking
        tabPreviousUrls.set(tab.id, tab.url);
      }
      
      // Priority: URL-based tracking > ID-based tracking > new tab
      // This ensures timers continue after restart
      if (tab.url && urlActivity[tab.url]) {
        // Restore timestamp from URL-based record (preserves inactivity time across restarts)
        tabActivity[tab.id] = urlActivity[tab.url];
        console.log(`Restored timestamp for tab ${tab.id} from URL: ${tab.url}, timestamp: ${urlActivity[tab.url]} (continuing timer after restart)`);
      } else if (tabActivity[tab.id]) {
        // Tab has ID record - sync to URL record if URL exists
        if (tab.url) {
          // Use the older timestamp (preserve inactivity)
          if (!urlActivity[tab.url] || urlActivity[tab.url] > tabActivity[tab.id]) {
            urlActivity[tab.url] = tabActivity[tab.id];
          }
        }
        console.log(`Preserved timestamp for tab ${tab.id} in same session`);
      } else {
        // Truly new tab (not restored from session) - only then set current time
        // This happens only for tabs created AFTER extension initialization
        tabActivity[tab.id] = now;
        if (tab.url) {
          urlActivity[tab.url] = now;
        }
        console.log(`New tab ${tab.id}${tab.url ? ` (${tab.url})` : ''} - starting tracking from now`);
      }
    }
    
    // Remove records for tabs that are no longer open
    for (const tabId of Object.keys(tabActivity)) {
      const numericId = Number(tabId);
      if (!openTabIds.has(numericId)) {
        delete tabActivity[tabId];
      }
    }
    
    // Remove URL records for URLs that are no longer open
    for (const url of Object.keys(urlActivity)) {
      if (!openTabUrls.has(url)) {
        delete urlActivity[url];
      }
    }
    
    await chrome.storage.local.set({
      [STORAGE_KEY]: tabActivity,
      'urlActivity': urlActivity
    });
    
    console.log('Tab activity initialized. Timers preserved and continue after browser/PC restart.');
  } catch (error) {
    console.error('Error initializing tab activity:', error);
  }
}

// Multi-level verification system for timer persistence
// Level 1: Immediate initialization when service worker loads
async function performMultiLevelSync() {
  console.log('=== Multi-level timer sync started ===');
  
  // Level 1: Initialize tab activity
  await initializeTabActivity();
  
  // Level 2: Verify and repair any missing timers
  await verifyAndRepairTimers();
  
  // Level 3: Sync URL-based tracking
  await syncUrlBasedTracking();
  
  console.log('=== Multi-level timer sync completed ===');
}

// Level 2: Verify and repair missing timers
async function verifyAndRepairTimers() {
  try {
    const [data, tabs] = await Promise.all([
      chrome.storage.local.get([STORAGE_KEY, 'urlActivity']),
      chrome.tabs.query({})
    ]);
    
    const tabActivity = data[STORAGE_KEY] || {};
    const urlActivity = data['urlActivity'] || {};
    let repaired = 0;
    
    for (const tab of tabs) {
      if (tab.id === chrome.tabs.TAB_ID_NONE || isSystemPage(tab.url)) {
        continue;
      }
      
      // Check if tab has timer but URL doesn't (or vice versa)
      const hasTabTimer = !!tabActivity[tab.id];
      const hasUrlTimer = tab.url && !!urlActivity[tab.url];
      
      if (tab.url) {
        if (hasUrlTimer && !hasTabTimer) {
          // URL has timer but tab doesn't - restore from URL
          tabActivity[tab.id] = urlActivity[tab.url];
          repaired++;
          console.log(`[Verify] Repaired: Restored timer for tab ${tab.id} from URL ${tab.url}`);
        } else if (hasTabTimer && !hasUrlTimer) {
          // Tab has timer but URL doesn't - sync to URL
          urlActivity[tab.url] = tabActivity[tab.id];
          repaired++;
          console.log(`[Verify] Repaired: Synced timer from tab ${tab.id} to URL ${tab.url}`);
        } else if (!hasTabTimer && !hasUrlTimer) {
          // Neither has timer - this is a truly new tab
          // Only initialize if tab was created recently (within last 5 minutes)
          // This prevents resetting timers for tabs that were just restored from session
          const now = Date.now();
          const fiveMinutesAgo = now - (5 * 60 * 1000);
          
          // Check if tab was created recently by checking if it has a recent timestamp in storage
          // If not, it might be a restored tab - don't initialize
          const tabCreatedRecently = tab.id && (!tabActivity[tab.id] || tabActivity[tab.id] > fiveMinutesAgo);
          
          if (tabCreatedRecently) {
            tabActivity[tab.id] = now;
            urlActivity[tab.url] = now;
            repaired++;
            console.log(`[Verify] Repaired: Initialized timer for new tab ${tab.id} (${tab.url})`);
          } else {
            // Tab might be restored from session - don't reset timer
            console.log(`[Verify] Skipped: Tab ${tab.id} might be restored from session, not initializing timer`);
          }
        }
      }
    }
    
    if (repaired > 0) {
      await chrome.storage.local.set({
        [STORAGE_KEY]: tabActivity,
        'urlActivity': urlActivity
      });
      console.log(`[Verify] Repaired ${repaired} timer(s)`);
    } else {
      console.log('[Verify] All timers are synchronized');
    }
  } catch (error) {
    console.error('[Verify] Error verifying timers:', error);
  }
}

// Level 3: Sync URL-based tracking across all tabs
async function syncUrlBasedTracking() {
  try {
    const [data, tabs] = await Promise.all([
      chrome.storage.local.get([STORAGE_KEY, 'urlActivity']),
      chrome.tabs.query({})
    ]);
    
    const tabActivity = data[STORAGE_KEY] || {};
    const urlActivity = data['urlActivity'] || {};
    let synced = 0;
    
    // Group tabs by URL
    const urlToTabs = new Map();
    for (const tab of tabs) {
      if (tab.id === chrome.tabs.TAB_ID_NONE || isSystemPage(tab.url) || !tab.url) {
        continue;
      }
      
      if (!urlToTabs.has(tab.url)) {
        urlToTabs.set(tab.url, []);
      }
      urlToTabs.get(tab.url).push(tab.id);
    }
    
    // For each URL, ensure all tabs with that URL have the same (oldest) timestamp
    for (const [url, tabIds] of urlToTabs.entries()) {
      if (!urlActivity[url]) {
        // URL has no timer - find oldest tab timer for this URL
        let oldestTimer = null;
        for (const tabId of tabIds) {
          if (tabActivity[tabId] && (!oldestTimer || tabActivity[tabId] < oldestTimer)) {
            oldestTimer = tabActivity[tabId];
          }
        }
        
        if (oldestTimer) {
          urlActivity[url] = oldestTimer;
          synced++;
          console.log(`[Sync] Synced URL ${url} with oldest timer from tabs`);
        }
      } else {
        // URL has timer - ensure all tabs with this URL use it (if it's older)
        // IMPORTANT: Only update if tab has no timer OR tab timer is NEWER than URL timer
        // This preserves inactivity time - never reset to newer time
        for (const tabId of tabIds) {
          if (!tabActivity[tabId]) {
            // Tab has no timer - restore from URL (preserves inactivity)
            tabActivity[tabId] = urlActivity[url];
            synced++;
            console.log(`[Sync] Restored timer for tab ${tabId} from URL ${url} (preserved inactivity)`);
          } else if (tabActivity[tabId] > urlActivity[url]) {
            // Tab timer is NEWER than URL timer - use older URL timer (preserve inactivity)
            tabActivity[tabId] = urlActivity[url];
            synced++;
            console.log(`[Sync] Updated tab ${tabId} to use older URL timer for ${url} (preserved inactivity)`);
          }
          // If tab timer is OLDER than URL timer, keep tab timer (don't reset to newer time)
        }
      }
    }
    
    if (synced > 0) {
      await chrome.storage.local.set({
        [STORAGE_KEY]: tabActivity,
        'urlActivity': urlActivity
      });
      console.log(`[Sync] Synchronized ${synced} timer(s) across URL-based tracking`);
    } else {
      console.log('[Sync] URL-based tracking is synchronized');
    }
  } catch (error) {
    console.error('[Sync] Error syncing URL-based tracking:', error);
  }
}

// Initialize immediately when service worker loads (handles browser restart)
performMultiLevelSync();
loadTestTabs();

// Extension initialization
chrome.runtime.onInstalled.addListener(() => {
  console.log('Simple Auto Close Inactive Tabs extension installed');
  
  // Create alarm for daily check
  chrome.alarms.create('checkInactiveTabs', {
    delayInMinutes: 1, // Check after 1 minute of installation
    periodInMinutes: 24 * 60 // Then every 24 hours
  });
  
  // Create alarm for periodic sync
  chrome.alarms.create('syncTimers', {
    delayInMinutes: 1, // First sync after 1 minute
    periodInMinutes: SYNC_INTERVAL / (60 * 1000) // Then every SYNC_INTERVAL minutes
  });
  
  performMultiLevelSync();
  loadTestTabs();
});

// Re-sync tab data when the browser starts
chrome.runtime.onStartup.addListener(() => {
  console.log('Browser startup detected - performing multi-level sync');
  performMultiLevelSync();
  loadTestTabs();
});

// Alarm handler
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkInactiveTabs') {
    checkAndCloseInactiveTabs();
  } else if (alarm.name === 'syncTimers') {
    // Periodic sync to ensure timers are preserved
    // Only sync if enough time has passed to avoid resetting timers
    const now = Date.now();
    if (now - lastSyncTime > SYNC_INTERVAL) {
      lastSyncTime = now;
      // Only verify, don't repair aggressively - this prevents timer resets
      // verifyAndRepairTimers(); // Commented out - too aggressive, resets timers
      // Only sync URL-based tracking if needed, don't force updates
      syncUrlBasedTracking();
    }
  }
});

// Tab activity tracking
// Only update timestamp when user ACTIVELY interacts with tab (activates it)
chrome.tabs.onActivated.addListener((activeInfo) => {
  updateTabActivity(activeInfo.tabId, true); // true = user actively activated
});

chrome.tabs.onCreated.addListener(async (tab) => {
  if (tab.id === chrome.tabs.TAB_ID_NONE || isSystemPage(tab.url)) {
    return;
  }
  // Initialize tracking for new tabs
  // If tab has URL, track it immediately
  // If tab doesn't have URL yet (still loading), wait a bit and retry
  if (tab.url) {
    tabPreviousUrls.set(tab.id, tab.url);
    updateTabActivity(tab.id, false); // false = just initialize, don't reset if exists
  } else {
    // Tab is still loading, wait a bit and check again
    setTimeout(async () => {
      try {
        const updatedTab = await chrome.tabs.get(tab.id);
        if (updatedTab && updatedTab.url && !isSystemPage(updatedTab.url)) {
          tabPreviousUrls.set(tab.id, updatedTab.url);
          updateTabActivity(tab.id, false);
        }
      } catch (error) {
        // Tab might be closed, ignore
      }
    }, 1000);
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Don't update timestamp on page load or reload - only when user navigates to different URL
  // This preserves inactivity time for tabs restored from session or reloaded
  
  // IMPORTANT: Only handle URL changes if URL actually changed (not just page reload)
  // Don't update on status changes - these happen automatically and shouldn't reset timers
  if (changeInfo.url && tab.url && !isSystemPage(tab.url)) {
    const previousUrl = tabPreviousUrls.get(tabId);
    
    // Only update if URL actually changed (different URL, not reload)
    if (previousUrl !== tab.url) {
      // URL changed to a different URL - this is navigation, preserve existing timestamp
      updateTabActivity(tabId, false); // false = preserve existing timestamp
      tabPreviousUrls.set(tabId, tab.url);
    }
    // If URL is the same (page reload), don't update activity - preserve timer
  } else if (tab.url && !isSystemPage(tab.url)) {
    // Track URL even if changeInfo.url is not set (initial load)
    if (!tabPreviousUrls.has(tabId)) {
      tabPreviousUrls.set(tabId, tab.url);
    }
  }
  // Removed status === 'complete' handler - it was causing timers to reset on page reloads
});

// Update tab activity
// IMPORTANT: Only updates timestamp when user actually interacts with tab
// Does NOT reset timestamps for tabs restored from session
// @param tabId - ID of the tab
// @param isUserAction - true if user actively activated tab, false if just tracking existence
async function updateTabActivity(tabId, isUserAction = false) {
  try {
    // Skip invalid tab IDs
    if (!tabId || tabId === chrome.tabs.TAB_ID_NONE) {
      return;
    }
    
    if (testTabIds.has(tabId)) {
      return;
    }
    
    const now = Date.now();
    const data = await chrome.storage.local.get([STORAGE_KEY, 'urlActivity']);
    const tabActivity = data[STORAGE_KEY] || {};
    const urlActivity = data['urlActivity'] || {};
    
    // Get tab URL for URL-based tracking
    let tabUrl = null;
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab && tab.url && !isSystemPage(tab.url)) {
        tabUrl = tab.url;
      }
    } catch (error) {
      // Tab might be closed, ignore
    }
    
    if (isUserAction) {
      // User actively activated/navigated to tab - always update timestamp
      tabActivity[tabId] = now;
      if (tabUrl) {
        urlActivity[tabUrl] = now;
        // Update previous URL tracking
        tabPreviousUrls.set(tabId, tabUrl);
      }
      console.log(`User activity on tab ${tabId}${tabUrl ? ` (URL: ${tabUrl})` : ''} - updated timestamp`);
    } else {
      // Just tracking tab existence (onCreated, onUpdated) - preserve existing timestamps
      if (tabUrl && urlActivity[tabUrl]) {
        // Tab with URL that we've seen before - restore timestamp, don't reset
        tabActivity[tabId] = urlActivity[tabUrl];
        console.log(`Restored timestamp for tab ${tabId} from URL: ${tabUrl} (preserved inactivity)`);
      } else if (!tabActivity[tabId]) {
        // Truly new tab - start tracking from now
        tabActivity[tabId] = now;
        if (tabUrl) {
          urlActivity[tabUrl] = now;
          // Update previous URL tracking
          tabPreviousUrls.set(tabId, tabUrl);
        }
        console.log(`New tab ${tabId}${tabUrl ? ` (URL: ${tabUrl})` : ''} - starting tracking`);
      }
      // If tab already has ID record, keep it (don't overwrite)
    }
    
    await chrome.storage.local.set({
      [STORAGE_KEY]: tabActivity,
      'urlActivity': urlActivity
    });
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
    // Level 6: Only sync URL-based tracking, don't verify aggressively
    // verifyAndRepairTimers(); // Commented out - too aggressive, resets timers
    await syncUrlBasedTracking(); // Only sync, don't repair
    
    const settings = await getSettings();
    
    // If extension is disabled, do nothing
    if (!settings.enabled) {
      console.log('Extension is disabled');
      return;
    }
    
    const data = await chrome.storage.local.get([STORAGE_KEY, 'urlActivity']);
    const tabActivity = data[STORAGE_KEY] || {};
    const urlActivity = data['urlActivity'] || {};
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
      
      let lastActivity = tabActivity[tab.id];
      
      // Level 7: Verify timer exists before checking inactivity
      if (!lastActivity && tab.url && urlActivity[tab.url]) {
        // Restore from URL-based tracking
        lastActivity = urlActivity[tab.url];
        tabActivity[tab.id] = lastActivity;
        console.log(`[Cleanup] Verified: Restored timer for tab ${tab.id} from URL before checking inactivity`);
      }
      
      if (!lastActivity) {
        continue; // No recorded activity yet; treat as active
      }
      
      // If tab is inactive for more than set time
      if (lastActivity < inactiveThreshold) {
        tabsToClose.push({ id: tab.id, url: tab.url });
      }
    }
    
    // Save verified timers (always save to ensure consistency)
    await chrome.storage.local.set({
      [STORAGE_KEY]: tabActivity,
      'urlActivity': urlActivity
    });
    
    // Close inactive tabs
    if (tabsToClose.length > 0) {
      console.log(`Closing ${tabsToClose.length} inactive tabs`);
      
      let closedCount = 0;
      for (const tabInfo of tabsToClose) {
        try {
          await chrome.tabs.remove(tabInfo.id);
          // Remove activity record by ID
          delete tabActivity[tabInfo.id];
          // Also remove URL-based record if exists
          if (tabInfo.url && urlActivity[tabInfo.url]) {
            delete urlActivity[tabInfo.url];
          }
          closedCount++;
          console.log(`Closed tab ${tabInfo.id}`);
        } catch (error) {
          console.error(`Error closing tab ${tabInfo.id}:`, error);
        }
      }
      
      console.log(`Successfully closed ${closedCount} out of ${tabsToClose.length} tabs`);
      
      // Update saved data
      await chrome.storage.local.set({
        [STORAGE_KEY]: tabActivity,
        'urlActivity': urlActivity
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
    const data = await chrome.storage.local.get([STORAGE_KEY, 'urlActivity']);
    const tabActivity = data[STORAGE_KEY] || {};
    const urlActivity = data['urlActivity'] || {};
    let updated = false;
    
    if (tabActivity[tabId]) {
      delete tabActivity[tabId];
      updated = true;
    }
    
    // Clean up previous URL tracking
    tabPreviousUrls.delete(tabId);
    
    // Note: We can't get tab URL here since tab is already closed
    // URL-based cleanup will happen in initializeTabActivity on next startup
    
    if (updated) {
      await chrome.storage.local.set({
        [STORAGE_KEY]: tabActivity,
        'urlActivity': urlActivity
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
  } else if (request.action === 'syncTimers') {
    // Manual sync request from popup
    performMultiLevelSync().then(() => {
      sendResponse({success: true});
    });
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

// Get tab statistics with multi-level verification
async function getTabStats() {
  try {
    // Level 4: Verify timers when stats are requested (from popup)
    // Don't verify aggressively - only sync URL-based tracking to avoid resetting timers
    // await verifyAndRepairTimers(); // Commented out - too aggressive
    await syncUrlBasedTracking(); // Only sync, don't repair
    
    const settings = await getSettings();
    const data = await chrome.storage.local.get([STORAGE_KEY, 'urlActivity']);
    const tabActivity = data[STORAGE_KEY] || {};
    const urlActivity = data['urlActivity'] || {};
    const now = Date.now();
    const inactiveThreshold = now - (settings.inactiveDays * 24 * 60 * 60 * 1000);
    
    const tabs = await chrome.tabs.query({});
    let activeTabs = 0;
    let inactiveTabs = 0;
    const tabDetails = [];
    let verifiedCount = 0;
    
    for (const tab of tabs) {
      if (tab.id === chrome.tabs.TAB_ID_NONE || isSystemPage(tab.url)) {
        continue;
      }
      
      let lastActivity = tabActivity[tab.id];
      
      // Level 5: Verify timer exists, if not try to restore from URL
      if (!lastActivity && tab.url && urlActivity[tab.url]) {
        // Restore from URL-based tracking
        lastActivity = urlActivity[tab.url];
        tabActivity[tab.id] = lastActivity;
        verifiedCount++;
        console.log(`[Stats] Verified: Restored timer for tab ${tab.id} from URL ${tab.url}`);
      }
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
    
    // Save verified timers if any were restored
    if (verifiedCount > 0) {
      await chrome.storage.local.set({
        [STORAGE_KEY]: tabActivity,
        'urlActivity': urlActivity
      });
      console.log(`[Stats] Saved ${verifiedCount} verified timer(s)`);
    }
    
    tabDetails.sort((a, b) => b.inactiveHours - a.inactiveHours);
    
    return {
      totalTabs: tabs.length,
      activeTabs,
      inactiveTabs,
      inactiveDays: settings.inactiveDays,
      enabled: settings.enabled,
      tabDetails,
      verifiedCount // Include verification count for debugging
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
