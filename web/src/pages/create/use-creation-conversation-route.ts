import { useEffect, useRef } from "react";
import { useLocation, useSearchParams } from "react-router";

import { clearCreationConversationNavigation, publishCreationConversationNavigation } from "@/services/creation-conversation-snapshot";

/** 侧栏和历史抽屉共用首页状态；URL 只携带对话身份，不携带消息。 */
export function useCreationConversationRoute({
    scope,
    ready,
    activeId,
    canSelect,
    historySynced,
    ids,
    onSelect,
    onNew,
    onHome,
}: {
    scope: string;
    ready: boolean;
    activeId: string;
    canSelect: boolean;
    historySynced: boolean;
    ids: readonly string[];
    onSelect: (id: string) => void;
    onNew: () => string;
    onHome: () => void;
}) {
    const [params, setParams] = useSearchParams();
    const { key } = useLocation();
    const requested = params.get("conversation");
    const handled = useRef("");
    const latest = useRef({ onSelect, onNew, onHome });
    latest.current = { onSelect, onNew, onHome };
    const waitingForHistory = Boolean(requested && requested !== "new" && !ids.includes(requested) && !historySynced);
    const selectRoute = (id: string) => {
        setParams(
            (current) => {
                const next = new URLSearchParams(current);
                if (id) next.set("conversation", id);
                else next.delete("conversation");
                return next;
            },
            { replace: true },
        );
    };

    useEffect(() => {
        publishCreationConversationNavigation(scope, ready ? activeId : "", ready && canSelect);
    }, [scope, ready, activeId, canSelect]);
    useEffect(() => () => clearCreationConversationNavigation(scope), [scope]);

    useEffect(() => {
        if (!ready || waitingForHistory) return;
        const identity = `${scope}:${key}:${requested}`;
        if (handled.current === identity) return;
        handled.current = identity;
        if (!requested) {
            if (canSelect) latest.current.onHome();
            else selectRoute(activeId);
            return;
        }
        if (requested === activeId) return;
        // 忙碌时拒绝本次切换，不把它排队到生成结束后偷偷执行。
        if (!canSelect || (requested !== "new" && !ids.includes(requested))) {
            selectRoute(activeId);
            return;
        }
        if (requested === "new") {
            selectRoute(latest.current.onNew());
        } else {
            latest.current.onSelect(requested);
        }
    }, [scope, key, requested, ready, activeId, canSelect, ids, waitingForHistory]);

    return selectRoute;
}
