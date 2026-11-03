import { getRegisteredPlugin } from "@/lib/plugins/plugin-registry";
import { registerSupDancePlugin, unregisterSupDancePlugin } from "@/supdance/adapters/compatibility";
import { supdanceVisualEnginePlugin } from "../index";

export function synchronizeVisualEngineRegistration(installed: boolean) {
    if (!installed) {
        unregisterSupDancePlugin(supdanceVisualEnginePlugin.manifest.id);
        return;
    }
    if (!getRegisteredPlugin(supdanceVisualEnginePlugin.manifest.id)) registerSupDancePlugin(supdanceVisualEnginePlugin);
}
