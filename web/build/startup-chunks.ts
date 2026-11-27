import type { Plugin } from "vite";

const homeModulePaths = ["/src/application.tsx", "/src/layouts/user-layout.tsx", "/src/pages/create/index.tsx"];

/** Keep the startup dependency graph together without pulling in lazy routes. */
export function startupChunks(): Plugin {
    const startupModules = new Set<string>();
    const entryModules = new Set<string>();
    return {
        name: "canvas-startup-chunks",
        apply: "build",
        buildEnd(error) {
            if (error) return;
            const visit = (id: string, target: Set<string>) => {
                if (target.has(id)) return;
                target.add(id);
                const info = this.getModuleInfo(id);
                for (const dependency of info?.importedIds || []) visit(dependency, target);
            };
            for (const id of this.getModuleIds()) {
                if (/[\\/]src[\\/]main\.tsx$/.test(id)) visit(id, entryModules);
                if (/[\\/]src[\\/]application\.tsx$/.test(id)) visit(id, startupModules);
            }
        },
        outputOptions(options) {
            const splitting = typeof options.codeSplitting === "object" ? options.codeSplitting : {};
            return {
                ...options,
                codeSplitting: {
                    ...splitting,
                    groups: [
                        ...(splitting.groups || []),
                        {
                            name: "app-bootstrap",
                            test: (id) => startupModules.has(id) && !entryModules.has(id),
                            // Dedicated framework groups remain authoritative.
                            priority: 5,
                            minSize: 0,
                            includeDependenciesRecursively: false,
                        },
                    ],
                },
            };
        },
        transformIndexHtml: {
            order: "post",
            handler(_html, { bundle }) {
                if (!bundle) return;
                const entryChunks = Object.values(bundle).filter(
                    (chunk) => chunk.type === "chunk" && chunk.facadeModuleId && homeModulePaths.some((path) => chunk.facadeModuleId?.replaceAll("\\", "/").endsWith(path)),
                );
                const hints = new Set<string>();
                for (const chunk of entryChunks) {
                    if (chunk.type !== "chunk") continue;
                    hints.add(chunk.fileName);
                    for (const dependency of chunk.imports) {
                        if (/^assets\/(app-bootstrap|vendor-antd)\b/.test(dependency)) hints.add(dependency);
                    }
                }
                if (!hints.size) return;
                return [
                    {
                        tag: "script",
                        injectTo: "head",
                        children: `if (location.pathname === "/" || location.pathname === "/create") {
                            for (const path of ${JSON.stringify([...hints])}) {
                                const link = document.createElement("link");
                                link.rel = "modulepreload";
                                link.crossOrigin = "";
                                link.href = "/" + path;
                                document.head.append(link);
                            }
                        }`,
                    },
                ];
            },
        },
    };
}
