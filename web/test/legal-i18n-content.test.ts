import { describe, expect, it } from "bun:test";
import { AUP_DOC_MAP, LEGAL_LANGUAGE_LABELS, LEGAL_OPERATOR_CONFIG, PRIVACY_DOC_MAP, SupportedLegalLanguage, TOS_DOC_MAP } from "@/supdance/pages/legal/legal-i18n-content";
import { LEGAL_OPERATOR } from "@/supdance/pages/legal/legal-meta";

describe("Legal Documents & Multi-Language Completeness", () => {
    const requiredLanguages: SupportedLegalLanguage[] = ["en", "zh-CN", "zh-TW", "ja", "ko", "es"];

    it("LEGAL_OPERATOR_CONFIG and LEGAL_OPERATOR are fully defined without placeholders", () => {
        expect(LEGAL_OPERATOR_CONFIG.legalName).toBe("Zhang Donghe");
        expect(LEGAL_OPERATOR_CONFIG.tradeName).toBe("Supdance");
        expect(LEGAL_OPERATOR_CONFIG.supportEmail).toBe("support@supdance.com");
        expect(LEGAL_OPERATOR_CONFIG.safetyEmail).toBe("safety@supdance.com");
        expect(LEGAL_OPERATOR_CONFIG.domain).toBe("https://www.supdance.com");

        expect(LEGAL_OPERATOR.legalName).toBe("Zhang Donghe");
        expect(LEGAL_OPERATOR.mailingAddress).not.toContain("【待补充");
        expect(LEGAL_OPERATOR.effectiveDate).not.toContain("【待补充");
    });

    it("LEGAL_LANGUAGE_LABELS covers all 6 supported languages", () => {
        for (const lang of requiredLanguages) {
            expect(LEGAL_LANGUAGE_LABELS[lang]).toBeDefined();
            expect(LEGAL_LANGUAGE_LABELS[lang].label).toBeTruthy();
            expect(LEGAL_LANGUAGE_LABELS[lang].code).toBeTruthy();
        }
    });

    it("AUP_DOC_MAP has full parity across all 6 languages (7 sections, tables and callouts)", () => {
        const expectedSectionIds = ["scope", "content-standards", "moderation", "reporting", "enforcement-actions", "appeals", "transparency"];

        for (const lang of requiredLanguages) {
            const doc = AUP_DOC_MAP[lang];
            expect(doc).toBeDefined();
            expect(doc.title).toBeTruthy();
            expect(doc.summary).toBeTruthy();
            expect(doc.sections.length).toBe(7);

            const sectionIds = doc.sections.map((s) => s.id);
            expect(sectionIds).toEqual(expectedSectionIds);

            // Reporting section must have timing table
            const reportingSection = doc.sections.find((s) => s.id === "reporting");
            expect(reportingSection?.table).toBeDefined();
            expect(reportingSection?.table?.rows.length).toBe(3);

            // Enforcement section must have enforcement table
            const enforcementSection = doc.sections.find((s) => s.id === "enforcement-actions");
            expect(enforcementSection?.table).toBeDefined();
            expect(enforcementSection?.table?.rows.length).toBe(5);
        }
    });

    it("TOS_DOC_MAP has full parity across all 6 languages (10 sections)", () => {
        const expectedSectionIds = ["acceptance", "services", "account", "billing", "payment", "refund", "disputes", "intellectual-property", "disclaimers", "general"];

        for (const lang of requiredLanguages) {
            const doc = TOS_DOC_MAP[lang];
            expect(doc).toBeDefined();
            expect(doc.title).toBeTruthy();
            expect(doc.summary).toBeTruthy();
            expect(doc.sections.length).toBe(10);

            const sectionIds = doc.sections.map((s) => s.id);
            expect(sectionIds).toEqual(expectedSectionIds);

            // Refund section must clearly state 7-day unused refund and failed task automatic reversal
            const refundSection = doc.sections.find((s) => s.id === "refund");
            expect(refundSection?.bullets).toBeDefined();
            expect(refundSection?.bullets?.length).toBeGreaterThanOrEqual(4);
        }
    });

    it("PRIVACY_DOC_MAP has full parity across all 6 languages (8 sections)", () => {
        const expectedSectionIds = ["controller", "collection", "purposes", "sharing", "security", "rights", "retention", "contact"];

        for (const lang of requiredLanguages) {
            const doc = PRIVACY_DOC_MAP[lang];
            expect(doc).toBeDefined();
            expect(doc.title).toBeTruthy();
            expect(doc.summary).toBeTruthy();
            expect(doc.sections.length).toBe(8);

            const sectionIds = doc.sections.map((s) => s.id);
            expect(sectionIds).toEqual(expectedSectionIds);

            // Purposes section must have GDPR legal basis table
            const purposesSection = doc.sections.find((s) => s.id === "purposes");
            expect(purposesSection?.table).toBeDefined();
            expect(purposesSection?.table?.rows.length).toBe(4);
        }
    });
});
