import { useEffect, useState } from "react";
import { Alert, Button } from "antd";
import { useTranslation } from "react-i18next";

const COPY: Record<string, [string, string]> = {
    "zh-CN": ["来自 ONE 的社区提示词；添加后请核对模型、设置和费用。", "添加到当前提示词"],
    "en-US": ["A community prompt from ONE. Review the model, settings and price before creating.", "Add to current prompt"],
    "fr-FR": ["Une invite communautaire de ONE. Vérifiez le modèle, les paramètres et le prix.", "Ajouter à l’invite actuelle"],
    "de-DE": ["Ein Community-Prompt aus ONE. Prüfen Sie Modell, Einstellungen und Preis.", "Zum aktuellen Prompt hinzufügen"],
    "ja-JP": ["ONE のコミュニティプロンプトです。作成前にモデル、設定、料金をご確認ください。", "現在のプロンプトに追加"],
    "ko-KR": ["ONE 커뮤니티 프롬프트입니다. 생성 전에 모델, 설정, 요금을 확인하세요.", "현재 프롬프트에 추가"],
};

// URL text is untrusted input. It is never executed, submitted automatically,
// persisted as an account identity, or allowed to select a paid model.
export function CommunityHandoff({ onAppend }: { onAppend: (prompt: string) => void }) {
    const { i18n } = useTranslation();
    const [prompt, setPrompt] = useState(() => (new URLSearchParams(window.location.hash.slice(1)).get("communityPrompt") || "").slice(0, 8000));
    useEffect(() => {
        const fragment = new URLSearchParams(window.location.hash.slice(1));
        if (!fragment.has("communityPrompt")) return;
        fragment.delete("communityPrompt");
        window.history.replaceState(null, "", window.location.pathname + window.location.search + (fragment.size ? `#${fragment}` : ""));
    }, []);
    if (!prompt) return null;
    const copy = COPY[i18n.language] || COPY["en-US"];
    return (
        <Alert
            className="mx-auto my-3 w-full max-w-3xl"
            type="info"
            title={copy[0]}
            description={<p className="line-clamp-3 whitespace-pre-wrap">{prompt}</p>}
            action={
                <Button
                    onClick={() => {
                        onAppend(prompt);
                        setPrompt("");
                    }}
                >
                    {copy[1]}
                </Button>
            }
            closable
            onClose={() => setPrompt("")}
        />
    );
}
