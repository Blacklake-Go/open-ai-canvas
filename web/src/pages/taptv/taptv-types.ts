export interface TapTvParameters {
    model: string;
    seed: number;
    steps: number;
    sampler: string;
    cfgScale: number;
    aspectRatio: string;
    videoUrl?: string;
    createdAt?: string;
}

export interface TapTvVideoItem {
    id: string;
    title: string;
    creator: string;
    creatorHandle: string;
    creatorAvatar: string;
    cover: string;
    duration: string;
    likes: number;
    stars: number;
    views: number;
    category: string;
    toolTag: string;
    badge?: string;
    cardStyle: "overlay" | "standard";
    synopsis: string;
    prompt: string;
    negativePrompt: string;
    parameters: TapTvParameters;
    canvasName?: string;
    canvasNodeCount?: number;
    videoUrl?: string;
    featured?: boolean;
    createdAt?: string;
}

export type TapTvViewFilter = "curated" | "following" | "trending" | "latest";

export type TapTvSortOption = "recommend" | "stars" | "likes" | "latest";

export type TapTvCategory = "全部" | "亚洲巅峰赛" | "动画黑客松" | "精选画布" | "新手必学" | "短剧" | "科幻未来" | "古风武侠" | "动画" | "叙事短片" | "MV" | "创意" | "电视广告" | "教程";
