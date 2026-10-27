import { App, Button, Form, Input, Popconfirm, Segmented } from "antd";
import { AntTooltip as Tooltip } from "@/components/ui/base/tooltip/ant-tooltip";
import { Pencil, Plus, RefreshCw, Trash2, Workflow } from "lucide-react";
import { useState, type ReactNode } from "react";

import { ModelEditorModal } from "@/components/model-editor-modal";
import { ChannelHeadersEditor, validateChannelHeaders } from "@/components/channel-headers-editor";
import { WorkspaceState } from "@/components/layout/workspace-state";
import { mergeFetchedChannelModelCosts } from "@/lib/channel-model-catalog";
import { fetchChannelModels } from "@/services/api/image";
import {
    createModelChannel,
    defaultBaseUrlForApiFormat,
    filterModelsByCapability,
    modelOptionsFromChannels,
    useConfigStore,
    type AiConfig,
    type ModelChannel,
} from "@/stores/use-config-store";
import { ChannelModelSettings } from "./channel-video-pricing";
import { Select } from "@/components/ui/base/select";
import { useI18n } from "@/supdance/plugins/i18n";

type UserChannelConnection = "openai" | "gemini";
type ChannelSettingsPaneProps = {
    onOpenModels: () => void;
    onOpenRunningHub?: () => void;
};

