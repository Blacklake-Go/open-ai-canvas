import { expect, test } from "bun:test";
import { resolve } from "node:path";
test("a failed server save cannot publish a local translation", () => {
    const result = Bun.spawnSync([process.execPath, "test", "./test/fixtures/i18n-admin-save.harness.tsx"], { cwd: resolve(import.meta.dir, ".."), stdout: "pipe", stderr: "pipe" });
    if (result.exitCode) console.error(result.stdout.toString(), result.stderr.toString());
    expect(result.exitCode).toBe(0);
}, 20000);
