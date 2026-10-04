// background.js
browser.browserAction.onClicked.addListener(async (tab) => {
  const data = await browser.tabs.sendMessage(tab.id, {
    type: "EXTRACT",
    selector: "div.flat", // change me
  });

  if (!data.count) {
    console.warn("No .flat entries found");
    return;
  }

  const doc = new jspdf.jsPDF({ unit: "pt", format: "a4" });
  const margin = 40;
  const pageW = doc.internal.pageSize.getWidth();
  const maxW = pageW - margin * 2;
  let y = margin;

  doc.setFontSize(14);
  doc.text(data.title || "Export", margin, y);
  y += 20;
  doc.setFontSize(10);
  doc.text(`${data.count} entries — ${data.url}`, margin, y);
  y += 24;

  for (const item of data.items) {
    const block = `#${item.index}
${item.text}`;
    const lines = doc.splitTextToSize(block, maxW);
    const h = lines.length * 12 + 16;

    if (y + h > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin;
    }
    doc.text(lines, margin, y);
    y += h;
  }

  // triggers download
  doc.save(`flats-${Date.now()}.pdf`);
});
