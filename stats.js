const activeCountEl = document.getElementById('activeCount');
const inactiveCountEl = document.getElementById('inactiveCount');
const totalCountEl = document.getElementById('totalCount');
const detailListEl = document.getElementById('detailList');
const inactiveDaysLabelEl = document.getElementById('inactiveDaysLabel');
const updatedNoteEl = document.getElementById('updatedNote');

const refreshButton = document.getElementById('refreshStatsBtn');
const backToMainBtn = document.getElementById('backToMainBtn');
const fallbackIcon = chrome.runtime.getURL('icons/icon32.png');

document.addEventListener('DOMContentLoaded', () => {
  refreshButton.addEventListener('click', loadDetailedStats);
  
  backToMainBtn.addEventListener('click', () => {
    window.close();
  });
  
  loadDetailedStats();
});

async function loadDetailedStats() {
  refreshButton.disabled = true;
  refreshButton.textContent = 'Refreshing...';
  
  try {
    const stats = await sendMessage({ action: 'getTabStats' });
    if (stats.error) {
      showError(stats.error);
      return;
    }
    
    activeCountEl.textContent = stats.activeTabs;
    inactiveCountEl.textContent = stats.inactiveTabs;
    totalCountEl.textContent = stats.totalTabs;
    inactiveDaysLabelEl.textContent = `Inactive after ${stats.inactiveDays} day(s)`;
    updatedNoteEl.textContent = `Updated ${new Date().toLocaleString()}`;
    
    renderDetailedList(Array.isArray(stats.tabDetails) ? stats.tabDetails : []);
  } catch (error) {
    showError(error.message);
  } finally {
    refreshButton.disabled = false;
    refreshButton.textContent = '🔄 Refresh data';
  }
}

function renderDetailedList(details) {
  if (!details.length) {
    detailListEl.innerHTML = '<div class="empty-state">No tabs tracked yet.</div>';
    return;
  }
  
  detailListEl.innerHTML = '';
  
  details.forEach((detail) => {
    const row = document.createElement('div');
    row.className = 'tab-row';
    
    const infoCol = document.createElement('div');
    infoCol.className = 'tab-info';
    
    const favicon = document.createElement('img');
    favicon.className = 'tab-favicon';
    favicon.src = detail.favicon || fallbackIcon;
    favicon.alt = `${detail.title} icon`;
    favicon.addEventListener('error', () => {
      if (favicon.src !== fallbackIcon) {
        favicon.src = fallbackIcon;
      }
    });
    
    const textWrap = document.createElement('div');
    textWrap.className = 'tab-text';
    
    const title = document.createElement('div');
    title.className = 'tab-title';
    title.textContent = detail.title;
    
    const url = document.createElement('div');
    url.className = 'tab-url';
    url.textContent = detail.url || 'URL unavailable';
    url.title = detail.url || 'URL unavailable';
    
    textWrap.appendChild(title);
    textWrap.appendChild(url);
    
    infoCol.appendChild(favicon);
    infoCol.appendChild(textWrap);
    
    const statusCol = document.createElement('div');
    statusCol.className = 'tab-status-column';
    
    const status = document.createElement('div');
    status.className = `tab-status status-${detail.status || 'active'}`;
    status.textContent = formatStatus(detail.status);
    
    statusCol.appendChild(status);
    
    const hoursCol = document.createElement('div');
    hoursCol.className = 'tab-hours';
    hoursCol.innerHTML = detail.lastActivity
      ? `${detail.inactiveHours.toFixed(1)} h<small>inactive</small>`
      : '—<small>tracking</small>';
    
    const lastActivity = document.createElement('div');
    lastActivity.className = 'tab-last-activity';
    lastActivity.textContent = detail.lastActivity
      ? new Date(detail.lastActivity).toLocaleString()
      : 'Waiting for first activity';
    
    row.appendChild(infoCol);
    row.appendChild(statusCol);
    row.appendChild(hoursCol);
    row.appendChild(lastActivity);
    
    detailListEl.appendChild(row);
  });
}

function formatStatus(status) {
  if (status === 'inactive') return 'Inactive';
  if (status === 'tracking') return 'Tracking';
  return 'Active';
}

function showError(message) {
  detailListEl.innerHTML = `<div class="empty-state">Error loading statistics: ${message}</div>`;
}

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
