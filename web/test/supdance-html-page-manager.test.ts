import { describe, expect, it } from "bun:test";
import { BUILTIN_HTML_TEMPLATES, SUPDANCE_HTML_PAGE_MANAGER_PLUGIN_ID, supdanceHtmlPageManagerManifest } from "@/supdance/plugins/html-page-manager";

describe("HTML Page Manager Plugin & Template Tests", () => {
    it("exports valid official application manifest", () => {
        expect(SUPDANCE_HTML_PAGE_MANAGER_PLUGIN_ID).toBe("supdance-html-page-manager");
        expect(supdanceHtmlPageManagerManifest.id).toBe("supdance-html-page-manager");
        expect(supdanceHtmlPageManagerManifest.name).toBe("supdance html页面管理");
        expect(supdanceHtmlPageManagerManifest.trusted).toBe(true);
        expect(supdanceHtmlPageManagerManifest.surfaces).toContain("fullscreen");
    });

    it("provides all 5 core legal and document templates", () => {
        expect(BUILTIN_HTML_TEMPLATES.length).toBe(5);
        const templateIds = BUILTIN_HTML_TEMPLATES.map((t) => t.id);
        expect(templateIds).toContain("linear-dark");
        expect(templateIds).toContain("linear-aup");
        expect(templateIds).toContain("vercel-doc");
        expect(templateIds).toContain("anthropic-hub");
        expect(templateIds).toContain("supabase-clean");
    });

    it("legal documents follow system color scheme and other templates retain theme switching", () => {
        for (const tpl of BUILTIN_HTML_TEMPLATES) {
            expect(tpl.sampleHtml).toContain("<!DOCTYPE html>");
            if (tpl.id === "linear-dark" || tpl.id === "vercel-doc") {
                expect(tpl.sampleHtml).toContain('name="color-scheme" content="light dark"');
                expect(tpl.sampleHtml).toContain("background: Canvas");
                expect(tpl.sampleHtml).not.toContain("<script");
                continue;
            }
            expect(tpl.sampleHtml).toContain('id="theme-toggle"');
            expect(tpl.sampleHtml).toContain("sun-icon");
            expect(tpl.sampleHtml).toContain("moon-icon");
            expect(tpl.sampleHtml).toContain('data-theme="dark"');
            expect(tpl.sampleHtml).toContain('data-theme="light"');
            expect(tpl.sampleHtml).toContain("startViewTransition");
            expect(tpl.sampleHtml).toContain("::view-transition-new(root)");
            expect(tpl.sampleHtml).toContain("transform: scale");
        }
    });

    it("templates have descriptive badges and valid categories", () => {
        for (const tpl of BUILTIN_HTML_TEMPLATES) {
            expect(tpl.badge).toBeTruthy();
            expect(tpl.description.length).toBeGreaterThan(15);
            expect(["minimalist", "documentation", "hub", "editorial"]).toContain(tpl.category);
        }
    });
});
