import { useMemo } from "react";
import { creationLabel as _creationLabel } from "@/supdance/plugins/i18n/creation-text";
import { creationText as _creationText, useCreationLocale as _useCreationLocale } from "@/supdance/plugins/i18n/creation-text";
import { Button, Select } from "antd";
import { TriangleAlert } from "lucide-react";

import { dramaChoiceKey, dramaVideoResolutionTiers, dramaVideoResolutionValue } from "@/lib/drama/model-choice";
import { formatVideoResolutionLabel, videoResolutionComparisonKey } from "@/lib/video-generation-options";
import type { DramaAssetSettings, DramaCastKind, DramaModelChoice, DramaModelOption, DramaModelOverride, DramaModels, DramaSkillRef, DramaTextThinking } from "@/services/api/drama";
import { THINKING_REQUEST_OPTIONS, type ThinkingRequest } from "@/lib/text-thinking";

import { DramaModelPicker, useDramaModelCatalog } from "./drama-model-picker";
import { PromptSkillField, type DramaSkillStep } from "./prompt-skill";

// 制作步骤的模型与技能：每个文字步骤一行（文本模型 + 写作技能），每类参考图一行（图片模型 + 分辨率）。
// 单独指定的模型为空时沿用“制作模型”里的默认模型，行内显示实际会用哪个。

const TEXT_STEPS: Array<{ step: DramaSkillStep; override: DramaModelOverride; label: string; hint: string }> = [
    { step: "bible", override: "bibleText", label: "资产提取", hint: "从原文提取角色、道具、场景与全剧画面规则" },
    { step: "script", override: "scriptText", label: "分镜拆分", hint: "每集改编为镜头表，输出最长、最慢的一步" },
    { step: "prompt", override: "promptText", label: "视频提示词", hint: "按镜头表把每个剧情段写成完整视频提示词" },
];

const IMAGE_KINDS: Array<{ kind: DramaCastKind; override: DramaModelOverride; resolution: "resolution" | "propResolution" | "sceneResolution"; label: string; hint: string }> = [
    { kind: "character", override: "characterImage", resolution: "resolution", label: "角色", hint: "画幅按参考图方案" },
    { kind: "prop", override: "propImage", resolution: "propResolution", label: "道具", hint: "16:9 单件展示" },
    { kind: "scene", override: "sceneImage", resolution: "sceneResolution", label: "场景", hint: "16:9 空间全景" },
];

export type DramaStepSkills = { bible?: DramaSkillRef; script?: DramaSkillRef; prompt?: DramaSkillRef };
type DramaTextStep = keyof NonNullable<DramaTextThinking>;

const SKILL_FIELD: Record<DramaSkillStep, keyof DramaStepSkills> = { bible: "bible", script: "script", prompt: "prompt" };

function overrideOf(models: Partial<DramaModels> | undefined, key: DramaModelOverride) {
    const choice = models?.[key];
    return dramaChoiceKey(choice) ? choice : undefined;
}

function tierLabel(tier: string) {
    return tier.toUpperCase();
}

/** 一行里的模型选择：未单独指定时占位显示默认模型，指定后可一键恢复跟随默认。 */
function OverridePicker({ capability, value, fallback, onChange }: { capability: "text" | "image"; value?: DramaModelChoice; fallback?: DramaModelChoice; onChange: (choice?: DramaModelChoice) => void }) {
    _useCreationLocale();
    return (
        <div className="drama-step-model">
            <DramaModelPicker capability={capability} size="sm" showPrice={false} value={value} placeholder={_creationText("creation.4e91c2981d902055", { value1: fallback?.label ? ` · ${fallback.label}` : "" })} onChange={onChange} />
            {value ? (
                <Button size="small" type="text" onClick={() => onChange(undefined)}>
                    {_creationText("creation.a44f9f9fcaca2f42")}
                </Button>
            ) : null}
        </div>
    );
}

