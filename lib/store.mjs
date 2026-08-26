import { homedir } from "node:os";
import { join } from "node:path";

const NAMESPACE_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/;

export function normalizeNamespace(raw) {
  const ns = String(raw ?? "").trim();
  if (!NAMESPACE_RE.test(ns)) {
    throw new Error(`Invalid bearer namespace: ${JSON.stringify(raw)}`);
  }
  return ns;
}

export function resolveStateDir() {
  return process.env.OPENCLAW_STATE_DIR || join(homedir(), ".openclaw");
}

export function bearerSecretsDir(stateDir = resolveStateDir()) {
  return join(stateDir, "secrets", "bearer");
}

export function sessionFilePath(stateDir, namespace) {
  return join(bearerSecretsDir(stateDir), `${normalizeNamespace(namespace)}.json`);
}

export function createBearerStore(options = {}) {
  const stateDir = options.stateDir || resolveStateDir();

  async function readSession(namespace) {
    const fs = await import("node:fs/promises");
    const path = sessionFilePath(stateDir, namespace);
    try {
      const raw = await fs.readFile(path, "utf8");
      return JSON.parse(raw);
    } catch (err) {
      if (err && typeof err === "object" && err.code === "ENOENT") return null;
      throw err;
    }
  }

  async function writeSession(namespace, session) {
    const fs = await import("node:fs/promises");
    const dir = bearerSecretsDir(stateDir);
    await fs.mkdir(dir, { recursive: true, mode: 0o700 });
    const path = sessionFilePath(stateDir, namespace);
    const payload = {
      namespace: normalizeNamespace(namespace),
      token: session.token,
      baseUrl: session.baseUrl ?? null,
      expiresAt: session.expiresAt ?? null,
      metadata: session.metadata ?? {},
      updatedAt: session.updatedAt ?? Date.now(),
    };
    await fs.writeFile(path, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
    return payload;
  }

  async function deleteSession(namespace) {
    const fs = await import("node:fs/promises");
    const path = sessionFilePath(stateDir, namespace);
    try {
      await fs.unlink(path);
      return true;
    } catch (err) {
      if (err && typeof err === "object" && err.code === "ENOENT") return false;
      throw err;
    }
  }

  async function listSessions() {
    const fs = await import("node:fs/promises");
    const dir = bearerSecretsDir(stateDir);
    let names = [];
    try {
      names = await fs.readdir(dir);
    } catch (err) {
      if (err && typeof err === "object" && err.code === "ENOENT") return [];
      throw err;
    }
    const out = [];
    for (const name of names) {
      if (!name.endsWith(".json")) continue;
      const ns = name.slice(0, -5);
      const session = await readSession(ns);
      if (!session?.token) continue;
      out.push({
        namespace: session.namespace || ns,
        tokenLen: session.token.length,
        baseUrl: session.baseUrl ?? null,
        expiresAt: session.expiresAt ?? null,
        metadata: session.metadata ?? {},
        updatedAt: session.updatedAt ?? null,
      });
    }
    out.sort((a, b) => a.namespace.localeCompare(b.namespace));
    return out;
  }

  return {
    stateDir,
    readSession,
    writeSession,
    deleteSession,
    listSessions,
  };
}
