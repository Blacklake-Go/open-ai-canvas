import { ART_CRITIQUE_PLUGIN_ID } from "@/lib/art-critique/contracts";
import { EAGLE_PLUGIN_ID } from "@/lib/plugins/builtin/eagle";
import { PROMPT_OPTIMIZER_PLUGIN_ID } from "@/lib/plugins/builtin/prompt-optimizer";
import { RUNNINGHUB_PLUGIN_ID } from "@/lib/plugins/builtin/workflows";
import { SUPDANCE_I18N_PLUGIN_ID } from "@/supdance/plugins/i18n/types";
import { SUPDANCE_SOCIAL_AUTH_PLUGIN_ID } from "@/supdance/plugins/social-auth/types";

import { EDITOR_SHELL_PLUGIN_ID } from "./builtin/editor/editor-shell";

/**
 * 官方“应用型”插件清单：这些插件在管理页和插件中心按官方应用展示。
 */
export const OFFICIAL_APPLICATION_PLUGIN_IDS = [
    RUNNINGHUB_PLUGIN_ID,
    EAGLE_PLUGIN_ID,
    PROMPT_OPTIMIZER_PLUGIN_ID,
    ART_CRITIQUE_PLUGIN_ID,
    EDITOR_SHELL_PLUGIN_ID,
    "user-feedback",
] as const;

export const SUPDANCE_APPLICATION_PLUGIN_IDS = [
    SUPDANCE_I18N_PLUGIN_ID,
    SUPDANCE_SOCIAL_AUTH_PLUGIN_ID,
] as const;

const officialApplicationIdSet = new Set<string>(OFFICIAL_APPLICATION_PLUGIN_IDS);
const supdanceApplicationIdSet = new Set<string>(SUPDANCE_APPLICATION_PLUGIN_IDS);

/** 判断插件是否为官方应用型插件（用户可在插件页自主启停）。 */
export function isOfficialApplicationPluginId(pluginId: string) {
    return officialApplicationIdSet.has(pluginId) || supdanceApplicationIdSet.has(pluginId);
}
