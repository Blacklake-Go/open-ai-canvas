import { validateVisualEngineConfig } from "./schema";
import type { VisualEngineConfig } from "../types";

export function parseVisualEngineImport(text: string): { config: VisualEngineConfig; migrated: boolean } {
    if (new TextEncoder().encode(text).length > 1024 * 1024) throw new Error("配置文件不能超过 1 MiB");
    const raw: unknown = JSON.parse(text);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("配置必须是 JSON 对象");
    const input = raw as Record<string, unknown>;
    if (input.schemaVersion !== 1 && input.schemaVersion !== 2) throw new Error("仅支持 Schema 1 或 2 的主题配置");
    const checked = validateVisualEngineConfig({ ...input, schemaVersion: 2 });
    if (!checked.valid) throw new Error(checked.errors.join("；"));
    return { config: checked.config, migrated: input.schemaVersion === 1 };
}
