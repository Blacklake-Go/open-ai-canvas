import { expect, test } from "bun:test";
import { resolve } from "node:path";

// Let the child reach its own deadline and report a useful failure first.
test("Agent question lifecycle in its browser realm", () => {
    // Motion detects the browser at import time. Keep this DOM and its module cache out of the SSR suite.
    const result = Bun.spawnSync([process.execPath, "test", "./test/fixtures/agent-question-lifecycle.harness.tsx"], { cwd: resolve(import.meta.dir, ".."), timeout: 20000 });
    expect(result.exitCode, result.stderr.toString()).toBe(0);
}, 25000);
