"use client";

import { useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { getProviderLogo, invertLogos } from "../providerLogos.js";
import { formatModelDisplayName } from "../modelDisplayFormat.js";

/**
 * Shared model option template for the studio picker and admin preview.
 * Fixed order: brand logo, one-line model name, version/operation badge,
 * then one-line description or marketing copy.
 */
export default function ModelDisplayRow({
  name,
  modelId,
  provider,
  badge,
  description,
  trailing,
  selected = false,
}) {
  const providerLogo = getProviderLogo(provider, modelId);
  const [failedLogo, setFailedLogo] = useState("");
  const showLogo = Boolean(providerLogo && failedLogo !== providerLogo);
  const displayName = formatModelDisplayName(name, { provider, modelId, badge });
  const safeName = displayName || String(name || modelId || "AI Model");
  const badgeText = String(badge || "").trim();

  return (
    <div
      data-model-display-template="option"
      className="flex w-full min-w-0 items-center gap-3.5 px-3.5 py-3"
    >
      <span className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line-subtle bg-surface-raised p-2.5 text-body-sm uppercase text-ink-muted">
        {!showLogo && <span aria-hidden="true">{safeName.charAt(0) || "M"}</span>}
        {showLogo && (
          <img
            src={providerLogo}
            alt=""
            aria-hidden="true"
            className={`absolute inset-0 m-auto size-full p-2.5 object-contain ${
              invertLogos.includes(provider) ? "invert" : ""
            }`}
            onError={() => setFailedLogo(providerLogo)}
          />
        )}
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-1.5">
          <span
            title={String(name || modelId || "")}
            className="min-w-0 flex-1 truncate whitespace-nowrap text-card-title text-ink"
          >
            {safeName}
          </span>
          {badgeText && (
            <span
              title={badgeText}
              aria-label={badgeText === "✦" ? "推荐" : badgeText}
              className="inline-flex max-w-[72px] shrink-0 items-center justify-center gap-1 truncate rounded-full border border-line-subtle bg-wash px-1.5 py-0.5 text-micro text-ink-muted"
            >
              {badgeText === "✦" ? (
                <Sparkles className="size-3 text-brand" aria-hidden="true" />
              ) : badgeText}
            </span>
          )}
        </span>
        {description && (
          <span
            title={description}
            className="line-clamp-1 text-label text-ink-muted"
          >
            {description}
          </span>
        )}
      </span>

      {trailing && <span className="shrink-0">{trailing}</span>}

      {selected && (
        <span className="flex size-6 shrink-0 items-center justify-center text-ink">
          <Check className="size-5 stroke-[2.5]" aria-hidden="true" />
        </span>
      )}
    </div>
  );
}
