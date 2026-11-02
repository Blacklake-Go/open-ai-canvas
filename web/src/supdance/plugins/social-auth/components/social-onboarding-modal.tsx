import { useEffect, useMemo, useState } from "react";
import { App, Button, Checkbox, Input, Skeleton } from "antd";
import { CheckCircle2, Eye, EyeOff, Lock, Mail, ShieldAlert, ShieldCheck, Sparkles, User, UserCheck } from "lucide-react";
import { AppModal } from "@/components/ui/product/app-modal";
import { completeSocialOnboarding, getSocialOnboardingProfile } from "../api";
import { SocialProviderIcon } from "./social-provider-icons";
import type { OnboardingProfileView } from "../types";
import { applyUserSession } from "@/lib/user-session";
import { useUserStore } from "@/stores/use-user-store";
import { usePluginStore, selectPluginEffectivelyEnabled } from "@/stores/use-plugin-store";

const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,30}$/;

export function SocialOnboardingModal() {
    const { message } = App.useApp();
    const currentUser = useUserStore((state) => state.user);
    const active = usePluginStore(selectPluginEffectivelyEnabled("supdance-social-auth", true));

    const [open, setOpen] = useState(false);
    const [ticket, setTicket] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [profile, setProfile] = useState<OnboardingProfileView | null>(null);

    // Form states
    const [username, setUsername] = useState("");
    const [nickname, setNickname] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [acceptedTerms, setAcceptedTerms] = useState(false);

    useEffect(() => {
        if (!active) setOpen(false);
    }, [active]);

    // Check URL parameters for onboarding ticket on mount and on history changes
    useEffect(() => {
        const checkUrlTicket = () => {
            const params = new URLSearchParams(window.location.search);
            const isOnboarding = params.get("onboarding") === "1";
            const ticketParam = params.get("ticket");

            if (isOnboarding && ticketParam) {
                setTicket(ticketParam);
                setOpen(true);
                cleanupUrl();
            }
        };

        checkUrlTicket();
        window.addEventListener("popstate", checkUrlTicket);
        return () => window.removeEventListener("popstate", checkUrlTicket);
    }, []);

    // Load onboarding profile when ticket changes
    useEffect(() => {
        if (!ticket || !open) return;

        let cancelled = false;
        setLoading(true);

        getSocialOnboardingProfile(ticket)
            .then((data) => {
                if (cancelled) return;
                setProfile(data);
                // Pre-fill username: clean up providerUsername or displayName to alphanumeric
                const baseCandidate = (data.providerUsername?.split("@")[0] || data.displayName || "creator").replace(/[^a-zA-Z0-9_-]/g, "").toLowerCase();
                const initialUsername = (baseCandidate.length >= 3 ? baseCandidate : `user_${baseCandidate}`).slice(0, 20);

                setUsername(initialUsername);
                setNickname(data.displayName || initialUsername);
                setEmail(data.email || "");
            })
            .catch((err) => {
                if (cancelled) return;
                const msg = err instanceof Error ? err.message : "获取授权入站信息失败，票据可能已过期";
                message.error(msg);
                // Clean up invalid parameters
                cleanupUrl();
                setOpen(false);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [ticket, open, message]);

    const cleanupUrl = () => {
        const url = new URL(window.location.href);
        url.searchParams.delete("onboarding");
        url.searchParams.delete("ticket");
        const nextQuery = url.searchParams.toString();
        const nextUrl = url.pathname + (nextQuery ? `?${nextQuery}` : "") + url.hash;
        window.history.replaceState({}, "", nextUrl);
    };

    const isUsernameValid = useMemo(() => USERNAME_REGEX.test(username.trim()), [username]);
    const isPasswordValid = useMemo(() => {
        if (!password) return true; // Password is optional
        return password.length >= 6;
    }, [password]);
    const isPasswordMatch = useMemo(() => {
        if (!password) return true;
        return password === confirmPassword;
    }, [password, confirmPassword]);

    const hasProviderEmail = Boolean(profile?.email && profile.email.trim().length > 0);

    const handleSubmit = async () => {
        if (!ticket) return;
        if (!isUsernameValid) {
            message.warning("用户名需为 3-30 位字母、数字、下划线或短横线");
            return;
        }
        if (!acceptedTerms) {
            message.warning("请先勾选同意服务协议与隐私条款");
            return;
        }
        if (password && !isPasswordValid) {
            message.warning("设置密码长度至少需为 6 位");
            return;
        }
        if (password && !isPasswordMatch) {
            message.warning("两次输入的密码不一致");
            return;
        }

        try {
            setSubmitting(true);
            const res = await completeSocialOnboarding({
                acceptedTerms,
                ticket,
                ticketId: ticket,
                username: username.trim(),
                displayName: nickname.trim() || undefined,
                nickname: nickname.trim() || undefined,
                email: email.trim() || undefined,
                password: password ? password : undefined,
            });

            const resolvedUser = res.user || (res as any).User || (res as any).session?.user || (res as any).Session?.user;
            const resolvedNext = res.next || (res as any).Next || "/";

            message.success({
                content: `欢迎来到 SupDance 影策，${resolvedUser?.displayName || resolvedUser?.username || "创作者"}！`,
                icon: <Sparkles className="size-4 text-[#00f5d4]" />,
            });

            const { getAuthSession } = await import("@/services/api/auth");
            try {
                const sessionPayload = await getAuthSession();
                await applyUserSession(sessionPayload);
            } catch {
                if (resolvedUser) {
                    await applyUserSession({ user: resolvedUser });
                }
            }

            cleanupUrl();
            setOpen(false);

            if (resolvedNext && resolvedNext !== window.location.pathname) {
                window.location.href = resolvedNext;
            }
        } catch (err) {
            message.error(err instanceof Error ? err.message : "入站配置保存失败，请重试");
        } finally {
            setSubmitting(false);
        }
    };

    if (!open) return null;

    return (
        <AppModal open={open} flush closable={false} maskClosable={false} footer={null} width={520} centered>
            <div
                className="relative overflow-hidden rounded-2xl border border-white/[0.08] p-6 sm:p-7 text-[#FAFAFA] shadow-[0_16px_48px_rgba(0,0,0,0.60)] backdrop-blur-2xl"
                style={{
                    backgroundColor: "#1A1A1A",
                    backgroundImage: "radial-gradient(ellipse 90% 50% at 50% -20%, rgba(0, 245, 212, 0.08), transparent)",
                }}
            >
                {/* Header Badge & Title */}
                <div className="flex flex-col items-center text-center">
                    <div className="relative mb-3 flex size-14 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.04] p-3 shadow-inner">
                        {profile?.provider ? <SocialProviderIcon provider={profile.provider} className="size-8" /> : <Sparkles className="size-8 text-[#00f5d4]" />}
                        <span className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full bg-[#00f5d4] text-[#0e1117] ring-2 ring-[#0e1117]">
                            <CheckCircle2 className="size-3.5 stroke-[2.5]" />
                        </span>
                    </div>

                    <h2 className="text-xl font-bold tracking-tight text-white">欢迎加入 SupDance</h2>
                    <p className="mt-1 text-xs text-foreground/60">已成功通过 {profile?.providerName || "第三方账号"} 授权，完成入站配置后立即开启创作</p>
                </div>

                {loading ? (
                    <div className="my-8 space-y-4">
                        <Skeleton active paragraph={{ rows: 4 }} />
                    </div>
                ) : (
                    <div className="mt-6 space-y-5">
                        {/* Third-party verified info card */}
                        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
                            {profile?.avatarUrl ? (
                                <img src={profile.avatarUrl} alt="Avatar" className="size-11 rounded-full border border-white/20 object-cover" />
                            ) : (
                                <div className="flex size-11 items-center justify-center rounded-full bg-white/10 text-foreground/50">
                                    <User className="size-5" />
                                </div>
                            )}
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="truncate text-sm font-semibold text-white">{profile?.displayName || "第三方用户"}</span>
                                    <span className="rounded-full bg-[#00f5d4]/10 px-2 py-0.5 text-[var(--fs-label)] font-medium text-[#00f5d4]">{profile?.providerName} 授权</span>
                                </div>
                                <div className="truncate text-xs text-foreground/50">{profile?.providerUsername || profile?.email || "已验证第三方身份"}</div>
                            </div>
                        </div>

                        {/* Email binding section */}
                        <div>
                            <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-foreground/80">
                                <span className="flex items-center gap-1.5">
                                    <Mail className="size-3.5 text-foreground/50" />
                                    <span>绑定邮箱</span>
                                </span>
                                {hasProviderEmail ? (
                                    <span className="flex items-center gap-1 text-[var(--fs-label)] text-[#00f5d4]">
                                        <ShieldCheck className="size-3" />
                                        已自 {profile?.providerName} 自动验证绑定 🔒
                                    </span>
                                ) : (
                                    <span className="text-[var(--fs-label)] text-foreground/40">建议绑定以接收重要通知与找回密码</span>
                                )}
                            </div>

                            <Input
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={hasProviderEmail}
                                placeholder="输入您的邮箱"
                                prefix={<Mail className="size-3.5 text-foreground/40" />}
                                className={`h-10 rounded-lg border-white/10 bg-white/[0.04] text-sm text-white placeholder:text-foreground/30 ${hasProviderEmail ? "cursor-not-allowed opacity-80" : ""}`}
                            />
                            {hasProviderEmail && <p className="mt-1 text-[var(--fs-label)] text-foreground/45">第三方渠道返回了已验证的邮箱地址，已自动为您绑定，无需重复核验。</p>}
                        </div>

                        {/* Username and Nickname Section */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-white/85">
                                    创作者 ID <span className="text-[#00f5d4]">*</span>
                                </label>
                                <Input
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="3-30位字母数字"
                                    prefix={<span className="text-white/40">@</span>}
                                    status={username && !isUsernameValid ? "error" : ""}
                                    className="h-10 rounded-lg border-white/10 bg-[#171717] text-sm text-white placeholder:text-white/30"
                                />
                                {username && !isUsernameValid ? <p className="mt-1 text-[var(--fs-label)] text-rose-400">字母/数字/下划线(3-30字符)</p> : <p className="mt-1 text-[var(--fs-label)] text-white/50">作品署名与空间链接</p>}
                            </div>

                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-white/85">显示昵称</label>
                                <Input
                                    value={nickname}
                                    onChange={(e) => setNickname(e.target.value)}
                                    placeholder="输入显示昵称"
                                    prefix={<UserCheck className="size-3.5 text-white/40" />}
                                    className="h-10 rounded-lg border-white/10 bg-[#171717] text-sm text-white placeholder:text-white/30"
                                />
                                <p className="mt-1 text-[var(--fs-label)] text-white/50">社区与创作台展示名称</p>
                            </div>
                        </div>

                        {/* Optional Password Section */}
                        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3.5">
                            <div className="mb-2 flex items-center justify-between">
                                <span className="flex items-center gap-1.5 text-xs font-medium text-foreground/80">
                                    <Lock className="size-3.5 text-foreground/50" />
                                    <span>设置独立登录密码（可选）</span>
                                </span>
                                <span className="text-[var(--fs-label)] text-foreground/40">支持后续使用账号/邮箱密码直接登录</span>
                            </div>

                            <div className="space-y-2">
                                <Input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="至少 6 位（留空则仅使用第三方登录）"
                                    suffix={
                                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-foreground/40 hover:text-foreground">
                                            {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                                        </button>
                                    }
                                    className="h-9 rounded-lg border-white/10 bg-white/[0.04] text-xs text-white placeholder:text-foreground/30"
                                />

                                {password ? (
                                    <Input
                                        type={showPassword ? "text" : "password"}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="确认密码"
                                        status={confirmPassword && !isPasswordMatch ? "error" : ""}
                                        className="h-9 rounded-lg border-white/10 bg-white/[0.04] text-xs text-white placeholder:text-foreground/30"
                                    />
                                ) : null}

                                {password && !isPasswordMatch ? <p className="text-[var(--fs-label)] text-rose-400">两次输入的密码不一致</p> : null}
                            </div>
                        </div>

                        {/* Terms and conditions */}
                        <div className="flex items-center gap-2 pt-1">
                            <Checkbox checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} className="text-xs text-foreground/60">
                                我已阅读并同意
                                <a href="/terms" target="_blank" rel="noreferrer" className="mx-1 text-[#00f5d4] hover:underline">
                                    《用户服务协议》
                                </a>
                                与
                                <a href="/privacy" target="_blank" rel="noreferrer" className="ml-1 text-[#00f5d4] hover:underline">
                                    《隐私政策》
                                </a>
                            </Checkbox>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-3 pt-2">
                            <Button
                                type="primary"
                                loading={submitting}
                                disabled={!isUsernameValid || (Boolean(password) && (!isPasswordValid || !isPasswordMatch)) || !acceptedTerms}
                                onClick={handleSubmit}
                                style={{ backgroundColor: "#00f5d4", color: "#0e1117", borderColor: "#00f5d4" }}
                                className="h-11 flex-1 rounded-xl font-bold active:scale-[0.98] border-none shadow-none"
                            >
                                完成配置并进入 SupDance
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </AppModal>
    );
}
