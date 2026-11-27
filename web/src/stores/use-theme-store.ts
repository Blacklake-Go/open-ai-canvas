import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeName = "light" | "dark";

type ThemeStore = {
    theme: ThemeName;
    setTheme: (theme: ThemeName) => void;
};

const VALID_THEMES: ThemeName[] = ["light", "dark"];

export const useThemeStore = create<ThemeStore>()(
    persist(
        (set) => ({
            theme: "dark",
            // 写入前校验：非法 theme 直接忽略，防止 syncRemoteUserData 等路径绕过 merge 写入坏值
            setTheme: (next) => set((state) => (VALID_THEMES.includes(next) ? { theme: next } : state)),
        }),
        {
            name: "yingce:theme_store",
            merge: (persisted, current) => {
                const stored = (persisted || {}) as Partial<ThemeStore>;
                const theme = VALID_THEMES.includes(stored.theme as ThemeName) ? (stored.theme as ThemeName) : current.theme;
                return { ...current, theme };
            },
        },
    ),
);

if (typeof window !== "undefined") {
    window.addEventListener?.("supdance:boot-theme", (event: Event) => {
        useThemeStore.getState().setTheme((event as CustomEvent<ThemeName>).detail);
    });
}
