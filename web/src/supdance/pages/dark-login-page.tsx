import { type FormEvent, useEffect, useState } from "react";
import { App, Button, Checkbox, Divider, Input } from "antd";
import { ArrowRight, Film, LockKeyhole, Sparkles, UserRound, Video } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router";

import { BrandLogo } from "@/components/brand/brand-logo";
import { getAuthSession, login } from "@/services/api/auth";
import { useUserStore } from "@/stores/use-user-store";
import { TopbarLanguageSwitcher, useI18n } from "@/supdance/plugins/i18n";
import { SocialLoginButtons } from "../plugins/social-auth/components/social-login-buttons";

export default function DarkLoginPage() {
    const { t } = useI18n();
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const { message } = App.useApp();

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [acceptedTerms, setAcceptedTerms] = useState(true);
    const [hasSocialProviders, setHasSocialProviders] = useState(false);

    const next = safeNext(params.get("next"));
    const user = useUserStore((state) => state.user);
    const hydrated = useUserStore((state) => state.hydrated);

    useEffect(() => {
        if (hydrated && user) {
            navigate(next, { replace: true });
        }
    }, [hydrated, user, next, navigate]);

    useEffect(() => {
        const oauthError = params.get("oauth_error");
        if (oauthError) {
            message.error(decodeURIComponent(oauthError));
        }
    }, [message, params]);

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!acceptedTerms) {
            message.warning("请先勾选并同意《服务协议》和《隐私政策》");
            return;
        }

        setSubmitting(true);
        try {
            await login({ username, password });
            const { applyUserSession } = await import("@/lib/user-session");
            await applyUserSession(await getAuthSession());
            message.success(t("auth.login_success", undefined, "登录成功"));
            navigate(next, { replace: true });
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("auth.login_failed", undefined, "登录失败"));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="relative min-h-screen w-full bg-[var(--auth-page-bg)] text-foreground flex flex-col justify-between overflow-x-hidden selection:bg-foreground/15 selection:text-foreground">
            {/* Background Grid Pattern & Ambient Glow (Cold Tech / Dark Studio aesthetic per spec) */}
            <div
                className="pointer-events-none absolute inset-0 opacity-15"
                style={{
                    backgroundImage: `radial-gradient(circle at 1px 1px, color-mix(in srgb, var(--foreground) 12%, transparent) 1px, transparent 0)`,
                    backgroundSize: "32px 32px",
                }}
            />
            <div className="pointer-events-none absolute -top-40 left-1/4 h-96 w-96 rounded-full bg-[var(--auth-accent)]/[0.06] blur-[140px]" />
            <div className="pointer-events-none absolute top-1/2 right-10 h-80 w-80 rounded-full bg-primary/[0.04] blur-[120px]" />

            {/* Top Navbar */}
            <header className="relative z-10 flex items-center justify-between border-b border-border bg-[var(--auth-panel-bg)]/85 px-6 py-4.5 backdrop-blur-md lg:px-12">
                <Link to="/" className="flex items-center gap-3 group">
                    <div className="flex size-10 items-center justify-center rounded-xl border border-border bg-card p-0.5 shadow-sm transition-transform group-hover:scale-105">
                        <BrandLogo className="size-full rounded-lg" alt="SupDance" fallback={<Sparkles className="size-5 text-foreground" />} />
                    </div>
                    <div>
                        <span className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                            SupDance 影策
                            <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[var(--fs-label)] font-semibold text-muted-foreground">AI 影视引擎</span>
                        </span>
                    </div>
                </Link>

                <div className="flex items-center gap-4">
                    <TopbarLanguageSwitcher />
                    <div className="h-4 w-px bg-border" />
                    <span className="text-xs text-muted-foreground hidden sm:inline">还没有账号？</span>
                    <Link to={`/register?next=${encodeURIComponent(next)}`} className="rounded-[var(--button-radius)] border border-border bg-card px-3.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted active:scale-[0.98]">
                        免费注册
                    </Link>
                </div>
            </header>

            {/* Main Stage */}
            <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center p-6 lg:flex-row lg:gap-16">
                {/* Left Brand Visual Showcase */}
                <div className="hidden flex-1 flex-col justify-center space-y-6 lg:flex">
                    <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3.5 py-1 text-xs font-medium text-foreground backdrop-blur">
                        <Sparkles className="size-3.5" />
                        全新一代 AI 电影与短剧创作工作台
                    </div>

                    <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:leading-tight">
                        把无限想象力，
                        <br />
                        化作真实的
                        <span className="bg-gradient-to-r from-[var(--auth-accent)] via-foreground/80 to-muted-foreground bg-clip-text text-transparent ml-2">光影世界</span>
                    </h1>

                    <p className="max-w-md text-sm leading-relaxed text-muted-foreground">从智能剧本拆解、高精角色分镜设计，到端到端视频生成与画布流编排，为独立创作者与影视团队提供工业级 AI 生产力。</p>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                        <div className="rounded-xl border border-border bg-[var(--auth-card-bg)] p-3.5 backdrop-blur transition-colors hover:border-foreground/20">
                            <Film className="size-5 text-foreground mb-1.5" />
                            <h4 className="text-xs font-semibold text-foreground">全流程影视画布</h4>
                            <p className="text-[var(--fs-label)] text-muted-foreground mt-0.5">节点式多模型协同与分镜管理</p>
                        </div>
                        <div className="rounded-xl border border-border bg-[var(--auth-card-bg)] p-3.5 backdrop-blur transition-colors hover:border-foreground/20">
                            <Video className="size-5 text-foreground mb-1.5" />
                            <h4 className="text-xs font-semibold text-foreground">角色一致性保持</h4>
                            <p className="text-[var(--fs-label)] text-muted-foreground mt-0.5">跨镜头面容、服装与场景锁定</p>
                        </div>
                    </div>
                </div>

                {/* Right Login Card */}
                <div className="w-full max-w-md rounded-2xl border border-border bg-[var(--auth-card-bg)] p-6 sm:p-8 shadow-[var(--elevation-card)] dark:shadow-[var(--elevation-overlay)]">
                    <div className="mb-6 space-y-1">
                        <h2 className="text-2xl font-bold tracking-tight text-foreground">欢迎登录 SupDance</h2>
                        <p className="text-xs text-muted-foreground">登录您的创作者账号以继续创作</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-foreground/80">账号 / 邮箱</label>
                            <Input size="large" prefix={<UserRound className="size-4 text-muted-foreground" />} placeholder="输入用户名或注册邮箱" value={username} onChange={(e) => setUsername(e.target.value)} className="h-10" required />
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-medium text-foreground/80">登录密码</label>
                                <Link to={`/forgot-password?next=${encodeURIComponent(next)}`} className="text-xs text-[var(--auth-accent)] hover:underline transition-colors">
                                    忘记密码？
                                </Link>
                            </div>
                            <Input.Password size="large" prefix={<LockKeyhole className="size-4 text-muted-foreground" />} placeholder="输入密码" value={password} onChange={(e) => setPassword(e.target.value)} className="h-10" required />
                        </div>

                        <Button type="primary" htmlType="submit" size="large" block loading={submitting} icon={<ArrowRight className="size-4" />} iconPlacement="end" className="h-11 rounded-xl font-bold active:scale-[0.98] mt-2 transition-transform">
                            立即登录
                        </Button>
                    </form>

                    {/* Divider for Social Login */}
                    {hasSocialProviders ? <Divider className="auth-scene-divider my-5 border-border text-xs text-muted-foreground">或使用第三方账号快捷登录</Divider> : null}

                    {/* Dynamic Social Login Grid */}
                    <SocialLoginButtons variant="light-card" next={next} acceptedTerms={acceptedTerms} onRequireAcceptTerms={() => acceptedTerms} onProvidersChange={(providers) => setHasSocialProviders(providers.length > 0)} />

                    {/* Terms Agreement Checkbox */}
                    <div className="mt-5 flex items-start gap-2 pt-2 border-t border-border">
                        <Checkbox checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} className="mt-0.5 text-xs text-muted-foreground">
                            <span className="text-[var(--fs-label)] text-muted-foreground">
                                我已阅读并同意
                                <a href="/terms" target="_blank" rel="noreferrer" className="text-[var(--auth-accent)] hover:underline mx-0.5">
                                    《用户服务协议》
                                </a>
                                和
                                <a href="/privacy" target="_blank" rel="noreferrer" className="text-[var(--auth-accent)] hover:underline mx-0.5">
                                    《隐私政策》
                                </a>
                            </span>
                        </Checkbox>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="relative z-10 border-t border-border bg-[var(--auth-page-bg)] py-4 text-center text-xs text-muted-foreground">
                <p>© {new Date().getFullYear()} SupDance 影策 · 工业级 AI 影视创作平台</p>
            </footer>
        </div>
    );
}

function safeNext(value: string | null) {
    if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
    return value;
}
