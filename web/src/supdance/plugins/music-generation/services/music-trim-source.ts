import { getResourceAccess, resolveResourceAccessURL, resourceIdFromStorageKey } from "@/services/api/resources";
import { apiBaseURL } from "@/services/api/request";
import { MAX_INPUT } from "../components/music-trim-audio";

export async function readMusicTrimSource(input: string | Blob, storageKey: string | undefined, signal: AbortSignal, retry: boolean) {
    if (input instanceof Blob) {
        if (input.size > MAX_INPUT) throw new RangeError("Audio exceeds editing capacity");
        return input;
    }
    let url = input;
    let credentials: RequestCredentials = "same-origin";
    if (resourceIdFromStorageKey(storageKey)) {
        const access = await getResourceAccess(storageKey, "browser-process", "original", "", { forceRefresh: retry });
        url = resolveResourceAccessURL(access.url);
        credentials = access.delivery === "platform-local" || access.delivery === "platform-proxy" ? "include" : "omit";
    } else if (url.startsWith(String(apiBaseURL).replace(/\/+$/, "") + "/v1/supdance/music/tasks/")) {
        credentials = "include";
    }
    if (!url) throw new Error("Missing audio");
    const response = await fetch(url, { signal, credentials, mode: "cors" });
    if (!response.ok || !response.body) throw new Error("Audio could not be read");
    if (Number(response.headers.get("content-length")) > MAX_INPUT) {
        await response.body.cancel();
        throw new RangeError("Audio exceeds editing capacity");
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    let size = 0;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > MAX_INPUT) {
                await reader.cancel();
                throw new RangeError("Audio exceeds editing capacity");
            }
            chunks.push(value);
        }
    } finally {
        reader.releaseLock();
    }
    return new Blob(chunks, { type: response.headers.get("content-type") || "" });
}
