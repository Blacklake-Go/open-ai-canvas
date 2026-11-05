import { afterAll, expect, test } from "bun:test";
import { Window } from "happy-dom";

const dom = new Window({ url: "http://localhost/admin/channels" });
for (const [key, value] of Object.entries({
    window: dom,
    document: dom.document,
    navigator: dom.navigator,
    localStorage: dom.localStorage,
    HTMLElement: dom.HTMLElement,
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
const { Form, Input } = await import("antd");
const { TokenPriceRulesSection } = await import("../../src/pages/admin/components/channel-model-token-rules");
const { CreationEmptySuggest, creationMusicEmptySuggestions } = await import("../../src/pages/create/creation-workspace-empty");
const { useLocaleStore } = await import("../../src/stores/use-locale-store");
const { SUPPORTED_LOCALES } = await import("../../src/i18n/locales");
const { i18n } = await import("../../src/i18n");
type ModelForm = import("../../src/pages/admin/components/channel-model-editor-form").ChannelModelFormValues;
type FormInstance = import("antd").FormInstance<ModelForm>;
const initialValues = {
    priceCurrency: "USD",
    priceTiers: [
        {
            billingMode: "token",
            matchMode: "default",
            tokenRulesEnabled: true,
            tokenRules: [{ enabled: true, weekdays: [1, 3], start: "20:00", end: "24:00", minInputTokens: 272001, maxInputTokens: 1050000, inputTokenPrice: 1.25, outputTokenPrice: 6.75, cachedTokenPrice: 0.125, cacheWriteTokenPrice: 1.5 }],
        },
    ],
};

test("locale changes retain the real pricing fields and music generation payloads", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    let form: FormInstance | undefined;
    let dirty = 0;
    const requests: Array<{ mode: string; prompt: string }> = [];
    const prompts = creationMusicEmptySuggestions.map(({ mode, prompt }) => ({ mode, prompt }));
    function Harness() {
        const [instance] = Form.useForm<ModelForm>();
        form = instance;
        return (
            <>
                <Form form={instance} initialValues={initialValues}>
                    <Form.Item name="priceCurrency" hidden>
                        <Input />
                    </Form.Item>
                    <Form.List name="priceTiers">
                        {(fields) =>
                            fields.map((field) => (
                                <Form.Item key={field.key} name={[field.name, "billingMode"]} hidden>
                                    <Input />
                                </Form.Item>
                            ))
                        }
                    </Form.List>
                    <TokenPriceRulesSection form={instance} onDirty={() => dirty++} />
                </Form>
                <CreationEmptySuggest
                    mode="music"
                    onStartPrompt={(mode, prompt) => requests.push({ mode, prompt })}
                    onOpenLibrary={() => {
                        throw new Error("Music suggestion unexpectedly opened library");
                    }}
                />
            </>
        );
    }
    const originalLocale = useLocaleStore.getState().locale;
    try {
        await act(async () => root.render(<Harness />));
        const original = JSON.stringify(form!.getFieldsValue(true));
        const inputs = [...host.querySelectorAll(".admin-token-rules-content input")];
        expect(inputs.length).toBeGreaterThan(7);
        const headings = new Set<string>();
        const weekdays = new Set<string>();
        for (const { code } of SUPPORTED_LOCALES) {
            await act(async () => useLocaleStore.getState().setLocale(code));
            expect(i18n.language).toBe(code);
            expect(JSON.stringify(form!.getFieldsValue(true))).toBe(original);
            const currentInputs = [...host.querySelectorAll(".admin-token-rules-content input")];
            expect(currentInputs).toHaveLength(inputs.length);
            currentInputs.forEach((input, index) => expect(input).toBe(inputs[index]));
            expect([...host.querySelectorAll<HTMLInputElement>(".ant-checkbox-input")].filter((e) => e.checked).map((e) => e.value)).toEqual(["1", "3"]);
            headings.add(host.querySelector(".admin-model-editor-section h2")!.textContent!);
            weekdays.add(host.querySelector(".ant-checkbox-group")!.textContent!);
            expect(host.textContent).not.toContain("upstream.");
            const buttons = [...host.querySelectorAll<HTMLButtonElement>(".creation-empty-suggest button")];
            expect(buttons).toHaveLength(4);
            await act(async () => buttons[0].click());
            expect(requests.at(-1)).toEqual(prompts[0]);
            expect(creationMusicEmptySuggestions.map(({ mode, prompt }) => ({ mode, prompt }))).toEqual(prompts);
        }
        expect(headings.size).toBe(6);
        expect(weekdays.size).toBeGreaterThanOrEqual(5);
        expect(dirty).toBe(0);
        expect(requests).toHaveLength(6);
    } finally {
        await act(async () => root.unmount());
        host.remove();
        useLocaleStore.getState().setLocale(originalLocale);
    }
});

afterAll(async () => {
    await dom.happyDOM.cancelAsync();
});
