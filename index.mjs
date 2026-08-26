import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { createBearerStore } from "./lib/store.mjs";
import { registerBearerSessionTools, registerHttpRequestTool } from "./lib/tools.mjs";

export default definePluginEntry({
  id: "bearer-http",
  name: "IdentyClaw Bearer HTTP",
  description:
    "Opaque bearer session storage and authenticated HTTPS for guest APIs (no IdentyClaw passport).",
  register(api) {
    const store = createBearerStore();
    registerHttpRequestTool(api, store, api.pluginConfig ?? {});
    registerBearerSessionTools(api, store);
  },
});
