# ClawHub publish checklist

Maintainer guide for publishing **@identyclaw/openclaw-identyclaw-httpbearer-plugin** to ClawHub.

| Artifact | Command | ClawHub install |
| --- | --- | --- |
| Code plugin | `npm run publish:clawhub` | `openclaw plugins install clawhub:@identyclaw/openclaw-identyclaw-httpbearer-plugin` |

This is **ClawHub registry login** — unrelated to IdentyClaw API login or RODiT Passport auth.

## Pre-flight

From the repository root, Node **≥ 22.19** (`.nvmrc`):

```bash
npm install
npm run prepare:publish
```

`prepare:publish` runs unit tests and `scripts/verify-pack.mjs` to ensure the npm pack tarball includes required plugin files and that `openclaw.plugin.json` version matches `package.json`.

## ClawHub credentials

```bash
npx clawhub whoami   # must show access to publisher @identyclaw
```

### ClawHub CLI login

**Device flow (remote / headless):**

```bash
npx clawhub login --device
```

**API token:**

```bash
npx clawhub login --no-browser --token clh_<your-token>
```

See [ClawHub troubleshooting](https://docs.openclaw.ai/clawhub/troubleshooting#clawhub-login-opens-a-browser-but-never-completes).

## Dry run

```bash
npm run publish:clawhub:dry-run
```

Expected: family `code-plugin`, version from `package.json`, files `index.mjs`, `lib/*.mjs`, `openclaw.plugin.json`, `package.json`, `README.md`, `LICENSE`.

## Publish

```bash
npm run publish:clawhub
```

Install after registry review:

```bash
openclaw plugins install clawhub:@identyclaw/openclaw-identyclaw-httpbearer-plugin
```

## Post-publish

1. `npx clawhub package inspect @identyclaw/openclaw-identyclaw-httpbearer-plugin`
2. `git tag openclaw-identyclaw-httpbearer-plugin-v<version>`
3. Runtime test on a Gateway: enable `plugins.entries.bearer-http`, exercise `http_request` with `storeAuth`, then `auth: "bearer:<ns>"`
4. Pin the published version in fleet `BEARER_HTTP_CLAWHUB_PLUGIN`
5. Security scan may show **pending** until review completes

## License

[Apache-2.0](./LICENSE). `package.json` must declare `"license": "Apache-2.0"`.
