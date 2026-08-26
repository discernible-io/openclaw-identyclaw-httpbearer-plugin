const JWT_SEGMENT = /^[A-Za-z0-9_-]+$/;

export function isLikelyJwt(token) {
  if (typeof token !== "string") return false;
  if (token.includes("…") || token.includes("...")) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  if (token.length < 100) return false;
  return parts.every((part) => part.length > 0 && JWT_SEGMENT.test(part));
}

export function decodeJwtExpMs(token) {
  try {
    const payloadB64 = token.split(".")[1];
    if (!payloadB64) return null;
    const json = Buffer.from(payloadB64, "base64url").toString("utf8");
    const payload = JSON.parse(json);
    if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) return null;
    return payload.exp * 1000;
  } catch {
    return null;
  }
}

export function parseBearerAuth(raw) {
  const value = String(raw ?? "").trim();
  if (!value.startsWith("bearer:")) {
    throw new Error('auth must be "bearer:<namespace>"');
  }
  const namespace = value.slice("bearer:".length).trim();
  if (!namespace) throw new Error("auth namespace is required after bearer:");
  return namespace;
}
