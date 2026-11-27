import { readFile, writeFile } from "node:fs/promises";
import { SUPPORTED_LOCALES } from "../src/i18n/locales";
import { ABOUT_EXTRA, ABOUT_LITERAL_COPY } from "../src/supdance/pages/public-copy/about-extra";
import { PUBLIC_CHROME, REFUND_COPY } from "../src/supdance/pages/public-copy/refund";

const serialized = (data: unknown) => JSON.stringify(data).replaceAll("<", "\\u003c");
const htmlEscape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const replaceOnce = (html: string, before: string, after: string): string => {
    if (html.split(before).length !== 2) throw Error(`Unexpected managed HTML anchor: ${before.slice(0, 90)}`);
    return html.replace(before, () => after);
};

const browserLocale = String.raw`
const siteLocales = ${serialized(SUPPORTED_LOCALES)};
const siteLocale = (name) => siteLocales.find(({ code }) => code.toLowerCase() === String(name || "").toLowerCase())?.code;
function requestedSiteLocale() {
    let search = location.search;
    try { if (window.parent !== window) search = window.parent.location.search; } catch {}
    const query = siteLocale(new URLSearchParams(search).get("lang"));
    if (query) return query;
    try {
        const raw = localStorage.getItem("yingce:locale");
        const saved = raw ? JSON.parse(raw)?.state?.locale : localStorage.getItem("supdance:i18n:locale");
        return siteLocale(saved) || "en-US";
    } catch { return "en-US"; }
}
function saveSiteLocale(locale) {
    try {
        localStorage.setItem("yingce:locale", JSON.stringify({ state: { locale }, version: 0 }));
        localStorage.setItem("supdance:i18n:locale", locale);
    } catch {}
    try {
        const target = window.parent;
        const url = new URL(target.location.href);
        if (url.searchParams.has("lang")) {
            url.searchParams.set("lang", locale);
            target.history.replaceState(target.history.state, "", url);
        }
    } catch {}
}
const localeIndex = (locale) => siteLocales.findIndex(({ code }) => code === locale);
const publicChrome = ${serialized(PUBLIC_CHROME)};
function publishSiteTitle() {
    try { if (window.parent !== window) window.parent.dispatchEvent(new Event("supdance:managed-title")); } catch {}
}
function updateRegistration(locale) {
    document.querySelectorAll('a[href*="beian.miit.gov.cn"]').forEach((anchor) => {
        const id = anchor.dataset.icpId || anchor.textContent.match(/[\u4e00-\u9fff]+ICP备[\d-]+号(?:-\d+)?/)?.[0];
        if (!id) return;
        anchor.dataset.icpId = id;
        anchor.textContent = publicChrome.icp[localeIndex(locale)] + " · " + id;
    });
}
function updateSocialLabels(locale) {
    const index = localeIndex(locale);
    for (const anchor of document.querySelectorAll("#footer-socials a, #sd-uf-socials a")) {
        for (const attr of ["aria-label", "title"]) {
            const value = anchor.getAttribute(attr);
            if (!value) continue;
            const sourceAttr = "data-public-" + attr;
            const source = anchor.getAttribute(sourceAttr) || value;
            const label = source.replace("QQ 交流群", publicChrome.qqGroup[index])
                .replace("SupDance 官方群", publicChrome.qqOfficial[index])
                .replace("小红书 (RED)", publicChrome.red[index]);
            if (label === value) continue;
            anchor.setAttribute(sourceAttr, source);
            anchor.setAttribute(attr, label);
        }
    }
}
function watchSocialLabels() {
    const list = document.querySelector("#footer-socials, #sd-uf-socials");
    if (list) new MutationObserver(() => updateSocialLabels(document.documentElement.lang)).observe(list, { childList:true });
}
`;

