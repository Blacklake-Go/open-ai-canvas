import { useRef, useState } from "react";
import { App, Button, Input, Switch } from "antd";
import { RefreshCw } from "lucide-react";

import { DEFAULT_DRAMA_STYLE_ID, findDramaStyle } from "@/lib/drama/drama-styles";
import { rebuildDramaCastImagePrompt, type DramaCastImageStyle } from "@/services/api/drama";
import { creationText as _creationText, useCreationLocale as _useCreationLocale } from "@/supdance/plugins/i18n/creation-text";
import { StyleCompositionPicker } from "../style-picker";

export type CastImageFieldsValue = DramaCastImageStyle & { imagePrompt?: string };

export function CastImageFields({
    projectId,
    castId,
    appearance,
    value,
    onChange,
    disabled = false,
}: {
    projectId: string;
    castId?: string;
    appearance: string;
    value: CastImageFieldsValue;
    onChange: (patch: CastImageFieldsValue) => void;
    disabled?: boolean;
}) {
    _useCreationLocale();
    const { message } = App.useApp();
    const [building, setBuilding] = useState(false);
    const snapshot = JSON.stringify({ projectId, castId, appearance, ...value });
    const latest = useRef(snapshot);
    latest.current = snapshot;
    const ownStyle = Boolean(value.imageStyleId || value.imageStyleName || value.imageStylePrompt);
    const chooseStyle = (id: string) => {
        const style = findDramaStyle(id);
        if (style) onChange({ imageStyleId: style.id, imageStyleName: style.name, imageStylePrompt: style.prompt });
    };
    const rebuild = async () => {
        if (!castId) return;
        setBuilding(true);
        try {
            const result = await rebuildDramaCastImagePrompt(projectId, castId, { appearance, imageStyleId: value.imageStyleId || "", imageStyleName: value.imageStyleName || "", imageStylePrompt: value.imageStylePrompt || "" });
            if (latest.current === snapshot) {
                onChange({ imagePrompt: result.imagePrompt });
                message.success(_creationText("creation.castImage.promptRebuilt"));
            } else message.info(_creationText("creation.castImage.changed"));
        } catch (error) {
            message.error(error instanceof Error ? error.message : _creationText("creation.castImage.rebuildFailed"));
        } finally {
            setBuilding(false);
        }
    };
    return (
        <div className="drama-cast-image-fields">
            <label className="drama-switch-label">
                <Switch
                    size="small"
                    checked={ownStyle}
                    disabled={disabled || building}
                    onChange={(checked) => (checked ? chooseStyle(value.imageStyleId || DEFAULT_DRAMA_STYLE_ID) : onChange({ imageStyleId: "", imageStyleName: "", imageStylePrompt: "" }))}
                />
                {_creationText("creation.castImage.customStyle")}
            </label>
            {ownStyle ? (
                <StyleCompositionPicker value={value.imageStyleId || DEFAULT_DRAMA_STYLE_ID} onChange={chooseStyle} disabled={disabled || building} />
            ) : (
                <small className="drama-editor-note">{_creationText("creation.castImage.inheritStyleHint")}</small>
            )}
            <div className="drama-field-label">
                <span>{_creationText("creation.castImage.referencePrompt")}</span>
                {castId ? (
                    <Button size="small" type="text" icon={<RefreshCw className="size-3.5" />} loading={building} disabled={disabled || !appearance.trim()} onClick={() => void rebuild()}>
                        {_creationText("creation.castImage.rebuildPrompt")}
                    </Button>
                ) : null}
            </div>
            <Input.TextArea
                aria-label={_creationText("creation.castImage.referencePrompt")}
                value={value.imagePrompt || ""}
                maxLength={12000}
                autoSize={{ minRows: 3, maxRows: 8 }}
                disabled={disabled || building}
                placeholder={_creationText("creation.castImage.promptPlaceholder")}
                onChange={(event) => onChange({ imagePrompt: event.target.value })}
            />
            <small className="drama-editor-note">{_creationText("creation.castImage.generationNote")}</small>
        </div>
    );
}
