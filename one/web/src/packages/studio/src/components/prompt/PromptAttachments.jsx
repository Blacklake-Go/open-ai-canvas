"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ─── Shared reference-media strip + @mention composer ──────────────────────
// Used by every studio that lets a user attach media to a prompt. The strip
// renders attachments as overlapping photo cards (add tile last, remove badge
// on hover); the mention hook turns "@" inside the textarea into a picker over
// the same attachment list.

const MEDIA_TILE_BASE =
  "relative h-media-tile shrink-0 rounded-lg border bg-well flex items-center justify-center transition-[background-color,border-color,color,transform] duration-fast focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring disabled:opacity-40 disabled:cursor-not-allowed";

const CARD_CLASS =
  "group relative h-media-tile w-media-tile shrink-0 overflow-hidden rounded-lg border border-line-subtle bg-well transition-transform duration-fast hover:z-raised hover:scale-110 focus-within:z-raised";

const ADD_TILE_CLASS =
  `${MEDIA_TILE_BASE} w-media-tile border-dashed border-line text-ink-muted hover:border-brand-line hover:bg-brand-soft hover:text-brand`;

const HISTORY_TILE_CLASS =
  `${MEDIA_TILE_BASE} w-media-history border-dashed border-line text-ink-muted hover:border-brand-line hover:bg-brand-soft hover:text-brand`;

function joinClasses(...classes) {
  return classes.filter(Boolean).join(" ");
}

function cardStyle(index) {
  return {
    rotate: index % 2 === 0 ? "-3deg" : "3deg",
    marginLeft: index === 0 ? 0 : "-10px",
  };
}

