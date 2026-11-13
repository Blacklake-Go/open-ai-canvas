export function interfaceTextKey(source: string, scope = ""): string {
    const value = scope ? `${scope}\0${source}` : source;
    let hash = 2166136261;
    for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
    return `managedUi.${(hash >>> 0).toString(16)}`;
}
