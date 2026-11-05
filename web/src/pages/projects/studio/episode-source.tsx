import { creationText as _creationText, useCreationLocale as _useCreationLocale } from "@/supdance/plugins/i18n/creation-text";
import { useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, Checkbox, Input } from "antd";
import { AlertTriangle, FileUp, X } from "lucide-react";

import { AppModal } from "@/components/ui/product/app-modal";
import { decodeNovelText } from "@/lib/canvas/canvas-document";
import { EPISODE_SOURCE_CHARS, sourceChars } from "@/lib/drama/novel-parse";
import { addDramaEpisode, getDramaChapter, updateDramaChapter, updateDramaEpisode, type DramaChapterRef, type DramaSourceFormat } from "@/services/api/drama";

import { formatCount, SOURCE_FORMAT_LABEL, SourceFormatPicker } from "../drama-shared";

// 逐集制作：在作品末尾追加一集、插到某一集前后，或修改某一集的原文与素材类型。原文修改后需要重新改编才会重写剧本。

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const TEXT_FILE = /\.(txt|md|markdown|csv|tsv)$/i;

function useTextFile(onText: (text: string, fileName: string) => void) {
    const { message } = App.useApp();
    const inputRef = useRef<HTMLInputElement>(null);
    const read = async (file: File) => {
        if (!TEXT_FILE.test(file.name)) {
            message.warning(_creationText("creation.599797a91aac7b1d"));
            return;
        }
        if (file.size > MAX_FILE_BYTES) {
            message.warning(_creationText("creation.71a1990345864f54"));
            return;
        }
        onText(decodeNovelText(await file.arrayBuffer()), file.name);
    };
    const input = (
        <input
            ref={inputRef}
            type="file"
            accept=".txt,.md,.markdown,.csv,.tsv,text/plain,text/markdown"
            className="hidden"
            onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void read(file);
            }}
        />
    );
    return { input, open: () => inputRef.current?.click(), read };
}

function CharCounter({ chars, limit }: { chars: number; limit: number }) {
    _useCreationLocale();
    const over = chars > limit;
    return (
        <span className={`drama-composer-count ${over ? "is-over" : ""}`}>
            {formatCount(chars)} / {formatCount(limit)}
            {_creationText("creation.c55038b272b109b8")}
            {over ? _creationText("creation.8b8c6488f9e6ce9c") : ""}
        </span>
    );
}

