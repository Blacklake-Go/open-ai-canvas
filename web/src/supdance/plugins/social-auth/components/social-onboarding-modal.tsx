import { useEffect, useMemo, useState } from "react";
import { App, Button, Checkbox, Input, Skeleton } from "antd";
import { CheckCircle2, Eye, EyeOff, Lock, Mail, ShieldCheck, Sparkles, User, UserCheck, X } from "lucide-react";
import { AppModal } from "@/components/ui/product/app-modal";
import { completeSocialOnboarding, getSocialOnboardingProfile, sendSocialOnboardingEmailCode } from "../api";
import { SocialProviderIcon } from "./social-provider-icons";
import type { OnboardingProfileView } from "../types";
import { useAppearanceStore } from "@/stores/use-appearance-store";
import { usePluginStore, selectPluginEffectivelyEnabled } from "@/stores/use-plugin-store";
import { useI18n } from "@/supdance/plugins/i18n";

const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,30}$/;

function cleanupUrl() {
    const url = new URL(window.location.href);
    url.searchParams.delete("onboarding");
    url.searchParams.delete("ticket");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
}

export function SocialOnboardingModal() {
    const { message, modal } = App.useApp();
    const { t } = useI18n();
    const brandName = useAppearanceStore((state) => state.appearance.brandName);
    const active = usePluginStore(selectPluginEffectivelyEnabled("supdance-social-auth", true));

    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [profile, setProfile] = useState<OnboardingProfileView | null>(null);

    // Form states
    const [username, setUsername] = useState("");
    const [nickname, setNickname] = useState("");
    const [email, setEmail] = useState("");
    const [emailProof, setEmailProof] = useState<{ email: string; ticket: string } | null>(null);
    const [emailCode, setEmailCode] = useState("");
    const [sendingEmail, setSendingEmail] = useState(false);
    const [emailRetryAt, setEmailRetryAt] = useState(0);
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [acceptedTerms, setAcceptedTerms] = useState(false);

    useEffect(() => {
        const checkUrl = () => {
            const params = new URLSearchParams(window.location.search);
            setOpen(active && params.get("onboarding") === "1");
        };

        checkUrl();
        window.addEventListener("popstate", checkUrl);
        return () => window.removeEventListener("popstate", checkUrl);
    }, [active]);

    useEffect(() => {
        if (!open) return;

        const controller = new AbortController();
        setLoading(true);

        getSocialOnboardingProfile(controller.signal)
            .then((data) => {
                if (controller.signal.aborted) return;
                setProfile(data);
                // Pre-fill username: clean up providerUsername or displayName to alphanumeric
                const baseCandidate = (data.providerUsername?.split("@")[0] || data.displayName || "creator").replace(/[^a-zA-Z0-9_-]/g, "").toLowerCase();
                const initialUsername = (baseCandidate.length >= 3 ? baseCandidate : `user_${baseCandidate}`).slice(0, 20);

                setUsername(initialUsername);
                setNickname(data.displayName || initialUsername);
                setEmail(data.email || "");
            })
            .catch((err) => {
                if (controller.signal.aborted) return;
                const msg = err instanceof Error ? err.message : "获取授权入站信息失败，票据可能已过期";
                message.error(msg);
                // Clean up invalid parameters
                cleanupUrl();
                setOpen(false);
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false);
            });

        return () => controller.abort();
    }, [open, message]);

    useEffect(() => {
        if (!emailRetryAt) return;
        const timeout = window.setTimeout(() => setEmailRetryAt(0), Math.max(0, emailRetryAt - Date.now()));
        return () => window.clearTimeout(timeout);
    }, [emailRetryAt]);

    const isUsernameValid = useMemo(() => USERNAME_REGEX.test(username.trim()), [username]);
    const isPasswordValid = useMemo(() => {
        if (!password) return true; // Password is optional
        return password.length >= 6;
    }, [password]);
    const isPasswordMatch = useMemo(() => {
        if (!password) return true;
        return password === confirmPassword;
    }, [password, confirmPassword]);

    const hasProviderEmail = !!profile?.emailAutoBound;
    const normalizedEmail = email.trim().toLowerCase();
    const needsEmailProof = !hasProviderEmail && (Boolean(normalizedEmail) || !!profile?.emailRequired);
    const validEmailProof = emailProof?.email === normalizedEmail && /^\d{6}$/.test(emailCode);

    const sendEmailCode = async () => {
        if (!normalizedEmail || sendingEmail || emailRetryAt) return;
        setSendingEmail(true);
        try {
            const result = await sendSocialOnboardingEmailCode(normalizedEmail);
            setEmailProof({ email: normalizedEmail, ticket: result.ticket });
            setEmailCode("");
            setEmailRetryAt(Date.now() + result.retryAfter * 1000);
            message.success(t("settings.code_sent_minutes", { minutes: Math.ceil(result.expiresIn / 60) }));
        } catch (err) {
            message.error(err instanceof Error ? err.message : t("settings.send_code_failed"));
        } finally {
            setSendingEmail(false);
        }
    };

    const handleExit = () => {
        modal.confirm({
            title: t("auth.onboarding.exit", {}, "退出"),
            content: t("auth.onboarding.exit_confirm", {}, "确定退出当前入站配置？未完成的信息将不会保存。"),
            okText: t("common.confirm", {}, "确定退出"),
            cancelText: t("common.cancel", {}, "继续配置"),
            centered: true,
            onOk: () => {
                cleanupUrl();
                setOpen(false);
                window.location.href = "/login";
            },
        });
    };

    const handleSubmit = async () => {
        if (!profile || (needsEmailProof && !validEmailProof)) return;
        if (!isUsernameValid) {
            message.warning(t("auth.onboarding.creator_id_placeholder", {}, "用户名需为 3-30 位字母、数字、下划线或短横线"));
            return;
        }
        if (!acceptedTerms) {
            message.warning(t("auth.agree_terms_first", {}, "请先勾选同意服务协议与隐私条款"));
            return;
        }
        if (password && !isPasswordValid) {
            message.warning(t("auth.password_min_length", {}, "设置密码长度至少需为 6 位"));
            return;
        }
        if (password && !isPasswordMatch) {
            message.warning(t("auth.password_mismatch", {}, "两次输入的密码不一致"));
            return;
        }

        try {
            setSubmitting(true);
            const res = await completeSocialOnboarding({
                acceptedTerms,
                username: username.trim(),
                displayName: nickname.trim() || undefined,
                nickname: nickname.trim() || undefined,
                email: normalizedEmail || undefined,
                emailTicket: needsEmailProof ? emailProof?.ticket : undefined,
                emailCode: needsEmailProof ? emailCode : undefined,
                password: password ? password : undefined,
            });

            window.location.replace(res.next);
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
                className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 sm:p-7 text-foreground shadow-2xl backdrop-blur-2xl"
                style={{
                    backgroundImage: "radial-gradient(ellipse 90% 50% at 50% -20%, rgba(var(--primary-rgb, 0, 245, 212), 0.08), transparent)",
                }}
            >
                {/* Exit button */}
                <button
                    type="button"
                    onClick={handleExit}
                    aria-label={t("auth.onboarding.exit", {}, "退出")}
                    className="absolute right-4 top-4 z-10 flex size-8 items-center justify-center rounded-full border border-border/50 bg-surface-subtle text-foreground/60 transition-all hover:border-border hover:bg-surface-hover hover:text-foreground active:scale-95"
                >
                    <X className="size-4" />
                </button>

                {/* Header Badge & Title */}
                <div className="flex flex-col items-center text-center pr-4">
                    <div className="relative mb-3 flex size-14 items-center justify-center rounded-2xl border border-border bg-surface-subtle p-3 shadow-inner">
                        {profile?.provider ? <SocialProviderIcon provider={profile.provider} className="size-8" /> : <Sparkles className="size-8 text-primary" />}
                        <span className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-card">
                            <CheckCircle2 className="size-3.5 stroke-[2.5]" />
                        </span>
                    </div>

                    <h2 className="text-xl font-bold tracking-tight text-foreground">{t("auth.onboarding.title", { brand: brandName || "SupDance" }, "欢迎加入 SupDance")}</h2>
                    <p className="mt-1 text-xs text-foreground/60">{t("auth.onboarding.subtitle", {}, "完善基础信息即可开启创作")}</p>
                </div>

                {loading ? (
                    <div className="my-8 space-y-4">
                        <Skeleton active paragraph={{ rows: 4 }} />
                    </div>
                ) : (
                    <div className="mt-5 space-y-4">
                        {/* Third-party verified info card */}
                        <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-subtle p-3">
                            {profile?.avatarUrl ? (
                                <img src={profile.avatarUrl} alt="Avatar" className="size-10 rounded-full border border-border object-cover" />
                            ) : (
                                <div className="flex size-10 items-center justify-center rounded-full bg-surface-raised text-foreground/50">
                                    <User className="size-5" />
                                </div>
                            )}
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="truncate text-sm font-semibold text-foreground">{profile?.displayName || t("auth.onboarding.verified_identity", {}, "第三方用户")}</span>
                                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                                        {t("auth.onboarding.authorized_badge", { provider: profile?.providerName || "第三方" }, `${profile?.providerName || "第三方"} 授权`)}
                                    </span>
                                </div>
                                <div className="truncate text-xs text-foreground/50">{profile?.providerUsername || profile?.email || t("auth.onboarding.verified_identity", {}, "已验证第三方身份")}</div>
                            </div>
                        </div>

                        {/* Email binding section */}
                        <div>
                            <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-foreground/80">
                                <span className="flex items-center gap-1.5">
                                    <Mail className="size-3.5 text-foreground/50" />
                                    <span>{t("auth.onboarding.bind_email", {}, "绑定邮箱")}</span>
                                </span>
                                {hasProviderEmail ? (
                                    <span className="flex items-center gap-1 text-xs font-medium text-emerald-500">
                                        <ShieldCheck className="size-3" />
                                        {t("auth.onboarding.email_verified_auto", {}, "第三方已自动验证")}
                                    </span>
                                ) : null}
                            </div>

                            <Input
                                value={email}
                                onChange={(e) => {
                                    setEmail(e.target.value);
                                    setEmailProof(null);
                                    setEmailCode("");
                                }}
                                disabled={hasProviderEmail}
                                type="email"
                                autoComplete="email"
                                aria-label={t("auth.onboarding.bind_email")}
                                aria-required={profile?.emailRequired}
                                placeholder={profile?.emailRequired ? t("auth.onboarding.bind_email") : t("auth.onboarding.email_placeholder")}
                                prefix={<Mail className="size-3.5 text-foreground/40" />}
                                className={`h-10 rounded-lg border border-border bg-surface-subtle text-sm text-foreground placeholder:text-foreground/35 ${hasProviderEmail ? "cursor-not-allowed opacity-80" : ""}`}
                            />
                            {needsEmailProof && (
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                    <Input
                                        value={emailCode}
                                        onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                        aria-label={t("settings.email_code")}
                                        placeholder={t("settings.email_code")}
                                        inputMode="numeric"
                                        autoComplete="one-time-code"
                                        className="min-h-11 min-w-32 flex-1"
                                    />
                                    <Button className="min-h-11" onClick={() => void sendEmailCode()} disabled={!normalizedEmail || !!emailRetryAt} loading={sendingEmail}>
                                        {t("settings.send_code")}
                                    </Button>
                                </div>
                            )}
                        </div>

                        {/* Username and Nickname Section */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-foreground/85">
                                    {t("auth.onboarding.creator_id", {}, "创作者 ID")} <span className="text-primary">*</span>
                                </label>
                                <Input
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder={t("auth.onboarding.creator_id_placeholder", {}, "3-30 位字母/数字/下划线")}
                                    prefix={<span className="text-foreground/40">@</span>}
                                    status={username && !isUsernameValid ? "error" : ""}
                                    className="h-10 rounded-lg border border-border bg-surface-subtle text-sm text-foreground placeholder:text-foreground/35"
                                />
                            </div>

                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-foreground/85">{t("auth.onboarding.display_name", {}, "显示昵称")}</label>
                                <Input
                                    value={nickname}
                                    onChange={(e) => setNickname(e.target.value)}
                                    placeholder={t("auth.onboarding.display_name_placeholder", {}, "输入显示昵称")}
                                    prefix={<UserCheck className="size-3.5 text-foreground/40" />}
                                    className="h-10 rounded-lg border border-border bg-surface-subtle text-sm text-foreground placeholder:text-foreground/35"
                                />
                            </div>
                        </div>

                        {/* Optional Password Section */}
                        <div className="rounded-xl border border-border bg-surface-subtle p-3.5">
                            <div className="mb-2 flex items-center justify-between">
                                <span className="flex items-center gap-1.5 text-xs font-medium text-foreground/80">
                                    <Lock className="size-3.5 text-foreground/50" />
                                    <span>{t("auth.onboarding.optional_password", {}, "设置独立登录密码（可选）")}</span>
                                </span>
                            </div>

                            <div className="space-y-2">
                                <Input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder={t("auth.onboarding.password_placeholder", {}, "至少 6 位（留空仅使用第三方登录）")}
                                    suffix={
                                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-foreground/40 hover:text-foreground">
                                            {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                                        </button>
                                    }
                                    className="h-9 rounded-lg border border-border bg-card text-xs text-foreground placeholder:text-foreground/35"
                                />

                                {password ? (
                                    <Input
                                        type={showPassword ? "text" : "password"}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder={t("auth.onboarding.password_confirm", {}, "确认密码")}
                                        status={confirmPassword && !isPasswordMatch ? "error" : ""}
                                        className="h-9 rounded-lg border border-border bg-card text-xs text-foreground placeholder:text-foreground/35"
                                    />
                                ) : null}

                                {password && !isPasswordMatch ? <p className="text-xs text-rose-400">{t("auth.password_mismatch", {}, "两次输入的密码不一致")}</p> : null}
                            </div>
                        </div>

                        {/* Terms and conditions */}
                        <div className="flex items-center gap-2 pt-1">
                            <Checkbox checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} className="text-xs text-foreground/70">
                                {t("auth.onboarding.agree_prefix", {}, "我已阅读并同意")}{" "}
                                <a href="/terms" target="_blank" rel="noreferrer" className="text-primary hover:underline">
                                    {t("auth.onboarding.terms_service", {}, "《用户服务协议》")}
                                </a>{" "}
                                {t("auth.onboarding.terms_and", {}, "与")}{" "}
                                <a href="/privacy" target="_blank" rel="noreferrer" className="text-primary hover:underline">
                                    {t("auth.onboarding.terms_privacy", {}, "《隐私政策》")}
                                </a>
                            </Checkbox>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-3 pt-2">
                            <Button
                                type="primary"
                                loading={submitting}
                                disabled={!profile || !isUsernameValid || (Boolean(password) && (!isPasswordValid || !isPasswordMatch)) || (needsEmailProof && !validEmailProof) || !acceptedTerms}
                                onClick={handleSubmit}
                                className="h-11 flex-1 rounded-xl font-bold active:scale-[0.98] border-none shadow-sm !bg-primary !text-primary-foreground hover:opacity-90"
                            >
                                {t("auth.onboarding.submit", { brand: brandName || "SupDance" }, `完成配置并进入 ${brandName || "SupDance"}`)}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </AppModal>
    );
}
