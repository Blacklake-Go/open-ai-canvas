import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

import { DEFAULT_CLASSIC_SKIN } from "../src/lib/skin-themes";
import { createSupDanceSkinDefinition } from "../src/supdance/theme/supdance-skin";
import { SUPPORTED_LOCALE_CODES } from "../src/supdance/plugins/i18n/locales";

const projectRoot = resolve(import.meta.dir, "../..");
const docsDir = resolve(projectRoot, "docs/design-system");

describe("Design System Governance & Compliance Suite", () => {
    test("all 21 design system specification documents exist with substantive content", () => {
        const requiredDocs = [
            "README.md",
            "00-UI-AUDIT.md",
            "01-DESIGN-FOUNDATIONS.md",
            "02-DESIGN-TOKENS.md",
            "03-PUBLIC-UI.md",
            "04-ADMIN-UI.md",
            "05-STUDIO-UI.md",
            "06-CANVAS-UI.md",
            "07-COMPONENT-CONTRACTS.md",
            "08-OVERLAY-AND-ZINDEX.md",
            "09-MOTION-SYSTEM.md",
            "10-RESPONSIVE-SYSTEM.md",
            "11-THEME-APPEARANCE.md",
            "12-PLUGIN-UI-CONTRACT.md",
            "13-ACCESSIBILITY-I18N.md",
            "14-UI-TESTING.md",
            "15-UPSTREAM-COMPATIBILITY.md",
            "16-MIGRATION-PLAN.md",
            "EXCEPTIONS.md",
            "UI-CHECKLIST.md",
            "CHANGELOG.md",
        ];

        for (const filename of requiredDocs) {
            const filepath = join(docsDir, filename);
            expect(existsSync(filepath)).toBe(true);
            const stats = statSync(filepath);
            // Each document must have substantive content (>= 800 bytes), no empty files or shallow stubs
            expect(stats.size).toBeGreaterThan(800);
            const content = readFileSync(filepath, "utf8");
            expect(content.includes("#")).toBe(true);
            expect(content.length).toBeGreaterThan(300);
        }
    });

    test("root AGENTS.md registers all permanent AI rules (RULE 001 through RULE 016)", () => {
        const agentsMdPath = resolve(projectRoot, "AGENTS.md");
        expect(existsSync(agentsMdPath)).toBe(true);
        const agentsContent = readFileSync(agentsMdPath, "utf8");

        for (let i = 1; i <= 16; i++) {
            const ruleCode = `RULE ${String(i).padStart(3, "0")}`;
            expect(agentsContent.includes(ruleCode)).toBe(true);
        }
    });

    test("preset skins have complete 50-color tokens and component metric invariant", () => {
        const classic = DEFAULT_CLASSIC_SKIN;
        const supdance = createSupDanceSkinDefinition();

        expect(classic.id).toBe("classic");
        expect(supdance.id).toBe("supdance-studio");

        // Verify exactly 50 color tokens defined for light and dark modes
        const classicLightKeys = Object.keys(classic.tokens.light);
        const classicDarkKeys = Object.keys(classic.tokens.dark);
        const supdanceLightKeys = Object.keys(supdance.tokens.light);
        const supdanceDarkKeys = Object.keys(supdance.tokens.dark);

        expect(classicLightKeys.length).toBe(50);
        expect(classicDarkKeys.length).toBe(50);
        expect(supdanceLightKeys.length).toBe(50);
        expect(supdanceDarkKeys.length).toBe(50);

        // Verify key symmetry
        expect(new Set(classicLightKeys)).toEqual(new Set(supdanceLightKeys));
        expect(new Set(classicDarkKeys)).toEqual(new Set(supdanceDarkKeys));

        // Verify component metric parameters count (17 metrics) and positive values
        const classicCompKeys = Object.keys(classic.tokens.components);
        const supdanceCompKeys = Object.keys(supdance.tokens.components);
        expect(classicCompKeys.length).toBe(17);
        expect(supdanceCompKeys.length).toBe(17);

        expect(classic.tokens.components.buttonRadius).toBeGreaterThan(0);
        expect(supdance.tokens.components.buttonRadius).toBeGreaterThan(0);
        expect(classic.tokens.components.inputRadius).toBeGreaterThan(0);
        expect(supdance.tokens.components.inputRadius).toBeGreaterThan(0);
        expect(classic.tokens.components.controlHeight).toBeGreaterThan(0);
        expect(supdance.tokens.components.controlHeight).toBeGreaterThan(0);
    });

    test("strict z-index, radius, and component hygiene across Celadon UI shared layer", () => {
        const uiBaseDir = resolve(import.meta.dir, "../src/components/ui");

        function walk(dir: string): string[] {
            const results: string[] = [];
            for (const item of readdirSync(dir, { withFileTypes: true })) {
                const fullPath = join(dir, item.name);
                if (item.isDirectory()) {
                    results.push(...walk(fullPath));
                } else if (/\.(tsx|ts|css)$/.test(item.name)) {
                    results.push(fullPath);
                }
            }
            return results;
        }

        const files = walk(uiBaseDir);
        for (const file of files) {
            const content = readFileSync(file, "utf8");
            // No 99999 or large numeric z-index literals
            expect(content.includes("99999")).toBe(false);
            expect(content.includes("z-[9999]")).toBe(false);

            // No Tailwind arbitrary z > 2000
            expect(/z-\[([2-9][0-9]{3,}|[0-9]{5,})\]/.test(content)).toBe(false);
            // No CSS z-index > 2000
            expect(/z-index:\s*([2-9][0-9]{3,}|[0-9]{5,})/.test(content)).toBe(false);

            // No banned arbitrary non-token border radiuses
            expect(/rounded-\[(7px|9px|11px|13px|15px|17px)\]/.test(content)).toBe(false);

            // Celadon shared UI must not import deprecated antd Empty
            if (file.endsWith(".tsx") || file.endsWith(".ts")) {
                expect(/import\s*\{[^}]*\bEmpty\b[^}]*\}\s*from\s*["']antd["']/.test(content)).toBe(false);
            }
        }
    });

    test("six standard i18n locales are fully supported and declared", () => {
        expect(SUPPORTED_LOCALE_CODES).toEqual(["zh-CN", "en-US", "zh-TW", "ja-JP", "ko-KR", "es-ES"]);
    });

    test("7 core physical architecture source assets exist on disk", () => {
        const coreAssets = [
            resolve(projectRoot, "web/src/styles/globals.css"),
            resolve(projectRoot, "web/src/lib/skin-themes.ts"),
            resolve(projectRoot, "web/src/supdance/theme/supdance-skin.ts"),
            resolve(projectRoot, "web/src/pages/admin/theme/admin-tokens.css"),
            resolve(projectRoot, "web/src/components/ui"),
            resolve(projectRoot, "web/src/stores/use-appearance-store.ts"),
            resolve(projectRoot, ".github/workflows/quality.yml"),
            resolve(docsDir, "EXCEPTIONS.md"),
        ];

        for (const assetPath of coreAssets) {
            expect(existsSync(assetPath)).toBe(true);
        }
    });

    test("UI Exception Registry enforces mandatory schema and tracks baseline exceptions", () => {
        const exceptionsPath = resolve(docsDir, "EXCEPTIONS.md");
        expect(existsSync(exceptionsPath)).toBe(true);
        const content = readFileSync(exceptionsPath, "utf8");

        // Verify mandatory schema fields
        expect(content.includes("RULE 015")).toBe(true);
        expect(content.includes("偏离规则")).toBe(true);
        expect(content.includes("所属作用域")).toBe(true);
        expect(content.includes("涉及文件")).toBe(true);
        expect(content.includes("补偿与安全防护措施")).toBe(true);
        expect(content.includes("计划退场阶段")).toBe(true);

        // Verify baseline exceptions are registered
        expect(content.includes("EXC-20261027-001")).toBe(true);
        expect(content.includes("EXC-20261027-002")).toBe(true);
        expect(content.includes("EXC-20261027-003")).toBe(true);
        expect(content.includes("EXC-20261027-004")).toBe(true);
        expect(content.includes("EXC-20261027-005")).toBe(true);
    });

    test("official plugins social-auth and i18n strictly adhere to plugin UI contract and token hygiene", () => {
        const pluginsDir = resolve(projectRoot, "web/src/supdance/plugins");

        function walk(dir: string): string[] {
            const results: string[] = [];
            for (const item of readdirSync(dir, { withFileTypes: true })) {
                const fullPath = join(dir, item.name);
                if (item.isDirectory()) {
                    results.push(...walk(fullPath));
                } else if (/\.(tsx|ts|css)$/.test(item.name)) {
                    results.push(fullPath);
                }
            }
            return results;
        }

        const files = walk(pluginsDir);
        for (const file of files) {
            const content = readFileSync(file, "utf8");

            // RULE 002: No 99999 or large numeric z-index literals
            expect(content.includes("99999")).toBe(false);
            expect(content.includes("z-[9999]")).toBe(false);
            expect(/z-\[([2-9][0-9]{3,}|[0-9]{5,})\]/.test(content)).toBe(false);

            // RULE 002: No banned arbitrary non-token border radiuses
            expect(/rounded-\[(7px|9px|11px|13px|15px|17px)\]/.test(content)).toBe(false);

            // RULE 002: No arbitrary font-size declarations like text-[11px], text-[12px], text-[13px]
            expect(/text-\[[0-9]+px\]/.test(content)).toBe(false);

            // RULE 003: No deprecated antd Empty component
            if (file.endsWith(".tsx") || file.endsWith(".ts")) {
                expect(/import\s*\{[^}]*\bEmpty\b[^}]*\}\s*from\s*["']antd["']/.test(content)).toBe(false);
            }
        }

        // RULE 005 / RULE 012 / 12-PLUGIN-UI-CONTRACT.md: Scope Isolation & data-plugin-scope
        const componentContracts = [
            {
                file: resolve(pluginsDir, "social-auth/components/social-login-buttons.tsx"),
                scope: "social-auth",
            },
            {
                file: resolve(pluginsDir, "social-auth/admin/social-auth-settings-page.tsx"),
                scope: "social-auth",
            },
            {
                file: resolve(pluginsDir, "i18n/components/topbar-language-switcher.tsx"),
                scope: "i18n",
            },
            {
                file: resolve(pluginsDir, "i18n/admin/i18n-settings-page.tsx"),
                scope: "i18n",
            },
            {
                file: resolve(pluginsDir, "i18n/admin/i18n-entries-page.tsx"),
                scope: "i18n",
            },
        ];

        for (const { file, scope } of componentContracts) {
            expect(existsSync(file)).toBe(true);
            const content = readFileSync(file, "utf8");
            expect(content.includes(`data-plugin-scope="${scope}"`)).toBe(true);
        }

        // RULE 004 / 04-ADMIN-UI.md: Admin CSS definitions and responsive overviews
        const adminCssPath = resolve(projectRoot, "web/src/styles/admin-ui.css");
        const adminCss = readFileSync(adminCssPath, "utf8");
        expect(adminCss.includes(".admin-social-auth-settings")).toBe(true);
        expect(adminCss.includes(".admin-social-auth-overview")).toBe(true);
        expect(adminCss.includes(".admin-i18n-settings")).toBe(true);
        expect(adminCss.includes(".admin-i18n-overview")).toBe(true);
        expect(adminCss.includes(".admin-i18n-lang-table")).toBe(true);
    });
});
