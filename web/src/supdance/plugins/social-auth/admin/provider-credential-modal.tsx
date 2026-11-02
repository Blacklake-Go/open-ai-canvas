import { useState, type ReactNode } from "react";
import { App, Button, Input } from "antd";
import { Check, Copy, ExternalLink, ShieldCheck } from "lucide-react";

import { AdminStatusBadge } from "@/pages/admin/components/admin-ui";
import { Callout, Switch } from "@/pages/admin/ui/controls";
import { AdminModal } from "@/pages/admin/ui/overlays";

import { updateAdminSocialAuthSettings } from "../api";
import { SocialProviderIcon } from "../components/social-provider-icons";
import type { AdminSettingsView, ProviderUpdateInput, SocialAuthProviderAdmin } from "../types";
import { credentialKeyLabels, isMaskedPreview, maskedClientIdOf, maskedSecretOf, type ProviderDraftState } from "./credential-helpers";

/**
 * 单渠道凭证配置弹窗。
 *
 * 密钥只在弹窗内提交、只写入不反显：后端 UpdateAdminSettings 对
 * enabled / sandboxMockEnabled / customRedirectUrl 是无条件覆盖写入，
 * 所以这里必须按"整个渠道的当前草稿"提交，且只带这一个 provider key，
 * 其余渠道的配置不会被这次写入波及。
 */
export interface ProviderCredentialModalProps {
    provider: SocialAuthProviderAdmin;
    draft: ProviderDraftState;
    onDraftChange: (patch: Partial<ProviderDraftState>) => void;
    onClose: () => void;
    onSaved: (payload: { view: AdminSettingsView; providerId: string; credentialsWritten: boolean }) => void;
    onCopy: (text: string, label?: string) => void;
}

function MetaRow({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="admin-social-key-meta-row">
            <span>{label}</span>
            <div className="admin-social-key-meta-value">{children}</div>
        </div>
    );
}

/** docUrl 来自后台注册表，仍需防止异常值让弹窗整块崩溃。 */
function safeHostname(url: string): string {
    try {
        return new URL(url).hostname;
    } catch {
        return url;
    }
}

