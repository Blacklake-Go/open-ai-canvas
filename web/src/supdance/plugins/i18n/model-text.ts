import { i18n } from "@/i18n";
import { MODEL_CATALOGS, MODEL_NAMESPACE } from "./model-catalogs";

/** Only known display copy is localized; model identities, user edits and task payloads stay intact. */
export function modelDisplayText(model: string, field: "name" | "description", source: string): string {
    const key = `${model.replace(/[^a-zA-Z0-9_.-]/g, "_")}.${field}`;
    if (MODEL_CATALOGS["zh-CN"][key] !== source) return source;
    return i18n.t(key, { ns: MODEL_NAMESPACE, keySeparator: false, defaultValue: source }) as string;
}
