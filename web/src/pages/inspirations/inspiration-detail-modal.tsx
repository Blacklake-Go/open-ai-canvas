import { Button } from "antd";
import { Copy, ExternalLink, Heart, Pencil, Trash2, ArrowUpRight } from "lucide-react";
import { useMemo, useState } from "react";

import { Tooltip } from "@/components/ui/base/tooltip";
import { AppModal } from "@/components/ui/product/app-modal";
import { MediaPlaceholder } from "@/components/ui/product/media-placeholder";
import { catalogIdOf, inspirationSourceOf, type CreationInspiration } from "@/lib/inspirations/catalog";
import { resolveInspirationItem } from "@/lib/inspirations/inspiration-i18n";
import { isCustomInspiration } from "@/lib/inspirations/resolve";
import { modeLabels } from "@/pages/create/creation-types";
import { useUserStore } from "@/stores/use-user-store";
import { useI18n } from "@/supdance/plugins/i18n";

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex min-w-0 items-baseline gap-3 text-xs leading-5">
            {/* 标签列要容纳六语种里最长的说法（如“Página original”“원본 페이지”），48px 会把词拆断行。 */}
            <span className="w-24 shrink-0 text-foreground/45">{label}</span>
            <span className="min-w-0 flex-1 text-foreground/78">{children}</span>
        </div>
    );
}

