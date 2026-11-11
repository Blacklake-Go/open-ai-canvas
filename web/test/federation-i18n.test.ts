import { expect, test } from "bun:test";
test("real ONE identity page resolves extension labels and admin overrides", () => {
    const result = Bun.spawnSync([process.execPath, "test", "./test/fixtures/federation-i18n.harness.tsx"], { cwd: process.cwd(), stdout: "pipe", stderr: "pipe" });
    if (result.exitCode !== 0) console.error(new TextDecoder().decode(result.stdout) + new TextDecoder().decode(result.stderr));
    expect(result.exitCode).toBe(0);
}, 20000);
