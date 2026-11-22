import { expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const upstreamIdentity = /\bddcat(?:-ai|\d+)?\b/i;
const emailPattern = /[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi;
const contributorRoster = /README\.md|\bWelcomeContributorsCard\b|#contributors\b|assets\/user-/i;

test("public repository metadata uses the SupDance maintainer", () => {
    for (const path of ["README.md", "SECURITY.md", "CODE_OF_CONDUCT.md", ".github/ISSUE_TEMPLATE/config.yml"]) {
        const source = read(path);
        const emails = source.match(emailPattern) ?? [];
        expect(upstreamIdentity.test(source), path).toBe(false);
        expect(
            emails.every((email) => email.toLowerCase().endsWith("@supdance.com")),
            path,
        ).toBe(true);
    }
    expect(read("README.md")).toContain("本版本由 supdance 维护");
    expect(/^##\s+(贡献者与团队|貢獻者與團隊|世界引擎赞助用户|contributors and team)\s*$/im.test(read("README.md"))).toBe(false);
    expect(read("SECURITY.md")).toContain("support@supdance.com");
});

test("welcome source does not load upstream contributor data or avatars", () => {
    const welcome = "web/src/pages/welcome";
    const files = new Bun.Glob("**/*.{ts,tsx,css}").scanSync({ cwd: resolve(root, welcome) });
    for (const file of files) {
        const source = read(`${welcome}/${file}`);
        expect(upstreamIdentity.test(source) || contributorRoster.test(source), `${welcome}/${file}`).toBe(false);
    }
    expect(readdirSync(resolve(root, "assets")).some((file) => file.startsWith("user-"))).toBe(false);
});

test("welcome downloads the original MIT license and the release retains attribution", () => {
    expect(read("web/src/pages/welcome/index.tsx")).toContain("LICENSE?url&no-inline");
    expect(read("web/src/pages/welcome/index.tsx")).toContain('download="LICENSE.txt"');
    expect(read("LICENSE")).toContain("Copyright (c) 2026 ddcat and Open AI Canvas contributors");
    expect(read("LICENSE")).toContain("The above copyright notice and this permission notice shall be included in all");
    expect(read("NOTICE")).toContain("Copyright (C) 2026 ddcat and contributors");
});
