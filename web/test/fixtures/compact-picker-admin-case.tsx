import { test, expect } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { App } from "antd";
import { appQueryClient } from "../../src/lib/query-client";
import { apiClient } from "../../src/services/api/request";
import { i18n } from "../../src/i18n";
import CompactPickerAdmin from "../../src/supdance/plugins/compact-model-picker/admin";
import { COMPACT_PICKER_ADMIN_ROUTE, compactPublicKey, type CompactPickerSettings } from "../../src/supdance/plugins/compact-model-picker/settings";

test("admin changes remain drafts until accepted by the server; failed saves are retryable", async () => {
    const path = "/admin/supdance/compact-model-picker/settings";
    let persisted: CompactPickerSettings = { enabled: true, showDescription: true, showPrice: true };
    let allowSave = false;
    const requests: string[] = [];
    const original = apiClient.request;
    apiClient.request = (async (request) => {
        if (request.url !== path) throw new Error("Unexpected URL: " + request.url);
        const method = request.method!.toLowerCase();
        requests.push(method);
        if (method === "put") {
            if (!allowSave) throw new Error("test write rejected");
            persisted = { ...request.data };
        } else if (method !== "get") throw new Error("Unexpected method: " + method);
        return { status: 200, data: { code: 0, msg: "", data: { ...persisted } } };
    }) as typeof apiClient.request;
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const flush = () =>
        act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 30));
        });
    const render = () =>
        root.render(
            <QueryClientProvider client={appQueryClient}>
                <App>
                    <MemoryRouter initialEntries={[COMPACT_PICKER_ADMIN_ROUTE]}>
                        <CompactPickerAdmin />
                    </MemoryRouter>
                </App>
            </QueryClientProvider>,
        );
    try {
        await act(async () => render());
        await flush();
        const toggle = (key: string) => host.querySelector<HTMLButtonElement>(`[role="switch"][aria-label="${i18n.t("compactPicker." + key)}"]`)!;
        const save = () => [...host.querySelectorAll("button")].find((el) => el.textContent === i18n.t("compactPicker.save"))!;
        expect(save().disabled).toBe(true);
        await act(async () => toggle("showPrice").click());
        await act(async () => toggle("enabled").click());
        expect(toggle("showPrice").disabled).toBe(true);
        expect(persisted.enabled).toBe(true);
        await act(async () => save().click());
        await flush();
        expect(host.textContent).toContain("test write rejected");
        expect(save().disabled).toBe(false);
        expect(persisted.showPrice).toBe(true);
        allowSave = true;
        await act(async () => save().click());
        await flush();
        expect(persisted).toEqual({ enabled: false, showDescription: true, showPrice: false });
        expect(appQueryClient.getQueryData(compactPublicKey)).toEqual(persisted);
        expect(requests).toEqual(["get", "put", "put"]);
        expect(save().disabled).toBe(true);
    } finally {
        await act(async () => root.unmount());
        host.remove();
        appQueryClient.clear();
        apiClient.request = original;
    }
});
