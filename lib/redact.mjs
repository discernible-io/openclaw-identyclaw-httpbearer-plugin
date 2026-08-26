const TOKEN_FIELD_NAMES = new Set([
  "jwt_token",
  "access_token",
  "token",
  "id_token",
  "refresh_token",
]);

export function getPath(obj, path) {
  if (!path || typeof path !== "string") return undefined;
  let cur = obj;
  for (const part of path.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = cur[part];
  }
  return cur;
}

export function redactSecrets(value, storedMarkers = new Map()) {
  if (typeof value === "string") {
    if (isMaskedOrJwt(value)) {
      return storedMarkers.get(value) ?? "[redacted]";
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactSecrets(item, storedMarkers));
  }
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, child] of Object.entries(value)) {
      if (TOKEN_FIELD_NAMES.has(key) && typeof child === "string") {
        out[key] = storedMarkers.get(child) ?? "[redacted]";
      } else {
        out[key] = redactSecrets(child, storedMarkers);
      }
    }
    return out;
  }
  return value;
}

function isMaskedOrJwt(text) {
  if (typeof text !== "string") return false;
  if (text.includes("…")) return true;
  const parts = text.split(".");
  return parts.length === 3 && text.length >= 100;
}

export function markStoredToken(token, namespace) {
  return `[stored:bearer:${namespace}]`;
}

export function extractMetadata(json, metadataPaths) {
  if (!metadataPaths || typeof metadataPaths !== "object") return {};
  const metadata = {};
  for (const [key, path] of Object.entries(metadataPaths)) {
    const value = getPath(json, path);
    if (value !== undefined) metadata[key] = value;
  }
  return metadata;
}

export function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function truncateText(text, maxBytes) {
  const buf = Buffer.from(text, "utf8");
  if (buf.length <= maxBytes) {
    return { text, truncated: false, bytes: buf.length };
  }
  let end = maxBytes;
  while (end > 0 && (buf[end] & 0xc0) === 0x80) end -= 1;
  return {
    text: buf.subarray(0, end).toString("utf8"),
    truncated: true,
    bytes: end,
  };
}
