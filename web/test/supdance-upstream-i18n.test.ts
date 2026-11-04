import { expect, test } from "bun:test";
import { resolve } from "node:path";

test("上游文案使用插件语言、管理员词条与停用回退", () => {
    const result = Bun.spawnSync([process.execPath, "test", "./test/fixtures/supdance-upstream-i18n.harness.tsx"], { cwd: resolve(import.meta.dir, ".."), timeout: 30000 });
    const output = new TextDecoder().decode(result.stdout) + new TextDecoder().decode(result.stderr);
    expect(result.exitCode, output).toBe(0);
}, 40000);
