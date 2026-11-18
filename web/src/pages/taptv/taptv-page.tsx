import React, { useState, useEffect, useMemo, useRef } from "react";
import { AppStoreHeader } from "../app-store/app-store-header";
import { AppStoreFooter } from "../app-store/app-store-footer";
import { TapTvCard } from "./taptv-card";
import { TapTvPlayerModal } from "./taptv-player-modal";
import { TapTvProcessModal } from "./taptv-process-modal";
import { TAPTV_CATEGORIES, TAPTV_VIDEOS } from "./taptv-data";
import { TapTvCategory, TapTvVideoItem, TapTvViewFilter, TapTvSortOption } from "./taptv-types";
import { Tv, GraduationCap, Search, Plus, ChevronLeft, ChevronRight, Play, ArrowUpRight, Sparkles, X, SlidersHorizontal, ChevronDown, Check } from "lucide-react";
import { useNavigate } from "react-router";
import { message } from "antd";
import "../app-store/tapnow-reset-bridge.css";

const ITEMS_PER_PAGE = 16;

const SORT_OPTIONS: { key: TapTvSortOption; label: string }[] = [
    { key: "recommend", label: "综合排序 (默认)" },
    { key: "stars", label: "最多收藏" },
    { key: "likes", label: "点赞最高" },
    { key: "latest", label: "最新发布" },
];

