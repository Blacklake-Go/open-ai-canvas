import { expect, test } from "bun:test";
import { resolve } from "node:path";

test("Agent 长对话按需展开并保留全部历史", () => {
    const result = Bun.spawnSync([process.execPath, "test", "./test/fixtures/agent-conversation-pagination.harness.tsx"], { cwd: resolve(import.meta.dir, ".."), timeout: 20000 });
    const output = new TextDecoder().decode(result.stdout) + new TextDecoder().decode(result.stderr);
    expect(result.exitCode, output).toBe(0);
    expect(output).toContain("0 fail");
}, 30000);
