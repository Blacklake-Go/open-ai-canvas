import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, Button, Checkbox, Input, Pagination, Select, Spin, Tag } from "antd";
import { useI18n } from "@/supdance/plugins/i18n";
import { inspirationSources, type InspirationSourceId } from "@/lib/inspirations/catalog";
import { PROMPT_TYPES, readCurationCatalog, type CaseTags, type CurationCard, type CurationDocument } from "./api";

const PAGE_SIZE = 12;
type Props = {
    doc: CurationDocument;
    inventory: CurationCard[];
    disabled: boolean;
    onCases: (cases: CurationDocument["cases"]) => void;
    onFeatured: (ids: string[]) => void;
    onGallery: (ids: string[]) => void;
};

export function CatalogPanel({ doc, inventory, disabled, onCases, onFeatured, onGallery }: Props) {
    const { t, locale } = useI18n();
    const label = (key: string) => t(`inspiration.curation.${key}`);
    const [query, setQuery] = useState("");
    const [page, setPage] = useState(1);
    const [styleFilter, setStyleFilter] = useState("");
    const [promptFilter, setPromptFilter] = useState("");
    const [sourceFilter, setSourceFilter] = useState("");
    const [sort, setSort] = useState<"default" | "title" | "latest">("default");
    const [selected, setSelected] = useState<string[]>([]);
    const [terms, setTerms] = useState<string[]>([]);
    const [mode, setMode] = useState<"add" | "remove">("add");
    const [promptType, setPromptType] = useState("keep");
    const [tagError, setTagError] = useState(false);
    const search = useQuery({ queryKey: ["inspiration-curation", "search", query], enabled: Boolean(query), queryFn: ({ signal }) => readCurationCatalog(query, signal) });
    const styleOptions = doc.styles.map(({ id, label: name }) => ({ value: id, label: name || label(id) }));
    const promptOptions = PROMPT_TYPES.map((value) => ({ value, label: label(value) }));
    const sourceOptions = Object.entries(inspirationSources).map(([value, source]) => ({ value, label: source.name ?? t(source.label) }));
    const rows = (query ? (search.data ?? []) : inventory).filter(({ id, source }) => {
        const tags = doc.cases[id];
        return (!sourceFilter || source === sourceFilter) && (!styleFilter || tags?.styles.includes(styleFilter)) && (!promptFilter || tags?.promptType === promptFilter);
    });
    if (sort === "title") rows.sort((left, right) => left.title.localeCompare(right.title, locale));
    if (sort === "latest") rows.sort((left, right) => (Date.parse(right.date ?? "") || 0) - (Date.parse(left.date ?? "") || 0));
    const visiblePage = Math.min(page, Math.max(1, Math.ceil(rows.length / PAGE_SIZE)));
    const visible = rows.slice((visiblePage - 1) * PAGE_SIZE, visiblePage * PAGE_SIZE);
    const selectedSet = new Set(selected);
    const listed = new Set(doc.galleryOrder);

    function applyTags() {
        const next = { ...doc.cases };
        for (const id of selected) {
            const previous = next[id] ?? { styles: [] };
            const tags: CaseTags = {
                styles: mode === "add" ? [...new Set([...previous.styles, ...terms])] : previous.styles.filter((value) => !terms.includes(value)),
                promptType: promptType === "keep" ? previous.promptType : promptType || undefined,
            };
            if (tags.styles.length > 8) {
                setTagError(true);
                return;
            }
            if (!tags.styles.length && !tags.promptType) delete next[id];
            else next[id] = tags;
        }
        setTagError(false);
        onCases(next);
    }

    return (
        <section className="curation-stack" aria-label={label("catalog")}>
            <div className="curation-controls">
                <Input.Search
                    allowClear
                    maxLength={120}
                    aria-label={label("search")}
                    placeholder={label("search")}
                    onSearch={(value) => {
                        setQuery(value.trim());
                        setPage(1);
                    }}
                />
                <Select
                    aria-label={label("sourceFilter")}
                    value={sourceFilter}
                    options={[{ value: "", label: label("sourceFilter") }, ...sourceOptions]}
                    onChange={(value) => {
                        setSourceFilter(value);
                        setPage(1);
                    }}
                />
                <Select
                    aria-label={label("catalogSort")}
                    value={sort}
                    options={[
                        { value: "default", label: label("catalogSort") },
                        { value: "title", label: label("catalogTitle") },
                        { value: "latest", label: label("catalogLatest") },
                    ]}
                    onChange={(value) => {
                        setSort(value);
                        setPage(1);
                    }}
                />
                <Select
                    aria-label={label("style")}
                    value={styleFilter}
                    options={[{ value: "", label: label("all") }, ...styleOptions]}
                    onChange={(value) => {
                        setStyleFilter(value);
                        setPage(1);
                    }}
                />
                <Select
                    aria-label={label("prompt")}
                    value={promptFilter}
                    options={[{ value: "", label: label("all") }, ...promptOptions]}
                    onChange={(value) => {
                        setPromptFilter(value);
                        setPage(1);
                    }}
                />
            </div>
            <div className="curation-batch curation-stack">
                <div className="curation-actions">
                    <span role="status">{t("inspiration.curation.selected", { count: selected.length })}</span>
                    <Button onClick={() => setSelected([...new Set([...selected, ...visible.map((item) => item.id)])])} disabled={!visible.length || disabled}>
                        {label("selectPage")}
                    </Button>
                    <Button onClick={() => setSelected([])} disabled={!selected.length || disabled}>
                        {label("clearSelection")}
                    </Button>
                    <Button onClick={() => onGallery(selected)} disabled={!selected.length || disabled}>
                        {label("addToGallery")}
                    </Button>
                    <Button onClick={() => onGallery(rows.filter((row) => row.eligible).map((row) => row.id))} disabled={!rows.some((row) => row.eligible) || disabled}>
                        {label("addFilteredToGallery")}
                    </Button>
                    <Button onClick={() => onFeatured(selected)} disabled={!selected.length || disabled}>
                        {label("addFeatured")}
                    </Button>
                </div>
                <div className="curation-controls">
                    <Select
                        aria-label={label("updateTags")}
                        value={mode}
                        options={[
                            { value: "add", label: label("add") },
                            { value: "remove", label: label("remove") },
                        ]}
                        onChange={setMode}
                    />
                    <Select mode="multiple" maxCount={8} allowClear optionFilterProp="label" aria-label={label("style")} placeholder={label("style")} value={terms} options={styleOptions} onChange={setTerms} />
                    <Select aria-label={label("prompt")} value={promptType} options={[{ value: "keep", label: label("unchanged") }, { value: "", label: label("none") }, ...promptOptions]} onChange={setPromptType} />
                    <Button type="primary" disabled={!selected.length || (!terms.length && promptType === "keep") || disabled} onClick={applyTags}>
                        {label("updateTags")}
                    </Button>
                </div>
                {tagError && <Alert title={t("inspiration.curation.tagLimit", { count: 8 })} type="warning" />}
            </div>
            {query && search.isError ? (
                <Alert type="error" title={search.error.message} />
            ) : query && search.isPending ? (
                <Spin />
            ) : visible.length ? (
                <div className="curation-catalog">
                    {visible.map((card) => {
                        const tags = doc.cases[card.id];
                        const source = inspirationSources[card.source as InspirationSourceId];
                        return (
                            <article className="curation-catalog-item" key={card.id}>
                                <Checkbox disabled={disabled} checked={selectedSet.has(card.id)} onChange={(event) => setSelected((current) => (event.target.checked ? [...current, card.id] : current.filter((id) => id !== card.id)))}>
                                    {card.title}
                                </Checkbox>
                                <small>{[source?.name ?? (source ? t(source.label) : card.source), card.category].filter(Boolean).join(" · ")}</small>
                                <div className="curation-actions">
                                    {!card.eligible && <Tag>{label("blocked")}</Tag>}
                                    {listed.has(card.id) && <Tag>{label("listed")}</Tag>}
                                    {tags?.styles.map((id) => (
                                        <Tag key={id}>{styleOptions.find((style) => style.value === id)?.label ?? id}</Tag>
                                    ))}
                                    {tags?.promptType && <Tag>{label(tags.promptType)}</Tag>}
                                </div>
                            </article>
                        );
                    })}
                </div>
            ) : (
                <p role="status">{label("empty")}</p>
            )}
            {rows.length > PAGE_SIZE && <Pagination current={visiblePage} pageSize={PAGE_SIZE} total={rows.length} onChange={setPage} showSizeChanger={false} />}
        </section>
    );
}
