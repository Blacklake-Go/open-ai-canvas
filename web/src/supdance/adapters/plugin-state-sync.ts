export const PLUGIN_STATE_CHANGED_EVENT = "supdance:plugins-changed";
export const PLUGIN_STATE_REVISION_KEY = "supdance:plugins-revision";

export function notifyPluginStateChanged() {
    window.dispatchEvent(new Event(PLUGIN_STATE_CHANGED_EVENT));
    try {
        window.localStorage.setItem(PLUGIN_STATE_REVISION_KEY, `${Date.now()}-${Math.random()}`);
    } catch {
        // Polling and focus refresh remain available when storage is restricted.
    }
}

/** One request at a time, with a trailing refresh when a change arrives in flight. */
export function startPluginStateSync(refresh: (signal: AbortSignal) => Promise<void>, intervalMs = 5_000) {
    const controller = new AbortController();
    let running = false;
    let pending = false;
    const sync = async () => {
        if (controller.signal.aborted) return;
        if (running) {
            pending = true;
            return;
        }
        running = true;
        try {
            await refresh(controller.signal);
        } catch (error) {
            if (!controller.signal.aborted) console.warn("插件状态同步失败，将在下次刷新重试", error);
        } finally {
            running = false;
            if (pending && !controller.signal.aborted) {
                pending = false;
                void sync();
            }
        }
    };
    const visibleSync = () => {
        if (document.visibilityState !== "hidden") void sync();
    };
    const storageSync = (event: StorageEvent) => {
        if (event.key === PLUGIN_STATE_REVISION_KEY) void sync();
    };
    void sync();
    const timer = window.setInterval(visibleSync, intervalMs);
    window.addEventListener("focus", visibleSync);
    window.addEventListener(PLUGIN_STATE_CHANGED_EVENT, visibleSync);
    window.addEventListener("storage", storageSync);
    document.addEventListener("visibilitychange", visibleSync);
    return () => {
        controller.abort();
        window.clearInterval(timer);
        window.removeEventListener("focus", visibleSync);
        window.removeEventListener(PLUGIN_STATE_CHANGED_EVENT, visibleSync);
        window.removeEventListener("storage", storageSync);
        document.removeEventListener("visibilitychange", visibleSync);
    };
}
