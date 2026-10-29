import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Music, RefreshCw, History, Disc3, Sparkles } from "lucide-react";
import { Segmented, Tooltip } from "antd";
import { useUserStore } from "@/stores/use-user-store";
import { useI18n } from "@/supdance/plugins/i18n";
import { WorkspacePage } from "@/components/layout/workspace-page";
import { useWorkspaceTopBarMount } from "@/components/layout/workspace-top-bar-extension";
import { useMusicStore } from "../stores/use-music-store";
import { MusicForm } from "../components/music-form";
import { MusicMasterStage } from "../components/music-master-stage";
import { TaskCard } from "../components/task-card";
import "../styles/music-workbench.css";

export default function MusicWorkbenchPage() {
    const { t } = useI18n();
    const user = useUserStore((state) => state.user);
    const userId = user?.id || "guest";
    const topBarMount = useWorkspaceTopBarMount();

    const [mobileTab, setMobileTab] = useState<"generate" | "master" | "tasks">("generate");

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

    // 全站顶栏右侧挂载动作按钮（零内部 Header 规范）
    const topBarAction = (
        <div className="flex items-center gap-2">
            <Tooltip title={t("music.refresh_works", undefined, "刷新音乐作品列表")}>
                <button
                    type="button"
                    onClick={() => void loadTasks()}
                    className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border/60 bg-background/80 hover:bg-muted text-xs font-medium text-foreground transition-colors"
                    aria-label="刷新作品"
                >
                    <RefreshCw className={`size-3.5 ${loadingTasks ? "animate-spin" : ""}`} />
                    <span className="hidden sm:inline">{t("music.refresh_works", undefined, "刷新作品")}</span>
                </button>
            </Tooltip>
        </div>
    );

    return (
        <WorkspacePage fluid scroll={false} className="workbench-page music-workbench-page">
            {topBarMount ? createPortal(topBarAction, topBarMount) : null}

            <div className="music-workbench-shell">
                {/* 移动端视图切换 Tabs */}
                <div className="music-mobile-tabs">
                    <Segmented
                        block
                        value={mobileTab}
                        onChange={(val) => setMobileTab(val as "generate" | "master" | "tasks")}
                        options={[
                            { label: "创作参数", value: "generate" },
                            { label: "母带舞台", value: "master" },
                            { label: `历史作品 (${tasks.length})`, value: "tasks" },
                        ]}
                    />
                </div>

                {/* 标准三栏工作台架构 */}
                <div className="music-workbench-columns">
                    {/* 第一栏：左侧参数生成配置 */}
                    <section
                        className={`music-input-column ${mobileTab === "generate" ? "is-mobile-active" : ""}`}
                        aria-label="创作参数"
                    >
                        <div className="music-composer-panel">
                            <div className="music-panel-head">
                                <div className="music-panel-title">
                                    <Sparkles className="size-4 text-emerald-500" />
                                    <span>{t("music.create_new", undefined, "创作新音乐")}</span>
                                </div>
                                <span className="text-xs text-muted-foreground">
                                    {t("music.auto_save_tip", undefined, "草稿自动加密暂存")}
                                </span>
                            </div>

                            <MusicForm userId={userId} />
                        </div>
                    </section>

                    {/* 第二栏：中央母带大舞台 */}
                    <div className={mobileTab === "master" ? "is-mobile-active" : ""}>
                        <MusicMasterStage />
                    </div>

                    {/* 第三栏：右侧历史作品抽屉 */}
                    <aside
                        className={`music-task-column ${mobileTab === "tasks" ? "is-mobile-active" : ""}`}
                        aria-label="我的作品与历史"
                    >
                        <div className="music-history-panel">
                            <div className="music-panel-head">
                                <div className="music-panel-title">
                                    <History className="size-4 text-primary" />
                                    <span>{t("music.my_works", undefined, "我的音乐作品")}</span>
                                </div>
                                <span className="text-xs text-muted-foreground tabular-nums">
                                    共 {tasks.length} 首
                                </span>
                            </div>

                            {loadingTasks && tasks.length === 0 ? (
                                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 p-12 text-center text-muted-foreground my-auto">
                                    <Disc3 className="size-8 animate-spin opacity-40 mb-2" />
                                    <p className="text-sm">正在加载创作历史...</p>
                                </div>
                            ) : tasks.length === 0 ? (
                                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 p-12 text-center text-muted-foreground my-auto">
                                    <Music className="size-10 opacity-30 mb-2" />
                                    <p className="text-sm font-medium">暂无生成的音乐作品</p>
                                    <p className="text-xs text-muted-foreground/80 mt-1">
                                        在左侧表单中输入描述并点击“立即生成音乐”开启创作
                                    </p>
                                </div>
                            ) : (
                                <div className="music-history-list">
                                    {tasks.map((task) => (
                                        <TaskCard key={task.taskId || task.id} task={task} />
                                    ))}
                                </div>
                            )}
                        </div>
                    </aside>
                </div>
            </div>
        </WorkspacePage>
    );
}
