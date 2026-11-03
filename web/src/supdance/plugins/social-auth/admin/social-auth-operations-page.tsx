import { useEffect, useState } from "react";
import { App, Button, Input, InputNumber, Skeleton } from "antd";
import { Activity, AlertTriangle, BarChart2, Download, RefreshCw, Search, Shield, Trash2, UserCheck, Users } from "lucide-react";

import { AdminPageFrame } from "@/pages/admin/components/admin-shell";
import { AdminStatusBadge } from "@/pages/admin/components/admin-ui";
import { IconButton, Switch } from "@/pages/admin/ui/controls";
import { adminUnbindSocialAuth, getSocialAuthLoginLogs, getSocialAuthOperationsOverview, searchSocialAuthUsers, updateSocialAuthPolicies } from "../api";
import { SocialProviderIcon } from "../components/social-provider-icons";
import type { OperationalPolicies, OperationsOverview, SocialLoginLogItem, UserSocialBindingAdminItem } from "../types";
import { SocialAuthNavTabs } from "./social-auth-nav-tabs";

export default function SocialAuthOperationsPage() {
    const { message, modal } = App.useApp();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [overview, setOverview] = useState<OperationsOverview | null>(null);

    // Policies form state
    const [policies, setPolicies] = useState<OperationalPolicies>({
        autoDirectRegistration: true,
        mandatoryEmailOnboarding: false,
        signupBonusCredits: 50,
        orphanAccountSafety: true,
    });
    const [savingPolicies, setSavingPolicies] = useState(false);

    // User search & support state
    const [userQuery, setUserQuery] = useState("");
    const [searchingUsers, setSearchingUsers] = useState(false);
    const [userResults, setUserResults] = useState<UserSocialBindingAdminItem[]>([]);
    const [searched, setSearched] = useState(false);

    // Audit logs state
    const [logs, setLogs] = useState<SocialLoginLogItem[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(false);

    const loadData = async (isInitial = false) => {
        if (isInitial) setLoading(true);
        else setRefreshing(true);
        try {
            const [ov, lg] = await Promise.all([getSocialAuthOperationsOverview(), getSocialAuthLoginLogs(50)]);
            setOverview(ov);
            if (ov.policies) {
                setPolicies(ov.policies);
            }
            setLogs(lg);
        } catch (err) {
            message.error(err instanceof Error ? err.message : "读取运营数据失败");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        void loadData(true);
    }, []);

    const handleSavePolicies = async () => {
        setSavingPolicies(true);
        try {
            const updated = await updateSocialAuthPolicies(policies);
            if (updated.policies) {
                setPolicies(updated.policies);
                setOverview(updated);
            }
            message.success("运营与安全控制策略已保存");
        } catch (err) {
            message.error(err instanceof Error ? err.message : "保存策略失败");
        } finally {
            setSavingPolicies(false);
        }
    };

    const handleSearchUsers = async () => {
        if (!userQuery.trim()) {
            setUserResults([]);
            setSearched(false);
            return;
        }
        setSearchingUsers(true);
        try {
            const results = await searchSocialAuthUsers(userQuery.trim(), 20);
            setUserResults(results);
            setSearched(true);
        } catch (err) {
            message.error(err instanceof Error ? err.message : "搜索用户失败");
        } finally {
            setSearchingUsers(false);
        }
    };

    const handleUnbind = (user: UserSocialBindingAdminItem, provider: string, providerUsername: string) => {
        modal.confirm({
            title: `确认解除 ${user.username} 的 ${provider.toUpperCase()} 绑定？`,
            content: `解除后用户将无法使用该社交账号 (${providerUsername || "已绑定账号"}) 直接登录。`,
            okText: "确认解绑",
            okType: "danger",
            cancelText: "取消",
            onOk: async () => {
                try {
                    await adminUnbindSocialAuth(user.userId, provider);
                    message.success(`已成功解除 ${user.username} 的 ${provider} 绑定`);
                    // Refresh current search results and overview
                    void handleSearchUsers();
                    void loadData(false);
                } catch (err) {
                    message.error(err instanceof Error ? err.message : "解绑失败");
                }
            },
        });
    };

    const handleExportLogsCsv = () => {
        if (logs.length === 0) {
            message.warning("暂无审计日志可供导出");
            return;
        }

        const headers = ["ID", "时间", "用户ID", "用户名", "渠道", "客户端IP", "结果", "说明"];
        const rows = logs.map((log) => [log.id, new Date(log.createdAt).toLocaleString("zh-CN"), log.userId, log.username || log.account, log.method || log.source, log.ip, log.result === "success" ? "成功" : "失败", log.message || log.reason || ""]);

        const csvContent = "\uFEFF" + [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `social-auth-audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        message.success("审计日志 CSV 导出成功");
    };

    if (loading && !overview) {
        return (
            <AdminPageFrame title="第三方登录运营与控制" description="全局入站策略、渠道绑定分布、用户绑定支持与安全审计日志" scroll>
                <div data-plugin-scope="social-auth" className="flex flex-col gap-4 py-2" role="status">
                    <SocialAuthNavTabs />
                    <Skeleton active paragraph={{ rows: 8 }} />
                </div>
            </AdminPageFrame>
        );
    }

    const providerDistribution = overview?.providerDistribution || {};
    const totalBindings = overview?.totalBindings || 0;
    const dailyActiveTrend = overview?.dailyActiveTrend || [];
    const maxTrendCount = Math.max(1, ...dailyActiveTrend.map((d) => d.count));

    return (
        <AdminPageFrame title="第三方登录运营与控制" description="全局入站策略、渠道绑定分布、用户绑定支持与安全审计日志" scroll>
            <div data-plugin-scope="social-auth" className="flex flex-col gap-5 py-2">
                {/* WeChat-style underline nav tabs */}
                <SocialAuthNavTabs />

                {/* Section 1: Global Operational Policies Card */}
                <div className="flex flex-col gap-4 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
                    <div className="flex items-center justify-between border-b border-[var(--admin-border)] pb-3">
                        <div className="flex items-center gap-2">
                            <Shield className="size-4 text-[var(--admin-text)]" />
                            <h2 className="text-sm font-semibold text-[var(--admin-text)]">全局入站与防孤立安全策略</h2>
                        </div>
                        <Button type="primary" size="small" loading={savingPolicies} onClick={() => void handleSavePolicies()}>
                            保存策略配置
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 text-xs">
                        {/* Policy 1: Auto Direct Registration */}
                        <div className="flex flex-col justify-between rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-2)] p-3">
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center justify-between">
                                    <strong className="text-[var(--admin-text)]">三方首次授权自动注册</strong>
                                    <Switch size="sm" checked={policies.autoDirectRegistration} onChange={(checked) => setPolicies((prev) => ({ ...prev, autoDirectRegistration: checked }))} aria-label="三方首次授权自动创建账号" />
                                </div>
                                <p className="text-[11px] text-[var(--admin-text-muted)] leading-relaxed mt-1">开启后，未提供邮箱的新访客将直接自动分配账号并完成会话建立，无缝进入创作台。</p>
                            </div>
                        </div>

                        {/* Policy 2: Mandatory Email Onboarding */}
                        <div className="flex flex-col justify-between rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-2)] p-3">
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center justify-between">
                                    <strong className="text-[var(--admin-text)]">强制补全安全邮箱</strong>
                                    <Switch size="sm" checked={policies.mandatoryEmailOnboarding} onChange={(checked) => setPolicies((prev) => ({ ...prev, mandatoryEmailOnboarding: checked }))} aria-label="强制补全或绑定邮箱" />
                                </div>
                                <p className="text-[11px] text-[var(--admin-text-muted)] leading-relaxed mt-1">要求缺乏邮箱的三方新用户在首次登录时补全有效安全邮箱，确保找回凭据安全。</p>
                            </div>
                        </div>

                        {/* Policy 3: Orphan Account Safety */}
                        <div className="flex flex-col justify-between rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-2)] p-3">
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center justify-between">
                                    <strong className="text-[var(--admin-text)]">防孤立账号安全拦截</strong>
                                    <Switch size="sm" checked={policies.orphanAccountSafety} onChange={(checked) => setPolicies((prev) => ({ ...prev, orphanAccountSafety: checked }))} aria-label="防孤立账号安全拦截" />
                                </div>
                                <p className="text-[11px] text-[var(--admin-text-muted)] leading-relaxed mt-1">未设置本地密码的用户尝试解绑最后一个社交登录途径时，系统强制拦截，杜绝死锁。</p>
                            </div>
                        </div>

                        {/* Policy 4: Signup Bonus Credits */}
                        <div className="flex flex-col justify-between rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-2)] p-3">
                            <div className="flex flex-col gap-1">
                                <strong className="text-[var(--admin-text)]">首次社交注册赠送额度</strong>
                                <p className="text-[11px] text-[var(--admin-text-muted)] leading-relaxed mt-0.5">新访客通过社交授权入站并创建账号时发放的算力积分奖励。</p>
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                                <InputNumber size="small" min={0} max={10000} value={policies.signupBonusCredits} onChange={(val) => setPolicies((prev) => ({ ...prev, signupBonusCredits: Number(val || 0) }))} className="w-24" />
                                <span className="text-[11px] text-[var(--admin-text-secondary)]">算力点 (Credits)</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Section 2: Paired Dashboard (Provider Distribution vs 30-Day Activity) */}
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                    {/* Distribution Card */}
                    <div className="flex flex-col gap-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
                        <div className="flex items-center justify-between border-b border-[var(--admin-border)] pb-2.5">
                            <div className="flex items-center gap-2">
                                <Users className="size-4 text-[var(--admin-text)]" />
                                <h3 className="text-sm font-semibold text-[var(--admin-text)]">渠道用户绑定分布</h3>
                            </div>
                            <span className="rounded-full bg-[var(--admin-surface-2)] px-2.5 py-0.5 text-xs font-mono text-[var(--admin-text-secondary)]">累计绑定 {totalBindings}</span>
                        </div>

                        <div className="flex flex-col gap-2.5 pt-1 text-xs">
                            {Object.keys(providerDistribution).length === 0 ? (
                                <div className="py-6 text-center text-[var(--admin-text-muted)]">暂无绑定数据</div>
                            ) : (
                                Object.entries(providerDistribution).map(([pid, count]) => {
                                    const percent = totalBindings > 0 ? Math.round((count / totalBindings) * 100) : 0;
                                    return (
                                        <div key={pid} className="flex flex-col gap-1">
                                            <div className="flex items-center justify-between">
                                                <span className="flex items-center gap-1.5 font-medium text-[var(--admin-text)] capitalize">
                                                    <SocialProviderIcon provider={pid} className="size-3.5" />
                                                    {pid}
                                                </span>
                                                <span className="font-mono text-[11px] text-[var(--admin-text-secondary)]">
                                                    {count} 人 ({percent}%)
                                                </span>
                                            </div>
                                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--admin-surface-2)]">
                                                <div className="h-full rounded-full bg-[var(--admin-text)] transition-all" style={{ width: `${percent}%` }} />
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* 30-Day Login Trend Card */}
                    <div className="flex flex-col gap-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
                        <div className="flex items-center justify-between border-b border-[var(--admin-border)] pb-2.5">
                            <div className="flex items-center gap-2">
                                <BarChart2 className="size-4 text-[var(--admin-text)]" />
                                <h3 className="text-sm font-semibold text-[var(--admin-text)]">近 30 天社交登录活跃度</h3>
                            </div>
                            <span className="rounded-full bg-[var(--admin-surface-2)] px-2.5 py-0.5 text-xs font-mono text-[var(--admin-text-secondary)]">近 30 天总登入 {overview?.totalLogins30d || 0}</span>
                        </div>

                        <div className="flex flex-col gap-2 pt-1 text-xs">
                            {dailyActiveTrend.length === 0 ? (
                                <div className="py-6 text-center text-[var(--admin-text-muted)]">暂无趋势记录</div>
                            ) : (
                                <div className="flex h-32 items-end gap-1 overflow-x-auto pt-4 pb-1">
                                    {dailyActiveTrend.map((item) => {
                                        const heightPercent = Math.max(8, Math.round((item.count / maxTrendCount) * 100));
                                        return (
                                            <div key={item.date} className="group relative flex flex-1 min-w-[8px] flex-col items-center justify-end h-full" title={`${item.date}: ${item.count} 次社交登录`}>
                                                <div className="w-full rounded-t bg-[var(--admin-text-secondary)] hover:bg-[var(--admin-text)] transition-all" style={{ height: `${heightPercent}%` }} />
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            <div className="flex items-center justify-between text-[11px] text-[var(--admin-text-muted)] border-t border-[var(--admin-border)] pt-2">
                                <span>30 天前</span>
                                <span>今日</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Section 3: User Identity Search & Support */}
                <div className="flex flex-col gap-4 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
                    <div className="flex flex-col gap-1 border-b border-[var(--admin-border)] pb-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2">
                            <UserCheck className="size-4 text-[var(--admin-text)]" />
                            <h2 className="text-sm font-semibold text-[var(--admin-text)]">用户社交绑定查询与解绑支持</h2>
                        </div>
                        <div className="flex items-center gap-2 mt-2 sm:mt-0">
                            <Input size="small" placeholder="输入用户名、邮箱或用户ID" value={userQuery} onChange={(e) => setUserQuery(e.target.value)} onPressEnter={() => void handleSearchUsers()} className="w-56" />
                            <Button size="small" icon={<Search className="size-3" />} loading={searchingUsers} onClick={() => void handleSearchUsers()}>
                                检索
                            </Button>
                        </div>
                    </div>

                    <div className="flex flex-col text-xs">
                        {searched && userResults.length === 0 ? (
                            <div className="py-6 text-center text-[var(--admin-text-muted)]">未检索到匹配社交绑定的用户</div>
                        ) : userResults.length === 0 ? (
                            <div className="py-4 text-center text-[var(--admin-text-muted)]">输入用户条件进行检索，支持查询具体账号名、昵称与绑定的第三方平台信息</div>
                        ) : (
                            <div className="divide-y divide-[var(--admin-border)]">
                                {userResults.map((user) => (
                                    <div key={user.userId} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2">
                                                <strong className="text-[var(--admin-text)]">{user.username}</strong>
                                                <code className="text-[11px] text-[var(--admin-text-muted)]">{user.userId}</code>
                                            </div>
                                            <span className="text-[11px] text-[var(--admin-text-secondary)]">{user.email || "未绑定邮箱"}</span>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2">
                                            {user.identities && user.identities.length > 0 ? (
                                                user.identities.map((id) => (
                                                    <div key={id.provider} className="flex items-center gap-1.5 rounded border border-[var(--admin-border)] bg-[var(--admin-surface-2)] px-2 py-1">
                                                        <SocialProviderIcon provider={id.provider} className="size-3.5" />
                                                        <span className="font-medium capitalize text-[var(--admin-text)]">{id.providerName || id.provider}:</span>
                                                        <span className="text-[var(--admin-text-secondary)]">{id.providerUsername || id.subject || "已绑定"}</span>
                                                        <Button
                                                            type="text"
                                                            size="small"
                                                            danger
                                                            className="h-5 px-1 py-0 ml-1 text-xs"
                                                            icon={<Trash2 className="size-3" />}
                                                            title={`解绑 ${id.provider}`}
                                                            onClick={() => handleUnbind(user, id.provider, id.providerUsername)}
                                                        >
                                                            解绑
                                                        </Button>
                                                    </div>
                                                ))
                                            ) : (
                                                <span className="text-[11px] text-[var(--admin-text-muted)]">暂无三方绑定</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Section 4: Audit Logs & CSV Export */}
                <div className="flex flex-col gap-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
                    <div className="flex items-center justify-between border-b border-[var(--admin-border)] pb-3">
                        <div className="flex items-center gap-2">
                            <Activity className="size-4 text-[var(--admin-text)]" />
                            <h2 className="text-sm font-semibold text-[var(--admin-text)]">社交登录安全审计日志</h2>
                            <span className="text-xs text-[var(--admin-text-muted)]">最近 {logs.length} 条</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button size="small" icon={<Download className="size-3" />} onClick={handleExportLogsCsv}>
                                导出 CSV 审计表
                            </Button>
                            <IconButton icon={RefreshCw} loading={refreshing} title="刷新日志" aria-label="刷新日志" onClick={() => void loadData(false)} />
                        </div>
                    </div>

                    <div className="overflow-x-auto text-xs">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-2)] text-[var(--admin-text-secondary)]">
                                    <th className="py-2 px-3 font-medium">时间</th>
                                    <th className="py-2 px-3 font-medium">账号 / 用户</th>
                                    <th className="py-2 px-3 font-medium">渠道</th>
                                    <th className="py-2 px-3 font-medium">IP 地址</th>
                                    <th className="py-2 px-3 font-medium">结果</th>
                                    <th className="py-2 px-3 font-medium">审计说明</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--admin-border)]">
                                {logs.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="py-6 text-center text-[var(--admin-text-muted)]">
                                            暂无审计日志记录
                                        </td>
                                    </tr>
                                ) : (
                                    logs.map((log) => (
                                        <tr key={log.id} className="hover:bg-[var(--admin-row-hover)] transition-colors">
                                            <td className="py-2 px-3 font-mono text-[11px] text-[var(--admin-text-secondary)] whitespace-nowrap">
                                                {new Date(log.createdAt).toLocaleString("zh-CN", {
                                                    month: "2-digit",
                                                    day: "2-digit",
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                    second: "2-digit",
                                                })}
                                            </td>
                                            <td className="py-2 px-3 font-medium text-[var(--admin-text)]">{log.username || log.account || log.userId}</td>
                                            <td className="py-2 px-3 capitalize">
                                                <span className="inline-flex items-center gap-1">
                                                    <SocialProviderIcon provider={log.method || log.source} className="size-3.5" />
                                                    {log.method || log.source}
                                                </span>
                                            </td>
                                            <td className="py-2 px-3 font-mono text-[11px] text-[var(--admin-text-muted)] whitespace-nowrap">{log.ip || "127.0.0.1"}</td>
                                            <td className="py-2 px-3">
                                                <AdminStatusBadge label={log.result === "success" ? "成功" : "失败"} tone={log.result === "success" ? "success" : "error"} />
                                            </td>
                                            <td className="py-2 px-3 text-[11px] text-[var(--admin-text-muted)]">{log.message || log.reason || "-"}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </AdminPageFrame>
    );
}
