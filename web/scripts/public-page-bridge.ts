// Maintains the public document shell when publishing onto an existing Web release.
// The React routes provide the same titles, links, and labels in normal builds.
import { DEFAULT_LOCALE, matchAppLocale, SUPPORTED_LOCALES } from "../src/i18n/locales";
import { PUBLIC_CHROME, REFUND_COPY } from "../src/supdance/pages/public-copy/refund";
import { PUBLIC_PAGE_ALIASES } from "../src/supdance/pages/public-copy/routes";

const legal = new Set(["/legal", "/terms", "/privacy", "/aup"]);
const embedded = new Set(["/about", "/html/about", "/p/about", "/html/refund", "/p/refund"]);
let previousTitle: string | undefined;
let ownedTitle = "";
let observer: MutationObserver | undefined;

function replaceTitle(next: string) {
    if (document.title === next) return;
    previousTitle ??= document.title;
    document.title = ownedTitle = next;
}

function renderLegalChrome() {
    const heading = document.querySelector(".legal-public-page main h1")?.textContent?.trim();
    if (!heading) return;
    replaceTitle(`${heading} · SupDance`);
    const locale = matchAppLocale(document.documentElement.lang) ?? DEFAULT_LOCALE;
    const index = SUPPORTED_LOCALES.findIndex(({ code }) => code === locale);

    const footer = document.querySelector(".legal-public-page footer");
    const registration = footer?.querySelector<HTMLAnchorElement>('a[href*="beian.miit.gov.cn"]');
    if (registration) {
        const id = registration.textContent?.match(/沪ICP备\d+号(?:-\d+)?/u)?.[0];
        const label = id && `${PUBLIC_CHROME.icp[index]} · ${id}`;
        if (label && registration.textContent !== label) registration.textContent = label;
    }
    const home = footer?.querySelector('a[href="/"][aria-label]');
    if (home) home.setAttribute("aria-label", `SupDance · ${PUBLIC_CHROME.home[index]}`);
    for (const anchor of footer?.querySelectorAll("a[title][aria-label]") ?? []) {
        for (const attr of ["title", "aria-label"]) {
            const value = anchor.getAttribute(attr);
            if (!value) continue;
            const sourceAttr = "data-public-" + attr;
            const source = anchor.getAttribute(sourceAttr) || value;
            const label = source.replace("QQ 交流群", PUBLIC_CHROME.qqGroup[index]).replace("SupDance 官方群", PUBLIC_CHROME.qqOfficial[index]).replace("小红书 (RED)", PUBLIC_CHROME.red[index]);
            if (label !== value) {
                anchor.setAttribute(sourceAttr, source);
                anchor.setAttribute(attr, label);
            }
        }
    }

    if (location.pathname === "/legal" && !document.querySelector('main a[href="/html/refund"]')) {
        const link = document.createElement("a");
        link.className = "mb-8 inline-flex min-h-11 items-center text-sm text-foreground underline underline-offset-4";
        link.dataset.publicRefund = "";
        link.href = "/html/refund";
        document.querySelector(".legal-public-page main section")?.before(link);
    }
    const refund = document.querySelector("[data-public-refund]");
    if (refund && refund.textContent !== REFUND_COPY.title[index]) refund.textContent = REFUND_COPY.title[index];
}

function renderEmbeddedTitle(frame?: HTMLIFrameElement) {
    const title = frame?.contentDocument?.title?.trim();
    if (!title) return;
    frame.title = title;
    replaceTitle(title.endsWith("SupDance") ? title : `${title} · SupDance`);
}

function currentPath() {
    return location.pathname.toLowerCase().replace(/\/$/, "");
}

function refreshPublicPage() {
    const path = currentPath();
    const target = PUBLIC_PAGE_ALIASES[path];
    if (typeof target === "string") {
        location.replace(target + location.search + location.hash);
        return;
    }
    observer?.disconnect();
    if (legal.has(path)) {
        observer = new MutationObserver(renderLegalChrome);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
        const root = document.querySelector("#root");
        if (root) observer.observe(root, { childList: true, subtree: true });
        renderLegalChrome();
    } else if (embedded.has(path)) {
        renderEmbeddedTitle(document.querySelector<HTMLIFrameElement>("iframe[srcdoc]") ?? undefined);
    } else if (previousTitle) {
        if (document.title === ownedTitle) document.title = previousTitle;
        previousTitle = undefined;
        ownedTitle = "";
    }
}

addEventListener(
    "load",
    (event) => {
        if (event.target instanceof HTMLIFrameElement && embedded.has(currentPath())) renderEmbeddedTitle(event.target);
    },
    true,
);
addEventListener("supdance:managed-title", () => {
    if (embedded.has(currentPath())) renderEmbeddedTitle(document.querySelector<HTMLIFrameElement>("iframe[srcdoc]") ?? undefined);
});
addEventListener("popstate", refreshPublicPage);
const navigation = (window as Window & { navigation?: EventTarget }).navigation;
navigation?.addEventListener("currententrychange", refreshPublicPage);
document.addEventListener("click", (event) => {
    const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
    if (!link || link.origin !== location.origin) return;
    const destination = link.pathname.toLowerCase().replace(/\/$/, "");
    const path = currentPath();
    if (legal.has(destination) || embedded.has(destination) || PUBLIC_PAGE_ALIASES[destination] || legal.has(path) || embedded.has(path)) requestAnimationFrame(refreshPublicPage);
});
refreshPublicPage();