function about(html: string) {
    const substitutions = `
      ${browserLocale}
      const literalCopy = ${serialized({ ...ABOUT_LITERAL_COPY, "SUPDANCE · AI CREATIVE WORKSPACE": ABOUT_EXTRA["hero.kicker"] })};
      const aboutExtra = ${serialized(ABOUT_EXTRA)};
      const literalNodes = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const key = node.nodeValue.trim().replace(/\\s+/g, " ");
        if (Object.hasOwn(literalCopy, key) && !node.parentElement?.closest('style,script,[data-i18n],[data-i18n-html]')) literalNodes.push([node, key]);
      }
      const literalAttributes = [];
      for (const element of document.querySelectorAll("[aria-label], [title], [alt]")) {
        for (const attr of ["aria-label", "title", "alt"]) {
          const key = element.getAttribute(attr);
          if (key && Object.hasOwn(literalCopy, key)) literalAttributes.push([element, attr, key]);
        }
      }
      for (const [index, {code}] of siteLocales.entries()) {
        for (const [key, values] of Object.entries(aboutExtra)) i18n[code][key] = values[index];
      }
    `;
    html = replaceOnce(html, "      const STORAGE_KEY = 'supdance:i18n:locale';", substitutions);
    html = replaceOnce(html, "let currentLang = 'zh-CN';", "let currentLang = 'en-US';");
    html = replaceOnce(html, "const resolved = normalizeLocale(code) || 'zh-CN';", "const resolved = normalizeLocale(code) || 'en-US';");
    html = replaceOnce(html, "${loc.english}", '${new Intl.DisplayNames([currentLang], {type: "language"}).of(loc.code)}');
    const start = html.indexOf("        renderLanguageMenu();\n        if (persist)");
    const end = html.indexOf("\n      };", start);
    if (start < 0 || end < 0) throw Error("About language action changed");
    html =
        html.slice(0, start) +
        `
        const index = localeIndex(resolved);
        for (const [node, key] of literalNodes) node.nodeValue = literalCopy[key][index];
        for (const [element, attr, key] of literalAttributes) element.setAttribute(attr, literalCopy[key][index]);
        document.querySelector('meta[name="description"]')?.setAttribute("content", dict["hero.subtitle"]);
        publishSiteTitle();
        updateRegistration(resolved);
        updateSocialLabels(resolved);
        renderLanguageMenu();
        if (persist) saveSiteLocale(resolved);` +
        html.slice(end);
    const init = html.indexOf("      // Initialize locale from URL");
    const next = html.indexOf("      // Sync social links", init);
    if (init < 0 || next < 0) throw Error("About locale initialization changed");
    return html.slice(0, init) + "      applyLang(requestedSiteLocale(), false);\n      watchSocialLabels();\n\n" + html.slice(next);
}

