import { expect, test } from "bun:test";
import { resolve } from "node:path";

test("上游六语言偏好独立生效且不被旧插件覆写", () => {
    const result = Bun.spawnSync([process.execPath, "test", "./test/fixtures/supdance-upstream-i18n.harness.tsx"], { cwd: resolve(import.meta.dir, ".."), timeout: 30000 });
    const output = new TextDecoder().decode(result.stdout) + new TextDecoder().decode(result.stderr);
    expect(result.exitCode, output).toBe(0);
}, 40000);
