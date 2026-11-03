import type { TransitionConfig } from "../types";

export function transitionFrames(config: TransitionConfig, reduced: boolean): Keyframe[] {
    const start: Keyframe = { opacity: config.opacity };
    if (!reduced && config.preset === "slide") start.transform = `translateY(${config.distance * (config.direction === "backward" ? -1 : 1)}px)`;
    if (!reduced && config.preset === "scale") start.transform = `scale(${config.scale})`;
    return [start, { opacity: 1, transform: "none" }];
}
export function playRouteTransition(target: HTMLElement, config: TransitionConfig, reduced: boolean, easing: string) {
    if (!config.enabled || typeof target.animate !== "function") return () => {};
    let animation: Animation;
    try {
        animation = target.animate(transitionFrames(config, reduced), { duration: reduced ? Math.min(config.duration, 100) : config.duration, delay: reduced ? 0 : config.delay, easing, fill: "none" });
    } catch {
        return () => {};
    }
    return () => animation.cancel();
}
