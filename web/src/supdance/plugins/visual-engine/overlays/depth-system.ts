import type { ElevationLevel, ElevationToken } from "../types";

export const ELEVATION_Z_INDEX_MAP: Record<ElevationLevel, number> = {
    E0: 0,
    E1: 10,   // 工具栏 / 播放器
    E2: 100,  // 下拉 / 气泡菜单
    E3: 1000, // 模态弹窗 / 抽屉
    E4: 2000, // 全局置顶 / 拖拽幽灵元素
};

export function getElevationStyle(
    level: ElevationLevel,
    elevations: Record<ElevationLevel, ElevationToken>,
    mode: "light" | "dark",
): {
    boxShadow: string;
    zIndex: number;
    transition: string;
} {
    const token = elevations[level];
    const shadow = mode === "light" ? token.shadowLight : token.shadowDark;
    return {
        boxShadow: shadow,
        zIndex: ELEVATION_Z_INDEX_MAP[level],
        transition: "box-shadow 0.2s cubic-bezier(0.16, 1, 0.3, 1), transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
    };
}
