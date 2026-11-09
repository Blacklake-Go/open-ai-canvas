import { creationLabel as _creationLabel, creationText as _creationText, useCreationLocale as _useCreationLocale } from "@/supdance/plugins/i18n/creation-text";
import { useEffect } from "react";
import { App, Button } from "antd";
import { Check, ChevronLeft, ChevronRight, Copy, Flame, X } from "lucide-react";

import { AppModal } from "@/components/ui/product/app-modal";
import { DRAMA_STYLE_CATEGORIES, findDramaStyle, styleCoverBackground } from "@/lib/drama/drama-styles";

const DETAIL_ROWS = [
    { key: "medium", label: "画面媒介" },
    { key: "world", label: "题材场景" },
    { key: "look", label: "色彩光影" },
    { key: "wardrobe", label: "服化道" },
    { key: "forbid", label: "避免出现" },
] as const;

/** 风格详情：大图 + 分项美术基线 + 完整提示词；左右键在当前筛选结果里切换。 */
export function DramaStyleDetailModal({
    styleId,
    selectedId,
    navigationIds,
    onNavigate,
    onUse,
    onClose,
}: {
    styleId: string | null;
    selectedId: string;
    navigationIds: string[];
    onNavigate: (id: string) => void;
    onUse: (id: string) => void;
    onClose: () => void;
}) {
    _useCreationLocale();
    const { message } = App.useApp();
    const style = styleId ? findDramaStyle(styleId) : undefined;
    const index = styleId ? navigationIds.indexOf(styleId) : -1;
    const prevId = index > 0 ? navigationIds[index - 1] : undefined;
    const nextId = index >= 0 && index < navigationIds.length - 1 ? navigationIds[index + 1] : undefined;

    useEffect(() => {
        if (!style) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.target instanceof HTMLElement && event.target.closest("input, textarea, [contenteditable]")) return;
            if (event.key === "ArrowLeft" && prevId) onNavigate(prevId);
            if (event.key === "ArrowRight" && nextId) onNavigate(nextId);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [style, prevId, nextId, onNavigate]);

    const copyPrompt = async () => {
        if (!style) return;
        try {
            await navigator.clipboard.writeText(style.prompt);
            message.success(_creationText("creation.94f4537387031956"));
        } catch {
            message.error(_creationText("creation.c883084221db6b02"));
        }
    };

    const active = style?.id === selectedId;
    const categoryLabel = style ? DRAMA_STYLE_CATEGORIES.find((item) => item.key === style.category)?.label : "";

    return (
        <AppModal open={Boolean(style)} onCancel={onClose} footer={null} title={null} closable={false} flush centered width="min(880px, calc(100vw - 48px))" rootClassName="drama-root" aria-label={_creationText("creation.8218914b51125fc1")}>
            {style ? (
                <div className="drama-style-detail">
                    <div className="drama-style-detail-cover" style={{ background: styleCoverBackground(style) }}>
                        {!style.cover ? (
                            <span className="drama-style-detail-glyph" aria-hidden>
                                {style.name.replace(/^3D\s*/, "").slice(0, 2)}
                            </span>
                        ) : null}
                        <div className="drama-style-detail-palette" aria-label={_creationText("creation.11979c5c7accd336")}>
                            {style.palette.map((color) => (
                                <span key={color} style={{ background: color }} title={color} />
                            ))}
                        </div>
                    </div>
                    <div className="drama-style-detail-body">
                        <header className="drama-style-detail-head">
                            <div className="min-w-0">
                                <div className="drama-style-detail-meta">
                                    <span>{_creationLabel(categoryLabel || "")}</span>
                                    {style.hot ? (
                                        <span className="is-hot">
                                            <Flame className="size-3" />
                                            {_creationText("creation.71aeddefe9d2d0b0")}
                                        </span>
                                    ) : null}
                                    {index >= 0 ? (
                                        <span className="drama-style-detail-index">
                                            {index + 1} / {navigationIds.length}
                                        </span>
                                    ) : null}
                                </div>
                                <h3>{style.name}</h3>
                                <p>{style.description}</p>
                            </div>
                            <Button type="text" icon={<X className="size-4" />} aria-label={_creationText("common.close")} onClick={onClose} />
                        </header>
                        <div className="drama-style-detail-tags">
                            {style.tags.map((tag) => (
                                <span key={tag}>{tag}</span>
                            ))}
                        </div>
                        <dl className="drama-style-detail-rows thin-scrollbar">
                            {DETAIL_ROWS.map((row) => (
                                <div key={row.key}>
                                    <dt>{_creationLabel(row.label)}</dt>
                                    <dd>{style.detail[row.key]}</dd>
                                </div>
                            ))}
                            <div>
                                <dt>
                                    {_creationText("creation.1ae0d6d3e41b17ba")}
                                    <button type="button" className="drama-style-detail-copy" onClick={() => void copyPrompt()}>
                                        <Copy className="size-3" />
                                        {_creationText("creation.63d90d977348ab1f")}
                                    </button>
                                </dt>
                                <dd className="is-prompt">{style.prompt}</dd>
                            </div>
                        </dl>
                        <p className="drama-style-detail-note">
                            {_creationText("creation.54ce99dfe7a63b16")}
                            {style.cover ? "" : _creationText("creation.033e36a23686b39a")}
                        </p>
                        <footer className="drama-style-detail-foot">
                            <Button icon={<ChevronLeft className="size-4" />} disabled={!prevId} onClick={() => prevId && onNavigate(prevId)} aria-label={_creationText("creation.9895a228c11e39c6")} />
                            <Button icon={<ChevronRight className="size-4" />} disabled={!nextId} onClick={() => nextId && onNavigate(nextId)} aria-label={_creationText("creation.a37b8e3472cab2e0")} />
                            <span className="flex-1" />
                            <Button onClick={onClose}>{_creationText("common.close")}</Button>
                            <Button type="primary" icon={active ? <Check className="size-4" /> : undefined} disabled={active} onClick={() => onUse(style.id)}>
                                {active ? _creationText("creation.6266b6f08df55835") : _creationText("creation.beed03981f91ab6e")}
                            </Button>
                        </footer>
                    </div>
                </div>
            ) : null}
        </AppModal>
    );
}
