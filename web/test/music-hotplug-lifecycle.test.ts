import { describe, expect, it } from "bun:test";
import { buildNav } from "@/components/layout/workspace-sidebar-nav";
import { defaultFeatureAvailability, type FeatureAvailability } from "@/stores/use-user-store";

describe("Music Hotplug Lifecycle & Defenses Suite", () => {
    const dummyFeatures: FeatureAvailability = {
        ...defaultFeatureAvailability,
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

    it("keeps ecommerce closed by default and translates its entry only when enabled", () => {
        const items = (features: FeatureAvailability) => buildNav(features, mockT, true).groups.flatMap((group) => group.items);
        expect(items(defaultFeatureAvailability).some((item) => item.to === "/ecommerce")).toBe(false);
        const enabled = items({ ...defaultFeatureAvailability, ecommerceEnabled: true });
        expect(enabled.find((item) => item.id === "ecommerce")?.title).toBe("nav.sidebar.ecommerce");
        expect(enabled.findIndex((item) => item.id === "ecommerce")).toBeLessThan(enabled.findIndex((item) => item.to === "/canvas"));
        expect(enabled.some((item) => item.to === "/toolbox/music")).toBe(true);
    });

    it("includes toolbox-music in sidebar navigation when musicPluginActive is true", () => {
        const { groups } = buildNav(dummyFeatures, mockT, true);
        const resourceGroup = groups.find((g) => g.heading === "nav.sidebar.headingTools");
        expect(resourceGroup).toBeDefined();

        const musicItem = resourceGroup?.items.find((item) => item.id === "toolbox-music");
        expect(musicItem).toBeDefined();
        expect(musicItem?.to).toBe("/toolbox/music");
    });

    it("strictly excludes toolbox-music from sidebar navigation when musicPluginActive is false", () => {
        const { groups } = buildNav(dummyFeatures, mockT, false);
        const resourceGroup = groups.find((g) => g.heading === "nav.sidebar.headingTools");
        expect(resourceGroup).toBeDefined();

        const musicItem = resourceGroup?.items.find((item) => item.id === "toolbox-music");
        expect(musicItem).toBeUndefined();
    });
});