export function ChannelSettingsPane({ onOpenModels, onOpenRunningHub }: ChannelSettingsPaneProps) {
    const { t } = useI18n();
    const { message } = App.useApp();
    const config = useConfigStore((state) => state.config);
    const replaceConfig = useConfigStore((state) => state.replaceConfig);
    const [loadingChannelIds, setLoadingChannelIds] = useState<string[]>([]);
    const [editingChannelId, setEditingChannelId] = useState<string | null>(null);
    const [newChannelId, setNewChannelId] = useState<string | null>(null);
    const userChannels = config.channels.filter((channel) => channel.scope !== "system");
    const runningHubReady = Boolean(config.runningHub.enabled && config.runningHub.baseUrl.trim() && config.runningHub.apiKey.trim() && config.runningHub.workflowId.trim());

    const updateChannels = (channels: ModelChannel[], baseConfig = config) => {
        replaceConfig(withChannels(baseConfig, channels));
    };

    const updateChannel = (id: string, patch: Partial<ModelChannel>) => {
        updateChannels(config.channels.map((channel) => {
            if (channel.id !== id) return channel;
            const models = patch.models ? uniqueModels(patch.models) : channel.models;
            return {
                ...channel,
                ...patch,
                models,
                modelCosts: patch.modelCosts !== undefined ? patch.modelCosts : (patch.models ? channel.modelCosts?.filter((item) => models.includes(item.model)) : channel.modelCosts),
            };
        }));
    };

    const updateChannelConnection = (channel: ModelChannel, connection: UserChannelConnection) => {
        const apiFormat = connection;
        const defaultBaseUrl = defaultBaseUrlForApiFormat(apiFormat);
        const baseUrl = isKnownDefaultBaseUrl(channel.baseUrl) ? defaultBaseUrl : channel.baseUrl;
        // 渠道只负责连接类型；具体模型能力和请求协议由下方共享能力卡片维护。
        updateChannel(channel.id, { apiFormat, interfaceType: undefined, baseUrl });
    };

    const addChannel = () => {
        const channel = createModelChannel({ name: t("settings.channel_default_name", { index: userChannels.length + 1 }, `渠道 ${userChannels.length + 1}`) });
        updateChannels([...config.channels, channel]);
        setNewChannelId(channel.id);
        setEditingChannelId(channel.id);
    };

    const closeChannelEditor = () => {
        setEditingChannelId(null);
        setNewChannelId(null);
    };

    const deleteChannel = (id: string) => {
        const channel = config.channels.find((item) => item.id === id);
        if (channel?.scope === "system") {
            message.warning(t("settings.channel_system_managed", undefined, "系统渠道由管理员维护"));
            return;
        }
        updateChannels(config.channels.filter((item) => item.id !== id));
    };

    const setChannelLoading = (id: string, loading: boolean) => {
        setLoadingChannelIds((items) => (loading ? Array.from(new Set([...items, id])) : items.filter((item) => item !== id)));
    };

    const refreshChannelModels = async (channel: ModelChannel) => {
        const connectionError = channelConnectionError(channel, t);
        if (connectionError) {
            message.error(`${channel.name || t("settings.channel_current", undefined, "当前渠道")}：${connectionError}`);
            return;
        }
        setChannelLoading(channel.id, true);
        try {
            const result = await fetchChannelModels(channel, true);
            if (!result.models.length) {
                message.warning(t("settings.channel_no_models_returned", { channel: channel.name || t("settings.channel_current", undefined, "当前渠道") }, `${channel.name || "当前渠道"}未返回模型，已保留现有手工模型`));
                return;
            }
            const latestConfig = useConfigStore.getState().config;
            const latestChannel = latestConfig.channels.find((item) => item.id === channel.id);
            if (!latestChannel) return;
            if (channelConnectionSignature(latestChannel) !== channelConnectionSignature(channel)) {
                message.warning(t("settings.channel_config_changed_ignore_old", { channel: latestChannel.name || t("settings.channel_current", undefined, "当前渠道") }, `${latestChannel.name || "当前渠道"}的连接配置已改变，已忽略旧的拉取结果`));
                return;
            }
            updateChannels(
                latestConfig.channels.map((item) => (item.id === channel.id ? { ...item, models: result.models, modelCosts: mergeFetchedChannelModelCosts(item, result.catalog) } : item)),
                latestConfig,
            );
            message.success(t("settings.channel_models_updated", { channel: latestChannel.name || t("settings.channel_current", undefined, "当前渠道") }, `${latestChannel.name || "当前渠道"}模型列表已更新`));
        } catch (error) {
            message.error(channelModelFetchErrorMessage(error, t));
        } finally {
            setChannelLoading(channel.id, false);
        }
    };

    const refreshAllModels = async () => {
        const runnable = userChannels.filter((channel) => !channelConnectionError(channel, t));
        const skipped = userChannels.filter((channel) => channelConnectionError(channel, t));
        if (!runnable.length) {
            const detail = skipped.map((channel) => `${channel.name || t("settings.unnamed_channel", undefined, "未命名渠道")}：${channelConnectionError(channel, t)}`).join("；");
            message.error(detail || t("settings.channel_no_available_to_fetch", undefined, "没有可拉取的个人模型渠道，请先填写有效 Base URL 和 API Key"));
            return;
        }
        setChannelLoading("all", true);
        try {
            const results = await Promise.all(
                runnable.map(async (channel) => {
                    try {
                        const result = await fetchChannelModels(channel, true);
                        return { channel, result, error: "" };
                    } catch (error) {
                        return { channel, result: { models: [], catalog: [] }, error: error instanceof Error ? error.message : t("settings.channel_err_read_models", undefined, "读取失败") };
                    }
                }),
            );
            const latestConfig = useConfigStore.getState().config;
            const successful = results.filter((item) => {
                const latestChannel = latestConfig.channels.find((channel) => channel.id === item.channel.id);
                return Boolean(item.result.models.length && latestChannel && channelConnectionSignature(latestChannel) === channelConnectionSignature(item.channel));
            });
            const stale = results.filter((item) => {
                const latestChannel = latestConfig.channels.find((channel) => channel.id === item.channel.id);
                return Boolean(item.result.models.length && (!latestChannel || channelConnectionSignature(latestChannel) !== channelConnectionSignature(item.channel)));
            });
            const failed = results.filter((item) => !item.result.models.length);
            if (successful.length) {
                const resultMap = new Map(successful.map((item) => [item.channel.id, item.result] as const));
                updateChannels(
                    latestConfig.channels.map((channel) => {
                        const fetched = resultMap.get(channel.id);
                        return fetched ? { ...channel, models: fetched.models, modelCosts: mergeFetchedChannelModelCosts(channel, fetched.catalog) } : channel;
                    }),
                    latestConfig,
                );
                message.success(t("settings.channel_channels_updated_count", { count: successful.length }, `已更新 ${successful.length} 个渠道的模型`));
            }
            const warnings = [
                ...failed.map((item) => `${item.channel.name || t("settings.unnamed_channel", undefined, "未命名渠道")}：${item.error || t("settings.channel_no_models_returned", undefined, "未返回模型")}`),
                ...stale.map((item) => `${item.channel.name || t("settings.unnamed_channel", undefined, "未命名渠道")}：${t("settings.channel_config_changed_ignore_old", undefined, "连接配置已改变，已忽略旧结果")}`),
                ...skipped.map((channel) => `${channel.name || t("settings.unnamed_channel", undefined, "未命名渠道")}：${channelConnectionError(channel, t)}`),
            ];
            if (warnings.length) message.warning(`${warnings.join("；")}。${t("settings.channel_models_not_updated_keep_old", undefined, "未更新的渠道已保留原有模型列表")}`);
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("settings.channel_batch_read_failed", undefined, "批量读取模型失败，原有模型列表未改动"));
        } finally {
            setChannelLoading("all", false);
        }
    };

    return (
        <Form layout="vertical" requiredMark={false}>
            <div className="settings-pane-header">
                <div className="min-w-0">
                    <h2>{t("settings.personal_channels", undefined, "个人渠道")}</h2>
                    <p>{t("settings.channel_manage_intro", undefined, "管理个人模型服务和工作流渠道。普通渠道只保存连接类型；模型能力在“模型与能力”中配置。")}<Button type="link" size="small" className="h-auto p-0 text-xs font-semibold" onClick={onOpenModels}>{t("settings.channel_open_model_selection", undefined, "打开模型选择")}</Button></p>
                </div>
                <div className="flex w-full gap-2 sm:w-auto sm:shrink-0">
                    <Button className="h-10 flex-1 sm:h-8 sm:flex-none" icon={<RefreshCw className="size-4" />} loading={loadingChannelIds.includes("all")} disabled={loadingChannelIds.some((id) => id !== "all")} onClick={() => void refreshAllModels()}>{t("settings.channel_batch_refresh_btn", undefined, "拉取全部")}</Button>
                    <Button className="h-10 flex-1 sm:h-8 sm:flex-none" type="primary" icon={<Plus className="size-4" />} onClick={addChannel}>{t("settings.channel_add_btn", undefined, "新增渠道")}</Button>
                </div>
            </div>
            {onOpenRunningHub ? <section className="settings-section mb-3">
                <div className="mb-3">
                    <h3 className="text-sm font-semibold">{t("settings.channel_workflow_heading", undefined, "个人工作流渠道")}</h3>
                    <p className="mt-1 text-xs text-foreground/55">{t("settings.channel_runninghub_desc", undefined, "RunningHub 使用独立的云端工作流参数与执行通道。")}</p>
                </div>
                <div className="grid gap-2 lg:grid-cols-2">
                    {onOpenRunningHub ? (
                        <WorkflowChannelEntry
                            icon={<Workflow className="size-4" />}
                            title="RunningHub"
                            description={t("settings.channel_runninghub_app_desc", undefined, "云端工作流和 RunningHub App")}
                            status={runningHubReady ? t("settings.channel_workflows_count", { count: config.runningHub.workflows.length }, `${config.runningHub.workflows.length} 个工作流已配置`) : config.runningHub.enabled ? t("settings.channel_workflow_configured", undefined, "已启用") : t("settings.channel_workflow_not_configured", undefined, "未配置")}
                            ready={runningHubReady}
                            onOpen={onOpenRunningHub}
                        />
                    ) : null}
                </div>
            </section> : null}
            {userChannels.length ? (
                <div className="settings-channel-list space-y-2">
                    {userChannels.map((channel) => {
                        const editing = editingChannelId === channel.id;
                        return (
                            <section key={channel.id} aria-labelledby={`channel-${channel.id}-title`} className="settings-channel p-2 sm:p-3">
                                <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1 basis-52">
                                        <h3 id={`channel-${channel.id}-title`} className="truncate text-sm font-semibold">{channel.name || t("settings.unnamed_channel", undefined, "未命名渠道")}</h3>
                                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-foreground/55">
                                            {channelProtocolLabel(channel, t)} · {t("settings.channel_saved_models_count", { count: channel.models.length }, `已保存 ${channel.models.length} 个模型`)}
                                            <ChannelStatus channel={channel} />
                                        </div>
                                    </div>
                                    <div className="flex w-full justify-end gap-2 sm:w-auto sm:shrink-0">
                                        <Button className="h-10 sm:h-8" size="small" icon={<RefreshCw className="size-3.5" />} loading={loadingChannelIds.includes(channel.id)} disabled={loadingChannelIds.includes("all")} onClick={() => void refreshChannelModels(channel)}>{t("settings.channel_fetch_models_btn", undefined, "拉取模型")}</Button>
                                        <Button size="small" icon={<Pencil className="size-3.5" />} onClick={() => { setNewChannelId(null); setEditingChannelId(channel.id); }}>{t("common.edit", undefined, "编辑")}</Button>
                                        <Popconfirm title={t("settings.channel_delete_confirm_title", undefined, "删除个人模型渠道？")} description={t("settings.channel_delete_confirm_desc", undefined, "该渠道关联的模型选择会同时移除。")} okText={t("common.delete", undefined, "删除")} cancelText={t("common.cancel", undefined, "取消")} okButtonProps={{ danger: true }} onConfirm={() => deleteChannel(channel.id)}>
                                            <Tooltip title={t("settings.channel_delete_btn", undefined, "删除渠道")}><Button className="size-10 p-0 sm:size-8" aria-label={`${t("settings.channel_delete_btn", undefined, "删除渠道")} ${channel.name || t("settings.unnamed_channel", undefined, "未命名渠道")}`} size="small" type="text" danger disabled={loadingChannelIds.includes(channel.id) || loadingChannelIds.includes("all")} icon={<Trash2 className="size-3.5" />} /></Tooltip>
                                        </Popconfirm>
                                    </div>
                                </div>
                                {editing && (
                                    <ModelEditorModal
                                        open
                                        title={channel.id === newChannelId ? t("settings.channel_add_custom_modal", undefined, "新增自定义渠道") : t("settings.channel_edit_custom_modal", undefined, "编辑自定义渠道")}
                                        subtitle={channel.name}
                                        onClose={closeChannelEditor}
                                        footer={<div className="model-editor-footer">
                                            <span className="text-xs text-foreground/50">{t("settings.channel_cloud_sync_notice", undefined, "更改实时保存到云端渠道配置")}</span>
                                            <div className="model-editor-footer-actions">
                                                <Button loading={loadingChannelIds.includes(channel.id)} onClick={() => void refreshChannelModels(channel)}>{t("settings.channel_fetch_models_btn", undefined, "拉取模型")}</Button>
                                                <Button type="primary" onClick={closeChannelEditor}>{t("settings.channel_complete_btn", undefined, "完成")}</Button>
                                            </div>
                                        </div>}
                                    >
                                        <div className="model-editor-panel">
                                            <section className="model-editor-section">
                                                <div>
                                                    <h2>{t("settings.channel_connection_info", undefined, "连接信息")}</h2>
                                                    <p className="mt-1 text-xs text-foreground/50">{t("settings.channel_connection_info_desc", undefined, "用于拉取模型目录并向当前渠道发起请求。")}</p>
                                                </div>
                                                <div className="model-editor-connection-fields grid gap-3 sm:grid-cols-2">
                                                    <Form.Item label={t("settings.channel_name_label", undefined, "渠道名称")} htmlFor={`channel-${channel.id}-name`} className="mb-0 sm:col-span-1"><Input id={`channel-${channel.id}-name`} value={channel.name} placeholder={t("settings.channel_name_placeholder", undefined, "例如：我的 NewAPI")} onChange={(event) => updateChannel(channel.id, { name: event.target.value })} onBlur={(event) => updateChannel(channel.id, { name: event.target.value.trim() || t("settings.unnamed_channel", undefined, "未命名渠道") })} /></Form.Item>
                                                    <Form.Item label={t("settings.channel_catalog_type_label", undefined, "目录连接类型")} className="mb-0 sm:col-span-1" extra={t("settings.channel_catalog_type_extra", undefined, "仅影响模型目录拉取。")}><Segmented<UserChannelConnection> block value={channelConnectionMode(channel)} options={[{ label: "OpenAI", value: "openai" }, { label: "Gemini", value: "gemini" }]} onChange={(value) => updateChannelConnection(channel, value)} /></Form.Item>
                                                    <Form.Item label="Base URL" htmlFor={`channel-${channel.id}-base-url`} className="mb-0 sm:col-span-1"><Input id={`channel-${channel.id}-base-url`} inputMode="url" value={channel.baseUrl} placeholder={t("settings.channel_base_url_placeholder", undefined, "填写云端渠道 Base URL")} onChange={(event) => updateChannel(channel.id, { baseUrl: event.target.value })} onBlur={(event) => updateChannel(channel.id, { baseUrl: event.target.value.trim().replace(/\/+$/u, "") })} /></Form.Item>
                                                    <Form.Item label="API Key" htmlFor={`channel-${channel.id}-api-key`} className="mb-0 sm:col-span-1"><Input.Password id={`channel-${channel.id}-api-key`} autoComplete="new-password" value={channel.apiKey} placeholder={channel.apiFormat === "gemini" ? t("settings.channel_api_key_gemini_ph", undefined, "填写 Gemini API Key") : t("settings.channel_api_key_openai_ph", undefined, "填写当前渠道 API Key")} onChange={(event) => updateChannel(channel.id, { apiKey: event.target.value })} onBlur={(event) => updateChannel(channel.id, { apiKey: event.target.value.trim() })} /></Form.Item>
                                                    <Form.Item label={t("settings.channel_secret_key_optional", undefined, "Secret Key（可选）")} htmlFor={`channel-${channel.id}-secret-key`} className="mb-0 sm:col-span-1" extra={t("settings.channel_secret_key_extra", undefined, "即梦等 AK/SK 协议需要；其他协议留空。")}><Input.Password id={`channel-${channel.id}-secret-key`} autoComplete="new-password" value={channel.secretKey || ""} placeholder={t("settings.channel_secret_key_placeholder", undefined, "填写 Secret Key")} onChange={(event) => updateChannel(channel.id, { secretKey: event.target.value })} onBlur={(event) => updateChannel(channel.id, { secretKey: event.target.value.trim() })} /></Form.Item>
                                                    <div className="sm:col-span-2"><ChannelHeadersEditor value={channel.headers} onChange={(headers) => updateChannel(channel.id, { headers })} /></div>
                                                </div>
                                            </section>
                                            <section className="model-editor-section">
                                                <div>
                                                    <h2>{t("settings.channel_models_and_capabilities", undefined, "模型与能力")}</h2>
                                                    <p className="mt-1 text-xs text-foreground/50">{t("settings.channel_models_and_capabilities_desc", undefined, "维护渠道模型，并在单个模型中配置调用协议、能力和定价。")}</p>
                                                </div>
                                                <Form.Item label={t("settings.channel_model_list_label", undefined, "模型列表")} htmlFor={`channel-${channel.id}-models`} className="mb-0"><Select id={`channel-${channel.id}-models`} mode="tags" showSearch allowClear maxTagCount="responsive" tokenSeparators={[",", "\n"]} placeholder={t("settings.channel_models_placeholder", undefined, "输入模型名，或点击拉取模型")} value={channel.models} onChange={(models) => updateChannel(channel.id, { models: uniqueModels(models) })} /></Form.Item>
                                                <ChannelModelSettings channel={channel} onChange={(modelCosts) => updateChannel(channel.id, { modelCosts })} />
                                            </section>
                                        </div>
                                    </ModelEditorModal>
                                )}
                            </section>
                        );
                    })}
                </div>
            ) : <WorkspaceState icon="settings" compact title={t("settings.channel_empty_title", undefined, "当前没有个人模型渠道")} description={t("settings.channel_empty_desc", undefined, "管理员配置的系统渠道会出现在模型选择中；也可以添加自己的模型服务。")} action={<Button icon={<Plus className="size-4" />} onClick={addChannel}>{t("settings.channel_add_btn", undefined, "新增个人模型渠道")}</Button>} />}
        </Form>
    );
}

