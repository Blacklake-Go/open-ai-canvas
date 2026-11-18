import React, { useState, useEffect, useRef } from "react";
import { ArrowLeft, Check, Sparkles, ChevronDown, ExternalLink, Play, Pause, Volume2 } from "lucide-react";
import { useNavigate } from "react-router";
import type { AppDetailSpec } from "./app-store-types";
import { isAppInstalled, toggleAppInstalled } from "./app-store-data";
import { resolveAppIcon } from "./app-store-icons";

interface AppStoreDetailProps {
    spec: AppDetailSpec;
    onBack: () => void;
}

export const AppStoreDetail: React.FC<AppStoreDetailProps> = ({ spec, onBack }) => {
    const navigate = useNavigate();
    const [activeTabId, setActiveTabId] = useState(spec.previewTabs[0]?.id || "");
    const [addedToAgent, setAddedToAgent] = useState(() => isAppInstalled(spec.id));
    const [isPlayingAudio, setIsPlayingAudio] = useState(false);
    const [audioProgress, setAudioProgress] = useState(0);
    const audioContextRef = useRef<AudioContext | null>(null);
    const oscillatorRef = useRef<OscillatorNode | null>(null);
    const gainNodeRef = useRef<GainNode | null>(null);

    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        你需要提供什么: true,
        它是如何工作的: true,
        你将获得什么: true,
        适用范围与边界: false,
        接下来还可以怎么做: false,
    });

    // Synchronize installation status when spec changes
    useEffect(() => {
        setAddedToAgent(isAppInstalled(spec.id));
    }, [spec.id]);

    const handleToggleInstall = () => {
        const next = toggleAppInstalled(spec.id);
        setAddedToAgent(next);
    };

    const activeTab = spec.previewTabs.find((t) => t.id === activeTabId) || spec.previewTabs[0];

    const toggleSection = (title: string) => {
        setExpandedSections((prev) => ({
            ...prev,
            [title]: !prev[title],
        }));
    };

    const startAudio = () => {
        try {
            const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            const ctx = new AudioCtx();
            audioContextRef.current = ctx;

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = "sine";
            osc.frequency.setValueAtTime(220, ctx.currentTime);

            // Subtle 5Hz vibrato
            const lfo = ctx.createOscillator();
            lfo.frequency.setValueAtTime(5, ctx.currentTime);
            const lfoGain = ctx.createGain();
            lfoGain.gain.setValueAtTime(12, ctx.currentTime);
            lfo.connect(osc.frequency);
            lfo.start();

            gain.gain.setValueAtTime(0.001, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.07, ctx.currentTime + 0.1);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();

            oscillatorRef.current = osc;
            gainNodeRef.current = gain;
            setIsPlayingAudio(true);
        } catch {
            setIsPlayingAudio(true);
        }
    };

    const stopAudio = () => {
        if (gainNodeRef.current && audioContextRef.current) {
            try {
                gainNodeRef.current.gain.exponentialRampToValueAtTime(0.0001, audioContextRef.current.currentTime + 0.08);
            } catch {}
        }
        setTimeout(() => {
            try {
                oscillatorRef.current?.stop();
                audioContextRef.current?.close();
            } catch {}
            audioContextRef.current = null;
            oscillatorRef.current = null;
            gainNodeRef.current = null;
        }, 100);
        setIsPlayingAudio(false);
        setAudioProgress(0);
    };

    // Clean up audio on unmount or tab switch
    useEffect(() => {
        return () => {
            try {
                oscillatorRef.current?.stop();
                audioContextRef.current?.close();
            } catch {}
        };
    }, []);

    // Progress counter while playing audio
    useEffect(() => {
        let interval: NodeJS.Timeout | null = null;
        if (isPlayingAudio) {
            interval = setInterval(() => {
                setAudioProgress((prev) => {
                    if (prev >= 100) {
                        stopAudio();
                        return 0;
                    }
                    return prev + 5;
                });
            }, 550);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isPlayingAudio]);

    const isVoiceTab = activeTab?.id === "voice" || activeTab?.label.includes("声音") || activeTab?.title.includes("声音");
    const HeaderIcon = resolveAppIcon(spec.name, spec.id);

    return (
        <div className="w-full pb-20 select-none animate-fadeIn">
            {/* Top Back Navigation Bar */}
            <div className="mb-6 flex items-center">
                <button
                    type="button"
                    onClick={onBack}
                    className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-white/80 bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.1] hover:border-white/20 hover:text-white shadow-sm active:scale-95 transition-all cursor-pointer"
                >
                    <ArrowLeft className="size-4" strokeWidth={2.2} />
                    <span>返回应用列表</span>
                </button>
            </div>

            {/* Main Content Layout: Left 70%, Right 30% */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
                {/* Left Column (Main Information) */}
                <div className="lg:col-span-8 flex flex-col gap-10">
                    {/* Header: Icon + Title + Subtitle + Tags */}
                    <div>
                        <div className="flex items-center gap-4 mb-4">
                            <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white/[0.05] border border-white/[0.10] text-zinc-300 shadow-sm">
                                <HeaderIcon className="size-7" strokeWidth={2.2} />
                            </div>
                            <div>
                                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">{spec.name}</h1>
                                <span className="inline-block mt-1 text-xs font-medium text-zinc-300 bg-white/[0.06] border border-white/[0.10] rounded-full px-2.5 py-0.5">企业级 AI 生产力工坊</span>
                            </div>
                        </div>

                        <p className="text-base text-white/80 leading-relaxed max-w-2xl">{spec.subtitle}</p>

                        {/* Tags */}
                        <div className="mt-4 flex flex-wrap gap-2">
                            {spec.tags.map((tag) => (
                                <span key={tag} className="rounded-full bg-white/[0.045] px-3 py-1 text-xs text-white/70">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Section: 能力预览 (Interactive Tabs & Media Figure) */}
                    <section className="rounded-2xl bg-white/[0.035] p-6 sm:p-8">
                        <div className="mb-6">
                            <div className="flex items-center gap-2 mb-1">
                                <Sparkles className="size-4 text-zinc-300" strokeWidth={2.2} />
                                <h2 className="text-lg font-semibold tracking-tight text-zinc-50">{spec.previewTitle}</h2>
                            </div>
                            <p className="text-sm text-zinc-300">{spec.previewDescription}</p>
                        </div>

                        {/* Tabs Bar */}
                        <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-6 border-b border-white/[0.06] no-scrollbar">
                            {spec.previewTabs.map((tab) => {
                                const isActive = tab.id === activeTab?.id;
                                return (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => {
                                            setActiveTabId(tab.id);
                                            stopAudio();
                                        }}
                                        className="px-3.5 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all cursor-pointer active:scale-95"
                                        style={{
                                            backgroundColor: isActive ? "#ffffff" : "rgba(255, 255, 255, 0.06)",
                                            color: isActive ? "#000000" : "rgba(255, 255, 255, 0.8)",
                                            border: isActive ? "1px solid rgba(255, 255, 255, 0.9)" : "1px solid rgba(255, 255, 255, 0.08)",
                                            boxShadow: isActive ? "0 2px 10px rgba(0, 0, 0, 0.35)" : "0 1px 3px rgba(0, 0, 0, 0.2)",
                                        }}
                                    >
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Active Tab Preview Display */}
                        {activeTab ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                                {/* Media Container */}
                                <div className="aspect-[4/3] rounded-2xl overflow-hidden border border-white/10 bg-black/50 shadow-inner flex flex-col justify-center relative group">
                                    {isVoiceTab ? (
                                        /* Audio Player Card with Waveform & 0:00 / 0:11 */
                                        <div className="p-6 flex flex-col items-center justify-center text-center gap-4">
                                            <div className="size-16 rounded-full bg-white/[0.08] border border-white/10 flex items-center justify-center text-zinc-300">
                                                <Volume2 className="size-8" strokeWidth={2.2} />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-semibold text-white mb-1">角色原生音色演播片段</h4>
                                                <span className="text-xs font-mono text-white/50">{isPlayingAudio ? `0:0${Math.floor((audioProgress / 100) * 11)} · 0:11` : "0:00 · 0:11 03 声音"}</span>
                                            </div>

                                            {/* Audio Waveform Bars */}
                                            <div className="flex items-center gap-1 h-8 w-44">
                                                {[40, 65, 30, 85, 95, 45, 75, 100, 60, 40, 80, 50, 70, 90, 35].map((h, idx) => (
                                                    <div
                                                        key={idx}
                                                        className={`flex-1 rounded-full transition-all duration-300 ${isPlayingAudio ? "bg-white/80" : "bg-white/20"}`}
                                                        style={{
                                                            height: isPlayingAudio ? `${Math.max(15, (h * (audioProgress % 40)) / 25)}%` : `${h}%`,
                                                        }}
                                                    />
                                                ))}
                                            </div>

                                            {/* Audio Play Button */}
                                            <button
                                                type="button"
                                                onClick={() => (isPlayingAudio ? stopAudio() : startAudio())}
                                                className="inline-flex items-center gap-2 rounded-full bg-white text-black px-4 py-2 text-xs font-semibold hover:bg-white/90 active:scale-95 transition-all cursor-pointer shadow-[0_4px_14px_rgba(0,0,0,0.4)] border border-white/20"
                                            >
                                                {isPlayingAudio ? (
                                                    <>
                                                        <Pause className="size-3.5 fill-black text-black" strokeWidth={2.2} />
                                                        <span className="text-black">暂停播放</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Play className="size-3.5 fill-black text-black" strokeWidth={2.2} />
                                                        <span className="text-black">播放声音试听</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    ) : (
                                        <img src={activeTab.imageUrl || "/short-drama-styles/wuxia-swordsman.jpg"} alt={activeTab.title} className="size-full object-cover transition-transform duration-500 group-hover:scale-105" />
                                    )}
                                </div>

                                <div className="flex flex-col justify-center">
                                    {activeTab.tag ? <span className="text-xs font-mono text-zinc-300 uppercase tracking-widest mb-2">{activeTab.tag}</span> : null}
                                    <h3 className="text-xl font-bold tracking-tight text-zinc-50 mb-2">{activeTab.title}</h3>
                                    <p className="text-sm text-zinc-300 leading-relaxed mb-4">{activeTab.description}</p>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            navigate(spec.primaryActionUrl || "/canvas");
                                        }}
                                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold text-zinc-300 bg-white/[0.06] border border-white/[0.10] hover:bg-white/[0.12] hover:border-white/25 hover:text-white shadow-xs active:scale-95 transition-all cursor-pointer w-fit"
                                    >
                                        <span>在画布中立即尝试该能力</span>
                                        <ExternalLink className="size-3.5" strokeWidth={2.2} />
                                    </button>
                                </div>
                            </div>
                        ) : null}
                    </section>

                    {/* Section: 从一个用例开始 */}
                    <section>
                        <div className="mb-4">
                            <h2 className="text-lg font-semibold tracking-tight text-zinc-50">从一个用例开始</h2>
                            <p className="text-xs sm:text-sm text-zinc-400">选择一个具体结果，让 Agent 先迈出第一步。</p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {spec.starters.map((starter) => (
                                <button
                                    key={starter.id}
                                    type="button"
                                    onClick={() => {
                                        navigate(spec.primaryActionUrl || "/canvas");
                                    }}
                                    className="group rounded-2xl bg-[#131316] border border-white/[0.08] p-4 text-left hover:bg-[#19191f] hover:border-white/[0.2] hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(0,0,0,0.45)] active:scale-[0.99] transition-all cursor-pointer flex flex-col justify-between shadow-[0_4px_16px_rgba(0,0,0,0.25)] select-none"
                                >
                                    <div>
                                        <span className="inline-block rounded-full bg-white/[0.08] px-2.5 py-0.5 text-[10px] font-medium text-zinc-300 mb-2">{starter.category}</span>
                                        <h3 className="text-sm font-bold text-zinc-50 group-hover:text-white transition-colors">{starter.title}</h3>
                                        <p className="mt-2 text-xs text-zinc-300 leading-relaxed line-clamp-3">{starter.description}</p>
                                    </div>
                                    <span className="mt-4 text-xs font-semibold text-zinc-400 group-hover:text-white transition-colors flex items-center gap-1">开始执行 &rarr;</span>
                                </button>
                            ))}
                        </div>
                    </section>

                    {/* Section: Detail Accordions */}
                    <div className="flex flex-col gap-2">
                        {spec.sections.map((sec) => {
                            const isExpanded = expandedSections[sec.title];
                            return (
                                <div key={sec.title} className="rounded-2xl bg-[#131316] border border-white/[0.08] overflow-hidden">
                                    <button
                                        type="button"
                                        onClick={() => toggleSection(sec.title)}
                                        className="w-full flex items-center justify-between p-4 sm:p-5 text-left text-sm sm:text-base font-semibold text-zinc-50 hover:bg-white/[0.04] active:bg-white/[0.06] transition-colors cursor-pointer border-0 select-none"
                                    >
                                        <span>{sec.title}</span>
                                        <ChevronDown className={`size-4 text-zinc-400 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} strokeWidth={2.2} />
                                    </button>
                                    {isExpanded ? (
                                        <div className="px-5 pb-5 pt-1 border-t border-white/[0.06]">
                                            <ul className="space-y-2.5">
                                                {sec.items.map((item, i) => (
                                                    <li key={i} className="text-xs sm:text-sm text-zinc-300 leading-relaxed flex items-start gap-2">
                                                        <span className="size-1.5 rounded-full bg-white/70 shrink-0 mt-1.5" />
                                                        <span>{item}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    ) : null}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Right Sticky Sidebar (Single Unified Button Matching TapNow Production) */}
                <div className="lg:col-span-4 sticky top-24">
                    <div className="rounded-2xl bg-[#131316] border border-white/[0.1] p-6 sm:p-8 flex flex-col gap-6 shadow-2xl shadow-black/60">
                        <div>
                            <span className="text-xs font-mono text-zinc-300 uppercase tracking-widest block mb-1">快捷接入</span>
                            <h3 className="text-lg font-bold text-zinc-50 leading-snug">{spec.sidebarCta}</h3>
                            <p className="mt-2 text-xs text-zinc-300 leading-relaxed">添加后，智能体将自动加载此应用下的全部预设工作流与算子。在对话或画布中随时一键调取。</p>
                        </div>

                        {/* Single Unified Action CTA Button */}
                        <div className="flex flex-col gap-2">
                            <button
                                type="button"
                                onClick={handleToggleInstall}
                                className={`h-11 w-full rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                                    addedToAgent
                                        ? "bg-white/[0.10] text-zinc-300 border border-white/[0.16] shadow-[0_0_16px_rgba(255, 255, 255, 0.12)] active:scale-95"
                                        : "bg-white text-black hover:bg-white/90 active:scale-95 shadow-[0_4px_16px_rgba(0,0,0,0.4),0_1px_3px_rgba(0,0,0,0.2)] border border-white/20 hover:shadow-[0_6px_22px_rgba(255,255,255,0.2)]"
                                }`}
                            >
                                {addedToAgent ? (
                                    <>
                                        <Check className="size-4 text-zinc-300" strokeWidth={2.2} />
                                        <span className="text-zinc-300">已添加至当前 Agent</span>
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="size-4 text-black" strokeWidth={2.2} />
                                        <span className="text-black">添加到 Agent</span>
                                    </>
                                )}
                            </button>

                            <div className="text-center pt-1">
                                <button
                                    type="button"
                                    onClick={() => navigate(spec.primaryActionUrl || "/canvas")}
                                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium text-white/70 bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] hover:border-white/20 hover:text-white shadow-xs active:scale-95 transition-all cursor-pointer"
                                >
                                    <span>在独立画布中启动该工具</span>
                                    <ExternalLink className="size-3" strokeWidth={2.2} />
                                </button>
                            </div>
                        </div>

                        {/* Feature Badges */}
                        <div className="pt-4 border-t border-white/[0.08] space-y-2 text-xs text-zinc-400">
                            <div className="flex items-center gap-2">
                                <Check className="size-3.5 text-zinc-300" strokeWidth={2.2} />
                                <span>支持多角度人物一致性锁定</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Check className="size-3.5 text-zinc-300" strokeWidth={2.2} />
                                <span>无限节点画布连线与时间线交互</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Check className="size-3.5 text-zinc-300" strokeWidth={2.2} />
                                <span>最高 4K 超清影视画质渲染输出</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
