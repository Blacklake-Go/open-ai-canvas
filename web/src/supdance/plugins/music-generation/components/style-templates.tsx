import { useCallback, useEffect, useRef, useState } from "react";
import { BookmarkPlus, Check, Disc3, Play, Plus, Search, Square, Trash2 } from "lucide-react";
import { Button } from "antd";
import localforage from "localforage";
import { AppModal } from "@/components/ui/product/app-modal";
import { AdminModal } from "@/pages/admin/ui/overlays";
import { Select } from "@/components/ui/base/select";
import { useI18n } from "@/supdance/plugins/i18n";
import { useMusicStore } from "../stores/use-music-store";
import { styleTemplates, type StyleTemplate } from "./composer-patterns";
import { playTemplateSketch } from "./template-sketch";

type DialogProps = { onClose: () => void; onApply: (style: string) => boolean; admin?: boolean };
const genres = [...new Set(styleTemplates.map((p) => p.genre))];
const uses = [...new Set(styleTemplates.map((p) => p.use))];

export function StyleTemplates({ onClose, onApply, admin = false }: DialogProps) {
    const Modal = admin ? AdminModal : AppModal;
    const { t } = useI18n();
    const [query, setQuery] = useState("");
    const [genre, setGenre] = useState("");
    const [use, setUse] = useState("");
    const [playing, setPlaying] = useState("");
    const [error, setError] = useState("");
    const context = useRef<AudioContext | null>(null);
    const output = useRef<GainNode | null>(null);
    const stop = useCallback(() => {
        const ctx = context.current;
        context.current = null;
        output.current = null;
        if (ctx && ctx.state !== "closed") void ctx.close().catch(() => {});
        setPlaying("");
    }, []);

    useEffect(() => {
        const hidden = () => {
            if (document.hidden) stop();
        };
        document.addEventListener("visibilitychange", hidden);
        window.addEventListener("pagehide", stop);
        const unsubscribe = useMusicStore.subscribe((state, previous) => {
            if (context.current && ((state.isPlaying && !previous.isPlaying) || (state.buffering && state.audioElement !== previous.audioElement))) stop();
            if (output.current && (state.isMuted !== previous.isMuted || state.volume !== previous.volume)) {
                output.current.gain.setTargetAtTime(state.isMuted ? 0 : state.volume, output.current.context.currentTime, 0.01);
            }
        });
        return () => {
            unsubscribe();
            document.removeEventListener("visibilitychange", hidden);
            window.removeEventListener("pagehide", stop);
            stop();
        };
    }, [stop]);

    async function preview(preset: StyleTemplate) {
        stop();
        setError("");
        if (playing === preset.id) return;
        let ctx: AudioContext | undefined;
        try {
            ctx = new AudioContext();
            context.current = ctx;
            setPlaying(preset.id);
            if (ctx.state !== "running") await ctx.resume();
            if (context.current !== ctx) return;
            output.current = playTemplateSketch(ctx, preset, () => {
                if (context.current === ctx) stop();
            });
            const playback = useMusicStore.getState();
            output.current.gain.value = playback.isMuted ? 0 : playback.volume;
            playback.pauseAudio();
        } catch {
            if (ctx && context.current !== ctx) return;
            stop();
            setError(t("music.pattern_audio_error"));
        }
    }
    const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    const visible = styleTemplates.filter((p) => {
        const text = [t("music.pattern_" + p.id), t("music.pattern_" + p.id + "_style"), t("music.genre_" + p.genre), t("music.use_" + p.use), p.bpm].join(" ").toLocaleLowerCase();
        return (!genre || genre === p.genre) && (!use || use === p.use) && terms.every((term) => text.includes(term));
    });
    return (
        <Modal rootClassName={`plugin-music-generation${admin ? " music-admin" : ""}`} open centered width={848} title={t("music.pattern_library")} onCancel={onClose} footer={null}>
            <section className="music-pattern-dialog" aria-label={t("music.pattern_library")}>
                <p className="text-sm text-muted-foreground">{t("music.pattern_intro")}</p>
                <div className="music-pattern-filters">
                    <label className="music-pattern-search">
                        <Search size={16} aria-hidden="true" />
                        <input
                            type="search"
                            aria-label={t("music.patterns_search")}
                            placeholder={t("music.patterns_search")}
                            value={query}
                            onChange={(e) => {
                                stop();
                                setQuery(e.target.value);
                            }}
                        />
                    </label>
                    <Select
                        value={genre}
                        ariaLabel={t("music.patterns_genres")}
                        onChange={(v) => {
                            stop();
                            setGenre(v);
                        }}
                        options={[{ value: "", label: t("music.patterns_genres") }, ...genres.map((value) => ({ value, label: t("music.genre_" + value) }))]}
                    />
                    <Select
                        value={use}
                        ariaLabel={t("music.patterns_uses")}
                        onChange={(v) => {
                            stop();
                            setUse(v);
                        }}
                        options={[{ value: "", label: t("music.patterns_uses") }, ...uses.map((value) => ({ value, label: t("music.use_" + value) }))]}
                    />
                </div>
                {error && (
                    <p role="alert" className="text-sm text-destructive">
                        {error}
                    </p>
                )}
                <div className="music-pattern-grid">
                    {visible.map((p) => {
                        const title = t("music.pattern_" + p.id);
                        const style = t("music.pattern_" + p.id + "_style");
                        const active = p.id === playing;
                        return (
                            <article key={p.id} className="music-pattern-card">
                                <header>
                                    <div className={"music-pattern-art music-pattern-art-" + p.genre} aria-hidden="true">
                                        <Disc3 />
                                    </div>
                                    <div>
                                        <small>
                                            {t("music.genre_" + p.genre)} · {p.bpm} BPM
                                        </small>
                                        <h3>{title}</h3>
                                    </div>
                                </header>
                                <p>{style}</p>
                                <footer>
                                    <Button
                                        htmlType="button"
                                        type="text"
                                        aria-pressed={active}
                                        aria-label={t(active ? "music.pattern_stop" : "music.pattern_preview") + " · " + title}
                                        onClick={() => void preview(p)}
                                        icon={active ? <Square size={14} /> : <Play size={14} />}
                                    >
                                        {t(active ? "music.pattern_stop" : "music.pattern_preview")}
                                    </Button>
                                    <Button
                                        htmlType="button"
                                        aria-label={t("music.pattern_apply") + " · " + title}
                                        onClick={() => {
                                            if (onApply(style + " · " + p.bpm + " BPM")) onClose();
                                            else setError(t("music.pattern_limit"));
                                        }}
                                        icon={<Plus size={14} />}
                                    >
                                        {t("music.pattern_apply")}
                                    </Button>
                                </footer>
                            </article>
                        );
                    })}
                    {!visible.length && (
                        <div className="music-pattern-empty">
                            <p>{t("music.pattern_empty")}</p>
                            <Button
                                onClick={() => {
                                    setGenre("");
                                    setUse("");
                                    setQuery("");
                                }}
                            >
                                {t("music.pattern_reset")}
                            </Button>
                        </div>
                    )}
                </div>
            </section>
        </Modal>
    );
}