function WorkflowChannelEntry({ icon, title, description, status, ready, onOpen }: { icon: ReactNode; title: string; description: string; status: string; ready: boolean; onOpen?: () => void }) {
    const { t } = useI18n();
    return (
        <div className="settings-channel flex min-w-0 items-center justify-between gap-3 p-3">
            <div className="flex min-w-0 items-start gap-2">
                <span className="mt-0.5 shrink-0 text-[var(--workspace-accent)]" aria-hidden="true">{icon}</span>
                <div className="min-w-0">
                    <h4 className="text-sm font-semibold">{title}</h4>
                    <p className="mt-0.5 truncate text-xs text-foreground/55">{description}</p>
                    <span className={`settings-channel-status mt-2 ${ready ? "is-ready" : "is-warning"}`}><i aria-hidden="true" />{status}</span>
                </div>
            </div>
            <Button size="small" onClick={onOpen} disabled={!onOpen}>{t("settings.channel_configure_btn", undefined, "配置")}</Button>
        </div>
    );
}

export function channelValidationError(channel: ModelChannel, t?: (keyOrText: string, params?: Record<string, string | number>, fallbackText?: string) => string) {
    return channelConnectionError(channel, t) || validateChannelHeaders(channel.headers) || (!channel.models.length ? (t ? t("settings.configure_channel_first", undefined, "请添加至少一个模型") : "请添加至少一个模型") : "");
}

