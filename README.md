# Flat to PDF

Firefox extension that finds DOM entries (e.g. `div.flat`) on the current page and exports them to PDF.

## Install (temporary)

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on…**
3. Select `manifest.json`

## Usage

1. Open a page with matching elements
2. Click the toolbar icon
3. PDF is generated / save dialog opens

## Dev

- Content script: DOM scrape (`content.js`)
- Background: PDF build / `tabs.saveAsPDF` (`background.js`)
