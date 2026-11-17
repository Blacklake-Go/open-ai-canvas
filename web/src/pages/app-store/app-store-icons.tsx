import React from "react";
import {
    Blocks,
    Bot,
    Box,
    Clapperboard,
    FileText,
    FolderGit2,
    Image as ImageIcon,
    Images,
    LayoutGrid,
    Layers,
    LibraryBig,
    Lightbulb,
    Megaphone,
    Music,
    PanelsTopLeft,
    PenTool,
    Share2,
    ShoppingBag,
    Sliders,
    Sparkles,
    UserRound,
    Video,
    type LucideIcon,
} from "lucide-react";

/**
 * 主站侧栏图标语言：单色浅灰、线性描边、无彩色填充与光晕。
 * 这里按应用语义把名称 / slug 映射到统一的 Lucide 线性图标，
 * 供 App Store 与 TapTV 的所有「图标位」共用，避免散落彩色 3D 摄影图。
 */
const ICON_RULES: { keys: string[]; Icon: LucideIcon }[] = [
    { keys: ["短剧", "影视", "电影", "分镜", "剧本", "故事板", "drama", "film", "previs", "storyboard", "cinema", "deep-film", "wuxia"], Icon: Clapperboard },
    { keys: ["声音", "语音", "配音", "音乐", "播客", "音频", "演播", "配乐", "voice", "audio", "music", "podcast", "fish-audio", "audiobook", "dual-host"], Icon: Music },
    { keys: ["角色", "人物", "主角", "数字人", "演员", "面部", "casting", "character", "face", "digital-human", "avatar", "hanfu"], Icon: UserRound },
    { keys: ["3d", "三维", "建模", "模型", "几何", "空间", "造景", "白模", "model", "nerf", "scene", "photo-world", "fantasy-3d"], Icon: Box },
    { keys: ["电商", "商品", "购物", "上架", "包装", "店铺", "ecommerce", "shop", "product", "商城", "neo-chinese"], Icon: ShoppingBag },
    { keys: ["动效", "动画", "文字视频", "kinetic", "motion", "animation", "icon-animation", "three-d"], Icon: Sparkles },
    { keys: ["设计", "品牌", "海报", "排版", "logo", "brand", "design", "poster", "visualize", "typography", "woodcut"], Icon: PenTool },
    { keys: ["视频", "运镜", "镜头", "机位", "插帧", "video", "seedance", "kling", "minimax", "runway", "luma", "sora", "vimeo", "frame-io"], Icon: Video },
    { keys: ["图片", "图像", "超分", "画质", "升格", "image", "photo", "unsplash", "gpt-image", "nano-banana"], Icon: ImageIcon },
    { keys: ["提示词", "法则", "技能", "skill", "prompt", "算子", "指南", "guide", "原基", "creator", "origin-basis"], Icon: LibraryBig },
    { keys: ["灵感", "头脑风暴", "创意", "brainstorm", "idea", "inspiration", "hook", "surreal"], Icon: Lightbulb },
    { keys: ["网页", "画布", "交互", "游戏", "web", "canvas", "game", "3d-interactive", "sketch-game"], Icon: PanelsTopLeft },
    { keys: ["广告", "营销", "转化", "ad-", "ads", "marketing", "localization", "yt-brand", "brand-video"], Icon: Megaphone },
    { keys: ["社媒", "社交", "跨平台", "instagram", "tiktok", "linkedin", "social", "broadcast", "twitter", "cross-platform"], Icon: Share2 },
    { keys: ["编排", "工作流", "拓扑", "组合", "forge", "builder", "pipeline", "hubspot", "airtable", "atlassian", "asana", "linear", "slack", "notion", "feishu", "lark"], Icon: Blocks },
    { keys: ["文档", "脚本", "章节", "小说", "新闻", "科普", "knowledge", "explain", "news", "real-estate", "房产", "带看", "real-physics"], Icon: FileText },
    { keys: ["智能体", "agent", "bot", "自动化", "decode", "exec-path"], Icon: Bot },
    { keys: ["生成式", "艺术", "算法", "generative", "art"], Icon: Images },
    { keys: ["数据", "表格", "协同", "table", "database"], Icon: Layers },
    { keys: ["实验室", "lab", "物理", "physics", "真实法则"], Icon: Sliders },
    { keys: ["定价", "价格", "积分", "pricing"], Icon: FolderGit2 },
];

/** 语义解析：返回统一风格的 Lucide 线性图标组件。 */
export function resolveAppIcon(name: string, slug?: string, type?: "app" | "skill"): LucideIcon {
    const key = `${name} ${slug ?? ""}`.toLowerCase();
    for (const rule of ICON_RULES) {
        if (rule.keys.some((k) => key.includes(k))) return rule.Icon;
    }
    return type === "skill" ? LibraryBig : LayoutGrid;
}

/**
 * 统一图标位：深灰圆角方盒 + 居中单色浅灰线性图标。
 * 描边宽度与主站侧栏一致（2.2），不引入彩色、渐变、3D 或摄影贴图。
 */
export const RenderAppIcon: React.FC<{
    name: string;
    slug?: string;
    type?: "app" | "skill";
    size?: "sm" | "md";
}> = ({ name, slug, type, size = "sm" }) => {
    const Icon = resolveAppIcon(name, slug, type);
    const isSm = size === "sm";
    return (
        <span className={`relative inline-flex shrink-0 items-center justify-center ${isSm ? "size-8 rounded-[8px]" : "size-11 rounded-[11px]"} bg-white/[0.05] border border-white/[0.08] text-zinc-300 select-none`} aria-hidden="true">
            <Icon className={isSm ? "size-4" : "size-5"} strokeWidth={2.2} />
        </span>
    );
};

// 能力预览等「内容大图」仍使用本地影视风格资源；这里只提供稳定的占位选择，
// 不作为 UI 图标使用，保持与「图标统一为灰色线性」的边界清晰。
const PREVIEW_IMAGES = [
    "/short-drama-styles/wuxia-swordsman.jpg",
    "/short-drama-styles/future-tech.jpg",
    "/short-drama-styles/cg-realistic.jpg",
    "/short-drama-styles/cyberpunk-neon.jpg",
    "/short-drama-styles/palace-hanfu.jpg",
    "/short-drama-styles/retro-film.jpg",
    "/short-drama-styles/fantasy-3d.jpg",
    "/short-drama-styles/space-opera.jpg",
];

export function getAppPreviewImage(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = (hash << 5) - hash + name.charCodeAt(i);
        hash |= 0;
    }
    return PREVIEW_IMAGES[Math.abs(hash) % PREVIEW_IMAGES.length];
}
