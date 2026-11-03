import { expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useI18n, useSupDanceI18nStore } from "../src/supdance/plugins/i18n/store";
import { usePluginStore } from "../src/stores/use-plugin-store";

test("disabled i18n renders Chinese built-in keys instead of implementation keys", () => {
    const before = useSupDanceI18nStore.getState();
    const plugins = usePluginStore.getState().pluginStates;
    try {
        useSupDanceI18nStore.setState({ pluginEnabled: false });
        const Probe = () => {
            const { t } = useI18n();
            return createElement("span", null, `${t("auth.login")}/${t("auth.password")}/${t("nav.changelog")}`);
        };
        const html = renderToStaticMarkup(createElement(Probe));
        expect(html).toContain("登录");
        expect(html).toContain("密码");
        expect(html).not.toContain("auth.");
        expect(html).not.toContain("nav.");
    } finally {
        useSupDanceI18nStore.setState(before);
        usePluginStore.setState({ pluginStates: plugins });
    }
});
