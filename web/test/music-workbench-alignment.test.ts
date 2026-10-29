import { describe, expect, it } from "bun:test";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

describe("Music Workbench UI Alignment & Architecture Suite", () => {
    const cssPath = resolve(process.cwd(), "src/supdance/plugins/music-generation/styles/music-workbench.css");
    const pagePath = resolve(process.cwd(), "src/supdance/plugins/music-generation/pages/music-workbench-page.tsx");
    const stagePath = resolve(process.cwd(), "src/supdance/plugins/music-generation/components/music-master-stage.tsx");

    it("verifies music-workbench.css adheres to 3-column architecture and token rules", () => {
        expect(existsSync(cssPath)).toBe(true);
        const css = readFileSync(cssPath, "utf-8");

        // 3-Column Grid check
        expect(css).toContain("music-workbench-columns");
        expect(css).toContain("grid-template-columns");
        expect(css).toContain("music-input-column");
        expect(css).toContain("music-master-column");
        expect(css).toContain("music-task-column");

        // Token First compliance (RULE 002)
        expect(css).toContain("--wb-page");
        expect(css).toContain("--wb-surface");
        expect(css).toContain("--wb-edge");
        expect(css).toContain("--wb-text");

        // 128-Bar Spectrum Visualizer styles
        expect(css).toContain("music-visualizer-container");
        expect(css).toContain("music-spectrum-bar");
    });

    it("verifies MusicWorkbenchPage enforces Zero Duplicate Header rule and wraps WorkspacePage", () => {
        expect(existsSync(pagePath)).toBe(true);
        const pageContent = readFileSync(pagePath, "utf-8");

        // Uses WorkspacePage shell with fluid and scroll={false}
        expect(pageContent).toContain("<WorkspacePage");
        expect(pageContent).toContain("fluid");
        expect(pageContent).toContain("scroll={false}");

        // Topbar action mounted via useWorkspaceTopBarMount
        expect(pageContent).toContain("useWorkspaceTopBarMount");
        expect(pageContent).toContain("createPortal");

        // ZERO internal secondary header
        expect(pageContent).not.toContain("<header className=\"border-b");
    });

    it("verifies MusicMasterStage provides Web Audio visualizer and action bar", () => {
        expect(existsSync(stagePath)).toBe(true);
        const stageContent = readFileSync(stagePath, "utf-8");

        // Visualizer and Web Audio peaks calculation
        expect(stageContent).toContain("barsCount = 128");
        expect(stageContent).toContain("spectrumBars");
        expect(stageContent).toContain("music-visualizer-container");

        // Business closure actions
        expect(stageContent).toContain("handleSendToCanvas");
        expect(stageContent).toContain("handleDownload");
        expect(stageContent).toContain("handleReuse");
    });
});
