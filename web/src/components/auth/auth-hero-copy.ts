import { interfaceText } from "@/i18n/interface-text";
import type { PublicAppearance } from "@/services/api/appearance";
import { DEFAULT_PUBLIC_APPEARANCE } from "@/stores/use-appearance-store";

export function authHeroCopy(appearance: PublicAppearance) {
    const { authHeroTitle, authHeroDescription } = appearance;
    return {
        title: authHeroTitle === DEFAULT_PUBLIC_APPEARANCE.authHeroTitle ? interfaceText("让创意成为电影故事。") : authHeroTitle,
        description: authHeroDescription === DEFAULT_PUBLIC_APPEARANCE.authHeroDescription ? interfaceText("用于视频、图像和多媒体叙事的一站式 AI 创作工作台。") : authHeroDescription,
    };
}
