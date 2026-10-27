import { AudioLines, Check, Film, Image, MessageSquareText } from "lucide-react";

import { ModelIcon } from "@/components/model-picker";
import { cn } from "@/lib/utils";
import {
    filterModelsByCapability,
    modelDisplayName,
    modelOptionName,
    resolveModelChannel,
    type AiConfig,
    type ModelCapability,
} from "@/stores/use-config-store";
import { useUserStore } from "@/stores/use-user-store";
import { useI18n } from "@/supdance/plugins/i18n";

type DefaultModelKey = "imageModel" | "videoModel" | "textModel" | "audioModel";

const groups: Array<{
    capability: ModelCapability;
    modelKey: DefaultModelKey;
    title: string;
    description: string;
    icon: typeof Image;
}> = [
    { capability: "image", modelKey: "imageModel", title: "默认生图模型", description: "图片生成、图像编辑与视觉探索", icon: Image },
    { capability: "video", modelKey: "videoModel", title: "默认视频模型", description: "文生视频、图生视频与镜头延展", icon: Film },
    { capability: "text", modelKey: "textModel", title: "默认文本模型", description: "提示词改写、脚本与结构化文本", icon: MessageSquareText },
    { capability: "audio", modelKey: "audioModel", title: "默认音频模型", description: "语音、音效与音乐生成", icon: AudioLines },
];

const groupKeyMap: Record<DefaultModelKey, { titleKey: string; descKey: string }> = {
    imageModel: { titleKey: "settings.default_image_model", descKey: "settings.default_image_model_desc" },
    videoModel: { titleKey: "settings.default_video_model", descKey: "settings.default_video_model_desc" },
    textModel: { titleKey: "settings.default_text_model", descKey: "settings.default_text_model_desc" },
    audioModel: { titleKey: "settings.default_audio_model", descKey: "settings.default_audio_model_desc" },
};

const capabilityKeyMap: Record<ModelCapability, { labelKey: string; fallback: string }> = {
    image: { labelKey: "assets.image", fallback: "图片" },
    video: { labelKey: "assets.video", fallback: "视频" },
    text: { labelKey: "common.text", fallback: "文本" },
    audio: { labelKey: "assets.audio", fallback: "音频" },
};

export function ModelDefaultGrid({ config, onChange }: { config: AiConfig; onChange: (key: DefaultModelKey, model: string) => void }) {
    const { t, locale } = useI18n();
    const creditsEnabled = useUserStore((state) => state.features.creditsEnabled);
    return (
        <div className="space-y-1">
            {groups.map((group) => {
                const models = filterModelsByCapability(config.models, group.capability, config.channels);
                const Icon = group.icon;
                const meta = groupKeyMap[group.modelKey];
                const title = meta ? t(meta.titleKey, undefined, group.title) : group.title;
                const description = meta ? t(meta.descKey, undefined, group.description) : group.description;
                const capInfo = capabilityKeyMap[group.capability];
                const capName = capInfo ? t(capInfo.labelKey, undefined, capInfo.fallback) : capabilityLabel(group.capability);

                return (
                    <section key={group.capability} className="py-5 first:pt-0 last:pb-0" aria-labelledby={`default-${group.capability}-title`}>
                        <div className="mb-3 flex items-start gap-3">
                            <span className="grid size-8 shrink-0 place-items-center rounded-md bg-surface-active text-foreground/65"><Icon className="size-4" /></span>
                            <div className="min-w-0">
                                <h3 id={`default-${group.capability}-title`} className="text-sm font-semibold">{title}</h3>
                                <p className="mt-0.5 text-xs text-foreground/48">{description}</p>
                            </div>
                            <span className="ml-auto shrink-0 text-xs tabular-nums text-foreground/38">{t("settings.models_available_count", { count: models.length }, `${models.length} 个可用`)}</span>
                        </div>
                        {models.length ? (
                            <div role="radiogroup" aria-label={title} className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                {models.map((model) => {
                                    const channel = resolveModelChannel(config, model);
                                    const selected = config[group.modelKey] === model;
                                    const cost = channel.modelCosts?.find((item) => item.model === modelOptionName(model));
                                    const billingUnit = cost?.billingMode === "token" ? t("settings.per_million_tokens", undefined, "百万 Token") : cost?.billingMode === "per_second" ? t("settings.per_second", undefined, "秒") : t("settings.per_call", undefined, "次");
                                    return (
                                        <button
                                            key={model}
                                            type="button"
                                            role="radio"
                                            aria-checked={selected}
                                            className={cn(
                                                "model-default-option group relative overflow-hidden rounded-md px-3 py-2 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
                                                selected && "is-selected",
                                            )}
                                            onClick={() => onChange(group.modelKey, model)}
                                        >
                                            <span className="flex min-w-0 items-start gap-2">
                                                <span className="model-default-option-icon grid size-8 shrink-0 place-items-center rounded-md">
                                                    <ModelIcon config={config} model={model} />
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate text-xs font-semibold">{modelDisplayName(config, model)}</span>
                                                    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[var(--fs-tiny)] text-foreground/45">
                                                        <span className="max-w-full truncate">{channel.scope === "system" ? t("settings.system_model", undefined, "系统模型") : channel.name || t("settings.unnamed_channel", undefined, "未命名渠道")}</span>
                                                        <span className="model-default-option-scope">{channel.scope === "system" ? t("settings.system_scope", undefined, "系统") : t("settings.custom_scope", undefined, "自定义")}</span>
                                                        {creditsEnabled && cost ? <span className="model-default-price">{formatPrice(cost.billingMode === "token" ? (cost.outputTokenPriceMicrocredits || 0) : cost.unitPriceMicrocredits, locale)} /{billingUnit}</span> : null}
                                                    </span>
                                                </span>
                                                <span className={cn("model-default-option-check grid size-5 shrink-0 place-items-center rounded-full", selected ? "is-selected" : "text-transparent")}>
                                                    <Check className="size-3" strokeWidth={2.5} />
                                                </span>
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="rounded-md bg-surface-active px-4 py-6 text-center text-xs text-foreground/45">{t("settings.no_model_available", { capability: capName }, `当前渠道中没有可用的${capName}模型`)}</div>
                        )}
                    </section>
                );
            })}
        </div>
    );
}

function capabilityLabel(capability: ModelCapability) {
    return { image: "图片", video: "视频", text: "文本", audio: "音频" }[capability];
}

function formatPrice(microcredits: number, locale = "zh-CN") {
    return (microcredits / 1_000_000).toLocaleString(locale, { maximumFractionDigits: 6 });
}
