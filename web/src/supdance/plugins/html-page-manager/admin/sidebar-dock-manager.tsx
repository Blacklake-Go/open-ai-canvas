import { Alert, App, Button, Input, Select, Spin } from "antd";
import { AdminSwitch as Switch } from "@/pages/admin/ui/controls";
import { ArrowDown, ArrowUp, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { DEFAULT_HTML_SIDEBAR_DOCK_CONFIG, DEFAULT_HTML_SITE_FOOTER_CONFIG, fetchAdminHtmlPagesOverview, resetAdminHtmlSidebarDock, saveAdminHtmlSidebarDock } from "../api";
import { DockSocialSvg, SidebarEcosystemDock } from "../components/sidebar-ecosystem-dock";
import type { HtmlSidebarDockCard, HtmlSidebarDockConfig, HtmlSiteFooterConfig } from "../types";
import "./sidebar-dock-manager.css";

const ALL_LOCALES = [
    { code: "zh-CN", name: "简体中文" },
    { code: "en-US", name: "English" },
    { code: "zh-TW", name: "繁體中文" },
    { code: "es-ES", name: "Español" },
    { code: "fr-FR", name: "Français" },
    { code: "de-DE", name: "Deutsch" },
    { code: "ja-JP", name: "日本語" },
    { code: "ko-KR", name: "한국어" },
];

const ICON_OPTIONS = [
    { value: "about", label: "关于 (Info)" },
    { value: "pricing", label: "定价 (Pricing)" },
    { value: "mcp", label: "MCP 协议" },
    { value: "skills", label: "技能库" },
    { value: "plugins", label: "插件中心" },
    { value: "docs", label: "文档" },
    { value: "community", label: "社区" },
];

const TARGET_OPTIONS = [
    { value: "_top", label: "整页跳转 (_top)" },
    { value: "_self", label: "SPA 内跳转" },
    { value: "_blank", label: "新窗口 (_blank)" },
];

export default function SidebarDockManager() {
    const { message } = App.useApp();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [draft, setDraft] = useState<HtmlSidebarDockConfig>(DEFAULT_HTML_SIDEBAR_DOCK_CONFIG);
    const [siteFooter, setSiteFooter] = useState<HtmlSiteFooterConfig>(DEFAULT_HTML_SITE_FOOTER_CONFIG);
    const [expandedI18nId, setExpandedI18nId] = useState<string | null>(null);
    const [previewCollapsed, setPreviewCollapsed] = useState(false);
    const [previewTheme, setPreviewTheme] = useState<"dark" | "light">("dark");

    useEffect(() => {
        let active = true;
        setLoading(true);
        void fetchAdminHtmlPagesOverview()
            .then((res) => {
                if (!active) return;
                if (res.sidebarDock) setDraft(res.sidebarDock);
                if (res.siteFooter) setSiteFooter(res.siteFooter);
            })
            .catch((err: unknown) => {
                if (!active) return;
                message.error(err instanceof Error ? err.message : "加载侧边栏停靠区配置失败");
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
        };
    }, [message]);

    const updateCard = (index: number, patch: Partial<HtmlSidebarDockCard>) => {
        setDraft((prev) => {
            const cards = [...prev.cards];
            cards[index] = { ...cards[index], ...patch };
            return { ...prev, cards };
        });
    };

    const moveCard = (index: number, delta: -1 | 1) => {
        const target = index + delta;
        if (target < 0 || target >= draft.cards.length) return;
        setDraft((prev) => {
            const cards = [...prev.cards];
            const [moved] = cards.splice(index, 1);
            cards.splice(target, 0, moved);
            return { ...prev, cards: cards.map((item, i) => ({ ...item, order: i + 1 })) };
        });
    };

    const addCard = () => {
        setDraft((prev) => {
            if (prev.cards.length >= 6) return prev;
            const nextOrder = prev.cards.length + 1;
            return {
                ...prev,
                cards: [
                    ...prev.cards,
                    {
                        id: `card-${Date.now()}`,
                        icon: "skills",
                        href: "/skills",
                        target: "_self",
                        visible: true,
                        order: nextOrder,
                        defaultLabel: "技能",
                        labels: {
                            "zh-CN": "技能",
                            "en-US": "Skills",
                            "zh-TW": "技能",
                            "es-ES": "Skills",
                            "fr-FR": "Skills",
                            "de-DE": "Skills",
                            "ja-JP": "スキル",
                            "ko-KR": "스킬",
                        },
                    },
                ],
            };
        });
    };

    const removeCard = (index: number) => {
        if (draft.cards.length <= 1) return;
        setDraft((prev) => {
            const cards = prev.cards.filter((_, i) => i !== index).map((item, i) => ({ ...item, order: i + 1 }));
            return { ...prev, cards };
        });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const overview = await saveAdminHtmlSidebarDock(draft);
            if (overview.sidebarDock) setDraft(overview.sidebarDock);
            message.success("侧边栏停靠区配置已保存并热更新至工作台");
        } catch (err: unknown) {
            message.error(err instanceof Error ? err.message : "保存失败");
        } finally {
            setSaving(false);
        }
    };

    const handleReset = async () => {
        setSaving(true);
        try {
            const overview = await resetAdminHtmlSidebarDock();
            if (overview.sidebarDock) setDraft(overview.sidebarDock);
            message.success("已恢复官方默认停靠区配置");
        } catch (err: unknown) {
            message.error(err instanceof Error ? err.message : "重置失败");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Spin tip="正在加载侧边栏停靠区配置…" />
            </div>
        );
    }

    return (
        <div className="sd-admin-mgr">
            <div className="sd-admin-col">
                <section className="sd-admin-panel">
                    <div className="sd-admin-panel-head">
                        <h3 className="sd-admin-panel-title">侧边栏生态停靠区热插拔控制</h3>
                        <span className="text-xs opacity-60">插件作用域：supdance-html-page-manager</span>
                    </div>

                    <Alert type="info" showIcon className="mb-3" message="开启后工作台侧边栏底部将挂载「3 格生态快链 + 5 枚官方社媒图标」；关闭此开关或在插件管理禁用插件时，停靠区会立即热卸载并自动恢复原有「定价表」导航分组。" />

                    <div className="sd-admin-switch-row">
                        <div>
                            <div className="text-ui font-medium">启用侧边栏生态停靠区</div>
                            <div className="text-xs opacity-65">控制全站工作台侧边栏底部停靠区是否热挂载。</div>
                        </div>
                        <Switch aria-label="启用侧边栏生态停靠区" checked={draft.enabled} onChange={(checked) => setDraft((prev) => ({ ...prev, enabled: checked }))} />
                    </div>

                    <div className="sd-admin-switch-row">
                        <div>
                            <div className="text-ui font-medium">自动收起中部孤立「定价表」导航分组</div>
                            <div className="text-xs opacity-65">启用停靠区时隐藏中部孤立的定价表分组，释放历史会话列表空间；卸载插件后自动恢复。</div>
                        </div>
                        <Switch aria-label="自动收起中部孤立定价表分组" checked={draft.hideStandalonePricingGroup} onChange={(checked) => setDraft((prev) => ({ ...prev, hideStandalonePricingGroup: checked }))} />
                    </div>

                    <div className="sd-admin-switch-row">
                        <div>
                            <div className="text-ui font-medium">显示横向「分享激励」卡片</div>
                            <div className="text-xs opacity-65">在生态快链与社媒图标之间展示横向分享激励卡片，点击弹出分享赢积分浮窗。</div>
                        </div>
                        <Switch aria-label="显示横向分享激励卡片" checked={!draft.hideIncentiveCard} onChange={(checked) => setDraft((prev) => ({ ...prev, hideIncentiveCard: !checked }))} />
                    </div>
                </section>

                <section className="sd-admin-panel">
                    <div className="sd-admin-panel-head">
                        <h3 className="sd-admin-panel-title">生态快链卡片（展示前 3 项启用卡片）</h3>
                        <Button size="small" icon={<Plus className="size-3.5" />} onClick={addCard} disabled={draft.cards.length >= 6}>
                            新增卡片
                        </Button>
                    </div>

                    {draft.cards.map((card, idx) => {
                        const i18nOpen = expandedI18nId === card.id;
                        return (
                            <div key={card.id} className="sd-admin-card-item">
                                <div className="sd-admin-card-grid">
                                    <Select size="small" value={card.icon} options={ICON_OPTIONS} onChange={(val) => updateCard(idx, { icon: val })} />
                                    <Input size="small" value={card.href} placeholder="/html/about" onChange={(e) => updateCard(idx, { href: e.target.value })} />
                                    <Select size="small" value={card.target} options={TARGET_OPTIONS} onChange={(val) => updateCard(idx, { target: val })} />
                                    <div className="flex items-center gap-1.5">
                                        <Button size="small" icon={<ArrowUp className="size-3.5" />} disabled={idx === 0} onClick={() => moveCard(idx, -1)} />
                                        <Button size="small" icon={<ArrowDown className="size-3.5" />} disabled={idx === draft.cards.length - 1} onClick={() => moveCard(idx, 1)} />
                                        <Button size="small" onClick={() => setExpandedI18nId(i18nOpen ? null : card.id)}>
                                            {i18nOpen ? "收起语种" : "8 语种"}
                                        </Button>
                                        <Button size="small" danger icon={<Trash2 className="size-3.5" />} disabled={draft.cards.length <= 1} onClick={() => removeCard(idx)} />
                                        <Switch size="sm" aria-label={`启用卡片 ${card.id}`} checked={card.visible} onChange={(checked) => updateCard(idx, { visible: checked })} />
                                    </div>
                                </div>

                                {i18nOpen ? (
                                    <div className="sd-admin-i18n-grid">
                                        {ALL_LOCALES.map((loc) => (
                                            <div key={loc.code}>
                                                <label className="sd-admin-i18n-label">{loc.name}</label>
                                                <Input
                                                    size="small"
                                                    value={card.labels?.[loc.code] || ""}
                                                    onChange={(e) =>
                                                        updateCard(idx, {
                                                            labels: { ...card.labels, [loc.code]: e.target.value },
                                                        })
                                                    }
                                                />
                                            </div>
                                        ))}
                                    </div>
                                ) : null}
                            </div>
                        );
                    })}
                </section>

                <section className="sd-admin-panel">
                    <div className="sd-admin-panel-head">
                        <h3 className="sd-admin-panel-title">社交媒体图标栏（单行最多 5 枚）</h3>
                        <Switch aria-label="启用社交媒体图标栏" checked={draft.socialEnabled} onChange={(checked) => setDraft((prev) => ({ ...prev, socialEnabled: checked }))} />
                    </div>

                    <div className="sd-admin-switch-row mb-3">
                        <div>
                            <div className="text-ui font-medium">同步全站「site-footer」官方链接</div>
                            <div className="text-xs opacity-65">开启后社媒地址直接沿用页脚管理器数据，这里仅控制显隐勾选。</div>
                        </div>
                        <Switch aria-label="同步全站 site-footer 社媒链接" checked={draft.syncWithSiteFooter} onChange={(checked) => setDraft((prev) => ({ ...prev, syncWithSiteFooter: checked }))} />
                    </div>

                    {draft.socialLinks.map((item, idx) => (
                        <div key={item.id} className="sd-admin-social-row">
                            <DockSocialSvg id={item.id} size={16} />
                            <span className="truncate text-xs font-medium">{item.name}</span>
                            <Input
                                size="small"
                                disabled={draft.syncWithSiteFooter}
                                value={item.href}
                                onChange={(e) => {
                                    const href = e.target.value;
                                    setDraft((prev) => {
                                        const socialLinks = [...prev.socialLinks];
                                        socialLinks[idx] = { ...socialLinks[idx], href };
                                        return { ...prev, socialLinks };
                                    });
                                }}
                            />
                            <Switch
                                size="sm"
                                aria-label={`启用社媒 ${item.name}`}
                                checked={item.visible}
                                onChange={(checked) =>
                                    setDraft((prev) => {
                                        const socialLinks = [...prev.socialLinks];
                                        socialLinks[idx] = { ...socialLinks[idx], visible: checked };
                                        return { ...prev, socialLinks };
                                    })
                                }
                            />
                        </div>
                    ))}

                    <div className="mt-4 flex items-center justify-between pt-2">
                        <span className="text-xs opacity-60">最近更新：{draft.updatedAt || "未保存"}</span>
                        <div className="flex gap-2">
                            <Button icon={<RotateCcw className="size-3.5" />} loading={saving} onClick={() => void handleReset()}>
                                恢复默认
                            </Button>
                            <Button type="primary" icon={<Save className="size-3.5" />} loading={saving} onClick={() => void handleSave()}>
                                保存设置
                            </Button>
                        </div>
                    </div>
                </section>
            </div>

            <aside className="sd-admin-panel sd-admin-preview-card">
                <div className="sd-admin-panel-head">
                    <h3 className="sd-admin-panel-title">实时效果预览</h3>
                </div>
                <div className="mb-3 flex flex-wrap gap-2">
                    <Button size="small" onClick={() => setPreviewCollapsed((v) => !v)}>
                        {previewCollapsed ? "展开态" : "折叠态"}
                    </Button>
                    <Button size="small" onClick={() => setPreviewTheme((t) => (t === "dark" ? "light" : "dark"))}>
                        {previewTheme === "dark" ? "暗色主题" : "浅色主题"}
                    </Button>
                </div>
                <div className={`sd-admin-preview-stage ${previewTheme === "light" ? "is-light" : "dark"}`}>
                    <div className={`sd-admin-preview-shell ${previewCollapsed ? "is-collapsed" : ""}`}>
                        <SidebarEcosystemDock collapsed={previewCollapsed} configOverride={draft} siteFooterOverride={siteFooter} />
                    </div>
                </div>
            </aside>
        </div>
    );
}
