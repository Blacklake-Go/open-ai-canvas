import { App, Button, Form, Input, Tag } from "antd";
import { Switch } from "@/components/ui/base/switch";
import { Cloud, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

import { changesRequireOSSRetest, DEFAULT_OSS_PATH_PREFIX, getS3PresetHints, S3_PRESET_OPTIONS, validateOSSConnectionDraft, type OSSConnectionTestResult, type OSSProvider, type S3Preset } from "@/lib/oss-settings";
import { getUserOSSSetting, testUserOSSConnection, updateUserOSSSetting, type UserOSSSetting } from "@/services/api/resources";
import { useUserStore } from "@/stores/use-user-store";
import { StatusBadge } from "@/components/ui/base/badges";
import { Select } from "@/components/ui/base/select";
import { useI18n } from "@/supdance/plugins/i18n";

type OSSFormValues = {
    enabled?: boolean;
    provider: OSSProvider;
    s3Preset?: S3Preset;
    region?: string;
    endpoint?: string;
    cdnBaseUrl?: string;
    cdnAuthMode?: "" | "public" | "qiniu" | string;
    requireCDN?: boolean;
    allowPrivateProxy?: boolean;
    bucket?: string;
    accessKeyId?: string;
    accessKeySecret?: string;
    sessionToken?: string;
    pathPrefix?: string;
    pathStyle?: boolean;
};

export function UserOSSSettingsForm() {
    const { t, locale } = useI18n();
    const actor = useUserStore((state) => state.user);
    const { message } = App.useApp();
    const [form] = Form.useForm<OSSFormValues>();
    const [setting, setSetting] = useState<UserOSSSetting | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<OSSConnectionTestResult | null>(null);
    const [testStale, setTestStale] = useState(false);
    const savedAt = formatSavedAt(setting?.updatedAt, locale);
    const provider = Form.useWatch("provider", form) || "aliyun";
    const isTencentCOS = provider === "tencent";
    const isQiniuKodo = provider === "qiniu";
    const isS3 = provider === "s3";
    const s3Preset = Form.useWatch("s3Preset", form) || "custom";
    const hasCurrentProviderSecret = Boolean(setting && setting.provider === provider && setting.hasAccessKeySecret);
    const accessKeyIdLabel = isTencentCOS ? "SecretId" : isQiniuKodo ? "AccessKey" : "AccessKey ID";
    const accessKeySecretLabel = isTencentCOS ? "SecretKey" : isQiniuKodo ? "SecretKey" : "AccessKey Secret";

    useEffect(() => {
        if (!actor?.id) return;
        let active = true;
        setLoading(true);
        void getUserOSSSetting()
            .then((data) => {
                if (!active) return;
                setSetting(data.setting);
                form.setFieldsValue(toFormValues(data.setting));
                setTestResult(data.setting.testedAt ? { ok: true, testedAt: data.setting.testedAt, testedDigest: data.setting.testedDigest } : null);
            })
            .catch((error) => active && message.error(error instanceof Error ? error.message : t("settings.oss_load_failed", undefined, "读取个人对象存储配置失败")))
            .finally(() => active && setLoading(false));
        return () => {
            active = false;
        };
    }, [actor?.id, form, message, t]);

    if (!actor) {
        return <div className="rounded-md border border-dashed border-border px-5 py-10 text-center text-sm text-foreground/55">{t("settings.oss_not_logged_in", undefined, "登录后可配置个人对象存储。")}</div>;
    }

    const save = async () => {
        const values = await form.validateFields();
        if (values.enabled && values.provider === "s3" && !setting?.allowUserS3) return message.error(t("settings.oss_s3_not_allowed", undefined, "平台管理员尚未允许个人 S3 兼容存储"));
        setSaving(true);
        try {
            const data = await updateUserOSSSetting({
                enabled: values.enabled === true,
                provider: values.provider || "aliyun",
                s3Preset: values.s3Preset || "custom",
                region: values.region?.trim() || "",
                endpoint: values.endpoint?.trim() || "",
                cdnBaseUrl: values.cdnBaseUrl?.trim() || "",
                cdnAuthMode: values.cdnAuthMode || "",
                requireCDN: values.requireCDN === true,
                allowPrivateProxy: values.allowPrivateProxy === true,
                bucket: values.bucket?.trim() || "",
                accessKeyId: values.accessKeyId?.trim() || "",
                accessKeySecret: values.accessKeySecret?.trim() || "",
                sessionToken: values.sessionToken?.trim() || "",
                pathPrefix: values.pathPrefix?.trim() || DEFAULT_OSS_PATH_PREFIX,
                pathStyle: values.pathStyle === true,
            });
            setSetting(data.setting);
            form.setFieldsValue(toFormValues(data.setting));
            setTestResult(data.setting.testedAt ? { ok: true, testedAt: data.setting.testedAt, testedDigest: data.setting.testedDigest } : null);
            setTestStale(false);
            message.success(data.setting.enabled ? t("settings.oss_save_success_enabled", undefined, "个人对象存储已启用，后续上传将优先使用该存储") : t("settings.oss_save_success_disabled", undefined, "个人对象存储已停用，后续上传将使用平台存储"));
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("settings.oss_save_failed", undefined, "保存个人对象存储配置失败"));
        } finally {
            setSaving(false);
        }
    };

    const testConnection = async () => {
        const values = await form.validateFields();
        const validationError = validateOSSConnectionDraft(values, t);
        if (validationError) {
            message.error(validationError);
            return;
        }
        setTesting(true);
        try {
            const result = await testUserOSSConnection(connectionInput(values));
            setTestResult(result);
            setTestStale(false);
            result.ok ? message.success(result.message || t("settings.oss_test_success", undefined, "连接测试通过")) : message.error(result.message || t("settings.oss_test_failed", undefined, "连接测试失败"));
        } catch (error) {
            setTestResult({ ok: false, message: error instanceof Error ? error.message : t("settings.oss_test_failed", undefined, "连接测试失败") });
            setTestStale(false);
        } finally {
            setTesting(false);
        }
    };

    return (
        <Form form={form} layout="vertical" requiredMark={false} disabled={loading} onValuesChange={(changed) => changesRequireOSSRetest(changed) && setTestStale(true)}>
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                        <Cloud className="size-4" />
                        {t("settings.oss_title", undefined, "我的对象存储")}
                    </div>
                    <p className="mt-1 max-w-3xl text-xs leading-5 text-foreground/55">{t("settings.oss_desc", undefined, "启用后，新上传和新生成的媒体优先写入你的存储桶；停用时回退到平台存储。")}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                    <StatusBadge tone={setting?.enabled ? "success" : "neutral"} label={setting?.enabled ? t("settings.oss_enabled_badge", undefined, "已启用") : t("settings.oss_disabled_badge", undefined, "未启用")} />
                    <Tag color={setting?.hasAccessKeySecret ? "processing" : "warning"} icon={<ShieldCheck className="size-3" />}>
                        {setting?.hasAccessKeySecret ? t("settings.oss_secret_encrypted", undefined, "密钥已加密") : t("settings.oss_secret_not_saved", undefined, "未保存密钥")}
                    </Tag>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2 xl:grid-cols-3">
                <Form.Item name="enabled" label={t("settings.oss_enable_label", undefined, "启用个人对象存储")} valuePropName="checked" className="mb-3">
                    <Switch checkedChildren={t("settings.oss_enable_switch", undefined, "启用")} unCheckedChildren={t("settings.oss_disable_switch", undefined, "停用")} />
                </Form.Item>
                <Form.Item name="provider" label={t("settings.oss_provider_label", undefined, "存储服务")} rules={[{ required: true, message: t("settings.oss_provider_required", undefined, "请选择存储服务") }]} className="mb-3">
                    <Select
                        options={[
                            { label: t("settings.oss_provider_aliyun", undefined, "阿里云 OSS"), value: "aliyun" },
                            { label: t("settings.oss_provider_tencent", undefined, "腾讯云 COS"), value: "tencent" },
                            { label: t("settings.oss_provider_qiniu", undefined, "七牛云 Kodo"), value: "qiniu" },
                            { label: t("settings.oss_provider_s3", undefined, "S3 兼容存储"), value: "s3", disabled: setting?.allowUserS3 === false },
                        ]}
                        onChange={(nextProvider: OSSFormValues["provider"]) => {
                            if (nextProvider !== provider) form.setFieldsValue({ s3Preset: "custom", region: "", endpoint: "", cdnBaseUrl: "", cdnAuthMode: "", requireCDN: false, allowPrivateProxy: false, bucket: "", accessKeyId: "", accessKeySecret: "", sessionToken: "", pathStyle: false });
                        }}
                    />
                </Form.Item>
                {isS3 ? (
                    <Form.Item name="s3Preset" label={t("settings.oss_s3_preset_label", undefined, "S3 预设")} className="mb-3">
                        <Select
                            options={S3_PRESET_OPTIONS.map((opt) => ({
                                label: opt.value === "custom" ? t("common.custom", undefined, "自定义") : opt.label,
                                value: opt.value,
                            }))}
                            onChange={(preset: S3Preset) => form.setFieldsValue(getS3PresetHints(preset))}
                        />
                    </Form.Item>
                ) : null}
                <Form.Item name="region" label={t("settings.oss_region_label", undefined, "Region")} className="mb-3">
                    <Input spellCheck={false} placeholder={isS3 ? getS3PresetHints(s3Preset).region : isTencentCOS ? "ap-guangzhou" : isQiniuKodo ? "z0 / cn-east-1" : "oss-cn-hangzhou"} />
                </Form.Item>
                <Form.Item name="endpoint" label={isQiniuKodo ? t("settings.oss_endpoint_upload_label", undefined, "上传 Endpoint") : "Endpoint"} extra={isS3 ? getS3PresetHints(s3Preset, t).help : isTencentCOS ? t("settings.oss_endpoint_cos_hint", undefined, "可留空，系统会根据 Region 生成标准 COS Endpoint。") : undefined} className="mb-3">
                    <Input inputMode="url" spellCheck={false} placeholder={isS3 ? getS3PresetHints(s3Preset).endpoint : isTencentCOS ? "https://cos.ap-guangzhou.myqcloud.com" : isQiniuKodo ? "https://up-z0.qiniup.com" : "https://oss-cn-hangzhou.aliyuncs.com"} />
                </Form.Item>
                <Form.Item
                    name="cdnBaseUrl"
                    label={isQiniuKodo ? t("settings.oss_cdn_qiniu_label", undefined, "绑定域名（可选）") : isS3 ? t("settings.oss_cdn_s3_label", undefined, "公开 CDN（可选）") : t("settings.oss_cdn_label", undefined, "CDN 加速域名")}
                    extra={isTencentCOS
                        ? t("settings.oss_cdn_cos_extra", undefined, "选填。上传仍走 Endpoint，下载与预览改走 CDN；私有桶需开启 CDN 私有存储桶访问。CDN URL 不附带 COS 签名，未配置 CDN URL 鉴权时链接将长期可访问。")
                        : isQiniuKodo
                            ? t("settings.oss_cdn_qiniu_extra", undefined, "选填。配置可访问的绑定域名后，浏览器直接从七牛下载与预览；不配置时也必须保证对象源站可由用户浏览器访问，不会由平台中转媒体正文。")
                            : t("settings.oss_cdn_oss_extra", undefined, "选填。上传仍走 Endpoint，下载与预览改走 CDN；阿里云私有 Bucket 需开启 CDN 私有 Bucket 回源。CDN URL 不附带 OSS 签名，未配置 CDN URL 鉴权时链接将长期可访问。")}
                    rules={[{ type: "url", message: t("settings.oss_cdn_url_invalid", undefined, "请填写完整的 http/https CDN 加速域名") }]}
                    className="mb-3"
                >
                    <Input inputMode="url" spellCheck={false} placeholder="https://media.example.com" />
                </Form.Item>
                <Form.Item
                    name="cdnAuthMode"
                    label={t("settings.oss_cdn_auth_label", undefined, "CDN 访问鉴权")}
                    extra={isQiniuKodo ? t("settings.oss_cdn_auth_qiniu_extra", undefined, "七牛私有 CDN 可选择七牛签名；公开绑定域名选择公开 CDN。阿里云/腾讯云私有 CDN 暂不自动签名。") : t("settings.oss_cdn_auth_default_extra", undefined, "公开 CDN 适合 CDN 自行鉴权；平台目前不会自动签发阿里云/腾讯云私有 CDN URL。")}
                    className="mb-3"
                >
                    <Select options={[{ label: t("settings.oss_cdn_auth_none", undefined, "未配置"), value: "" }, { label: t("settings.oss_cdn_auth_public", undefined, "公开 CDN"), value: "public" }, { label: t("settings.oss_cdn_auth_qiniu", undefined, "七牛私有下载签名"), value: "qiniu", disabled: !isQiniuKodo }]} />
                </Form.Item>
                <Form.Item name="requireCDN" label={t("settings.oss_require_cdn_label", undefined, "必须走 CDN")} valuePropName="checked" extra={t("settings.oss_require_cdn_extra", undefined, "开启后 CDN 鉴权未配置或不支持时直接失败，不会静默回源。")} className="mb-3">
                    <Switch checkedChildren={t("settings.oss_require_cdn_must", undefined, "必须")} unCheckedChildren={t("settings.oss_require_cdn_fallback", undefined, "允许回源")} />
                </Form.Item>
                <Form.Item name="allowPrivateProxy" label={t("settings.oss_allow_proxy_label", undefined, "允许模型输入代理")} valuePropName="checked" extra={t("settings.oss_allow_proxy_extra", undefined, "仅允许服务端向第三方模型提交参考素材时读取私有源站。浏览器展示、复制、下载和本地处理始终直连 OSS/CDN，不会经平台中转媒体正文。")} className="mb-3">
                    <Switch checkedChildren={t("common.allow", undefined, "允许")} unCheckedChildren={t("common.deny", undefined, "禁止")} />
                </Form.Item>
                <Form.Item name="bucket" label={t("settings.oss_bucket_label", undefined, "存储桶 / Bucket")} className="mb-3">
                    <Input spellCheck={false} placeholder={isTencentCOS ? "my-canvas-assets-1250000000" : isQiniuKodo ? t("settings.oss_bucket_qiniu_placeholder", undefined, "七牛云存储空间名称") : "my-canvas-assets"} />
                </Form.Item>
                <Form.Item name="pathPrefix" label={t("settings.oss_path_prefix_label", undefined, "路径前缀")} className="mb-3">
                    <Input spellCheck={false} placeholder={DEFAULT_OSS_PATH_PREFIX} />
                </Form.Item>
                <Form.Item name="accessKeyId" label={accessKeyIdLabel} className="mb-3 xl:col-span-1">
                    <Input autoComplete="off" spellCheck={false} placeholder={isTencentCOS ? `${t("settings.oss_provider_tencent", undefined, "腾讯云 COS")} SecretId` : isQiniuKodo ? `${t("settings.oss_provider_qiniu", undefined, "七牛云 Kodo")} AccessKey` : `${t("settings.oss_provider_aliyun", undefined, "阿里云 OSS")} AccessKey ID`} />
                </Form.Item>
                <Form.Item name="accessKeySecret" label={hasCurrentProviderSecret ? `${accessKeySecretLabel}${t("settings.oss_keep_secret_suffix", undefined, "（留空保留）")}` : accessKeySecretLabel} className="mb-3 xl:col-span-2">
                    <Input.Password autoComplete="new-password" spellCheck={false} placeholder={hasCurrentProviderSecret ? t("settings.oss_keep_secret_placeholder", undefined, "留空保留已加密密钥") : isTencentCOS ? `${t("settings.oss_provider_tencent", undefined, "腾讯云 COS")} SecretKey` : isQiniuKodo ? `${t("settings.oss_provider_qiniu", undefined, "七牛云 Kodo")} SecretKey` : `${t("settings.oss_provider_aliyun", undefined, "阿里云 OSS")} AccessKey Secret`} />
                </Form.Item>
                {isS3 ? (
                    <>
                        <Form.Item name="sessionToken" label={setting?.hasSessionToken ? t("settings.oss_session_token_keep", undefined, "Session Token（留空保留）") : t("settings.oss_session_token_optional", undefined, "Session Token（可选）")} className="mb-3">
                            <Input.Password autoComplete="new-password" spellCheck={false} placeholder={setting?.hasSessionToken ? t("settings.oss_session_token_keep_placeholder", undefined, "留空保留已加密 Token") : t("settings.oss_session_token_placeholder", undefined, "临时凭证使用的 Session Token")} />
                        </Form.Item>
                        <Form.Item name="pathStyle" label={t("settings.oss_path_style_label", undefined, "Path Style")} valuePropName="checked" extra={t("settings.oss_path_style_extra", undefined, "开启后强制 path-style；关闭时自动选择。")} className="mb-3">
                            <Switch checkedChildren={t("settings.oss_path_style_force", undefined, "强制")} unCheckedChildren={t("settings.oss_path_style_auto", undefined, "自动")} />
                        </Form.Item>
                    </>
                ) : null}
            </div>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                <div className="flex flex-wrap items-center gap-2"><span className="text-xs text-foreground/50">{savedAt ? t("settings.oss_last_saved", { time: savedAt }, `上次保存：${savedAt}`) : t("settings.oss_not_saved", undefined, "尚未保存个人对象存储配置")}</span><ConnectionTestStatus result={testResult} stale={testStale} t={t} locale={locale} /></div>
                <div className="flex flex-wrap gap-2"><Button loading={testing} onClick={() => void testConnection()}>{t("settings.oss_test_connection", undefined, "测试连接")}</Button><Button type="primary" loading={saving} onClick={() => void save()}>{t("settings.oss_save_btn", undefined, "保存个人对象存储")}</Button></div>
            </div>
        </Form>
    );
}

