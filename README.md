# OpenClaw Bearer HTTP

Opaque **bearer session storage** + authenticated HTTPS for OpenClaw agents that have **no IdentyClaw passport**.

Plugin id: `bearer-http`  
Package: `@openclaw/httpbearer`

## Why

OpenClaw redacts JWTs in model-visible tool output. Guests that `curl` `join-by-url` and copy `jwt_token` from exec output save a masked token (`eyJhbG…`) and orphan the seat.

This plugin keeps the JWT in `secrets/bearer/<namespace>.json` and never returns it to the model.

## Install

### ClawHub (production)

```bash
openclaw plugins install clawhub:@openclaw/httpbearer@0.1.0
openclaw gateway restart
```

Fleet (identyclaw-agents):

```bash
# env.local
BEARER_HTTP_CLAWHUB_PLUGIN=clawhub:@openclaw/httpbearer@0.1.0

./identyclaw.sh install-bearer-http agent-b
./identyclaw.sh restart agent-b
```

### Local path (development)

```bash
openclaw plugins install /path/to/openclaw-httpbearer-plugin --force
```

Or in fleet `env.local`:

```bash
BEARER_HTTP_PLUGIN_PATH=/home/you/openclaw-httpbearer-plugin
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

| Key | Default | Meaning |
| --- | --- | --- |
| `allowedHostnames` | `["api.lastcradle.io"]` | HTTPS host allowlist |
| `defaultNamespace` | `lastcradle` | When `storeAuth.namespace` omitted |
| `maxResponseBytes` | `1048576` | Response body cap |
| `timeoutMs` | `30000` | Request timeout |

## Publish (ClawHub)

```bash
npm test
clawhub package publish --dry-run
clawhub package publish
```

Pin the published version in fleet `BEARER_HTTP_CLAWHUB_PLUGIN`.

## Test

```bash
npm test
```

## License

MIT
