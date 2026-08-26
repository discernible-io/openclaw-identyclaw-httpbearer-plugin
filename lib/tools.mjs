import { URL } from "node:url";
import { jsonResult } from "openclaw/plugin-sdk/tool-results";
import { decodeJwtExpMs, isLikelyJwt, parseBearerAuth } from "./jwt.mjs";
import { normalizeNamespace } from "./store.mjs";
import {
  extractMetadata,
  getPath,
  markStoredToken,
  redactSecrets,
  safeJsonParse,
  truncateText,
} from "./redact.mjs";

const HTTP_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"]);

const HTTP_REQUEST_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    method: {
      type: "string",
      description: "HTTP method (default GET).",
    },
    url: {
      type: "string",
      description: "Absolute https URL to request.",
    },
    headers: {
      type: "object",
      additionalProperties: { type: "string" },
      description: "Extra headers (Authorization is injected via auth).",
    },
    body: {
      description: "JSON-serializable request body for POST/PUT/PATCH.",
    },
    auth: {
      type: "string",
      description: 'Attach stored bearer: "bearer:<namespace>"',
    },
    storeAuth: {
      type: "object",
      additionalProperties: false,
      properties: {
        namespace: { type: "string" },
        fromResponse: {
          type: "object",
          additionalProperties: false,
          properties: {
            path: {
              type: "string",
              description: "Dot path in JSON response body (default jwt_token).",
            },
          },
        },
      },
      required: ["namespace"],
    },
    timeoutMs: {
      type: "number",
      description: "Override default timeout.",
    },
  },
  required: ["url"],
};

function resolvePluginConfig(raw = {}) {
  const allowedHostnames = Array.isArray(raw.allowedHostnames)
    ? raw.allowedHostnames.map((h) => String(h).trim().toLowerCase()).filter(Boolean)
    : ["api.lastcradle.io"];
  return {
    allowedHostnames,
    defaultNamespace: String(raw.defaultNamespace ?? "lastcradle").trim() || "lastcradle",
    maxResponseBytes: Number.isFinite(raw.maxResponseBytes) ? raw.maxResponseBytes : 1_048_576,
    timeoutMs: Number.isFinite(raw.timeoutMs) ? raw.timeoutMs : 30_000,
  };
}

function assertAllowedHostname(urlString, allowedHostnames) {
  let parsed;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new Error(`Invalid URL: ${urlString}`);
  }
  if (parsed.protocol !== "https:") {
    throw new Error("Only https URLs are allowed");
  }
  const host = parsed.hostname.toLowerCase();
  if (!allowedHostnames.includes(host)) {
    throw new Error(`Hostname not allowed: ${host} (allowed: ${allowedHostnames.join(", ")})`);
  }
  return parsed;
}

function buildRequestInit(params, headers, cfg) {
  const method = String(params.method ?? "GET").toUpperCase();
  if (!HTTP_METHODS.has(method)) {
    throw new Error(`Unsupported method: ${method}`);
  }
  const init = {
    method,
    headers: { ...headers },
    redirect: "follow",
  };
  if (params.body !== undefined && method !== "GET" && method !== "HEAD") {
    init.headers["Content-Type"] = init.headers["Content-Type"] || "application/json";
    init.body = JSON.stringify(params.body);
  }
  const timeoutMs = Number.isFinite(params.timeoutMs) ? params.timeoutMs : cfg.timeoutMs;
  init.signal = AbortSignal.timeout(timeoutMs);
  return init;
}

async function applyNewToken(store, namespace, response) {
  const header =
    response.headers.get("New-Token") ||
    response.headers.get("new-token") ||
    response.headers.get("X-New-Token");
  if (!header || !isLikelyJwt(header)) return null;
  const existing = (await store.readSession(namespace)) || { namespace };
  await store.writeSession(namespace, {
    ...existing,
    token: header,
    expiresAt: decodeJwtExpMs(header) ?? existing.expiresAt ?? null,
    updatedAt: Date.now(),
  });
  return header.length;
}