function formatSavedAt(value?: string, locale = "zh-CN") {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime()) || date.getFullYear() < 2000) return "";
    return date.toLocaleString(locale);
}

function toFormValues(setting: UserOSSSetting): OSSFormValues {
    return {
        enabled: setting.enabled,
        provider: setting.provider || "aliyun",
        s3Preset: setting.s3Preset || "custom",
        region: setting.region,
        endpoint: setting.endpoint,
        cdnBaseUrl: setting.cdnBaseUrl,
        cdnAuthMode: setting.cdnAuthMode || "",
        requireCDN: setting.requireCDN === true,
        allowPrivateProxy: setting.allowPrivateProxy === true,
        bucket: setting.bucket,
        accessKeyId: setting.accessKeyId,
        accessKeySecret: "",
        sessionToken: "",
        pathPrefix: setting.pathPrefix || DEFAULT_OSS_PATH_PREFIX,
        pathStyle: setting.pathStyle === true,
    };
}

function connectionInput(values: OSSFormValues) {
    return {
        provider: values.provider,
        s3Preset: values.s3Preset,
        region: values.region?.trim() || "",
        endpoint: values.endpoint?.trim() || "",
        cdnBaseUrl: values.cdnBaseUrl?.trim() || "",
        bucket: values.bucket?.trim() || "",
        accessKeyId: values.accessKeyId?.trim() || "",
        accessKeySecret: values.accessKeySecret?.trim() || "",
        sessionToken: values.sessionToken?.trim() || "",
        pathPrefix: values.pathPrefix?.trim() || DEFAULT_OSS_PATH_PREFIX,
        pathStyle: values.pathStyle === true,
    };
}

function ConnectionTestStatus({ result, stale, t, locale }: { result: OSSConnectionTestResult | null; stale: boolean; t: (key: string, params?: any, fallback?: string) => string; locale: string }) {
    if (stale) return <StatusBadge tone="warning" label={t("settings.oss_retest_needed", undefined, "需重新测试")} />;
    if (!result) return null;
    return <StatusBadge tone={result.ok ? "success" : "error"} label={result.ok ? `${t("settings.oss_test_passed", undefined, "测试通过")}${result.testedAt ? ` · ${formatSavedAt(result.testedAt, locale)}` : ""}` : result.message || t("settings.oss_test_failed_badge", undefined, "测试失败")} />;
}
