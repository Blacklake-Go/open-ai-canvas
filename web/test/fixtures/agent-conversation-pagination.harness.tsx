import { afterAll, expect, test } from "bun:test";
import { Window } from "happy-dom";

const dom = new Window({ url: "http://localhost/" });
for (const [key, value] of Object.entries({
    window: dom,
    document: dom.document,
    navigator: dom.navigator,
    HTMLElement: dom.HTMLElement,
    SVGElement: dom.SVGElement,
    Element: dom.Element,
    Node: dom.Node,
    Event: dom.Event,
    CustomEvent: dom.CustomEvent,
    ShadowRoot: dom.ShadowRoot,
    MutationObserver: dom.MutationObserver,
    ResizeObserver: dom.ResizeObserver,
    getComputedStyle: dom.getComputedStyle.bind(dom),
    IS_REACT_ACT_ENVIRONMENT: true,
})) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
}

const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { AgentConversation } = await import("../../src/components/canvas/canvas-cloud-agent-panel-parts");
const { canvasThemes } = await import("../../src/lib/canvas-theme");
const noop = () => {};

afterAll(async () => dom.happyDOM.close());

test("light and dark histories reveal earlier messages without changing source data", async () => {
    for (const theme of [canvasThemes.light, canvasThemes.dark]) {
        const host = document.createElement("div");
        document.body.append(host);
        const root = createRoot(host);
        const messages = Array.from({ length: 170 }, (_, index) => ({ id: `message-${index}`, role: "user" as const, text: `history-message-${index}-end` }));
        try {
            await act(async () =>
                root.render(
                    <AgentConversation
                        theme={theme}
                        messages={messages}
                        references={[]}
                        busy={false}
                        approval={null}
                        approvalSubmitting={false}
                        nodeCount={0}
                        installedSkillCount={0}
                        onChooseSkill={noop}
                        onOpenSkillRecommendations={noop}
                        onDraftPrompt={noop}
                        onApprovalReasonChange={noop}
                        onApprove={noop}
                        onReject={noop}
                    />,
                ),
            );
            expect(host.textContent).toContain("history-message-169-end");
            expect(host.textContent).not.toContain("history-message-89-end");
            expect(host.querySelectorAll(".agent-conversation-messages > *").length).toBe(81);
            await act(async () => host.querySelector<HTMLButtonElement>(".agent-load-earlier")?.click());
            expect(host.textContent).toContain("history-message-10-end");
            expect(host.textContent).not.toContain("history-message-9-end");
            await act(async () => host.querySelector<HTMLButtonElement>(".agent-load-earlier")?.click());
            expect(host.textContent).toContain("history-message-0-end");
            expect(host.querySelector(".agent-load-earlier")).toBeNull();
            expect(messages).toHaveLength(170);
        } finally {
            await act(async () => root.unmount());
            host.remove();
        }
    }
});
