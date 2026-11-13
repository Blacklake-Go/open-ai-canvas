import { expect, test } from "bun:test";
import { resolve } from "node:path";

test("the build compiler preserves UI and business-data boundaries", () => {
    // Babel installs Node-specific stack helpers; isolate it from browser API mocks.
    const result = Bun.spawnSync([process.execPath, "test", "./test/fixtures/i18n-static-ui.harness.ts"], { cwd: resolve(import.meta.dir, ".."), stdout: "pipe", stderr: "pipe" });
    if (result.exitCode) console.error(result.stdout.toString(), result.stderr.toString());
    expect(result.exitCode).toBe(0);
});

test("compiled interface copy reacts to real i18next publications", () => {
    const result = Bun.spawnSync([process.execPath, "test", "./test/fixtures/i18n-static-runtime.harness.tsx"], { cwd: resolve(import.meta.dir, ".."), stdout: "pipe", stderr: "pipe" });
    if (result.exitCode) console.error(result.stdout.toString(), result.stderr.toString());
    expect(result.exitCode).toBe(0);
});
