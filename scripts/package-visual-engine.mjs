import { mkdtemp, mkdir, cp, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
const root=resolve(import.meta.dirname,".."),output=resolve(process.argv[2]||".local/visual-engine-delivery");
await mkdir(output,{recursive:true});
const temporary=await mkdtemp(join(tmpdir(),"supdance-visual-engine-"));
const bundle=join(temporary,"supdance-visual-engine");await mkdir(bundle);
const sources={"web/src/supdance/plugins/visual-engine":"frontend","backend/internal/supdance/visualengine":"backend","supdance/plugins/supdance-visual-engine/manifest.json":"manifest.json","scripts/visual-engine-plugin.mjs":"tools/visual-engine-plugin.mjs","docs/supdance/visual-engine":"docs"};
for(const [from,to] of Object.entries(sources)){await mkdir(resolve(bundle,to,".."),{recursive:true});await cp(resolve(root,from),resolve(bundle,to),{recursive:true});}
const adapters=["web/src/lib/canvas-theme.ts","web/src/stores/canvas/use-canvas-theme-store.ts","web/src/lib/theme-extensions.ts","web/src/lib/overlay-extensions.ts","web/src/supdance/adapters/compatibility.ts","web/src/supdance/registry/index.ts","web/src/application.tsx","web/src/components/auth/auth-session-hydrator.tsx","web/src/components/layout/app-providers.tsx","web/src/components/ui/product/app-modal/app-modal.tsx","web/src/components/ui/product/app-drawer/app-drawer.tsx","web/src/layouts/user-layout.tsx","web/src/lib/skin-themes.ts","web/src/pages/admin/components/admin-shell.tsx","web/src/pages/admin/plugins/plugins-page.tsx","web/src/router.tsx","web/src/services/diagnostics/client-diagnostics.ts","backend/internal/app/plugin_management.go","backend/internal/app/supdance_visual_engine_plugin.go","backend/internal/app/supdance_visual_engine_management.go","backend/internal/handler/api.go","backend/internal/handler/supdance_visual_engine.go","backend/internal/repository/visual_engine.go"];
for(const path of adapters){const destination=join(bundle,"host-adapters",path);await mkdir(resolve(destination,".."),{recursive:true});await cp(join(root,path),destination);}
const commit=execFileSync("git",["rev-parse","HEAD"],{cwd:root,encoding:"utf8"}).trim();
await writeFile(join(bundle,"release.json"),JSON.stringify({pluginVersion:"2.0.1",schemaVersion:2,hostVersion:(await readFile(join(root,"VERSION"),"utf8")).trim(),commit,distribution:"bundled-host-module",managementEntry:"/admin/plugins",console:"/admin/plugins/visual-engine"},null,2));
const archive=join(output,"supdance-visual-engine-2.0.1.tar.gz");
execFileSync("tar",["-czf",archive,"-C",temporary,"supdance-visual-engine"]);
const bytes=await readFile(archive);await writeFile(join(output,"SHA256SUMS"),createHash("sha256").update(bytes).digest("hex")+"  "+archive.split("/").at(-1)+"\n");
console.log(JSON.stringify({archive,bytes:bytes.length,commit}));