export function ProviderCredentialModal({ provider, draft, onDraftChange, onClose, onSaved, onCopy }: ProviderCredentialModalProps) {
    const { message } = App.useApp();
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState("");
    const [copied, setCopied] = useState(false);

    const labels = credentialKeyLabels(provider.id);
    const maskedId = maskedClientIdOf(provider);
    const maskedSecret = maskedSecretOf(provider);
    // 已录入内容时忽略遮罩与 ESC，避免误触丢掉粘贴进来的密钥。
    const hasTypedValue = Boolean(draft.clientId || draft.clientSecret || draft.customRedirectUrl);

    const copyUri = () => {
        onCopy(provider.callbackUrl, `${provider.name} 回调地址`);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
    };

    const submit = async () => {
        const clientId = draft.clientId.trim();
        const clientSecret = draft.clientSecret.trim();
        const sendsId = Boolean(clientId) && !isMaskedPreview(clientId);
        const sendsSecret = Boolean(clientSecret) && !isMaskedPreview(clientSecret);
        const redirectChanged = draft.customRedirectUrl.trim() !== (provider.customRedirectUrl || "");
        // 掩码非空即证明库里已存有该项，可以只补录缺失的那一半。
        const willHaveId = sendsId || Boolean(maskedId);
        const willHaveSecret = sendsSecret || Boolean(maskedSecret);

        if ((sendsId || sendsSecret) && (!willHaveId || !willHaveSecret)) {
            setNotice(`请完整录入 ${labels.id} 与 ${labels.secret}，缺一无法完成授权回调。`);
            return;
        }
        if (!sendsId && !sendsSecret && !redirectChanged && draft.sandboxMockEnabled === Boolean(provider.sandboxMockEnabled) && draft.enabled === provider.enabled) {
            setNotice("本页配置与线上一致，无需提交。");
            return;
        }

        const payload: ProviderUpdateInput = {
            enabled: draft.enabled,
            sandboxMockEnabled: draft.sandboxMockEnabled,
            customRedirectUrl: draft.customRedirectUrl.trim(),
        };
        if (sendsId) payload.clientId = clientId;
        if (sendsSecret) payload.clientSecret = clientSecret;

        setBusy(true);
        setNotice("");
        try {
            const view = await updateAdminSocialAuthSettings({ providers: { [provider.id]: payload } });
            const credentialsWritten = sendsId || sendsSecret;
            message.success(credentialsWritten ? `${provider.name} 凭证已加密存盘` : `${provider.name} 配置已保存`);
            onSaved({ view, providerId: provider.id, credentialsWritten });
        } catch (err) {
            setNotice(err instanceof Error ? err.message : "凭证保存失败");
        } finally {
            setBusy(false);
        }
    };

    return (
        <AdminModal
            open
            width={560}
            className="admin-social-key-modal"
            title={
                <span className="admin-social-key-title">
                    <span className="admin-social-provider-icon">
                        <SocialProviderIcon provider={provider.id} className="size-4" />
                    </span>
                    <span className="admin-social-key-title-copy">
                        <strong>{provider.name}</strong>
                        <em>{provider.platform || "OAuth 2.0"}</em>
                    </span>
                </span>
            }
            onCancel={onClose}
            onOk={() => void submit()}
            okText={busy ? "正在加密保存…" : "安全提交凭证"}
            cancelText="取消"
            okButtonProps={{ loading: busy, icon: <ShieldCheck className="size-3.5" /> }}
            maskClosable={!hasTypedValue}
            keyboard={!hasTypedValue}
        >
            <div className="admin-social-key-body">
                <div className="admin-social-key-meta">
                    <MetaRow label="密钥安全机制">
                        <span className="admin-social-key-secure">
                            <ShieldCheck className="size-3.5" aria-hidden="true" />
                            AES-256-GCM 写入式存储
                        </span>
                    </MetaRow>
                    <MetaRow label="当前状态">
                        <AdminStatusBadge label={provider.statusLabel || "未配置"} tone={provider.hasCredentials ? "success" : "warning"} />
                    </MetaRow>
                    {provider.docUrl ? (
                        <MetaRow label="凭证申请平台">
                            <a className="admin-social-key-link" href={provider.docUrl} target="_blank" rel="noreferrer">
                                {safeHostname(provider.docUrl)}
                                <ExternalLink className="size-3" aria-hidden="true" />
                            </a>
                        </MetaRow>
                    ) : null}
                    {provider.scopes?.length ? (
                        <MetaRow label="授权范围">
                            <code>{provider.scopes.join(" ")}</code>
                        </MetaRow>
                    ) : null}
                </div>

                <div className="admin-social-key-field">
                    <div className="admin-social-key-field-head">
                        <span>授权回调重定向地址 (Redirect URI)</span>
                        <Button type="link" size="small" icon={copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} onClick={copyUri}>
                            {copied ? "已复制" : "一键复制"}
                        </Button>
                    </div>
                    <code className="admin-social-key-uri">{provider.callbackUrl}</code>
                    <p className="admin-social-key-help">需要与三方平台后台登记的回调地址逐字符一致，包含协议、域名与路径大小写。</p>
                </div>

                <div className="admin-social-key-field">
                    <div className="admin-social-key-field-head">
                        <label htmlFor={`social-${provider.id}-client-id`}>{labels.id}</label>
                        {maskedId ? <AdminStatusBadge label="掩码回显" tone="neutral" title="后台只回显掩码，无法反查原文" /> : null}
                    </div>
                    <Input id={`social-${provider.id}-client-id`} value={draft.clientId} placeholder={maskedId || `输入${labels.id}`} autoComplete="off" onChange={(event) => onDraftChange({ clientId: event.target.value })} />
                </div>

                <div className="admin-social-key-field">
                    <div className="admin-social-key-field-head">
                        <label htmlFor={`social-${provider.id}-client-secret`}>{labels.secret}</label>
                    </div>
                    <Input.Password
                        id={`social-${provider.id}-client-secret`}
                        value={draft.clientSecret}
                        placeholder={maskedSecret ? `${maskedSecret}（留空保持现有凭证，输入新值覆盖）` : `输入${labels.secret}`}
                        autoComplete="off"
                        onChange={(event) => onDraftChange({ clientSecret: event.target.value })}
                    />
                </div>

                <div className="admin-social-key-field">
                    <div className="admin-social-key-field-head">
                        <label htmlFor={`social-${provider.id}-redirect`}>自定义回调地址（选填）</label>
                    </div>
                    <Input id={`social-${provider.id}-redirect`} value={draft.customRedirectUrl} placeholder="留空使用服务端默认回调地址" autoComplete="off" onChange={(event) => onDraftChange({ customRedirectUrl: event.target.value })} />
                    <p className="admin-social-key-help">仅在反向代理前缀或多域名回调与默认地址不同时填写；此处一旦保存，上方 Redirect URI 会随之变更。</p>
                </div>

                <div className="admin-social-key-switch-row">
                    <div className="admin-social-key-switch-copy">
                        <strong>沙盒 Mock 联调</strong>
                        <p>开启后跳过真实三方授权直接返回模拟用户资料，用于本地与预发联调；上线前必须关闭。</p>
                    </div>
                    <Switch size="sm" checked={draft.sandboxMockEnabled} onChange={(checked) => onDraftChange({ sandboxMockEnabled: checked })} aria-label={`${provider.name} 沙盒 Mock 联调模式`} />
                </div>

                {notice ? (
                    <Callout tone="warning" title="需要处理">
                        {notice}
                    </Callout>
                ) : null}
            </div>
        </AdminModal>
    );
}
