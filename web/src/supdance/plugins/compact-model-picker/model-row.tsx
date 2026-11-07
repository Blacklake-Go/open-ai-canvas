import type { ReactNode } from "react";
import "./picker.css";

export function CompactModelRow({ name, description, price }: { name: string; description?: string; price?: ReactNode }) {
    return (
        <span className="sd-picker-row">
            <span className="sd-picker-copy">
                <strong title={name}>{name}</strong>
                {description && <small title={description}>{description}</small>}
            </span>
            {price && <span className="sd-picker-price">{price}</span>}
        </span>
    );
}
