import { describe, expect, test } from "bun:test";

import { buildNav } from "../src/components/layout/workspace-sidebar-nav";
import { authDialogLanding } from "../src/lib/auth-entry";
import { isGuestWorkspacePath } from "../src/lib/guest-workspace";
import { useUserStore } from "../src/stores/use-user-store";

describe("guest workspace route access", () => {
    test("allows only the public creation workspace routes", () => {
        expect(isGuestWorkspacePath("/")).toBe(true);
        expect(isGuestWorkspacePath("/create")).toBe(true);
        expect(isGuestWorkspacePath("/assets")).toBe(false);
        expect(isGuestWorkspacePath("/admin")).toBe(false);
        expect(isGuestWorkspacePath("/create/anything")).toBe(false);
    });

    test("shows tools enabled by public flags while routing protected destinations through login", () => {
        const { features: previous, setFeatures } = useUserStore.getState();
        const toolPaths = ["/projects", "/ecommerce", "/toolbox/image", "/toolbox/video"];
        const toolLinks = () =>
            buildNav(useUserStore.getState().features, (key) => key, true, false)
                .groups.flatMap(({ items }) => items)
                .map(({ to }) => to);

        try {
            setFeatures({ shortDramaEnabled: true, ecommerceEnabled: true, imageWorkbenchEnabled: true, videoWorkbenchEnabled: true });
            for (const path of toolPaths) {
                expect(toolLinks()).toContain(path);
                expect(isGuestWorkspacePath(path)).toBe(false);
                expect(authDialogLanding(path)).toBe("/");
            }
            setFeatures({ shortDramaEnabled: false, ecommerceEnabled: false, imageWorkbenchEnabled: false, videoWorkbenchEnabled: false });
            for (const path of toolPaths) expect(toolLinks()).not.toContain(path);
        } finally {
            setFeatures(previous);
        }
    });
});
