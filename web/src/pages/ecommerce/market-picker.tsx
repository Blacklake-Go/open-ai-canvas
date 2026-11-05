import { creationLabel as _creationLabel } from "@/supdance/plugins/i18n/creation-text";
import { creationText as _creationText, useCreationLocale as _useCreationLocale } from "@/supdance/plugins/i18n/creation-text";
import { Button } from "antd";
import { Check, ChevronDown, X } from "lucide-react";
import { GlobeIcon } from "@/components/ui/ecommerce-icons";
import { useState } from "react";
import { AppModal } from "@/components/ui/product/app-modal/app-modal";
import { commercePlatformGroups, labelOf, languageVisuals, languages, platforms } from "./catalog";
import { commerceKnowledgeFor, commercePlatformKnowledge } from "./platform-knowledge";
import "./market-picker.css";

export function PlatformMark({ platform }: { platform: string }) {
    _useCreationLocale();
    return <img className="commerce-platform-logo" data-monochrome={["amazon", "tiktok", "douyin", "ozon", "dewu"].includes(platform)} src={`/commerce/platforms/${platform}.svg`} alt="" width={28} height={28} />;
}

export function LanguageFlag({ language }: { language: string }) {
    _useCreationLocale();
    const flag = languageVisuals[language]?.flag;
    return flag ? <img className="commerce-language-flag" src={`/commerce/flags/${flag}.svg`} alt="" width={20} height={15} /> : <GlobeIcon size={16} />;
}

const groups = [
    ["domestic", "中文电商"],
    ["crossBorder", "跨境电商"],
] as const;

/** 投放平台与输出语言：居中弹窗，单层表面，平台按分组平铺。 */
export function CommerceMarketPicker({
    platform,
    language,
    region,
    onPlatform,
    onLanguage,
    onRegion,
    onClose,
}: {
    platform: string;
    language: string;
    region: string;
    onPlatform: (value: string) => void;
    onLanguage: (value: string) => void;
    onRegion: (value: string) => void;
    onClose: () => void;
}) {
    _useCreationLocale();
    const [languageOpen, setLanguageOpen] = useState(false);
    const knowledge = commerceKnowledgeFor(platform);
    return (
        <AppModal open flush closable={false} footer={null} width="min(680px, calc(100vw - 32px))" onCancel={onClose} centered className="commerce-market-modal">
            <section className="commerce-market" role="dialog" aria-label={_creationText("creation.5683ce8c4416948a")} data-canvas-no-zoom>
                <header className="commerce-market-head">
                    <div>
                        <h2>{_creationText("creation.d3d11d7a704d5c97")}</h2>
                        <p>{_creationText("creation.e860ac192e19ff06")}</p>
                    </div>
                    <button type="button" className="commerce-market-close" aria-label={_creationText("creation.8ce67e096138c2c8")} onClick={onClose}>
                        <X size={16} />
                    </button>
                </header>
                <div className="commerce-market-body" data-canvas-wheel-scroll>
                    {groups.map(([group, title]) => (
                        <section key={group} className="commerce-market-group">
                            <h3>{title}</h3>
                            <div className="commerce-market-grid">
                                {commercePlatformGroups[group].map((id) => (
                                    <button type="button" key={id} className={platform === id ? "is-selected" : ""} aria-pressed={platform === id} title={labelOf(platforms, id)} onClick={() => onPlatform(id)}>
                                        <span className="commerce-market-logo" aria-hidden="true">
                                            <PlatformMark platform={id} />
                                        </span>
                                        <span className="commerce-market-name">{_creationLabel(labelOf(platforms, id))}</span>
                                    </button>
                                ))}
                            </div>
                        </section>
                    ))}
                    <div className="commerce-market-fields">
                        <div className="commerce-market-field">
                            <h3>{_creationText("creation.0703309cb1bbe989")}</h3>
                            <button className="commerce-language-trigger" type="button" aria-expanded={languageOpen} aria-controls="commerce-language-options" onClick={() => setLanguageOpen((open) => !open)}>
                                <LanguageFlag language={language} />
                                <strong>{languageVisuals[language]?.label || labelOf(languages, language)}</strong>
                                <ChevronDown size={14} className={languageOpen ? "is-open" : ""} />
                            </button>
                        </div>
                        <label className="commerce-market-field">
                            <h3>{_creationText("creation.e8158f6de3196b2a")}</h3>
                            <input aria-label={_creationText("creation.318fbb6693b25f1b")} value={region} maxLength={80} placeholder={_creationText("creation.18a48f66efb2ce7e")} onChange={(event) => onRegion(event.target.value)} />
                        </label>
                    </div>
                    {languageOpen ? (
                        <div id="commerce-language-options" className="commerce-language-options" role="listbox" aria-label={_creationText("creation.0703309cb1bbe989")}>
                            {languages.map(([id, label]) => (
                                <button
                                    type="button"
                                    key={id}
                                    role="option"
                                    aria-selected={language === id}
                                    onClick={() => {
                                        onLanguage(id);
                                        setLanguageOpen(false);
                                    }}
                                >
                                    <LanguageFlag language={id} />
                                    <strong>{languageVisuals[id]?.label || label}</strong>
                                    {language === id ? <Check size={14} /> : null}
                                </button>
                            ))}
                        </div>
                    ) : null}
                    {knowledge ? (
                        <details className="commerce-market-rules" aria-label={_creationText("creation.7ffe78c55af5511b")}>
                            <summary>
                                {_creationLabel(labelOf(platforms, platform))}
                                {_creationText("creation.39fec974c484a254")}
                            </summary>
                            <div>
                                {[knowledge.style, knowledge.risk, knowledge.scope].filter(Boolean).map((text) => (
                                    <p key={text}>{text}</p>
                                ))}
                                {knowledge.officialRules.length ? (
                                    <ul>
                                        {knowledge.officialRules.map((rule) => (
                                            <li key={rule}>{rule}</li>
                                        ))}
                                    </ul>
                                ) : null}
                                <p className="commerce-market-source">
                                    {knowledge.reviewStatus === "pending" ? _creationText("creation.ecffaead5255a9b1") : _creationText("creation.dc166fe9b030f031", { value1: knowledge.checkedAt })}
                                    {knowledge.sources.map((url, index) => (
                                        <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                                            {_creationText("creation.7dfb4e164ef4a436", { value1: index + 1 })}
                                        </a>
                                    ))}
                                </p>
                                <p className="commerce-market-source">
                                    {_creationText("creation.c4e92986e80ab5b9")}
                                    {commercePlatformKnowledge.restrictedPhrases.join("、")}
                                    {_creationText("creation.508da44c129fe3b8")}
                                    {commercePlatformKnowledge.boundary}
                                </p>
                            </div>
                        </details>
                    ) : null}
                </div>
                <footer className="commerce-market-foot">
                    <span>
                        {_creationText("creation.66064880566620cf")}
                        {_creationLabel(labelOf(platforms, platform))} · {languageVisuals[language]?.label || labelOf(languages, language)}
                        {region.trim() ? ` · ${region.trim()}` : ""}
                    </span>
                    <Button type="primary" onClick={onClose}>
                        {_creationText("settings.channel_complete_btn")}
                    </Button>
                </footer>
            </section>
        </AppModal>
    );
}
