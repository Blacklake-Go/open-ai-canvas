import React, { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { RefreshCw, Sparkles, AlertCircle, Layers, Film, Cpu, Music } from "lucide-react";
import type { WorkspaceRecoveryConfig, WorkspaceRecoveryStage } from "../types";
import { getNextRecoveryStage, getStageCopy, type StageTransitionEvent } from "./stage-state-machine";
import { checkSystemReducedMotion } from "../motion/motion-engine";

export type WorkspaceRecoveryAnimatorProps = {
    config: WorkspaceRecoveryConfig;
    activeStage?: WorkspaceRecoveryStage;
    onStageChange?: (stage: WorkspaceRecoveryStage) => void;
    onRetry?: () => void;
    onComplete?: () => void;
    interactivePreview?: boolean;
    className?: string;
};

export function WorkspaceRecoveryAnimator({
    config,
    activeStage: controlledStage,
    onStageChange,
    onRetry,
    onComplete,
    interactivePreview = false,
    className = "",
}: WorkspaceRecoveryAnimatorProps) {
    const [internalStage, setInternalStage] = useState<WorkspaceRecoveryStage>(controlledStage || "init");
    const currentStage = controlledStage ?? internalStage;

    const reducedMotion = useMemo(() => checkSystemReducedMotion(), []);

    // 自动超时保护 (依据配置中的 timeoutMs)
    useEffect(() => {
        if (currentStage === "ready" || currentStage === "failed") return;
        const timer = setTimeout(() => {
            const next = getNextRecoveryStage(currentStage, { type: "TIMEOUT" });
            setInternalStage(next);
            onStageChange?.(next);
        }, config.timeoutMs);
        return () => clearTimeout(timer);
    }, [currentStage, config.timeoutMs, onStageChange]);

    // 模拟或真实阶段推进 (仅在预览模式下自动演进)
    useEffect(() => {
        if (!interactivePreview) return;
        if (currentStage === "init") {
            const t = setTimeout(() => {
                const next = getNextRecoveryStage("init", { type: "AUTH_VERIFIED" });
                setInternalStage(next);
                onStageChange?.(next);
            }, 1200);
            return () => clearTimeout(t);
        } else if (currentStage === "recovering") {
            const t = setTimeout(() => {
                const next = getNextRecoveryStage("recovering", { type: "PROJECTS_SYNCED" });
                setInternalStage(next);
                onStageChange?.(next);
            }, 1600);
            return () => clearTimeout(t);
        } else if (currentStage === "syncing") {
            const t = setTimeout(() => {
                const next = getNextRecoveryStage("syncing", { type: "APP_READY" });
                setInternalStage(next);
                onStageChange?.(next);
                onComplete?.();
            }, 1800);
            return () => clearTimeout(t);
        }
    }, [currentStage, interactivePreview, onComplete, onStageChange]);

    const handleRetry = () => {
        setInternalStage("init");
        onStageChange?.("init");
        onRetry?.();
    };

    const copy = getStageCopy(currentStage, config);

    // 环形轨道节点数据
    const orbitNodes = useMemo(() => {
        const count = Math.max(3, Math.min(8, config.orbitNodesCount));
        return Array.from({ length: count }, (_, i) => ({
            id: i,
            angle: (i * 360) / count,
        }));
    }, [config.orbitNodesCount]);

    // 浮动 UI 卡片数据
    const floatingCards = useMemo(() => [
        { id: "canvas", icon: Layers, label: "Infinite Canvas", sub: "100+ Nodes Ready", x: -160, y: -110 },
        { id: "video", icon: Film, label: "Cinema Pipeline", sub: "Timeline Sync", x: 160, y: -90 },
        { id: "ai", icon: Cpu, label: "Model Cluster", sub: "Seedance & Veo", x: -170, y: 100 },
        { id: "audio", icon: Music, label: "Audio Studio", sub: "64-Band Waveform", x: 170, y: 90 },
    ].slice(0, Math.max(2, Math.min(4, config.floatingCardsCount))), [config.floatingCardsCount]);

    const gridDensityClass = {
        compact: "bg-[radial-gradient(#ffffff15_1px,transparent_1px)] [background-size:16px_16px]",
        normal: "bg-[radial-gradient(#ffffff20_1px,transparent_1px)] [background-size:24px_24px]",
        sparse: "bg-[radial-gradient(#ffffff25_1px,transparent_1px)] [background-size:36px_36px]",
    }[config.gridDensity];

    return (
        <div
            role="status"
            aria-live="polite"
            data-supdance-recovery-animator
            data-stage={currentStage}
            className={`relative flex h-full w-full min-h-[480px] flex-col items-center justify-center overflow-hidden bg-[#07080b] text-slate-100 select-none ${gridDensityClass} ${className}`}
        >
            {/* 柔和背景环境光晕 (Ambient Glow) */}
            <div
                className="pointer-events-none absolute h-[500px] w-[500px] rounded-full blur-[110px] transition-all duration-700"
                style={{
                    background: currentStage === "failed"
                        ? "radial-gradient(circle, rgba(239, 68, 68, 0.28) 0%, rgba(0,0,0,0) 70%)"
                        : `radial-gradient(circle, rgba(56, 189, 248, ${config.glowIntensity * 0.35}) 0%, rgba(225, 29, 116, ${config.glowIntensity * 0.2}) 50%, rgba(0,0,0,0) 75%)`,
                }}
            />

            {/* 舞台核心区域 */}
            <div className="relative flex h-[360px] w-[360px] items-center justify-center">
                {/* 环形运动轨道 (Orbital Rings) */}
                <motion.div
                    animate={reducedMotion ? {} : { rotate: 360 }}
                    transition={{
                        repeat: Infinity,
                        duration: 20 / (config.orbitSpeed || 1.0),
                        ease: "linear",
                    }}
                    className="absolute h-[280px] w-[280px] rounded-full border border-sky-400/20"
                >
                    {/* 轨道上的卫星节点 (Orbital Nodes) */}
                    {orbitNodes.map((node) => {
                        const rad = (node.angle * Math.PI) / 180;
                        const r = 140; // radius
                        const cx = 140 + r * Math.cos(rad);
                        const cy = 140 + r * Math.sin(rad);
                        return (
                            <span
                                key={node.id}
                                className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-400 shadow-[0_0_8px_#38bdf8]"
                                style={{ left: `${cx}px`, top: `${cy}px` }}
                            />
                        );
                    })}
                </motion.div>

                {/* 反向微旋转内轨道 */}
                <motion.div
                    animate={reducedMotion ? {} : { rotate: -360 }}
                    transition={{
                        repeat: Infinity,
                        duration: 32 / (config.orbitSpeed || 1.0),
                        ease: "linear",
                    }}
                    className="absolute h-[200px] w-[200px] rounded-full border border-dashed border-rose-500/25"
                />

                {/* 浮动 UI 卡片组 (Floating Cards) */}
                <AnimatePresence>
                    {currentStage !== "init" && floatingCards.map((card, idx) => (
                        <motion.div
                            key={card.id}
                            initial={{ opacity: 0, scale: 0.8, x: card.x * 0.6, y: card.y * 0.6 }}
                            animate={{
                                opacity: 0.88,
                                scale: 1,
                                x: card.x,
                                y: card.y,
                                transition: {
                                    duration: 0.6,
                                    delay: idx * 0.1,
                                    ease: [0.16, 1, 0.3, 1],
                                },
                            }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            className="absolute flex items-center gap-2.5 rounded-xl border border-white/10 bg-black/60 px-3.5 py-2 backdrop-blur-md shadow-xl"
                        >
                            <card.icon className="h-4 w-4 text-sky-400" />
                            <div className="flex flex-col text-left">
                                <span className="text-xs font-medium text-slate-200">{card.label}</span>
                                <span className="text-[10px] text-slate-400">{card.sub}</span>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>

                {/* 中央品牌 Logo 与核心呼吸光环 */}
                <motion.div
                    animate={reducedMotion ? {} : { scale: [1, 1.04, 1] }}
                    transition={{ repeat: Infinity, duration: 3.2, ease: "easeInOut" }}
                    className="relative z-10 flex h-24 w-24 items-center justify-center rounded-2xl border border-white/15 bg-slate-900/90 shadow-2xl backdrop-blur-xl"
                >
                    {config.brandLogoUrl ? (
                        <img
                            src={config.brandLogoUrl}
                            alt={config.brandName}
                            className="h-12 w-12 object-contain"
                            onError={(e) => {
                                (e.target as HTMLElement).style.display = "none";
                            }}
                        />
                    ) : (
                        <Sparkles className="h-10 w-10 text-sky-400" />
                    )}
                </motion.div>
            </div>

            {/* 状态文案与辅助详情 */}
            <div className="relative z-20 mt-6 flex max-w-md flex-col items-center px-4 text-center">
                <motion.h3
                    key={copy.title}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="text-base font-semibold tracking-wide text-slate-100 sm:text-lg"
                >
                    {copy.title}
                </motion.h3>

                <motion.p
                    key={copy.detail}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                    className="mt-1.5 text-xs leading-relaxed text-slate-400 sm:text-sm"
                >
                    {copy.detail}
                </motion.p>

                {/* 加载指示器或重试按钮 */}
                <div className="mt-5 flex items-center justify-center">
                    {currentStage === "failed" ? (
                        <button
                            type="button"
                            onClick={handleRetry}
                            className="flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-xs font-medium text-white shadow-lg transition-transform hover:bg-rose-500 active:scale-95"
                        >
                            <RefreshCw className="h-3.5 w-3.5" />
                            重试工作区恢复
                        </button>
                    ) : (
                        <div className="flex items-center gap-1.5" aria-hidden="true">
                            <span className="h-2 w-2 animate-bounce rounded-full bg-sky-400" style={{ animationDelay: "0ms" }} />
                            <span className="h-2 w-2 animate-bounce rounded-full bg-sky-400" style={{ animationDelay: "150ms" }} />
                            <span className="h-2 w-2 animate-bounce rounded-full bg-sky-400" style={{ animationDelay: "300ms" }} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
