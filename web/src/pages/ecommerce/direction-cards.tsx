import { creationLabel as _creationLabel } from "@/supdance/plugins/i18n/creation-text";
import { creationText as _creationText, useCreationLocale as _useCreationLocale } from "@/supdance/plugins/i18n/creation-text";
import { ArrowUpRight, Check, PencilLine, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { NavCreateIcon, RefreshIcon, StyleLibraryIcon } from "@/components/ui/ecommerce-icons";
import type { EcommerceCreativeDirection, EcommerceStyleRewrite } from "@/services/api/ecommerce";
import "./style-picker.css";

type Swatch = { label: string; color?: string };

/** Palette entries arrive as "中文色名 #HEX"; older directions only have names. */
export function directionSwatches(direction: EcommerceCreativeDirection): Swatch[] {
    const source = direction.visual?.palette?.length ? direction.visual.palette : direction.tags.filter((tag) => !/^\d+:\d+$/.test(tag));
    return source.slice(0, 4).map((entry) => {
        const match = entry.match(/#(?:[0-9a-f]{6}|[0-9a-f]{3})\b/i);
        return {
            label:
                entry
                    .replace(match?.[0] || "", "")
                    .replace(/[（）()]/g, "")
                    .trim() || entry,
            color: match?.[0],
        };
    });
}

/** The description a user reads and rewrites for a direction. */
export function directionDescription(direction: EcommerceCreativeDirection) {
    return direction.visual?.style || direction.summary;
}

/** An edited name and description replace the generated ones everywhere they are shown. */
export function rewriteDirection(direction: EcommerceCreativeDirection, rewrite: EcommerceStyleRewrite): EcommerceCreativeDirection {
    const name = rewrite.name.trim() || direction.name;
    const description = rewrite.description.trim() || directionDescription(direction);
    return { ...direction, name, summary: description, visual: direction.visual ? { ...direction.visual, style: description } : undefined };
}

function directionSpecs(direction: EcommerceCreativeDirection) {
    const visual = direction.visual;
    if (!visual) return [];
    return [
        ["布景", visual.scene],
        ["布光", visual.lighting],
        ["镜头", visual.camera],
        ["字体", visual.typography],
    ]
        .filter((entry): entry is [string, string] => Boolean(entry[1]?.trim()))
        .slice(0, 3);
}

/** Inline editor for one style: its name and its description. */
export function DirectionEditor({ index, value, className, onChange, onCancel, onSave }: { index: number; value: EcommerceStyleRewrite; className: string; onChange: (value: EcommerceStyleRewrite) => void; onCancel: () => void; onSave: () => void }) {
    _useCreationLocale();
    return (
        <div className={className}>
            <input
                aria-label={_creationText("creation.c0391ede55c89463", { value1: index + 1 })}
                value={value.name}
                maxLength={40}
                placeholder={_creationText("creation.cc6cd8c0abc2d827")}
                onChange={(event) => onChange({ ...value, name: event.target.value })}
            />
            <textarea
                aria-label={_creationText("creation.fc381993bbdda739", { value1: index + 1 })}
                value={value.description}
                maxLength={500}
                placeholder={_creationText("creation.a73fda6f5927b7ef")}
                onChange={(event) => onChange({ ...value, description: event.target.value })}
            />
            <div className="commerce-direction-edit-actions">
                <button type="button" onClick={onCancel}>
                    <X size={14} />
                    {_creationText("common.cancel")}
                </button>
                <button type="button" disabled={!value.name.trim() && !value.description.trim()} onClick={onSave}>
                    <Check size={14} />
                    {_creationText("common.save")}
                </button>
            </div>
        </div>
    );
}

function DirectionCard({ direction, index, chosen, disabled, onSelect }: { direction: EcommerceCreativeDirection; index: number; chosen: boolean; disabled: boolean; onSelect: () => void }) {
    _useCreationLocale();
    const swatches = directionSwatches(direction);
    const colored = swatches.filter((swatch) => swatch.color);
    const specs = directionSpecs(direction);
    return (
        <button type="button" className={`flylep-direction-card${chosen ? " is-chosen" : ""}`} aria-pressed={chosen} disabled={disabled} onClick={onSelect}>
            <span className={`commerce-direction-palette${colored.length ? "" : " is-empty"}`} aria-hidden="true">
                {colored.length ? colored.map((swatch) => <i key={swatch.label + swatch.color} style={{ background: swatch.color }} />) : <b>{String(index + 1).padStart(2, "0")}</b>}
            </span>
            <span className="commerce-direction-body">
                <span className="commerce-direction-title">
                    <span className="commerce-direction-number" aria-hidden="true">
                        {String(index + 1).padStart(2, "0")}
                    </span>
                    <strong data-i18n-user-content>{direction.name}</strong>
                    {chosen ? <Check size={15} className="commerce-direction-check" /> : null}
                </span>
                <span className="commerce-direction-description" data-i18n-user-content>
                    {directionDescription(direction)}
                </span>
                {specs.length ? (
                    <span className="commerce-direction-specs">
                        {specs.map(([label, value]) => (
                            <span key={label}>
                                <em>{_creationLabel(label)}</em>
                                <span data-i18n-user-content>{value}</span>
                            </span>
                        ))}
                    </span>
                ) : null}
                {swatches.length ? (
                    <span className="commerce-direction-tags">
                        {swatches.map((swatch) => (
                            <small key={swatch.label}>
                                {swatch.color ? <i style={{ background: swatch.color }} aria-hidden="true" /> : null}
                                {swatch.label}
                            </small>
                        ))}
                    </span>
                ) : null}
                {direction.visual?.why ? (
                    <span className="commerce-direction-why" data-i18n-user-content>
                        {direction.visual.why}
                    </span>
                ) : null}
            </span>
        </button>
    );
}

export function CommerceDirectionCards({
    directions,
    followup,
    disabled,
    degraded,
    outdated = false,
    libraryCount = 0,
    onChoose,
    onRefresh,
    onOpenLibrary,
}: {
    directions: EcommerceCreativeDirection[];
    followup: boolean;
    disabled: boolean;
    degraded: boolean;
    outdated?: boolean;
    libraryCount?: number;
    onChoose: (direction: EcommerceCreativeDirection) => void;
    onRefresh: () => void;
    onOpenLibrary?: () => void;
}) {
    _useCreationLocale();
    const [items, setItems] = useState(directions);
    const [editing, setEditing] = useState<{ id: string; value: EcommerceStyleRewrite }>();
    const [selectedId, setSelectedId] = useState<string>();
    useEffect(() => {
        setItems(directions);
        setEditing(undefined);
        setSelectedId(undefined);
    }, [directions]);
    const save = () => {
        if (!editing) return;
        setItems((current) => current.map((entry) => (entry.id === editing.id ? rewriteDirection(entry, editing.value) : entry)));
        setSelectedId(editing.id);
        setEditing(undefined);
    };
    return (
        <section className={`flylep-directions-stage commerce-direction-message${followup ? " is-followup" : ""}`} aria-label={followup ? _creationText("creation.1795a8edfa43630c") : _creationText("creation.cd5879deabb8149c")}>
            <header className="commerce-direction-header">
                <span className="commerce-direction-symbol">
                    <Sparkles size={18} aria-hidden="true" />
                </span>
                <h2>
                    {followup ? (
                        <>
                            <NavCreateIcon size={16} />
                            {_creationText("creation.1795a8edfa43630c")}
                        </>
                    ) : (
                        _creationText("creation.451d259b2b422cf4")
                    )}
                </h2>
                {onOpenLibrary ? (
                    <button
                        type="button"
                        className="commerce-direction-library"
                        aria-label={_creationText("creation.0fae2602bf1d9809")}
                        title={_creationText("creation.bf1916e1dfcc7a59")}
                        disabled={disabled || degraded || outdated}
                        onClick={onOpenLibrary}
                    >
                        <StyleLibraryIcon size={15} />
                        <span>{_creationText("creation.7062b2c214ad5cdc")}</span>
                        {libraryCount ? <span className="commerce-count-badge is-neutral">{libraryCount + items.length}</span> : null}
                    </button>
                ) : null}
            </header>
            <p className="commerce-direction-intro">
                {outdated ? _creationText("creation.9058998c6eeff080") : degraded ? _creationText("creation.8d6e92df4bcee248") : followup ? _creationText("creation.ec005387bd1c72fc") : _creationText("creation.8a3dfe6ff941295c")}
            </p>
            <div className="flylep-directions-grid">
                {items.map((direction, index) =>
                    editing?.id === direction.id ? (
                        <DirectionEditor
                            key={direction.id}
                            className="flylep-direction-card is-editing"
                            index={index}
                            value={editing.value}
                            onChange={(value) => setEditing({ id: direction.id, value })}
                            onCancel={() => setEditing(undefined)}
                            onSave={save}
                        />
                    ) : (
                        <div className="commerce-direction-item" key={direction.id}>
                            <DirectionCard direction={direction} index={index} chosen={selectedId === direction.id} disabled={disabled || degraded || outdated} onSelect={() => setSelectedId(direction.id)} />
                            <button
                                type="button"
                                className="commerce-direction-edit"
                                aria-label={_creationText("creation.9ff47b1a7acdd946", { value1: index + 1 })}
                                title={_creationText("creation.a2c333402e074293")}
                                disabled={disabled || degraded || outdated}
                                onClick={() => setEditing({ id: direction.id, value: { name: direction.name, description: directionDescription(direction) } })}
                            >
                                <PencilLine size={13} />
                            </button>
                        </div>
                    ),
                )}
            </div>
            <footer>
                <button type="button" onClick={onRefresh} disabled={disabled}>
                    <RefreshIcon size={15} />
                    {_creationText("creation.e0bd6be7d005be51")}
                </button>
                <button
                    type="button"
                    className="commerce-direction-confirm"
                    disabled={disabled || degraded || outdated || !selectedId || Boolean(editing)}
                    onClick={() => {
                        const item = items.find((entry) => entry.id === selectedId);
                        if (item) onChoose(item);
                    }}
                >
                    {degraded ? _creationText("creation.dda5dbec3628ae92") : !selectedId ? _creationText("creation.1a91072a5f978c8a") : _creationText("creation.aa5c29cff1ceb9fa")}
                    <ArrowUpRight size={14} />
                </button>
            </footer>
        </section>
    );
}
