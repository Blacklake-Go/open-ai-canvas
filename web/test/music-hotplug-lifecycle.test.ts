import { describe, expect, it } from "bun:test";
import { buildNav } from "@/components/layout/workspace-sidebar-nav";
import type { FeatureAvailability } from "@/stores/use-user-store";

describe("Music Hotplug Lifecycle & Defenses Suite", () => {
    const dummyFeatures: FeatureAvailability = {
        shortDramaEnabled: true,
        canvasEnabled: true,
        imageWorkbenchEnabled: true,
        videoWorkbenchEnabled: true,
        creditsEnabled: true,
        taskCenterEnabled: true,
        pluginCenterEnabled: true,
        frontendModelsEnabled: true,
    };

    const mockT = (k: string) => k;

    it("includes toolbox-music in sidebar navigation when musicPluginActive is true", () => {
        const { groups } = buildNav(dummyFeatures, mockT, true);
        const resourceGroup = groups.find((g) => g.heading === "nav.resources_tools");
        expect(resourceGroup).toBeDefined();

        const musicItem = resourceGroup?.items.find((item) => item.id === "toolbox-music");
        expect(musicItem).toBeDefined();
        expect(musicItem?.to).toBe("/toolbox/music");
    });

    it("strictly excludes toolbox-music from sidebar navigation when musicPluginActive is false", () => {
        const { groups } = buildNav(dummyFeatures, mockT, false);
        const resourceGroup = groups.find((g) => g.heading === "nav.resources_tools");
        expect(resourceGroup).toBeDefined();

        const musicItem = resourceGroup?.items.find((item) => item.id === "toolbox-music");
        expect(musicItem).toBeUndefined();
    });
});
