import { App, Button, Input, Skeleton, Tabs } from "antd";
import { Select } from "@/components/ui/base/select";
import { SegmentedControl } from "@/components/ui/base/segmented-control";
import { StatusBadge } from "@/components/ui/base/badges";
import { Callout } from "@/components/ui/product/callout";
import { EmptyState } from "@/components/ui/product/empty-state";
import { RotateCcw, Save, ShieldCheck, Undo2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { PromptCodeEditor } from "@/components/prompt/prompt-code-editor";
import {
    listUserPromptPreferences,
    resetUserPromptCustomization,
    updateUserPromptCustomization,
    type UserPromptCustomization,
    type UserPromptPreference,
} from "@/services/api/auth";
import { useI18n } from "@/supdance/plugins/i18n";

type CustomizationMode = UserPromptCustomization["mode"];

export function PromptPreferencesPane() {
    const { t } = useI18n();
    const { message, modal } = App.useApp();
    const [preferences, setPreferences] = useState<UserPromptPreference[]>([]);
    const [selectedOperation, setSelectedOperation] = useState("");
    const [mode, setMode] = useState<CustomizationMode>("inherit");
    const [appendContent, setAppendContent] = useState("");
    const [rewriteContent, setRewriteContent] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [loadError, setLoadError] = useState("");
    const requestIdRef = useRef(0);

    const modeOptions = [
        { label: t("settings.prompts_mode_inherit", undefined, "跟随平台"), value: "inherit" },
        { label: t("settings.prompts_mode_append", undefined, "追加要求"), value: "append" },
        { label: t("settings.prompts_mode_rewrite", undefined, "高级改写"), value: "rewrite" },
    ];

    const reload = async (preferredOperation?: string) => {
        const reqId = ++requestIdRef.current;
        setLoading(true);
        setLoadError("");
        try {
            const result = await listUserPromptPreferences();
            if (reqId !== requestIdRef.current) return;
            setPreferences(result.preferences);
            setSelectedOperation((current) => preferredOperation || current || result.preferences[0]?.definition.operation || "");
        } catch (error) {
            if (reqId !== requestIdRef.current) return;
            const msg = error instanceof Error ? error.message : t("settings.prompts_load_failed", undefined, "读取提示词偏好失败");
            setLoadError(msg);
            message.error(msg);
        } finally {
            if (reqId === requestIdRef.current) {
                setLoading(false);
            }
        }
    };

    useEffect(() => { void reload(); }, []);

    const selected = useMemo(() => preferences.find((item) => item.definition.operation === selectedOperation), [preferences, selectedOperation]);
    const savedMode = selected?.customization?.mode || "inherit";
    const savedAppendContent = savedMode === "append" ? selected?.customization?.content || "" : "";
    const savedRewriteContent = savedMode === "rewrite" ? selected?.customization?.content || "" : selected?.template?.content || "";
    const activeContent = mode === "append" ? appendContent : mode === "rewrite" ? rewriteContent : "";
    const savedActiveContent = savedMode === "append" ? savedAppendContent : savedMode === "rewrite" ? savedRewriteContent : "";
    const dirty = mode !== savedMode || activeContent !== savedActiveContent;

    const restoreDraft = (preference = selected) => {
        const customization = preference?.customization;
        setMode(customization?.mode || "inherit");
        setAppendContent(customization?.mode === "append" ? customization.content : "");
        setRewriteContent(customization?.mode === "rewrite" ? customization.content : preference?.template?.content || "");
    };

    useEffect(() => { restoreDraft(selected); }, [selected]);

    useEffect(() => {
        if (!dirty) return undefined;
        const preventUnload = (event: BeforeUnloadEvent) => event.preventDefault();
        window.addEventListener("beforeunload", preventUnload);
        return () => window.removeEventListener("beforeunload", preventUnload);
    }, [dirty]);

    const selectOperation = (operation: string) => {
        if (operation === selectedOperation) return;
        if (!dirty) {
            setSelectedOperation(operation);
            return;
        }
        modal.confirm({
            title: t("settings.prompts_switch_confirm_title", undefined, "切换模板并放弃修改？"),
            content: t("settings.prompts_switch_confirm_content", undefined, "当前模板还有未保存内容。切换后这些修改将丢失。"),
            okText: t("settings.prompts_switch_confirm_ok", undefined, "放弃并切换"),
            cancelText: t("settings.prompts_switch_confirm_cancel", undefined, "继续编辑"),
            okButtonProps: { danger: true },
            onOk: () => setSelectedOperation(operation),
        });
    };

    const save = async () => {
        if (!selected) return;
        const content = mode === "append" ? appendContent : mode === "rewrite" ? rewriteContent : "";
        if (mode !== "inherit" && !content.trim()) {
            message.warning(t("settings.prompts_fill_warning", undefined, "请填写个人提示词内容"));
            return;
        }
        setSaving(true);
        try {
            await updateUserPromptCustomization(selected.definition.operation, { mode, content });
            await reload(selected.definition.operation);
            message.success(t("settings.prompts_save_success", undefined, "提示词偏好已保存"));
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("settings.prompts_save_failed", undefined, "保存提示词偏好失败"));
        } finally {
            setSaving(false);
        }
    };

    const reset = () => {
        if (!selected) return;
        modal.confirm({
            title: t("settings.prompts_restore_confirm_title", undefined, "恢复平台模板？"),
            content: t("settings.prompts_restore_confirm_content", { label: selected.definition.label }, `将删除“${selected.definition.label}”的个人定制，后续自动跟随平台版本。`),
            okText: t("settings.prompts_restore_confirm_ok", undefined, "恢复平台模板"),
            cancelText: t("common.cancel", undefined, "取消"),
            onOk: async () => {
                try {
                    await resetUserPromptCustomization(selected.definition.operation);
                    await reload(selected.definition.operation);
                    message.success(t("settings.prompts_restore_success", undefined, "已恢复平台模板"));
                } catch (error) {
                    message.error(error instanceof Error ? error.message : t("settings.prompts_restore_failed", undefined, "恢复平台模板失败"));
                }
            },
        });
    };

    if (loading && preferences.length === 0) return <Skeleton active paragraph={{ rows: 10 }} />;
    if (loadError && preferences.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
                <Callout tone="error" title={t("settings.prompts_load_error_title", undefined, "加载提示词偏好失败")}>{loadError}</Callout>
                <Button icon={<RotateCcw className="size-4" />} onClick={() => void reload()}>{t("common.retry", undefined, "重试")}</Button>
            </div>
        );
    }
    if (!selected) return <EmptyState title={t("settings.prompts_empty_title", undefined, "暂无可配置的提示词模板")} />;

    const templateContent = selected.template?.content || t("settings.prompts_no_active_template", undefined, "当前没有启用的平台模板");
    const previewCreative = mode === "inherit" ? templateContent : mode === "append" ? `${templateContent}\n\n【${t("settings.prompts_append_personal_requirements", undefined, "用户个性化创作要求")}】\n${appendContent}` : rewriteContent;
    const outputLabel = selected.definition.outputType === "json" ? selected.definition.schemaKey || "JSON" : t("settings.cap_text", undefined, "文本");

    return (
        <div className="flex min-h-full flex-col">
            <header className="shrink-0 pb-4">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div className="min-w-0 flex-1">
                        <label className="mb-2 block text-xs font-medium text-foreground/55">{t("settings.prompts_template_label", undefined, "提示词模板")}</label>
                        <Select
                            ariaLabel={t("settings.prompts_template_label", undefined, "提示词模板")}
                            className="w-full max-w-md"
                            value={selectedOperation}
                            onChange={selectOperation}
                            options={preferences.map((item) => ({
                                value: item.definition.operation,
                                label: `${item.definition.category} · ${item.definition.label}${item.customization && item.customization.mode !== "inherit" ? ` · ${t("settings.prompts_customized", undefined, "已定制")}` : ""}`,
                            }))}
                        />
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                        <Button icon={<Undo2 className="size-4" />} disabled={!dirty || saving} onClick={() => restoreDraft()}>{t("settings.prompts_undo_btn", undefined, "撤销修改")}</Button>
                        <Button icon={<RotateCcw className="size-4" />} disabled={!selected.customization || saving} onClick={reset}>{t("settings.prompts_restore_btn", undefined, "恢复平台")}</Button>
                        <Button type="primary" icon={<Save className="size-4" />} loading={saving} disabled={!dirty} onClick={() => void save()}>{t("common.save_changes", undefined, "保存更改")}</Button>
                    </div>
                </div>

                <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-base font-semibold">{selected.definition.label}</h2>
                            <StatusBadge variant="filled" tone="neutral" label={t("settings.prompts_platform_version", { version: selected.template?.version || "--" }, `平台 v${selected.template?.version || "--"}`)} />
                            <StatusBadge variant="filled" tone="neutral" label={outputLabel} />
                            {dirty ? <StatusBadge variant="filled" tone="warning" label={t("settings.prompts_unsaved", undefined, "未保存")} /> : null}
                        </div>
                        <p className="mt-1 text-xs leading-5 text-foreground/55">{selected.definition.description}</p>
                    </div>
                    <SegmentedControl value={mode} options={modeOptions} onChange={(value) => setMode(value as CustomizationMode)} />
                </div>
            </header>

            {selected.outdated ? <Callout className="mt-4" tone="warning" title={t("settings.prompts_outdated_warning_title", undefined, "平台模板已更新")}>{t("settings.prompts_outdated_warning_desc", undefined, "当前高级改写基于旧版本。可以保留现有改写，或恢复平台后再基于新版本调整。")}</Callout> : null}

            <div className="grid min-h-0 flex-1 gap-4 pt-4 lg:grid-cols-3">
                <section className="flex min-h-0 flex-col lg:col-span-2">
                    <div className="mb-3 shrink-0">
                        <h3 className="text-sm font-semibold">{mode === "inherit" ? t("settings.prompts_current_platform_template", undefined, "当前平台模板") : mode === "append" ? t("settings.prompts_append_personal_requirements", undefined, "追加个人要求") : t("settings.prompts_advance_rewrite", undefined, "改写创作策略")}</h3>
                        <p className="mt-1 text-xs leading-5 text-foreground/50">
                            {mode === "inherit" ? t("settings.prompts_desc_inherit", undefined, "平台升级后自动使用新版本。") : mode === "append" ? t("settings.prompts_desc_append", undefined, "内容追加在平台策略之后，仍会自动继承平台升级。") : t("settings.prompts_desc_rewrite", undefined, "只替换创作策略；动态项目数据和输出契约仍由服务端强制注入。")}
                        </p>
                    </div>
                    {mode === "append" ? (
                        <Input.TextArea
                            className="min-h-96 resize-none"
                            value={appendContent}
                            maxLength={12000}
                            showCount
                            placeholder={t("settings.prompts_placeholder", undefined, "例如：仙侠项目采用明亮、宏大、高清的休闲剧质感；避免阴森恐怖色调，人物表演自然、轻松。")}
                            onChange={(event) => setAppendContent(event.target.value)}
                        />
                    ) : (
                        <div className="min-h-96 flex-1 overflow-hidden rounded-md bg-surface-active">
                            <PromptCodeEditor
                                value={mode === "inherit" ? templateContent : rewriteContent}
                                readOnly={mode === "inherit"}
                                ariaLabel={mode === "inherit" ? t("settings.prompts_current_platform_template", undefined, "平台提示词模板") : t("settings.prompts_advance_rewrite", undefined, "个人提示词改写")}
                                onChange={mode === "rewrite" ? setRewriteContent : undefined}
                            />
                        </div>
                    )}
                </section>

                <aside className="min-h-0 pt-4 lg:pl-6 lg:pt-0">
                    <Tabs
                        size="small"
                        items={[
                            {
                                key: "baseline",
                                label: t("settings.prompts_tab_baseline", undefined, "平台基线"),
                                children: <pre className="thin-scrollbar max-h-96 overflow-auto whitespace-pre-wrap text-xs leading-6 text-foreground/65">{templateContent}</pre>,
                            },
                            {
                                key: "contract",
                                label: t("settings.prompts_tab_contract", undefined, "输出契约"),
                                children: <div><div className="mb-3 flex items-center gap-2 text-xs font-medium"><ShieldCheck className="size-4" />{t("settings.prompts_server_readonly", undefined, "服务端只读")}</div><pre className="thin-scrollbar max-h-96 overflow-auto whitespace-pre-wrap text-xs leading-6 text-foreground/65">{selected.definition.outputContract}</pre></div>,
                            },
                            {
                                key: "preview",
                                label: t("settings.prompts_tab_final_structure", undefined, "最终结构"),
                                children: <div className="space-y-5 text-xs leading-6"><section><div className="mb-2 font-medium text-foreground/80">{t("settings.prompts_creative_strategy", undefined, "创作策略")}</div><pre className="thin-scrollbar max-h-64 overflow-auto whitespace-pre-wrap text-foreground/65">{previewCreative || t("settings.prompts_not_filled", undefined, "尚未填写")}</pre></section><section><div className="mb-2 font-medium text-foreground/80">{t("settings.prompts_runtime_enforced", undefined, "运行时强制追加")}</div><p className="text-foreground/55">{t("settings.prompts_runtime_desc", undefined, "当前剧情、项目画风、当前角色版本、画布资产与受保护输出契约。")}</p></section></div>,
                            },
                        ]}
                    />
                </aside>
            </div>
        </div>
    );
}
