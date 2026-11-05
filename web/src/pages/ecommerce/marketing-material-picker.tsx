import { creationText as _creationText, useCreationLocale as _useCreationLocale } from "@/supdance/plugins/i18n/creation-text";
import { Check, Minus, Plus, RotateCcw, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { EcommerceDraft } from "@/services/api/ecommerce";
import { imageSizeLabel } from "./catalog";
import { CommerceHint } from "./commerce-hint";
import { automaticMarketingSelections, marketingCategories, marketingMaterialById, marketingMaterials, parseMarketingSelections, recommendMarketingSelections, type MarketingSelection } from "./marketing-materials";

export function MarketingMaterialPicker({ draft, ratios, onChange, onClose }: { draft: EcommerceDraft; ratios: string[]; onChange: (selections: MarketingSelection[]) => void; onClose: () => void }) {
    _useCreationLocale();
    const [category, setCategory] = useState<string>(() => marketingMaterialById.get(parseMarketingSelections(draft)[0]?.id)?.category || marketingCategories[0]);
    const available = ratios.length ? ratios : [draft.ratio];
    const savedSelections = parseMarketingSelections(draft);
    const selections = automaticMarketingSelections(savedSelections, available, draft.ratio);
    const selected = new Map(selections.map((item) => [item.id, item]));
    const count = selections.reduce((sum, item) => sum + item.count, 0);
    useEffect(() => {
        if ((draft.typeOptions?.materialPlan || "[]") !== JSON.stringify(selections)) onChange(selections);
    }, [draft.typeOptions?.materialPlan, available.join("|"), draft.ratio]);
    const update = (id: string, change: (entry: MarketingSelection | undefined) => MarketingSelection | undefined) => {
        const next = change(selected.get(id));
        onChange([...selections.filter((item) => item.id !== id), ...(next ? [next] : [])]);
    };
    return (
        <div className="commerce-material-picker" aria-label={_creationText("creation.5a0a00142ce4d810")}>
            <nav className="commerce-material-categories" aria-label={_creationText("creation.d97d22cf37549b2a")}>
                {marketingCategories.map((name) => {
                    const selectedCount = selections.filter((entry) => marketingMaterialById.get(entry.id)?.category === name).reduce((sum, entry) => sum + entry.count, 0);
                    return (
                        <CommerceHint key={name} text={category === name ? _creationText("creation.a84d950b013fac08", { value1: name }) : _creationText("creation.0ddab77a9912c8f1", { value1: name })} placement="right">
                            <button
                                type="button"
                                aria-current={category === name ? "true" : undefined}
                                onClick={() => {
                                    if (category !== name) {
                                        setCategory(name);
                                        if (count) onChange([]);
                                    }
                                }}
                            >
                                {name}
                                {selectedCount ? ` (${selectedCount})` : ""}
                            </button>
                        </CommerceHint>
                    );
                })}
            </nav>
            <div className="commerce-material-main">
                <header>
                    <div className="commerce-material-actions">
                        <CommerceHint text={_creationText("creation.79dc1e12dbc61fd7")}>
                            <button type="button" onClick={() => onChange(recommendMarketingSelections([draft.instruction, draft.productName, draft.scene].join(" "), category, available))}>
                                <Sparkles size={14} />
                                {_creationText("creation.564149c74897db9a")}
                            </button>
                        </CommerceHint>
                        <CommerceHint text={_creationText("creation.654be86b738b77e1")}>
                            <button type="button" onClick={() => onChange([])} disabled={!count}>
                                <RotateCcw size={14} />
                                {_creationText("common.reset")}
                            </button>
                        </CommerceHint>
                        <span>
                            {_creationText("creation.7ecf1cde648680d2")}
                            {count}
                            <i> / 15</i>
                        </span>
                    </div>
                    <CommerceHint text={_creationText("creation.071d4d91038ed5c2")}>
                        <button type="button" className="commerce-material-close" aria-label={_creationText("creation.50d5c619568ea960")} onClick={onClose}>
                            <X size={15} />
                        </button>
                    </CommerceHint>
                </header>
                <div className="commerce-material-grid">
                    {marketingMaterials
                        .filter((item) => item.category === category)
                        .map((item) => {
                            const choice = selected.get(item.id);
                            const active = Boolean(choice);
                            const autoSelection = automaticMarketingSelections([{ id: item.id, count: 1, ratio: item.ratio }], available, draft.ratio)[0];
                            const visibleRatio = imageSizeLabel(choice?.ratio || autoSelection.ratio);
                            return (
                                <div key={item.id} className={`commerce-material-tile${active ? " is-selected" : ""}`}>
                                    <CommerceHint
                                        text={active ? _creationText("creation.65a7764fbc7f6240", { value1: item.name }) : count >= 15 ? _creationText("creation.d3bf0b4ff53ed090") : _creationText("creation.d3354f2583e2681e", { value1: item.name })}
                                    >
                                        <button
                                            type="button"
                                            className="commerce-material-select"
                                            aria-pressed={active}
                                            aria-label={`${active ? _creationText("common.cancel") : _creationText("creation.c11330b85234f9c0")}${item.name}`}
                                            disabled={!active && count >= 15}
                                            onClick={() => update(item.id, (entry) => (entry ? undefined : autoSelection))}
                                        >
                                            <span className="commerce-material-check">{active ? <Check size={13} strokeWidth={2.6} /> : null}</span>
                                            <span>{item.name}</span>
                                        </button>
                                    </CommerceHint>
                                    {active ? (
                                        <div className="commerce-material-controls">
                                            <CommerceHint text={_creationText("creation.ea639db0d43573cf", { value1: item.name, value2: Math.max(1, choice!.count - 1) })}>
                                                <button
                                                    type="button"
                                                    aria-label={_creationText("creation.08fbffbf79d83f66", { value1: item.name })}
                                                    disabled={choice!.count <= 1}
                                                    onClick={() => update(item.id, (entry) => (entry && entry.count > 1 ? { ...entry, count: entry.count - 1 } : entry))}
                                                >
                                                    <Minus size={13} />
                                                </button>
                                            </CommerceHint>
                                            <span>{choice!.count}</span>
                                            <CommerceHint text={count >= 15 ? _creationText("creation.d603272eb97ab3b5") : _creationText("creation.a648bcc83a3978eb", { value1: item.name })}>
                                                <button
                                                    type="button"
                                                    aria-label={_creationText("creation.f252917c3ef3ccf7", { value1: item.name })}
                                                    disabled={count >= 15}
                                                    onClick={() => update(item.id, (entry) => (entry ? { ...entry, count: entry.count + 1 } : undefined))}
                                                >
                                                    <Plus size={13} />
                                                </button>
                                            </CommerceHint>
                                        </div>
                                    ) : null}
                                    <span className="commerce-material-ratio" aria-label={_creationText("creation.9b76036e2e95f9f5", { value1: item.name, value2: visibleRatio })}>
                                        {visibleRatio}
                                    </span>
                                </div>
                            );
                        })}
                </div>
                <p>{_creationText("creation.0784565a29b637a4")}</p>
            </div>
        </div>
    );
}