const promptLibrary = localforage.createInstance({ name: "supdance_music_drafts", storeName: "saved_prompts" });

const builderFields = ["scene", "sound", "rhythm", "vocals", "exclude"] as const;

export function PromptBuilder({ onClose, onApply, admin = false }: DialogProps) {
    const Modal = admin ? AdminModal : AppModal;
    const { t } = useI18n();
    const [fields, setFields] = useState<Record<string, string>>({});
    const [limit, setLimit] = useState(false);
    const text = builderFields.flatMap((field) => (fields[field]?.trim() ? [t("music.builder_" + field) + " · " + fields[field].trim()] : [])).join("\n");
    return (
        <Modal rootClassName={`plugin-music-generation${admin ? " music-admin" : ""}`} open centered width={640} title={t("music.prompt_builder")} onCancel={onClose} footer={null}>
            <section className="music-pattern-dialog">
                <p className="text-sm text-muted-foreground">{t("music.builder_hint")}</p>
                <div className="music-builder-fields">
                    {builderFields.map((field) => (
                        <label key={field}>
                            {t("music.builder_" + field)}
                            <input
                                value={fields[field] || ""}
                                onChange={(e) => {
                                    setFields({ ...fields, [field]: e.target.value });
                                    setLimit(false);
                                }}
                            />
                        </label>
                    ))}
                </div>
                {text && (
                    <div className="music-builder-output">
                        <h3>{t("music.builder_result")}</h3>
                        <p>{text}</p>
                    </div>
                )}
                {limit && (
                    <p role="alert" className="text-sm text-destructive">
                        {t("music.pattern_limit")}
                    </p>
                )}
                <Button
                    className="self-end"
                    type="primary"
                    disabled={!text}
                    htmlType="button"
                    icon={<Plus size={15} />}
                    onClick={() => {
                        if (onApply(text)) onClose();
                        else setLimit(true);
                    }}
                >
                    {t("music.use_prompt")}
                </Button>
            </section>
        </Modal>
    );
}

