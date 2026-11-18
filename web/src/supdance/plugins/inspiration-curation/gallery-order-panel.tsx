import { useState } from "react";
import { Alert, App, Button, InputNumber, Pagination, Tag } from "antd";
import { ArrowDown, ArrowUp, GripVertical, Trash2 } from "lucide-react";
import { useI18n } from "@/supdance/plugins/i18n";
import type { CurationCard } from "./api";
import { moveGalleryItem } from "./order";

const PAGE_SIZE = 24;
type Props = {
    order?: string[];
    inventory: ReadonlyMap<string, CurationCard>;
    disabled: boolean;
    onChange: (order: string[] | undefined) => void;
    onBrowse: () => void;
};

export function GalleryOrderPanel({ order, inventory, disabled, onChange, onBrowse }: Props) {
    const { t } = useI18n();
    const { modal } = App.useApp();
    const label = (key: string) => t(`inspiration.curation.${key}`);
    const [page, setPage] = useState(1);
    const [dragged, setDragged] = useState<string>();
    const [position, setPosition] = useState<{ id: string; target: number | null }>();
    const ids = order ?? [];
    const currentPage = Math.min(page, Math.max(1, Math.ceil(ids.length / PAGE_SIZE)));
    const start = (currentPage - 1) * PAGE_SIZE;
    const eligible = ids.filter((id) => inventory.get(id)?.eligible).length;

    function move(id: string, target: number) {
        if (disabled) return;
        onChange(moveGalleryItem(ids, id, target));
        setPage(Math.ceil(target / PAGE_SIZE));
        setPosition(undefined);
    }

    return (
        <section className="curation-stack" aria-label={label("galleryList")}>
            <p>{label(order ? "manualGalleryHelp" : "automaticGalleryHelp")}</p>
            <div className="curation-actions">
                <Button disabled={disabled} onClick={onBrowse}>
                    {label("catalog")}
                </Button>
                {order ? (
                    <Button disabled={disabled} onClick={() => modal.confirm({ title: label("automaticGallery"), content: label("automaticGalleryHelp"), onOk: () => onChange(undefined) })}>
                        {label("automaticGallery")}
                    </Button>
                ) : (
                    <Button disabled={disabled} onClick={() => onChange([])}>
                        {label("manualGallery")}
                    </Button>
                )}
                {order && <span role="status">{t("inspiration.curation.galleryCount", { count: eligible, total: ids.length })}</span>}
            </div>
            {order && !eligible && <Alert type="warning" showIcon title={label("publishEmptyGallery")} />}
            {order && ids.length > 0 && (
                <ol className="curation-order" start={start + 1}>
                    {ids.slice(start, start + PAGE_SIZE).map((id, index) => {
                        const rank = start + index + 1;
                        const card = inventory.get(id);
                        const title = card?.title ?? id;
                        const moveTo = position?.id === id ? position.target : rank;
                        const moveToValid = moveTo !== null && Number.isInteger(moveTo) && moveTo >= 1 && moveTo <= ids.length && moveTo !== rank;
                        return (
                            <li
                                key={id}
                                className="curation-order-item"
                                onDragOver={(event) => {
                                    if (!disabled && dragged) event.preventDefault();
                                }}
                                onDrop={(event) => {
                                    event.preventDefault();
                                    if (dragged && dragged !== id) move(dragged, rank);
                                    setDragged(undefined);
                                }}
                            >
                                <span
                                    className="curation-grip"
                                    draggable={!disabled}
                                    onDragStart={(event) => {
                                        event.dataTransfer.setData("text/plain", id);
                                        setDragged(id);
                                    }}
                                    onDragEnd={() => setDragged(undefined)}
                                >
                                    <GripVertical size={18} aria-hidden="true" />
                                    <span>{rank}</span>
                                </span>
                                <span className="curation-order-title">{title}</span>
                                {!card?.eligible && <Tag>{label("unavailableForGallery")}</Tag>}
                                <div className="curation-actions">
                                    <InputNumber
                                        aria-label={`${label("galleryPosition")} · ${title}`}
                                        disabled={disabled}
                                        min={1}
                                        max={ids.length}
                                        precision={0}
                                        value={moveTo}
                                        onChange={(target) => setPosition({ id, target })}
                                        onPressEnter={() => {
                                            if (moveToValid) move(id, moveTo);
                                        }}
                                    />
                                    <Button
                                        disabled={disabled || !moveToValid}
                                        onClick={() => {
                                            if (moveToValid) move(id, moveTo);
                                        }}
                                    >
                                        {label("moveToPosition")}
                                    </Button>
                                    <Button type="text" disabled={disabled || rank === 1} aria-label={`${label("up")} · ${title}`} icon={<ArrowUp size={16} />} onClick={() => move(id, rank - 1)} />
                                    <Button type="text" disabled={disabled || rank === ids.length} aria-label={`${label("down")} · ${title}`} icon={<ArrowDown size={16} />} onClick={() => move(id, rank + 1)} />
                                    <Button
                                        type="text"
                                        disabled={disabled}
                                        aria-label={`${label("remove")} · ${title}`}
                                        icon={<Trash2 size={16} />}
                                        onClick={() => {
                                            onChange(ids.filter((item) => item !== id));
                                            setPosition(undefined);
                                        }}
                                    />
                                </div>
                            </li>
                        );
                    })}
                </ol>
            )}
            {ids.length > PAGE_SIZE && <Pagination current={currentPage} pageSize={PAGE_SIZE} total={ids.length} onChange={setPage} showSizeChanger={false} />}
        </section>
    );
}
