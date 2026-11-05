import { creationLabel as _creationLabel, creationOptions as _creationOptions } from "@/supdance/plugins/i18n/creation-text";
import { creationText as _creationText, useCreationLocale as _useCreationLocale } from "@/supdance/plugins/i18n/creation-text";
import { Input, Select } from "antd";
import type { EcommerceDraft } from "@/services/api/ecommerce";
import { creationOptions } from "./type-config";

export function CreationOptions({ draft, onChange, className = "ecommerce-field" }: { draft: EcommerceDraft; onChange: (value: Record<string, string>) => void; className?: string }) {
    _useCreationLocale();
    return (
        <div className="ecommerce-creation-options" aria-label={_creationText("creation.48a036d402d99832")}>
            {(creationOptions[draft.imageType] || []).map((item) => (
                <label className={className} key={item.key}>
                    <span>
                        {_creationLabel(item.label)}
                        {item.required ? _creationText("creation.eec43789c67c1074") : ""}
                    </span>
                    {item.choices ? (
                        <Select
                            aria-label={item.label}
                            allowClear
                            placeholder={_creationText("creation.a60ae6f8c1049674")}
                            value={draft.typeOptions?.[item.key] || undefined}
                            options={_creationOptions(item.choices.map((value) => ({ value, label: value })))}
                            onChange={(value) => onChange({ ...draft.typeOptions, [item.key]: value || "" })}
                        />
                    ) : (
                        <Input.TextArea rows={2} value={draft.typeOptions?.[item.key] || ""} placeholder={item.placeholder} onChange={(event) => onChange({ ...draft.typeOptions, [item.key]: event.target.value })} />
                    )}
                </label>
            ))}
        </div>
    );
}
