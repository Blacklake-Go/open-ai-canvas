import { expect, test } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { MusicForm } from "../../src/supdance/plugins/music-generation/components/music-form";
import { useMusicStore } from "../../src/supdance/plugins/music-generation/stores/use-music-store";
import type { ModelCapabilities } from "../../src/supdance/plugins/music-generation/services/music-api";
import { defaultConfig, normalizeConfigSnapshot, useConfigStore } from "../../src/stores/use-config-store";
import { systemChannelModelChannels } from "../../src/lib/user-session";
import { appQueryClient } from "../../src/lib/query-client";
import { apiClient } from "../../src/services/api/request";

const models = [
    { key: "mureka-v9", brand: "Mureka", name: "Mureka v9", price: 8_200_000 },
    { key: "mureka-v7.6", brand: "Mureka", name: "Mureka v7.6", price: 6_600_000 },
    { key: "suno-v6", brand: "Suno", name: "Suno v6", price: 13_100_000 },
    { key: "speech-only", brand: "Speech", name: "Speech only", price: 1_000_000 },
];
const capabilities: ModelCapabilities[] = models.slice(0, 3).map((m) => ({
    id: `music::${m.key}`,
    name: m.brand,
    modelKey: m.key,
    version: "1",
    modes: ["simple", "custom"],
    minDuration: 30,
    maxDuration: 300,
    formats: ["mp3"],
    maxPromptChars: 1500,
    maxLyricsChars: 3000,
    costPerSecondMicrocredits: 0,
    stemSeparation: false,
    available: m.key !== "mureka-v7.6",
    unavailableReason: "Unavailable",
}));
const channels = systemChannelModelChannels([
    {
        id: "music",
        name: "Platform",
        displayName: "Platform",
        models: models.map((m) => ({
            id: m.key,
            modelKey: m.key,
            displayName: m.brand,
            channelLabel: m.name,
            description: `${m.name} music generation`,
            icon: "",
            capability: "audio",
            protocol: "async-audio",
            available: true,
            pricingMode: "provider",
            priceLabel: "",
            priceTiers: [{ id: m.key, selector: {}, resolution: "", videoSeconds: 0, billingMode: "fixed_request", unitPriceMicrocredits: m.price, inputTokenPriceMicrocredits: 0, outputTokenPriceMicrocredits: 0, cachedTokenPriceMicrocredits: 0 }],
        })),
    },
]);

test("music workbench shares versioned brand rows, preserves draft IDs and refuses unavailable models without generating", async () => {
    const previousConfig = useConfigStore.getState().config;
    const previousMusic = useMusicStore.getState();
    const originalRequest = apiClient.request;
    const requests: string[] = [];
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const settle = () =>
        act(async () => {
            await new Promise((r) => setTimeout(r, 25));
        });
    apiClient.request = (async (request: { method?: string; url?: string; data?: { model?: string } }) => {
        const path = `${request.method?.toUpperCase()} ${request.url}`;
        requests.push(path);
        if (path === "GET /supdance/compact-model-picker/settings") return { status: 200, data: { code: 0, data: { enabled: true, showDescription: true, showPrice: true, showInspirations: false } } };
        if (path === "POST /v1/supdance/music/quote") return { status: 200, data: { code: 0, data: { amountMicrocredits: models.find((m) => request.data?.model === `music::${m.key}`)?.price, quantity: 1, billingMode: "fixed_request" } } };
        throw new Error(`Unexpected request: ${path}`);
    }) as typeof apiClient.request;
    try {
        useConfigStore.setState({ config: normalizeConfigSnapshot({ config: { ...defaultConfig, channels } }).config });
        useMusicStore.setState({ capabilities, loadingCaps: false, submitting: false, draft: { ...previousMusic.draft, model: "music::mureka-v9", prompt: "Preserve prompt", lyrics: "Preserve lyrics" } });
        await act(async () =>
            root.render(
                <QueryClientProvider client={appQueryClient}>
                    <MusicForm userId="" />
                </QueryClientProvider>,
            ),
        );
        await settle();
        const trigger = () => host.querySelector<HTMLButtonElement>('button[aria-haspopup="listbox"]')!;
        await act(async () => trigger().click());
        await settle();
        expect(document.querySelector(".sd-compact-picker")).not.toBeNull();
        expect(document.querySelector('[role="listbox"]')?.textContent).toContain("Mureka v9");
        expect(document.querySelector('[role="listbox"]')?.textContent).toContain("Mureka v9 music generation");
        expect(document.querySelector('[role="listbox"]')?.textContent).toContain("8.2 积分");
        expect(document.querySelector('[role="listbox"]')?.textContent).not.toContain("Speech only");
        const disabled = [...document.querySelectorAll<HTMLButtonElement>(".sd-picker-option")].find((e) => e.textContent?.includes("Mureka v7.6"))!;
        expect(disabled.disabled).toBe(true);
        await act(async () => disabled.click());
        expect(useMusicStore.getState().draft.model).toBe("music::mureka-v9");
        const suno = [...document.querySelectorAll<HTMLButtonElement>(".canvas-model-picker-brand-rail button")].find((e) => e.querySelector("strong")?.textContent === "Suno")!;
        await act(async () => suno.click());
        await act(async () => document.querySelector<HTMLButtonElement>(".sd-picker-option")!.click());
        await settle();
        expect(useMusicStore.getState().draft).toMatchObject({ model: "music::suno-v6", prompt: "Preserve prompt", lyrics: "Preserve lyrics" });
        expect(trigger().textContent).toContain("Suno v6");
        expect(trigger().getAttribute("aria-expanded")).toBe("false");
        await act(async () => trigger().click());
        await settle();
        expect(document.querySelector('.sd-picker-option[aria-selected="true"]')?.textContent).toContain("Suno v6");
        await act(async () => useMusicStore.setState({ submitting: true }));
        await settle();
        expect(trigger().disabled).toBe(true);
        expect(trigger().getAttribute("aria-expanded")).toBe("false");
        expect(requests.every((p) => p === "GET /supdance/compact-model-picker/settings" || p === "POST /v1/supdance/music/quote")).toBe(true);
    } finally {
        await act(async () => root.unmount());
        host.remove();
        apiClient.request = originalRequest;
        appQueryClient.clear();
        useConfigStore.setState({ config: previousConfig });
        useMusicStore.setState(previousMusic);
    }
});
