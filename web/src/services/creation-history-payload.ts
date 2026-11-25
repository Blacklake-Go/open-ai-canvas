import type { CreationConversation, CreationMessage } from "@/pages/create/creation-types";
import type { HistoryDetail } from "./api/creation-history";

const messageFields =
    "id role mode content reasoning createdAt status model resultStorageKeys error generationErrorCode generationOperation attachments references settings taskIds clientOperationId retryOf attemptGroupId generationStage generationEffectKeys errorKind mediaRecoverable syncInterrupted".split(
        " ",
    );
const referenceFields = "id name type storageKey previewStorageKey bytes width height durationMs nodeId kind label title text active sourceType assetId category mentionToken attachmentId toolId toolType toolIcon".split(" ");
// 与后端 historyPayload 的 settings allowedKeys 保持一致；漏键会让新参数无法跨设备恢复。
const settingsFields = "ratio seconds quality videoQuality count title duration instrumental model mode style songLanguage resolution imageResolution transparentBackground thinkingLevel".split(" ");
function pick(value: Record<string, unknown>, keys: string[]) {
    return Object.fromEntries(keys.filter((key) => value[key] !== undefined).map((key) => [key, value[key]]));
}

// Compare the durable contract, never signed/display URLs or provider configuration snapshots.
export function historyMessagePayload(message: CreationMessage): Record<string, unknown> {
    const payload = pick(message as unknown as Record<string, unknown>, messageFields);
    for (const field of ["attachments", "references"] as const) {
        if (message[field]) payload[field] = message[field]!.map((item) => pick(item as unknown as Record<string, unknown>, referenceFields));
    }
    if (message.settings) payload.settings = pick(message.settings, settingsFields);
    return payload;
}

/** 旧版本后端把布尔参数归一化成 "true"/"false" 字符串；恢复时兼容两种形态。 */
export function historySettingBool(value: unknown): boolean | undefined {
    if (typeof value === "boolean") return value;
    if (value === "true") return true;
    if (value === "false") return false;
    return undefined;
}

export function historyFingerprint(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map(historyFingerprint).join(",")}]`;
    if (value && typeof value === "object")
        return `{${Object.entries(value)
            .filter(([, v]) => v !== undefined)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${JSON.stringify(k)}:${historyFingerprint(v)}`)
            .join(",")}}`;
    return JSON.stringify(value) ?? "null";
}

export function historyMetadata(conversation: Pick<CreationConversation, "title" | "canvasId">) {
    return { title: conversation.title, ...(conversation.canvasId ? { canvasId: conversation.canvasId } : {}) };
}

export function conversationFromHistory(detail: HistoryDetail): CreationConversation {
    return { id: detail.id, title: detail.title, updatedAt: detail.updatedAt, ...(detail.canvasId ? { canvasId: detail.canvasId } : {}), messages: detail.messages.filter((item) => !item.deleted).map((item) => item.data as CreationMessage) };
}
