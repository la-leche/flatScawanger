let windowId = null;

chrome.action.onClicked.addListener(async () => {
  if (windowId != null) {
    try {
      await chrome.windows.get(windowId);
      await chrome.windows.update(windowId, { focused: true });
      return;
    } catch {
      windowId = null;
    }
  }

  const created = await chrome.windows.create({
    url: chrome.runtime.getURL("main.html"),
    type: "popup",
    width: 440,
    height: 680,
    focused: true,
  });
  windowId = created.id ?? null;
});

chrome.windows.onRemoved.addListener((id) => {
  if (id === windowId) windowId = null;
});
