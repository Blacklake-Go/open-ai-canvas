import { PLUGIN_API_VERSION_V2 } from "@/lib/plugins/plugin-types";
import { registerSupDancePlugin } from "@/supdance/adapters/compatibility";
import { compactPickerLocales } from "@/i18n/messages/areas/compact-picker";
import { COMPACT_PICKER_ID } from "./settings";

registerSupDancePlugin({
    manifest: {
        apiVersion: PLUGIN_API_VERSION_V2,
        id: COMPACT_PICKER_ID,
        version: "1.0.0",
        name: compactPickerLocales["zh-CN"].title,
        description: compactPickerLocales["zh-CN"].summary,
        author: "SupDance",
        surfaces: ["settings", "hybrid"],
        permissions: [],
        trusted: true,
        runtime: { backend: "declarative", web: "declarative" },
        contributes: { commands: [{ id: COMPACT_PICKER_ID + ".settings", label: compactPickerLocales["zh-CN"].title }] },
    },
});
