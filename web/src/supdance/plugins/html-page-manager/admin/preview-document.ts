/** Build an isolated preview without changing stored or exported HTML. */
export function buildPreviewDocument(html: string, theme: "light" | "dark"): string {
    const doc = new DOMParser().parseFromString(html, "text/html");
    doc.documentElement.dataset.theme = theme;
    doc.documentElement.style.colorScheme = theme;
    // Opaque-origin frames use transient storage for template theme controls.
    // No host cookies or persistent browser storage are exposed to page scripts.
    const bootstrap = doc.createElement("script");
    bootstrap.textContent = `(() => {
        for (const name of ["localStorage", "sessionStorage"]) {
            const values = new Map();
            Object.defineProperty(window, name, { configurable: true, value: {
                get length() { return values.size; },
                key(index) { return [...values.keys()][index] ?? null; },
                getItem(key) { return values.get(String(key)) ?? null; },
                setItem(key, value) { values.set(String(key), String(value)); },
                removeItem(key) { values.delete(String(key)); },
                clear() { values.clear(); }
            }});
        }
    })();`;
    doc.head.prepend(bootstrap);
    return "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
}
