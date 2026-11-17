import { LEGAL_LOCALE_MAP, LEGAL_PAGE_COPY, SERVICE_PRIVACY, SERVICE_TERMS } from "./service-policies";
import type { AppLocale } from "@/i18n/locales";

function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

/** Standalone, script-free documents share the exact copy used by the real public routes. */
export function renderLegalHtml(kind: "terms" | "privacy", locale: AppLocale): string {
    const language = LEGAL_LOCALE_MAP[locale];
    const doc = (kind === "terms" ? SERVICE_TERMS : SERVICE_PRIVACY)[language];
    const ui = LEGAL_PAGE_COPY[language];
    return `<!DOCTYPE html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${escapeHtml(doc.title)} · Supdance</title>
<style>
body { font-family: system-ui, sans-serif; line-height: 1.8; margin: auto; padding: 1.5rem; max-width: 48rem; overflow-wrap: anywhere; color: CanvasText; background: Canvas; }
nav { display: flex; flex-wrap: wrap; gap: 1rem; } a { color: LinkText; } a:focus-visible { outline: auto; } section { margin-block: 2.5rem; } footer { margin-block-start: 3rem; } @media print { nav { display: none; } }
</style>
</head>
<body>
<header><a href="https://www.supdance.com">Supdance</a><nav aria-label="${escapeHtml(ui.center)}">${Object.entries(LEGAL_LOCALE_MAP)
        .map(([code, key]) => `<a href="https://www.supdance.com/${kind}?lang=${code}" lang="${code}"${code === locale ? ' aria-current="page"' : ""}>${escapeHtml((kind === "terms" ? SERVICE_TERMS : SERVICE_PRIVACY)[key].title)}</a>`)
        .join("")}</nav></header>
<main><h1>${escapeHtml(doc.title)}</h1><p>${escapeHtml(ui.effective)}: ${doc.effectiveDate} · ${escapeHtml(ui.version)} ${doc.version}</p><p>${escapeHtml(doc.summary)}</p>
<article>${doc.sections.map((section) => `<section id="${section.id}"><h2>${escapeHtml(section.title)}</h2>${section.paragraphs?.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("") ?? ""}</section>`).join("\n")}</article>
${kind === "privacy" ? `<p><a href="https://www.supdance.com/privacy?lang=${locale}#cookies">${escapeHtml(doc.sections.find((section) => section.id === "cookies")!.title)} · www.supdance.com</a></p>` : ""}
</main><footer><nav><a href="https://www.supdance.com/terms?lang=${locale}">${escapeHtml(SERVICE_TERMS[language].title)}</a><a href="https://www.supdance.com/privacy?lang=${locale}">${escapeHtml(SERVICE_PRIVACY[language].title)}</a><a href="mailto:support@supdance.com">support@supdance.com</a></nav><p>© 2026 Supdance</p></footer>
</body></html>`;
}
