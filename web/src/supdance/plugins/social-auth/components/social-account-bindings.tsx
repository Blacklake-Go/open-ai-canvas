import { useEffect, useState } from "react";
import { App, Button, Modal, Skeleton } from "antd";
import { AlertCircle, ArrowRightLeft, CheckCircle2, Link2, ShieldAlert, ShieldCheck, Unlink } from "lucide-react";
import { buildSocialAuthBindUrl, getPublicSocialAuthProviders, getUserSocialIdentities, unbindSocialIdentity } from "../api";
import { SocialProviderIcon } from "./social-provider-icons";
import type { SocialAuthProviderPublic, UserIdentitiesView, UserIdentityItem } from "../types";

export function SocialAccountBindings({ onNavigateSecurity }: { onNavigateSecurity?: () => void }) {
    const { message, modal } = App.useApp();
    const [loading, setLoading] = useState(true);
    const [identitiesView, setIdentitiesView] = useState<UserIdentitiesView>({
        hasPassword: true,
        identities: [],
        count: 0,
    });
    const [providers, setProviders] = useState<SocialAuthProviderPublic[]>([]);
    const [unbindingId, setUnbindingId] = useState<string | null>(null);

    const loadData = async (signal?: AbortSignal) => {
        try {
            setLoading(true);
            const [identRes, provRes] = await Promise.all([getUserSocialIdentities(signal), getPublicSocialAuthProviders(undefined, signal)]);
            setIdentitiesView(identRes);
            setProviders(provRes.providers || []);
        } catch (err) {
            console.error("加载第三方绑定信息失败", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const controller = new AbortController();
        void loadData(controller.signal);
        return () => controller.abort();
    }, []);

    // Helper map of bound identities by provider
    const boundMap = new Map<string, UserIdentityItem>();
    if (identitiesView?.identities) {
        for (const item of identitiesView.identities) {
            if (item.bound) {
                boundMap.set(item.provider.toLowerCase(), item);
            }
        }
    }

    const handleBind = (providerId: string) => {
        const bindUrl = buildSocialAuthBindUrl(providerId, window.location.pathname + window.location.search);
        window.location.href = bindUrl;
    };

    const handleUnbind = (provider: SocialAuthProviderPublic, identity: UserIdentityItem) => {
        // Anti-orphan guard: check if user has password or multiple identities
        if (!identitiesView.hasPassword && boundMap.size <= 1) {
            modal.confirm({
                title: "无法解除绑定",
                icon: <ShieldAlert className="size-5 text-amber-400" />,
                content: (
                    <div className="py-2 text-xs leading-relaxed text-foreground/80">
                        <p className="mb-2">
                            您当前尚未设置<strong>独立登录密码</strong>，且仅绑定了 <strong>{provider.name}</strong> 这一种登录方式。
                        </p>
                        <p className="text-amber-400/90">若现在解除绑定，您将失去进入此账号的唯一凭证，导致账号无法再次登录。</p>
                    </div>
                ),
                okText: "前往设置登录密码",
                cancelText: "取消",
                centered: true,
                onOk: () => {
                    if (onNavigateSecurity) {
                        onNavigateSecurity();
                    }
                },
            });
            return;
        }

        modal.confirm({
            title: `解除 ${provider.name} 绑定`,
            icon: <Unlink className="size-5 text-rose-400" />,
            content: (
                <div className="py-2 text-xs leading-relaxed text-foreground/80">
                    <p>
                        确定要解除与当前账号绑定的 <strong>{identity.providerUsername || provider.name}</strong> 吗？
                    </p>
                    <p className="mt-1 text-foreground/50">解绑后，您将无法再使用该 {provider.name} 账号直接一键登录。</p>
                </div>
            ),
            okText: "确认解绑",
            okType: "danger",
            cancelText: "取消",
            centered: true,
            onOk: async () => {
                try {
                    setUnbindingId(provider.id);
                    const updated = await unbindSocialIdentity(provider.id);
                    if (updated && Array.isArray(updated.identities)) {
                        setIdentitiesView(updated);
                    } else {
                        await loadData();
                    }
                    message.success(`已成功解除与 ${provider.name} 的绑定`);
                } catch (err) {
                    message.error(err instanceof Error ? err.message : "解绑失败，请稍后重试");
                } finally {
                    setUnbindingId(null);
                }
            },
        });
    };

    if (loading) {
        return (
            <div className="space-y-3 py-2">
                <Skeleton active paragraph={{ rows: 4 }} />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header explanation banner */}
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-xs">
                <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 size-4 text-[#00f5d4] shrink-0" />
                    <div className="space-y-1">
                        <div className="font-medium text-white">多渠道统一入站与安全凭证</div>
                        <p className="text-foreground/60 leading-relaxed">绑定第三方平台后，即可使用对应账号一键免密登录 SupDance。若第三方授权包含邮箱，系统已自动同步为绑定邮箱。</p>
                        {!identitiesView.hasPassword && (
                            <p className="flex items-center gap-1 text-amber-400">
                                <AlertCircle className="size-3.5" />
                                提示：您尚未设置独立密码，建议前往【密码与安全】设置密码以保障多渠道访问。
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Provider List */}
            <div className="grid gap-2.5">
                {providers.map((provider) => {
                    const bound = boundMap.get(provider.id.toLowerCase());
                    const isUnbinding = unbindingId === provider.id;

                    return (
                        <div key={provider.id} className={`flex items-center justify-between gap-4 rounded-xl border p-3.5 transition-colors ${bound ? "border-[#00f5d4]/20 bg-[#00f5d4]/[0.02]" : "border-white/5 bg-white/[0.015] hover:border-white/10"}`}>
                            {/* Provider info & status */}
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
                                    <SocialProviderIcon provider={provider.id} className="size-6" />
                                </div>

                                <div className="min-w-0 space-y-0.5">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-white">{provider.name}</span>
                                        {bound ? (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-[#00f5d4]/10 px-2 py-0.5 text-[var(--fs-label)] font-medium text-[#00f5d4]">
                                                <span className="size-1.5 rounded-full bg-[#00f5d4]" />
                                                已绑定
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[var(--fs-label)] text-foreground/40">
                                                <span className="size-1.5 rounded-full bg-foreground/30" />
                                                未绑定
                                            </span>
                                        )}
                                    </div>

                                    <div className="truncate text-xs text-foreground/50">
                                        {bound ? (
                                            <span>
                                                账号: <strong className="text-white/80">{bound.providerUsername || bound.subject}</strong>
                                                {bound.boundAt && <span className="ml-2 text-[var(--fs-label)] text-foreground/40">({new Date(bound.boundAt).toLocaleDateString()})</span>}
                                            </span>
                                        ) : (
                                            <span>绑定后可直接一键登录</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-2 shrink-0">
                                {bound ? (
                                    <>
                                        <Button
                                            size="small"
                                            icon={<ArrowRightLeft className="size-3.5" />}
                                            onClick={() => handleBind(provider.id)}
                                            className="h-8 rounded-lg border-white/10 text-xs text-foreground/70 hover:!border-white/20 hover:!text-white active:scale-[0.98]"
                                        >
                                            换绑
                                        </Button>
                                        <Button size="small" danger loading={isUnbinding} icon={<Unlink className="size-3.5" />} onClick={() => handleUnbind(provider, bound)} className="h-8 rounded-lg text-xs active:scale-[0.98]">
                                            解绑
                                        </Button>
                                    </>
                                ) : (
                                    <Button
                                        size="small"
                                        type="primary"
                                        icon={<Link2 className="size-3.5" />}
                                        onClick={() => handleBind(provider.id)}
                                        className="h-8 rounded-lg bg-[#00f5d4] font-medium text-[#0e1117] hover:!bg-[#00f5d4]/90 hover:!text-[#0e1117] active:scale-[0.98] border-none"
                                    >
                                        立即绑定
                                    </Button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