export function SavedPrompts({ userId, current, onClose, onApply, admin = false }: DialogProps & { userId: string; current: string }) {
    const Modal = admin ? AdminModal : AppModal;
    const { t } = useI18n();
    const [items, setItems] = useState<string[]>([]);
    const [error, setError] = useState(false);
    const [ready, setReady] = useState(false);
    const [busy, setBusy] = useState(false);
    const [limit, setLimit] = useState(false);
    useEffect(() => {
        let active = true;
        void promptLibrary
            .getItem<string[]>(userId)
            .then((saved) => {
                if (active) {
                    setItems(saved ?? []);
                    setReady(true);
                }
            })
            .catch(() => {
                if (active) setError(true);
            });
        return () => {
            active = false;
        };
    }, [userId]);
    async function persist(next: string[]) {
        if (!ready || busy) return;
        setBusy(true);
        setError(false);
        try {
            await promptLibrary.setItem(userId, next);
            setItems(next);
        } catch {
            setError(true);
        } finally {
            setBusy(false);
        }
    }
    const value = current.trim();
    return (
        <Modal rootClassName={`plugin-music-generation${admin ? " music-admin" : ""}`} open centered width={640} title={t("music.saved_styles")} onCancel={onClose} footer={null}>
            <section className="music-pattern-dialog">
                <p className="text-sm text-muted-foreground">{t("music.saved_device")}</p>
                <Button htmlType="button" className="self-start" icon={items.includes(value) ? <Check size={16} /> : <BookmarkPlus size={16} />} disabled={!ready || busy || !value || items.includes(value)} onClick={() => void persist([value, ...items])}>
                    {t("music.save_style")}
                </Button>
                {error && (
                    <p role="alert" className="text-sm text-destructive">
                        {t("music.saved_error")}
                    </p>
                )}
                {limit && (
                    <p role="alert" className="text-sm text-destructive">
                        {t("music.pattern_limit")}
                    </p>
                )}
                {!ready && !error && <p role="status">{t("common.loading")}</p>}
                {ready && !items.length && <p className="music-pattern-empty">{t("music.empty_styles")}</p>}
                <div className="music-saved-list">
                    {items.map((item) => (
                        <article key={item} className="music-pattern-card">
                            <p>{item}</p>
                            <footer>
                                <Button
                                    htmlType="button"
                                    disabled={busy}
                                    icon={<Plus size={14} />}
                                    onClick={() => {
                                        if (onApply(item)) onClose();
                                        else setLimit(true);
                                    }}
                                >
                                    {t("music.use_prompt")}
                                </Button>
                                <Button htmlType="button" type="text" disabled={busy} icon={<Trash2 size={14} />} onClick={() => void persist(items.filter((v) => v !== item))}>
                                    {t("music.remove_prompt")}
                                </Button>
                            </footer>
                        </article>
                    ))}
                </div>
            </section>
        </Modal>
    );
}
