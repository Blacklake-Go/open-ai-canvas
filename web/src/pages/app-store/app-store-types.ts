export type AppCategory = "全部" | "应用" | "官方技能" | "品牌设计" | "影视创意" | "广告" | "电商" | "互动游戏" | "社媒内容";

export interface AppStoreItem {
    id: string;
    name: string;
    slug?: string;
    description: string;
    categories: AppCategory[];
    type: "app" | "skill";
    hasDetail?: boolean;
    badge?: string;
    author?: string;
    isHot?: boolean;
    isNew?: boolean;
    isFeatured?: boolean;
}

export interface CarouselSlide {
    id: string;
    title: string;
    subtitle: string;
    badge: string;
    bgImage: string;
    appSlug?: string;
    targetName?: string;
}

export interface HotUseCase {
    id: string;
    title: string;
    subtitle: string;
    category: string;
    appSlug?: string;
    badge?: string;
}

export interface AppDetailSpec {
    id: string;
    name: string;
    subtitle: string;
    tags: string[];
    heroImage?: string;
    previewTitle: string;
    previewDescription: string;
    previewTabs: {
        id: string;
        label: string;
        title: string;
        description: string;
        imageUrl?: string;
        tag?: string;
    }[];
    starters: {
        id: string;
        title: string;
        category: string;
        description: string;
    }[];
    sections: {
        title: string;
        items: string[];
    }[];
    sidebarCta: string;
    primaryActionText: string;
    primaryActionUrl?: string;
}
