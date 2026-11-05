import { creationText as _creationText, useCreationLocale as _useCreationLocale } from "@/supdance/plugins/i18n/creation-text";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { App, Button, Input } from "antd";
import type { TextAreaRef } from "antd/es/input/TextArea";
import { BookMarked, Check, Eye, FileText, PenLine, RotateCcw, Search, TriangleAlert, Blocks } from "lucide-react";

import { AppModal } from "@/components/ui/product/app-modal";
import { CHARACTER_VARIABLES, renderAssetPrompt, SCENE_VARIABLES, unknownAssetVariables } from "@/lib/drama/asset-prompt";
import { cn } from "@/lib/utils";
import { getDramaAssetSchemes, type DramaAssetMode, type DramaAssetSchemeCatalog, type DramaAssetSettings, type DramaModelOption } from "@/services/api/drama";
import { getSkillFile, listAddedSkills, listSkillFiles } from "@/services/api/skills";

// 角色/场景参考图方案：开工前选定，设置页可改。保存的是全文提示词，预览就是实际发送的内容。

const PROMPT_LIMIT = 4000;
const CUSTOM_RATIOS = ["16:9", "4:3", "1:1", "3:4", "9:16"];

export function useAssetSchemes() {
    return useQuery({ queryKey: ["drama-asset-schemes"], queryFn: getDramaAssetSchemes, staleTime: 10 * 60_000 });
}

export function defaultAssetSettings(catalog?: DramaAssetSchemeCatalog): DramaAssetSettings | undefined {
    const scheme = catalog?.schemes[0];
    if (!catalog || !scheme) return undefined;
    return { mode: scheme.mode, characterPrompt: scheme.characterPrompt, scenePrompt: catalog.scenePrompt, characterRatio: scheme.ratio };
}

export type AssetPreviewSample = { characterName: string; characterAppearance: string; sceneName: string; sceneAppearance: string; style: string; rules: string };

const FALLBACK_SAMPLE: AssetPreviewSample = { characterName: "主角", characterAppearance: "（作品圣经建立后自动填入角色外貌）", sceneName: "主场景", sceneAppearance: "（作品圣经建立后自动填入环境描述）", style: "写实电影感", rules: "" };

/** 方案示意：用色块画出版式，比文字更快看懂差别。 */
function SchemeGlyph({ mode }: { mode: DramaAssetMode }) {
    _useCreationLocale();
    if (mode === "portrait")
        return (
            <span className="drama-glyph is-portrait">
                <i />
            </span>
        );
    if (mode === "turnaround")
        return (
            <span className="drama-glyph is-turnaround">
                <i />
                <i />
                <i />
            </span>
        );
    if (mode === "fourview")
        return (
            <span className="drama-glyph is-fourview">
                <i className="is-face" />
                <i />
                <i />
                <i />
                <b />
            </span>
        );
    return (
        <span className="drama-glyph is-custom">
            <PenLine className="size-4" />
        </span>
    );
}

/**
 * imageModel 是当前选中的图片模型：用来只列出它能给出的画幅与分辨率档位，并提前提示保存时会被拒绝的组合。
 */
