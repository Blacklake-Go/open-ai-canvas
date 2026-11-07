import { afterAll, expect, test } from "bun:test";
import { Window } from "happy-dom";

const dom = new Window({ url: "http://localhost/toolbox/music" });
for (const [key, value] of Object.entries({
    window: dom,
    document: dom.document,
    navigator: dom.navigator,
    localStorage: dom.localStorage,
    HTMLElement: dom.HTMLElement,
    HTMLBodyElement: dom.HTMLBodyElement,
    HTMLHtmlElement: dom.HTMLHtmlElement,
    Element: dom.Element,
    Node: dom.Node,
    SVGElement: dom.SVGElement,
    ShadowRoot: dom.ShadowRoot,
    MutationObserver: dom.MutationObserver,
    getComputedStyle: dom.getComputedStyle.bind(dom),
    ResizeObserver: dom.ResizeObserver,
    IS_REACT_ACT_ENVIRONMENT: true,
}))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });

const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { createMemoryRouter, RouterProvider } = await import("react-router");
const { App } = await import("antd");
const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
const { SupDanceRouteHosts } = await import("../../src/supdance/adapters/router-hosts");
const { useUserProfileModalStore } = await import("../../src/stores/use-user-profile-modal-store");
const { useUserStore } = await import("../../src/stores/use-user-store");
const { usePluginStore } = await import("../../src/stores/use-plugin-store");
const { apiClient } = await import("../../src/services/api/request");

test("the real account window opens and survives page navigation with working profile router hooks", async () => {
    const user = { id: "router-host-user", username: "original-user", displayName: "Original name / 用户原文", role: "user" as const, status: "active" as const, avatarMode: "default" as const, avatarPreset: "person" };
    const originalRequest = apiClient.request;
    const reads: string[] = [];
    apiClient.request = (async (config: { method?: string; url?: string }) => {
        if (config.method?.toLowerCase() !== "get" || config.url !== "/auth/profile") throw new Error(`Unexpected request: ${config.method} ${config.url}`);
        reads.push(config.url);
        return { status: 200, data: { code: 0, msg: "", data: { user, hasPassword: true, emailEnabled: false, linuxdoEnabled: false } } };
    }) as typeof apiClient.request;
    useUserStore.getState().setUser(user);
    usePluginStore.setState({ runtimeStatuses: { "supdance-social-auth": "disabled" } });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const router = createMemoryRouter(
        [
            {
                element: <SupDanceRouteHosts />,
                children: [
                    { path: "/toolbox/music", element: <div>Music route content</div> },
                    { path: "/tasks", element: <div>Task route content</div> },
                ],
            },
        ],
        { initialEntries: ["/toolbox/music"] },
    );
    const container = document.createElement("div");
    document.body.append(container);
    const trigger = document.createElement("button");
    const popup = document.createElement("div");
    popup.id = "account-popover";
    popup.setAttribute("role", "tooltip");
    trigger.setAttribute("aria-describedby", popup.id);
    const entry = document.createElement("button");
    popup.append(entry);
    document.body.append(trigger, popup);
    const root = createRoot(container);
    try {
        await act(async () =>
            root.render(
                <App>
                    <QueryClientProvider client={client}>
                        <RouterProvider router={router} />
                    </QueryClientProvider>
                </App>,
            ),
        );
        entry.focus();
        await act(async () => useUserProfileModalStore.getState().openModal("profile"));
        popup.remove();
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 25));
        });
        expect(document.body.textContent).toContain("Music route content");
        expect(document.body.textContent).toContain(user.displayName);
        expect(document.querySelector('[role="dialog"]')).not.toBeNull();
        expect(reads).toEqual(["/auth/profile"]);
        const profileWindow = document.querySelector('[role="dialog"]');
        await act(async () => router.navigate("/tasks"));
        expect(document.body.textContent).toContain("Task route content");
        expect(document.querySelector('[role="dialog"]')).toBe(profileWindow);
        expect(useUserProfileModalStore.getState().isOpen).toBe(true);
        expect(useUserStore.getState().user).toEqual(user);
        const navigation = document.querySelector<HTMLElement>('[role="combobox"][aria-label="设置导航"]');
        expect(navigation).not.toBeNull();
        await act(async () => navigation!.dispatchEvent(new dom.MouseEvent("mousedown", { bubbles: true })));
        const options = Array.from(document.querySelectorAll<HTMLElement>(".ant-select-item-option"));
        expect(options.some((option) => option.textContent?.includes("第三方账号"))).toBe(false);
        const preferences = options.find((option) => option.textContent === "个性偏好");
        expect(preferences).toBeDefined();
        await act(async () => preferences!.click());
        expect(useUserProfileModalStore.getState().activeTab).toBe("preferences");
        expect(document.querySelector('[role="dialog"]')).toBe(profileWindow);
        expect(useUserStore.getState().user).toEqual(user);
        expect(reads).toEqual(["/auth/profile"]);
        await act(async () => useUserProfileModalStore.getState().closeModal());
        expect(useUserProfileModalStore.getState().isOpen).toBe(false);
        expect(document.activeElement).toBe(trigger);
    } finally {
        await act(async () => root.unmount());
        router.dispose();
        client.clear();
        apiClient.request = originalRequest;
        container.remove();
        trigger.remove();
        popup.remove();
        useUserStore.getState().setUser(null);
    }
});

afterAll(async () => {
    await dom.happyDOM.cancelAsync();
});
