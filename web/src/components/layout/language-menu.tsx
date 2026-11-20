import { App, Dropdown } from "antd";
import { useState } from "react";
import { languageText } from "@/supdance/plugins/email-marketing/language-messages";
import { Check, ChevronDown, Languages } from "lucide-react";
import { useTranslation } from "react-i18next";

import { switchLocale } from "@/i18n";
import { SUPPORTED_LOCALES, type AppLocale } from "@/i18n/locales";
import { cn } from "@/lib/utils";
import { useLocaleStore } from "@/stores/use-locale-store";
import { useSiteLanguages } from "@/supdance/plugins/i18n/store";

import "./language-menu.css";

function useLanguageChange() {
    const languages = useSiteLanguages();
    const { message } = App.useApp();
    const [busy, setBusy] = useState(false);
    const change = (next: AppLocale, options?: { updateLanguageQuery?: boolean }) => {
        setBusy(true);
        void switchLocale(next, options)
            .catch(() => message.error(languageText(useLocaleStore.getState().locale, "languageError")))
            .finally(() => setBusy(false));
    };
    return { change, busy, languages };
}

/**
 * 界面语言入口。顶栏用图标，登录页显示当前语言。
 * 选项显示各语言自称 + 英文名，切换后整页刷新（见 switchLocale）。
 */
export function LanguageMenu({ variant = "topbar", className, updateLanguageQuery = false }: { variant?: "topbar" | "auth"; className?: string; updateLanguageQuery?: boolean }) {
    const { t } = useTranslation();
    const { change, busy, languages } = useLanguageChange();
    const locale = useLocaleStore((state) => state.locale);
    const current = SUPPORTED_LOCALES.find((item) => item.code === locale) ?? SUPPORTED_LOCALES[0];
    return (
        <Dropdown
            trigger={["click"]}
            placement="bottomRight"
            rootClassName="language-menu-dropdown"
            menu={{
                selectedKeys: [locale],
                items: languages.map((item) => ({
                    key: item.code,
                    label: (
                        <span className="language-menu-option" lang={item.code}>
                            <span className="language-menu-option-copy">
                                <strong>{item.label}</strong>
                                <small>{item.english}</small>
                            </span>
                            {item.code === locale ? <Check aria-hidden className="language-menu-option-check" /> : null}
                        </span>
                    ),
                })),
                onClick: ({ key }) => change(key as AppLocale, { updateLanguageQuery }),
            }}
        >
            <button
                type="button"
                disabled={busy}
                className={cn(variant === "topbar" ? "app-workspace-topbar-icon-button" : "auth-scene-return language-menu-auth-trigger", "language-menu-trigger", className)}
                aria-label={t("language.selectLabel")}
                title={t("language.selectLabel")}
            >
                <Languages aria-hidden />
                {variant === "auth" ? (
                    <>
                        <span>{current.short}</span>
                        <ChevronDown aria-hidden className="language-menu-chevron" />
                    </>
                ) : null}
            </button>
        </Dropdown>
    );
}

/** 设置页使用的语言卡片组：一眼看到全部语言，当前语言用 aria-pressed 标出。 */
export function LanguageOptionGrid() {
    const { change, busy, languages } = useLanguageChange();
    const locale = useLocaleStore((state) => state.locale);
    return (
        <div className="language-option-grid" role="group">
            {languages.map((item) => (
                <button key={item.code} type="button" lang={item.code} className="language-option-card" aria-pressed={item.code === locale} disabled={busy} onClick={() => change(item.code)}>
                    <span>
                        <strong>{item.label}</strong>
                        <small>{item.english}</small>
                    </span>
                    {item.code === locale ? <Check aria-hidden /> : null}
                </button>
            ))}
        </div>
    );
}
