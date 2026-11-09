import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router";
import { App, InputNumber } from "antd";
import { BookMarked, Boxes, Bug, CheckCircle2, Cloud, Globe, Inbox, Link2, MessageSquareText, Moon, RadioTower, SlidersHorizontal, Sparkles, Sun, UserRound, Workflow, X, Laptop } from "lucide-react";

import { AppModal } from "@/components/ui/product/app-modal";
import { Switch } from "@/components/ui/base/switch";
import { Select } from "@/components/ui/base/select";
import { SettingsRow } from "@/components/ui/product/settings-row";
import { UserAvatar } from "@/components/layout/user-avatar";
import { UserOSSSettingsForm } from "@/components/layout/user-oss-settings-form";
import { RUNNINGHUB_PLUGIN_ID } from "@/lib/plugins/builtin/workflows";
import { defaultConfig, useConfigStore, useEffectiveConfig } from "@/stores/use-config-store";
import { selectPluginEffectivelyEnabled, usePluginStore } from "@/stores/use-plugin-store";
import { useThemeStore } from "@/stores/use-theme-store";
import { useUserStore } from "@/stores/use-user-store";
import { useUserProfileModalStore, restoreUserProfileModalFocus, type UserProfileModalTab, USER_PROFILE_MODAL_EVENT } from "@/stores/use-user-profile-modal-store";
import { LanguageOptionGrid } from "@/components/layout/language-menu";
import { useI18n } from "@/supdance/plugins/i18n";
import { SocialAccountBindings } from "@/supdance/plugins/social-auth/components/social-account-bindings";

import { ChannelSettingsPane } from "@/pages/settings/channel-settings-pane";
import { ModelDefaultGrid } from "@/pages/settings/model-default-grid";
import { PromptPreferencesPane } from "@/pages/settings/prompt-preferences-pane";
import { RunningHubSettingsPane } from "@/pages/settings/runninghub-settings-pane";
import AgentMemoryPane from "@/pages/settings/agent-memory-pane";
import DiagnosticsPanel from "@/pages/settings/diagnostics-panel";
import { FeedbackInboxPane } from "@/pages/settings/feedback-inbox-pane";
import { ProfilePane } from "@/pages/settings/profile-pane";

function normalizeImageCount(value: string | number): string {
    const num = Math.min(Math.max(Number(value) || 1, 1), 15);
    return String(Math.floor(num));
}

interface NavSection {
    group: string;
    items: Array<{
        key: UserProfileModalTab;
        label: string;
        description: string;
        icon: ReactNode;
    }>;
}

/** 社交登录是热插拔插件：管理员停用后，账号管理分组里不应再出现「第三方账号」入口。 */
function accountManagementItems(socialAuthEnabled: boolean): NavSection["items"] {
    const items: NavSection["items"] = [
        {
            key: "profile",
            label: "基本资料与安全",
            description: "头像、身份与账户安全",
            icon: <UserRound className="size-4" />,
        },
        {
            key: "social",
            label: "第三方账号",
            description: "社交授权绑定与换绑",
            icon: <Link2 className="size-4" />,
        },
    ];
    return socialAuthEnabled ? items : items.filter((item) => item.key !== "social");
}

export function UserProfileModalHost() {
    const isOpen = useUserProfileModalStore((state) => state.isOpen);
    const activeTab = useUserProfileModalStore((state) => state.activeTab);
    const setTab = useUserProfileModalStore((state) => state.setTab);
    const closeModal = useUserProfileModalStore((state) => state.closeModal);
    const openModal = useUserProfileModalStore((state) => state.openModal);
    const currentUser = useUserStore((state) => state.user);
    const { search } = useLocation();

    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            openModal(detail?.tab || "profile");
        };
        window.addEventListener(USER_PROFILE_MODAL_EVENT, handler);
        return () => window.removeEventListener(USER_PROFILE_MODAL_EVENT, handler);
    }, [openModal]);

    useEffect(() => {
        const openSettings = new URLSearchParams(search).get("open_settings");
        if (openSettings) openModal(openSettings as UserProfileModalTab);
    }, [openModal, search]);

    if (!currentUser) return null;

    return <UserProfileModal open={isOpen} activeTab={activeTab === "security" ? "profile" : activeTab} onTabChange={setTab} onClose={closeModal} />;
}

