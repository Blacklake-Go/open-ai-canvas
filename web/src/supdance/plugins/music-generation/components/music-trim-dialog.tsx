import { Button } from "antd";
import { Pause, Play, RotateCcw, Scissors, Undo2 } from "lucide-react";
import { useEffect, useEffectEvent, useMemo, useRef, useState, type CSSProperties } from "react";
import { AppModal } from "@/components/ui/product/app-modal";
import { parseAudioSampleRate } from "@/lib/audio-sample-rate";
import { probeMediaDurationMs } from "@/lib/media-metadata";
import { useI18n } from "@/supdance/plugins/i18n";
import { readMusicTrimSource } from "../services/music-trim-source";
import { useMusicStore } from "../stores/use-music-store";
import { assertEditableAudio, encodeTrimWav, previewWindow, trimFrames, waveformPeaks, type TrimEdge, type TrimRange } from "./music-trim-audio";
import "../styles/music-trim.css";

export type MusicTrimResult = { blob: Blob; start: number; end: number; title: string };
type Props = { url: string | Blob; storageKey?: string; title: string; returnFocusTo?: HTMLElement | null; onClose: () => void; onPreviewStart?: () => void; onSave: (result: MusicTrimResult) => Promise<void> | void };
const edges = ["start", "end"] as const;
const time = (s: number) => {
    const cs = Math.round(s * 100);
    return Math.floor(cs / 6000) + ":" + String(Math.floor(cs / 100) % 60).padStart(2, "0") + "." + String(cs % 100).padStart(2, "0");
};

function TimeField({ label, seconds, min, max, commit }: { label: string; seconds: number; min: number; max: number; commit: (s: number) => void }) {
    const [draft, setDraft] = useState<string | null>(null);
    return (
        <label>
            <span>{label}</span>
            <input
                type="number"
                inputMode="decimal"
                min={min}
                max={max}
                step="0.001"
                value={draft ?? Number(seconds.toFixed(3))}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={() => {
                    if (draft?.trim() && Number.isFinite(Number(draft))) commit(Number(draft));
                    setDraft(null);
                }}
                onKeyDown={(event) => {
                    if (event.key === "Enter") event.currentTarget.blur();
                }}
            />
        </label>
    );
}

