import { creationLabel as _creationLabel, creationOptions as _creationOptions } from "@/supdance/plugins/i18n/creation-text";
import { creationText as _creationText, useCreationLocale as _useCreationLocale } from "@/supdance/plugins/i18n/creation-text";
import { Select } from "antd";
import type { EcommerceDraft } from "@/services/api/ecommerce";
import { commerceAllowsText, creativeControlFields, normalizeCreativeOptions } from "./creative-controls";
import { ecommerceTypeConfig } from "./type-config";
import { commercePlatformListingMain } from "./platform-style";

export function CreativeOptionsPanel({ draft, onChange }: { draft: EcommerceDraft; onChange: (patch: Partial<EcommerceDraft>) => void }) {
    _useCreationLocale();
    const selected = normalizeCreativeOptions(draft);
    const platformNoText = commercePlatformListingMain(draft.platform, draft.imageType, draft.typeOptions?.purpose);
    const fixedNoText = Boolean(ecommerceTypeConfig[draft.imageType]?.noText) || draft.cloneOptions?.copyMode === "none" || platformNoText;
    const allowsText = commerceAllowsText(draft);
    return (
        <section className="ecommerce-creative-options" aria-label={_creationText("creation.af7413db6914b282")}>
            <div className="ecommerce-creative-grid">
                {creativeControlFields.map((field) => (
                    <label className="ecommerce-field" key={field.key}>
                        <span>{_creationLabel(field.label)}</span>
                        <Select<string>
                            variant="filled"
                            aria-label={field.label}
                            value={!allowsText && field.key === "textMode" ? "none" : selected[field.key]}
                            options={_creationOptions(field.options)}
                            disabled={field.key === "textMode" ? fixedNoText : !allowsText && ["copyTone", "fontStyle", "informationDensity"].includes(field.key)}
                            onChange={(value) => onChange({ creativeOptions: { ...selected, [field.key]: value }, ...(field.key === "textMode" ? { noText: value === "none" } : {}) })}
                        />
                    </label>
                ))}
            </div>
            {!allowsText ? <p className="ecommerce-creative-note">{platformNoText ? _creationText("creation.79a70368e8e58302") : fixedNoText ? _creationText("creation.ed8cf9bc40befb3c") : _creationText("creation.047b365cc7178847")}</p> : null}
        </section>
    );
}
