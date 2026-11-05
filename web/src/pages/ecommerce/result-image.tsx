import { creationLabel as _creationLabel } from "@/supdance/plugins/i18n/creation-text";
import { creationText as _creationText, useCreationLocale as _useCreationLocale } from "@/supdance/plugins/i18n/creation-text";
import { useState, type ImgHTMLAttributes } from "react";
import "./result-image.css";

export function CommerceProgressArtwork({ title, detail }: { title: string; detail: string }) {
    _useCreationLocale();
    return (
        <span className="commerce-progress-artwork">
            <span className="commerce-progress-orbit" aria-hidden="true">
                <i />
                <i />
                <i />
                <img src="/commerce/agent-mark.svg" alt="" />
            </span>
            <strong>{title}</strong>
            <small>{detail}</small>
            <span className="commerce-progress-track" aria-hidden="true">
                <i />
            </span>
        </span>
    );
}

/** 生成占位：版式骨架 + 光带扫过 + 缓慢流动的色场；排队时更安静。只动 transform/opacity。 */
export function CommerceGeneratingArtwork({ queued, label }: { queued: boolean; label: string }) {
    _useCreationLocale();
    return (
        <span className={`commerce-generating${queued ? " is-queued" : ""}`}>
            <span className="commerce-generating-aura" aria-hidden="true">
                <i />
                <i />
            </span>
            <span className="commerce-generating-layout" aria-hidden="true">
                <i className="is-title" />
                <i className="is-subtitle" />
                <i className="is-hero" />
                <span className="commerce-generating-row">
                    <i />
                    <i />
                </span>
            </span>
            <span className="commerce-generating-status">
                <b aria-hidden="true" />
                <span>{queued ? _creationText("music.status_queued") : _creationText("music.status_generating")}</span>
                <em>{_creationLabel(label)}</em>
            </span>
        </span>
    );
}

/** Keyed by source in the gallery, so refresh and newly completed images have
 * their own load lifecycle without restarting generation or using fake progress. */
export function CommerceResultImage({ ratio, rotation = 0, frameRatio, ...props }: ImgHTMLAttributes<HTMLImageElement> & { ratio: number; rotation?: number; frameRatio?: number }) {
    _useCreationLocale();
    const [state, setState] = useState<"loading" | "loaded" | "failed">("loading");
    const [naturalRatio, setNaturalRatio] = useState<number>();
    const quarterTurn = Math.abs(rotation % 180) === 90;
    const imageRatio = naturalRatio || ratio;
    const displayRatio = frameRatio || (quarterTurn ? 1 / imageRatio : imageRatio);
    return (
        <span className={`commerce-result-image-shell is-${state}`} style={{ aspectRatio: displayRatio }}>
            <img
                {...props}
                style={{ ...props.style, width: quarterTurn ? `${100 / displayRatio}%` : "100%", height: quarterTurn ? `${100 * displayRatio}%` : "100%", transform: `translate(-50%, -50%) rotate(${rotation}deg)` }}
                decoding="async"
                onLoad={(event) => {
                    const { naturalWidth, naturalHeight } = event.currentTarget;
                    if (naturalWidth > 0 && naturalHeight > 0) setNaturalRatio(naturalWidth / naturalHeight);
                    setState("loaded");
                    props.onLoad?.(event);
                }}
                onError={(event) => {
                    setState("failed");
                    props.onError?.(event);
                }}
            />
            {state !== "loaded" ? (
                <span className="commerce-image-loading" role="status">
                    {state === "failed" ? (
                        <span>
                            {_creationText("creation.466344ad6cf81e7e")}
                            <br />
                            <small>{_creationText("creation.c0bba83b85f17f09")}</small>
                        </span>
                    ) : (
                        <CommerceProgressArtwork title={_creationText("creation.6a4a47d79a4e9f82")} detail={_creationText("creation.8ff16b40c484e041")} />
                    )}
                </span>
            ) : null}
        </span>
    );
}
