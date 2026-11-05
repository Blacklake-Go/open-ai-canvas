import { creationLabel as _creationLabel } from "@/supdance/plugins/i18n/creation-text";
import { creationText as _creationText, useCreationLocale as _useCreationLocale } from "@/supdance/plugins/i18n/creation-text";
import { useMemo, useState } from "react";
import { Check, Flame, Search, X } from "lucide-react";

import { DRAMA_STYLE_CATEGORIES, DRAMA_STYLES, filterDramaStyles, styleCoverBackground, type DramaStyleCategory } from "@/lib/drama/drama-styles";

type CategoryKey = "all" | "hot" | DramaStyleCategory;

/** 短剧风格库：分类 + 搜索 + 封面卡片；选中项在标题栏回显，避免滚动后找不到当前选择。 */
export function DramaStylePicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
    _useCreationLocale();
    const [category, setCategory] = useState<CategoryKey>("hot");
    const [query, setQuery] = useState("");
    const styles = useMemo(() => filterDramaStyles(query ? "all" : category, query), [category, query]);
    const selected = DRAMA_STYLES.find((style) => style.id === value);
    const counts = useMemo(() => Object.fromEntries(DRAMA_STYLE_CATEGORIES.map((item) => [item.key, filterDramaStyles(item.key, "").length])), []);
    return (
        <section className="drama-styles">
            <div className="drama-styles-head">
                <div className="min-w-0">
                    <h2>{_creationText("creation.106de8b95d0277cb")}</h2>
                    <p>
                        {selected ? (
                            <>
                                {_creationText("creation.7ecf1cde648680d2")}
                                <b>{selected.name}</b> · {selected.description}
                            </>
                        ) : (
                            _creationText("creation.b4b462f1f95af0cd")
                        )}
                    </p>
                </div>
                <label className="drama-search drama-styles-search">
                    <Search className="size-3.5 shrink-0 opacity-40" />
                    <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={_creationText("creation.958c09bea8463021")} aria-label={_creationText("creation.45edfe5392cc3d1b")} />
                    {query ? (
                        <button type="button" onClick={() => setQuery("")} aria-label={_creationText("canvas.clear_search")}>
                            <X className="size-3.5 opacity-40" />
                        </button>
                    ) : null}
                </label>
            </div>
            <div className="drama-styles-tabs" role="tablist" aria-label={_creationText("creation.e563381aba3a3cb2")}>
                {DRAMA_STYLE_CATEGORIES.map((item) => (
                    <button
                        key={item.key}
                        type="button"
                        role="tab"
                        aria-selected={!query && category === item.key}
                        className="drama-styles-tab"
                        onClick={() => {
                            setQuery("");
                            setCategory(item.key);
                        }}
                    >
                        {item.key === "hot" ? <Flame className="size-3.5" /> : null}
                        {_creationLabel(item.label)}
                        <span>{counts[item.key]}</span>
                    </button>
                ))}
            </div>
            <div className="drama-style-grid thin-scrollbar" role="radiogroup" aria-label={_creationText("creation.106de8b95d0277cb")}>
                {styles.map((style) => {
                    const active = style.id === value;
                    return (
                        <button key={style.id} type="button" role="radio" aria-checked={active} className="drama-style" onClick={() => onChange(style.id)} title={style.description}>
                            <span className="drama-style-swatch" style={{ background: styleCoverBackground(style) }}>
                                {!style.cover ? (
                                    <span className="drama-style-glyph" aria-hidden>
                                        {style.name.replace(/^3D\s*/, "").slice(0, 2)}
                                    </span>
                                ) : null}
                                {style.hot ? (
                                    <span className="drama-style-hot" title={_creationText("creation.71aeddefe9d2d0b0")}>
                                        <Flame className="size-2.5" />
                                    </span>
                                ) : null}
                                {active ? (
                                    <span className="drama-style-check">
                                        <Check className="size-3" />
                                    </span>
                                ) : null}
                                <span className="drama-style-overlay">
                                    <span className="drama-style-name">{style.name}</span>
                                    <span className="drama-style-tags">{style.tags.join(" · ")}</span>
                                </span>
                            </span>
                        </button>
                    );
                })}
                {!styles.length ? <div className="col-span-full py-10 text-center text-[var(--fs-label)] text-foreground/45">{_creationText("creation.3bac71c548fa9693", { value1: query })}</div> : null}
            </div>
        </section>
    );
}
