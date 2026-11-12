import { expect, test } from "bun:test";
import { resolve } from "node:path";

test("music prompt overlays retain their host scope and apply user text", () => {
    const result = Bun.spawnSync([process.execPath, "test", "./test/fixtures/music-theme-overlays.harness.tsx"], { cwd: resolve(import.meta.dir, ".."), stdout: "pipe", stderr: "pipe" });
    if (result.exitCode) console.error(result.stdout.toString(), result.stderr.toString());
    expect(result.exitCode).toBe(0);
}, 30_000);
