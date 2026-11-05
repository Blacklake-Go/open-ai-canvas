import { creationLabel as _creationLabel } from "@/supdance/plugins/i18n/creation-text";
import { creationText as _creationText, useCreationLocale as _useCreationLocale } from "@/supdance/plugins/i18n/creation-text";
import { Modal } from "antd";
import { ArrowUpRight, Check, LoaderCircle, PencilLine, Sparkles, Wand2 } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { EcommerceCreativeDirection, EcommerceStyleRewrite } from "@/services/api/ecommerce";
import { DirectionEditor, directionDescription, directionSwatches, rewriteDirection } from "./direction-cards";
import "./style-picker.css";

const RECOMMENDED = "recommended";
const CUSTOM = "custom";
const UNGROUPED = "更多风格";

/** Starting points for a typed style; clicking one fills the form. */
const inspirations: EcommerceStyleRewrite[] = [
    { name: "赛博霓虹", description: "雨夜街头的霓虹灯牌与湿润反光地面，紫青撞色，超粗发光标题" },
    { name: "莫兰迪奶油", description: "低饱和奶油色与雾感灰调，柔和漫射光，圆润细体字与大留白" },
    { name: "法式复古", description: "巴黎咖啡馆桌面，胶片颗粒与暖色褪色调，优雅衬线标题" },
    { name: "日系清新", description: "通透自然光与浅蓝白色调，干净桌面与绿植，细黑体短句" },
    { name: "暗黑哥特", description: "深酒红与黑色的戏剧暗场，烛光与丝绒，尖锐衬线标题" },
    { name: "极光梦幻", description: "极光渐变与流光粒子，蓝紫梦幻色调，漂浮构图与细线字" },
];

function cardStyle(direction: EcommerceCreativeDirection, index: number): CSSProperties {
    const colors = directionSwatches(direction).flatMap((swatch) => (swatch.color ? [swatch.color] : []));
    const style: Record<string, string | number> = { "--i": index };
    const typography = direction.visual?.typography ?? "";
    style["--style-font"] = /宋|衬线/.test(typography) ? '"Noto Serif SC", "Songti SC", SimSun, serif' : /圆/.test(typography) ? '"Yuanti SC", "Microsoft YaHei", sans-serif' : '"Noto Sans SC", "Microsoft YaHei", sans-serif';
    if (colors.length) Object.assign(style, { "--c1": colors[0], "--c2": colors[1] ?? colors[0], "--c3": colors[2] ?? colors[1] ?? colors[0] });
    return style as CSSProperties;
}

function StyleCard({ direction, index, chosen, disabled, onSelect, onEdit }: { direction: EcommerceCreativeDirection; index: number; chosen: boolean; disabled: boolean; onSelect: () => void; onEdit: () => void }) {
    _useCreationLocale();
    const swatches = directionSwatches(direction).filter((swatch) => swatch.color);
    const typography = direction.visual?.typography?.trim();
    return (
        <div className={`commerce-style-card${chosen ? " is-chosen" : ""}`} style={cardStyle(direction, index)}>
            <button type="button" className="commerce-style-card-select" aria-pressed={chosen} disabled={disabled} onClick={onSelect}>
                <span className="commerce-style-card-art">
                    {swatches.length ? (
                        <span className="commerce-style-card-swatches" aria-hidden="true">
                            {swatches.map((swatch) => (
                                <i key={swatch.label + swatch.color} style={{ background: swatch.color }} />
                            ))}
                        </span>
                    ) : null}
                    <b data-i18n-user-content>{direction.name}</b>
                </span>
                <span className="commerce-style-card-body">
                    <span className="commerce-style-card-desc">{directionDescription(direction)}</span>
                    {typography ? (
                        <span className="commerce-style-card-meta">
                            <em>{_creationText("creation.078838da4218490b")}</em>
                            <span>{typography}</span>
                        </span>
                    ) : null}
                    {swatches.length ? (
                        <span className="commerce-style-card-palette">
                            {swatches.map((swatch) => (
                                <small key={swatch.label + swatch.color}>
                                    <i style={{ background: swatch.color }} aria-hidden="true" />
                                    {swatch.label}
                                </small>
                            ))}
                        </span>
                    ) : null}
                </span>
            </button>
            <span className="commerce-style-card-check" aria-hidden="true">
                <Check size={14} />
            </span>
            <button type="button" className="commerce-style-card-edit" aria-label={_creationText("creation.e9d39f33ec28a0d7", { value1: direction.name })} title={_creationText("creation.a2c333402e074293")} disabled={disabled} onClick={onEdit}>
                <PencilLine size={14} />
            </button>
        </div>
    );
}

