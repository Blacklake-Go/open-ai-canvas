import { useState, useRef, useEffect, useMemo, type KeyboardEvent } from "react";
import { App, Popover } from "antd";
import { useTranslation } from "react-i18next";
import { ArrowUp, ChevronDown, Coins, ImagePlus, Loader2, SlidersHorizontal, Trash2, X } from "lucide-react";

import { Tooltip } from "@/components/ui/base/tooltip";
import { ImageSizePicker } from "@/components/image-size-picker";
import { ModelPicker } from "@/components/model-picker";
import { useAuthEntry } from "@/hooks/use-auth-entry";
import { useWalletBalance } from "@/hooks/use-wallet-balance";
import { useUserStore } from "@/stores/use-user-store";
import { modelOptionName, resolveModelChannel, resolveModelRequestConfig, selectableModelsByCapability, useEffectiveConfig, type AiConfig } from "@/stores/use-config-store";
import { modelQuoteRequest, requestCreditCost } from "@/lib/model-pricing";
import { modelCapabilityConfigFor } from "@/lib/model-capabilities";
import { imageResolutionUsesQuality } from "@/lib/image-size-presets";
import { imageQualityLabel } from "@/lib/image-quality";
import { preserveImageSettings, mediaSettingIssues } from "@/lib/media-settings";
import { mergedImageCapabilityConfig, type ModelRequirements } from "@/lib/model-selection";
import { useGenerationBatchLimit, batchQuoteTotal } from "@/lib/generation-batch-limit";
import { quoteModel, type LogicalModelQuote } from "@/services/api/logical-models";
import { buildImageResolutionOptions, formatImageResolutionSize, supportsImageResolutionPresets } from "@/lib/image-resolution-tiers";
import type { CreationAttachment } from "@/pages/create/creation-assets";

export type ComposerSubmitValues = {
    prompt: string;
    model: string;
    ratio: string;
    resolution: string;
    quality: string;
    count: number;
    referenceImages: CreationAttachment[];
};

const COUNT_CHOICES = [1, 2, 4];

/**
 * 把草稿/历史参数落到目标模型合同上：quality 与 imageResolution 是独立字段，
 * 分辨率档位大小写不敏感对齐；旧记录把档位存进 quality 的，迁移到 imageResolution。
 * 返回的 size/quality/resolution 已通过 preserveImageSettings 校验，可直接提交。
 */
export function resolveComposerImageSettings(config: AiConfig, model: string, draft: { ratio?: string; resolution?: string; quality?: string }): { size: string; quality: string; resolution: string } {
    const profile = modelCapabilityConfigFor(config, model).image!;
    const protocol = resolveModelRequestConfig(config, model).interfaceType;
    const matches = (values: string[], value: string | undefined) => {
        const text = (value || "").trim().toLowerCase();
        return text ? values.find((item) => item.trim().toLowerCase() === text) : undefined;
    };
    const draftResolution = draft.resolution?.trim();
    const legacyTier = ["1k", "1.5k", "2k", "4k"];
    // 旧工作台把分辨率同时写进 quality；仅当 quality 值确实是分辨率档位时迁移，
    // 不覆盖 low/medium/high 这类真实画质语义。
    const qualityIsTier = legacyTier.includes((draft.quality || "").trim().toLowerCase());
    const requestedResolution =
        (draftResolution && draftResolution.toLowerCase() !== "auto" ? matches(profile.resolution.values, draftResolution) : undefined) ||
        (qualityIsTier ? matches(profile.resolution.values, draft.quality) : undefined) ||
        (draftResolution?.toLowerCase() === "auto" ? "auto" : undefined);
    const adapted = preserveImageSettings(
        profile,
        {
            size: draft.ratio,
            quality: qualityIsTier && profile.resolution.supported ? undefined : draft.quality,
            imageResolution: requestedResolution,
            count: "1",
        },
        protocol,
    );
    return {
        size: adapted.size || profile.size.default,
        quality: adapted.quality || profile.quality.default || "auto",
        resolution: profile.resolution.supported ? adapted.imageResolution || profile.resolution.default || "auto" : "auto",
    };
}

/** 一次提交张数按账号同时任务数 clamp，硬上限 15，与创作页口径一致。 */
export function clampComposerCount(value: number, batchLimit: number): number {
    return Math.max(1, Math.min(Math.min(15, batchLimit), Math.floor(value) || 1));
}

