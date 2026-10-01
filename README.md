# IdentyClaw Bearer HTTP Gateway Component

**OpenClaw plugin — opaque bearer session storage + authenticated HTTPS for agents without an IdentyClaw passport**

Part of IdentyClaw. Prefer a Passport when you can: [![Get a Passport](https://img.shields.io/badge/Get%20a%20Passport-purchase.identyclaw.com-FF4500)](https://purchase.identyclaw.com) — buy once, no subscription. This plugin is the guest path when you do not have one yet.

> **IdentyClaw component service:** OpenClaw plugin for **guest / federated HTTPS** when the agent has no NEAR Passport. Stores JWTs outside model-visible tool output and attaches them on later `http_request` calls.

Plugin id: `bearer-http`  
Package: `@identyclaw/openclaw-identyclaw-httpbearer-plugin`

## Why

OpenClaw redacts JWTs in model-visible tool output. Guests that `curl` `join-by-url` and copy `jwt_token` from exec output save a masked token (`eyJhbG…`) and orphan the seat.

This plugin keeps the JWT in `secrets/bearer/<namespace>.json` and never returns it to the model.

## Role in the IdentyClaw stack

| Layer | Artifact | Responsibility |
| --- | --- | --- |
| Identity & HOLA | [openclaw-identyclaw-plugin](https://github.com/discernible-io/openclaw-identyclaw-plugin) | API login, DID, HOLA, operator tools (Passport agents) |
| **Guest bearer HTTP (this repo)** | **bearer-http** | Opaque JWT storage + allowlisted HTTPS for guests |
| Agent runtime | [OpenClaw](https://openclaw.ai) gateway | Chat, hooks, sandbox, tool execution |

Install this plugin when an agent must call guest APIs (e.g. Last Cradle join) **without** a Passport — not for IdentyClaw API login or RODiT-signed webhooks.

## Installation

From ClawHub:

```bash
openclaw plugins install clawhub:@identyclaw/openclaw-identyclaw-httpbearer-plugin
openclaw gateway restart
```

From git:

```bash
openclaw plugins install https://github.com/discernible-io/openclaw-identyclaw-httpbearer-plugin.git
```

During development you can also install from a local checkout:

```bash
openclaw plugins install /absolute/path/to/openclaw-identyclaw-httpbearer-plugin --force
openclaw gateway restart
```

### Fleet (identyclaw-agents)

```bash
# env.local
BEARER_HTTP_CLAWHUB_PLUGIN=clawhub:@identyclaw/openclaw-identyclaw-httpbearer-plugin@0.1.0

./identyclaw.sh install-bearer-http agent-b
./identyclaw.sh restart agent-b
```

Or pin a local path for development:

```bash
BEARER_HTTP_PLUGIN_PATH=/home/you/openclaw-identyclaw-httpbearer-plugin
```

## Tools

| Tool | Purpose |
| --- | --- |
| `http_request` | HTTPS with `storeAuth` on login and `auth: "bearer:<ns>"` later |
| `bearer_list_sessions` | List namespaces + `tokenLen` (never the token) |
| `bearer_clear_session` | Delete a stored namespace |

## Guest join (Last Cradle)

```text
1. http_request POST …/join-by-url
     storeAuth: { namespace: "lastcradle", fromResponse: { path: "jwt_token" } }
2. Confirm auth.stored && auth.tokenLen >= 400
3. http_request GET …/state
     auth: "bearer:lastcradle"
4. Continue only when body.you is non-null
```

Do **not** curl login or paste JWTs from tool output.

## Config (`plugins.entries.bearer-http.config`)

```json
{
  "plugins": {
    "entries": {
      "bearer-http": {
        "enabled": true,
        "config": {
          "allowedHostnames": ["api.lastcradle.io"],
          "defaultNamespace": "lastcradle",
          "maxResponseBytes": 1048576,
          "timeoutMs": 30000
        }
      }
    }
  }
}
```

| Key | Default | Meaning |
| --- | --- | --- |
| `allowedHostnames` | `["api.lastcradle.io"]` | HTTPS host allowlist |
| `defaultNamespace` | `lastcradle` | When `storeAuth.namespace` omitted |
| `maxResponseBytes` | `1048576` | Response body cap |
| `timeoutMs` | `30000` | Request timeout |

## Requirements

* OpenClaw gateway **≥ 2026.7.1**
* Node **≥ 22.19.0**

## Publish to ClawHub

See [PUBLISH.md](./PUBLISH.md):

```bash
npm run prepare:publish
npm run publish:clawhub:dry-run
npm run publish:clawhub
```

Pin the published version in fleet `BEARER_HTTP_CLAWHUB_PLUGIN`.

## Development

```bash
npm test
```

Install from a local checkout, then restart the gateway.

## License

Apache-2.0 — Copyright (c) Discernible IO. See [LICENSE](./LICENSE).

## Cross-links

* **This repo:** [discernible-io/openclaw-identyclaw-httpbearer-plugin](https://github.com/discernible-io/openclaw-identyclaw-httpbearer-plugin)
* **IdentyClaw tools (Passport):** [openclaw-identyclaw-plugin](https://github.com/discernible-io/openclaw-identyclaw-plugin)
* **Webhooks:** [openclaw-identyclaw-webhooks-plugin](https://github.com/discernible-io/openclaw-identyclaw-webhooks-plugin)
* **Deploy template:** [identyclaw-agents](https://github.com/discernible-io/identyclaw-agents)

<!-- discernible-io:product-links -->
## Links

Maintained by [Discernible](https://www.discernible.io/).

- **Product:** [discernible.io](https://www.discernible.io/)
- **Get a Passport:** [purchase.identyclaw.com](https://purchase.identyclaw.com) (buy once — no subscription)
- **Verify HOLA:** [verify.identyclaw.com](https://verify.identyclaw.com)
<!-- /discernible-io:product-links -->
