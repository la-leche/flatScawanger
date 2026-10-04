// content.js
function collectObids() {
  const nodes = document.querySelectorAll("div[data-obid]");
  return Array.from(nodes).map((el) => el.getAttribute("data-obid"));
}

browser.runtime.onMessage.addListener((msg) => {
  if (msg.type === "SCAN_OBID") {
    const values = collectObids();
    // alert runs in the page tab
    alert(
      values.length
        ? `Found ${values.length} data-obid:

${values.join("")}` : "No div[data-obid] found on this page."
    );
    return Promise.resolve({ count: values.length, values });
  }
});