/**
 * Style picker shown after the product analysis: the four recommended
 * directions, the style library by category, and the user's own style.
 * Any style can be rewritten before it is confirmed.
 */
export function CommerceStylePicker({
    open,
    directions,
    library,
    disabled,
    degraded,
    onClose,
    onConfirm,
}: {
    open: boolean;
    directions: EcommerceCreativeDirection[];
    library: EcommerceCreativeDirection[];
    disabled: boolean;
    degraded: boolean;
    onClose: () => void;
    onConfirm: (direction: EcommerceCreativeDirection) => void;
}) {
    _useCreationLocale();
    const groups = useMemo(() => [...new Set(library.map((item) => item.group || UNGROUPED))], [library]);
    const [tab, setTab] = useState(RECOMMENDED);
    const [selectedId, setSelectedId] = useState<string>();
    const [rewrites, setRewrites] = useState<Record<string, EcommerceStyleRewrite>>({});
    const [editing, setEditing] = useState<{ id: string; value: EcommerceStyleRewrite }>();
    const [custom, setCustom] = useState<EcommerceStyleRewrite>({ name: "", description: "" });
    const [confirming, setConfirming] = useState(false);
    useEffect(() => {
        setTab(RECOMMENDED);
        setSelectedId(undefined);
        setRewrites({});
        setEditing(undefined);
        setCustom({ name: "", description: "" });
        setConfirming(false);
    }, [directions]);
    useEffect(() => {
        if (!disabled) setConfirming(false);
    }, [disabled]);
    const resolve = (item: EcommerceCreativeDirection) => (rewrites[item.id] ? rewriteDirection(item, rewrites[item.id]) : item);
    const all = [...directions, ...library];
    const visible = tab === RECOMMENDED ? directions : library.filter((item) => (item.group || UNGROUPED) === tab);
    const customReady = Boolean(custom.name.trim() || custom.description.trim());
    const picked = selectedId === CUSTOM ? undefined : all.find((entry) => entry.id === selectedId);
    const chosen = selectedId === CUSTOM ? (customReady ? { name: custom.name.trim() || "自定义风格", group: "自定义" } : undefined) : picked ? { name: resolve(picked).name, group: picked.group || "为你推荐" } : undefined;
    const tabs = [
        { id: RECOMMENDED, label: "为你推荐", count: directions.length },
        ...groups.map((group) => ({ id: group, label: group, count: library.filter((item) => (item.group || UNGROUPED) === group).length })),
        { id: CUSTOM, label: "自定义", count: 0 },
    ];
    const confirm = () => {
        if (disabled || degraded || editing || !chosen) return;
        const direction = selectedId === CUSTOM ? { id: "custom", name: custom.name.trim() || "自定义风格", summary: custom.description.trim(), tags: [] } : picked ? resolve(picked) : undefined;
        if (!direction) return;
        setConfirming(true);
        onConfirm(direction);
    };
    const saveEdit = () => {
        if (!editing) return;
        setRewrites((current) => ({ ...current, [editing.id]: editing.value }));
        setSelectedId(editing.id);
        setEditing(undefined);
    };
    const editCustom = (value: EcommerceStyleRewrite) => {
        setCustom(value);
        setSelectedId(CUSTOM);
    };
    const total = directions.length + library.length;
    return (
        <Modal open={open} onCancel={onClose} footer={null} width={1120} centered destroyOnHidden title={_creationText("creation.4e982299f3fc680e")} className="commerce-style-picker-modal" rootClassName="commerce-style-picker-root">
            <div className="commerce-style-picker">
                <header className="commerce-style-picker-head">
                    <span className="commerce-style-picker-avatar" aria-hidden="true">
                        <Sparkles size={22} />
                    </span>
                    <div>
                        <small>
                            <Sparkles size={12} />
                            STYLE STUDIO · {total}
                            {_creationText("creation.7d4fd03b89c5b220")}
                        </small>
                        <h2>{_creationText("creation.1b7855135d70df8e")}</h2>
                        <p>{_creationText("creation.3d706059692431a5", { value1: total })}</p>
                    </div>
                </header>
                <nav className="commerce-style-picker-tabs" role="tablist" aria-label={_creationText("creation.e563381aba3a3cb2")}>
                    {tabs.map((entry) => (
                        <button
                            key={entry.id}
                            type="button"
                            role="tab"
                            aria-selected={tab === entry.id}
                            className={tab === entry.id ? "is-active" : undefined}
                            onClick={() => {
                                setTab(entry.id);
                                setEditing(undefined);
                            }}
                        >
                            {entry.id === RECOMMENDED ? <Sparkles size={13} aria-hidden="true" /> : entry.id === CUSTOM ? <Wand2 size={13} aria-hidden="true" /> : null}
                            <span>{_creationLabel(entry.label)}</span>
                            {entry.count ? <small>{entry.count}</small> : null}
                        </button>
                    ))}
                </nav>
                {tab === CUSTOM ? (
                    <div className="commerce-style-custom" role="tabpanel" aria-label={_creationText("creation.c14de5fd9459578f")}>
                        <div className="commerce-style-custom-form">
                            <label>
                                <span>{_creationText("creation.d389412eaadbfeba")}</span>
                                <input value={custom.name} maxLength={40} placeholder={_creationText("creation.9cc93df55f34655f")} onChange={(event) => editCustom({ ...custom, name: event.target.value })} />
                            </label>
                            <label>
                                <span>{_creationText("creation.a2d8639591bb1435")}</span>
                                <textarea value={custom.description} maxLength={500} rows={5} placeholder={_creationText("creation.ca2f99103bdcdb4c")} onChange={(event) => editCustom({ ...custom, description: event.target.value })} />
                            </label>
                            <p>{_creationText("creation.d94e6b77a9b373dd")}</p>
                        </div>
                        <div className="commerce-style-inspirations">
                            <span>{_creationText("creation.e8df678bd4602b82")}</span>
                            {inspirations.map((entry, index) => (
                                <button key={entry.name} type="button" style={{ "--i": index } as CSSProperties} onClick={() => editCustom(entry)}>
                                    <b data-i18n-user-content>{entry.name}</b>
                                    <small data-i18n-user-content>{entry.description}</small>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="commerce-style-grid" role="tabpanel" aria-label={tab === RECOMMENDED ? _creationText("creation.1795a8edfa43630c") : tab} key={tab}>
                        {visible.map((item, index) =>
                            editing?.id === item.id ? (
                                <DirectionEditor
                                    key={item.id}
                                    className="commerce-style-card is-editing"
                                    index={index}
                                    value={editing.value}
                                    onChange={(value) => setEditing({ id: item.id, value })}
                                    onCancel={() => setEditing(undefined)}
                                    onSave={saveEdit}
                                />
                            ) : (
                                <StyleCard
                                    key={item.id}
                                    direction={resolve(item)}
                                    index={index}
                                    chosen={selectedId === item.id}
                                    disabled={disabled || degraded}
                                    onSelect={() => setSelectedId(item.id)}
                                    onEdit={() => {
                                        const current = resolve(item);
                                        setEditing({ id: item.id, value: { name: current.name, description: directionDescription(current) } });
                                    }}
                                />
                            ),
                        )}
                    </div>
                )}
                <footer className="commerce-style-picker-footer">
                    <span>
                        {chosen ? (
                            <>
                                {_creationText("creation.7ecf1cde648680d2")}
                                <b>{chosen.name}</b>
                                <em>{chosen.group}</em>
                            </>
                        ) : degraded ? (
                            _creationText("creation.acc5bbe8a78d6396")
                        ) : (
                            _creationText("creation.e8aa81730a7f83b9")
                        )}
                    </span>
                    <div>
                        <button type="button" className="commerce-style-picker-later" onClick={onClose}>
                            {_creationText("creation.776bea9083995c3c")}
                        </button>
                        <button type="button" className="commerce-style-picker-confirm" disabled={!chosen || disabled || degraded || Boolean(editing)} onClick={confirm}>
                            {confirming && disabled ? (
                                <>
                                    <LoaderCircle size={15} className="is-spinning" aria-hidden="true" />
                                    {_creationText("creation.06af5abb1385238c")}
                                </>
                            ) : (
                                <>
                                    {_creationText("creation.f874d90e76f48938")}
                                    <ArrowUpRight size={15} aria-hidden="true" />
                                </>
                            )}
                        </button>
                    </div>
                </footer>
            </div>
        </Modal>
    );
}
