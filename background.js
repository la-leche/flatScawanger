// background.js
browser.browserAction.onClicked.addListener(async (tab) => {
  try {
    await browser.tabs.sendMessage(tab.id, { type: "SCAN_OBID" });
  } catch (e) {
    console.error("Content script not ready:", e);
    // optional: inject if page loaded before extension reload
    await browser.tabs.executeScript(tab.id, { file: "content.js" });
    await browser.tabs.sendMessage(tab.id, { type: "SCAN_OBID" });
  }
});