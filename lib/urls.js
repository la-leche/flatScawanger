export function canonical(url) {
  const u = new URL(url);
  u.hash = "";
  if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/$/, "");
  return u.href;
}

export function isAllowedUrl(raw, hosts) {
  let parsed;
  try {
    parsed = new URL(String(raw || "").trim());
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  return hosts.some((host) => parsed.hostname === host || parsed.hostname.endsWith("." + host));
}

export function pageUrl(agentId, base, page) {
  const u = new URL(base);
  if (agentId === "immoscout") {
    if (page <= 1) u.searchParams.delete("pagenumber");
    else u.searchParams.set("pagenumber", String(page));
    return u.href;
  }
  let path = u.pathname.replace(/\/seite:\d+(?=\/|$)/, "").replace(/\/$/, "");
  if (page > 1) {
    const cat = path.match(/^(.*?)(\/c\d+l\d+[^/]*)$/);
    path = cat ? cat[1] + "/seite:" + page + cat[2] : path + "/seite:" + page;
  }
  u.pathname = path || "/";
  return u.href;
}

export function siblingHost(url) {
  const u = new URL(url);
  if (/(^|\.)immoscout24\.de$/.test(u.hostname) && !u.hostname.includes("immobilienscout24")) {
    u.hostname = "www.immobilienscout24.de";
    return u.href;
  }
  if (u.hostname.includes("immobilienscout24.de")) {
    u.hostname = "www.immoscout24.de";
    return u.href;
  }
  return "";
}
