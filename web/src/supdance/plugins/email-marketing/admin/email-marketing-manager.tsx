import { Alert, App, Button, Input, Spin, Tag, Tooltip } from "antd";
import {
    ArrowLeft,
    CheckCircle2,
    Code2,
    ExternalLink,
    Mail,
    Monitor,
    RotateCcw,
    Save,
    Send,
    Smartphone,
    Sparkles,
    SlidersHorizontal,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
    fetchEmailMarketingOverview,
    resetEmailMarketingTemplate,
    saveEmailMarketingTemplates,
    sendMarketingTestEmail,
} from "../api";
import type { EmailMarketingOverview, MarketingTemplate } from "../types";
import { renderClientTemplate } from "./render";

const TEMPLATE_KEYS = ["welcome", "newsletter", "credit_alert", "winback"] as const;

export default function EmailMarketingManager() {
    const { message, modal } = App.useApp();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [overview, setOverview] = useState<EmailMarketingOverview | null>(null);

    const [selectedKey, setSelectedKey] = useState<string>("welcome");
    const [activeTab, setActiveTab] = useState<"code" | "variables">("code");
    const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");

    // 各模板的编辑状态本地缓存
    const [editedTemplates, setEditedTemplates] = useState<Record<string, MarketingTemplate>>({});
    const [currentVars, setCurrentVars] = useState<Record<string, Record<string, string>>>({});

    // 测试发信状态
    const [testEmail, setTestEmail] = useState("");
    const [sendingTest, setSendingTest] = useState(false);
    const [sendResult, setSendResult] = useState<{
        success: boolean;
        message: string;
        latencyMs?: number;
    } | null>(null);

    // 加载总览
    const loadOverview = async () => {
        try {
            setLoading(true);
            const data = await fetchEmailMarketingOverview();
            setOverview(data);
            setEditedTemplates(data.templates || {});

            // 初始化变量
            const initialVars: Record<string, Record<string, string>> = {};
            for (const key of TEMPLATE_KEYS) {
                const tmpl = data.templates?.[key];
                initialVars[key] = { ...(tmpl?.sampleVariables || {}) };
            }
            setCurrentVars(initialVars);
        } catch (err: unknown) {
            const errObj = err as { message?: string };
            message.error(errObj.message || "加载邮件营销配置失败");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadOverview();
    }, []);

    const currentTemplate = editedTemplates[selectedKey] || overview?.templates?.[selectedKey];
    const currentVariables = currentVars[selectedKey] || {};

    // 实时编译 HTML 与 主题
    const compiledHtml = useMemo(() => {
        if (!currentTemplate) return "";
        return renderClientTemplate(
            currentTemplate.html || currentTemplate.defaultHtml,
            currentVariables,
            currentTemplate.sampleVariables,
        );
    }, [currentTemplate, currentVariables]);

    const compiledSubject = useMemo(() => {
        if (!currentTemplate) return "";
        return renderClientTemplate(
            currentTemplate.subject || currentTemplate.defaultSubject,
            currentVariables,
            currentTemplate.sampleVariables,
        );
    }, [currentTemplate, currentVariables]);

    const handleSubjectChange = (val: string) => {
        setEditedTemplates((prev) => ({
            ...prev,
            [selectedKey]: {
                ...prev[selectedKey],
                subject: val,
            },
        }));
    };

    const handleHtmlChange = (val: string) => {
        setEditedTemplates((prev) => ({
            ...prev,
            [selectedKey]: {
                ...prev[selectedKey],
                html: val,
            },
        }));
    };

    const handleVariableChange = (varKey: string, val: string) => {
        setCurrentVars((prev) => ({
            ...prev,
            [selectedKey]: {
                ...prev[selectedKey],
                [varKey]: val,
            },
        }));
    };

    const insertVariableToHtml = (varKey: string) => {
        const placeholder = `{{${varKey}}}`;
        const currentHtml = currentTemplate?.html || currentTemplate?.defaultHtml || "";
        handleHtmlChange(currentHtml + placeholder);
        message.info(`已插入变量 ${placeholder}`);
    };

    // 保存模板配置
    const handleSave = async () => {
        try {
            setSaving(true);
            const res = await saveEmailMarketingTemplates(editedTemplates);
            setOverview(res);
            setEditedTemplates(res.templates || {});
            message.success("营销模板配置已保存");
        } catch (err: unknown) {
            const errObj = err as { message?: string };
            message.error(errObj.message || "保存模板配置失败");
        } finally {
            setSaving(false);
        }
    };

    // 重置当前模板为默认
    const handleReset = () => {
        if (!currentTemplate) return;
        modal.confirm({
            title: `确认重置【${currentTemplate.name}】模板？`,
            content: "当前模板的自定义 HTML 与主题将恢复为官方预置默认内容，未保存修改将被清除。",
            okText: "确认重置",
            okType: "danger",
            cancelText: "取消",
            onOk: async () => {
                try {
                    const res = await resetEmailMarketingTemplate(selectedKey);
                    setOverview(res);
                    setEditedTemplates(res.templates || {});
                    if (res.templates?.[selectedKey]) {
                        setCurrentVars((prev) => ({
                            ...prev,
                            [selectedKey]: { ...(res.templates[selectedKey].sampleVariables || {}) },
                        }));
                    }
                    message.success(`【${currentTemplate.name}】已恢复为官方默认`);
                } catch (err: unknown) {
                    const errObj = err as { message?: string };
                    message.error(errObj.message || "重置模板失败");
                }
            },
        });
    };

    // 发送营销测试邮件
    const handleSendTest = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedEmail = testEmail.trim();
        if (!trimmedEmail) {
            message.warning("请填写接收测试邮件的邮箱地址");
            return;
        }

        setSendingTest(true);
        setSendResult(null);

        try {
            const res = await sendMarketingTestEmail({
                to: trimmedEmail,
                templateKey: selectedKey,
                subject: currentTemplate?.subject,
                html: currentTemplate?.html,
                variables: currentVariables,
            });

            setSendResult({
                success: true,
                message: res.message || `测试邮件已发送至 ${trimmedEmail}`,
                latencyMs: res.latencyMs,
            });
            message.success("测试邮件发送成功！");
        } catch (err: unknown) {
            const errObj = err as { message?: string };
            setSendResult({
                success: false,
                message: errObj.message || "发送测试邮件失败",
            });
            message.error(errObj.message || "发送测试邮件失败");
        } finally {
            setSendingTest(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-96 w-full items-center justify-center">
                <Spin tip="正在载入邮件营销工作台..." />
            </div>
        );
    }

    return (
        <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6">
            {/* 顶栏导航与状态 */}
            <div className="flex flex-col gap-4 border-b border-[var(--token-border,#23272f)] pb-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-3">
                    <Button
                        type="text"
                        icon={<ArrowLeft className="h-4 w-4" />}
                        onClick={() => navigate("/admin/plugins")}
                    />
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl font-bold text-[var(--token-text-primary,#ededf0)]">
                                邮件营销与模板管理
                            </h1>
                            <Tag color="magenta">官方应用</Tag>
                            {overview?.smtpConfigured ? (
                                <Tag color="success">SMTP 就绪</Tag>
                            ) : (
                                <Tag color="warning">SMTP 未就绪</Tag>
                            )}
                        </div>
                        <p className="mt-1 text-sm text-[var(--token-text-secondary,#9aa0a6)]">
                            覆盖新用户注册欢迎引导、周报动态、额度警报与促活召回全生命周期；支持可视化编辑与双栏沙箱实时渲染。
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Button
                        type="primary"
                        icon={<Save className="h-4 w-4" />}
                        loading={saving}
                        onClick={handleSave}
                    >
                        保存模板变更
                    </Button>
                </div>
            </div>

            {/* SMTP 配置预警 */}
            {!overview?.smtpConfigured && (
                <Alert
                    type="warning"
                    showIcon
                    message="平台 SMTP 邮件服务尚未完全启用"
                    description={
                        <div className="flex items-center justify-between">
                            <span>
                                当前系统未开启 SMTP 或未填写完整发信凭证，测试发信将不可用。请先前往邮箱服务配置中启用。
                            </span>
                            <Button
                                size="small"
                                type="link"
                                onClick={() => navigate("/admin/settings")}
                            >
                                前往配置 SMTP
                            </Button>
                        </div>
                    }
                />
            )}

            {/* 模板快速切换 Tab */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--token-border,#23272f)] bg-[var(--token-bg-elevated,#131519)] p-2">
                <div className="flex flex-wrap gap-1.5">
                    {TEMPLATE_KEYS.map((key) => {
                        const tmpl = editedTemplates[key] || overview?.templates?.[key];
                        const isSelected = selectedKey === key;
                        return (
                            <button
                                key={key}
                                type="button"
                                onClick={() => {
                                    setSelectedKey(key);
                                    setSendResult(null);
                                }}
                                className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                                    isSelected
                                        ? "bg-[var(--token-primary,#e11d74)] text-white shadow-sm"
                                        : "text-[var(--token-text-secondary,#9aa0a6)] hover:bg-[var(--token-bg-hover,#1d212a)] hover:text-[var(--token-text-primary,#ededf0)]"
                                }`}
                            >
                                {tmpl?.name || key}
                            </button>
                        );
                    })}
                </div>

                <div className="flex items-center gap-3 px-2">
                    <span className="text-xs text-[var(--token-text-tertiary,#70757e)]">
                        类型：<strong className="text-[var(--token-text-primary,#ededf0)]">{currentTemplate?.category}</strong>
                    </span>
                    <Button
                        type="link"
                        size="small"
                        icon={<RotateCcw className="h-3.5 w-3.5" />}
                        onClick={handleReset}
                    >
                        恢复默认模板
                    </Button>
                </div>
            </div>

            {/* 邮件主题编辑行 */}
            <div className="flex flex-col gap-2 rounded-2xl border border-[var(--token-border,#23272f)] bg-[var(--token-bg-elevated,#131519)] p-4">
                <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-[var(--token-text-primary,#ededf0)]">
                        邮件标题 (Subject)
                    </label>
                    <span className="text-xs text-[var(--token-text-tertiary,#70757e)]">
                        支持使用动态变量插值（例如 &#123;&#123;brand_name&#125;&#125;）
                    </span>
                </div>
                <div className="flex flex-col gap-3 md:flex-row md:items-center">
                    <Input
                        value={currentTemplate?.subject || ""}
                        onChange={(e) => handleSubjectChange(e.target.value)}
                        placeholder="请输入邮件标题..."
                        className="flex-1"
                    />
                    <div className="flex max-w-md items-center rounded-lg border border-[var(--token-border,#23272f)] bg-[var(--token-bg-base,#0a0b0d)] px-3 py-1.5 text-xs text-[var(--token-text-secondary,#9aa0a6)]">
                        <span className="font-mono text-[var(--token-text-tertiary,#70757e)]">实际渲染：</span>
                        <span className="ml-1 truncate font-medium text-[var(--token-text-primary,#ededf0)]">
                            {compiledSubject}
                        </span>
                    </div>
                </div>
            </div>

            {/* 主工作区：双栏排版（左侧编辑/变量，右侧实时沙箱预览） */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                {/* 左侧编辑区域 (6 列) */}
                <div className="flex flex-col gap-3 lg:col-span-6">
                    <div className="flex items-center justify-between">
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setActiveTab("code")}
                                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                                    activeTab === "code"
                                        ? "bg-[var(--token-primary,#e11d74)] text-white"
                                        : "text-[var(--token-text-secondary,#9aa0a6)] hover:text-[var(--token-text-primary,#ededf0)]"
                                }`}
                            >
                                <Code2 className="h-3.5 w-3.5" />
                                HTML 源码
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab("variables")}
                                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                                    activeTab === "variables"
                                        ? "bg-[var(--token-primary,#e11d74)] text-white"
                                        : "text-[var(--token-text-secondary,#9aa0a6)] hover:text-[var(--token-text-primary,#ededf0)]"
                                }`}
                            >
                                <SlidersHorizontal className="h-3.5 w-3.5" />
                                测试变量调试 ({currentTemplate?.supportedVariables?.length || 0})
                            </button>
                        </div>
                        <span className="font-mono text-xs text-[var(--token-text-tertiary,#70757e)]">
                            Obsidian Dark / Responsive
                        </span>
                    </div>

                    {activeTab === "code" ? (
                        <div className="flex flex-col gap-2">
                            {/* 变量快速插入栏 */}
                            <div className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--token-text-secondary,#9aa0a6)]">
                                <span>点击插入变量：</span>
                                {currentTemplate?.supportedVariables?.map((v) => (
                                    <button
                                        key={v.key}
                                        type="button"
                                        onClick={() => insertVariableToHtml(v.key)}
                                        className="rounded border border-[var(--token-border,#23272f)] bg-[var(--token-bg-elevated,#131519)] px-2 py-0.5 font-mono text-xs text-[var(--token-text-primary,#ededf0)] transition hover:border-[var(--token-primary,#e11d74)] hover:text-[var(--token-primary,#e11d74)]"
                                        title={`${v.label} (默认: ${v.default})`}
                                    >
                                        &#123;&#123;{v.key}&#125;&#125;
                                    </button>
                                ))}
                            </div>

                            <textarea
                                value={currentTemplate?.html || ""}
                                onChange={(e) => handleHtmlChange(e.target.value)}
                                rows={24}
                                className="w-full rounded-2xl border border-[var(--token-border,#23272f)] bg-[var(--token-bg-elevated,#131519)] p-4 font-mono text-xs leading-relaxed text-[var(--token-text-primary,#ededf0)] outline-none focus:border-[var(--token-primary,#e11d74)]"
                                spellCheck={false}
                            />
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3 rounded-2xl border border-[var(--token-border,#23272f)] bg-[var(--token-bg-elevated,#131519)] p-4">
                            <p className="text-xs text-[var(--token-text-secondary,#9aa0a6)]">
                                修改测试变量以实时查看右侧沙箱预览效果，测试发信时将使用此组变量：
                            </p>
                            <div className="grid max-h-[480px] gap-3 overflow-y-auto pr-1">
                                {currentTemplate?.supportedVariables?.map((v) => (
                                    <div key={v.key} className="flex flex-col gap-1">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="font-mono font-semibold text-[var(--token-text-primary,#ededf0)]">
                                                &#123;&#123;{v.key}&#125;&#125;
                                            </span>
                                            <span className="text-[var(--token-text-tertiary,#70757e)]">
                                                {v.label}
                                            </span>
                                        </div>
                                        <Input
                                            value={currentVariables[v.key] ?? ""}
                                            onChange={(e) => handleVariableChange(v.key, e.target.value)}
                                            placeholder={`默认: ${v.default}`}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* 右侧实时沙箱预览区域 (6 列) */}
                <div className="flex flex-col gap-3 lg:col-span-6">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-[var(--token-text-primary,#ededf0)]">
                            实时邮件渲染预览
                        </span>
                        <div className="flex items-center gap-1 rounded-xl border border-[var(--token-border,#23272f)] bg-[var(--token-bg-elevated,#131519)] p-1 text-xs">
                            <button
                                type="button"
                                onClick={() => setPreviewDevice("desktop")}
                                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 transition ${
                                    previewDevice === "desktop"
                                        ? "bg-[var(--token-primary,#e11d74)] text-white font-medium"
                                        : "text-[var(--token-text-secondary,#9aa0a6)]"
                                }`}
                            >
                                <Monitor className="h-3.5 w-3.5" />
                                桌面端 (600px)
                            </button>
                            <button
                                type="button"
                                onClick={() => setPreviewDevice("mobile")}
                                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 transition ${
                                    previewDevice === "mobile"
                                        ? "bg-[var(--token-primary,#e11d74)] text-white font-medium"
                                        : "text-[var(--token-text-secondary,#9aa0a6)]"
                                }`}
                            >
                                <Smartphone className="h-3.5 w-3.5" />
                                移动端 (375px)
                            </button>
                        </div>
                    </div>

                    <div
                        className="mx-auto flex w-full flex-col items-center justify-center rounded-2xl border border-[var(--token-border,#23272f)] bg-[var(--token-bg-base,#0a0b0d)] p-3 transition"
                        style={{ maxWidth: previewDevice === "mobile" ? "410px" : "100%" }}
                    >
                        {previewDevice === "mobile" && (
                            <div className="mb-2 h-3.5 w-16 rounded-full bg-[var(--token-border,#23272f)]" />
                        )}
                        <iframe
                            title="邮件渲染预览"
                            srcDoc={compiledHtml}
                            sandbox="allow-same-origin"
                            className="w-full rounded-xl border border-[var(--token-border,#23272f)] shadow-2xl transition"
                            style={{
                                height: "580px",
                                maxWidth: previewDevice === "mobile" ? "375px" : "100%",
                                backgroundColor: "#0a0b0d",
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* 底部测试发信面板 */}
            <form
                onSubmit={handleSendTest}
                className="flex flex-col gap-4 rounded-2xl border border-[var(--token-border,#23272f)] bg-[var(--token-bg-elevated,#131519)] p-6"
            >
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h3 className="flex items-center gap-2 text-base font-bold text-[var(--token-text-primary,#ededf0)]">
                            <Send className="h-4 w-4 text-[var(--token-primary,#e11d74)]" />
                            向指定邮箱发送真实营销测试邮件
                        </h3>
                        <p className="mt-1 text-xs text-[var(--token-text-secondary,#9aa0a6)]">
                            将当前编辑器中编辑的【{currentTemplate?.name}】HTML 及上方变量，经由主站配置的 SMTP 服务真实发出，并写入脱敏审计日志。
                        </p>
                    </div>
                    <span className="text-xs text-[var(--token-text-tertiary,#70757e)]">
                        频次保护：每小时上限 10 封 · 记录脱敏日志
                    </span>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <Input
                        type="email"
                        required
                        value={testEmail}
                        onChange={(e) => setTestEmail(e.target.value)}
                        placeholder="输入接收测试邮件的邮箱（例如 your-email@example.com）"
                        className="flex-1"
                        size="large"
                    />
                    <Button
                        type="primary"
                        htmlType="submit"
                        size="large"
                        icon={<Mail className="h-4 w-4" />}
                        loading={sendingTest}
                        disabled={!overview?.smtpConfigured}
                    >
                        一键发送营销测试邮件
                    </Button>
                </div>

                {sendResult && (
                    <div
                        className={`rounded-xl border p-3.5 text-xs ${
                            sendResult.success
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                                : "border-rose-500/30 bg-rose-500/10 text-rose-400"
                        }`}
                    >
                        <div className="flex items-center justify-between">
                            <span>{sendResult.message}</span>
                            {sendResult.latencyMs !== undefined && (
                                <span className="font-mono">耗时: {sendResult.latencyMs}ms</span>
                            )}
                        </div>
                    </div>
                )}
            </form>
        </div>
    );
}