export function MusicTrimDialog({ url, storageKey, title, returnFocusTo, onClose, onPreviewStart, onSave }: Props) {
    const { t } = useI18n();
    const [opener] = useState(() => (document.activeElement instanceof HTMLElement ? document.activeElement : null));
    function dismiss() {
        onClose();
        requestAnimationFrame(() => {
            const target = returnFocusTo?.isConnected ? returnFocusTo : opener;
            if (target?.isConnected) target.focus({ preventScroll: true });
        });
    }
    const [buffer, setBuffer] = useState<AudioBuffer>();
    const [error, setError] = useState("");
    const [attempt, setAttempt] = useState(0);
    const [range, setRange] = useState<TrimRange>([0, 0]);
    const [undo, setUndo] = useState<TrimRange | null>(null);
    const [cursor, setCursor] = useState(0);
    const [playing, setPlaying] = useState(false);
    const [saving, setSaving] = useState(false);
    const stage = useRef<HTMLDivElement>(null);
    const gesture = useRef<{ id: number; x: number; width: number; range: TrimRange } | null>(null);
    const context = useRef<AudioContext | null>(null);
    const source = useRef<AudioBufferSourceNode | null>(null);
    const level = useRef<GainNode | null>(null);
    const animation = useRef(0);
    const serial = useRef(0);
    const savePending = useRef(false);
    const pauseHost = useEffectEvent(() => onPreviewStart?.());
    function stopSource() {
        serial.current++;
        cancelAnimationFrame(animation.current);
        const node = source.current;
        if (node) {
            node.onended = null;
            node.stop();
            node.disconnect();
            source.current = null;
        }
        level.current?.disconnect();
        level.current = null;
    }
    function pause() {
        stopSource();
        setPlaying(false);
    }
    useEffect(() => {
        const abort = new AbortController();
        pauseHost();
        setBuffer(undefined);
        setError("");
        setPlaying(false);
        setUndo(null);
        setCursor(0);
        async function read() {
            let reason = "music.trim_read_error";
            try {
                const file = await readMusicTrimSource(url, storageKey, abort.signal, attempt > 0);
                if (abort.signal.aborted) return;
                reason = "music.trim_decode_error";
                const durationMs = await probeMediaDurationMs(new File([file], "track", { type: file.type.startsWith("audio/") ? file.type : "audio/octet-stream" }));
                if (abort.signal.aborted) return;
                const bytes = await file.arrayBuffer();
                if (abort.signal.aborted) return;
                const rate = parseAudioSampleRate(new Uint8Array(bytes));
                const ctx = new AudioContext(rate && rate <= 96000 ? { sampleRate: rate } : undefined);
                context.current = ctx;
                // Bound long compressed tracks before decodeAudioData allocates PCM. Recheck the actual channel count below.
                if (durationMs) assertEditableAudio({ length: Math.ceil((durationMs * ctx.sampleRate) / 1000), numberOfChannels: 2 });
                const audio = await ctx.decodeAudioData(bytes);
                if (abort.signal.aborted) return;
                assertEditableAudio(audio);
                setRange([0, audio.length]);
                setBuffer(audio);
            } catch (e) {
                if (!abort.signal.aborted) setError(e instanceof RangeError ? "music.trim_large_error" : reason);
            }
        }
        void read();
        return () => {
            abort.abort();
            stopSource();
            if (context.current) void context.current.close().catch(() => {});
            context.current = null;
        };
    }, [url, storageKey, attempt]);
    const path = useMemo(() => {
        if (!buffer) return "";
        const peaks = waveformPeaks(buffer);
        const highest = Math.max(0.015, ...peaks);
        return Array.from(peaks, (p, i) => {
            const amplitude = (44 * p) / highest;
            return "M" + (((i + 0.5) * 1000) / peaks.length).toFixed(2) + "," + (48 - amplitude).toFixed(2) + "v" + (2 * amplitude).toFixed(2);
        }).join("");
    }, [buffer]);
    async function preview(from: number) {
        const ctx = context.current;
        if (!ctx || !buffer || savePending.current) return;
        pause();
        const request = serial.current;
        try {
            onPreviewStart?.();
            await ctx.resume();
            if (request !== serial.current) return;
            const node = ctx.createBufferSource();
            node.buffer = buffer;
            const gain = ctx.createGain();
            level.current = gain;
            const { volume, isMuted } = useMusicStore.getState();
            gain.gain.value = isMuted ? 0 : volume;
            node.connect(gain);
            gain.connect(ctx.destination);
            const startTime = ctx.currentTime;
            const { frame: begin, offset, duration } = previewWindow(range, from, buffer.sampleRate);
            node.onended = () => {
                if (source.current !== node) return;
                node.disconnect();
                gain.disconnect();
                level.current = null;
                source.current = null;
                cancelAnimationFrame(animation.current);
                setPlaying(false);
                setCursor(range[1]);
            };
            node.start(0, offset, duration);
            source.current = node;
            setPlaying(true);
            setError("");
            function tick() {
                setCursor(Math.min(range[1], begin + (ctx!.currentTime - startTime) * buffer!.sampleRate));
                animation.current = requestAnimationFrame(tick);
            }
            tick();
        } catch {
            if (serial.current === request) {
                pause();
                setError("music.trim_preview_error");
            }
        }
    }
    function apply(next: TrimRange, remember = true) {
        if (savePending.current) return;
        if (next[0] === range[0] && next[1] === range[1]) return;
        pause();
        if (remember) setUndo(range);
        setRange(next);
        setCursor(next[0]);
        setError("");
    }
    function move(edge: TrimEdge, frame: number, remember = true) {
        if (!buffer) return;
        apply(trimFrames(buffer.length, buffer.sampleRate, edge === "start" ? frame : range[0], edge === "end" ? frame : range[1], edge), remember);
    }
    async function save() {
        const ctx = context.current;
        if (!buffer || !ctx || savePending.current) return;
        pause();
        setError("");
        savePending.current = true;
        setSaving(true);
        try {
            const blob = encodeTrimWav(buffer, range[0], range[1]);
            await onSave({ blob, start: range[0] / buffer.sampleRate, end: range[1] / buffer.sampleRate, title: t("music.trim_copy_name", { title }) });
            if (context.current === ctx) dismiss();
        } catch {
            if (context.current === ctx) setError("music.trim_save_error");
        } finally {
            savePending.current = false;
            if (context.current === ctx) setSaving(false);
        }
    }
    const rate = buffer?.sampleRate || 1;
    const length = buffer?.length || 1;
    const minimum = Math.min(length, Math.ceil(rate * 0.05));
    return (
        <AppModal
            open
            centered
            rootClassName="plugin-music-generation music-trim-overlay"
            width={740}
            title={
                <span translate="no" data-i18n-ignore="true">
                    {t("music.trim_title")}
                </span>
            }
            onCancel={() => {
                if (!savePending.current) dismiss();
            }}
            onOk={() => void save()}
            cancelText={t("common.cancel")}
            okText={t("music.trim_save")}
            confirmLoading={saving}
            okButtonProps={{ disabled: !buffer || (range[0] === 0 && range[1] === length) }}
            cancelButtonProps={{ disabled: saving }}
            keyboard={!saving}
            closable={!saving}
            mask={{ closable: false }}
        >
            <div className="music-trim-editor" translate="no" data-i18n-ignore="true">
                <p className="music-trim-track">
                    <Scissors size={16} aria-hidden="true" /> <span>{title}</span>
                </p>
                {error && (
                    <p role="alert" className="music-trim-error">
                        {t(error)} {!buffer && <Button onClick={() => setAttempt((n) => n + 1)}>{t("common.retry")}</Button>}
                    </p>
                )}
                {!buffer && !error && <p role="status">{t("music.trim_loading")}</p>}
                {buffer && (
                    <fieldset disabled={saving}>
                        <div className="music-trim-ruler">
                            <b>{time(cursor / rate)}</b>
                            <span>{time(length / rate)}</span>
                        </div>
                        <div
                            ref={stage}
                            className="music-trim-wave"
                            style={{ "--trim-start": (range[0] / length) * 100 + "%", "--trim-tail": (1 - range[1] / length) * 100 + "%" } as CSSProperties}
                            onPointerDown={(event) => {
                                if (event.button !== 0 || savePending.current || (event.target as Element).closest('[role="slider"]')) return;
                                const box = event.currentTarget.getBoundingClientRect();
                                const pos = Math.round(Math.max(range[0], Math.min(range[1], ((event.clientX - box.left) / box.width) * length)));
                                pause();
                                setCursor(pos);
                                if (playing && pos < range[1]) void preview(pos);
                            }}
                        >
                            <svg viewBox="0 0 1000 96" preserveAspectRatio="none" aria-hidden="true">
                                <path d={path} />
                                <path className="music-trim-peaks" d={path} />
                            </svg>
                            <span className="music-trim-selection" aria-hidden="true" />
                            <span className="music-trim-cursor" style={{ left: (cursor / length) * 100 + "%" }} aria-hidden="true" />
                            {edges.map((edge, i) => {
                                const frame = range[i];
                                const lo = i ? range[0] + minimum : 0;
                                const hi = i ? length : range[1] - minimum;
                                return (
                                    <button
                                        key={edge}
                                        type="button"
                                        role="slider"
                                        className="music-trim-handle"
                                        style={{ left: (frame / length) * 100 + "%" }}
                                        aria-label={t(i ? "music.trim_end" : "music.trim_start")}
                                        aria-valuemin={lo / rate}
                                        aria-valuemax={hi / rate}
                                        aria-valuenow={frame / rate}
                                        aria-valuetext={time(frame / rate)}
                                        onPointerDown={(event) => {
                                            if (event.button !== 0 || !event.isPrimary || gesture.current || !stage.current) return;
                                            event.preventDefault();
                                            event.stopPropagation();
                                            event.currentTarget.focus();
                                            event.currentTarget.setPointerCapture(event.pointerId);
                                            gesture.current = { id: event.pointerId, x: event.clientX, width: stage.current.getBoundingClientRect().width, range };
                                        }}
                                        onPointerMove={(event) => {
                                            const drag = gesture.current;
                                            if (drag?.id === event.pointerId) move(edge, drag.range[i] + ((event.clientX - drag.x) / drag.width) * length, false);
                                        }}
                                        onLostPointerCapture={() => {
                                            const before = gesture.current?.range;
                                            gesture.current = null;
                                            if (before && (before[0] !== range[0] || before[1] !== range[1])) setUndo(before);
                                        }}
                                        onKeyDown={(event) => {
                                            const step = rate * (event.shiftKey ? 1 : event.altKey ? 0.01 : 0.1);
                                            const targets: Record<string, number> = { ArrowLeft: frame - step, ArrowDown: frame - step, ArrowRight: frame + step, ArrowUp: frame + step, Home: lo, End: hi };
                                            if (event.key in targets) {
                                                event.preventDefault();
                                                move(edge, targets[event.key]);
                                            }
                                        }}
                                    />
                                );
                            })}
                        </div>
                        <p className="music-trim-help">{t("music.trim_help")}</p>
                        <div className="music-trim-values">
                            {edges.map((edge, i) => (
                                <TimeField
                                    key={edge}
                                    label={t(i ? "music.trim_end" : "music.trim_start")}
                                    seconds={range[i] / rate}
                                    min={i ? (range[0] + minimum) / rate : 0}
                                    max={i ? length / rate : (range[1] - minimum) / rate}
                                    commit={(v) => move(edge, v * rate)}
                                />
                            ))}
                            <div>
                                <span>{t("music.trim_duration")}</span>
                                <strong>{time((range[1] - range[0]) / rate)}</strong>
                            </div>
                        </div>
                        <div className="music-trim-actions">
                            <Button icon={playing ? <Pause size={16} /> : <Play size={16} />} aria-pressed={playing} onClick={() => (playing ? pause() : void preview(cursor))}>
                                {t(playing ? "music.player_pause" : "music.trim_preview")}
                            </Button>
                            <Button
                                icon={<Undo2 size={16} />}
                                disabled={!undo}
                                onClick={() => {
                                    if (undo) apply(undo, false);
                                    setUndo(null);
                                }}
                            >
                                {t("common.undo_adjustments")}
                            </Button>
                            <Button icon={<RotateCcw size={16} />} disabled={range[0] === 0 && range[1] === length} onClick={() => apply([0, length])}>
                                {t("common.reset")}
                            </Button>
                        </div>
                    </fieldset>
                )}
            </div>
        </AppModal>
    );
}