export function isChannelReady(channel: ModelChannel) {
    return !channelValidationError(channel);
}

export function focusInvalidChannelField(channel: ModelChannel) {
    const baseUrlError = channelConnectionError({ ...channel, apiKey: "valid", secretKey: "valid" });
    const field = baseUrlError ? "base-url" : !channel.apiKey.trim() ? "api-key" : requiresSecretKey(channel) && !channel.secretKey?.trim() ? "secret-key" : "models";
    requestAnimationFrame(() => {
        const element = document.getElementById(`channel-${channel.id}-${field}`);
        element?.scrollIntoView({ behavior: "smooth", block: "center" });
        element?.focus({ preventScroll: true });
    });
}

function ChannelStatus({ channel }: { channel: ModelChannel }) {
    const { t } = useI18n();
    const error = channelValidationError(channel, t);
    return (
        <span className={`settings-channel-status ${error ? "is-warning" : "is-ready"}`}>
            <i aria-hidden="true" />
            {error || t("settings.channel_status_ready", undefined, "可用")}
        </span>
    );
}

function withChannels(config: AiConfig, channels: ModelChannel[]): AiConfig {
    const models = modelOptionsFromChannels(channels);
    const imageModels = filterModelsByCapability(models, "image", channels);
    const videoModels = filterModelsByCapability(models, "video", channels);
    const textModels = filterModelsByCapability(models, "text", channels);
    const audioModels = filterModelsByCapability(models, "audio", channels);
    return { ...config, channels, models, baseUrl: channels[0]?.baseUrl || config.baseUrl, apiKey: channels[0]?.apiKey || config.apiKey, apiFormat: channels[0]?.apiFormat || config.apiFormat, imageModels, videoModels, textModels, audioModels, imageModel: normalizeDefaultModel(config.imageModel, imageModels), videoModel: normalizeDefaultModel(config.videoModel, videoModels), textModel: normalizeDefaultModel(config.textModel, textModels), audioModel: normalizeDefaultModel(config.audioModel, audioModels) };
}

