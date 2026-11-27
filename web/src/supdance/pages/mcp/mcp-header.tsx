import { ArrowUpRight } from "lucide-react";
import { useEffect, useState, type MouseEvent } from "react";
import { Link } from "react-router";
import { useLocaleStore } from "@/stores/use-locale-store";
import { useUserStore } from "@/stores/use-user-store";
import { TopbarLanguageSwitcher } from "@/supdance/plugins/i18n";
import { LegalThemeToggler } from "../legal/legal-theme-toggler";

const HEADER_NAV_COPY: Record<string, Record<string, string>> = {
    arch: {
        "zh-CN": "架构理念", "zh-TW": "架構理念", "en-US": "Architecture",
        "ja-JP": "アーキテクチャ", "ko-KR": "아키텍처", "es-ES": "Arquitectura", "fr-FR": "Architecture", "de-DE": "Architektur",
    },
    tools: {
        "zh-CN": "工具规范", "zh-TW": "工具規範", "en-US": "Tools Schema",
        "ja-JP": "ツール定義", "ko-KR": "도구 명세", "es-ES": "Esquema de herramientas", "fr-FR": "Schéma d'outils", "de-DE": "Tool-Schema",
    },
    config: {
        "zh-CN": "接入预览", "zh-TW": "接入預覽", "en-US": "Config Spec",
        "ja-JP": "接続プレビュー", "ko-KR": "연동 미리보기", "es-ES": "Vista de configuración", "fr-FR": "Config & Intégration", "de-DE": "Konfiguration",
    },
    roadmap: {
        "zh-CN": "研发路线", "zh-TW": "研發路線", "en-US": "Roadmap",
        "ja-JP": "ロードマップ", "ko-KR": "로드맵", "es-ES": "Hoja de ruta", "fr-FR": "Feuille de route", "de-DE": "Roadmap",
    },
    about: {
        "zh-CN": "关于我们", "zh-TW": "關於我們", "en-US": "About",
        "ja-JP": "私たちについて", "ko-KR": "회사 소개", "es-ES": "Acerca de", "fr-FR": "À propos", "de-DE": "Über uns",
    },
    enterWorkspace: {
        "zh-CN": "进入工作台", "zh-TW": "進入工作台", "en-US": "Workspace",
        "ja-JP": "ワークスペース", "ko-KR": "워크스페이스", "es-ES": "Espacio de trabajo", "fr-FR": "Espace de travail", "de-DE": "Workspace",
    },
};

function pickNav(locale: string, key: keyof typeof HEADER_NAV_COPY): string {
    const item = HEADER_NAV_COPY[key];
    return item[locale] || item["en-US"] || item["zh-CN"];
}

export function McpHeader() {
    const user = useUserStore((s) => s.user);
    const locale = useLocaleStore((s) => s.locale);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const onScroll = () => {
            const y = window.scrollY || document.documentElement.scrollTop;
            setScrolled(y > 30);
        };
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    const handleAnchorClick = (e: MouseEvent<HTMLAnchorElement>, selector: string) => {
        e.preventDefault();
        const target = document.querySelector(selector);
        if (target) {
            target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    };

    return (
        <header className={`mcp-header${scrolled ? " is-scrolled" : ""}`}>
            <div className="mcp-header-inner">
                <div className="mcp-brand-wrap flex items-center gap-2">
                    <Link to="/" className="mcp-brand-link flex items-center" aria-label="SupDance Home">
                        <img
                            src="/supdance-brand-dark.png"
                            alt="SupDance"
                            className={`h-7 sm:h-8 w-auto max-w-[155px] object-contain ${scrolled ? "hidden" : "block"}`}
                        />
                        <img
                            src="/supdance-brand-light.png"
                            alt="SupDance"
                            className={`h-7 sm:h-8 w-auto max-w-[155px] object-contain ${scrolled ? "block" : "hidden"}`}
                        />
                    </Link>
                    <span className="mcp-brand-tag">MCP</span>
                </div>

                <nav className="mcp-header-nav" aria-label="MCP 页面导航">
                    <a href="#mcp-architecture" onClick={(e) => handleAnchorClick(e, "#mcp-architecture")}>{pickNav(locale, "arch")}</a>
                    <a href="#tools-schema" onClick={(e) => handleAnchorClick(e, "#tools-schema")}>{pickNav(locale, "tools")}</a>
                    <a href="#config-spec" onClick={(e) => handleAnchorClick(e, "#config-spec")}>{pickNav(locale, "config")}</a>
                    <a href="#mcp-roadmap" onClick={(e) => handleAnchorClick(e, "#mcp-roadmap")}>{pickNav(locale, "roadmap")}</a>
                    <a href="/html/about">{pickNav(locale, "about")}</a>
                </nav>

                <div className="mcp-header-actions flex items-center gap-3">
                    <TopbarLanguageSwitcher surface="legal" className="mcp-lang-btn" />
                    <LegalThemeToggler />
                    <Link to={user ? "/create" : "/"} className="mcp-header-cta">
                        <span>{pickNav(locale, "enterWorkspace")}</span>
                        <ArrowUpRight className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
                    </Link>
                </div>
            </div>
        </header>
    );
}