function refund(html: string) {
    // Keep existing headings, paragraphs and formatting. The English inventory
    // guards against publishing translations after a policy editor changes them.
    const bindings = ["brand", "title", "lead", "commitment", "unused", "unusedDetail", "reversal", "reversalDetail", "support", "supportDetail"] as const;
    for (const key of bindings) {
        const text = REFUND_COPY[key][1] + (key === "commitment" ? ":" : "");
        html = replaceOnce(html, `>${text}<`, `><span data-refund-copy="${key}">${htmlEscape(text)}</span><`);
    }
    html = replaceOnce(html, REFUND_COPY.purchases[1], `<span data-refund-copy="purchases">${htmlEscape(REFUND_COPY.purchases[1])}</span>`);
    html = replaceOnce(html, '<a href="/terms" class="nav-link">Terms</a>', '<a href="/terms" class="nav-link" data-public-chrome="terms">Terms</a>');
    html = replaceOnce(html, '<a href="/privacy" class="nav-link">Privacy</a>', '<a href="/privacy" class="nav-link" data-public-chrome="privacy">Privacy</a>');
    html = replaceOnce(html, '<a href="/legal" class="nav-link">Legal Hub</a>', '<a href="/legal" class="nav-link" data-public-chrome="legal">Legal Hub</a>');
    html = replaceOnce(html, '<div class="nav-links">', '<div class="nav-links"><select id="refund-locale" class="nav-link" aria-label="Interface language"></select>');
    html = replaceOnce(
        html,
        "</head>",
        `<style>
          #refund-locale { min-height: 44px; font: inherit; color: var(--fg); background: var(--bg); }
          @media (max-width: 680px) { header, .nav-links { flex-wrap: wrap; } }
        </style></head>`,
    );
    const begin = html.indexOf("  var t = dict[lang]");
    const end = html.indexOf("  if (window.location.protocol", begin);
    if (begin < 0 || end < 0) throw Error("Refund footer language code changed");
    html =
        html.slice(0, begin) +
        `
  function localizeFooter(code) {
    var t = dict[code] || dict["en-US"];
    document.getElementById("supdance-unified-footer")?.querySelectorAll("[data-uf-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-uf-i18n");
      if (t[key]) el.textContent = t[key];
    });
  }
  localizeFooter(lang);
  addEventListener("supdance:managed-locale", event => localizeFooter(event.detail));
` +
        html.slice(end);
    html = replaceOnce(
        html,
        "var saved = localStorage.getItem('supdance_html_theme');",
        `var saved;
        try { saved = JSON.parse(localStorage.getItem('yingce:theme_store') || 'null')?.state?.theme; } catch (e) {}`,
    );
    html = replaceOnce(html, "function applyTheme(theme) {", "function applyTheme(theme, persist = true) {");
    html = replaceOnce(
        html,
        "try { localStorage.setItem('supdance_html_theme', theme); } catch (e) {}",
        `if (persist) {
          try { localStorage.setItem('yingce:theme_store', JSON.stringify({ state: { theme }, version: 0 })); } catch (e) {}
        }`,
    );
    html = replaceOnce(html, "applyTheme(getPreferredTheme());", "applyTheme(getPreferredTheme(), false);");
    return replaceOnce(
        html,
        "</body>",
        `
<script>
(() => {
   ${browserLocale}
   const copy = ${serialized(REFUND_COPY)};
   const picker = document.getElementById("refund-locale");
   for (const {code, label} of siteLocales) {
       const option = document.createElement("option");
       option.value = code;
       option.lang = code;
       option.textContent = label;
       picker.append(option);
   }
   function apply(locale) {
       const index = localeIndex(locale);
       document.documentElement.lang = locale;
       document.title = copy.title[index] + " · SupDance";
       publishSiteTitle();
       picker.value = locale;
       picker.setAttribute("aria-label", publicChrome.language[index]);
       for (const node of document.querySelectorAll("[data-refund-copy]")) {
           const key = node.dataset.refundCopy;
           node.textContent = copy[key][index] + (key === "commitment" ? ": " : "");
       }
       for (const node of document.querySelectorAll("[data-public-chrome]")) node.textContent = publicChrome[node.dataset.publicChrome][index];
       const theme = document.getElementById("theme-toggle");
       theme.setAttribute("aria-label", publicChrome.theme[index]);
       theme.title = publicChrome.theme[index];
       document.getElementById("sd-uf-socials")?.setAttribute("aria-label", publicChrome.social[index]);
       updateRegistration(locale);
       updateSocialLabels(locale);
       dispatchEvent(new CustomEvent("supdance:managed-locale", {detail:locale}));
   }
   picker.addEventListener("change", () => {
       saveSiteLocale(picker.value);
       apply(picker.value);
   });
   apply(requestedSiteLocale());
   watchSocialLabels();
})();
</script>
</body>`,
    );
}

function legalAlias(path: string) {
    // These four public slugs also have a canonical React route. Prefer its
    // maintained translations and its document-specific controls.
    return `<!doctype html><html lang="en-US" class="dark"><meta charset="utf-8">
<title>SupDance</title><script>
(() => {
    ${browserLocale}
    const url = new URL(${serialized(path)}, location.origin === "null" ? document.baseURI : location.href);
    url.searchParams.set("lang", requestedSiteLocale());
    url.hash = location.hash;
    location.replace(url.href);
})();
</script><a href="${path}">SupDance</a></html>`;
}

if (import.meta.main) {
    const [input, output] = Bun.argv.slice(2);
    if (!input || !output) throw Error("Usage: bun scripts/localize-managed-public.ts <public-pages.json> <changes.json>");
    const {
        data: { pages },
    } = JSON.parse(await readFile(input, "utf8")) as { data: { pages: { slug: string; html: string }[] } };
    const converters: Record<string, (html: string) => string> = { about, refund, terms: () => legalAlias("/terms"), privacy: () => legalAlias("/privacy"), aup: () => legalAlias("/aup"), legal: () => legalAlias("/legal") };
    const changes = Object.entries(converters).map(([slug, convert]) => {
        const page = pages.find((item) => item.slug === slug);
        if (!page) throw Error(`Public page missing: ${slug}`);
        return { slug, before: page.html, after: convert(page.html) };
    });
    await writeFile(output, JSON.stringify(changes));
}
