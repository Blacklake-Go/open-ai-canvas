export function flattenCatalog(value: object, prefix = "", result: Record<string, string> = {}) {
    for (const [key, item] of Object.entries(value)) {
        const name = prefix ? `${prefix}.${key}` : key;
        if (typeof item === "string") result[name] = item;
        else if (item && typeof item === "object") flattenCatalog(item, name, result);
    }
    return result;
}

export function expandCatalog(flat: Record<string, string>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(flat)) {
        const parts = key.split(".");
        let target = result;
        for (const part of parts.slice(0, -1)) {
            if (part === "__proto__" || part === "constructor" || part === "prototype") throw new Error("Invalid translation key");
            target = (target[part] ??= {}) as Record<string, unknown>;
        }
        const last = parts.at(-1)!;
        if (["__proto__", "constructor", "prototype"].includes(last)) throw new Error("Invalid translation key");
        target[last] = value;
    }
    return result;
}
