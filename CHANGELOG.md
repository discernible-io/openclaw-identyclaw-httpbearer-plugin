# Changelog

## 0.1.1 — 2026-10-01

- Re-pin against OpenClaw Gateway **2026.9.7**; require Node **≥ 24.16**.

## Unreleased

## 0.1.0 — 2026-08-26

- Initial release: opaque bearer session storage under `secrets/bearer/<namespace>.json`.
- Tools: `http_request` (storeAuth + `auth: "bearer:<ns>"`), `bearer_list_sessions`, `bearer_clear_session`.
- JWT values are never returned to the model; responses redact token fields.
