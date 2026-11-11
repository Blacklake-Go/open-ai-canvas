import { afterAll, expect, spyOn, test } from "bun:test";
import { Window } from "happy-dom";

const dom = new Window({ url: "http://localhost/toolbox/music" });
for (const key of ["document", "navigator", "HTMLElement", "Element", "Node", "Event", "CustomEvent"] as const) {
    Object.defineProperty(globalThis, key, { configurable: true, value: dom[key] });
}
Object.defineProperties(globalThis, {
    window: { configurable: true, value: dom },
    IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true },
});
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
const { useWalletBalance } = await import("../../src/hooks/use-wallet-balance");
const walletAPI = await import("../../src/services/api/wallet");

test("music and header share owner-checked balance through reservation, settlement, refund and account change", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    let amount = 50_000_000;
    let responseOwner = "a";
    const api = spyOn(walletAPI, "getWallet").mockImplementation(async () => ({
        account: { userId: responseOwner, availableMicrocredits: amount },
        policy: {},
    }) as Awaited<ReturnType<typeof walletAPI.getWallet>>);
    let refresh: ReturnType<typeof useWalletBalance>["refresh"];
    function Balance({ user, position }: { user: string; position: string }) {
        const wallet = useWalletBalance(user);
        refresh = wallet.refresh;
        return <output data-position={position}>{wallet.availableMicrocredits ?? "unknown"}</output>;
    }
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });
    const render = (user: string) => act(async () => root.render(<QueryClientProvider client={client}><Balance user={user} position="header" /><Balance user={user} position="music" /></QueryClientProvider>));
    const values = () => Array.from(container.querySelectorAll("output"), (el) => el.textContent);
    try {
        await render("a");
        await settle();
        expect(values()).toEqual(["50000000", "50000000"]);
        expect(api).toHaveBeenCalledTimes(1);
        amount = 36_900_000;
        await act(async () => { await refresh!(); });
        await settle();
        expect(values()).toEqual(["36900000", "36900000"]);
        amount = 40_000_000;
        await act(async () => { window.dispatchEvent(new CustomEvent("wallet:updated")); });
        await settle();
        expect(values()).toEqual(["40000000", "40000000"]);
        await render("b");
        await settle();
        expect(values()).toEqual(["unknown", "unknown"]);
        responseOwner = "b";
        amount = 8_000_000;
        await act(async () => { await refresh!(); });
        await settle();
        expect(values()).toEqual(["8000000", "8000000"]);
    } finally {
        await act(async () => root.unmount());
        client.clear();
        api.mockRestore();
        container.remove();
    }
});

afterAll(() => dom.happyDOM.abort());
