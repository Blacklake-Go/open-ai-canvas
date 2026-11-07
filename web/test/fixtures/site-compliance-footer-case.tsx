import { expect, test } from "bun:test";
import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SiteComplianceFooter } from "../../src/components/layout/site-compliance-footer";

const keys = ["supdance:legal-footer:seen:v1", "supdance:legal-footer:dismissed:v1"];
const reset = () => keys.forEach((key) => localStorage.removeItem(key));
async function mount(variant: "workspace" | "auth" = "workspace") {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () =>
        root.render(
            <StrictMode>
                <SiteComplianceFooter variant={variant} />
            </StrictMode>,
        ),
    );
    return {
        host,
        close: async () => {
            await act(async () => root.unmount());
            host.remove();
        },
    };
}

test("legal links show on the first visit, then stay hidden on a later mount without requiring dismissal", async () => {
    reset();
    const first = await mount();
    try {
        expect(first.host.querySelector("footer")).not.toBeNull();
        expect(first.host.querySelector('a[href="/terms"]')).not.toBeNull();
        expect(first.host.querySelector(".site-compliance-footer-dismiss")).not.toBeNull();
    } finally {
        await first.close();
    }
    const next = await mount();
    try {
        expect(next.host.querySelector("footer")).toBeNull();
    } finally {
        await next.close();
        reset();
    }
});

test("the first legal notice can be closed and remains hidden after remount", async () => {
    reset();
    const first = await mount();
    try {
        await act(async () => first.host.querySelector<HTMLButtonElement>(".site-compliance-footer-dismiss")!.click());
        expect(first.host.querySelector("footer")).toBeNull();
    } finally {
        await first.close();
    }
    const next = await mount();
    try {
        expect(next.host.querySelector("footer")).toBeNull();
    } finally {
        await next.close();
        reset();
    }
});

test("existing dismissal remains respected and authentication pages retain policy links", async () => {
    reset();
    localStorage.setItem(keys[1], "true");
    const workspace = await mount();
    try {
        expect(workspace.host.querySelector("footer")).toBeNull();
    } finally {
        await workspace.close();
    }
    const auth = await mount("auth");
    try {
        expect(auth.host.querySelector('a[href="/privacy"]')).not.toBeNull();
        expect(auth.host.querySelector(".site-compliance-footer-dismiss")).toBeNull();
    } finally {
        await auth.close();
        reset();
    }
});