/** 文字步骤：资产提取、分镜拆分、视频提示词各自的文本模型与写作技能。 */
export function DramaTextSteps({
    models,
    onModelsChange,
    skills,
    onSkillChange,
    textThinking,
    onThinkingChange,
}: {
    models?: Partial<DramaModels>;
    onModelsChange: (patch: Partial<DramaModels>) => void;
    skills: DramaStepSkills;
    onSkillChange: (step: DramaSkillStep, value?: DramaSkillRef) => void;
    textThinking: DramaTextThinking;
    onThinkingChange: (step: DramaTextStep, value: ThinkingRequest) => void;
}) {
    _useCreationLocale();
    return (
        <div className="drama-steps" role="list" aria-label={_creationText("creation.f074a508d31551f1")}>
            <div className="drama-step-row" role="listitem">
                <div className="drama-step-label">
                    <strong>{_creationText("creation.ea9cc0590e2b3b82")}</strong>
                    <small>{_creationText("creation.820f28522f34d271")}</small>
                </div>
                <div className="drama-step-field">
                    <span className="drama-step-caption">{_creationText("creation.d027815844af8e27")}</span>
                    <small className="drama-step-note">
                        {_creationText("creation.03f1ed062a800e91")}
                        {models?.text?.label ? ` · ${models.text.label}` : ""}
                    </small>
                </div>
                <div className="drama-step-field">
                    <span className="drama-step-caption">{_creationText("nav.skills")}</span>
                    <small className="drama-step-note">{_creationText("creation.9866388fd74ef110")}</small>
                </div>
                <div className="drama-step-field">
                    <span className="drama-step-caption">{_creationText("creation.a431bcd0ae892523")}</span>
                    <Select aria-label={_creationText("creation.2dc50a9b8d8508d9")} value={textThinking.plan || "auto"} options={THINKING_REQUEST_OPTIONS} onChange={(value) => onThinkingChange("plan", value)} />
                </div>
            </div>
            {TEXT_STEPS.map((item) => (
                <div key={item.step} className="drama-step-row" role="listitem">
                    <div className="drama-step-label">
                        <strong>{_creationLabel(item.label)}</strong>
                        <small>{item.hint}</small>
                    </div>
                    <div className="drama-step-field">
                        <span className="drama-step-caption">{_creationText("creation.d027815844af8e27")}</span>
                        <OverridePicker capability="text" value={overrideOf(models, item.override)} fallback={models?.text} onChange={(choice) => onModelsChange({ [item.override]: choice || {} })} />
                    </div>
                    <div className="drama-step-field">
                        <span className="drama-step-caption">{_creationText("nav.skills")}</span>
                        <PromptSkillField compact step={item.step} value={skills[SKILL_FIELD[item.step]]} onChange={(value) => onSkillChange(item.step, value)} />
                    </div>
                    <div className="drama-step-field">
                        <span className="drama-step-caption">{_creationText("creation.a431bcd0ae892523")}</span>
                        <Select aria-label={_creationText("creation.2cca8acf81fc70be", { value1: item.label })} value={textThinking[item.step] || "auto"} options={THINKING_REQUEST_OPTIONS} onChange={(value) => onThinkingChange(item.step, value)} />
                    </div>
                </div>
            ))}
        </div>
    );
}