function normalizeDefaultModel(value: string, options: string[]) {
    return options.includes(value) ? value : options[0] || "";
}

function uniqueModels(models: string[]) {
    return Array.from(new Set(models.map((model) => model.trim()).filter(Boolean)));
}

function channelModelFetchErrorMessage(error: unknown, t?: (keyOrText: string, params?: Record<string, string | number>, fallbackText?: string) => string) {
    const detail = error instanceof Error ? error.message : (t ? t("settings.channel_err_read_models", undefined, "读取模型失败") : "读取模型失败");
    if (detail.includes("不允许访问本机") || detail.includes("不允许访问保留地址")) return `${detail}；${t ? t("settings.channel_err_ssrf_private", undefined, "可信私网服务需由部署管理员配置 CANVAS_ALLOWED_PRIVATE_UPSTREAM_HOSTS 放行") : "可信私网服务需由部署管理员配置 CANVAS_ALLOWED_PRIVATE_UPSTREAM_HOSTS 放行"}`;
    return `${detail}；${t ? t("settings.channel_err_manual_model_hint", undefined, "也可以直接在模型列表中手动输入模型名") : "也可以直接在模型列表中手动输入模型名"}`;
}

function channelConnectionMode(channel: ModelChannel): UserChannelConnection {
    return channel.apiFormat === "gemini" ? "gemini" : "openai";
}

