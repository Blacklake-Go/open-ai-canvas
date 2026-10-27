import { useEffect, useState } from "react";
import { App, Badge, Button, Card, Divider, Form, Input, Modal, Select, Space, Spin, Switch, Tag, Tooltip } from "antd";
import { Check, Copy, ExternalLink, Globe, Lock, Play, RefreshCw, Save, ShieldCheck, Sparkles, Terminal, Wand2 } from "lucide-react";

import { getAdminSocialAuthSettings, testSocialAuthProvider, updateAdminSocialAuthSettings } from "../api";
import { SocialProviderIcon } from "../components/social-provider-icons";
import type { AdminSettingsView, ProviderTestResult, SocialAuthProviderAdmin, SocialAuthRegion } from "../types";

export default function SocialAuthSettingsPage() {
    const { message } = App.useApp();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [data, setData] = useState<AdminSettingsView | null>(null);
    const [activeTab, setActiveTab] = useState<SocialAuthRegion>("cn");
    const [fallbackRegion, setFallbackRegion] = useState<SocialAuthRegion>("cn");
    
    // Testing state per provider
    const [testingProvider, setTestingProvider] = useState<string | null>(null);
    const [testResults, setTestResults] = useState<Record<string, ProviderTestResult>>({});

    // Editing modal state
    const [editingProvider, setEditingProvider] = useState<SocialAuthProviderAdmin | null>(null);
    const [modalForm] = Form.useForm();

    const loadSettings = async () => {
        setLoading(true);
        try {
            const res = await getAdminSocialAuthSettings();
            setData(res);
            setFallbackRegion(res.defaultFallbackRegion || "cn");
        } catch (err) {
            message.error(err instanceof Error ? err.message : "加载配置失败");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadSettings();
    }, []);

    const handleCopy = (text: string, label = "内容") => {
        navigator.clipboard.writeText(text);
        message.success(`已复制${label}到剪贴板`);
    };

    const handlePing = async (provider: SocialAuthProviderAdmin) => {
        setTestingProvider(provider.id);
        try {
            const res = await testSocialAuthProvider(provider.id);
            setTestResults((prev) => ({ ...prev, [provider.id]: res }));
            if (res.status === "ok") {
                message.success(`${provider.name} 连通性测试通过 (${res.pingLatencyMs}ms)`);
            } else if (res.status === "degraded") {
                message.warning(`${provider.name}: ${res.message}`);
            } else {
                message.error(`${provider.name}: ${res.message}`);
            }
        } catch (err) {
            message.error(err instanceof Error ? err.message : "测试失败");
        } finally {
            setTestingProvider(null);
        }
    };

    const handleToggleEnabled = async (provider: SocialAuthProviderAdmin, enabled: boolean) => {
        if (!data) return;
        try {
            const res = await updateAdminSocialAuthSettings({
                providers: {
                    [provider.id]: { enabled },
                },
            });
            setData(res);
            message.success(`${provider.name} 已${enabled ? "启用" : "禁用"}`);
        } catch (err) {
            message.error(err instanceof Error ? err.message : "操作失败");
        }
    };

    const handleToggleSandbox = async (provider: SocialAuthProviderAdmin, sandboxMockEnabled: boolean) => {
        if (!data) return;
        try {
            const res = await updateAdminSocialAuthSettings({
                providers: {
                    [provider.id]: { sandboxMockEnabled },
                },
            });
            setData(res);
            message.success(`${provider.name} 沙盒 Mock 联调模式已${sandboxMockEnabled ? "开启" : "关闭"}`);
        } catch (err) {
            message.error(err instanceof Error ? err.message : "操作失败");
        }
    };

    const handleOpenEdit = (provider: SocialAuthProviderAdmin) => {
        setEditingProvider(provider);
        modalForm.setFieldsValue({
            enabled: provider.enabled,
            clientId: "",
            clientSecret: "",
            sandboxMockEnabled: provider.sandboxMockEnabled,
        });
    };

    const handleSaveEdit = async () => {
        if (!editingProvider) return;
        try {
            const values = await modalForm.validateFields();
            const updatePayload: Record<string, any> = {
                enabled: values.enabled,
                sandboxMockEnabled: values.sandboxMockEnabled,
            };
            if (values.clientId?.trim()) {
                updatePayload.clientId = values.clientId.trim();
            }
            if (values.clientSecret?.trim()) {
                updatePayload.clientSecret = values.clientSecret.trim();
            }

            const res = await updateAdminSocialAuthSettings({
                providers: {
                    [editingProvider.id]: updatePayload,
                },
            });
            setData(res);
            message.success(`${editingProvider.name} 凭证配置已更新`);
            setEditingProvider(null);
        } catch (err) {
            if (err instanceof Error) {
                message.error(err.message);
            }
        }
    };

    const handleSaveFallbackRegion = async () => {
        setSaving(true);
        try {
            const res = await updateAdminSocialAuthSettings({
                defaultFallbackRegion: fallbackRegion,
            });
            setData(res);
            message.success("默认回退分区配置已成功保存");
        } catch (err) {
            message.error(err instanceof Error ? err.message : "保存失败");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-96 items-center justify-center">
                <Spin tip="正在读取社交登录配置..." />
            </div>
        );
    }

    if (!data) {
        return (
            <div className="p-8 text-center text-slate-400">
                暂无配置数据，请刷新重试。
            </div>
        );
    }

    const cnProviders = data.mainlandProviders || (data.providers ? Object.values(data.providers).filter((p) => p.region === "cn") : []);
    const intlProviders = data.intlProviders || (data.providers ? Object.values(data.providers).filter((p) => p.region === "intl") : []);
    const currentList = activeTab === "cn" ? cnProviders : intlProviders;

    const cnCount = data.cnCount ?? cnProviders.length;
    const intlCount = data.intlCount ?? intlProviders.length;
    const onlineCount = data.onlineCount ?? [...cnProviders, ...intlProviders].filter((p) => p.enabled).length;

    const renderStatusTag = (status: SocialAuthProviderAdmin["status"]) => {
        switch (status) {
            case "online":
                return <Tag color="success">在线 (Online)</Tag>;
            case "ready":
                return <Tag color="processing">已就绪 (Ready)</Tag>;
            case "credentials_required":
                return <Tag color="warning">凭证待完善</Tag>;
            default:
                return <Tag color="default">待配置</Tag>;
        }
    };

    return (
        <div className="mx-auto max-w-7xl space-y-6 p-6">
            {/* Page Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2.5">
                        <ShieldCheck className="size-6 text-pink-500" />
                        第三方社交统一登录配置
                    </h1>
                    <p className="mt-1 text-sm text-slate-400">
                        基于访问者 IP 智能分区展示中国大陆（QQ、微信、抖音、B站）与海外（Google、X、Instagram、TikTok）登录渠道，支持凭证安全加密与沙盒联调测试。
                    </p>
                </div>
                <Button
                    type="primary"
                    icon={<RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />}
                    onClick={loadSettings}
                >
                    刷新配置
                </Button>
            </div>

            {/* IP Geo-Partition Summary Card */}
            <Card className="border border-white/10 bg-slate-900/60 shadow-lg backdrop-blur">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                        <div className="flex items-center gap-2 rounded-lg bg-slate-800/80 px-3 py-1.5 border border-white/5">
                            <Globe className="size-4 text-blue-400" />
                            <span className="text-slate-400">当前访客 IP:</span>
                            <span className="font-mono font-medium text-slate-200">{data.clientIp}</span>
                            <Tag color={data.detectedRegion === "cn" ? "blue" : "purple"} className="ml-1">
                                {data.detectedRegion === "cn" ? "中国大陆 · CN" : "海外/港澳台 · Intl"}
                            </Tag>
                        </div>
                        <div className="flex items-center gap-2 rounded-lg bg-slate-800/80 px-3 py-1.5 border border-white/5">
                            <span className="text-slate-400">渠道状态:</span>
                            <span className="text-emerald-400 font-semibold">{onlineCount} 在线</span>
                            <span className="text-slate-600">/</span>
                            <span className="text-slate-300">大陆 {cnCount}</span>
                            <span className="text-slate-600">/</span>
                            <span className="text-slate-300">海外 {intlCount}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-400">默认回退分区:</span>
                        <Select
                            value={fallbackRegion}
                            onChange={(val) => setFallbackRegion(val)}
                            className="w-36"
                            options={[
                                { value: "cn", label: "中国大陆 (CN)" },
                                { value: "intl", label: "海外地区 (Intl)" },
                            ]}
                        />
                        <Button
                            type="primary"
                            icon={<Save className="size-4" />}
                            loading={saving}
                            onClick={handleSaveFallbackRegion}
                        >
                            保存分区设置
                        </Button>
                    </div>
                </div>
            </Card>

            {/* Region Tabs */}
            <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                <button
                    type="button"
                    onClick={() => setActiveTab("cn")}
                    className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                        activeTab === "cn"
                            ? "bg-pink-600/20 text-pink-400 border border-pink-500/30"
                            : "text-slate-400 hover:text-white hover:bg-white/5"
                    }`}
                >
                    <span className="size-2 rounded-full bg-pink-500" />
                    中国大陆渠道 ({cnProviders.length})
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab("intl")}
                    className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                        activeTab === "intl"
                            ? "bg-pink-600/20 text-pink-400 border border-pink-500/30"
                            : "text-slate-400 hover:text-white hover:bg-white/5"
                    }`}
                >
                    <span className="size-2 rounded-full bg-purple-500" />
                    海外渠道 ({intlProviders.length})
                </button>
            </div>

            {/* Channel Cards Grid */}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                {currentList.map((provider) => {
                    const testResult = testResults[provider.id];
                    const isTesting = testingProvider === provider.id;

                    return (
                        <Card
                            key={provider.id}
                            className={`border transition-all ${
                                provider.enabled
                                    ? "border-white/10 bg-slate-900/50 hover:border-pink-500/30"
                                    : "border-white/5 bg-slate-950/40 opacity-75"
                            }`}
                        >
                            {/* Card Header */}
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-xl bg-white/5 p-2.5 border border-white/10">
                                        <SocialProviderIcon provider={provider.id} className="size-7" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-base font-semibold text-slate-100">{provider.name}</h3>
                                            {renderStatusTag(provider.status)}
                                        </div>
                                        <p className="mt-0.5 text-xs text-slate-400">{provider.statusMessage}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-400">启用渠道</span>
                                    <Switch
                                        checked={provider.enabled}
                                        onChange={(checked) => handleToggleEnabled(provider, checked)}
                                    />
                                </div>
                            </div>

                            <Divider className="my-3.5 border-white/10" />

                            {/* Credentials Info */}
                            <div className="space-y-2.5 text-xs">
                                <div className="flex items-center justify-between rounded-lg bg-slate-800/40 p-2.5 border border-white/5">
                                    <span className="text-slate-400">Client ID / App ID:</span>
                                    <span className="font-mono text-slate-200">{provider.clientIdMasked || "未配置"}</span>
                                </div>

                                <div className="flex items-center justify-between rounded-lg bg-slate-800/40 p-2.5 border border-white/5">
                                    <span className="text-slate-400">Client Secret:</span>
                                    <span className="font-mono text-slate-200">{provider.clientSecretMasked || "未配置"}</span>
                                </div>

                                {/* Callback URL */}
                                <div className="rounded-lg bg-slate-800/40 p-2.5 border border-white/5">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-slate-400">授权回调地址 (Redirect URI):</span>
                                        <Button
                                            type="text"
                                            size="small"
                                            icon={<Copy className="size-3" />}
                                            onClick={() => handleCopy(provider.callbackUrl, "回调地址")}
                                            className="text-pink-400 hover:text-pink-300"
                                        >
                                            复制
                                        </Button>
                                    </div>
                                    <div className="break-all font-mono text-[11px] text-slate-300 bg-black/30 rounded p-1.5">
                                        {provider.callbackUrl}
                                    </div>
                                </div>

                                {/* Sandbox Mock Toggle (QQ, Douyin, Bilibili) */}
                                {provider.sandboxMockSupported && (
                                    <div className="flex items-center justify-between rounded-lg bg-pink-950/20 p-2.5 border border-pink-500/20">
                                        <div className="flex items-center gap-1.5">
                                            <Sparkles className="size-3.5 text-pink-400" />
                                            <div>
                                                <span className="font-medium text-pink-300">开启沙盒 Mock 联调</span>
                                                <p className="text-[11px] text-pink-400/80">开发与审核期间无需外网公网凭证即可模拟登录</p>
                                            </div>
                                        </div>
                                        <Switch
                                            checked={provider.sandboxMockEnabled}
                                            onChange={(checked) => handleToggleSandbox(provider, checked)}
                                        />
                                    </div>
                                )}

                                {/* Test Result Display */}
                                {testResult && (
                                    <div
                                        className={`rounded-lg p-2.5 text-xs border ${
                                            testResult.status === "ok"
                                                ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-300"
                                                : testResult.status === "degraded"
                                                  ? "bg-amber-950/20 border-amber-500/30 text-amber-300"
                                                  : "bg-rose-950/20 border-rose-500/30 text-rose-300"
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span>
                                                测试状态: <strong>{testResult.status.toUpperCase()}</strong>
                                            </span>
                                            <span>延迟: {testResult.pingLatencyMs}ms</span>
                                        </div>
                                        <p className="mt-1 text-[11px] opacity-90">{testResult.message}</p>
                                    </div>
                                )}
                            </div>

                            <Divider className="my-3.5 border-white/10" />

                            {/* Card Footer Actions */}
                            <div className="flex items-center justify-between">
                                <Button
                                    size="small"
                                    icon={<Play className={`size-3 ${isTesting ? "animate-pulse" : ""}`} />}
                                    loading={isTesting}
                                    onClick={() => handlePing(provider)}
                                >
                                    连通性测试 (Ping)
                                </Button>
                                <Button
                                    size="small"
                                    type="primary"
                                    icon={<Lock className="size-3" />}
                                    onClick={() => handleOpenEdit(provider)}
                                >
                                    编辑凭证
                                </Button>
                            </div>
                        </Card>
                    );
                })}
            </div>

            {/* Credential Edit Modal */}
            <Modal
                title={
                    editingProvider ? (
                        <div className="flex items-center gap-2 text-slate-100">
                            <SocialProviderIcon provider={editingProvider.id} className="size-5" />
                            <span>配置 {editingProvider.name} 凭据</span>
                        </div>
                    ) : (
                        "配置渠道凭据"
                    )
                }
                open={Boolean(editingProvider)}
                onCancel={() => setEditingProvider(null)}
                onOk={handleSaveEdit}
                okText="保存凭据"
                cancelText="取消"
                destroyOnClose
            >
                {editingProvider && (
                    <Form form={modalForm} layout="vertical" className="mt-4">
                        <Form.Item label="渠道状态" name="enabled" valuePropName="checked">
                            <Switch checkedChildren="已启用" unCheckedChildren="已禁用" />
                        </Form.Item>

                        <Form.Item
                            label="Client ID / App ID"
                            name="clientId"
                            tooltip="在开放平台应用详情页获取。若不修改请留空。"
                        >
                            <Input placeholder={`当前: ${editingProvider.clientIdMasked || "未设置"}`} />
                        </Form.Item>

                        <Form.Item
                            label="Client Secret / App Secret"
                            name="clientSecret"
                            tooltip="开放平台密钥。敏感密钥由系统采用强加密保护，若不修改请留空。"
                        >
                            <Input.Password placeholder={`当前: ${editingProvider.clientSecretMasked || "未设置"}`} />
                        </Form.Item>

                        <Form.Item label="授权回调地址 (Redirect URI)">
                            <Input
                                value={editingProvider.callbackUrl}
                                readOnly
                                addonAfter={
                                    <Button
                                        type="text"
                                        size="small"
                                        icon={<Copy className="size-3" />}
                                        onClick={() => handleCopy(editingProvider.callbackUrl, "回调地址")}
                                    />
                                }
                            />
                        </Form.Item>

                        {editingProvider.sandboxMockSupported && (
                            <Form.Item
                                label="沙盒 Mock 联调模式"
                                name="sandboxMockEnabled"
                                valuePropName="checked"
                                tooltip="开启后，前台点击将走本地沙盒授权流程，自动完成用户信息模拟绑定，无需真实凭证。"
                            >
                                <Switch checkedChildren="开启 Mock" unCheckedChildren="关闭 Mock" />
                            </Form.Item>
                        )}
                    </Form>
                )}
            </Modal>
        </div>
    );
}
