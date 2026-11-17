import React, { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router";
import { Search, X, Sparkles, ChevronRight, ChevronLeft } from "lucide-react";
import { AppStoreHeader } from "./app-store-header";
import { AppStoreCarousel } from "./app-store-carousel";
import { AppCard, OfficialSkillCard, HotUseCaseCard } from "./app-store-card";
import { getAppPreviewImage } from "./app-store-icons";
import { AppStoreDetail } from "./app-store-detail";
import { AppStoreFooter } from "./app-store-footer";
import { APP_CATEGORIES, CAROUSEL_SLIDES, HOT_USE_CASES, ALL_APPS_LIST, DRAMA_WORKSHOP_DETAIL_SPEC, CASTING_ROOM_DETAIL_SPEC, getInstalledAppIds, toggleAppInstalled } from "./app-store-data";
import type { AppCategory, AppStoreItem, HotUseCase, CarouselSlide } from "./app-store-types";
import "./tapnow-reset-bridge.css";

export const AppStorePage: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [activeCategory, setActiveCategory] = useState<AppCategory>("全部");
    const [searchQuery, setSearchQuery] = useState("");
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [installedIds, setInstalledIds] = useState<string[]>(() => getInstalledAppIds());

    // Pagination: 18 items per page (3 columns x 6 rows)
    const ITEMS_PER_PAGE = 18;
    const [currentPage, setCurrentPage] = useState(1);

    const isInstalled = (id: string) => installedIds.includes(id);

    // Detail page routing via URL parameter: ?detail=app&name=drama-workshop
    const detailParam = searchParams.get("detail");
    const nameParam = searchParams.get("name");

    // Unlock global HTML/body scroll to guarantee smooth scrolling across all devices
    useEffect(() => {
        const prevHtmlOverflow = document.documentElement.style.overflow;
        const prevBodyOverflow = document.body.style.overflow;
        document.documentElement.style.overflow = "auto";
        document.body.style.overflow = "auto";
        return () => {
            document.documentElement.style.overflow = prevHtmlOverflow;
            document.body.style.overflow = prevBodyOverflow;
        };
    }, []);

    const currentDetailSpec = useMemo(() => {
        if (!detailParam || !nameParam) return null;
        if (nameParam === "drama-workshop" || nameParam === "短剧工作坊") {
            return DRAMA_WORKSHOP_DETAIL_SPEC;
        }
        if (nameParam === "casting-room" || nameParam === "角色工坊") {
            return CASTING_ROOM_DETAIL_SPEC;
        }
        const app = ALL_APPS_LIST.find((a) => a.slug === nameParam || a.name === nameParam || a.id === nameParam);
        if (app) {
            const previewImage = getAppPreviewImage(app.name);
            const isSkill = detailParam === "skill" || app.type === "skill";
            return {
                id: app.id,
                name: app.name,
                subtitle: app.description,
                tags: app.categories.filter((c) => c !== "全部"),
                previewTitle: isSkill ? "技能特性预览" : "能力预览",
                previewDescription: `探索 ${app.name} 的核心特性与智能体工作流。`,
                previewTabs: [
                    {
                        id: "core-feature",
                        label: isSkill ? "技能算子" : "核心功能",
                        title: `${app.name} · 核心特性`,
                        description: app.description,
                        imageUrl: previewImage,
                        tag: isSkill ? "01 官方技能" : "01 核心能力",
                    },
                ],
                starters: [
                    {
                        id: "starter-1",
                        title: `一键启用 ${app.name}`,
                        category: isSkill ? "技能调用" : "快速上手",
                        description: `在当前工作区智能体中调取 ${app.name} 预设能力进行处理。`,
                    },
                ],
                sections: [
                    {
                        title: "你需要提供什么",
                        items: ["输入对应的文本提示词、素材图或画布节点。"],
                    },
                    {
                        title: "它是如何工作的",
                        items: ["通过标准 API 协议与智能体上下文进行连线和调用。"],
                    },
                    {
                        title: "你将获得什么",
                        items: ["结构化资产输出，可直接作为下一阶段节点的输入。"],
                    },
                    {
                        title: "适用范围与边界",
                        items: ["适用于当前智能体工作区画布与多智能体协作网络。"],
                    },
                    {
                        title: "接下来还可以怎么做",
                        items: ["与其它官方技能或应用节点组合构建复合自动化流水线。"],
                    },
                ],
                sidebarCta: isSkill ? `将 ${app.name} 添加到智能体工具箱` : `将 ${app.name} 添加到 Agent，然后从一个用例开始。`,
                primaryActionText: isSkill ? `在画布中启用该技能` : `在画布中立即尝试该能力`,
                primaryActionUrl: "/canvas",
            };
        }
        return null;
    }, [detailParam, nameParam]);

    // Synchronize page title dynamically
    useEffect(() => {
        if (currentDetailSpec) {
            document.title = `${currentDetailSpec.name} | 应用市场 | TapNow`;
        } else {
            document.title = "应用市场 | TapNow｜你的智能体创意画布";
        }
    }, [currentDetailSpec]);

    // Re-sync installed state when returning from detail view
    useEffect(() => {
        if (!detailParam) {
            setInstalledIds(getInstalledAppIds());
        }
    }, [detailParam]);

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 3000);
    };

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
        const root = document.getElementById("app-store-scroll-root");
        if (root) root.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleSelectApp = (app: AppStoreItem) => {
        if (app.slug === "drama-workshop" || app.id === "drama-workshop") {
            setSearchParams({ detail: "app", name: "drama-workshop" });
            scrollToTop();
            return;
        }
        if (app.slug === "casting-room" || app.id === "casting-room") {
            setSearchParams({ detail: "app", name: "casting-room" });
            scrollToTop();
            return;
        }
        const detailType = app.type === "skill" ? "skill" : "app";
        setSearchParams({ detail: detailType, name: app.slug || app.id });
        scrollToTop();
    };

    const handleSelectUseCase = (item: HotUseCase) => {
        if (item.appSlug === "drama-workshop") {
            setSearchParams({ detail: "app", name: "drama-workshop" });
            scrollToTop();
            return;
        }
        if (item.appSlug) {
            setSearchParams({ detail: "app", name: item.appSlug });
            scrollToTop();
            return;
        }
        showToast(`已选择热门用例：${item.title}`);
    };

    const handleSelectSlide = (slide: CarouselSlide) => {
        if (slide.appSlug) {
            setSearchParams({ detail: "app", name: slide.appSlug });
            scrollToTop();
        }
    };

    const handleBackToList = () => {
        setSearchParams({});
        scrollToTop();
    };

    // Filter apps based on active category and search query
    const filteredApps = useMemo(() => {
        return ALL_APPS_LIST.filter((app) => {
            const matchesCategory = activeCategory === "全部" || app.categories.includes(activeCategory);
            const query = searchQuery.trim().toLowerCase();
            if (!query) return matchesCategory;

            const matchesSearch = app.name.toLowerCase().includes(query) || app.description.toLowerCase().includes(query) || app.categories.some((c) => c.toLowerCase().includes(query));

            return matchesCategory && matchesSearch;
        });
    }, [activeCategory, searchQuery]);

    // Reset page to 1 whenever category or search filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [activeCategory, searchQuery]);

    const totalPages = Math.ceil(filteredApps.length / ITEMS_PER_PAGE) || 1;
    const paginatedApps = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredApps.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredApps, currentPage]);

    const handlePageChange = (newPage: number) => {
        if (newPage < 1 || newPage > totalPages) return;
        setCurrentPage(newPage);
        const el = document.getElementById("all-apps-section");
        if (el) {
            el.scrollIntoView({ behavior: "smooth" });
        }
    };

    // Compute category counts
    const categoryCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        APP_CATEGORIES.forEach((cat) => {
            if (cat.name === "全部") {
                counts[cat.name] = ALL_APPS_LIST.length;
            } else {
                counts[cat.name] = ALL_APPS_LIST.filter((a) => a.categories.includes(cat.name)).length;
            }
        });
        return counts;
    }, []);

    // Official skills for Section 2 (first 6 items)
    const officialSkillsTop = useMemo(() => {
        return ALL_APPS_LIST.filter((a) => a.categories.includes("官方技能")).slice(0, 6);
    }, []);

    return (
        <div
            id="app-store-scroll-root"
            data-testid="app-store-page-root"
            className="fixed inset-0 w-full h-full overflow-y-auto overflow-x-hidden bg-[#0a0a0a] text-white font-sans selection:bg-white/25 antialiased z-10 [overscroll-behavior-y:contain] [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.2)_transparent]"
        >
            {/* Top Fixed Header */}
            <AppStoreHeader />

            {/* Main Scrollable Viewport */}
            <main className="pt-16 pb-20 overflow-x-hidden">
                <div className="mx-auto w-full max-w-[1500px] px-4 sm:px-6 xl:px-12">
                    {/* Render App Detail View if active */}
                    {currentDetailSpec ? (
                        <div className="pt-6">
                            <AppStoreDetail spec={currentDetailSpec} onBack={handleBackToList} />
                        </div>
                    ) : (
                        /* Catalog View */
                        <div>
                            {/* Section 1: Hero Carousel ("最新上线") */}
                            <AppStoreCarousel slides={CAROUSEL_SLIDES} onSelectSlide={handleSelectSlide} />

                            {/* Section 2: Official Skills ("官方技能") */}
                            <section className="mt-20" aria-label="官方技能精选">
                                <div className="mb-3 flex items-center justify-between">
                                    <h2 className="text-xl font-medium tracking-[-0.035em] text-white font-sans">官方技能</h2>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setActiveCategory("官方技能");
                                            const el = document.getElementById("all-apps-section");
                                            if (el) el.scrollIntoView({ behavior: "smooth" });
                                        }}
                                        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-zinc-300 bg-white/[0.04] border border-white/[0.08] hover:text-white hover:bg-white/[0.09] hover:border-white/20 shadow-xs active:scale-95 transition-all cursor-pointer select-none"
                                    >
                                        <span>查看全部</span>
                                        <ChevronRight className="size-3.5" strokeWidth={2.2} />
                                    </button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1">
                                    {officialSkillsTop.map((skill) => (
                                        <OfficialSkillCard key={skill.id} app={skill} isInstalled={isInstalled(skill.id)} onClick={handleSelectApp} />
                                    ))}
                                </div>
                            </section>

                            {/* Section 3: Hot Use Cases ("热门用例") */}
                            <section className="mt-16" aria-label="热门用例">
                                <div className="mb-3">
                                    <h2 className="text-xl font-medium tracking-[-0.035em] text-white font-sans">热门用例</h2>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1">
                                    {HOT_USE_CASES.map((useCase) => (
                                        <HotUseCaseCard key={useCase.id} item={useCase} onClick={handleSelectUseCase} />
                                    ))}
                                </div>
                            </section>

                            {/* Section 4: All Apps Header, Filter Tabs & Search Bar */}
                            <section id="all-apps-section" className="mt-16 pt-2" aria-label="全部应用">
                                <div className="mb-4">
                                    <h2 className="text-xl font-medium tracking-[-0.035em] text-white font-sans">全部应用</h2>
                                </div>

                                <div className="mb-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                    {/* Category Tabs (9 Pills) - lg:order-1 */}
                                    <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar lg:order-1 min-w-0 flex-1">
                                        {APP_CATEGORIES.map((cat) => {
                                            const isActive = activeCategory === cat.name;
                                            return (
                                                <button
                                                    key={cat.name}
                                                    type="button"
                                                    onClick={() => setActiveCategory(cat.name)}
                                                    className="inline-flex h-10 items-center whitespace-nowrap rounded-xl px-3.5 text-sm font-medium transition-all cursor-pointer select-none active:scale-95"
                                                    style={{
                                                        backgroundColor: isActive ? "#ffffff" : "rgba(255, 255, 255, 0.06)",
                                                        color: isActive ? "#000000" : "rgba(255, 255, 255, 0.8)",
                                                        border: isActive ? "1px solid rgba(255, 255, 255, 0.9)" : "1px solid rgba(255, 255, 255, 0.08)",
                                                        boxShadow: isActive ? "0 2px 10px rgba(0, 0, 0, 0.35)" : "0 1px 3px rgba(0, 0, 0, 0.2)",
                                                    }}
                                                >
                                                    {cat.name}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Real-Time Search Bar - lg:order-2 lg:w-[344px] */}
                                    <div className="relative w-full lg:w-[344px] shrink-0 lg:order-2">
                                        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 text-white/40" strokeWidth={2.2} />
                                        <input
                                            type="search"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="搜索应用或用例"
                                            className="h-10 w-full rounded-xl border border-white/[0.08] pl-9 pr-9 text-sm font-normal text-white placeholder:text-white/40 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 focus-visible:border-white/20 transition-all"
                                            style={{
                                                backgroundColor: "rgba(255, 255, 255, 0.035)",
                                            }}
                                        />
                                        {searchQuery ? (
                                            <button
                                                type="button"
                                                onClick={() => setSearchQuery("")}
                                                aria-label="清除搜索关键词"
                                                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 active:scale-90 transition-all cursor-pointer shadow-xs"
                                            >
                                                <X className="size-3.5" strokeWidth={2.2} />
                                            </button>
                                        ) : null}
                                    </div>
                                </div>

                                {/* Section 5: All Apps Card Grid (3 Columns) with Pagination */}
                                {filteredApps.length > 0 ? (
                                    <>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {paginatedApps.map((app) => (
                                                <AppCard key={app.id} app={app} isInstalled={isInstalled(app.id)} onClick={handleSelectApp} />
                                            ))}
                                        </div>

                                        {/* Pagination Controls */}
                                        {filteredApps.length > ITEMS_PER_PAGE && (
                                            <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 py-4 border-t border-white/[0.06] select-none">
                                                <span className="text-xs text-zinc-400 font-mono tabular-nums order-2 sm:order-1">
                                                    显示 {(currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredApps.length)} 项 · 共 {filteredApps.length} 款应用
                                                </span>

                                                <div className="flex items-center gap-1.5 order-1 sm:order-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => handlePageChange(currentPage - 1)}
                                                        disabled={currentPage === 1}
                                                        className={`inline-flex h-9 items-center gap-1 rounded-lg px-3 text-xs font-medium transition-all ${
                                                            currentPage === 1
                                                                ? "text-white/25 cursor-not-allowed bg-transparent border border-white/[0.04]"
                                                                : "text-white/85 hover:text-white hover:bg-white/[0.08] hover:border-white/20 cursor-pointer bg-white/[0.04] border border-white/[0.08] shadow-sm active:scale-95"
                                                        }`}
                                                    >
                                                        <ChevronLeft className="size-3.5" strokeWidth={2.2} />
                                                        <span>上一页</span>
                                                    </button>

                                                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
                                                        const isActive = p === currentPage;
                                                        return (
                                                            <button
                                                                key={p}
                                                                type="button"
                                                                onClick={() => handlePageChange(p)}
                                                                className={`size-9 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                                                                    isActive
                                                                        ? "bg-white text-black font-semibold border border-white shadow-[0_2px_8px_rgba(0,0,0,0.35)] active:scale-95"
                                                                        : "text-white/80 hover:text-white hover:bg-white/[0.08] hover:border-white/20 bg-white/[0.04] border border-white/[0.08] shadow-xs active:scale-95"
                                                                }`}
                                                            >
                                                                {p}
                                                            </button>
                                                        );
                                                    })}

                                                    <button
                                                        type="button"
                                                        onClick={() => handlePageChange(currentPage + 1)}
                                                        disabled={currentPage === totalPages}
                                                        className={`inline-flex h-9 items-center gap-1 rounded-lg px-3 text-xs font-medium transition-all ${
                                                            currentPage === totalPages
                                                                ? "text-white/25 cursor-not-allowed bg-transparent border border-white/[0.04]"
                                                                : "text-white/85 hover:text-white hover:bg-white/[0.08] hover:border-white/20 cursor-pointer bg-white/[0.04] border border-white/[0.08] shadow-sm active:scale-95"
                                                        }`}
                                                    >
                                                        <span>下一页</span>
                                                        <ChevronRight className="size-3.5" strokeWidth={2.2} />
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="py-20 text-center rounded-2xl bg-white/[0.02] border border-white/[0.04]">
                                        <p className="text-white/40 text-sm">未找到与「{searchQuery}」相关的应用或技能</p>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSearchQuery("");
                                                setActiveCategory("全部");
                                            }}
                                            className="mt-4 inline-flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-medium text-zinc-300 bg-white/[0.08] border border-white/[0.14] hover:bg-white/[0.14] hover:border-white/30 hover:text-white shadow-sm active:scale-95 transition-all cursor-pointer"
                                        >
                                            清除筛选条件
                                        </button>
                                    </div>
                                )}
                            </section>
                        </div>
                    )}
                </div>
            </main>

            {/* Footer */}
            <AppStoreFooter />

            {/* Floating Toast Notification */}
            {toastMessage ? (
                <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-zinc-900 border border-white/20 px-4 py-3 text-sm text-white shadow-2xl animate-slideUp">
                    <Sparkles className="size-4 text-zinc-300 shrink-0" strokeWidth={2.2} />
                    <span>{toastMessage}</span>
                </div>
            ) : null}
        </div>
    );
};
