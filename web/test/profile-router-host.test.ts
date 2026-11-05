import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("router-dependent account windows are not mounted outside RouterProvider", () => {
    const providers = readFileSync(resolve(import.meta.dir, "../src/components/layout/app-providers.tsx"), "utf8");
    expect(providers).not.toContain("<UserProfileModalHost />");
});

test("real account profile panes receive router context and retain their window across navigation", () => {
    const result = Bun.spawnSync([process.execPath, "test", "./test/fixtures/profile-router-host.harness.tsx"], { cwd: resolve(import.meta.dir, ".."), stdout: "pipe", stderr: "pipe" });
    if (result.exitCode) console.error(result.stdout.toString(), result.stderr.toString());
    expect(result.exitCode).toBe(0);
}, 30_000);
