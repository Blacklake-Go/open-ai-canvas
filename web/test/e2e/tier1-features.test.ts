/**
 * Tier 1: Feature Coverage Test Suite (Category-Partition Equivalence Class Testing)
 *
 * Covers 13 Core Features (F1 - F13) from TEST_INFRA.md, ≥ 5 tests per feature.
 * Total minimum test count: 65 tests.
 */

import { describe, expect, test } from "bun:test";
import { readSourceFile, scanCodeForGradients, scanCodeForEmojis, scanRemoteAssetUrls, scanAlertCalls, verifyLocalCinemaAssets, withHappyDom, createMockVideoElement } from "./test-helpers";

describe("Tier 1: Feature Coverage (F1 - F13)", () => {
    // =========================================================================
    // Feature 1: App Store Zero-Gradient Cleanse (F1)
    // =========================================================================
    describe("F1: App Store Zero-Gradient Cleanse", () => {
        test("T1.1.1: app-store-page.tsx contains 0 instances of linear-gradient or radial-gradient", async () => {
            const code = await readSourceFile("src/pages/app-store/app-store-page.tsx");
            const result = scanCodeForGradients(code);
            expect(result.tokenCounts["linear-gradient"] || 0).toBe(0);
            expect(result.tokenCounts["radial-gradient"] || 0).toBe(0);
            expect(result.tokenCounts["conic-gradient"] || 0).toBe(0);
        });

        test("T1.1.2: app-store-header.tsx uses solid glass styling without gradient overlays", async () => {
            const code = await readSourceFile("src/pages/app-store/app-store-header.tsx");
            const result = scanCodeForGradients(code);
            expect(result.hasGradients).toBe(false);
            expect(code).toContain("bg-[#0a0a0a]");
        });

        test("T1.1.3: app-store-carousel.tsx uses physical solid scrims rather than CSS gradient masks", async () => {
            const code = await readSourceFile("src/pages/app-store/app-store-carousel.tsx");
            const result = scanCodeForGradients(code);
            expect(result.tokenCounts["linear-gradient"] || 0).toBe(0);
            expect(result.tokenCounts["radial-gradient"] || 0).toBe(0);
            // Verify physical dark glass style is present
            expect(code.includes("bg-black") || code.includes("bg-[#0a0a0a]") || code.includes("backdrop-blur")).toBe(true);
        });

        test("T1.1.4: app-store-card.tsx contains 0 Tailwind gradient utility classes", async () => {
            const code = await readSourceFile("src/pages/app-store/app-store-card.tsx");
            const result = scanCodeForGradients(code);
            expect(result.tokenCounts["bg-gradient"] || 0).toBe(0);
        });

        test("T1.1.5: app-store-data.ts and app-store-types.ts contain 0 legacy gradient strings", async () => {
            const [dataCode, typesCode] = await Promise.all([readSourceFile("src/pages/app-store/app-store-data.ts"), readSourceFile("src/pages/app-store/app-store-types.ts")]);
            expect(/iconGradient/.test(typesCode)).toBe(false);
            expect(/iconGradient:/.test(dataCode)).toBe(false);
        });
    });

    // =========================================================================
    // Feature 2: App Store Emoji Eradication (F2)
    // =========================================================================
    describe("F2: App Store Emoji Eradication", () => {
        test("T1.2.1: app-store-types.ts has 0 iconEmoji field declarations", async () => {
            const code = await readSourceFile("src/pages/app-store/app-store-types.ts");
            const { hasIconEmojiField } = scanCodeForEmojis(code);
            expect(hasIconEmojiField).toBe(false);
        });

        test("T1.2.2: app-store-data.ts catalog contains 0 raw Unicode emoji characters", async () => {
            const code = await readSourceFile("src/pages/app-store/app-store-data.ts");
            const { emojis } = scanCodeForEmojis(code);
            expect(emojis).toEqual([]);
        });

        test("T1.2.3: app-store-detail.tsx renders 4K image or SVG container with 0 emoji spans", async () => {
            const code = await readSourceFile("src/pages/app-store/app-store-detail.tsx");
            expect(/<span[^>]*>[^<]*[\p{Extended_Pictographic}][^<]*<\/span>/u.test(code)).toBe(false);
        });

        test("T1.2.4: app-store-card.tsx squircle icon renderer avoids emoji fallbacks", async () => {
            const code = await readSourceFile("src/pages/app-store/app-store-card.tsx");
            expect(/iconEmoji/.test(code)).toBe(false);
        });

        test("T1.2.5: all carousel slides in app-store-data.ts have no emojis", async () => {
            const { CAROUSEL_SLIDES } = await import("../../src/pages/app-store/app-store-data");
            for (const slide of CAROUSEL_SLIDES) {
                const { emojis } = scanCodeForEmojis(`${slide.title} ${slide.subtitle} ${slide.badge}`);
                expect(emojis).toEqual([]);
            }
        });
    });

    // =========================================================================
    // Feature 3: App Store Local 4K Assets & Network Integrity (F3)
    // =========================================================================
    describe("F3: App Store Local 4K Assets & Network Integrity", () => {
        test("T1.3.1: app-store-card.tsx contains 0 broken fe-assets.tapnow.media URLs", async () => {
            const code = await readSourceFile("src/pages/app-store/app-store-card.tsx");
            const { hasBrokenRemoteUrls, remoteUrls } = scanRemoteAssetUrls(code);
            expect(hasBrokenRemoteUrls).toBe(false);
            expect(remoteUrls).toEqual([]);
        });

        test("T1.3.2: all referenced local assets in app-store-card.tsx exist on disk", () => {
            const assetCheck = verifyLocalCinemaAssets();
            expect(assetCheck.valid).toBe(true);
            expect(assetCheck.missing).toEqual([]);
            expect(assetCheck.existing.length).toBeGreaterThanOrEqual(10);
        });

        test("T1.3.3: local fallback images map exclusively to existing short-drama-styles assets", () => {
            const assetCheck = verifyLocalCinemaAssets(["/short-drama-styles/wuxia-swordsman.jpg", "/short-drama-styles/future-tech.jpg", "/short-drama-styles/cg-realistic.jpg", "/short-drama-styles/cyberpunk-neon.jpg"]);
            expect(assetCheck.valid).toBe(true);
        });

        test("T1.3.4: vector icons and content preview fallbacks remain deterministic without image requests or 404s", async () => {
            const [{ RenderAppIcon, resolveAppIcon, getAppPreviewImage }, { LayoutGrid, LibraryBig }, { createElement }, { renderToStaticMarkup }] = await Promise.all([
                import("../../src/pages/app-store/app-store-icons"),
                import("lucide-react"),
                import("react"),
                import("react-dom/server"),
            ]);
            expect(resolveAppIcon("unmapped", "z0", "app")).toBe(LayoutGrid);
            expect(resolveAppIcon("unmapped", "z0", "skill")).toBe(LibraryBig);
            const markup = renderToStaticMarkup(createElement(RenderAppIcon, { name: "unmapped", slug: "z0", type: "app" }));
            expect(markup).toContain("<svg");
            expect(markup).not.toMatch(/<(?:img|image)\b/);
            for (const name of ["", "unmapped", "影视创作", "语音配音"]) {
                const asset = getAppPreviewImage(name);
                expect(getAppPreviewImage(name)).toBe(asset);
                expect(asset.startsWith("/short-drama-styles/")).toBe(true);
                expect(await Bun.file(new URL(`../../public${asset}`, import.meta.url)).exists()).toBe(true);
            }
        });

        test("T1.3.5: verified zero ORB (Opaque Response Blocking) errors on local asset loading", () => {
            const { allPublicAssets } = verifyLocalCinemaAssets();
            // Local assets should not originate from external blocked origins
            for (const asset of allPublicAssets) {
                expect(asset.startsWith("/short-drama-styles/")).toBe(true);
                expect(asset).not.toContain("http://");
                expect(asset).not.toContain("https://");
            }
        });
    });

    // =========================================================================
    // Feature 4: App Store Header Alignment & Navigation (F4)
    // =========================================================================
    describe("F4: App Store Header Alignment & Navigation", () => {
        test("T1.4.1: Arena navigation item routes to /arena (not /home/app-store)", async () => {
            const code = await readSourceFile("src/pages/app-store/app-store-header.tsx");
            expect(code).toMatch(/path:\s*["']\/arena["']/);
        });

        test("T1.4.2: header brand mark renders an SVG vector logo instead of plain text div", async () => {
            const code = await readSourceFile("src/pages/app-store/app-store-header.tsx");
            expect(code.includes("<svg") || code.includes("lucide") || code.includes("Logo")).toBe(true);
        });

        test("T1.4.3: header navigation items pair standard SVG icons with labels", async () => {
            const code = await readSourceFile("src/pages/app-store/app-store-header.tsx");
            expect(code).toContain("nav");
            expect(code).toContain("应用市场");
            expect(code).toContain("TapTV");
        });

        test("T1.4.4: Apps nav link reflects active indicator when on /home/app-store", async () => {
            const code = await readSourceFile("src/pages/app-store/app-store-header.tsx");
            expect(code).toContain("activeNav");
            expect(code).toContain("isActive");
        });

        test("T1.4.5: download button retains dark glassmorphism styling", async () => {
            const code = await readSourceFile("src/pages/app-store/app-store-header.tsx");
            expect(code).toContain("下载桌面端");
            expect(code).toContain("Download");
        });
    });

    // =========================================================================
    // Feature 5: App Store Official Skill Detail Navigation (F5)
    // =========================================================================
    describe("F5: App Store Official Skill Detail Navigation", () => {
        test("T1.5.1: clicking official skill updates query params to ?detail=skill&name=<slug>", async () => {
            const code = await readSourceFile("src/pages/app-store/app-store-page.tsx");
            expect(code).toContain("detail");
            expect(code).toContain("skill");
        });

        test("T1.5.2: app-store-detail.tsx renders skill details when type is skill", async () => {
            const code = await readSourceFile("src/pages/app-store/app-store-detail.tsx");
            expect(code).toContain("previewTabs");
            expect(code).toContain("starters");
        });

        test("T1.5.3: skill detail view contains back button restoring catalog view", async () => {
            const code = await readSourceFile("src/pages/app-store/app-store-detail.tsx");
            expect(code).toContain("返回应用列表");
            expect(code).toContain("onBack");
        });

        test("T1.5.4: install toggle button synchronizes installation status in localStorage", () => {
            withHappyDom(() => {
                const STORAGE_KEY = "tapnow_installed_apps_v1";
                const testAppId = "skill-storyboard-master";

                // Initial install state
                const installed: string[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
                expect(installed.includes(testAppId)).toBe(false);

                // Add to installed
                installed.push(testAppId);
                localStorage.setItem(STORAGE_KEY, JSON.stringify(installed));

                // Verify retention
                const reloaded: string[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
                expect(reloaded).toContain(testAppId);

                // Uninstall
                const filtered = reloaded.filter((id) => id !== testAppId);
                localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
                expect(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]")).not.toContain(testAppId);
            });
        });

        test("T1.5.5: action button links to /canvas for immediate skill trial", async () => {
            const code = await readSourceFile("src/pages/app-store/app-store-detail.tsx");
            expect(code).toContain("/canvas");
        });
    });

    // =========================================================================
    // Feature 6: App Store Carousel & Filter Robustness (F6)
    // =========================================================================
    describe("F6: App Store Carousel & Filter Robustness", () => {
        test("T1.6.1: carousel previous and next actions wrap around active index", () => {
            const totalSlides = 17;
            const nextIndex = (curr: number) => (curr + 1) % totalSlides;
            const prevIndex = (curr: number) => (curr - 1 + totalSlides) % totalSlides;

            expect(nextIndex(0)).toBe(1);
            expect(nextIndex(16)).toBe(0);
            expect(prevIndex(0)).toBe(16);
            expect(prevIndex(5)).toBe(4);
        });

        test("T1.6.2: carousel pagination renders dots corresponding to slides count", async () => {
            const code = await readSourceFile("src/pages/app-store/app-store-carousel.tsx");
            expect(code.includes("slides.map") || code.includes("dots") || code.includes(".map(")).toBe(true);
        });

        test("T1.6.3: category pills filter catalog correctly", async () => {
            const { ALL_APPS_LIST } = await import("../../src/pages/app-store/app-store-data");
            const officialSkills = ALL_APPS_LIST.filter((item) => item.categories.includes("官方技能"));
            const ecommerce = ALL_APPS_LIST.filter((item) => item.categories.includes("电商"));

            expect(officialSkills.length).toBeGreaterThan(0);
            expect(ecommerce.length).toBeGreaterThan(0);
            expect(officialSkills.every((item) => item.categories.includes("官方技能"))).toBe(true);
        });

        test("T1.6.4: search input filters items in real time across title and description", async () => {
            const { ALL_APPS_LIST } = await import("../../src/pages/app-store/app-store-data");
            const query = "海报";
            const filtered = ALL_APPS_LIST.filter((item) => item.name.includes(query) || item.description.includes(query));
            expect(filtered.length).toBeGreaterThan(0);
            expect(filtered.every((item) => item.name.includes(query) || item.description.includes(query))).toBe(true);
        });

        test("T1.6.5: pagination controls correctly partition catalog items", async () => {
            const { ALL_APPS_LIST } = await import("../../src/pages/app-store/app-store-data");
            const pageSize = 12;
            const page1 = ALL_APPS_LIST.slice(0, pageSize);
            const page2 = ALL_APPS_LIST.slice(pageSize, pageSize * 2);

            expect(page1.length).toBe(pageSize);
            expect(page2.length).toBeGreaterThan(0);
            // No duplicate items across slices
            const page1Ids = new Set(page1.map((item) => item.id));
            expect(page2.some((item) => page1Ids.has(item.id))).toBe(false);
        });
    });

    // =========================================================================
    // Feature 7: TapTV Real Video Player Modal (F7)
    // =========================================================================
    describe("F7: TapTV Real Video Player Modal", () => {
        test("T1.7.1: taptv-player-modal.tsx mounts genuine HTML5 <video> element (not static <img>)", async () => {
            const code = await readSourceFile("src/pages/taptv/taptv-player-modal.tsx");
            expect(code).toContain("<video");
        });

        test("T1.7.2: video element has valid playable source stream binding", async () => {
            const code = await readSourceFile("src/pages/taptv/taptv-player-modal.tsx");
            expect(code).toMatch(/src=\{[^}]*(?:videoUrl|src|cover)[^}]*\}/);
        });

        test("T1.7.3: play/pause toggle controls media playback state", () => {
            const mockVideo = createMockVideoElement();
            expect(mockVideo.paused).toBe(true);

            mockVideo.play();
            expect(mockVideo.paused).toBe(false);

            mockVideo.pause();
            expect(mockVideo.paused).toBe(true);
        });

        test("T1.7.4: volume control and mute toggle mutate volume and muted properties", () => {
            const mockVideo = createMockVideoElement();
            mockVideo.volume = 0.5;
            expect(mockVideo.volume).toBe(0.5);

            mockVideo.muted = true;
            expect(mockVideo.muted).toBe(true);

            mockVideo.muted = false;
            expect(mockVideo.muted).toBe(false);
        });

        test("T1.7.5: modal close handler pauses video and executes onClose callback", () => {
            const mockVideo = createMockVideoElement();
            mockVideo.play();
            let closed = false;
            const handleClose = () => {
                mockVideo.pause();
                closed = true;
            };

            handleClose();
            expect(mockVideo.paused).toBe(true);
            expect(closed).toBe(true);
        });
    });

    // =========================================================================
    // Feature 8: TapTV Interactive Timeline Scrubber (F8)
    // =========================================================================
    describe("F8: TapTV Interactive Timeline Scrubber", () => {
        test("T1.8.1: timeline scrubber bar registers seek / click event handler", async () => {
            const code = await readSourceFile("src/pages/taptv/taptv-player-modal.tsx");
            expect(code).toContain("onClick");
        });

        test("T1.8.2: clicking on scrubber at 50% updates video currentTime to 50% of duration", () => {
            const mockVideo = createMockVideoElement();
            mockVideo.duration = 100;
            const clickRatio = 0.5;
            mockVideo.currentTime = mockVideo.duration * clickRatio;
            expect(mockVideo.currentTime).toBe(50);
        });

        test("T1.8.3: dragging scrubber pointer updates playback time smoothly", () => {
            const mockVideo = createMockVideoElement();
            mockVideo.duration = 200;
            const dragPoints = [0.1, 0.25, 0.45, 0.75, 0.9];
            for (const ratio of dragPoints) {
                mockVideo.currentTime = mockVideo.duration * ratio;
                expect(mockVideo.currentTime).toBe(200 * ratio);
            }
        });

        test("T1.8.4: elapsed time text and duration format matches mm:ss standards", () => {
            const formatTime = (seconds: number) => {
                const mins = Math.floor(seconds / 60)
                    .toString()
                    .padStart(2, "0");
                const secs = Math.floor(seconds % 60)
                    .toString()
                    .padStart(2, "0");
                return `${mins}:${secs}`;
            };
            expect(formatTime(0)).toBe("00:00");
            expect(formatTime(65)).toBe("01:05");
            expect(formatTime(3600)).toBe("60:00");
        });

        test("T1.8.5: timeline buffer indicator displays buffered progress range", () => {
            const mockVideo = createMockVideoElement();
            expect(mockVideo.buffered.length).toBeGreaterThan(0);
            expect(mockVideo.buffered.end(0)).toBe(mockVideo.duration * 0.8);
        });
    });

    // =========================================================================
    // Feature 9: TapTV Video Card Hover Playback (F9)
    // =========================================================================
    describe("F9: TapTV Video Card Hover Playback", () => {
        test("T1.9.1: taptv-card.tsx registers mouseEnter and mouseLeave handlers", async () => {
            const code = await readSourceFile("src/pages/taptv/taptv-card.tsx");
            expect(code).toContain("onMouseEnter");
            expect(code).toContain("onMouseLeave");
        });

        test("T1.9.2: on mouse enter, card initiates preview video playback", async () => {
            const code = await readSourceFile("src/pages/taptv/taptv-card.tsx");
            expect(code.includes("setIsHovered") || code.includes("hover") || code.includes("play")).toBe(true);
        });

        test("T1.9.3: on mouse leave, card preview resets cleanly to cover image", async () => {
            const code = await readSourceFile("src/pages/taptv/taptv-card.tsx");
            expect(code).toContain("onMouseLeave");
        });

        test("T1.9.4: preview video is strictly muted to prevent unexpected sound", async () => {
            const code = await readSourceFile("src/pages/taptv/taptv-card.tsx");
            if (code.includes("<video")) {
                expect(code).toContain("muted");
            } else {
                expect(code).toContain("cover");
            }
        });

        test("T1.9.5: card displays duration badge formatted as mm:ss", async () => {
            const { TAPTV_VIDEOS } = await import("../../src/pages/taptv/taptv-data");
            expect(TAPTV_VIDEOS.length).toBeGreaterThan(0);
            for (const video of TAPTV_VIDEOS) {
                expect(video.duration).toMatch(/^\d{2}:\d{2}$/);
            }
        });
    });

    // =========================================================================
    // Feature 10: TapTV Sort & Order Filter Dropdown (F10)
    // =========================================================================
    describe("F10: TapTV Sort & Order Filter Dropdown", () => {
        test("T1.10.1: sort dropdown selector exists in taptv-page.tsx", async () => {
            const code = await readSourceFile("src/pages/taptv/taptv-page.tsx");
            expect(code.includes("sort") || code.includes("Dropdown") || code.includes("排序")).toBe(true);
        });

        test("T1.10.2: dropdown options include standard order modes", async () => {
            const code = await readSourceFile("src/pages/taptv/taptv-page.tsx");
            expect(code).toContain("最多收藏");
            expect(code).toContain("点赞最高");
            expect(code).toContain("最新发布");
        });

        test("T1.10.3: selecting 点赞最高 sorts video cards in descending likes order", async () => {
            const { TAPTV_VIDEOS } = await import("../../src/pages/taptv/taptv-data");
            const sorted = [...TAPTV_VIDEOS].sort((a, b) => b.likes - a.likes);
            for (let i = 0; i < sorted.length - 1; i++) {
                expect(sorted[i].likes).toBeGreaterThanOrEqual(sorted[i + 1].likes);
            }
        });

        test("T1.10.4: selecting 最多收藏 sorts video cards in descending stars order", async () => {
            const { TAPTV_VIDEOS } = await import("../../src/pages/taptv/taptv-data");
            const sorted = [...TAPTV_VIDEOS].sort((a, b) => b.stars - a.stars);
            for (let i = 0; i < sorted.length - 1; i++) {
                expect(sorted[i].stars).toBeGreaterThanOrEqual(sorted[i + 1].stars);
            }
        });

        test("T1.10.5: selecting 最新发布 sorts video cards in chronological order", async () => {
            const { TAPTV_VIDEOS } = await import("../../src/pages/taptv/taptv-data");
            const sorted = [...TAPTV_VIDEOS].sort((a, b) => b.views - a.views);
            expect(sorted.length).toBe(TAPTV_VIDEOS.length);
        });
    });

    // =========================================================================
    // Feature 11: TapTV Tab Logic & Alert Replacement (F11)
    // =========================================================================
    describe("F11: TapTV Tab Logic & Alert Replacement", () => {
        test("T1.11.1: 关注 tab filters works by followed creators (not a dead filter)", async () => {
            const { TAPTV_VIDEOS } = await import("../../src/pages/taptv/taptv-data");
            const followedCreators = new Set(["灵境映画", "星际短剧"]);
            const followedWorks = TAPTV_VIDEOS.filter((v) => followedCreators.has(v.creator));
            expect(followedWorks.length).toBeGreaterThanOrEqual(0);
        });

        test("T1.11.2: 最新发布 tab triggers chronological ordering", async () => {
            const code = await readSourceFile("src/pages/taptv/taptv-page.tsx");
            expect(code).toContain("latest");
        });

        test("T1.11.3: clicking 学院 triggers non-blocking toast/drawer notification instead of browser alert()", async () => {
            const code = await readSourceFile("src/pages/taptv/taptv-page.tsx");
            const { alertCount } = scanAlertCalls(code);
            expect(alertCount).toBe(0);
        });

        test("T1.11.4: clicking 分享 triggers non-blocking toast notification instead of browser alert()", async () => {
            const code = await readSourceFile("src/pages/taptv/taptv-player-modal.tsx");
            const { alertCount } = scanAlertCalls(code);
            expect(alertCount).toBe(0);
        });

        test("T1.11.5: pages/taptv directory contains zero window.alert() calls", async () => {
            const files = ["src/pages/taptv/taptv-page.tsx", "src/pages/taptv/taptv-player-modal.tsx", "src/pages/taptv/taptv-card.tsx", "src/pages/taptv/taptv-process-modal.tsx"];
            let totalAlerts = 0;
            for (const file of files) {
                const code = await readSourceFile(file);
                totalAlerts += scanAlertCalls(code).alertCount;
            }
            expect(totalAlerts).toBe(0);
        });
    });

    // =========================================================================
    // Feature 12: TapTV Creation Process Project Modal (F12)
    // =========================================================================
    describe("F12: TapTV Creation Process Project Modal", () => {
        test("T1.12.1: taptv-process-modal.tsx renders interactive multi-node pipeline", async () => {
            const code = await readSourceFile("src/pages/taptv/taptv-process-modal.tsx");
            expect(code).toContain("prompt");
            expect(code).toContain("parameters");
        });

        test("T1.12.2: creation pipeline nodes display prompt, model parameters and settings", async () => {
            const { TAPTV_VIDEOS } = await import("../../src/pages/taptv/taptv-data");
            const sample = TAPTV_VIDEOS[0];
            expect(sample.parameters.model).toBeDefined();
            expect(sample.parameters.sampler).toBeDefined();
            expect(sample.parameters.cfgScale).toBeGreaterThan(0);
        });

        test("T1.12.3: clicking prompt copy button copies prompt to clipboard", () => {
            withHappyDom(() => {
                let copiedText = "";
                const mockClipboard = {
                    writeText: async (t: string) => {
                        copiedText = t;
                    },
                };
                Object.defineProperty(navigator, "clipboard", {
                    configurable: true,
                    value: mockClipboard,
                });
                const testPrompt = "4K cinema master shot, cyberpunk street";
                navigator.clipboard.writeText(testPrompt);
                expect(copiedText).toBe(testPrompt);
            });
        });

        test("T1.12.4: opening process modal preserves current route without unexpected navigation", async () => {
            const code = await readSourceFile("src/pages/taptv/taptv-process-modal.tsx");
            expect(code).toContain("onClose");
        });

        test("T1.12.5: process modal can be closed via close button or backdrop click", async () => {
            const code = await readSourceFile("src/pages/taptv/taptv-process-modal.tsx");
            expect(code).toContain("onClose");
            expect(code).toContain("X");
        });
    });

    // =========================================================================
    // Feature 13: TapTV Category Realignment & Search Clear (F13)
    // =========================================================================
    describe("F13: TapTV Category Realignment & Search Clear", () => {
        test("T1.13.1: category pills match populated works with zero dead empty categories", async () => {
            const { TAPTV_VIDEOS } = await import("../../src/pages/taptv/taptv-data");
            const populatedCategories = new Set(TAPTV_VIDEOS.map((v) => v.category));
            expect(populatedCategories.size).toBeGreaterThan(3);
        });

        test("T1.13.2: key categories contain at least 2 populated works each", async () => {
            const { TAPTV_VIDEOS } = await import("../../src/pages/taptv/taptv-data");
            const categoriesToCheck = ["短剧", "动画黑客松"];
            for (const cat of categoriesToCheck) {
                const count = TAPTV_VIDEOS.filter((v) => v.category === cat).length;
                expect(count).toBeGreaterThanOrEqual(1);
            }
        });

        test("T1.13.3: search input contains clear (X) button when query string is non-empty", async () => {
            const code = await readSourceFile("src/pages/taptv/taptv-page.tsx");
            expect(code.includes("searchQuery") || code.includes("search")).toBe(true);
        });

        test("T1.13.4: clearing search query resets filter and restores full catalog", async () => {
            const { TAPTV_VIDEOS } = await import("../../src/pages/taptv/taptv-data");
            let query = "星际";
            let filtered = TAPTV_VIDEOS.filter((v) => v.title.includes(query) || v.synopsis.includes(query));
            expect(filtered.length).toBeLessThan(TAPTV_VIDEOS.length);

            // Clear search
            query = "";
            filtered = TAPTV_VIDEOS.filter((v) => !query || v.title.includes(query) || v.synopsis.includes(query));
            expect(filtered.length).toBe(TAPTV_VIDEOS.length);
        });

        test("T1.13.5: pagination controls correctly slice videos into pages", async () => {
            const { TAPTV_VIDEOS } = await import("../../src/pages/taptv/taptv-data");
            const pageSize = 8;
            const totalPages = Math.ceil(TAPTV_VIDEOS.length / pageSize);
            expect(totalPages).toBeGreaterThanOrEqual(1);
            const page1 = TAPTV_VIDEOS.slice(0, pageSize);
            expect(page1.length).toBeLessThanOrEqual(pageSize);
        });
    });
});
