import { describe, expect, it } from "bun:test";
import { SUPPORTED_LOCALES } from "@/i18n/locales";
import { AUP_DOC_MAP, LEGAL_OPERATOR_CONFIG, PRIVACY_DOC_MAP, TOS_DOC_MAP } from "@/supdance/pages/legal/legal-i18n-content";
import { LEGAL_OPERATOR } from "@/supdance/pages/legal/legal-meta";
import { LEGAL_LOCALE_MAP, SERVICE_PRIVACY, SERVICE_TERMS } from "@/supdance/pages/legal/service-policies";
import { renderLegalHtml } from "@/supdance/pages/legal/legal-html";
import { BUILTIN_HTML_TEMPLATES } from "@/supdance/plugins/html-page-manager/templates";

describe("Public service policies", () => {
    it("keeps route exports on the same content source", () => {
        expect(TOS_DOC_MAP).toBe(SERVICE_TERMS);
        expect(PRIVACY_DOC_MAP).toBe(SERVICE_PRIVACY);
        expect(LEGAL_OPERATOR_CONFIG.legalName).toBe("Supdance");
        expect(LEGAL_OPERATOR.legalName).toBe("Supdance");
        expect(LEGAL_OPERATOR.mailingAddress).toBe("support@supdance.com");
    });

    for (const { code } of SUPPORTED_LOCALES) {
        it(`renders complete, distinct policies and standalone HTML for ${code}`, () => {
            const lang = LEGAL_LOCALE_MAP[code];
            for (const [kind, map] of [
                ["terms", SERVICE_TERMS],
                ["privacy", SERVICE_PRIVACY],
            ] as const) {
                const doc = map[lang];
                expect(doc.sections).toHaveLength(10);
                expect(new Set(doc.sections.map((section) => section.id)).size).toBe(10);
                expect(doc.sections.every((section) => section.paragraphs?.every((p) => p.length > 70))).toBe(true);
                if (lang !== "en") expect(doc.summary).not.toBe(map.en.summary);
                const html = renderLegalHtml(kind, code);
                expect(html).toContain(`<html lang="${code}">`);
                expect(html).toContain(doc.title);
                expect(html.match(/<section id=/g)).toHaveLength(10);
                expect(html).toContain("mailto:support@supdance.com");
                expect(html).not.toMatch(/zhang\s*donghe|PCI-DSS|72 hours|<script/i);
            }
            expect(SERVICE_TERMS[lang].sections.some((section) => section.id === "refund")).toBe(true);
            expect(SERVICE_PRIVACY[lang].sections.some((section) => section.id === "cookies")).toBe(true);
            expect(SERVICE_PRIVACY[lang].sections.some((section) => section.id === "international-transfers")).toBe(true);
        });
    }

    it("updates managed HTML templates instead of retaining stale personal data", () => {
        expect(BUILTIN_HTML_TEMPLATES.find((t) => t.id === "linear-dark")?.sampleHtml).toBe(renderLegalHtml("terms", "zh-CN"));
        expect(BUILTIN_HTML_TEMPLATES.find((t) => t.id === "vercel-doc")?.sampleHtml).toBe(renderLegalHtml("privacy", "zh-CN"));
        expect(JSON.stringify(BUILTIN_HTML_TEMPLATES)).not.toMatch(/zhang\s*donghe/i);
    });

    it("preserves existing acceptable-use content and reporting anchors", () => {
        for (const doc of Object.values(AUP_DOC_MAP)) {
            expect(doc.sections).toHaveLength(7);
            expect(doc.sections.map((section) => section.id)).toContain("reporting");
            expect(doc.sections.map((section) => section.id)).toContain("enforcement-actions");
        }
    });
});
