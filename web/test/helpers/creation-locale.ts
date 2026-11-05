import { beforeEach } from "bun:test";

// Register after each DOM suite installs its browser environment.
export function useChineseCreationTestLocale(): void {
    beforeEach(async () => {
        const { useLocaleStore } = await import("@/stores/use-locale-store");
        useLocaleStore.getState().setLocale("zh-CN");
    });
}
