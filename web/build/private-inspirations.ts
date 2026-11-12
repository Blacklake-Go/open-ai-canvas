import { rmSync } from "node:fs";
import { resolve } from "node:path";
import type { Plugin } from "vite";

// The source catalog remains versioned for internal review. Production serves
// approved entries through the backend; a Vite build must not publish raw packs.
export function privateInspirations(): Plugin {
    let outDir: string;
    return {
        name: "supdance-private-inspirations",
        apply: "build",
        configResolved(config) {
            outDir = resolve(config.root, config.build.outDir);
        },
        closeBundle() {
            for (const name of ["inspirations", "inspiration-thumbs"]) rmSync(resolve(outDir, name), { recursive: true, force: true });
        },
    };
}