export function AssetSchemePicker({
    value,
    onChange,
    sample,
    layout = "wide",
    imageModel,
}: {
    value?: DramaAssetSettings;
    onChange: (value: DramaAssetSettings) => void;
    sample?: Partial<AssetPreviewSample>;
    layout?: "wide" | "compact";
    imageModel?: DramaModelOption;
}) {
    _useCreationLocale();
    const { modal } = App.useApp();
    const catalogQuery = useAssetSchemes();
    const catalog = catalogQuery.data;
    const [tab, setTab] = useState<"character" | "scene">("character");
    const [importOpen, setImportOpen] = useState(false);
    const editorRef = useRef<TextAreaRef>(null);
    const preview = { ...FALLBACK_SAMPLE, ...Object.fromEntries(Object.entries(sample || {}).filter(([, item]) => item)) } as AssetPreviewSample;
    if (!catalog || !value) return <div className="drama-assets is-loading">{_creationText("creation.f72ab44796a7d1bc")}</div>;
    // imageModel 是角色参考图实际使用的图片模型；能力未知（模型列表未加载）时不做限制，交给服务端保存时校验。
    // 道具与场景固定 16:9，能列入短剧模型目录的图片模型都给得出。
    const ratios = imageModel?.imageRatios;
    const ratioProblems = ratios && !ratios.includes(value.characterRatio) ? [value.characterRatio] : [];

    const scheme = catalog.schemes.find((item) => item.mode === value.mode);
    const prompt = tab === "character" ? value.characterPrompt : value.scenePrompt;
    const variables = tab === "character" ? CHARACTER_VARIABLES : SCENE_VARIABLES;
    const defaultPrompt = tab === "character" ? scheme?.characterPrompt || catalog.schemes[0].characterPrompt : catalog.scenePrompt;
    const unknown = unknownAssetVariables(prompt, variables);
    const modified = prompt.trim() !== defaultPrompt.trim();
    const rendered =
        tab === "character"
            ? renderAssetPrompt(prompt, { 角色名称: preview.characterName, 角色设定: preview.characterAppearance, 项目画风: preview.style, 画面规则: preview.rules })
            : renderAssetPrompt(prompt, { 场景名称: preview.sceneName, 场景设定: preview.sceneAppearance, 项目画风: preview.style, 画面规则: preview.rules });

    const setPrompt = (next: string) => onChange(tab === "character" ? { ...value, characterPrompt: next } : { ...value, scenePrompt: next });
    const chooseMode = (mode: DramaAssetMode) => {
        if (mode === value.mode) return;
        const target = catalog.schemes.find((item) => item.mode === mode);
        const apply = () =>
            onChange({
                ...value,
                mode,
                characterPrompt: target ? target.characterPrompt : value.characterPrompt,
                characterRatio: target ? target.ratio : value.characterRatio,
                sourceSkillId: target ? undefined : value.sourceSkillId,
                sourceSkillName: target ? undefined : value.sourceSkillName,
                sourcePath: target ? undefined : value.sourcePath,
            });
        const characterModified = scheme ? value.characterPrompt.trim() !== scheme.characterPrompt.trim() : true;
        if (target && characterModified) {
            modal.confirm({ title: `切换为「${target.name}」？`, content: "当前角色提示词有修改，切换后会替换为该方案的默认提示词。", okText: "切换", cancelText: "保留当前", centered: true, onOk: apply });
            return;
        }
        apply();
    };
    const insertVariable = (variable: string) => {
        const element = editorRef.current?.resizableTextArea?.textArea;
        const start = element?.selectionStart ?? prompt.length;
        const end = element?.selectionEnd ?? prompt.length;
        setPrompt(prompt.slice(0, start) + variable + prompt.slice(end));
        window.requestAnimationFrame(() => {
            element?.focus();
            element?.setSelectionRange(start + variable.length, start + variable.length);
        });
    };

    const schemes: Array<{ mode: DramaAssetMode; name: string; description: string; ratio: string }> = [
        ...catalog.schemes,
        { mode: "custom", name: "自定义", description: "自己写约束或从技能导入，例如团队的资产卡规范；可自选参考图画幅。", ratio: value.mode === "custom" ? value.characterRatio : "自选" },
    ];

    return (
        <section className={cn("drama-assets", layout === "compact" && "is-compact")} aria-label={_creationText("creation.3d7a7d95ab51522e")}>
            <div className="drama-assets-schemes" role="radiogroup" aria-label={_creationText("creation.432eb186fd538f75")}>
                {schemes.map((item) => (
                    <button key={item.mode} type="button" role="radio" aria-checked={value.mode === item.mode} className="drama-assets-scheme" onClick={() => chooseMode(item.mode)}>
                        <SchemeGlyph mode={item.mode} />
                        <span className="drama-assets-scheme-copy">
                            <strong>
                                {item.name}
                                <em>{item.ratio}</em>
                            </strong>
                            <span>{item.description}</span>
                        </span>
                        {value.mode === item.mode ? (
                            <span className="drama-assets-check" aria-hidden>
                                <Check className="size-3" />
                            </span>
                        ) : null}
                    </button>
                ))}
            </div>
            {value.mode === "custom" ? (
                <div className="drama-assets-ratio">
                    <span>{_creationText("creation.b1f503cdb32d4572")}</span>
                    <div className="drama-tabs" role="radiogroup" aria-label={_creationText("creation.b1f503cdb32d4572")}>
                        {CUSTOM_RATIOS.map((ratio) => {
                            const unsupported = Boolean(ratios && !ratios.includes(ratio));
                            return (
                                <button
                                    key={ratio}
                                    type="button"
                                    role="radio"
                                    className="drama-tab"
                                    aria-checked={value.characterRatio === ratio}
                                    disabled={unsupported && value.characterRatio !== ratio}
                                    title={unsupported ? _creationText("creation.3210a256d528e307") : undefined}
                                    onClick={() => onChange({ ...value, characterRatio: ratio })}
                                >
                                    {ratio}
                                </button>
                            );
                        })}
                    </div>
                    <small>{_creationText("creation.65c5b758190345a3")}</small>
                </div>
            ) : null}
            {ratioProblems.length ? (
                <p className="drama-assets-warning" role="alert">
                    <TriangleAlert className="size-3.5" />
                    {_creationText("creation.fe27849e2128a986")}
                    {ratioProblems.join("、")}
                    {_creationText("creation.036aba2c0ebe4d56")}
                    {value.mode === "custom" ? _creationText("creation.e46c369874c400e3") : ""}。
                </p>
            ) : null}

            <div className="drama-assets-editor">
                <div className="drama-assets-editor-head">
                    <div className="drama-tabs" role="tablist" aria-label={_creationText("creation.b17738690eeb4da5")}>
                        <button type="button" role="tab" className="drama-tab" aria-selected={tab === "character"} onClick={() => setTab("character")}>
                            {_creationText("creation.420e5f407c6d9cae")}
                        </button>
                        <button type="button" role="tab" className="drama-tab" aria-selected={tab === "scene"} onClick={() => setTab("scene")}>
                            {_creationText("creation.9c87286536652556")}
                        </button>
                    </div>
                    {modified ? <span className="drama-assets-badge">{_creationText("creation.682d211b7142758a")}</span> : <span className="drama-assets-badge is-muted">{_creationText("projects.default_preset")}</span>}
                    <div className="ml-auto flex gap-2">
                        <Button size="small" type="text" icon={<BookMarked className="size-3.5" />} onClick={() => setImportOpen(true)}>
                            {_creationText("creation.c7a7154c37469ea8")}
                        </Button>
                        <Button size="small" type="text" icon={<RotateCcw className="size-3.5" />} disabled={!modified} onClick={() => setPrompt(defaultPrompt)}>
                            {_creationText("creation.ba2e93e73037c71e")}
                        </Button>
                    </div>
                </div>
                <div className="drama-assets-variables" aria-label={_creationText("creation.f2326a33d384dfba")}>
                    <span>{_creationText("creation.f2326a33d384dfba")}</span>
                    {variables.map((variable) => (
                        <button key={variable} type="button" onClick={() => insertVariable(variable)}>
                            {variable.slice(2, -2)}
                        </button>
                    ))}
                </div>
                <Input.TextArea
                    ref={editorRef}
                    value={prompt}
                    maxLength={PROMPT_LIMIT}
                    showCount
                    autoSize={{ minRows: layout === "compact" ? 5 : 6, maxRows: 16 }}
                    onChange={(event) => setPrompt(event.target.value)}
                    aria-label={tab === "character" ? _creationText("creation.d0c9c9b2dbdafd0d") : _creationText("creation.1ed8e136a837ce18")}
                    status={unknown.length ? "error" : undefined}
                />
                {unknown.length ? (
                    <p className="drama-assets-warning">
                        <TriangleAlert className="size-3.5" />
                        {_creationText("creation.0cdac6e4dac13ea6")}
                        {unknown.join("、")}
                        {_creationText("creation.a085e1003dd76140")}
                    </p>
                ) : null}
                {tab === "character" && value.sourceSkillName ? (
                    <p className="drama-assets-source">
                        <Blocks className="size-3.5" />
                        {_creationText("creation.0ab7c93b810be5e1")}
                        {value.sourceSkillName}」{value.sourcePath ? ` · ${value.sourcePath}` : ""}
                    </p>
                ) : null}
                <div className="drama-assets-preview">
                    <div className="drama-assets-preview-head">
                        <Eye className="size-3.5" />
                        {_creationText("creation.58657f416eb5dd05")}
                        <span>
                            {_creationText("creation.3e21707a0972ad7a")}
                            {tab === "character" ? preview.characterName : preview.sceneName}
                            {_creationText("creation.381def80c8290e03")}
                        </span>
                    </div>
                    <p>{rendered}</p>
                    {tab === "character" && scheme ? <small>{_creationText("creation.81018bcf4e214988", { value1: scheme.frameHint })}</small> : null}
                </div>
            </div>
            <SkillPromptImportModal
                open={importOpen}
                onClose={() => setImportOpen(false)}
                onImport={({ text, skillId, skillName, path }) => {
                    const next = /\{\{角色名称\}\}|\{\{角色设定\}\}/.test(text) ? text : `${text.trim()}\n\n【本角色】{{角色名称}}：{{角色设定}}。画风：{{项目画风}}。{{画面规则}}`;
                    onChange({ ...value, mode: value.mode === "custom" ? "custom" : value.mode, characterPrompt: next.slice(0, PROMPT_LIMIT), sourceSkillId: skillId, sourceSkillName: skillName, sourcePath: path });
                    setTab("character");
                    setImportOpen(false);
                }}
            />
        </section>
    );
}

