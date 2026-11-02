export const MOTION_DURATIONS = {
    quick: 0.15,          // 150ms
    dropdownEnter: 0.20,  // 200ms
    dropdownExit: 0.15,   // 150ms
    modal: 0.20,          // 200ms
    drawer: 0.25,         // 250ms
    tabSwitch: 0.20,      // 200ms
} as const;

export const MOTION_EASINGS = {
    standard: [0.16, 1, 0.3, 1] as const,     // cubic-bezier(0.16, 1, 0.3, 1)
    bounce: [0.34, 1.56, 0.64, 1] as const,   // 微弹性
    smooth: [0.4, 0, 0.2, 1] as const,        // 标准 Material/Apple 平滑缓动
    sharp: [0.4, 0, 0.6, 1] as const,         // 退出锐利收缩
} as const;

export const MOTION_SPRINGS = {
    snappy: { type: "spring", stiffness: 450, damping: 30 },
    gentle: { type: "spring", stiffness: 280, damping: 24 },
    wobbly: { type: "spring", stiffness: 350, damping: 18 },
} as const;
