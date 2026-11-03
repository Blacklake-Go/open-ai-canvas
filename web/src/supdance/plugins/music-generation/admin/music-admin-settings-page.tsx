import React, { useEffect, useState } from "react";
import { App } from "antd";
import {
    ShieldCheck,
    Lock,
    Radio,
    Sparkles,
    CheckCircle2,
    XCircle,
    Save,
    Activity,
    Clock,
} from "lucide-react";
import { useI18n } from "@/supdance/plugins/i18n";
import {
    fetchMusicAdminConfig,
    fetchMusicAdminOverview,
    listAdminMusicTasks,
    setMusicPluginLifecycle,
    testMusicConnection,
    updateMusicAdminConfig,
    type AdminMusicConfig,
    type MusicLifecycleInfo,
    type MusicTask,
} from "../services/music-api";
import "../styles/music-generation.css";

export default function MusicAdminSettingsPage() {
    const { message, modal } = App.useApp();
    const { t } = useI18n();

    const [config, setConfig] = useState<AdminMusicConfig | null>(null);
    const [lifecycle, setLifecycle] = useState<MusicLifecycleInfo | null>(null);
    const [tasks, setTasks] = useState<MusicTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form inputs
    const [apiKey, setApiKey] = useState("");
    const [webhookSecret, setWebhookSecret] = useState("");
    const [defaultModel, setDefaultModel] = useState("suno-v6");

    // Test probe state
    const [testingProbe, setTestingProbe] = useState(false);
    const [probeResult, setProbeResult] = useState<{ status: string; message: string; billed: boolean } | null>(null);

    const loadData = async () => {
        setLoading(true);
        try {
            const [cfg, life, taskList] = await Promise.all([
                fetchMusicAdminConfig(),
                fetchMusicAdminOverview(),
                listAdminMusicTasks("", 1, 20),
            ]);
            setConfig(cfg);
            setLifecycle(life);
            setTasks(taskList.items);
            setDefaultModel(cfg.defaultModel || "suno-v6");
        } catch (err: any) {
            message.error(err.message || "读取音乐插件管理数据失败");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadData();
    }, []);

    const handleSaveConfig = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const updated = await updateMusicAdminConfig({
                apiKey: apiKey.trim() || undefined,
                webhookSecret: webhookSecret.trim() || undefined,
                defaultModel,
            });
            setConfig(updated);
            setApiKey("");
            setWebhookSecret("");
            message.success(t("common.save_success", undefined, "配置保存成功！"));
        } catch (err: any) {
            message.error(err.message || t("common.save_failed", undefined, "保存配置失败"));
        } finally {
            setSaving(false);
        }
    };

    const handleTestProbe = async () => {
        setTestingProbe(true);
        setProbeResult(null);
        try {
            const res = await testMusicConnection(apiKey.trim() || undefined);
            setProbeResult({
                status: res.status,
                message: res.message || "连接正常 (零计费探测)",
                billed: res.billed,
            });
            if (res.status === "ok") {
                message.success("连通性验证成功：上游网络正常，未发生扣费");
            } else {
                message.warning(res.message || "连接测试未就绪");
            }
        } catch (err: any) {
            setProbeResult({
                status: "error",
                message: err.message || "连接探测失败",
                billed: false,
            });
            message.error(err.message || "连接探测失败");
        } finally {
            setTestingProbe(false);
        }
    };

    const handleLifecycleTransition = (targetState: MusicLifecycleInfo["state"]) => {
        modal.confirm({
            title: "切换生命周期状态",
            content: `确定将音乐生成插件生命周期切换为 [${targetState}] 吗？`,
            onOk: async () => {
                try {
                    const updated = await setMusicPluginLifecycle(targetState);
                    setLifecycle(updated);
                    message.success(`生命周期已切换为: ${targetState}`);
                } catch (err: any) {
                    message.error(err.message || "切换生命周期状态失败");
                }
            },
        });
    };

    if (loading && !config) {
        return (
            <div className="plugin-music-generation flex min-h-[400px] items-center justify-center">
                <div className="size-8 animate-spin rounded-full border-3 border-primary border-t-transparent" />
            </div>
        );
    }

    return (
        <div className="plugin-music-generation space-y-8 p-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-5">
                <div>
                    <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                        <Sparkles className="size-5 text-primary" />
                        <span>{t("music.admin_title", undefined, "AI 音乐生成插件管理中心")}</span>
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        {t("music.admin_desc", undefined, "固定 KoyoSIM 外部网关（https://www.koyosim.com）集成、模型定价与全生命周期状态控制")}
                    </p>
                </div>

                {lifecycle && (
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">当前运行状态:</span>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${
                            lifecycle.state === "enabled"
                                ? "bg-emerald-500/10 text-emerald-500"
                                : lifecycle.state === "draining"
                                ? "bg-amber-500/10 text-amber-500"
                                : "bg-muted text-muted-foreground"
                        }`}>
                            {lifecycle.state}
                        </span>
                        {lifecycle.activeTasks > 0 && (
                            <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-xs text-blue-500 font-medium">
                                活动任务: {lifecycle.activeTasks}
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Lifecycle Control Panel */}
            <section className="rounded-xl border border-border/60 bg-card p-5 shadow-xs space-y-4">
                <div className="flex items-center gap-2">
                    <Activity className="size-4 text-primary" />
                    <h2 className="text-base font-semibold text-foreground">插件全生命周期操作 (7 状态机)</h2>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <button
                        type="button"
                        onClick={() => handleLifecycleTransition("enabled")}
                        className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-700 transition-colors"
                    >
                        启用插件 (Enabled)
                    </button>
                    <button
                        type="button"
                        onClick={() => handleLifecycleTransition("draining")}
                        className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-medium text-white hover:bg-amber-700 transition-colors"
                    >
                        温和排空 (Draining - 拒新任保进行)
                    </button>
                    <button
                        type="button"
                        onClick={() => handleLifecycleTransition("disabled")}
                        className="rounded-lg bg-zinc-600 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-700 transition-colors"
                    >
                        停用插件 (Disabled)
                    </button>
                    <button
                        type="button"
                        onClick={() => handleLifecycleTransition("updating")}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
                    >
                        标记升级中 (Updating)
                    </button>
                    <button
                        type="button"
                        onClick={() => handleLifecycleTransition("uninstalled")}
                        className="rounded-lg bg-destructive px-4 py-2 text-xs font-medium text-white hover:bg-destructive/90 transition-colors"
                    >
                        卸载插件 (Uninstalled - 保留用户资产)
                    </button>
                </div>
            </section>

            {/* Fixed API Source & Vault Settings */}
            <form onSubmit={handleSaveConfig} className="rounded-xl border border-border/60 bg-card p-5 shadow-xs space-y-6">
                <div className="flex items-center gap-2 border-b border-border/40 pb-3">
                    <Lock className="size-4 text-primary" />
                    <h2 className="text-base font-semibold text-foreground">API 网关与凭据金库 (固定来源)</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Read-only Immutable API Base URL Display */}
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-medium text-foreground">
                            唯一外部模型 API 来源 (不可篡改)
                        </label>
                        <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/50 px-3 py-2.5 text-sm font-mono text-muted-foreground select-none">
                            <ShieldCheck className="size-4 text-emerald-500 shrink-0" />
                            <span>{config?.baseUrl || "https://www.koyosim.com"}</span>
                            <span className="ml-auto rounded-sm bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                                固定服务端绑定
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            安全硬约束：系统禁止前端或后台覆盖 Base URL，所有外部流量强制 TLS 1.3 证书与防 SSRF 重定向校验。
                        </p>
                    </div>

                    {/* Masked Secret API Key Input */}
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-medium text-foreground flex items-center justify-between">
                            <span>Koyosim API 密钥</span>
                            <span className="text-xs text-muted-foreground font-mono">
                                {config?.hasApiKey ? `已配置: ${config.maskedApiKey}` : "未配置"}
                            </span>
                        </label>
                        <input
                            type="password"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder={config?.hasApiKey ? "•••••••••••••••• (留空保持原密钥)" : "请输入 koyo_sec_... 密钥"}
                            className="rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-hidden"
                        />
                    </div>

                    {/* Webhook Secret */}
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-medium text-foreground flex items-center justify-between">
                            <span>Webhook 回调验签密钥</span>
                            <span className="text-xs text-muted-foreground">
                                {config?.hasWebhookSecret ? "已配置" : "未配置"}
                            </span>
                        </label>
                        <input
                            type="password"
                            value={webhookSecret}
                            onChange={(e) => setWebhookSecret(e.target.value)}
                            placeholder="HMAC SHA-256 签名密钥..."
                            className="rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-hidden"
                        />
                    </div>

                    {/* Default Model */}
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-medium text-foreground">默认首选模型</label>
                        <select
                            value={defaultModel}
                            onChange={(e) => setDefaultModel(e.target.value)}
                            className="rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground"
                        >
                            <option value="suno-v6">Suno v6 (流行曲风与歌曲生成)</option>
                            <option value="mureka-9.5">Mureka V9.5 (高表现力声乐)</option>
                            <option value="lyria-3.5">Google Lyria 3.5 (高精度 BPM 调性)</option>
                            <option value="music_v2_5">Eleven Music v2.5 (高保真人声 & 分轨)</option>
                        </select>
                    </div>
                </div>

                {/* Connection Probe & Save Actions */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border/40 pt-4">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            disabled={testingProbe}
                            onClick={handleTestProbe}
                            className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/60 px-4 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                        >
                            <Radio className={`size-3.5 ${testingProbe ? "animate-pulse" : ""}`} />
                            <span>{testingProbe ? "探测中..." : t("music.test_connection", undefined, "测试安全连通性 (零计费 /v1/ping)")}</span>
                        </button>

                        {probeResult && (
                            <span className={`flex items-center gap-1 text-xs font-medium ${
                                probeResult.status === "ok" ? "text-emerald-500" : "text-destructive"
                            }`}>
                                {probeResult.status === "ok" ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />}
                                <span>{probeResult.message}</span>
                            </span>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={saving}
                        className="flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                        <Save className="size-3.5" />
                        <span>{saving ? "保存中..." : t("music.save_config", undefined, "保存网关设置")}</span>
                    </button>
                </div>
            </form>

            {/* Task Monitor */}
            <section className="rounded-xl border border-border/60 bg-card p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-border/40 pb-3">
                    <div className="flex items-center gap-2">
                        <Clock className="size-4 text-primary" />
                        <h2 className="text-base font-semibold text-foreground">在线生成任务监控</h2>
                    </div>
                    <span className="text-xs text-muted-foreground">最近活动任务</span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="border-b border-border/40 text-muted-foreground">
                            <tr>
                                <th className="py-2 font-medium">任务 ID</th>
                                <th className="py-2 font-medium">模型</th>
                                <th className="py-2 font-medium">状态</th>
                                <th className="py-2 font-medium">时长</th>
                                <th className="py-2 font-medium">用户</th>
                                <th className="py-2 font-medium">创建时间</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                            {tasks.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-6 text-center text-muted-foreground">
                                        暂无活动任务
                                    </td>
                                </tr>
                            ) : (
                                tasks.map((t) => (
                                    <tr key={t.taskId || t.id}>
                                        <td className="py-2 font-mono">{t.taskId || t.id}</td>
                                        <td className="py-2">{t.model}</td>
                                        <td className="py-2">
                                            <span className="capitalize">{t.stage || t.status}</span>
                                        </td>
                                        <td className="py-2">{t.durationTargetSeconds}s</td>
                                        <td className="py-2 font-mono">{t.userId.slice(0, 8)}</td>
                                        <td className="py-2">{new Date(t.createdAt).toLocaleTimeString()}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}
