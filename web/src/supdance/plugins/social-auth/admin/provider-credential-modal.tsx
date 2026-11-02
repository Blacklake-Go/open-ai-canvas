import { useState } from "react";
import { App, Button, Input } from "antd";
import { Check, Copy, KeyRound, ShieldCheck } from "lucide-react";

import { AdminStatusBadge } from "@/pages/admin/components/admin-ui";
import { Callout } from "@/pages/admin/ui/controls";
import { AdminModal } from "@/pages/admin/ui/overlays";

import { updateAdminSocialAuthSettings } from "../api";
import { SocialProviderIcon } from "../components/social-provider-icons";
import type { AdminSettingsView, ProviderUpdateInput, SocialAuthProviderAdmin } from "../types";
import { credentialKeyLabels, draftFromProvider, isMaskedPreview, maskedClientIdOf, maskedSecretOf, type ProviderDraftState } from "./credential-helpers";

export interface ProviderCredentialModalProps {
    provider: SocialAuthProviderAdmin;
    draft?: ProviderDraftState;
    onDraftChange?: (patch: Partial<ProviderDraftState>) => void;
    onClose: () => void;
    onSaved: (payload: { view: AdminSettingsView; providerId: string; credentialsWritten: boolean }) => void;
    onCopy: (text: string, label?: string) => void;
}

export function ProviderCredentialModal({ provider, draft: draftProp, onDraftChange, onClose, onSaved, onCopy }: ProviderCredentialModalProps) {
    const { message } = App.useApp();
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState("");
    const [copied, setCopied] = useState(false);
    const [internalDraft, setInternalDraft] = useState<ProviderDraftState>(() => draftProp || draftFromProvider(provider));
    const draft = draftProp ?? internalDraft;

    const handleDraftUpdate = (patch: Partial<ProviderDraftState>) => {
        setInternalDraft((prev) => ({ ...prev, ...patch }));
        onDraftChange?.(patch);
    };

    const labels = credentialKeyLabels(provider.id);
    const maskedId = maskedClientIdOf(provider);
    const maskedSecret = maskedSecretOf(provider);
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

        if (provider.id === "qq" && sendsId && !/^\d+$/.test(clientId)) {
            setNotice("QQ App ID 必须是开放平台提供的数字，不能使用邮箱或账号名。");
            return;
        }

        const willHaveId = sendsId || Boolean(maskedId);
        const willHaveSecret = sendsSecret || Boolean(maskedSecret);

        if ((sendsId || sendsSecret) && (!willHaveId || !willHaveSecret)) {
            setNotice(`请完整录入 ${labels.id} 与 ${labels.secret}，缺一无法完成授权。`);
            return;
        }
        if (!sendsId && !sendsSecret && !redirectChanged && draft.enabled === provider.enabled) {
            setNotice("凭证配置未变更，无需提交。");
            return;
        }

        const payload: ProviderUpdateInput = {
            enabled: draft.enabled,
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
            width={480}
            className="admin-social-key-modal"
            title={
                <span className="flex items-center gap-2.5">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[var(--admin-surface-2)]">
                        <SocialProviderIcon provider={provider.id} className="size-4" />
                    </span>
                    <span className="flex flex-col">
                        <strong className="text-sm font-semibold text-[var(--admin-text)] leading-tight">{provider.name}</strong>
                        <em className="text-xs not-italic text-[var(--admin-text-muted)]">{provider.platform || "OAuth 2.0"} 凭据配置</em>
                    </span>
                </span>
            }
            onCancel={onClose}
            onOk={() => void submit()}
            okText={busy ? "正在保存…" : "保存凭证"}
            cancelText="取消"
            okButtonProps={{ loading: busy, icon: <KeyRound className="size-3.5" /> }}
            maskClosable={!hasTypedValue}
            keyboard={!hasTypedValue}
        >
            <div className="flex flex-col gap-4 py-2 text-xs">
                {/* 授权回调地址 */}
                <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-[var(--admin-text-secondary)] font-medium">
                        <span>授权回调重定向地址 (Redirect URI)</span>
                        <Button
                            type="link"
                            size="small"
                            className="p-0 h-auto text-xs text-[var(--admin-text)] hover:text-[var(--admin-text-secondary)]"
                            icon={copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                            onClick={copyUri}
                        >
                            {copied ? "已复制" : "复制"}
                        </Button>
                    </div>
                    <code className="rounded border border-[var(--admin-border)] bg-[var(--admin-surface-2)] px-2.5 py-1.5 font-mono text-[var(--fs-label)] text-[var(--admin-text)] break-all select-all">{provider.callbackUrl}</code>
                </div>

                {/* Client ID */}
                <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                        <label htmlFor={`social-${provider.id}-client-id`} className="font-medium text-[var(--admin-text)]">
                            {labels.id}
                        </label>
                        {maskedId ? <AdminStatusBadge label="已配置" tone="neutral" /> : null}
                    </div>
                    <Input
                        id={`social-${provider.id}-client-id`}
                        value={draft.clientId}
                        placeholder={maskedId || `输入 ${labels.id}`}
                        autoComplete="off"
                        onChange={(event) => handleDraftUpdate({ clientId: event.target.value })}
                        onPressEnter={() => void submit()}
                    />
                </div>

                {/* Client Secret */}
                <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                        <label htmlFor={`social-${provider.id}-client-secret`} className="font-medium text-[var(--admin-text)]">
                            {labels.secret}
                        </label>
                        {maskedSecret ? <AdminStatusBadge label="已加密存储" tone="neutral" /> : null}
                    </div>
                    <Input.Password
                        id={`social-${provider.id}-client-secret`}
                        value={draft.clientSecret}
                        placeholder={maskedSecret ? `${maskedSecret}（留空保持现有密钥）` : `输入 ${labels.secret}`}
                        autoComplete="off"
                        onChange={(event) => handleDraftUpdate({ clientSecret: event.target.value })}
                        onPressEnter={() => void submit()}
                    />
                </div>

                {/* 自定义回调地址 */}
                <div className="flex flex-col gap-1.5">
                    <label htmlFor={`social-${provider.id}-redirect`} className="font-medium text-[var(--admin-text-secondary)]">
                        自定义回调地址（选填，留空使用默认）
                    </label>
                    <Input
                        id={`social-${provider.id}-redirect`}
                        value={draft.customRedirectUrl}
                        placeholder="留空使用服务端默认回调地址"
                        autoComplete="off"
                        onChange={(event) => handleDraftUpdate({ customRedirectUrl: event.target.value })}
                        onPressEnter={() => void submit()}
                    />
                </div>

                {notice ? (
                    <Callout tone="warning" title="提示">
                        {notice}
                    </Callout>
                ) : null}
            </div>
        </AdminModal>
    );
}