export function registerHttpRequestTool(api, store, pluginConfigRaw) {
  const cfg = resolvePluginConfig(pluginConfigRaw);

  api.registerTool({
    name: "http_request",
    label: "HTTP Request (bearer)",
    description:
      "HTTPS request with opaque bearer storage. Use storeAuth on login/join responses; use auth bearer:<namespace> on later calls. JWT never returned to the model.",
    parameters: HTTP_REQUEST_SCHEMA,
    async execute(_toolCallId, params) {
      const parsedUrl = assertAllowedHostname(params.url, cfg.allowedHostnames);
      const headers = { ...(params.headers ?? {}) };

      let authNamespace = null;
      let refreshNamespace = null;
      if (params.auth) {
        authNamespace = normalizeNamespace(parseBearerAuth(params.auth));
        refreshNamespace = authNamespace;
        const session = await store.readSession(authNamespace);
        if (!session?.token) {
          return jsonResult({
            ok: false,
            error: `No bearer session: ${authNamespace}`,
          });
        }
        headers.Authorization = `Bearer ${session.token}`;
      }

      const response = await fetch(params.url, buildRequestInit(params, headers, cfg));
      const rawTextBuf = Buffer.from(await response.arrayBuffer());
      const limited =
        rawTextBuf.length > cfg.maxResponseBytes
          ? rawTextBuf.subarray(0, cfg.maxResponseBytes)
          : rawTextBuf;
      const rawText = limited.toString("utf8");
      const truncated = rawTextBuf.length > cfg.maxResponseBytes;
      const jsonBody = safeJsonParse(rawText);

      const authSummary = {};
      if (params.storeAuth) {
        const namespace = normalizeNamespace(
          params.storeAuth.namespace || cfg.defaultNamespace,
        );
        const tokenPath = params.storeAuth.fromResponse?.path || "jwt_token";
        const token = jsonBody ? getPath(jsonBody, tokenPath) : undefined;
        if (!isLikelyJwt(token)) {
          return jsonResult({
            ok: false,
            status: response.status,
            error: `storeAuth failed: no valid JWT at ${tokenPath} (len=${typeof token === "string" ? token.length : 0})`,
            hint: "Tool output masks JWTs — use http_request storeAuth, never copy from exec/curl output.",
          });
        }
        await store.writeSession(namespace, {
          token,
          baseUrl: parsedUrl.origin,
          expiresAt: decodeJwtExpMs(token),
          metadata: jsonBody ? extractMetadata(jsonBody, { agentId: "agent.id", gameId: "gameId" }) : {},
          updatedAt: Date.now(),
        });
        authSummary.stored = true;
        authSummary.namespace = namespace;
        authSummary.tokenLen = token.length;
        refreshNamespace = namespace;
      }

      if (refreshNamespace) {
        const refreshedLen = await applyNewToken(store, refreshNamespace, response);
        if (refreshedLen) {
          authSummary.refreshed = true;
          authSummary.tokenLen = refreshedLen;
        }
      }

      const storedMarkers = new Map();
      if (authSummary.namespace && jsonBody) {
        const tokenPath = params.storeAuth?.fromResponse?.path || "jwt_token";
        const token = getPath(jsonBody, tokenPath);
        if (typeof token === "string") {
          storedMarkers.set(token, markStoredToken(token, authSummary.namespace));
        }
      }

      let bodyOut;
      if (jsonBody !== null) {
        bodyOut = redactSecrets(jsonBody, storedMarkers);
      } else {
        const trimmed = truncateText(rawText, cfg.maxResponseBytes);
        bodyOut = trimmed.text;
      }

      return jsonResult({
        ok: response.ok,
        status: response.status,
        auth: Object.keys(authSummary).length ? authSummary : undefined,
        truncated,
        body: bodyOut,
      });
    },
  });
}

export function registerBearerSessionTools(api, store) {
  api.registerTool({
    name: "bearer_list_sessions",
    label: "Bearer sessions",
    description: "List stored bearer namespaces (no token values).",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {},
    },
    async execute() {
      const sessions = await store.listSessions();
      return jsonResult({ sessions });
    },
  });

  api.registerTool({
    name: "bearer_clear_session",
    label: "Clear bearer session",
    description: "Delete a stored bearer namespace.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        namespace: { type: "string" },
      },
      required: ["namespace"],
    },
    async execute(_toolCallId, params) {
      const namespace = normalizeNamespace(params.namespace);
      const removed = await store.deleteSession(namespace);
      return jsonResult({ namespace, removed });
    },
  });
}
