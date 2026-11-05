import { creationText as _creationText, useCreationLocale as _useCreationLocale } from "@/supdance/plugins/i18n/creation-text";
import { Button, Input } from "antd";
import { useState } from "react";
import "./fact-review.css";

export function CommerceFactReview({ facts, onApply, onExclude, excludeLabel }: { facts: string[]; onApply: (verified: string) => void; onExclude: () => void; excludeLabel?: string }) {
    _useCreationLocale();
    const [verified, setVerified] = useState("");
    if (!facts.length) return null;
    return (
        <div className="ecommerce-fact-review">
            <strong>{_creationText("creation.0ae16850b87f5aa1")}</strong>
            <ul>
                {facts.map((fact, index) => (
                    <li key={index} data-i18n-user-content>
                        {fact}
                    </li>
                ))}
            </ul>
            <label>
                {_creationText("creation.1bef01b0d1b64605")}
                <Input.TextArea rows={3} value={verified} placeholder={_creationText("creation.829dfad3e4f8d22a")} onChange={(event) => setVerified(event.target.value)} />
            </label>
            <p>{_creationText("creation.d9d2de2feabc9f9a")}</p>
            <Button size="small" disabled={!verified.trim()} onClick={() => onApply(verified.trim())}>
                {_creationText("creation.82edca453e66bf49")}
            </Button>{" "}
            <Button size="small" onClick={onExclude}>
                {excludeLabel || _creationText("creation.70abf15b443f365a")}
            </Button>
        </div>
    );
}
