import { interfaceText } from "@/i18n/interface-text";

export function pluginCatalogText(source: string | undefined, value: string): string {
    return source === "uploaded" ? value : interfaceText(value);
}
