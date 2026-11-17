import { describe, expect, it } from "bun:test";
import { ALL_APPS_LIST, CAROUSEL_SLIDES, DRAMA_WORKSHOP_DETAIL_SPEC } from "../src/pages/app-store/app-store-data";
import { TAPTV_VIDEOS, TAPTV_CATEGORIES } from "../src/pages/taptv/taptv-data";
import fs from "node:fs";
import path from "node:path";

describe("TapNow App Store & TapTV Replication Suite", () => {
    const appStoreDir = path.resolve(__dirname, "../src/pages/app-store");
    const taptvDir = path.resolve(__dirname, "../src/pages/taptv");

    it("verifies zero gradients in all tsx and ts files", () => {
        const files = [...fs.readdirSync(appStoreDir).map((f) => path.join(appStoreDir, f)), ...fs.readdirSync(taptvDir).map((f) => path.join(taptvDir, f))].filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"));

        const forbiddenGradientPatterns = ["linear-gradient", "radial-gradient", "conic-gradient", "bg-gradient-to"];

        for (const filePath of files) {
            const content = fs.readFileSync(filePath, "utf-8");
            for (const pattern of forbiddenGradientPatterns) {
                expect(content.includes(pattern)).toBe(false);
            }
        }
    });

    it("verifies zero emojis in UI and data files", () => {
        const files = [...fs.readdirSync(appStoreDir).map((f) => path.join(appStoreDir, f)), ...fs.readdirSync(taptvDir).map((f) => path.join(taptvDir, f))].filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"));

        // Match typical emojis
        const emojiRegex = /[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

        for (const filePath of files) {
            const content = fs.readFileSync(filePath, "utf-8");
            expect(emojiRegex.test(content)).toBe(false);
        }
    });

    it("integrates 短剧工作坊 into App Store with full detail spec", () => {
        const dramaApp = ALL_APPS_LIST.find((a) => a.id === "drama-workshop" || a.name === "短剧工作坊");
        expect(dramaApp).toBeDefined();
        expect(dramaApp?.name).toBe("短剧工作坊");
        expect(DRAMA_WORKSHOP_DETAIL_SPEC.name).toBe("短剧工作坊");
        expect(DRAMA_WORKSHOP_DETAIL_SPEC.previewTabs.length).toBeGreaterThanOrEqual(4);
    });

    it("ensures TapTV contains 25+ cinematic videos with authentic metadata", () => {
        expect(TAPTV_VIDEOS.length).toBeGreaterThanOrEqual(25);
        expect(TAPTV_CATEGORIES.length).toBeGreaterThanOrEqual(10);

        for (const video of TAPTV_VIDEOS) {
            expect(video.id).toBeDefined();
            expect(video.title.length).toBeGreaterThan(0);
            expect(video.creator.length).toBeGreaterThan(0);
            expect(video.duration).toMatch(/^\d{2}:\d{2}$/);
            expect(video.cover.length).toBeGreaterThan(0);
            expect(video.prompt.length).toBeGreaterThan(0);
        }
    });

    it("validates featured carousel has 5+ slides", () => {
        expect(CAROUSEL_SLIDES.length).toBeGreaterThanOrEqual(5);
        for (const slide of CAROUSEL_SLIDES) {
            expect(slide.title.length).toBeGreaterThan(0);
            expect(slide.bgImage.length).toBeGreaterThan(0);
        }
    });

    it("guards against unlayered antd reset.css overriding button color, font-size, and paragraph margin", () => {
        const bridgeCssPath = path.join(appStoreDir, "tapnow-reset-bridge.css");
        expect(fs.existsSync(bridgeCssPath)).toBe(true);
        const bridgeCss = fs.readFileSync(bridgeCssPath, "utf-8");
        expect(bridgeCss).toContain("color: revert-layer;");
        expect(bridgeCss).toContain("font-size: revert-layer;");
        expect(bridgeCss).toContain("margin: revert-layer;");

        const appStorePage = fs.readFileSync(path.join(appStoreDir, "app-store-page.tsx"), "utf-8");
        const taptvPage = fs.readFileSync(path.join(taptvDir, "taptv-page.tsx"), "utf-8");
        expect(appStorePage).toContain("./tapnow-reset-bridge.css");
        expect(taptvPage).toContain("../app-store/tapnow-reset-bridge.css");
    });

    it("keeps every icon and accent on the neutral grayscale design system", () => {
        const files = [...fs.readdirSync(appStoreDir).map((f) => path.join(appStoreDir, f)), ...fs.readdirSync(taptvDir).map((f) => path.join(taptvDir, f))].filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"));

        // 主站侧栏是单色浅灰线性图标：禁止任何彩色强调 token 与彩色发光阴影。
        const forbiddenColorPatterns = [
            /\b(?:text|bg|border|ring|fill|accent|shadow|from|via|to)-(?:sky|amber|rose|emerald|violet|fuchsia|cyan|teal|indigo|orange|red|yellow|green|blue|pink|purple)[\w/[\]().-]*/,
            /#0091ff/,
            /rgb\(22,\s*118,\s*160\)/,
            /144,\s*196,\s*229/,
            /rgba\(14,\s*165,\s*233/,
            /rgba\(56,\s*189,\s*248/,
            /rgba\(245,\s*158,\s*11/,
            /rgba\(244,\s*63,\s*94/,
            /rgba\(16,\s*185,\s*129/,
        ];

        for (const filePath of files) {
            const content = fs.readFileSync(filePath, "utf-8");
            for (const pattern of forbiddenColorPatterns) {
                expect(pattern.test(content)).toBe(false);
            }
        }

        // 共享图标模块必须存在，并统一使用 2.2 描边宽度（与主站侧栏一致）。
        const iconModule = fs.readFileSync(path.join(appStoreDir, "app-store-icons.tsx"), "utf-8");
        expect(iconModule).toContain("strokeWidth={2.2}");
        expect(iconModule).toContain("export function resolveAppIcon");
        expect(iconModule).toContain("export const RenderAppIcon");

        // 图标位不再使用 <img> 渲染（内容媒体封面/剧照/头像不在此列）。
        const card = fs.readFileSync(path.join(appStoreDir, "app-store-card.tsx"), "utf-8");
        expect(card).toContain("<RenderAppIcon");
        expect(card.includes("<img")).toBe(false);
    });
});
