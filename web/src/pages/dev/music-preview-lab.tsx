import { useEffect, useMemo, useState } from "react";
import { Moon, Sun } from "lucide-react";

import { CreationMessageView } from "@/pages/create/creation-workspace-messages";
import type { CreationMessage } from "@/pages/create/creation-types";
import { useThemeStore } from "@/stores/use-theme-store";

function createDynamicSynthWavUrl(durationSeconds: number, baseFreq: number): string {
    const sampleRate = 16000;
    const totalSamples = Math.floor(sampleRate * durationSeconds);
    const buffer = new ArrayBuffer(44 + totalSamples * 2);
    const view = new DataView(buffer);

    const writeString = (offset: number, text: string) => {
        for (let i = 0; i < text.length; i += 1) {
            view.setUint8(offset + i, text.charCodeAt(i));
        }
    };

    writeString(0, "RIFF");
    view.setUint32(4, 36 + totalSamples * 2, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, "data");
    view.setUint32(40, totalSamples * 2, true);

    for (let i = 0; i < totalSamples; i += 1) {
        const t = i / sampleRate;
        // 构造节奏起伏与前奏/副歌/尾奏包络，使解码后的声波具有真实高低错落
        const beat = Math.abs(Math.sin(Math.PI * t * 1.8));
        const phrase = 0.35 + 0.65 * Math.pow(Math.sin((Math.PI * t) / durationSeconds), 0.7) * (0.45 + 0.55 * beat);
        const fade = Math.min(1, t / 0.15) * Math.min(1, (durationSeconds - t) / 0.4);
        const tone =
            0.5 * Math.sin(2 * Math.PI * baseFreq * t) +
            0.3 * Math.sin(2 * Math.PI * baseFreq * 1.25 * t) +
            0.2 * Math.sin(2 * Math.PI * baseFreq * 1.5 * t);
        const sample = Math.max(-1, Math.min(1, tone * phrase * fade * 0.45));
        view.setInt16(44 + i * 2, Math.round(sample * 32767), true);
    }

    const blob = new Blob([buffer], { type: "audio/wav" });
    return URL.createObjectURL(blob);
}

const noop = () => {};

export default function MusicPreviewLab() {
    const theme = useThemeStore((s) => s.theme);
    const setTheme = useThemeStore((s) => s.setTheme);
    const [urls, setUrls] = useState<{ single: string; trackA: string; trackB: string } | null>(null);

    useEffect(() => {
        const single = createDynamicSynthWavUrl(18, 220);
        const trackA = createDynamicSynthWavUrl(14, 261.63);
        const trackB = createDynamicSynthWavUrl(22, 196);
        setUrls({ single, trackA, trackB });
        return () => {
            URL.revokeObjectURL(single);
            URL.revokeObjectURL(trackA);
            URL.revokeObjectURL(trackB);
        };
    }, []);

    const scenarios = useMemo(() => {
        if (!urls) return [];
        const createdAt = "2026-11-16T03:43:00.000Z";
        const singlePrompt: CreationMessage = {
            id: "dev-user-1",
            role: "user",
            mode: "music",
            content: "雨夜霓虹街头的 Lo-Fi 钢琴与轻爵士鼓点，柔和治愈氛围",
            createdAt,
        };
        const singleAssistant: CreationMessage = {
            id: "dev-assistant-1",
            role: "assistant",
            mode: "music",
            content: "音乐已生成",
            model: "CHANNEL_000002::suno-v6",
            status: "done",
            createdAt,
            taskIds: ["dev-task-1"],
            resultUrls: [urls.single],
            settings: {
                ratio: "1:1",
                seconds: "180",
                quality: "auto",
                videoQuality: "720",
                count: "1",
                title: "雨夜霓虹 Lo-Fi",
                duration: "180",
                instrumental: true,
                model: "CHANNEL_000002::suno-v6",
            },
        };

        const multiPrompt: CreationMessage = {
            id: "dev-user-2",
            role: "user",
            mode: "music",
            content: "历史遗留标题修复 + 双音轨变体：赛博都市电音序曲，强节奏合成器",
            createdAt,
        };
        const multiAssistant: CreationMessage = {
            id: "dev-assistant-2",
            role: "assistant",
            mode: "music",
            // 模拟历史数据中曾错误写入的“图片已生成”，验证自动回退提示词摘要
            content: "图片已生成",
            model: "CHANNEL_000002::suno-v6",
            status: "done",
            createdAt,
            taskIds: ["dev-task-2"],
            resultUrls: [urls.trackA, urls.trackB],
            settings: {
                ratio: "1:1",
                seconds: "120",
                quality: "auto",
                videoQuality: "720",
                count: "1",
            },
        };

        const pendingAssistant: CreationMessage = {
            id: "dev-assistant-3",
            role: "assistant",
            mode: "music",
            content: "",
            model: "CHANNEL_000002::suno-v6",
            status: "pending",
            generationStatus: "running",
            generationStage: "synthesizing",
            generationProgress: 64,
            createdAt: new Date(Date.now() - 18_000).toISOString(),
            taskIds: ["dev-task-3"],
            settings: {
                ratio: "1:1",
                seconds: "120",
                quality: "auto",
                videoQuality: "720",
                count: "1",
                duration: "120",
                instrumental: true,
            },
        };

        return [
            { label: "单曲完成态（含真实解码声波与播放交互）", user: singlePrompt, assistant: singleAssistant },
            { label: "多音轨完成态 + 历史「图片已生成」占位词自动清洗回退", user: multiPrompt, assistant: multiAssistant },
            { label: "音乐生成中（Pending → Done 尺寸平滑对齐）", user: null, assistant: pendingAssistant },
        ];
    }, [urls]);

    return (
        <div className="creation-home min-h-screen flex flex-col">
            <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border/60 bg-background/85 px-6 py-3 backdrop-blur-md">
                <div className="flex flex-col gap-0.5">
                    <strong className="text-sm font-semibold text-foreground">生成岛 · 音乐生成结果 UI 预览实验室</strong>
                    <span className="text-xs text-muted-foreground">supdance-music-generation v1.4.0 · 真实 .creation-home 与 CreationMusicCard 组件</span>
                </div>
                <button
                    type="button"
                    className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
                    onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                >
                    {theme === "dark" ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
                    <span>{theme === "dark" ? "切换浅色模式" : "切换深色模式"}</span>
                </button>
            </header>

            <main className="creation-thread-scroll flex-1">
                <section className="creation-thread-stage">
                    <div className="creation-results">
                        {scenarios.map((scenario) => (
                            <div key={scenario.assistant.id} className="mb-10">
                                <div className="mb-4 text-xs font-medium text-muted-foreground">{scenario.label}</div>
                                {scenario.user ? (
                                    <CreationMessageView
                                        item={scenario.user}
                                        shotNumber={0}
                                        onRetryFailure={noop}
                                        onRefreshResult={noop}
                                        onRecoverMedia={noop}
                                        onCreateVariant={noop}
                                        onEditUserMessage={noop}
                                        onContinueCanvas={noop}
                                        openingCanvas={false}
                                    />
                                ) : null}
                                <CreationMessageView
                                    item={scenario.assistant}
                                    promptMessage={scenario.user || undefined}
                                    shotNumber={0}
                                    onRetryFailure={noop}
                                    onRefreshResult={noop}
                                    onRecoverMedia={noop}
                                    onCreateVariant={noop}
                                    onEditUserMessage={noop}
                                    onContinueCanvas={noop}
                                    openingCanvas={false}
                                />
                            </div>
                        ))}
                    </div>
                </section>
            </main>
        </div>
    );
}