function channelConnectionError(channel: ModelChannel, t?: (keyOrText: string, params?: Record<string, string | number>, fallbackText?: string) => string) {
    const baseUrl = channel.baseUrl.trim();
    if (!baseUrl) return t ? t("settings.channel_err_fill_base_url", undefined, "请填写 Base URL") : "请填写 Base URL";
    try {
        const parsed = new URL(baseUrl);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return t ? t("settings.channel_err_http_https_only", undefined, "Base URL 只支持 HTTP 或 HTTPS") : "Base URL 只支持 HTTP 或 HTTPS";
    } catch {
        return t ? t("settings.channel_err_base_url_format", undefined, "Base URL 格式不正确") : "Base URL 格式不正确";
    }
    if (!channel.apiKey.trim()) return t ? t("settings.channel_err_fill_api_key", undefined, "请填写 API Key / Access Key") : "请填写 API Key / Access Key";
    if (requiresSecretKey(channel) && !channel.secretKey?.trim()) return t ? t("settings.channel_err_requires_secret_key", undefined, "当前协议需要填写 Secret Key") : "当前协议需要填写 Secret Key";
    return "";
}

function channelConnectionSignature(channel: ModelChannel) {
    return [channel.baseUrl.trim(), channel.apiKey.trim(), channel.secretKey?.trim() || "", channel.apiFormat, JSON.stringify(channel.headers || [])].join("\n");
}

function channelProtocolLabel(channel: ModelChannel, t?: (keyOrText: string, params?: Record<string, string | number>, fallbackText?: string) => string) {
    return channelConnectionMode(channel) === "gemini" ? (t ? t("settings.channel_proto_gemini_native", undefined, "Gemini 原生") : "Gemini 原生") : (t ? t("settings.channel_proto_openai_compat", undefined, "OpenAI 兼容") : "OpenAI 兼容");
}

function isKnownDefaultBaseUrl(value: string) {
    const normalized = value.trim().replace(/\/+$/, "");
    if (!normalized) return true;
    return [defaultBaseUrlForApiFormat("openai"), defaultBaseUrlForApiFormat("gemini")].some((candidate) => candidate.replace(/\/+$/, "") === normalized);
}

function requiresSecretKey(channel: ModelChannel) {
    return channel.modelCosts?.some((item) => item.protocol?.startsWith("volcengine-jimeng-")) === true;
}
