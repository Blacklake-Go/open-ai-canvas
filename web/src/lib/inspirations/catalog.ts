import type { CreationMode } from "@/lib/creation-mode";
import { HIGHLIGHT_REVISIONS } from "./source-revisions";

export type InspirationSourceId = "original" | "chatgpt-prompts" | "seedance" | "haohaoxue" | "youmind";

export type InspirationSourceInfo = {
    /** 卡片来源行上的短标签。 */
    label: string;
    /** 页脚链接文本，通常是仓库短名或站点名。 */
    name?: string;
    /** 来源地址：仓库或站点首页。 */
    repository?: string;
    revision?: string;
    license?: string;
    notice?: string;
};

/** 来源表：新增外部灵感源时在这里加一项，卡片与页脚都按它渲染许可标识。 */
export const inspirationSources: Record<InspirationSourceId, InspirationSourceInfo> = {
    original: { label: "原创提示词" },
    "chatgpt-prompts": {
        label: "开源改编 · CC0",
        name: "awesome-chatgpt-prompts",
        repository: "https://github.com/f/awesome-chatgpt-prompts",
        revision: "f78a1c5136fa080155d928e0d7e2b4a41ddef03e",
        license: "CC0-1.0",
        notice: "8 条文本模板依据公开领域提示词翻译改编；其余为本项目编写。封面复用项目已有示意图，不代表实际生成结果。",
    },
    seedance: {
        label: "社区精选 · CC BY 4.0",
        name: "awesome-seedance",
        repository: "https://github.com/LearnPrompt/awesome-seedance",
        revision: HIGHLIGHT_REVISIONS.seedance,
        license: "CC BY 4.0",
        notice: "视频提示词与封面来自 awesome-seedance（数据每日同步自 goodcase.ai），提示词经中文翻译改编，按 CC BY 4.0 署名使用。封面为原案例画面，不代表本平台生成结果。",
    },
    haohaoxue: {
        label: "好好学 AI · 图片提示词",
        name: "好好学 AI",
        repository: "https://www.haohaoxue.com/prompts/",
        revision: HIGHLIGHT_REVISIONS.haohaoxue,
        license: "站点公开数据 · robots.txt 允许抓取",
        notice: "图片提示词中文正文与封面来自好好学 AI 提示词库（haohaoxue.com），该站 robots.txt 明确允许包括 ClaudeBot 在内的抓取。作者署名取数据内置的 author 字段。封面为原提示词示例图，不代表本平台生成结果。",
    },
    youmind: {
        label: "YouMind 提示词库 · CC BY 4.0",
        name: "YouMind",
        repository: "https://github.com/YouMind-OpenLab/awesome-nano-banana-pro-prompts",
        revision: HIGHLIGHT_REVISIONS.youmind,
        license: "CC BY 4.0",
        notice: "图片提示词与配图来自 YouMind OpenLab 的 awesome-nano-banana-pro-prompts 与 awesome-gpt-image-2 两个姊妹库（Nano Banana Pro / GPT Image 2 中文提示词），部分提示词经中文翻译改编，按 CC BY 4.0 署名使用。作者署名取条目内置的 author 字段。配图为原提示词的生成示例，不代表本平台生成结果。",
    },
};

export function inspirationSourceOf(item: CreationInspiration): InspirationSourceInfo {
    return inspirationSources[item.sourceId ?? "original"];
}

/**
 * 灵感条目。
 * 已收录案例使用稳定 ID。没有 ID 的历史条目由 catalogIdOf 按来源和标题计算收藏与隐藏键。
 */
export type CreationInspiration = {
    id?: string;
    title: string;
    description: string;
    image: string;
    mode: CreationMode;
    prompt: string;
    /** 自定义双语条目的中文正文；内置目录已将中文统一存入 prompt。 */
    promptZh?: string;
    /** 上游分类 id，标签表见 public/inspirations/manifest.json。 */
    category?: string;
    tags?: string[];
    /** 画面比例，例如 "4:5"；上游有才带。 */
    ratio?: string;
    featured?: boolean;
    /** 来源归属；缺省视为本项目原创。 */
    sourceId?: InspirationSourceId;
    /** 署名，例如外部案例的作者或提示词角色名。 */
    credit?: string;
    /** 回到上游原页的链接。 */
    sourceUrl?: string;
    /** 灵感上新的首次收录时间（ISO）；只有后端定时同步的条目才有。 */
    addedAt?: string;
    /** 上游发布时间（ISO），用于同一批上新内部排序。 */
    publishedAt?: string;
};

/** 条目在本地存储里的稳定键。 */
export function catalogIdOf(item: CreationInspiration): string {
    return item.id ?? `${item.sourceId ?? "original"}:${item.title}`;
}

/** 需要对外声明的来源（原创不写声明），供页面署名与合规展示复用。 */
export function declaredInspirationSources(): InspirationSourceInfo[] {
    return Object.values(inspirationSources).filter((source) => source.notice);
}
