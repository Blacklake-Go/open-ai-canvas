import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { OFFICIAL_APPLICATION_PLUGIN_IDS, SUPDANCE_APPLICATION_PLUGIN_IDS, isOfficialApplicationPluginId } from "../src/lib/plugins/official-applications";
import { getRegisteredPlugin } from "../src/lib/plugins/plugin-registry";
import "../src/lib/plugins/builtin";

describe("official application plugin classification", () => {
    test("classifies the remaining built-in application plugins", () => {
        // SupDance: editor-shell is explicitly preserved with timeline capabilities.
        expect(isOfficialApplicationPluginId("editor-shell")).toBe(false);
        expect(getRegisteredPlugin("editor-shell")).toBeDefined();
        for (const id of OFFICIAL_APPLICATION_PLUGIN_IDS) expect(getRegisteredPlugin(id)?.manifest.apiVersion).toBe("yingce.plugin/v1");
        expect(isOfficialApplicationPluginId("ai-art-critique")).toBe(true);
        expect(isOfficialApplicationPluginId("prompt-optimizer")).toBe(true);
        expect(isOfficialApplicationPluginId("eagle-asset-connector")).toBe(true);
        expect(isOfficialApplicationPluginId("runninghub-workflow-provider")).toBe(true);
    });

    test("does not treat uploaded or unknown plugins as official applications", () => {
        expect(isOfficialApplicationPluginId("some-uploaded-plugin")).toBe(false);
        expect(isOfficialApplicationPluginId("")).toBe(false);
        expect(isOfficialApplicationPluginId("portrait-clearance")).toBe(false);
        expect(isOfficialApplicationPluginId("media-conversion")).toBe(false);
        expect(isOfficialApplicationPluginId("comfyui-workflow-provider")).toBe(false);
    });

    test("exposes de-duplicated id lists covering html page manager and user feedback", () => {
        const ids = [...OFFICIAL_APPLICATION_PLUGIN_IDS, ...SUPDANCE_APPLICATION_PLUGIN_IDS];
        expect(new Set(ids).size).toBe(ids.length);
        expect(OFFICIAL_APPLICATION_PLUGIN_IDS).toHaveLength(5);
        expect(SUPDANCE_APPLICATION_PLUGIN_IDS).toHaveLength(3);
        expect(ids).toContain("supdance-html-page-manager");
        expect(ids).toHaveLength(8);
        expect(ids).toContain("user-feedback");
        expect(isOfficialApplicationPluginId("supdance-html-page-manager")).toBe(true);
        expect(isOfficialApplicationPluginId("supdance-i18n")).toBe(true);
        expect(isOfficialApplicationPluginId("supdance-social-auth")).toBe(true);
    });

    test("both plugin pages consume the shared list instead of a local copy", () => {
        const adminPage = readFileSync(resolve(import.meta.dir, "../src/pages/admin/plugins/plugins-page.tsx"), "utf8");
        const userPage = readFileSync(resolve(import.meta.dir, "../src/pages/plugins/index.tsx"), "utf8");

        expect(adminPage).toContain("isOfficialApplicationPluginId");
        expect(userPage).toContain("isOfficialApplicationPluginId");

        // No page may reintroduce a hand-maintained id array.
        expect(adminPage).not.toContain("const officialApplicationIds = new Set([");
        expect(userPage).not.toContain("function isOfficialApplicationPlugin(pluginId: string) {");
    });
});
