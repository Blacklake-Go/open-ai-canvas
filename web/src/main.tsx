import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import { reportStartupLoadFailure } from "@/lib/chunk-recovery";
import { isIsolatedPrevisRepro } from "@/lib/dev-repro";
import { withModuleLoadPriority } from "@/lib/module-preload";
import { prepareStartupInterface } from "virtual:supdance-interface:common";

const pathname = window.location.pathname;
const startupPriority = { foreground: true, useNativePreloads: true };

const startupTranslations = withModuleLoadPriority(startupPriority, prepareStartupInterface);
void startupTranslations
    .then(() => withModuleLoadPriority(startupPriority, () => (/^\/welcome\/?$/.test(pathname) ? import("./welcome-application") : import("./application"))))
    .then(({ startApplication }) => startApplication())
    .catch(reportStartupLoadFailure);

// Start appearance loading in parallel, without putting its dependency graph in the HTML entry.
if (!isIsolatedPrevisRepro(import.meta.env.DEV, pathname)) {
    void startupTranslations
        .then(() => withModuleLoadPriority(startupPriority, () => import("@/services/appearance-bootstrap")))
        .then(({ bootstrapAppearance }) => bootstrapAppearance())
        .catch(() => undefined);
}
