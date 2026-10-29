import React, { useEffect, useState } from "react";
import { Music, RefreshCw, History, Disc3, Sparkles } from "lucide-react";
import { useUserStore } from "@/stores/use-user-store";
import { useI18n } from "@/supdance/plugins/i18n";
import { useMusicStore } from "../stores/use-music-store";
import { MusicForm } from "../components/music-form";
import { TaskCard } from "../components/task-card";
import "../styles/music-generation.css";

export default function MusicWorkbenchPage() {
    const { t } = useI18n();
    const user = useUserStore((state) => state.user);
    const userId = user?.id || "guest";

    const {
        loadCapabilities,
        loadTasks,
        loadUserDraft,
        tasks,
        loadingTasks,
    } = useMusicStore();

    useEffect(() => {
        void loadCapabilities();
        void loadTasks();
        if (userId) {
            void loadUserDraft(userId);
        }
    }, [userId]);

    return (
        <div className="plugin-music-generation min-h-screen bg-background text-foreground">
            {/* Topbar Header */}
            <header className="border-b border-border/60 bg-card/60 px-6 py-4 backdrop-blur-md sticky top-0 z-10">
                <div className="mx-auto flex max-w-7xl items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                            <Music className="size-5" />
                        </span>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight text-foreground">
                                {t("music.studio_title", undefined, "AI 音乐创作岛 (Music Studio)")}
                            </h1>
                            <p className="text-xs text-muted-foreground">
                                {t("music.studio_desc", undefined, "集成 Mureka V9.5、Suno v6、Google Lyria 3.5 与 Eleven Music v2.5 前沿音频大模型")}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => void loadTasks()}
                            className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                        >
                            <RefreshCw className={`size-3.5 ${loadingTasks ? "animate-spin" : ""}`} />
                            <span>{t("music.refresh_works", undefined, "刷新作品")}</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content Workbench */}
            <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
                    {/* Left Panel: Generation Form (7 cols on desktop) */}
                    <div className="lg:col-span-7">
                        <div className="rounded-2xl border border-border/60 bg-card/80 p-6 shadow-sm backdrop-blur-xs">
                            <div className="mb-6 flex items-center justify-between border-b border-border/40 pb-3">
                                <div className="flex items-center gap-2">
                                    <Sparkles className="size-4 text-primary" />
                                    <h2 className="font-semibold text-base text-foreground">{t("music.create_new", undefined, "创作新音乐")}</h2>
                                </div>
                                <span className="text-xs text-muted-foreground">{t("music.auto_save_tip", undefined, "草稿自动本地加密保存")}</span>
                            </div>

                            <MusicForm userId={userId} />
                        </div>
                    </div>

                    {/* Right Panel: Music Generation History (5 cols on desktop) */}
                    <div className="lg:col-span-5">
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <History className="size-4 text-primary" />
                                    <h2 className="font-semibold text-base text-foreground">{t("music.my_works", undefined, "我的音乐作品")}</h2>
                                </div>
                                <span className="text-xs text-muted-foreground">
                                    共 {tasks.length} 首歌曲
                                </span>
                            </div>

                            {loadingTasks && tasks.length === 0 ? (
                                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 p-12 text-center text-muted-foreground">
                                    <Disc3 className="size-8 animate-spin opacity-40 mb-2" />
                                    <p className="text-sm">正在加载创作历史...</p>
                                </div>
                            ) : tasks.length === 0 ? (
                                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 p-12 text-center text-muted-foreground">
                                    <Music className="size-10 opacity-30 mb-2" />
                                    <p className="text-sm font-medium">暂无生成的音乐作品</p>
                                    <p className="text-xs text-muted-foreground/80 mt-1">
                                        在左侧表单中输入描述并点击“立即生成音乐”开启你的 AI 音乐之旅
                                    </p>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-3">
                                    {tasks.map((task) => (
                                        <TaskCard key={task.taskId || task.id} task={task} />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
