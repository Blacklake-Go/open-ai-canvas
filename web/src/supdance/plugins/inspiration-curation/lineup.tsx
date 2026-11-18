import { useState } from "react";
import { Button, Input, Segmented, Slider, Tag } from "antd";
import { ArrowDown, ArrowUp, GripVertical, Pin, Trash2 } from "lucide-react";
import { inspirationSourceOf, type CreationInspiration } from "@/lib/inspirations/catalog";
import { useUserStore } from "@/stores/use-user-store";
import { InspirationCover } from "@/pages/inspirations/inspiration-detail-modal";
import { useI18n } from "@/supdance/plugins/i18n";
import type { CurationCard, CurationDocument, FeaturedCase } from "./api";
import { moveFeatured, pinFeatured } from "./order";

type Props = { doc: CurationDocument; inventory: ReadonlyMap<string, CurationCard>; disabled: boolean; onChange: (items: FeaturedCase[]) => void };

export function FeaturedLineup({ doc, inventory, disabled, onChange }: Props) {
    const { t } = useI18n();
    const label = (key: string) => t(`inspiration.curation.${key}`);
    const [dragging, setDragging] = useState<string>();
    const [active, setActive] = useState<string>();
    const [mode, setMode] = useState<"desktop" | "mobile">("desktop");
    const sourceVisible = useUserStore((state) => state.features.inspirationSourcesVisible);
    const items = doc.featured;
    const selected = items.find((item) => item.id === active);
    const patch = (value: Partial<FeaturedCase>) => {
        if (selected) onChange(items.map((item) => (item.id === selected.id ? { ...item, ...value } : item)));
    };

    return (
        <div className="curation-stack">
            <p>{label("orderHint")}</p>
            {!items.length && <p role="status">{label("empty")}</p>}
            <ol className="curation-order">
                {items.map((item, index) => {
                    const card = inventory.get(item.id);
                    const title = item.title || card?.title || item.id;
                    return (
                        <li
                            key={item.id}
                            className="curation-order-item"
                            onDragOver={(event) => {
                                if (dragging && items.find((row) => row.id === dragging)?.pinned === item.pinned) event.preventDefault();
                            }}
                            onDrop={(event) => {
                                event.preventDefault();
                                if (dragging && !disabled) onChange(moveFeatured(items, dragging, item.id));
                                setDragging(undefined);
                            }}
                        >
                            <span
                                draggable={!disabled}
                                className="curation-grip"
                                title={label("orderHint")}
                                onDragStart={(event) => {
                                    event.dataTransfer.setData("text/plain", item.id);
                                    event.dataTransfer.effectAllowed = "move";
                                    setDragging(item.id);
                                }}
                                onDragEnd={() => setDragging(undefined)}
                            >
                                <GripVertical size={18} aria-hidden="true" />
                                <span>{index + 1}</span>
                            </span>
                            <Button type="text" className="curation-order-title" aria-pressed={item.id === active} onClick={() => setActive(item.id === active ? undefined : item.id)}>
                                {title}
                            </Button>
                            {!card?.eligible && <Tag>{label("blocked")}</Tag>}
                            <div className="curation-actions">
                                <Button
                                    type="text"
                                    aria-label={`${label(item.pinned ? "unpin" : "pin")} · ${title}`}
                                    title={label(item.pinned ? "unpin" : "pin")}
                                    aria-pressed={item.pinned}
                                    disabled={disabled}
                                    icon={<Pin size={16} />}
                                    onClick={() => onChange(pinFeatured(items, item.id))}
                                />
                                <Button
                                    type="text"
                                    aria-label={`${label("up")} · ${title}`}
                                    disabled={disabled || index === 0 || items[index - 1].pinned !== item.pinned}
                                    icon={<ArrowUp size={16} />}
                                    onClick={() => onChange(moveFeatured(items, item.id, items[index - 1].id))}
                                />
                                <Button
                                    type="text"
                                    aria-label={`${label("down")} · ${title}`}
                                    disabled={disabled || index + 1 === items.length || items[index + 1].pinned !== item.pinned}
                                    icon={<ArrowDown size={16} />}
                                    onClick={() => onChange(moveFeatured(items, item.id, items[index + 1].id))}
                                />
                                <Button type="text" aria-label={`${label("remove")} · ${title}`} disabled={disabled} icon={<Trash2 size={16} />} onClick={() => onChange(items.filter((row) => row.id !== item.id))} />
                            </div>
                        </li>
                    );
                })}
            </ol>
            {selected && (
                <div className="curation-controls curation-batch">
                    <label>
                        {label("displayTitle")}
                        <Input disabled={disabled} maxLength={80} value={selected.title ?? ""} placeholder={inventory.get(selected.id)?.title} onChange={(e) => patch({ title: e.target.value })} />
                    </label>
                    <label>
                        {label("focusX")}
                        <Slider disabled={disabled} aria-label={label("focusX")} value={selected.focusX} onChange={(focusX) => patch({ focusX })} />
                    </label>
                    <label>
                        {label("focusY")}
                        <Slider disabled={disabled} aria-label={label("focusY")} value={selected.focusY} onChange={(focusY) => patch({ focusY })} />
                    </label>
                </div>
            )}
            <div className="curation-actions">
                <strong>{label("preview")}</strong>
                <Segmented
                    aria-label={label("preview")}
                    value={mode}
                    options={[
                        { value: "desktop", label: label("desktop") },
                        { value: "mobile", label: label("mobile") },
                    ]}
                    onChange={setMode}
                />
            </div>
            <section className={`curation-preview curation-preview-${mode}`} aria-label={`${label("preview")} · ${label(mode)}`}>
                {items.some(({ id }) => inventory.get(id)?.eligible) ? (
                    <div className="curation-preview-grid">
                        {items.map((item) => {
                            const card = inventory.get(item.id);
                            if (!card?.eligible) return null;
                            const style = doc.styles.find((term) => term.id === doc.cases[item.id]?.styles[0]);
                            const source = inspirationSourceOf({ sourceId: card.source as CreationInspiration["sourceId"] } as CreationInspiration);
                            return (
                                <article className="curation-preview-card" key={item.id}>
                                    <div className="curation-preview-cover">
                                        <InspirationCover key={card.image} image={card.image} focus={item} />
                                        {sourceVisible && source && <span>{source.name ?? t(source.label)}</span>}
                                    </div>
                                    <strong>{item.title || card.title}</strong>
                                    {style && <small>{style.label || label(style.id)}</small>}
                                </article>
                            );
                        })}
                    </div>
                ) : (
                    <p>{label("empty")}</p>
                )}
            </section>
        </div>
    );
}