/** 原文编辑弹窗外壳：左栏放标题、素材类型和格式说明，右侧整块是原文编辑区，可直接拖入文件。 */
function SourceComposer({
    open,
    title,
    subtitle,
    format,
    onFormat,
    side,
    text,
    onText,
    loading,
    notice,
    footer,
    onClose,
}: {
    open: boolean;
    title: string;
    subtitle: string;
    format: DramaSourceFormat;
    onFormat: (format: DramaSourceFormat) => void;
    side?: ReactNode;
    text: string;
    onText: (text: string, fileName?: string) => void;
    loading?: boolean;
    notice?: ReactNode;
    footer: ReactNode;
    onClose: () => void;
}) {
    _useCreationLocale();
    const [dragOver, setDragOver] = useState(false);
    const file = useTextFile(onText);
    const onDrop = (event: DragEvent<HTMLElement>) => {
        event.preventDefault();
        setDragOver(false);
        const dropped = event.dataTransfer.files?.[0];
        if (dropped) void file.read(dropped);
    };
    return (
        <AppModal open={open} onCancel={onClose} footer={null} title={null} closable={false} flush centered width="min(1120px, calc(100vw - 48px))" rootClassName="drama-root" aria-label={title}>
            <div className="drama-composer">
                <header className="drama-composer-head">
                    <div className="min-w-0">
                        <strong>{title}</strong>
                        <span>{subtitle}</span>
                    </div>
                    <Button type="text" icon={<X className="size-4" />} aria-label={_creationText("common.close")} onClick={onClose} />
                </header>
                <div className="drama-composer-body">
                    <aside className="drama-composer-side thin-scrollbar">
                        {side}
                        <div className="drama-composer-field">
                            <span className="drama-composer-label">{_creationText("creation.3be96f8eb83d1a15")}</span>
                            <SourceFormatPicker value={format} onChange={onFormat} />
                        </div>
                        <div className="drama-composer-guide">
                            <span className="drama-composer-label">{_creationText("creation.cd3aa44f1398935c", { value1: SOURCE_FORMAT_LABEL[format].title })}</span>
                            <ul>
                                {SOURCE_FORMAT_LABEL[format].guide.map((line) => (
                                    <li key={line}>{line}</li>
                                ))}
                            </ul>
                        </div>
                        <Button block icon={<FileUp className="size-4" />} onClick={file.open}>
                            {_creationText("creation.3cee1d8c9c03fb5f")}
                        </Button>
                        {file.input}
                    </aside>
                    <section
                        className={`drama-composer-editor ${dragOver ? "is-over" : ""}`}
                        onDragOver={(event) => {
                            event.preventDefault();
                            setDragOver(true);
                        }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={onDrop}
                    >
                        {notice}
                        <Input.TextArea
                            className="drama-composer-text thin-scrollbar"
                            value={loading ? "" : text}
                            disabled={loading}
                            placeholder={loading ? _creationText("creation.4e8dbea41eda1af7") : _creationText("creation.aef00d508315c0d4", { value1: SOURCE_FORMAT_LABEL[format].placeholder })}
                            aria-label={_creationText("creation.c6003b87469ef2dd")}
                            onChange={(event) => onText(event.target.value)}
                        />
                    </section>
                </div>
                <footer className="drama-composer-foot">{footer}</footer>
            </div>
        </AppModal>
    );
}

/** 插入位置：放到锚点集之前或之后，新集取得的集号就是 nextNumber，后续各集顺延。 */
export type EpisodePlacement = { anchorId: string; anchorNumber: number; position: "before" | "after" };

export function AddEpisodeModal({
    open,
    projectId,
    nextNumber,
    placement,
    defaultFormat,
    blockedReason,
    onClose,
    onAdded,
}: {
    open: boolean;
    projectId: string;
    nextNumber: number;
    /** 不传时追加到末尾。 */
    placement?: EpisodePlacement;
    defaultFormat: DramaSourceFormat;
    blockedReason?: string;
    onClose: () => void;
    onAdded: (episodeId: string) => void;
}) {
    _useCreationLocale();
    const { message } = App.useApp();
    const [title, setTitle] = useState("");
    const [format, setFormat] = useState<DramaSourceFormat>(defaultFormat);
    const [text, setText] = useState("");
    useEffect(() => {
        if (!open) return;
        setTitle("");
        setText("");
        setFormat(defaultFormat);
    }, [defaultFormat, open]);
    const chars = sourceChars(text);
    const add = useMutation({
        mutationFn: () => addDramaEpisode(projectId, { title: title.trim(), text, sourceFormat: format, ...(placement ? { anchorEpisodeId: placement.anchorId, position: placement.position } : {}) }),
        onSuccess: (detail) => {
            message.success(
                placement
                    ? _creationText("projects.insert_episode_started", { number: detail.episode.number, stage: format === "novel" ? _creationText("creation.2698848f609303b9") : _creationText("creation.50804542fdfa68cf") })
                    : _creationText("creation.0bea9d02bdb4e098", { value1: detail.episode.number, value2: format === "novel" ? _creationText("creation.2698848f609303b9") : _creationText("creation.50804542fdfa68cf") }),
            );
            onAdded(detail.episode.id);
        },
        onError: (error) => message.error(error instanceof Error ? error.message : _creationText(placement ? "projects.insert_episode_failed" : "creation.2ca15f1e2bb7d991")),
    });
    return (
        <SourceComposer
            open={open}
            title={
                placement
                    ? _creationText("projects.insert_episode_title", { number: placement.anchorNumber, position: _creationText(placement.position === "before" ? "projects.before" : "projects.after") })
                    : _creationText("creation.7fa645eba8ead61e", { value1: nextNumber })
            }
            subtitle={placement ? _creationText("projects.insert_episode_subtitle", { number: nextNumber }) : _creationText("projects.append_episode_subtitle")}
            format={format}
            onFormat={setFormat}
            text={text}
            onText={(value, fileName) => {
                setText(value);
                if (fileName && !title) setTitle(fileName.replace(/\.[^.]+$/, "").slice(0, 60));
            }}
            onClose={onClose}
            side={
                <label className="drama-composer-field">
                    <span className="drama-composer-label">{_creationText("creation.1dec31ee573df5ab")}</span>
                    <Input value={title} maxLength={60} placeholder={_creationText("creation.660a9d9774bf60d3", { value1: nextNumber })} aria-label={_creationText("creation.1dec31ee573df5ab")} onChange={(event) => setTitle(event.target.value)} />
                </label>
            }
            notice={
                blockedReason ? (
                    <div className="drama-composer-notice">
                        <AlertTriangle className="size-4 shrink-0" />
                        {blockedReason}
                    </div>
                ) : null
            }
            footer={
                <>
                    <CharCounter chars={chars} limit={EPISODE_SOURCE_CHARS} />
                    <span className="flex-1" />
                    <Button onClick={onClose}>{_creationText("common.cancel")}</Button>
                    <Button type="primary" loading={add.isPending} disabled={Boolean(blockedReason) || !chars || chars > EPISODE_SOURCE_CHARS} onClick={() => add.mutate()}>
                        {format === "storyboard" ? _creationText("creation.9dd00763ec0108c2") : _creationText(placement ? "projects.insert_episode_action" : "creation.b3f93c38ccf1321f")}
                    </Button>
                </>
            }
        />
    );
}

export function SourceEditModal({
    open,
    projectId,
    episodeId,
    episodeFormat,
    chapter,
    onClose,
    onSaved,
}: {
    open: boolean;
    projectId: string;
    episodeId: string;
    episodeFormat: DramaSourceFormat;
    chapter?: DramaChapterRef;
    onClose: () => void;
    onSaved: (rescript: boolean) => void;
}) {
    _useCreationLocale();
    const { message } = App.useApp();
    const queryClient = useQueryClient();
    const queryKey = ["drama", projectId, "chapter", chapter?.id || ""];
    const query = useQuery({ queryKey, queryFn: ({ signal }) => getDramaChapter(projectId, chapter!.id, signal), enabled: open && Boolean(chapter), staleTime: 300_000 });
    const original = query.data?.chapter.sourceText || "";
    const [text, setText] = useState("");
    const [format, setFormat] = useState<DramaSourceFormat>(episodeFormat);
    const [rescript, setRescript] = useState(true);
    useEffect(() => {
        if (!open) return;
        setText(original);
        setFormat(episodeFormat);
        setRescript(true);
    }, [episodeFormat, open, original]);
    const limit = Math.max(EPISODE_SOURCE_CHARS, sourceChars(original));
    const chars = sourceChars(text);
    const changed = text !== original || format !== episodeFormat;
    const save = useMutation({
        mutationFn: async () => {
            if (chapter && text !== original) await updateDramaChapter(projectId, chapter.id, { text });
            if (format !== episodeFormat) await updateDramaEpisode(projectId, episodeId, { sourceFormat: format });
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey });
            message.success(rescript ? _creationText("creation.28e04e2468d53421") : _creationText("creation.0f2096428cf59caf"));
            onSaved(rescript);
        },
        onError: (error) => message.error(error instanceof Error ? error.message : _creationText("common.save_failed")),
    });
    return (
        <SourceComposer
            open={open}
            title={chapter ? _creationText("creation.10fa8bf52767883e", { value1: chapter.title }) : _creationText("creation.edd6fd715398dd82")}
            subtitle="改的是这一章的原文；已写好的剧本保持不变，重新改编后才按新原文重写"
            format={format}
            onFormat={setFormat}
            text={text}
            onText={(value) => setText(value)}
            loading={query.isLoading}
            onClose={onClose}
            footer={
                <>
                    <Checkbox checked={rescript} onChange={(event) => setRescript(event.target.checked)}>
                        {_creationText("creation.4797e3e4aaaf280e")}
                    </Checkbox>
                    <CharCounter chars={chars} limit={limit} />
                    <span className="flex-1" />
                    <Button onClick={onClose}>{_creationText("common.cancel")}</Button>
                    <Button type="primary" loading={save.isPending} disabled={!changed || !chars || chars > limit || query.isLoading} onClick={() => save.mutate()}>
                        {rescript ? _creationText("creation.86ac776c9608ef9b") : _creationText("creation.a70eff2e9bbd86dd")}
                    </Button>
                </>
            }
        />
    );
}
