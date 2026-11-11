import { useEffect, useState } from "react";
import { Alert, Button } from "antd";
import { useTranslation } from "react-i18next";

// URL text is untrusted input. It is never executed, submitted automatically,
// persisted as an account identity, or allowed to select a paid model.
export function CommunityHandoff({ onAppend }: { onAppend: (prompt: string) => void }) {
    const { t } = useTranslation();
    const [prompt, setPrompt] = useState(() => (new URLSearchParams(window.location.hash.slice(1)).get("communityPrompt") || "").slice(0, 8000));
    useEffect(() => {
        const fragment = new URLSearchParams(window.location.hash.slice(1));
        if (!fragment.has("communityPrompt")) return;
        fragment.delete("communityPrompt");
        window.history.replaceState(null, "", window.location.pathname + window.location.search + (fragment.size ? `#${fragment}` : ""));
    }, []);
    if (!prompt) return null;
    return (
        <Alert
            className="mx-auto my-3 w-full max-w-3xl"
            type="info"
            title={t("federation.handoff")}
            description={<p className="line-clamp-3 whitespace-pre-wrap">{prompt}</p>}
            action={
                <Button
                    onClick={() => {
                        onAppend(prompt);
                        setPrompt("");
                    }}
                >
                    {t("federation.append")}
                </Button>
            }
            closable
            onClose={() => setPrompt("")}
        />
    );
}
