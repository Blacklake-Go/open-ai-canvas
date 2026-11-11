import { expect, test } from "bun:test";
import { resolve } from "node:path";

test("music wallet integration uses the actual shared query and account isolation", () => {
    const result = Bun.spawnSync([process.execPath, "test", "./test/fixtures/music-wallet-sync.harness.tsx"], {
        cwd: resolve(import.meta.dir, ".."),
        stdout: "pipe",
        stderr: "pipe",
    });
    if (result.exitCode) console.error(result.stdout.toString(), result.stderr.toString());
    expect(result.exitCode).toBe(0);
}, 30_000);
