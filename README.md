# Simple Auto Close Inactive Tabs – Chrome Extension

Automatically closes inactive tabs after the configured period of inactivity.

## Features

- 🕒 **Configurable timer**: Choose how many inactive days to allow (1–365 days)
- 🔄 **Automatic clean up**: Checks and closes inactive tabs every 24 hours
- 📊 **Statistics**: See how many tabs are active vs. ready to close
- ⚙️ **Controls**: Enable/disable the extension at any time
- 🚫 **Safety**: System pages (chrome://, edge://, etc.) never close automatically
- 🧪 **Test mode**: Spawn overdue tabs to confirm auto-cleanup works

## Installation

1. Download the `auto-close-tabs.zip` archive
2. Extract it to any folder
3. Open Chrome and go to `chrome://extensions/`
4. Enable **Developer mode**
5. Click **Load unpacked**
6. Select the folder that contains the extracted files

## Usage

1. Click the extension icon in the Chrome toolbar
2. Open the **Settings** tab
3. Choose how many days a tab can remain inactive
4. Toggle the extension on or off as needed
5. Press **Save settings**
6. Use **Create test tabs** if you want to generate overdue tabs for a quick cleanup test

## Settings

- **Inactive days**: 1–365 days (default: 3 days)
- **Automatic check**: Runs every 24 hours
- **Stats view**: Shows total, active, and inactive tabs

## Technical details

- **Manifest version**: 3
- **Permissions**: tabs, storage, alarms, notifications
- **Storage**: Local storage for tab activity timestamps
- **Compatibility**: Chrome, Edge, and other Chromium browsers

## File structure

```
auto-close-tabs/
├── manifest.json          # Extension manifest
├── background.js          # Background service worker
├── popup.html             # Popup UI
├── popup.js               # Popup logic
├── icons/                 # Extension icons
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── README.md              # This file
```

## Changelog

### Version 1.1 (2025-11-19)

**Fixed:**
- ✅ **Timer persistence across browser restarts**: Fixed critical bug where inactivity timers were reset after browser restart
- ✅ **URL-based tracking**: Implemented dual tracking system (by tab ID and URL) to preserve inactivity timestamps across browser sessions
- ✅ **Proper inactivity detection**: Timers now only reset when user actively interacts with tabs, not when tabs are restored from session
- ✅ **Session restoration**: Tabs restored after browser restart now maintain their original inactivity time

**Technical improvements:**
- Added URL-based activity tracking alongside ID-based tracking
- Improved `initializeTabActivity()` to restore timestamps from URL records
- Modified `updateTabActivity()` to only update timestamps on user interaction (tab activation), not on page load
- Enhanced logging for better debugging

### Version 1.0 (2025-11-15)

- Initial release
- Basic inactivity tracking and auto-close functionality
- Configurable inactive days (1-365)
- Statistics and test mode

## Notes

- The extension never closes system pages (chrome://, chrome-extension://, edge://, about:, etc.)
- Tab activity data is stored locally only
- When a tab closes manually, its saved data is removed automatically
- **Inactivity is tracked by URL, so timers persist across browser restarts** (v1.1+)