export const TapTvPage: React.FC = () => {
    const navigate = useNavigate();
    const sortDropdownRef = useRef<HTMLDivElement>(null);

    const [selectedCategory, setSelectedCategory] = useState<TapTvCategory>("全部");
    const [viewFilter, setViewFilter] = useState<TapTvViewFilter>("curated");
    const [sortOrder, setSortOrder] = useState<TapTvSortOption>("recommend");
    const [isSortOpen, setIsSortOpen] = useState(false);
    const [subTab, setSubTab] = useState<"plaza" | "academy">("plaza");
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedQuery, setDebouncedQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedVideo, setSelectedVideo] = useState<TapTvVideoItem | null>(null);
    const [processVideo, setProcessVideo] = useState<TapTvVideoItem | null>(null);

    // Initial followed creators list
    const [followedCreators] = useState<string[]>(["超绝YBY", "短剧大师工作室", "太白遗风", "月球工厂", "很旺喔AI", "新手学院导师"]);

    // Search input debounce (250ms)
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(searchQuery);
        }, 250);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Document Title and Scroll Root Unlock
    useEffect(() => {
        document.title = "TapTV | TapNow｜你的智能体创意画布";
        document.body.style.overflow = "auto";
        return () => {
            document.body.style.overflow = "auto";
        };
    }, []);

    // Close sort dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (sortDropdownRef.current && !sortDropdownRef.current.contains(e.target as Node)) {
                setIsSortOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Filter and Search logic with real tab filtering and real sorting
    const filteredVideos = useMemo(() => {
        let result = TAPTV_VIDEOS.slice();

        // SubTab: Academy vs Plaza
        if (subTab === "academy") {
            result = result.filter((v) => v.category === "新手必学" || v.category === "教程" || v.toolTag.includes("教程"));
        }

        // Category match
        if (selectedCategory !== "全部") {
            result = result.filter((v) => v.category === selectedCategory);
        }

        // View filter match
        if (viewFilter === "curated") {
            result = result.filter((v) => v.featured || v.stars >= 15);
        } else if (viewFilter === "following") {
            // Real following filter based on followed creators list
            result = result.filter((v) => followedCreators.includes(v.creator) || followedCreators.includes(v.creatorHandle) || v.featured);
        } else if (viewFilter === "trending") {
            result = result.filter((v) => v.likes >= 30 || v.views >= 10000);
        } else if (viewFilter === "latest") {
            // "最新发布" tab: displays works, sorted by latest
        }

        // Search query match (debounced)
        if (debouncedQuery.trim()) {
            const query = debouncedQuery.toLowerCase();
            result = result.filter((video) => {
                const matchTitle = video.title.toLowerCase().includes(query);
                const matchCreator = video.creator.toLowerCase().includes(query) || video.creatorHandle.toLowerCase().includes(query);
                const matchTag = video.toolTag.toLowerCase().includes(query);
                const matchCategory = video.category.toLowerCase().includes(query);
                return matchTitle || matchCreator || matchTag || matchCategory;
            });
        }

        // Sorting Logic (G4 & G5)
        // If tab is "latest", always sort by timestamp descending; otherwise use sortOrder
        const effectiveSort = viewFilter === "latest" ? "latest" : sortOrder;

        result.sort((a, b) => {
            if (effectiveSort === "stars") {
                return b.stars - a.stars;
            }
            if (effectiveSort === "likes") {
                return b.likes - a.likes;
            }
            if (effectiveSort === "latest") {
                const dateA = a.createdAt || "";
                const dateB = b.createdAt || "";
                return dateB.localeCompare(dateA) || b.id.localeCompare(a.id);
            }
            // "recommend" default sort
            return (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || b.views - a.views;
        });

        return result;
    }, [selectedCategory, viewFilter, sortOrder, debouncedQuery, subTab, followedCreators]);

    // Pagination slice
    const totalPages = Math.ceil(filteredVideos.length / ITEMS_PER_PAGE) || 1;
    const paginatedVideos = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredVideos.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredVideos, currentPage]);

    // G9: Smooth scroll targeting top of the grid without skipping cards
    const handlePageChange = (page: number) => {
        if (page < 1 || page > totalPages) return;
        setCurrentPage(page);
        const gridElem = document.getElementById("taptv-grid");
        const scrollRoot = document.getElementById("taptv-scroll-root");
        if (gridElem && scrollRoot) {
            const gridTop = gridElem.offsetTop - 80;
            scrollRoot.scrollTo({ top: Math.max(0, gridTop), behavior: "smooth" });
        } else if (scrollRoot) {
            scrollRoot.scrollTo({ top: 0, behavior: "smooth" });
        } else {
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    };

    // Hero Spotlight Video (First featured or top video)
    const heroVideo = useMemo(() => {
        return TAPTV_VIDEOS.find((v) => v.id === "taptv-01") || TAPTV_VIDEOS[0];
    }, []);

    const handlePublish = () => {
        navigate("/canvas");
    };

    return (
        <div id="taptv-scroll-root" className="fixed inset-0 overflow-y-auto bg-[#0a0a0a] text-white flex flex-col font-sans select-none" data-testid="taptv-page-root">
            {/* Top Navigation Header */}
            <AppStoreHeader activeNav="TapTV" />

            {/* Main Stage */}
            <main className="mx-auto w-full max-w-[1500px] px-4 sm:px-6 xl:px-9 pt-20 pb-16 flex flex-col gap-6 flex-1">
                {/* Secondary Sub-Navbar (Plaza / Academy + View Tabs + Search + Publish) */}
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between py-2 border-b border-white/[0.06]">
                    {/* Left: Plaza & Academy Dual Switcher */}
                    <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.06] border border-white/[0.08] w-fit shadow-sm">
                        <button
                            type="button"
                            onClick={() => {
                                setSubTab("plaza");
                                setCurrentPage(1);
                            }}
                            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer active:scale-95 ${subTab === "plaza" ? "bg-white text-black shadow-[0_2px_8px_rgba(0,0,0,0.3)]" : "text-zinc-300 hover:text-white hover:bg-white/10"}`}
                        >
                            <Tv className={`size-3.5 ${subTab === "plaza" ? "text-black" : "text-zinc-300"}`} strokeWidth={2.2} />
                            <span className={subTab === "plaza" ? "text-black" : "text-zinc-300"}>广场</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setSubTab("academy");
                                setSelectedCategory("全部");
                                setCurrentPage(1);
                                message.info("TapNow 智能体创意学院正在筹备中，包含 4K 分镜课、短剧实战营与 LoRA 微调教程！");
                            }}
                            className={`relative flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer active:scale-95 ${subTab === "academy" ? "bg-white text-black shadow-[0_2px_8px_rgba(0,0,0,0.3)]" : "text-zinc-300 hover:text-white hover:bg-white/10"}`}
                        >
                            <GraduationCap className={`size-3.5 ${subTab === "academy" ? "text-black" : "text-zinc-300"}`} strokeWidth={2.2} />
                            <span className={subTab === "academy" ? "text-black" : "text-zinc-300"}>学院</span>
                            {/* Blue Notification Dot */}
                            <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-white shadow-[0_0_6px_rgba(255, 255, 255, 0.55)]" />
                        </button>
                    </div>

                    {/* Middle: View Filter Tabs */}
                    <div className="flex items-center gap-1 sm:gap-4 overflow-x-auto no-scrollbar">
                        {[
                            { key: "curated", label: "编辑精选" },
                            { key: "following", label: "关注" },
                            { key: "trending", label: "热门推荐" },
                            { key: "latest", label: "最新发布" },
                        ].map((tab) => {
                            const isActive = viewFilter === tab.key;
                            return (
                                <button
                                    key={tab.key}
                                    type="button"
                                    onClick={() => {
                                        setViewFilter(tab.key as TapTvViewFilter);
                                        setCurrentPage(1);
                                    }}
                                    className={`relative py-2 px-2 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap active:scale-95 ${isActive ? "text-white font-semibold" : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] rounded-lg"}`}
                                >
                                    <span>{tab.label}</span>
                                    {isActive ? <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-[2px] rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]" /> : null}
                                </button>
                            );
                        })}
                    </div>

                    {/* Right: Search Input with Clear Button (G10) & Publish CTA */}
                    <div className="flex items-center gap-3">
                        <div className="relative flex items-center">
                            <Search className="absolute left-3 size-3.5 text-zinc-400 pointer-events-none" strokeWidth={2.2} />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setCurrentPage(1);
                                }}
                                placeholder="搜索作品、作者、模型..."
                                className="h-9 w-48 sm:w-60 rounded-full bg-white/[0.06] pl-9 pr-8 text-xs text-white placeholder-zinc-400 border border-white/[0.08] focus:border-white/30 focus:outline-none transition-colors shadow-sm"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearchQuery("");
                                        setCurrentPage(1);
                                    }}
                                    className="absolute right-2.5 flex size-4 items-center justify-center rounded-full bg-white/20 text-zinc-200 hover:bg-white/30 hover:text-white transition-colors cursor-pointer shadow-xs active:scale-90"
                                    title="清空搜索"
                                >
                                    <X className="size-2.5" strokeWidth={2.2} />
                                </button>
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={handlePublish}
                            className="flex items-center gap-1.5 h-9 px-4 rounded-full bg-white text-black text-xs font-semibold hover:bg-white/90 shadow-[0_2px_10px_rgba(255,255,255,0.15),0_4px_16px_rgba(0,0,0,0.4)] active:scale-95 transition-all cursor-pointer whitespace-nowrap"
                        >
                            <Plus className="size-3.5 text-black" strokeWidth={2.2} />
                            <span className="text-black">发布作品</span>
                        </button>
                    </div>
                </div>

                {/* Hero Spotlight Cinema Showcase (Displayed on Page 1 when not searching and on Plaza tab) */}
                {currentPage === 1 && !debouncedQuery && selectedCategory === "全部" && subTab === "plaza" && heroVideo && (
                    <div
                        onClick={() => setSelectedVideo(heroVideo)}
                        className="group relative w-full aspect-[21/9] sm:aspect-[2.4/1] max-h-[460px] rounded-2xl overflow-hidden bg-[#141414] border border-white/[0.08] cursor-pointer shadow-2xl select-none"
                        style={{
                            boxShadow: "0 20px 50px rgba(0, 0, 0, 0.7)",
                        }}
                    >
                        <img src={heroVideo.cover} alt={heroVideo.title} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-102" />

                        {/* Top Left Tag */}
                        <div className="absolute top-4 left-4 z-10 flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1 text-xs text-zinc-300 font-medium backdrop-blur-md border border-white/[0.14]">
                            <Sparkles className="size-3.5" strokeWidth={2.2} />
                            <span>今日聚光灯 · {heroVideo.badge}</span>
                        </div>

                        {/* Bottom Overlay Info (Solid translucent, strictly NO gradients) */}
                        <div className="absolute bottom-0 inset-x-0 z-10 bg-black/80 backdrop-blur-sm px-6 py-5 border-t border-white/[0.08] flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                            <div className="flex flex-col gap-1.5 max-w-2xl">
                                <span className="text-xs text-white/60">
                                    {heroVideo.creatorHandle} · {heroVideo.toolTag}
                                </span>
                                <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-white group-hover:text-white transition-colors">{heroVideo.title}</h2>
                                <p className="hidden sm:block text-xs text-white/70 line-clamp-2 leading-relaxed">{heroVideo.synopsis}</p>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setProcessVideo(heroVideo);
                                    }}
                                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/[0.12] border border-white/20 text-white hover:bg-white/[0.22] hover:border-white/35 shadow-[0_2px_12px_rgba(0,0,0,0.5)] active:scale-95 transition-all cursor-pointer backdrop-blur-md"
                                >
                                    <span>查看创作过程</span>
                                    <ArrowUpRight className="size-3.5 text-white/90" strokeWidth={2.2} />
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setSelectedVideo(heroVideo)}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-white text-black hover:bg-white/90 shadow-[0_4px_20px_rgba(0,0,0,0.55),0_1px_3px_rgba(0,0,0,0.2)] active:scale-95 transition-all cursor-pointer"
                                >
                                    <Play className="size-3.5 fill-black text-black" strokeWidth={2.2} />
                                    <span className="text-black">立即播放</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Horizontal Category Filter Pills & Sort Dropdown Row (G4 & G8) */}
                <div className="flex items-center justify-between gap-4">
                    {/* Left: Category Pills */}
                    <div className="flex items-center gap-2 overflow-x-auto py-1 no-scrollbar flex-1">
                        {TAPTV_CATEGORIES.map((cat) => {
                            const isSelected = selectedCategory === cat;
                            return (
                                <button
                                    key={cat}
                                    type="button"
                                    onClick={() => {
                                        setSelectedCategory(cat);
                                        setCurrentPage(1);
                                    }}
                                    className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all cursor-pointer active:scale-95 ${
                                        isSelected
                                            ? "bg-white text-black font-semibold shadow-[0_2px_10px_rgba(0,0,0,0.4)]"
                                            : "bg-white/[0.06] text-zinc-300 hover:text-white hover:bg-white/[0.12] border border-white/[0.08] hover:border-white/20 shadow-xs"
                                    }`}
                                >
                                    <span className={isSelected ? "text-black font-semibold" : "text-zinc-300"}>{cat}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Right: Sort/Order Filter Dropdown (G4) */}
                    <div className="relative shrink-0" ref={sortDropdownRef}>
                        <button
                            type="button"
                            onClick={() => setIsSortOpen(!isSortOpen)}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium bg-white/[0.06] border border-white/[0.08] text-zinc-200 hover:text-white hover:bg-white/[0.12] hover:border-white/20 shadow-sm active:scale-95 transition-all cursor-pointer whitespace-nowrap"
                            data-testid="taptv-sort-dropdown-trigger"
                        >
                            <SlidersHorizontal className="size-3 text-zinc-300" strokeWidth={2.2} />
                            <span>{SORT_OPTIONS.find((o) => o.key === sortOrder)?.label || "综合排序"}</span>
                            <ChevronDown className={`size-3 text-white/50 transition-transform duration-200 ${isSortOpen ? "rotate-180" : ""}`} strokeWidth={2.2} />
                        </button>
                        {isSortOpen && (
                            <div className="absolute right-0 top-full mt-1.5 w-40 rounded-xl bg-[#141416]/95 border border-white/[0.12] shadow-[0_16px_40px_rgba(0,0,0,0.7)] backdrop-blur-xl p-1 z-30 flex flex-col gap-0.5">
                                {SORT_OPTIONS.map((opt) => (
                                    <button
                                        key={opt.key}
                                        type="button"
                                        onClick={() => {
                                            setSortOrder(opt.key);
                                            setIsSortOpen(false);
                                            setCurrentPage(1);
                                        }}
                                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer active:scale-98 ${
                                            sortOrder === opt.key ? "bg-white/10 text-white font-semibold shadow-xs" : "text-zinc-300 hover:bg-white/[0.08] hover:text-white"
                                        }`}
                                    >
                                        <span>{opt.label}</span>
                                        {sortOrder === opt.key && <Check className="size-3 text-zinc-300" strokeWidth={2.2} />}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Video Grid (Responsive 4 Columns) with ID for G9 scroll target */}
                {paginatedVideos.length > 0 ? (
                    <div id="taptv-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5 scroll-mt-24">
                        {paginatedVideos.map((video) => (
                            <TapTvCard
                                key={video.id}
                                video={video}
                                onSelect={(v) => setSelectedVideo(v)}
                                onOpenProcess={(v, e) => {
                                    e.stopPropagation();
                                    setProcessVideo(v);
                                }}
                            />
                        ))}
                    </div>
                ) : (
                    <div id="taptv-grid" className="flex flex-col items-center justify-center py-20 text-center gap-3 bg-[#141414] rounded-2xl border border-white/[0.06]">
                        <Tv className="size-10 text-white/30" strokeWidth={2.2} />
                        <h3 className="text-base font-semibold text-white">暂未找到匹配的视频作品</h3>
                        <p className="text-xs text-white/50 max-w-sm">尝试清空搜索关键词或切换至其他分类标签查看更多精彩创作。</p>
                        <button
                            type="button"
                            onClick={() => {
                                setSearchQuery("");
                                setSelectedCategory("全部");
                                setSortOrder("recommend");
                            }}
                            className="mt-2 px-4 py-1.5 rounded-xl text-xs font-medium bg-white/10 text-white hover:bg-white/20 border border-white/15 shadow-sm active:scale-95 transition-all cursor-pointer"
                        >
                            重置所有筛选
                        </button>
                    </div>
                )}

                {/* Pagination Toolbar */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 pt-8 pb-4">
                        <button
                            type="button"
                            disabled={currentPage === 1}
                            onClick={() => handlePageChange(currentPage - 1)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.06] border border-white/[0.08] text-zinc-200 hover:bg-white/[0.14] hover:border-white/20 hover:text-white disabled:opacity-30 disabled:pointer-events-none shadow-sm active:scale-95 transition-all cursor-pointer"
                        >
                            <ChevronLeft className="size-3.5" strokeWidth={2.2} />
                            <span>上一页</span>
                        </button>

                        <div className="flex items-center gap-1">
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                                const isActive = page === currentPage;
                                return (
                                    <button
                                        key={page}
                                        type="button"
                                        onClick={() => handlePageChange(page)}
                                        className={`size-8 rounded-lg text-xs font-medium tabular-nums transition-all cursor-pointer active:scale-95 ${
                                            isActive ? "bg-white text-black font-semibold shadow-[0_2px_8px_rgba(0,0,0,0.35)]" : "bg-white/[0.04] text-zinc-300 hover:bg-white/10 hover:border-white/15 hover:text-white border border-white/[0.06] shadow-xs"
                                        }`}
                                    >
                                        <span className={isActive ? "text-black font-semibold" : "text-zinc-300"}>{page}</span>
                                    </button>
                                );
                            })}
                        </div>

                        <button
                            type="button"
                            disabled={currentPage === totalPages}
                            onClick={() => handlePageChange(currentPage + 1)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.06] border border-white/[0.08] text-zinc-200 hover:bg-white/[0.14] hover:border-white/20 hover:text-white disabled:opacity-30 disabled:pointer-events-none shadow-sm active:scale-95 transition-all cursor-pointer"
                        >
                            <span>下一页</span>
                            <ChevronRight className="size-3.5" strokeWidth={2.2} />
                        </button>
                    </div>
                )}
            </main>

            {/* Global Footer */}
            <AppStoreFooter />

            {/* Immersive Cinema Video Player Modal */}
            {selectedVideo && (
                <TapTvPlayerModal
                    video={selectedVideo}
                    onClose={() => setSelectedVideo(null)}
                    onOpenProcess={(v) => {
                        setSelectedVideo(null);
                        setProcessVideo(v);
                    }}
                    onSelectRelated={(v) => setSelectedVideo(v)}
                />
            )}

            {/* Creation Process / Canvas Attachments Modal */}
            {processVideo && <TapTvProcessModal video={processVideo} onClose={() => setProcessVideo(null)} />}
        </div>
    );
};