/** 参考图：角色、道具、场景各自的图片模型与分辨率。分辨率档位取自该类实际使用的图片模型。 */
export function DramaAssetImageModels({
    models,
    onModelsChange,
    assets,
    onAssetsChange,
}: {
    models?: Partial<DramaModels>;
    onModelsChange: (patch: Partial<DramaModels>) => void;
    assets?: DramaAssetSettings;
    onAssetsChange: (assets: DramaAssetSettings) => void;
}) {
    _useCreationLocale();
    const catalog = useDramaModelCatalog().data;
    const optionFor = (choice?: DramaModelChoice) => catalog?.options.image?.find((option) => dramaChoiceKey(option.choice) === dramaChoiceKey(choice));
    return (
        <div className="drama-steps" role="list" aria-label={_creationText("creation.e3b7e2e088c01958")}>
            {IMAGE_KINDS.map((item) => {
                const override = overrideOf(models, item.override);
                const option = optionFor(override || models?.image);
                const tiers = option?.imageResolutions || [];
                const value = assets?.[item.resolution] || "";
                return (
                    <div key={item.kind} className="drama-step-row is-image" role="listitem">
                        <div className="drama-step-label">
                            <strong>{_creationLabel(item.label)}</strong>
                            <small>{item.hint}</small>
                        </div>
                        <div className="drama-step-field">
                            <span className="drama-step-caption">{_creationText("creation.48156e412e6b80bf")}</span>
                            <OverridePicker capability="image" value={override} fallback={models?.image} onChange={(choice) => onModelsChange({ [item.override]: choice || {} })} />
                        </div>
                        <div className="drama-step-field">
                            <span className="drama-step-caption">{_creationText("canvas.resolution")}</span>
                            {!option ? (
                                <small className="drama-step-note">{_creationText("creation.63db60c10986de50")}</small>
                            ) : tiers.length ? (
                                <div className="drama-tabs drama-res-tabs" role="radiogroup" aria-label={_creationText("creation.7995487c33c2ffa1", { value1: item.label })}>
                                    <button type="button" role="radio" className="drama-tab" aria-checked={!value} disabled={!assets} onClick={() => assets && onAssetsChange({ ...assets, [item.resolution]: undefined })}>
                                        {_creationText("projects.default_preset")}
                                        {option.defaultImageResolution ? ` · ${tierLabel(option.defaultImageResolution)}` : ""}
                                    </button>
                                    {tiers.map((tier) => (
                                        <button key={tier} type="button" role="radio" className="drama-tab" aria-checked={value === tier} disabled={!assets} onClick={() => assets && onAssetsChange({ ...assets, [item.resolution]: tier })}>
                                            {tierLabel(tier)}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <small className="drama-step-note">{_creationText("creation.c55b97ea31e18b58")}</small>
                            )}
                            {value && option && !tiers.includes(value) ? (
                                <p className="drama-step-warn" role="alert">
                                    <TriangleAlert className="size-3.5" />
                                    {_creationText("creation.0444e91b43d2f7ed")}
                                    {tierLabel(value)}
                                    {_creationText("creation.5e59b5b93383e7ab")}
                                </p>
                            ) : null}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

/**
 * 剧情段视频分辨率：候选档位取当前作用域所有视频模型声明档位的并集，当前模型给不出的置灰。
 * 换模型不需要先改分辨率；“模型默认”不发分辨率，由模型按默认档位出片。
 */
export function VideoResolutionField({ option, value, onChange, options }: { option?: DramaModelOption; value?: string; onChange: (value?: string) => void; options?: DramaModelOption[] }) {
    _useCreationLocale();
    const catalog = useDramaModelCatalog().data;
    const scope = options || catalog?.options.video || [];
    const tiers = useMemo(() => dramaVideoResolutionTiers(scope, value), [scope, value]);
    const fallback = option?.defaultVideoResolution || "";
    const supported = dramaVideoResolutionValue(option, value);
    const ignored = Boolean(value) && Boolean(option) && !supported;
    if (!option && value) {
        return (
            <div className="drama-step-model">
                <small className="drama-step-note">
                    {_creationText("creation.76a5e558f85e688f")}
                    {formatVideoResolutionLabel(value)}
                </small>
                <Button size="small" type="text" onClick={() => onChange(undefined)}>
                    {_creationText("creation.278671b0b5fe13b4")}
                </Button>
            </div>
        );
    }
    return (
        <div className="drama-step-field">
            <div className="drama-tabs drama-res-tabs" role="radiogroup" aria-label={_creationText("creation.458920ec58f79783")}>
                <button type="button" role="radio" className="drama-tab" aria-checked={!value || ignored} onClick={() => onChange(undefined)}>
                    {_creationText("projects.default_preset")}
                    {fallback ? ` · ${formatVideoResolutionLabel(fallback)}` : ""}
                </button>
                {tiers.map((tier) => {
                    const actual = dramaVideoResolutionValue(option, tier);
                    const active = Boolean(value) && Boolean(supported) && videoResolutionComparisonKey(value) === videoResolutionComparisonKey(tier);
                    return (
                        <button
                            key={tier}
                            type="button"
                            role="radio"
                            className="drama-tab"
                            aria-checked={active}
                            disabled={!option || !actual}
                            title={!option ? _creationText("creation.e84358361c72791e") : !actual ? _creationText("creation.upstream_v1841_resolutionUnsupported") : undefined}
                            onClick={() => actual && onChange(actual)}
                        >
                            {formatVideoResolutionLabel(tier)}
                        </button>
                    );
                })}
            </div>
            {!option ? (
                <small className="drama-step-note">
                    {_creationText("creation.e84358361c72791e")}；{_creationText("creation.upstream_v1841_resolutionCatalogHint")}
                </small>
            ) : ignored ? (
                <p className="drama-step-warn" role="alert">
                    <TriangleAlert className="size-3.5" />
                    {_creationText("creation.upstream_v1841_resolutionFallback")}
                </p>
            ) : !(option.videoResolutions || []).length ? (
                <small className="drama-step-note">{_creationText("creation.7cb6760f579b3959")}</small>
            ) : !fallback ? (
                <small className="drama-step-note">{_creationText("creation.upstream_v1841_resolutionDefaultUnspecified")}</small>
            ) : (
                <small className="drama-step-note">{_creationText("creation.43c6912a7a2118c7")}</small>
            )}
        </div>
    );
}
