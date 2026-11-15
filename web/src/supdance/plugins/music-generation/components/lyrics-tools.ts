// 歌词便捷工具的纯数据与算法层：不含 React、i18n t()、网络请求。
// 组件负责把 labelKey 交给 useI18n().t()，把 prompt 交给 AI service。
import { insertLyricSection, lyricSections } from "./composer-patterns";

/** 话题 pill：点击后作为「一句话生成歌词」的主题种子，labelKey 指向 6 语言词条。 */
export type LyricTopicId = "love" | "anthem" | "birthday" | "faith" | "struggle";
export type LyricTopic = { id: LyricTopicId; labelKey: string; seed: string };

export const lyricTopics: readonly LyricTopic[] = [
    { id: "love", labelKey: "music.lyric_topic_love", seed: "关于相遇、心动与陪伴的温柔情歌" },
    { id: "anthem", labelKey: "music.lyric_topic_anthem", seed: "为自己打气的个人宣言，副歌要有齐唱感" },
    { id: "birthday", labelKey: "music.lyric_topic_birthday", seed: "生日庆祝，轻快、明亮、带祝福口吻" },
    { id: "faith", labelKey: "music.lyric_topic_faith", seed: "在低谷里守住信念，克制而有力量" },
    { id: "struggle", labelKey: "music.lyric_topic_struggle", seed: "与现实拉扯、深夜独白，最后留一点出口" },
];

/** 整曲骨架：点击后把带结构标签的框架插到光标处，仍是本地操作。 */
export type LyricSkeletonId = "pop" | "hiphop" | "score" | "folk";
export type LyricSkeleton = { id: LyricSkeletonId; labelKey: string; outline: string };

export const songSkeletons: readonly LyricSkeleton[] = [
    { id: "pop", labelKey: "music.lyric_skeleton_pop", outline: "[Verse 1]\n\n[Pre-Chorus]\n\n[Chorus]\n\n[Verse 2]\n\n[Chorus]\n\n[Bridge]\n\n[Chorus]\n\n[Outro]\n" },
    { id: "hiphop", labelKey: "music.lyric_skeleton_hiphop", outline: "[Intro]\n\n[Verse 1]\n\n[Hook]\n\n[Verse 2]\n\n[Hook]\n\n[Bridge]\n\n[Outro]\n" },
    { id: "score", labelKey: "music.lyric_skeleton_score", outline: "[Intro]\n\n[Verse]\n\n[Chorus]\n\n[Instrumental]\n\n[Chorus]\n\n[Outro]\n" },
    { id: "folk", labelKey: "music.lyric_skeleton_folk", outline: "[Verse 1]\n\n[Verse 2]\n\n[Chorus]\n\n[Verse 3]\n\n[Chorus]\n\n[Outro]\n" },
];

/** AI 动作：needsSelection 表示必须选中歌词行才能发起。 */
export type LyricAIActionId = "generate" | "continue" | "rewrite" | "rhyme";
export type LyricAIAction = { id: LyricAIActionId; labelKey: string; needsSelection: boolean };

export const lyricAIActions: readonly LyricAIAction[] = [
    { id: "generate", labelKey: "music.lyric_ai_generate", needsSelection: false },
    { id: "continue", labelKey: "music.lyric_ai_continue", needsSelection: true },
    { id: "rewrite", labelKey: "music.lyric_ai_rewrite", needsSelection: true },
    { id: "rhyme", labelKey: "music.lyric_ai_rhyme", needsSelection: true },
];

export type LyricPromptContext = {
    action: LyricAIActionId;
    /** 话题 seed 或用户输入的一句话；generate 必填。 */
    topic?: string;
    /** 当前歌词全文（continue/rewrite/rhyme 的上下文）。 */
    lyrics?: string;
    /** 选中的歌词行（needsSelection 动作必填）。 */
    selection?: string;
    /** 演唱语言，跟随 draft.songLanguage；为空时不强加。 */
    language?: string;
};

const OUTPUT_RULES = [
    "只输出歌词正文，不要输出标题、解释、Markdown、代码块或引号包裹。",
    "段落用英文方括号标签，例如 [Verse 1]、[Pre-Chorus]、[Chorus]、[Bridge]、[Outro]、[Instrumental]。",
    "每段 2 至 6 行，行与行之间留出可唱的呼吸，不要写成散文。",
    "不要编造不存在的结构标签。",
].join("\n");

