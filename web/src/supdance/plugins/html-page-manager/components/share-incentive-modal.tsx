import { useQuery } from "@tanstack/react-query";
import { App, Modal } from "antd";
import { Check, ChevronRight, Copy, Send, Share2, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { useAuthEntry } from "@/hooks/use-auth-entry";
import { formatReferralCredits, formatReferralRate, getReferralOverview, referralLink, type ReferralPublicConfig } from "@/services/api/referral";
import { useUserStore } from "@/stores/use-user-store";
import "./share-incentive-modal.css";

export interface ShareIncentiveModalProps {
    open: boolean;
    onClose: () => void;
    publicConfig: ReferralPublicConfig;
}

const X_ICON_PATH = "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z";

export function ShareIncentiveModal({ open, onClose, publicConfig }: ShareIncentiveModalProps) {
    const { message } = App.useApp();
    const user = useUserStore((state) => state.user);
    const referralAvailable = useUserStore((state) => state.referralAvailable);
    const { openAuth } = useAuthEntry();
    const [copiedType, setCopiedType] = useState<"link" | "code" | "xhs" | "copy" | null>(null);

    const canFetchPersonal = open && Boolean(user) && referralAvailable;
    const overviewQuery = useQuery({
        queryKey: ["referral", "overview"],
        queryFn: getReferralOverview,
        enabled: canFetchPersonal,
        staleTime: 30_000,
    });

    const overview = overviewQuery.data;
    const rateBasisPoints = overview?.commissionRateBasisPoints ?? publicConfig.commissionRateBasisPoints;
    const rateLabel = rateBasisPoints > 0 ? formatReferralRate(rateBasisPoints) : "10%";
    const shareUrl = overview?.code ? referralLink(overview.code) : typeof window !== "undefined" ? window.location.origin : "https://www.supdance.com";
    const shareCopy = `我正在用 SupDance 创作短剧、图像、视频与音乐工作流，全能创作画布超顺手！通过我的专属链接加入体验：${shareUrl}`;

    const copyText = async (text: string, type: "link" | "code" | "xhs" | "copy", successTip: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedType(type);
            message.success(successTip);
            window.setTimeout(() => {
                setCopiedType((current) => (current === type ? null : current));
            }, 2200);
        } catch {
            message.error("复制失败，请手动选中后复制");
        }
    };

    const handlePrimaryAction = () => {
        if (!user) {
            onClose();
            openAuth({ view: "login", preferDialog: true });
            return;
        }
        if (referralAvailable && overview?.code) {
            void copyText(shareUrl, "link", "已复制你的专属分享链接");
            return;
        }
        void copyText(shareUrl, "link", "已复制 SupDance 站点链接");
    };

    const handleShareX = () => {
        const intent = new URL("https://twitter.com/intent/tweet");
        intent.searchParams.set("text", "Discover SupDance — the infinite AI canvas for drama, image, video & music creation.");
        intent.searchParams.set("url", shareUrl);
        window.open(intent.toString(), "_blank", "noopener,noreferrer");
    };

    const handleShareTelegram = () => {
        const tg = new URL("https://t.me/share/url");
        tg.searchParams.set("url", shareUrl);
        tg.searchParams.set("text", shareCopy);
        window.open(tg.toString(), "_blank", "noopener,noreferrer");
    };

    const handleShareWhatsApp = () => {
        const wa = new URL("https://wa.me/");
        wa.searchParams.set("text", shareCopy);
        window.open(wa.toString(), "_blank", "noopener,noreferrer");
    };

    const handleShareXiaohongshu = () => {
        const xhsPost = `发现宝藏 AI 创作工作台 SupDance！短剧分镜、图像、视频、音乐一个画布全搞定 ✨ 戳我的专属入口直达体验：${shareUrl} #SupDance #AI创作 #短剧制作`;
        void copyText(xhsPost, "xhs", "已复制小红书推荐文案与链接，可直接粘贴发布");
    };

    return (
        <Modal open={open} onCancel={onClose} footer={null} closable={false} centered width={436} destroyOnHidden={false} className="sd-incentive-modal" aria-label="分享赢取积分奖励">
            <div className="sd-incentive-card-shell">
                <button type="button" className="sd-incentive-close" onClick={onClose} aria-label="关闭激励浮窗">
                    <X className="size-4" strokeWidth={1.8} />
                </button>

                <div className="sd-incentive-hero">
                    <div className="sd-incentive-hero-left">
                        <h2 className="sd-incentive-title">分享领取</h2>
                        <div className="sd-incentive-reward-row">
                            <span className="sd-incentive-reward-figure">+{rateLabel}</span>
                            <span className="sd-incentive-reward-unit">充值积分奖励</span>
                        </div>
                        <span className="sd-incentive-badge">
                            <Sparkles className="size-3" strokeWidth={2} aria-hidden="true" />
                            <span>创作者分享激励</span>
                        </span>
                    </div>

                    <div className="sd-incentive-logo-box" aria-hidden="true">
                        <img src="/supdance-mark.png" alt="SupDance" className="sd-incentive-logo-img" />
                    </div>
                </div>

                <div className="sd-incentive-divider" />

                <ul className="sd-incentive-points">
                    <li className="sd-incentive-point-item">
                        把你的专属邀请链接分享至 <strong>X、小红书、社群或朋友圈</strong>
                    </li>
                    <li className="sd-incentive-point-item">
                        好友通过专属链接注册并完成充值后 <strong>自动绑定归属</strong>
                    </li>
                    <li className="sd-incentive-point-item">
                        你将获赠好友充值 <strong>{rateLabel} 等额积分</strong>，直充账户可用于全部创作模型
                    </li>
                </ul>

                {user && referralAvailable && overview?.code ? (
                    <div className="sd-incentive-code-bar">
                        <div className="sd-incentive-code-meta">
                            <span className="sd-incentive-code-label">专属邀请码</span>
                            <span className="sd-incentive-code-value">{overview.code}</span>
                        </div>
                        <button type="button" className="sd-incentive-code-copy" onClick={() => void copyText(overview.code, "code", "专属邀请码已复制")}>
                            {copiedType === "code" ? "已复制" : "复制"}
                        </button>
                    </div>
                ) : null}

                <button type="button" className="sd-incentive-cta" onClick={handlePrimaryAction}>
                    {!user ? (
                        <span>立即登录获取专属链接</span>
                    ) : (
                        <>
                            {copiedType === "link" ? <Check className="size-4" strokeWidth={2.2} /> : <Copy className="size-4" strokeWidth={1.9} />}
                            <span>{copiedType === "link" ? "已复制专属分享链接" : referralAvailable ? "复制专属分享链接" : "复制站点分享链接"}</span>
                        </>
                    )}
                </button>

                {user ? (
                    <div className="sd-incentive-social-row" aria-label="快捷分享至社交媒体">
                        <button type="button" className="sd-incentive-social-chip" onClick={handleShareX} title="分享到 X">
                            <svg width={13} height={13} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                <path d={X_ICON_PATH} />
                            </svg>
                            <span>X</span>
                        </button>
                        <button type="button" className="sd-incentive-social-chip" onClick={handleShareXiaohongshu} title="复制小红书种草文案">
                            <Share2 className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
                            <span>{copiedType === "xhs" ? "已复制" : "小红书"}</span>
                        </button>
                        <button type="button" className="sd-incentive-social-chip" onClick={handleShareTelegram} title="分享到 Telegram">
                            <Send className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
                            <span>TG</span>
                        </button>
                        <button type="button" className="sd-incentive-social-chip" onClick={() => (copiedType === "copy" ? undefined : void copyText(shareCopy, "copy", "完整推荐文案已复制"))} title="复制完整推荐文案">
                            {copiedType === "copy" ? <Check className="size-3.5" strokeWidth={2} /> : <Copy className="size-3.5" strokeWidth={1.8} />}
                            <span>{copiedType === "copy" ? "已复制" : "文案"}</span>
                        </button>
                    </div>
                ) : null}

                {user && referralAvailable && overview ? (
                    <div className="sd-incentive-stats-box">
                        <div className="sd-incentive-stats-head">
                            <span className="sd-incentive-stats-title">我的激励战绩</span>
                            <Link to="/referral" className="sd-incentive-stats-more" onClick={onClose}>
                                <span>激励明细</span>
                                <ChevronRight className="size-3.5" strokeWidth={1.8} />
                            </Link>
                        </div>
                        <div className="sd-incentive-stats-grid">
                            <div className="sd-incentive-stat-cell">
                                <span className="sd-incentive-stat-label">已邀请</span>
                                <strong className="sd-incentive-stat-val">{overview.stats.inviteeCount}</strong>
                            </div>
                            <div className="sd-incentive-stat-cell">
                                <span className="sd-incentive-stat-label">已充值</span>
                                <strong className="sd-incentive-stat-val">{overview.stats.paidInviteeCount}</strong>
                            </div>
                            <div className="sd-incentive-stat-cell">
                                <span className="sd-incentive-stat-label">已获积分</span>
                                <strong className="sd-incentive-stat-val">{formatReferralCredits(overview.stats.commissionMicrocredits)}</strong>
                            </div>
                        </div>
                    </div>
                ) : null}
            </div>
        </Modal>
    );
}
