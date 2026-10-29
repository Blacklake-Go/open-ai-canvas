export const SUPDANCE_MUSIC_PLUGIN_ID = "supdance-music-generation" as const;
export const SUPDANCE_MUSIC_PLUGIN_ALIAS = "music-generation" as const;

export type SupDanceMusicLifecycleState =
    | "installed"
    | "enabled"
    | "draining"
    | "disabled"
    | "updating"
    | "error"
    | "uninstalled";

export type SupDanceMusicPluginStatus = {
    pluginId: string;
    lifecycleState: SupDanceMusicLifecycleState;
    platformAvailable: boolean;
    userEnabled: boolean;
    effectiveEnabled: boolean;
    activeTasks: number;
    isDraining: boolean;
    version: string;
};
