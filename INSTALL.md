# Chrome Extension Installation Guide

## Quick install

### Option 1: From the bundled ZIP (recommended)

1. **Download** `auto-close-tabs.zip`
2. **Extract** the archive anywhere (for example `C:\Extensions\auto-close-tabs\`)
3. **Open Chrome** and go to `chrome://extensions/`
4. **Enable Developer mode** (top-right switch)
5. **Click “Load unpacked”**
6. **Select the folder** that contains the extracted files
7. Done! The extension is installed and active.

### Option 2: From the source files

1. **Download** every file in this repository
2. **Create a folder** for the extension
3. **Copy in**:
   - `manifest.json`
   - `background.js`
   - `popup.html`
   - `popup.js`
   - the entire `icons/` folder
4. **Open Chrome** and go to `chrome://extensions/`
5. **Enable Developer mode**
6. **Click “Load unpacked”**
7. **Select the folder** with the files

## First run

1. Click the extension icon in the Chrome toolbar
2. Switch to the **Settings** tab
3. Choose how many inactive days to allow (default: 3 days)
4. Make sure the extension is enabled
5. Press **Save settings**

## Everyday use

- **Statistics**: View the number of active vs. inactive tabs
- **Force clean-up**: Press **Close inactive now** to close tabs immediately
- **Automatic clean-up**: The extension checks tabs every 24 hours

## Settings reference

- **Inactive days**: 1–365 days
- **Enable/disable**: Toggle within the popup
- **Automatic check**: Runs once per day

## Notes

- System pages (chrome://, edge://, etc.) always stay open
- All data lives in your local browser storage
- When you close a tab, its stored entry is removed automatically
- The extension keeps running silently in the background

## Removal

1. Open `chrome://extensions/`
2. Find **Simple Auto Close Inactive Tabs**
3. Click **Remove**
4. Confirm the prompt