export function ReferenceStrip({
  items = [],
  onRemove,
  onAdd,
  onOpenHistory,
  onPreview,
  addLabel = "添加参考图",
  addTitle,
  historyLabel = "历史记录",
  uploading = false,
  progress = 0,
  disabled = false,
  className = "",
}) {
  const hasRoom = !disabled;
  return (
    <div className={joinClasses("flex items-center gap-1.5", className)}>
      <div className="flex items-center">
        {items.map((item, index) => (
          <div
            key={item.id || item.url || index}
            className={CARD_CLASS}
            style={cardStyle(index)}
          >
            <img
              src={item.thumbnail || item.url}
              alt={item.name || ""}
              className="w-full h-full object-cover"
              draggable={false}
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
            {onPreview && (
              <button
                type="button"
                title={item.name || ""}
                onClick={() => onPreview(item)}
                className="absolute inset-0 cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
              />
            )}
            {onRemove && (
              <button
                type="button"
                aria-label="移除"
                onClick={(event) => {
                  event.stopPropagation();
                  onRemove(item, index);
                }}
                className="pointer-events-none absolute right-0.5 top-0.5 z-raised flex size-4 items-center justify-center rounded-full border border-line-strong bg-overlay text-ink text-micro leading-none opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100 max-sm:pointer-events-auto max-sm:opacity-100"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      {hasRoom && onAdd && (
        <button
          type="button"
          title={addTitle || addLabel}
          aria-label={addLabel}
          disabled={uploading}
          onClick={onAdd}
          className={ADD_TILE_CLASS}
        >
          {uploading ? (
            <>
              <svg className="size-6 -rotate-90" viewBox="0 0 32 32" aria-hidden="true">
                <circle
                  cx="16"
                  cy="16"
                  r="13"
                  strokeWidth="2"
                  fill="transparent"
                  className="stroke-line-subtle"
                />
                <circle
                  cx="16"
                  cy="16"
                  r="13"
                  strokeWidth="2"
                  fill="transparent"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 13}
                  strokeDashoffset={2 * Math.PI * 13 * (1 - Math.min(progress, 100) / 100)}
                  className="stroke-brand transition-[stroke-dashoffset,stroke] duration-base"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-micro font-bold text-brand">
                {Math.min(progress, 100)}%
              </span>
            </>
          ) : (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              aria-hidden="true"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          )}
        </button>
      )}

      {onOpenHistory && (
        <button
          type="button"
          title={historyLabel}
          aria-label={historyLabel}
          onClick={onOpenHistory}
          className={HISTORY_TILE_CLASS}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
            <path d="M3 3v5h5" />
            <path d="M12 7v5l3 2" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ─── @mention ──────────────────────────────────────────────────────────────

const WORD_BEFORE_AT = /[A-Za-z0-9_\u4e00-\u9fa5]/;

export function findMentionToken(text, caret) {
  const upto = String(text || "").slice(0, caret);
  const at = upto.lastIndexOf("@");
  if (at === -1) return null;
  if (at > 0 && WORD_BEFORE_AT.test(upto[at - 1])) return null;
  const query = upto.slice(at + 1);
  if (/\s/.test(query)) return null;
  return { start: at, end: caret, query };
}

function labelOf(item) {
  return String(item?.label || item?.name || "").trim();
}

export function usePromptMention({
  textareaRef,
  value = "",
  onChange,
  items = [],
  enabled = true,
}) {
  const [token, setToken] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const candidates = useMemo(() => {
    if (!enabled || !token) return [];
    const query = token.query.toLowerCase();
    const list = items.filter((item) => item?.url);
    if (!query) return list;
    return list.filter((item) => labelOf(item).toLowerCase().includes(query));
  }, [enabled, items, token]);

  const refresh = useCallback(() => {
    if (!enabled) {
      setToken(null);
      return;
    }
    const element = textareaRef?.current;
    if (!element) {
      setToken(null);
      return;
    }
    setToken(findMentionToken(element.value, element.selectionStart ?? 0));
  }, [enabled, textareaRef]);

  useEffect(() => {
    refresh();
  }, [value, refresh]);

  useEffect(() => {
    if (!token) return;
    if (candidates.length === 0) {
      setToken(null);
      return;
    }
    setActiveIndex((prev) => Math.min(prev, candidates.length - 1));
  }, [candidates, token]);

  const close = useCallback(() => setToken(null), []);

  const apply = useCallback(
    (item) => {
      const element = textareaRef?.current;
      if (!element || !token || !item) return;
      const text = String(element.value ?? value ?? "");
      const label = labelOf(item) || labelOf({ name: `image-${items.indexOf(item) + 1}` });
      const inserted = `@${label} `;
      const next = `${text.slice(0, token.start)}${inserted}${text.slice(token.end)}`;
      onChange?.({ target: { value: next } });
      setToken(null);
      requestAnimationFrame(() => {
        const caret = token.start + inserted.length;
        element.focus();
        element.setSelectionRange(caret, caret);
      });
    },
    [items, onChange, token, textareaRef, value],
  );

  const onKeyDown = useCallback(
    (event) => {
      if (!token || candidates.length === 0) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close();
        return;
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        event.stopPropagation();
        const delta = event.key === "ArrowDown" ? 1 : -1;
        setActiveIndex((prev) => (prev + delta + candidates.length) % candidates.length);
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        event.stopPropagation();
        apply(candidates[activeIndex] || candidates[0]);
      }
    },
    [activeIndex, apply, candidates, close, token],
  );

  return {
    open: Boolean(token) && candidates.length > 0,
    query: token?.query || "",
    candidates,
    activeIndex,
    setActiveIndex,
    apply,
    close,
    refresh,
    onKeyDown,
  };
}

export function PromptMentionMenu({
  open,
  candidates = [],
  activeIndex = 0,
  onHover,
  onSelect,
  labels,
  className = "",
}) {
  const listRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    const node = listRef.current?.querySelector('[data-active="true"]');
    node?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  if (!open) return null;
  return (
    <div
      ref={listRef}
      role="listbox"
      aria-label={labels?.title}
      className={joinClasses(
        "absolute bottom-full left-0 z-popover mb-2 w-media-menu",
        "max-h-popover overflow-y-auto rounded-xl border border-line-strong bg-overlay shadow-elevation-3 p-2 animate-fade-in",
        className,
      )}
    >
      <div className="px-2 pb-1.5 text-caption font-semibold uppercase tracking-wider text-ink-subtle">
        {labels?.title}
      </div>
      <div className="max-h-media-menu-list overflow-y-auto custom-scrollbar flex flex-col gap-0.5">
        {candidates.map((item, index) => (
          <button
            key={item.id || item.url || index}
            type="button"
            role="option"
            aria-selected={index === activeIndex}
            data-active={index === activeIndex}
            onMouseDown={(event) => event.preventDefault()}
            onMouseEnter={() => onHover?.(index)}
            onClick={() => onSelect?.(item)}
            className={joinClasses(
              "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-body-sm transition-colors",
              index === activeIndex
                ? "bg-brand-soft text-brand"
                : "text-ink-muted hover:bg-wash hover:text-ink",
            )}
          >
            <span className="size-8 shrink-0 overflow-hidden rounded-md border border-line-subtle bg-well">
              <img
                src={item.thumbnail || item.url}
                alt=""
                className="w-full h-full object-cover"
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
              />
            </span>
            <span className="min-w-0 truncate text-body-sm">{labelOf(item)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