export function InspirationDetailModal({
    item,
    categoryLabel,
    favorite,
    onClose,
    onUse,
    onEdit,
    onDelete,
    onToggleFavorite,
    onCopy,
}: {
    item: CreationInspiration | null;
    categoryLabel: (item: CreationInspiration) => string;
    favorite: boolean;
    onClose: () => void;
    onUse: (item: CreationInspiration) => void;
    onEdit: (item: CreationInspiration) => void;
    onDelete: (item: CreationInspiration) => void;
    onToggleFavorite: (item: CreationInspiration) => void;
    onCopy: (text: string, label: string) => void;
}) {
    const { t, locale } = useI18n();
    const showSources = useUserStore((state) => state.features.inspirationSourcesVisible);
    const [usingPrompt, setUsingPrompt] = useState(false);
    const localizedItem = useMemo(() => (item ? resolveInspirationItem(item, locale) : null), [item, locale]);
    const source = localizedItem ? inspirationSourceOf(localizedItem) : null;
    const custom = localizedItem ? isCustomInspiration(catalogIdOf(localizedItem)) : false;

    return (
        <AppModal
            open={Boolean(localizedItem)}
            onCancel={onClose}
            width={880}
            title={null}
            footer={null}
            flush
            focusTriggerAfterClose={!usingPrompt}
            afterOpenChange={(visible) => {
                if (visible) setUsingPrompt(false);
            }}
        >
            {localizedItem ? (
                <div className="flex max-h-[76vh] flex-col">
                    <div className="inspiration-detail-cover">
                        <InspirationCover key={localizedItem.image} image={localizedItem.image} />
                    </div>

                    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                                <h2 className="text-[var(--fs-heading,16px)] font-semibold leading-6 text-foreground">{localizedItem.title}</h2>
                                {localizedItem.description ? <p className="mt-1 text-xs leading-5 text-foreground/58">{localizedItem.description}</p> : null}
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                                <Tooltip title={favorite ? t("inspiration.unfavorite_aria", undefined, "取消收藏灵感") : t("inspiration.favorite_aria", undefined, "收藏灵感")}>
                                    <button
                                        type="button"
                                        data-icon-only
                                        className="inspiration-icon-button"
                                        aria-label={favorite ? t("inspiration.unfavorite_aria", undefined, "取消收藏灵感") : t("inspiration.favorite_aria", undefined, "收藏灵感")}
                                        aria-pressed={favorite}
                                        onClick={() => onToggleFavorite(localizedItem)}
                                    >
                                        <span aria-hidden="true">
                                            <Heart className="size-4" fill={favorite ? "currentColor" : "none"} />
                                        </span>
                                    </button>
                                </Tooltip>
                                <Tooltip title={t("inspiration.edit", undefined, "编辑灵感")}>
                                    <button type="button" data-icon-only className="inspiration-icon-button" aria-label={t("inspiration.edit", undefined, "编辑灵感")} onClick={() => onEdit(localizedItem)}>
                                        <span aria-hidden="true">
                                            <Pencil className="size-4" />
                                        </span>
                                    </button>
                                </Tooltip>
                                <Tooltip title={custom ? t("inspiration.delete", undefined, "删除灵感") : t("inspiration.hide_aria", undefined, "隐藏灵感")}>
                                    <button
                                        type="button"
                                        data-icon-only
                                        className="inspiration-icon-button"
                                        aria-label={custom ? t("inspiration.delete", undefined, "删除灵感") : t("inspiration.hide_aria", undefined, "隐藏灵感")}
                                        onClick={() => onDelete(localizedItem)}
                                    >
                                        <span aria-hidden="true">
                                            <Trash2 className="size-4" />
                                        </span>
                                    </button>
                                </Tooltip>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            {showSources ? (
                                <MetaRow label={t("inspiration.field_source", undefined, "来源")}>
                                    {source?.name ?? (localizedItem.sourceId && localizedItem.sourceId !== "original" ? (source?.label ?? t("inspiration.source_unlabeled", undefined, "未标注来源")) : t("inspiration.source_original", undefined, "原创"))}
                                    {localizedItem.credit ? ` · ${localizedItem.credit}` : ""}
                                </MetaRow>
                            ) : null}
                            <MetaRow label={t("common.category", undefined, "分类")}>{categoryLabel(localizedItem)}</MetaRow>
                            <MetaRow label={t("common.type", undefined, "类型")}>
                                {t(`common.${localizedItem.mode}`, undefined, modeLabels[localizedItem.mode])}
                                {localizedItem.ratio ? ` · ${localizedItem.ratio}` : ""}
                            </MetaRow>
                            {localizedItem.tags?.length ? (
                                <MetaRow label={t("plugins.tags", undefined, "标签")}>
                                    <span className="flex flex-wrap gap-2">
                                        {localizedItem.tags.map((tag) => (
                                            <span key={tag} className="inspiration-chip">
                                                {tag}
                                            </span>
                                        ))}
                                    </span>
                                </MetaRow>
                            ) : null}
                            {/* 所有素材的原文字段与上游跳转绝对不删除，始终完整保留 */}
                            {localizedItem.sourceUrl ? (
                                <MetaRow label={t("inspiration.field_original_page", undefined, "原页")}>
                                    <a className="inline-flex items-center gap-1 text-primary hover:underline" href={localizedItem.sourceUrl} target="_blank" rel="noreferrer">
                                        {t("inspiration.view_upstream_content", undefined, "查看上游内容")} <ExternalLink className="size-3" />
                                    </a>
                                </MetaRow>
                            ) : null}
                        </div>

                        <PromptSection
                            label={localizedItem.promptZh ? t("inspiration.prompt_zh_label", undefined, "提示词 · 中文") : t("workbench.prompt_label", undefined, "提示词")}
                            text={localizedItem.promptZh || localizedItem.prompt}
                            onCopy={onCopy}
                            copyText={t("common.copy", undefined, "复制")}
                        />
                        {localizedItem.promptZh && localizedItem.prompt !== localizedItem.promptZh ? (
                            <PromptSection label={t("inspiration.prompt_source_label", undefined, "提示词 · 原文")} text={localizedItem.prompt} onCopy={onCopy} copyText={t("common.copy", undefined, "复制")} />
                        ) : null}
                    </div>

                    <div className="flex shrink-0 items-center justify-end gap-2 border-t border-foreground/8 px-5 py-3">
                        <Button onClick={onClose}>{t("common.close", undefined, "关闭")}</Button>
                        <Button
                            type="primary"
                            icon={<ArrowUpRight className="size-4" />}
                            onClick={() => {
                                setUsingPrompt(true);
                                onClose();
                                onUse(localizedItem);
                            }}
                        >
                            {t("inspiration.create_with_this_idea", undefined, "用这个创意创作")}
                        </Button>
                    </div>
                </div>
            ) : null}
        </AppModal>
    );
}

export function InspirationCover({ image }: { image: string }) {
    const [failed, setFailed] = useState(false);
    return failed ? <MediaPlaceholder failed /> : <img src={image} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
}

function PromptSection({ label, text, onCopy, copyText = "复制" }: { label: string; text: string; onCopy: (text: string, label: string) => void; copyText?: string }) {
    return (
        <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-medium text-foreground/58">{label}</h3>
                <Button size="small" icon={<Copy className="size-3.5" />} onClick={() => onCopy(text, label)}>
                    {copyText}
                </Button>
            </div>
            <div className="inspiration-prompt-block">{text}</div>
        </section>
    );
}
