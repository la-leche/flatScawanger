export const CSV_HEADERS = [
  "source",
  "id",
  "title",
  "price",
  "size",
  "rooms",
  "location",
  "url",
  "text",
  "scraped_at",
];

function cell(value) {
  const text = value == null ? "" : String(value);
  if (/[;"\n\r]/.test(text)) return '"' + text.replace(/"/g, '""') + '"';
  return text;
}

// Semicolon: German Excel splits on ; by default.
export function toCsv(rows) {
  const lines = [CSV_HEADERS.join(";")];
  for (const row of rows) {
    lines.push(CSV_HEADERS.map((key) => cell(row[key])).join(";"));
  }
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}

export function downloadCsv(filename, csv) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