/** 组装喂给文本模型的歌词指令。纯函数，便于单测与重试。 */
export function buildLyricPrompt(context: LyricPromptContext): string {
    const { action, topic = "", lyrics = "", selection = "", language = "" } = context;
    const lang = language.trim();
    const langRule = lang ? `使用 ${lang} 写词；结构标签仍用英文方括号。` : "若现有歌词或主题没有明确语言，默认使用简体中文；结构标签仍用英文方括号。";
    const instruction: Record<LyricAIActionId, string> = {
        generate: `根据主题写一首完整的结构化歌词。主题：${topic.trim() || "一首关于此刻心情的歌"}。必须包含至少一个 [Chorus]。`,
        continue: `在不重复已有内容的前提下，顺着情绪、人称和韵脚续写歌词，只输出新增的段落与行，不要重写已有歌词。`,
        rewrite: `在保持原意、人称和情绪的前提下改写选中的歌词行，让意象更具体、更可唱。只输出改写后的这些行。`,
        rhyme: `调整选中歌词行的句末用词，让这些行彼此押韵或同韵，尽量不改变原意与行数。只输出调整后的这些行。`,
    };
    const parts = ["你是专业的作词人，为 AI 音乐生成写可直接演唱的结构化歌词。", langRule, OUTPUT_RULES, instruction[action]];
    if (lyrics.trim()) parts.push(`【当前歌词全文】\n${lyrics.trim()}`);
    if (selection.trim()) parts.push(`【选中的行】\n${selection.trim()}`);
    return parts.join("\n\n");
}

const KNOWN_SECTIONS = new Set(lyricSections.map((section) => section.toLowerCase()));
const SECTION_RE = /^\s*\[([^\]]+)\]\s*$/gm;

export type LyricStructureIssue = "too_long" | "missing_chorus" | "unknown_section" | "empty";

/** 轻量结构校验：只提示，不阻断生成。 */
export function validateLyricStructure(value: string, maxChars: number) {
    const charCount = Array.from(value).length;
    const sections = [...value.matchAll(SECTION_RE)].map((match) => match[1].trim());
    const issues: LyricStructureIssue[] = [];
    if (!value.trim()) issues.push("empty");
    if (charCount > maxChars) issues.push("too_long");
    const lower = sections.map((section) => section.toLowerCase());
    if (value.trim() && !lower.some((section) => section.startsWith("chorus") || section.startsWith("hook"))) issues.push("missing_chorus");
    if (sections.some((section) => !KNOWN_SECTIONS.has(section.toLowerCase()) && !/^(hook|verse\s*\d*|chorus\s*\d*|pre-chorus\s*\d*|bridge\s*\d*|outro|intro|instrumental)$/i.test(section))) issues.push("unknown_section");
    return { charCount, sections, issues };
}

/** 把整曲骨架插到光标处，复用 insertLyricSection 的 UTF-16 光标与字数上限语义。 */
export function insertLyricSkeleton(value: string, start: number, end: number, outline: string, limit: number) {
    return insertLyricSection(value, start, end, outline, limit);
}

/**
 * 无 AI 时的本地话题起手稿：每个话题给两段可直接续写的骨架行。
 * 这不是生成的歌词，只是帮助创作者越过「空白页」的起手式，可自由改写。
 */
export function buildTopicStarter(topicId: LyricTopicId): string {
    const starters: Record<LyricTopicId, string> = {
        love: "[Verse 1]\n第一次遇见你的那条街\n路灯还亮着昨天的温热\n\n[Chorus]\n我想把心动写进这首歌\n让每一个字都替我说\n",
        anthem: "[Verse 1]\n走过的弯路都是我的勋章\n没人能替我决定方向\n\n[Chorus]\n这一次我为自己唱\n声音再小也要响亮\n",
        birthday: "[Verse 1]\n蜡烛点亮了这个房间\n笑声比蛋糕还要甜\n\n[Chorus]\n祝你生日快乐 愿望都实现\n明年今天我们再见面\n",
        faith: "[Verse 1]\n风很大的夜里我不问结果\n只问自己有没有走过\n\n[Chorus]\n守住心里那盏不灭的光\n慢一点也没关系 别慌\n",
        struggle: "[Verse 1]\n深夜的地铁载着没说的话\n明天的班表排不开回答\n\n[Chorus]\n就算被生活反复敲打\n我仍想留一扇回家的窗\n",
    };
    return starters[topicId];
}