export interface UserProfileModalProps {
    open: boolean;
    activeTab: UserProfileModalTab;
    onTabChange: (tab: UserProfileModalTab) => void;
    onClose: () => void;
    searchParams?: URLSearchParams;
}

export function UserProfileModal({ open, activeTab, onTabChange, onClose, searchParams }: UserProfileModalProps) {
    const { message } = App.useApp();
    const { t } = useI18n();
    const currentUser = useUserStore((state) => state.user);
    const customChannelsEnabled = useUserStore((state) => state.features.customChannelsEnabled);
    const runtimeStatuses = usePluginStore((state) => state.runtimeStatuses);
    const runningHubPluginEnabled = runtimeStatuses[RUNNINGHUB_PLUGIN_ID] === "enabled";
    const socialAuthPluginEnabled = usePluginStore(selectPluginEffectivelyEnabled("supdance-social-auth", true));
    const returnParams = new URLSearchParams(useLocation().search);
    const hasSocialReturn = returnParams.has("bind_success") || returnParams.has("bind_error");

    const config = useConfigStore((state) => state.config);
    const effectiveConfig = useEffectiveConfig();
    const updateConfig = useConfigStore((state) => state.updateConfig);

    const theme = useThemeStore((state) => state.theme);
    const setTheme = useThemeStore((state) => state.setTheme);
    // 首次访问没有记录时跟随当前生效主题，避免「界面是浅色、选择器却显示深色」的不一致。
    const [themeMode, setThemeMode] = useState<"light" | "dark" | "system">(() => {
        try {
            const stored = localStorage.getItem("yingce:theme_mode");
            if (stored === "light" || stored === "dark" || stored === "system") return stored;
        } catch {}
        return theme;
    });

    const handleThemeModeChange = (mode: "light" | "dark" | "system") => {
        setThemeMode(mode);
        try {
            localStorage.setItem("yingce:theme_mode", mode);
        } catch {}
        if (mode === "system") {
            const prefersDark = typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
            setTheme(prefersDark ? "dark" : "light");
        } else {
            setTheme(mode);
        }
    };

    useEffect(() => {
        if (themeMode !== "system") return;
        const media = window.matchMedia("(prefers-color-scheme: dark)");
        const updateTheme = () => setTheme(media.matches ? "dark" : "light");
        updateTheme();
        media.addEventListener("change", updateTheme);
        return () => media.removeEventListener("change", updateTheme);
    }, [themeMode, setTheme]);

    const currentTab = activeTab === "security" ? "profile" : activeTab;

    const navSections: NavSection[] = useMemo(() => {
        const accountItems = [
            {
                key: "profile" as const,
                label: t("settings.tab_profile", undefined, "基本资料与安全"),
                description: t("settings.tab_profile_desc", undefined, "头像、身份与账户安全"),
                icon: <UserRound className="size-4" />,
            },
            ...(socialAuthPluginEnabled
                ? [
                      {
                          key: "social" as const,
                          label: t("settings.tab_social", undefined, "第三方账号"),
                          description: t("settings.tab_social_desc", undefined, "社交授权绑定与换绑"),
                          icon: <Link2 className="size-4" />,
                      },
                  ]
                : []),
        ];
        const sections: NavSection[] = [
            {
                group: t("settings.group_account", undefined, "账号管理"),
                items: accountItems,
            },
            {
                group: t("settings.group_creative", undefined, "创作设置"),
                items: [
                    {
                        key: "models",
                        label: t("settings.tab_models", undefined, "模型选择"),
                        description: t("settings.tab_models_desc", undefined, "按领域选择默认模型"),
                        icon: <Boxes className="size-4" />,
                    },
                    ...(customChannelsEnabled
                        ? [
                              {
                                  key: "channels" as const,
                                  label: t("settings.tab_channels", undefined, "个人渠道"),
                                  description: t("settings.tab_channels_desc", undefined, "模型服务与工作流"),
                                  icon: <RadioTower className="size-4" />,
                              },
                          ]
                        : []),
                    ...(runningHubPluginEnabled
                        ? [
                              {
                                  key: "runninghub" as const,
                                  label: t("settings.tab_runninghub", undefined, "RunningHub"),
                                  description: t("settings.tab_runninghub_desc", undefined, "个人云端工作流配置"),
                                  icon: <Workflow className="size-4" />,
                              },
                          ]
                        : []),
                    {
                        key: "generation",
                        label: t("settings.tab_generation", undefined, "生成偏好"),
                        description: t("settings.tab_generation_desc", undefined, "画布生成默认值"),
                        icon: <SlidersHorizontal className="size-4" />,
                    },
                    {
                        key: "prompts",
                        label: t("settings.tab_prompts", undefined, "提示词偏好"),
                        description: t("settings.tab_prompts_desc", undefined, "按任务定制模板"),
                        icon: <MessageSquareText className="size-4" />,
                    },
                    {
                        key: "agent-memory",
                        label: t("settings.tab_agent_memory", undefined, "Agent 记忆"),
                        description: t("settings.tab_agent_memory_desc", undefined, "经验与偏好记忆"),
                        icon: <BookMarked className="size-4" />,
                    },
                ],
            },
            {
                group: t("settings.group_system", undefined, "系统与偏好"),
                items: [
                    {
                        key: "preferences",
                        label: t("settings.tab_preferences", undefined, "个性偏好"),
                        description: t("settings.tab_preferences_desc", undefined, "深浅外观与语言界面"),
                        icon: <SlidersHorizontal className="size-4" />,
                    },
                    {
                        key: "storage",
                        label: t("settings.tab_storage", undefined, "我的对象存储"),
                        description: t("settings.tab_storage_desc", undefined, "管理个人媒体存储"),
                        icon: <Cloud className="size-4" />,
                    },
                    {
                        key: "diagnostics",
                        label: t("settings.tab_diagnostics", undefined, "问题诊断"),
                        description: t("settings.tab_diagnostics_desc", undefined, "导出日志协助排查"),
                        icon: <Bug className="size-4" />,
                    },
                    {
                        key: "feedbacks",
                        label: t("settings.tab_feedbacks", undefined, "我的反馈"),
                        description: t("settings.tab_feedbacks_desc", undefined, "意见建议与官方答复"),
                        icon: <Inbox className="size-4" />,
                    },
                ],
            },
        ];
        return sections;
    }, [customChannelsEnabled, runningHubPluginEnabled, socialAuthPluginEnabled, t]);

    const allItems = useMemo(() => navSections.flatMap((s) => s.items), [navSections]);
    const currentMeta = allItems.find((item) => item.key === currentTab) || allItems[0];

    return (
        <AppModal open={open} flush closable={false} footer={null} width={1240} centered onCancel={onClose} afterClose={restoreUserProfileModalFocus}>
            <div
                className="relative flex h-[850px] max-h-[92vh] w-full overflow-hidden rounded-2xl border border-border bg-card text-foreground shadow-2xl backdrop-blur-2xl"
                style={{
                    backgroundImage: "radial-gradient(ellipse 70% 40% at 70% -10%, color-mix(in srgb, var(--primary) 8%, transparent), transparent)",
                }}
            >
                {/* Left Navigation Sidebar */}
                <aside className="hidden w-72 shrink-0 flex-col border-r border-border bg-surface-subtle/40 p-4 sm:p-5 lg:flex">
                    {/* Header Branding */}
                    <div className="mb-5 flex items-center gap-3 px-2 pt-1">
                        <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                            <Sparkles className="size-4.5" />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-foreground">{t("settings.profile_modal_title", undefined, "个人与创作设置")}</h3>
                            <p className="text-[var(--fs-label)] text-foreground/45">SupDance Studio</p>
                        </div>
                    </div>

                    {/* Navigation Groups */}
                    <nav className="thin-scrollbar flex-1 space-y-4 overflow-y-auto pr-1" aria-label={t("settings.nav_aria", undefined, "设置导航")}>
                        {navSections.map((sec) => (
                            <div key={sec.group} className="space-y-1">
                                <div className="px-3 pb-1 text-[var(--fs-label)] font-semibold text-foreground/35">{sec.group}</div>
                                {sec.items.map((tab) => {
                                    const isActive = currentTab === tab.key;
                                    return (
                                        <button
                                            key={tab.key}
                                            type="button"
                                            onClick={() => onTabChange(tab.key)}
                                            className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left transition-all ${
                                                isActive ? "border border-primary/30 bg-primary/10 text-primary shadow-sm font-medium" : "border border-transparent text-foreground/70 hover:bg-surface-hover hover:text-foreground"
                                            }`}
                                        >
                                            <span className={isActive ? "text-primary" : "text-foreground/40"}>{tab.icon}</span>
                                            <div className="min-w-0 flex-1">
                                                <div className="text-xs font-medium leading-snug">{tab.label}</div>
                                                <div className="mt-0.5 truncate text-[var(--fs-label)] text-foreground/40 leading-none">{tab.description}</div>
                                            </div>
                                            {isActive && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
                                        </button>
                                    );
                                })}
                            </div>
                        ))}
                    </nav>

                    {/* Footer Identity Card */}
                    <div className="mt-auto border-t border-border pt-3">
                        <div className="flex items-center gap-2.5 rounded-xl bg-surface-subtle px-2 py-1.5 border border-border/50">
                            {currentUser && <UserAvatar user={currentUser} className="size-8 shrink-0 rounded-full" />}
                            <div className="min-w-0 flex-1">
                                <div className="truncate text-xs font-semibold text-foreground">{currentUser?.displayName || currentUser?.username}</div>
                                <div className="truncate font-mono text-[var(--fs-label)] text-foreground/40">@{currentUser?.username}</div>
                            </div>
                        </div>
                    </div>
                </aside>

                {/* Right Content Pane */}
                <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
                    {/* Header Bar */}
                    <header className="flex shrink-0 flex-col gap-3 border-b border-border bg-surface-subtle/30 px-4 py-3 sm:px-6 lg:px-8">
                        <div className="flex min-w-0 items-center justify-between gap-3">
                            <div className="min-w-0">
                                <h2 className="text-base font-semibold text-foreground">{currentMeta?.label}</h2>
                                <p className="mt-0.5 text-xs text-foreground/50">{currentMeta?.description}</p>
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex size-11 shrink-0 items-center justify-center rounded-lg text-foreground/40 transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                                aria-label={t("settings.close_modal_aria", undefined, "关闭设置浮窗")}
                            >
                                <X className="size-4" />
                            </button>
                        </div>
                        <div className="lg:hidden">
                            <Select<UserProfileModalTab>
                                ariaLabel={t("settings.nav_aria", undefined, "设置导航")}
                                value={currentTab}
                                onChange={onTabChange}
                                size="large"
                                className="min-h-11 w-full"
                                virtual={false}
                                styles={{ popup: { listItem: { minHeight: "calc(var(--spacing) * 11)" } } }}
                                options={navSections.map((section) => ({
                                    label: section.group,
                                    options: section.items.map((item) => ({ value: item.key, label: item.label })),
                                }))}
                            />
                        </div>
                    </header>

                    {/* Content Body */}
                    <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
                        {currentTab === "profile" && <ProfilePane key={currentUser?.id} returnToModal={!searchParams} />}
                        {currentTab === "social" && (socialAuthPluginEnabled || hasSocialReturn) && <SocialAccountBindings returnToModal={!searchParams} />}
                        {currentTab === "models" && <ModelDefaultGrid config={effectiveConfig} onChange={(key, model) => updateConfig(key, model)} />}
                        {currentTab === "channels" && <ChannelSettingsPane onOpenModels={() => onTabChange("models")} onOpenRunningHub={runningHubPluginEnabled ? () => onTabChange("runninghub") : undefined} />}
                        {currentTab === "runninghub" && <RunningHubSettingsPane />}
                        {currentTab === "generation" && (
                            <div className="space-y-4">
                                <section className="settings-preference-block">
                                    <div className="settings-preference-heading">
                                        <h3 className="text-sm font-semibold text-foreground">{t("settings.canvas_gen_defaults", undefined, "画布生成默认值")}</h3>
                                        <p className="text-xs text-foreground/50">{t("settings.canvas_gen_defaults_desc", undefined, "用于新建图片生成任务，节点内仍可单独覆盖。")}</p>
                                    </div>
                                    <SettingsRow
                                        label={t("settings.default_canvas_image_count", undefined, "默认生图张数")}
                                        control={
                                            <InputNumber
                                                min={1}
                                                max={15}
                                                precision={0}
                                                className="w-full"
                                                value={Number(config.canvasImageCount)}
                                                onChange={(value) => updateConfig("canvasImageCount", normalizeImageCount(String(value ?? defaultConfig.canvasImageCount)))}
                                            />
                                        }
                                        controlClassName="w-[200px]"
                                    />
                                </section>
                            </div>
                        )}
                        {currentTab === "prompts" && <PromptPreferencesPane />}
                        {currentTab === "agent-memory" && <AgentMemoryPane />}
                        {currentTab === "storage" && <UserOSSSettingsForm />}
                        {currentTab === "diagnostics" && <DiagnosticsPanel taskId={searchParams?.get("taskId") || undefined} projectId={searchParams?.get("projectId") || undefined} />}
                        {currentTab === "feedbacks" && <FeedbackInboxPane />}
                        {currentTab === "preferences" && (
                            <div className="space-y-6">
                                {/* Theme Appearance Selection with 3 Modes */}
                                <div className="space-y-3 rounded-xl border border-border bg-surface-subtle p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="flex size-9 items-center justify-center rounded-lg border border-border bg-card">{theme === "dark" ? <Moon className="size-4 text-primary" /> : <Sun className="size-4 text-amber-500" />}</div>
                                            <div>
                                                <div className="text-xs font-semibold text-foreground">{t("settings.preferences.theme_title", {}, "外观偏好")}</div>
                                                <div className="text-[var(--fs-label)] text-foreground/50">{t("settings.preferences.theme_desc", {}, "深色模式、浅色模式与跟随系统自动切换")}</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 3-Pill High-Visibility Segmented Selector */}
                                    <div className="grid grid-cols-3 gap-2 pt-1">
                                        {[
                                            { mode: "light", label: t("settings.preferences.theme_light", {}, "浅色模式"), icon: <Sun className="size-4 text-amber-500" /> },
                                            { mode: "dark", label: t("settings.preferences.theme_dark", {}, "深色模式"), icon: <Moon className="size-4 text-primary" /> },
                                            { mode: "system", label: t("settings.preferences.theme_system", {}, "跟随系统"), icon: <Laptop className="size-4 text-foreground/60" /> },
                                        ].map((opt) => {
                                            const isSelected = themeMode === opt.mode;
                                            return (
                                                <button
                                                    key={opt.mode}
                                                    type="button"
                                                    onClick={() => handleThemeModeChange(opt.mode as "light" | "dark" | "system")}
                                                    className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 px-3 text-xs font-medium transition-all ${
                                                        isSelected
                                                            ? "border-primary bg-primary/10 text-primary shadow-sm ring-1 ring-primary/40 font-semibold"
                                                            : "border-border bg-card text-foreground/75 hover:border-border hover:bg-surface-hover hover:text-foreground"
                                                    }`}
                                                >
                                                    {opt.icon}
                                                    <span>{opt.label}</span>
                                                    {isSelected && <CheckCircle2 className="size-3.5 text-primary ml-0.5" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Language Selection */}
                                <div className="space-y-3 rounded-xl border border-border bg-surface-subtle p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="flex size-9 items-center justify-center rounded-lg border border-border bg-card">
                                            <Globe className="size-4 text-primary" />
                                        </div>
                                        <div>
                                            <div className="text-xs font-semibold text-foreground">{t("settings.preferences.i18n_title", undefined, "多语言界面")}</div>
                                            <div className="text-[var(--fs-label)] text-foreground/50">{t("settings.preferences.i18n_desc", undefined, "全站界面与文案实时多语言切换")}</div>
                                        </div>
                                    </div>
                                    <LanguageOptionGrid />
                                </div>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </AppModal>
    );
}
