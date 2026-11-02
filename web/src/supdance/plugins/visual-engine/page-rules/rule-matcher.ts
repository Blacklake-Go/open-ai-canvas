import type { PageRule } from "../types";

export function matchPathPattern(pattern: string, pathname: string): boolean {
    const cleanPattern = pattern.trim();
    const cleanPath = pathname.trim();

    if (cleanPattern === "*" || cleanPattern === "/*") return true;
    if (cleanPattern === cleanPath) return true;

    if (cleanPattern.endsWith("/*")) {
        const prefix = cleanPattern.slice(0, -2);
        return cleanPath === prefix || cleanPath.startsWith(prefix + "/");
    }

    if (cleanPattern.endsWith("*")) {
        const prefix = cleanPattern.slice(0, -1);
        return cleanPath.startsWith(prefix);
    }

    return false;
}

export function findMatchingPageRule(pathname: string, rules: PageRule[]): PageRule | undefined {
    for (const rule of rules) {
        if (matchPathPattern(rule.pathPattern, pathname)) {
            return rule;
        }
    }
    return undefined;
}
