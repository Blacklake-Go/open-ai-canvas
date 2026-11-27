import { ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useUserStore } from "@/stores/use-user-store";
import { TopbarLanguageSwitcher } from "@/supdance/plugins/i18n";

export function McpHeader() {
    const user = useUserStore((s) => s.user);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const onScroll = () => {
            setScrolled(window.scrollY > 40);
        };
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    return (
        <header className={`mcp-header${scrolled ? " is-scrolled" : ""}`}>
            <div className="mcp-header-inner">
                <div className="mcp-brand-wrap">
                    <Link to="/" className="mcp-brand-link" aria-label="SupDance Home">
                        <span className="mcp-brand-mark-box">
                            <img src="/supdance-mark.png" alt="SupDance" />
                        </span>
                        <span>SupDance</span>
                    </Link>
                    <span className="mcp-brand-tag">MCP</span>
                </div>

                <nav className="mcp-header-nav" aria-label="MCP 页面导航">
                    <a href="#mcp-architecture">架构理念</a>
                    <a href="#tools-schema">工具规范</a>
                    <a href="#config-spec">接入预览</a>
                    <a href="#mcp-roadmap">研发路线</a>
                    <a href="/html/about">关于我们</a>
                </nav>

                <div className="mcp-header-actions">
                    <TopbarLanguageSwitcher surface="legal" className="mcp-lang-btn" />
                    <Link to={user ? "/create" : "/"} className="mcp-header-cta">
                        <span>进入工作台</span>
                        <ArrowUpRight className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
                    </Link>
                </div>
            </div>
        </header>
    );
}