/** 从已添加技能里挑一份文本，选中段落导入为角色约束提示词。 */
function SkillPromptImportModal({ open, onClose, onImport }: { open: boolean; onClose: () => void; onImport: (input: { text: string; skillId: string; skillName: string; path: string }) => void }) {
    _useCreationLocale();
    const { message } = App.useApp();
    const [keyword, setKeyword] = useState("");
    const [skillId, setSkillId] = useState("");
    const [path, setPath] = useState("");
    const contentRef = useRef<HTMLPreElement>(null);
    const skillsQuery = useQuery({ queryKey: ["skills", "added"], queryFn: listAddedSkills, enabled: open, staleTime: 30_000 });
    const skills = useMemo(() => (skillsQuery.data?.skills || []).filter((skill) => !keyword.trim() || `${skill.skillName} ${skill.description}`.toLowerCase().includes(keyword.trim().toLowerCase())), [keyword, skillsQuery.data]);
    const skill = skillsQuery.data?.skills.find((item) => item.skillId === skillId);
    const filesQuery = useQuery({ queryKey: ["skills", skillId, "files"], queryFn: () => listSkillFiles(skillId), enabled: open && Boolean(skillId), staleTime: 60_000 });
    const files = (filesQuery.data?.files || []).filter((file) => file.kind === "markdown" || file.kind === "text");
    const fileQuery = useQuery({ queryKey: ["skills", skillId, "file", path], queryFn: () => getSkillFile(skillId, path), enabled: open && Boolean(skillId && path), staleTime: 60_000 });
    const content = fileQuery.data?.file.content || "";

    const importText = (whole: boolean) => {
        const selection = window.getSelection();
        const selected = selection && contentRef.current && contentRef.current.contains(selection.anchorNode) ? selection.toString() : "";
        const text = whole ? content : selected;
        if (!text.trim()) {
            message.info(_creationText("creation.2609db9b87723e75"));
            return;
        }
        if (text.length > PROMPT_LIMIT) message.warning(_creationText("creation.52da7bd0a2e4d38e", { value1: PROMPT_LIMIT }));
        onImport({ text: text.slice(0, PROMPT_LIMIT), skillId, skillName: skill?.skillName || "", path });
    };

    return (
        <AppModal open={open} onCancel={onClose} footer={null} width={1080} flush title={null} centered>
            <div className="drama-skill-import">
                <header className="drama-skill-import-head">
                    <div>
                        <strong>{_creationText("creation.5bb3d44604cf5970")}</strong>
                        <span>{_creationText("creation.409326aa20eddd2d")}</span>
                    </div>
                </header>
                <div className="drama-skill-import-body">
                    <aside>
                        <Input size="small" prefix={<Search className="size-3.5" />} allowClear placeholder={_creationText("creation.a255b288069164f8")} value={keyword} onChange={(event) => setKeyword(event.target.value)} />
                        <div className="drama-skill-import-list thin-scrollbar">
                            {skills.map((item) => (
                                <button
                                    key={item.skillId}
                                    type="button"
                                    aria-pressed={item.skillId === skillId}
                                    onClick={() => {
                                        setSkillId(item.skillId);
                                        setPath("");
                                    }}
                                >
                                    <strong>{item.skillName}</strong>
                                    <span>{item.description || "—"}</span>
                                </button>
                            ))}
                            {!skillsQuery.isLoading && !skills.length ? <ImportEmpty>{_creationText("creation.7288cc3f8983127a")}</ImportEmpty> : null}
                        </div>
                    </aside>
                    <aside>
                        <div className="drama-skill-import-caption">{skill ? _creationText("creation.439a89e75e6605d2", { value1: skill.skillName, value2: files.length }) : _creationText("creation.39932f24fe11a6ba")}</div>
                        <div className="drama-skill-import-list thin-scrollbar">
                            {files.map((file) => (
                                <button key={file.path} type="button" className="is-file" aria-pressed={file.path === path} onClick={() => setPath(file.path)}>
                                    <FileText className="size-3.5 shrink-0" />
                                    <span title={file.path}>{file.path}</span>
                                </button>
                            ))}
                            {skillId && !filesQuery.isLoading && !files.length ? <ImportEmpty>{_creationText("creation.e8c1f52b2855e316")}</ImportEmpty> : null}
                            {!skillId ? <ImportEmpty>{_creationText("creation.46559a5ec45ad140")}</ImportEmpty> : null}
                        </div>
                    </aside>
                    <section>
                        <div className="drama-skill-import-caption">
                            {path || _creationText("creation.354b28c853334568")}
                            {content ? (
                                <span>
                                    {content.length.toLocaleString("zh-CN")}
                                    {_creationText("creation.c55038b272b109b8")}
                                </span>
                            ) : null}
                        </div>
                        <pre ref={contentRef} className="drama-skill-import-content thin-scrollbar">
                            {fileQuery.isLoading ? _creationText("creation.86b6d0d63062ba81") : content || _creationText("creation.325c73cd0a74e244")}
                        </pre>
                    </section>
                </div>
                <footer className="drama-skill-import-foot">
                    <span>{_creationText("creation.d0ff38ebe7aec001", { value1: _creationText("creation.eafda473ba2a458a"), value2: _creationText("creation.a7e6e3a4940774f8") })}</span>
                    <Button onClick={onClose}>{_creationText("common.cancel")}</Button>
                    <Button disabled={!content} onClick={() => importText(true)}>
                        {_creationText("creation.0d36879811743a3f")}
                    </Button>
                    <Button type="primary" disabled={!content} onClick={() => importText(false)}>
                        {_creationText("creation.eb43bc072a42b7cd")}
                    </Button>
                </footer>
            </div>
        </AppModal>
    );
}

function ImportEmpty({ children }: { children: ReactNode }) {
    _useCreationLocale();
    return <div className="drama-skill-import-empty">{children}</div>;
}
