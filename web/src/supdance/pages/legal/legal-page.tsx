import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";

import { SiteComplianceFooter } from "@/components/layout/site-compliance-footer";
import { cn } from "@/lib/utils";
import { useI18n } from "@/supdance/plugins/i18n";
import { useAppearanceStore } from "@/stores/use-appearance-store";

import { LEGAL_OPERATOR, legalPendingFields, type LegalBlock, type LegalDocument } from "./legal-meta";

/**
 * 正文不参与 i18n 运行时翻译。
 *
 * 法律文本的自动改写会产生未经运营方审阅的意思表示，风险高于收益；
 * 因此界面外壳走 t()，正文与目录整体标记 data-i18n-ignore，并在文末声明以中文文本为准。
 */
const LEGAL_CONTENT_ATTR = { "data-i18n-ignore": "true" } as const;

const TOC_LINK_CLASS = "block rounded-[var(--r-md)] px-2 py-1.5 leading-snug transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ring)]";

function LegalBlockView({ block }: { block: LegalBlock }) {
    if (block.kind === "ul") {
        return (
            <ul className="my-3 list-disc space-y-2 pl-6 text-[var(--fs-body)] leading-relaxed text-foreground marker:text-muted-foreground">
                {block.items.map((item) => (
                    <li key={item}>{item}</li>
                ))}
            </ul>
        );
    }

    if (block.kind === "ol") {
        return (
            <ol className="my-3 list-decimal space-y-2 pl-6 text-[var(--fs-body)] leading-relaxed text-foreground marker:text-muted-foreground">
                {block.items.map((item) => (
                    <li key={item}>{item}</li>
                ))}
            </ol>
        );
    }

    if (block.kind === "table") {
        return (
            <div className="my-4 overflow-x-auto rounded-[var(--r-lg)] border border-border">
                <table className="w-full min-w-[520px] border-collapse text-left">
                    <thead>
                        <tr className="bg-muted">
                            {block.head.map((cell, index) => (
                                <th key={`${cell}-${index}`} scope="col" className="border-b border-border px-3 py-2 text-[var(--fs-caption)] font-medium text-muted-foreground">
                                    {cell}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {block.rows.map((row) => (
                            <tr key={row.join("|")}>
                                {row.map((cell, index) =>
                                    index === 0 ? (
                                        <th key={`${cell}-${index}` as string} scope="row" className="border-b border-border px-3 py-2 align-top text-[var(--fs-caption)] font-medium text-foreground">
                                            {cell}
                                        </th>
                                    ) : (
                                        <td key={`${cell}-${index}`} className="border-b border-border px-3 py-2 align-top text-[var(--fs-caption)] leading-relaxed text-muted-foreground">
                                            {cell}
                                        </td>
                                    ),
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    }

    return <p className="my-3 text-[var(--fs-body)] leading-relaxed text-foreground">{block.text}</p>;
}

function TocList({ doc, activeSectionId, onPick }: { doc: LegalDocument; activeSectionId: string | null; onPick: (id: string) => void }) {
    return (
        <ul className="space-y-1 text-[var(--fs-caption)]">
            {doc.sections.map((section) => (
                <li key={section.id}>
                    <a
                        href={`#${section.id}`}
                        onClick={() => onPick(section.id)}
                        aria-current={activeSectionId === section.id ? "true" : undefined}
                        className={cn(TOC_LINK_CLASS, activeSectionId === section.id ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground")}
                    >
                        {section.title}
                    </a>
                </li>
            ))}
        </ul>
    );
}

export function LegalPage({ doc }: { doc: LegalDocument }) {
    const { t } = useI18n();
    const brandName = useAppearanceStore((state) => state.appearance.brandName);
    const scrollContainerRef = useRef<HTMLElement | null>(null);
    const [activeSectionId, setActiveSectionId] = useState<string | null>(doc.sections[0]?.id ?? null);

    const sectionIds = useMemo(() => doc.sections.map((section) => section.id), [doc.sections]);
    const pendingFields = useMemo(() => legalPendingFields(), []);

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        // 目录高亮只反映“当前读到哪一节”，用 IntersectionObserver 而不是 scroll 监听，避免长文档滚动时反复触发布局计算。
        const observer = new IntersectionObserver(
            (entries) => {
                const visible = entries
                    .filter((entry) => entry.isIntersecting)
                    .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
                if (visible?.target.id) setActiveSectionId(visible.target.id);
            },
            { root: container, rootMargin: "-8% 0px -72% 0px", threshold: 0 },
        );

        for (const id of sectionIds) {
            const element = document.getElementById(id);
            if (element) observer.observe(element);
        }
        return () => observer.disconnect();
    }, [sectionIds]);

    useEffect(() => {
        scrollContainerRef.current?.scrollTo({ top: 0 });
    }, [doc.slug]);

    const docLabel = doc.slug === "terms" ? t("legal.terms") : t("legal.privacy");
    const relatedLabel = doc.related.slug === "terms" ? t("legal.terms") : t("legal.privacy");

    return (
        <div className="app-workspace-page flex h-dvh flex-col overflow-hidden text-foreground">
            <header className="flex h-[var(--page-topbar-h)] shrink-0 items-center gap-2 border-b border-border px-4 sm:gap-3 sm:px-6">
                <Link to="/" className="inline-flex min-w-0 items-center rounded-[var(--r-md)] text-[var(--fs-heading)] font-semibold tracking-normal text-foreground transition-colors hover:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]">
                    <span className="truncate">{brandName}</span>
                </Link>
                <span aria-hidden="true" className="hidden text-muted-foreground/40 sm:inline">
                    /
                </span>
                <span className="truncate text-[var(--fs-ui)] text-muted-foreground">{docLabel}</span>
                <nav aria-label={t("legal.doc_nav_aria")} className="ml-auto flex shrink-0 items-center gap-1 text-[var(--fs-ui)]">
                    <Link
                        to="/terms"
                        aria-current={doc.slug === "terms" ? "page" : undefined}
                        className={cn("rounded-[var(--r-md)] px-2 py-1.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]", doc.slug === "terms" ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground")}
                    >
                        {t("legal.terms")}
                    </Link>
                    <Link
                        to="/privacy"
                        aria-current={doc.slug === "privacy" ? "page" : undefined}
                        className={cn("rounded-[var(--r-md)] px-2 py-1.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]", doc.slug === "privacy" ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground")}
                    >
                        {t("legal.privacy")}
                    </Link>
                </nav>
            </header>

            {/* 待补充项只反映当前构建内容，避免把未审阅的运营方信息当成可发布文档。 */}
            {pendingFields.length > 0 ? (
                <div className="shrink-0 border-b border-border bg-destructive/10 px-4 py-2 text-center text-[var(--fs-caption)] leading-relaxed text-destructive sm:px-6">
                    {t("legal.pending_notice")}
                    <span data-i18n-ignore="true" className="ml-1 tabular-nums">
                        （{pendingFields.join(" / ")}）
                    </span>
                </div>
            ) : null}

            <main ref={scrollContainerRef} className="min-h-0 flex-1 overflow-y-auto">
                <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 pb-12 pt-6 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:pt-8" {...LEGAL_CONTENT_ATTR}>
                    <aside className="hidden lg:block">
                        <nav aria-label={t("legal.toc_aria")} className="sticky top-8 max-h-[calc(100dvh-8rem)] overflow-y-auto rounded-[var(--r-lg)] border border-border bg-card p-4">
                            <div className="mb-3 text-[var(--fs-caption)] font-medium text-muted-foreground">{t("legal.contents")}</div>
                            <TocList doc={doc} activeSectionId={activeSectionId} onPick={setActiveSectionId} />
                        </nav>
                    </aside>

                    <div className="min-w-0 lg:hidden">
                        <details className="rounded-[var(--r-lg)] border border-border bg-card p-3">
                            <summary className="cursor-pointer text-[var(--fs-caption)] font-medium text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ring)]">{t("legal.contents")}</summary>
                            <div className="mt-2">
                                <TocList doc={doc} activeSectionId={activeSectionId} onPick={setActiveSectionId} />
                            </div>
                        </details>
                    </div>

                    <article className="min-w-0 max-w-3xl">
                        <div className="mb-2 text-[var(--fs-caption)] font-medium tabular-nums text-muted-foreground">
                            {t("legal.version")} {LEGAL_OPERATOR.version} · {t("legal.effective_date")} <span className={cn(pendingFields.includes("effectiveDate") && "font-medium text-destructive")}>{LEGAL_OPERATOR.effectiveDate}</span>
                        </div>
                        <h1 className="text-[var(--fs-display)] font-semibold tracking-normal">{doc.title}</h1>
                        <p className="mt-3 text-[var(--fs-heading)] leading-relaxed text-muted-foreground">{doc.summary}</p>

                        {doc.lead.map((paragraph) => (
                            <p key={paragraph} className="mt-4 text-[var(--fs-body)] leading-relaxed text-muted-foreground">
                                {paragraph}
                            </p>
                        ))}

                        {doc.sections.map((section) => (
                            <section key={section.id} id={section.id} className="mt-8 scroll-mt-4">
                                <h2 className="text-[var(--fs-title)] font-semibold tracking-normal">{section.title}</h2>
                                {section.blocks.map((block, index) => (
                                    <LegalBlockView key={`${section.id}-${index}`} block={block} />
                                ))}
                            </section>
                        ))}

                        <p className="mt-10 border-t border-border pt-6 text-[var(--fs-caption)] leading-relaxed text-muted-foreground">{doc.closing}</p>

                        <div className="mt-4 flex flex-wrap items-center gap-3">
                            <Link to={`/${doc.related.slug}`} className="inline-flex h-10 items-center gap-2 rounded-[var(--r-md)] border border-border px-4 text-[var(--fs-body)] font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]">
                                {relatedLabel}
                            </Link>
                            <Link to="/" className="inline-flex h-10 items-center gap-2 rounded-[var(--r-md)] px-4 text-[var(--fs-body)] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]">
                                {t("auth.back_home")}
                            </Link>
                        </div>
                    </article>
                </div>
            </main>

            <SiteComplianceFooter className="shrink-0 border-t border-border" />
        </div>
    );
}
