// content.js
function extractFlats(selector = "div.flat") {
  const nodes = document.querySelectorAll(selector);
  return Array.from(nodes).map((el, i) => ({
    index: i + 1,
    text: el.innerText.trim(),
    html: el.innerHTML,
    // useful extras:
    classes: el.className,
    id: el.id || null,
  }));
}

browser.runtime.onMessage.addListener((msg) => {
  if (msg.type === "EXTRACT") {
    const items = extractFlats(msg.selector || "div.flat");
    return Promise.resolve({
      url: location.href,
      title: document.title,
      count: items.length,
      items,
    });
  }
});