export function ImageWorkspaceComposer({
    draftPrompt = "",
    draftModel,
    draftRatio = "1:1",
    draftResolution = "auto",
    draftCount = 1,
    draftReferenceImages = [],
    externalReferenceImage,
    onExternalReferenceConsumed,
    onDraftChange,
    onSubmit,
    submitting = false,
}: {
    draftPrompt?: string;
    draftModel?: string;
    draftRatio?: string;
    draftResolution?: string;
    draftCount?: number;
    draftReferenceImages?: CreationAttachment[];
    externalReferenceImage?: string | null;
    onExternalReferenceConsumed?: () => void;
    onDraftChange?: (values: ComposerSubmitValues) => void;
    onSubmit: (values: ComposerSubmitValues) => Promise<void>;
    submitting?: boolean;
}) {
    const { message: toast } = App.useApp();
    const { t, i18n: i18nInstance } = useTranslation();
    const { openAuth } = useAuthEntry();
    const user = useUserStore((state) => state.user);
    const creditsEnabled = useUserStore((state) => state.features.creditsEnabled);
    const imageWorkbenchEnabled = useUserStore((state) => state.features.imageWorkbenchEnabled);
    const { availableMicrocredits } = useWalletBalance(user?.id, creditsEnabled);
    const availableCredits = availableMicrocredits !== null && availableMicrocredits !== undefined ? availableMicrocredits / 1_000_000 : null;
    const config = useEffectiveConfig();
    const batchLimit = Math.min(15, useGenerationBatchLimit());

    const [prompt, setPrompt] = useState(draftPrompt);
    const [model, setModel] = useState(() => draftModel || config.imageModel || "");
    const [ratio, setRatio] = useState(draftRatio);
    const [resolution, setResolution] = useState(draftResolution);
    const [quality, setQuality] = useState("auto");
    const [count, setCount] = useState(draftCount);
    const [referenceImages, setReferenceImages] = useState<CreationAttachment[]>(draftReferenceImages);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [countDraft, setCountDraft] = useState(String(Math.max(4, draftCount)));

    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // 可用生图模型只来自当前有效渠道目录；没有可用模型时禁用提交并明确提示。
    const availableModels = useMemo(() => selectableModelsByCapability(config, "image"), [config]);
    useEffect(() => {
        if (model && availableModels.includes(model)) return;
        const preferred = config.imageModel && availableModels.includes(config.imageModel) ? config.imageModel : availableModels[0] || "";
        setModel(preferred);
    }, [availableModels, config.imageModel, model]);

    const imageProfile = useMemo(() => modelCapabilityConfigFor(config, model).image!, [config, model]);
    // 尺寸/比例/分辨率选项取同显示名模型族的并集，与创作页一致。
    const mergedProfile = useMemo(() => mergedImageCapabilityConfig(config, model), [config, model]);
    const maxReferenceImages = Math.max(1, imageProfile.references.maxImages);
    const usesResolutionPicker = supportsImageResolutionPresets(mergedProfile.size);
    const resolutionOptions = useMemo(() => (usesResolutionPicker ? buildImageResolutionOptions(mergedProfile.size.values) : []), [usesResolutionPicker, mergedProfile.size.values]);

    // 模型或外部草稿变化时把当前参数落到目标合同；不支持的值回退模型默认，避免提交非法参数。
    useEffect(() => {
        if (!model) return;
        const normalized = resolveComposerImageSettings(config, model, { ratio, resolution, quality });
        if (normalized.size !== ratio) setRatio(normalized.size);
        if (normalized.resolution !== resolution) setResolution(normalized.resolution);
        if (normalized.quality !== quality) setQuality(normalized.quality);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [config, model]);

    // Sync draft values if parent updates them (e.g. session change or reuse params)
    useEffect(() => {
        setPrompt(draftPrompt || "");
    }, [draftPrompt]);

    useEffect(() => {
        if (draftModel) setModel(draftModel);
    }, [draftModel]);

    useEffect(() => {
        if (!model || (!draftRatio && !draftResolution)) return;
        const normalized = resolveComposerImageSettings(config, model, { ratio: draftRatio, resolution: draftResolution });
        setRatio(normalized.size);
        setResolution(normalized.resolution);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [draftRatio, draftResolution]);

    useEffect(() => {
        if (draftCount) setCount(clampComposerCount(draftCount, batchLimit));
    }, [draftCount, batchLimit]);

    useEffect(() => {
        if (draftReferenceImages) setReferenceImages(draftReferenceImages);
    }, [draftReferenceImages]);

    // Notify parent of draft change for per-session draft preservation
    useEffect(() => {
        onDraftChange?.({
            prompt,
            model,
            ratio,
            resolution,
            quality,
            count,
            referenceImages,
        });
    }, [prompt, model, ratio, resolution, quality, count, referenceImages, onDraftChange]);

    // Handle external reference image (e.g. from timeline or asset drawer)
    useEffect(() => {
        if (externalReferenceImage) {
            setReferenceImages((prev) => {
                if (prev.length >= maxReferenceImages) {
                    toast.warning(t("create.page.workspaceReferenceLimit", { count: maxReferenceImages }));
                    return prev;
                }
                if (prev.some((img) => ("dataUrl" in img && img.dataUrl === externalReferenceImage) || ("url" in img && img.url === externalReferenceImage))) {
                    return prev;
                }
                const newRef: CreationAttachment = {
                    id: `ref:${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                    name: t("canvasPage.connection.referenceImage"),
                    type: "image/png",
                    dataUrl: externalReferenceImage,
                    url: externalReferenceImage,
                    previewUrl: externalReferenceImage,
                };
                return [...prev, newRef];
            });
            onExternalReferenceConsumed?.();
        }
    }, [externalReferenceImage, onExternalReferenceConsumed, toast, maxReferenceImages, t]);

    // 模型切换后参考图上限收紧时裁剪超出部分，并明确告知。
    useEffect(() => {
        setReferenceImages((prev) => {
            if (prev.length <= maxReferenceImages) return prev;
            toast.warning(t("create.page.workspaceReferenceTrimmed", { count: maxReferenceImages }));
            return prev.slice(0, maxReferenceImages);
        });
    }, [maxReferenceImages, toast, t]);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = `${Math.min(140, Math.max(44, textareaRef.current.scrollHeight))}px`;
        }
    }, [prompt]);

    const taskCount = clampComposerCount(count, batchLimit);
    // 报价与提交共用同一份目标模型适配结果；每张图拆成独立任务，按单张询价。
    const generationConfig = useMemo<AiConfig>(() => ({ ...config, model, imageModel: model, size: ratio, quality, imageResolution: resolution, count: String(taskCount) }), [config, model, ratio, quality, resolution, taskCount]);
    const settingsError = useMemo(
        () =>
            model
                ? mediaSettingIssues(generationConfig, "image", model)
                      .map((item) => item.message)
                      .join("；")
                : "",
        [generationConfig, model],
    );
    const modelRequirements = useMemo<ModelRequirements>(
        () => ({
            capability: "image",
            input: { textCount: prompt.trim() ? 1 : 0, imageCount: referenceImages.length, videoCount: 0, audioCount: 0, characterCount: 0 },
            imageSize: ratio,
            options: { size: ratio, quality, imageResolution: resolution, count: 1 },
        }),
        [prompt, referenceImages.length, ratio, quality, resolution],
    );
    const quoteRequest = useMemo(() => (settingsError ? undefined : modelQuoteRequest(generationConfig, model, "image", modelRequirements)), [generationConfig, model, modelRequirements, settingsError]);
    const [routeQuote, setRouteQuote] = useState<{ request: unknown; quote: LogicalModelQuote } | null>(null);
    useEffect(() => {
        if (!user?.id || !creditsEnabled || !quoteRequest) {
            setRouteQuote(null);
            return;
        }
        const controller = new AbortController();
        quoteModel(quoteRequest, controller.signal)
            .then(({ quote }) => {
                if (!controller.signal.aborted) setRouteQuote({ request: quoteRequest, quote });
            })
            .catch(() => {
                if (!controller.signal.aborted) setRouteQuote(null);
            });
        return () => controller.abort();
    }, [creditsEnabled, quoteRequest, user?.id]);
    const activeQuote = routeQuote && routeQuote.request === quoteRequest ? routeQuote.quote : null;
    // 本地价格档位只在服务端报价不可用时兜底；image_usage/token 计费返回 null，不展示无依据数字。
    const localCost = useMemo(() => {
        if (!creditsEnabled || !model || settingsError) return null;
        const channel = resolveModelChannel(config, model);
        return requestCreditCost({
            channelMode: channel.scope === "system" ? "remote" : "local",
            modelCosts: channel.modelCosts,
            model: modelOptionName(model),
            count: taskCount,
            capability: "image",
            config: generationConfig,
            requirements: modelRequirements,
        });
    }, [creditsEnabled, config, model, taskCount, generationConfig, modelRequirements, settingsError]);
    const estimatedCost = activeQuote ? batchQuoteTotal(activeQuote.amountMicrocredits, taskCount) : localCost;
    const costIsEstimate = Boolean(activeQuote?.estimated) || !activeQuote;
    // 服务端报价失败时本地估算可能也拿不到；此时按渠道计费模式区分「按用量结算」与「暂不可用」。
    const channelBillingMode = model ? resolveModelChannel(config, model).modelCosts?.find((item) => item.model === modelOptionName(model))?.billingMode : undefined;
    const usageBilling = creditsEnabled && estimatedCost === null && (channelBillingMode === "image_usage" || channelBillingMode === "token");
    const costLabel = !creditsEnabled
        ? ""
        : estimatedCost !== null
          ? t(costIsEstimate ? "create.page.workspaceCostEstimate" : "create.page.workspaceCostExact", { amount: estimatedCost.toLocaleString(i18nInstance.resolvedLanguage || "zh-CN", { maximumFractionDigits: 6 }) })
          : usageBilling
            ? t("create.page.workspaceCostUsage")
            : quoteRequest && user?.id
              ? t("create.page.workspaceCostLoading")
              : model
                ? t("create.page.workspaceCostUnavailable")
                : "";

    const handleUploadFiles = (files: FileList | null) => {
        if (!files?.length) return;
        const validFiles = Array.from(files).filter((file) => file.type.startsWith("image/"));
        if (!validFiles.length) {
            toast.warning(t("create.page.workspaceImageFilesOnly"));
            return;
        }

        const remainingSlots = maxReferenceImages - referenceImages.length;
        if (remainingSlots <= 0) {
            toast.warning(t("create.page.workspaceReferenceLimit", { count: maxReferenceImages }));
            return;
        }

        const filesToProcess = validFiles.slice(0, remainingSlots);

        for (const file of filesToProcess) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const dataUrl = e.target?.result as string;
                if (!dataUrl) return;
                setReferenceImages((prev) => {
                    if (prev.length >= maxReferenceImages) return prev;
                    const newAttachment: CreationAttachment = {
                        id: `upload:${file.name}:${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                        name: file.name,
                        type: file.type || "image/png",
                        dataUrl,
                        url: dataUrl,
                        previewUrl: dataUrl,
                        bytes: file.size,
                    };
                    return [...prev, newAttachment];
                });
            };
            reader.readAsDataURL(file);
        }
    };

    const removeReferenceImage = (id: string) => {
        setReferenceImages((prev) => prev.filter((img) => img.id !== id));
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            if (e.nativeEvent.isComposing || e.keyCode === 229) return;
            e.preventDefault();
            void handleFormSubmit();
        }
    };

    const handleFormSubmit = async () => {
        const text = prompt.trim();
        // Validation 1: Prompt cannot be empty!
        if (!text) {
            toast.warning(t("create.page.promptRequired"));
            textareaRef.current?.focus();
            return;
        }

        // Validation 2: User must be logged in
        if (!user) {
            openAuth({ preferDialog: true });
            return;
        }

        // Validation 3: 必须有真实可用的生图模型；无模型时不允许提交。
        if (!imageWorkbenchEnabled) {
            toast.warning(t("create.page.workspaceImageDisabled"));
            return;
        }
        if (!availableModels.length) {
            toast.warning(t("create.page.workspaceNoImageModel"));
            return;
        }
        if (!model || !availableModels.includes(model)) {
            toast.error(t("create.page.workspaceModelUnavailable"));
            return;
        }
        if (referenceImages.length > maxReferenceImages) {
            toast.warning(t("create.page.workspaceReferenceExcess", { count: maxReferenceImages }));
            return;
        }
        if (settingsError) {
            toast.error(settingsError);
            return;
        }

        // Validation 4: Credits balance check if user credits is defined
        if (creditsEnabled && availableCredits !== null && estimatedCost !== null && availableCredits < estimatedCost) {
            toast.warning(t("create.page.workspaceInsufficientCredits"));
            return;
        }

        if (submitting) return;

        try {
            await onSubmit({
                prompt: text,
                model,
                ratio,
                resolution,
                quality,
                count: taskCount,
                referenceImages,
            });
            // Clear prompt and reference images on successful submission
            setPrompt("");
            setReferenceImages([]);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : t("create.page.submitFailed"));
        }
    };

    const sizeSummary = imageProfile.size.parameter === "none" ? "" : usesResolutionPicker ? formatImageResolutionSize(ratio, resolutionOptions) : ratio;
    const settingsSummary = [sizeSummary, imageProfile.quality.supported && !imageResolutionUsesQuality(mergedProfile) ? imageQualityLabel(quality) : "", taskCount > 1 ? t("create.page.workspaceCountChip", { count: taskCount }) : ""]
        .filter(Boolean)
        .join(" · ");
    const countChoices = COUNT_CHOICES.filter((option) => option <= batchLimit);
    const commitCount = (value: number) => {
        const clamped = clampComposerCount(value, batchLimit);
        setCount(clamped);
        setCountDraft(String(Math.max(4, clamped)));
    };

    const settingsPanel = (
        <div className="image-workspace-settings-panel">
            <ImageSizePicker
                profile={mergedProfile}
                size={ratio}
                quality={quality}
                imageResolution={resolution}
                declaredSizeOptions
                onChange={(nextSize, nextQuality, nextResolution) => {
                    setRatio(nextSize);
                    if (nextQuality) setQuality(nextQuality);
                    if (nextResolution) setResolution(nextResolution);
                }}
            />
            {imageProfile.quality.supported && !imageResolutionUsesQuality(mergedProfile) && imageProfile.quality.values.length > 1 ? (
                <div className="image-workspace-settings-group" role="group" aria-label={t("create.page.workspaceImageQuality")}>
                    <span className="image-workspace-settings-label">{t("create.page.workspaceImageQuality")}</span>
                    <div className="image-workspace-settings-chips">
                        {imageProfile.quality.values.map((value) => (
                            <button key={value} type="button" aria-pressed={quality === value} onClick={() => setQuality(value)}>
                                {imageQualityLabel(value)}
                            </button>
                        ))}
                    </div>
                </div>
            ) : null}
            {batchLimit > 1 ? (
                <div className="image-workspace-settings-group" role="group" aria-label={t("create.page.workspaceCountAria", { count: batchLimit })}>
                    <span className="image-workspace-settings-label">{t("create.page.workspaceCount")}</span>
                    <div className="image-workspace-settings-chips">
                        {countChoices.map((option) => (
                            <button key={option} type="button" aria-pressed={taskCount === option} onClick={() => commitCount(option)}>
                                {t("create.page.workspaceCountChip", { count: option })}
                            </button>
                        ))}
                        <label className="image-workspace-settings-count-custom">
                            <span>{t("create.page.workspaceCountCustom")}</span>
                            <input
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={taskCount >= 4 ? String(taskCount) : countDraft}
                                onChange={(event) => {
                                    setCountDraft(event.target.value);
                                    const parsed = Number(event.target.value);
                                    if (Number.isFinite(parsed) && parsed >= 1) setCount(clampComposerCount(parsed, batchLimit));
                                }}
                                onBlur={() => commitCount(Number(countDraft) || taskCount)}
                                aria-label={t("create.page.workspaceCountAria", { count: batchLimit })}
                            />
                            <em>{t("create.page.workspaceCountUnit")}</em>
                        </label>
                    </div>
                    <span className="image-workspace-settings-hint">{t("create.page.workspaceCountHint", { count: batchLimit })}</span>
                </div>
            ) : null}
        </div>
    );

    return (
        <div className="image-workspace-composer-dock" role="region" aria-label={t("create.page.workspaceComposerLabel")}>
            {!availableModels.length ? (
                <p className="image-workspace-composer-alert" role="status">
                    {t("create.page.workspaceNoImageModel")}
                </p>
            ) : !imageWorkbenchEnabled ? (
                <p className="image-workspace-composer-alert" role="status">
                    {t("create.page.workspaceImageDisabled")}
                </p>
            ) : null}
            {/* 参考图列表 */}
            {referenceImages.length > 0 && (
                <div className="image-workspace-references-strip">
                    {referenceImages.map((ref) => (
                        <div key={ref.id} className="image-workspace-ref-card" title={ref.name}>
                            <img src={ref.previewUrl || ("dataUrl" in ref ? (ref.dataUrl as string) : "") || ("url" in ref ? (ref.url as string) : "")} alt={ref.name || t("canvasPage.connection.referenceImage")} />
                            <button type="button" className="image-workspace-ref-remove" onClick={() => removeReferenceImage(ref.id)} aria-label={t("create.page.workspaceRemoveReference")}>
                                <X className="size-2.5" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* 提示词输入区域 */}
            <div className="image-workspace-textarea-wrap">
                <textarea
                    ref={textareaRef}
                    className="image-workspace-textarea"
                    placeholder={t("create.page.workspacePromptPlaceholder")}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={submitting}
                    rows={1}
                />
            </div>

            {/* 工具栏：模型选择、比例选择、清晰度、张数、积分预估、生成按钮 */}
            <div className="image-workspace-composer-toolbar">
                <div className="image-workspace-composer-selectors">
                    {/* 参考图添加按钮 */}
                    <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleUploadFiles(e.target.files)} />
                    <Tooltip title={t("create.page.workspaceAddReferenceLimit", { count: maxReferenceImages })}>
                        <button type="button" className="image-workspace-footer-btn" onClick={() => fileInputRef.current?.click()} disabled={submitting || !model || referenceImages.length >= maxReferenceImages}>
                            <ImagePlus className="size-3.5" />
                            <span>{t("canvasPage.connection.referenceImage")}</span>
                        </button>
                    </Tooltip>

                    {/* 模型选择器：与创作页共用品牌目录、报价与能力标签 */}
                    <ModelPicker
                        config={config}
                        value={model}
                        onChange={setModel}
                        capability="image"
                        requirements={modelRequirements}
                        className="image-workspace-model-picker"
                        placeholder={t("create.page.workspaceSelectModel")}
                        showSelectedPrice={false}
                        showOptionPrices
                        variant="creation"
                        disabled={submitting}
                    />

                    {/* 生成设置：比例/分辨率/画质/张数按模型合同渲染 */}
                    {model ? (
                        <Popover open={settingsOpen} onOpenChange={setSettingsOpen} trigger="click" placement="topLeft" arrow={false} classNames={{ root: "image-workspace-settings-popover" }} content={settingsPanel}>
                            <button
                                type="button"
                                className="image-workspace-footer-btn"
                                aria-label={t("create.page.workspaceSettingsSummary", { summary: settingsSummary || t("create.page.workspaceSettings") })}
                                aria-expanded={settingsOpen}
                                disabled={submitting}
                            >
                                <SlidersHorizontal className="size-3.5" />
                                <span>{settingsSummary || t("create.page.workspaceSettings")}</span>
                                <ChevronDown className="size-3" />
                            </button>
                        </Popover>
                    ) : null}

                    {/* 清空输入 */}
                    {(prompt || referenceImages.length > 0) && (
                        <Tooltip title={t("create.page.workspaceClearInput")}>
                            <button
                                type="button"
                                className="text-muted-foreground hover:text-foreground p-1 rounded"
                                onClick={() => {
                                    setPrompt("");
                                    setReferenceImages([]);
                                }}
                            >
                                <Trash2 className="size-3.5" />
                            </button>
                        </Tooltip>
                    )}
                </div>

                <div className="image-workspace-composer-right">
                    {/* 积分预估 */}
                    {costLabel && (
                        <div className="image-workspace-cost-badge" title={estimatedCost !== null ? t("create.page.workspaceCostTitle") : t("create.page.workspaceCostInfoTitle")}>
                            <Coins className="size-3.5 text-amber-400" />
                            <span>{costLabel}</span>
                        </div>
                    )}

                    {/* 生成提交按钮 */}
                    <button
                        type="button"
                        className="image-workspace-submit-btn"
                        onClick={handleFormSubmit}
                        disabled={submitting || !prompt.trim() || !model || !availableModels.length || !imageWorkbenchEnabled || Boolean(settingsError)}
                        title={settingsError || undefined}
                        aria-label={t("create.page.launchpadLabel")}
                    >
                        {submitting ? (
                            <>
                                <Loader2 className="size-3.5 animate-spin" />
                                <span>{t("create.page.workspaceSubmitting")}</span>
                            </>
                        ) : (
                            <>
                                <ArrowUp className="size-3.5" />
                                <span>{t("create.page.launchpadLabel")}</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
