import { expect, test, describe } from "bun:test";
import { workspaceRoutePages, preloadWorkspaceRoute } from "../src/lib/workspace-route-modules";
import { prepareBackendGenerationTask, runBackendGenerationTask, submitBackendGenerationTask, runBackendGenerationTaskBatch } from "../src/services/api/generation-task";
import { resolveSiteTrafficPage } from "../src/lib/site-traffic";
import { clampComposerCount } from "../src/pages/workspace/image-workspace-composer";
import { defaultConfig, type AiConfig } from "../src/stores/use-config-store";

// 本文件只测真实导出实现；组件内部私有逻辑（IME Enter、批量聚合、快照合并）
// 由 image-workspace-results.test.ts / image-workspace-composer.test.ts 覆盖可导出部分，
// 其余属页面私有状态机，需真实浏览器验收，不再以抄写副本充当测试。

const dummyConfig = { ...defaultConfig, channels: [] } as AiConfig;

describe("图片工作台路由与任务入口（真实实现）", () => {
    test("workspaceRoutePages 注册 imageWorkspace 且可预加载", () => {
        expect(workspaceRoutePages.imageWorkspace).toBeDefined();
        expect(typeof workspaceRoutePages.imageWorkspace.preload).toBe("function");
    });

    test("preloadWorkspaceRoute 对 /workspace/image 预热 imageWorkspace 模块", async () => {
        const original = workspaceRoutePages.imageWorkspace.preload;
        let calls = 0;
        workspaceRoutePages.imageWorkspace.preload = (async () => {
            calls += 1;
            return original();
        }) as typeof original;
        try {
            preloadWorkspaceRoute("/workspace/image");
            preloadWorkspaceRoute("/workspace/image/c-abc123");
            expect(calls).toBe(2);
            preloadWorkspaceRoute("/workspace/video");
            expect(calls).toBe(2);
        } finally {
            workspaceRoutePages.imageWorkspace.preload = original;
        }
    });

    test("resolveSiteTrafficPage 把工作台会话路由归入 tools_image，未知路径不计", () => {
        expect(resolveSiteTrafficPage("/workspace/image")).toBe("tools_image");
        expect(resolveSiteTrafficPage("/workspace/image/c-abc123")).toBe("tools_image");
        expect(resolveSiteTrafficPage("/toolbox/image")).toBe("tools_image");
        expect(resolveSiteTrafficPage("/workspace/video")).toBeNull();
        expect(resolveSiteTrafficPage("/workspace/image/c-1/extra")).toBeNull();
    });

    test("prepareBackendGenerationTask 空提示词提前拒绝（图片模式）", async () => {
        await expect(prepareBackendGenerationTask({ mode: "image", prompt: "", config: dummyConfig })).rejects.toThrow();
        await expect(prepareBackendGenerationTask({ mode: "image", prompt: "   \t\n  ", config: dummyConfig })).rejects.toThrow();
    });

    test("run/submit/batch 入口与 prepare 一致拒绝空提示词", async () => {
        await expect(runBackendGenerationTask({ mode: "image", prompt: "", config: dummyConfig })).rejects.toThrow();
        await expect(submitBackendGenerationTask({ mode: "image", prompt: "  ", config: dummyConfig })).rejects.toThrow();
        await expect(runBackendGenerationTaskBatch({ mode: "image", prompt: "", config: dummyConfig, count: 2 })).rejects.toThrow();
    });

    test("视频与提示词模板任务豁免空提示词守卫（与后端语义一致）", async () => {
        // 豁免守卫后应走到后续校验（渠道未配置等），而不是提示词错误。
        const videoError = await runBackendGenerationTask({ mode: "video", prompt: "", config: dummyConfig }).catch((error: unknown) => error);
        expect(videoError).toBeInstanceOf(Error);
        expect((videoError as Error).message).not.toContain("提示词");
        const templateError = await submitBackendGenerationTask({
            mode: "text",
            prompt: "",
            config: dummyConfig,
            metadata: { promptTemplateOperation: "skill-draft" },
        }).catch((error: unknown) => error);
        expect(templateError).toBeInstanceOf(Error);
        expect((templateError as Error).message).not.toContain("提示词");
    });
});

describe("图片工作台参数合同（真实实现）", () => {
    test("clampComposerCount 按账号并发与硬上限 15 收敛", () => {
        expect(clampComposerCount(0, 4)).toBe(1);
        expect(clampComposerCount(-5, 4)).toBe(1);
        expect(clampComposerCount(3, 4)).toBe(3);
        expect(clampComposerCount(10, 4)).toBe(4);
        expect(clampComposerCount(99, 20)).toBe(15);
        expect(clampComposerCount(Number.NaN, 4)).toBe(1);
    });
});

describe("图片工作台路由门禁（源码结构回归，非运行验证）", () => {
    test("个人 /workspace/image 有 RequireAuth+RequireFeature，团队路由不再暴露图片工作台", async () => {
        const source = await Bun.file(new URL("../src/router.tsx", import.meta.url)).text();
        const personal = source.indexOf('path: "/workspace/image"');
        expect(personal).toBeGreaterThan(-1);
        const personalBlock = source.slice(personal, personal + 400);
        expect(personalBlock).toContain("RequireAuth");
        expect(personalBlock).toContain('feature="imageWorkbenchEnabled"');
        // 团队 children 内不得再注册 workspace/image（团队仅开放文本生成）。
        const teamSection = source.slice(source.indexOf('path: "/teams/:teamId"'), source.indexOf('path: "/skills"'));
        expect(teamSection).not.toContain('"workspace/image"');
    });

    test("AppTopNav 对 /workspace/image 隐藏全局导航（源码结构回归）", async () => {
        const source = await Bun.file(new URL("../src/components/layout/app-top-nav.tsx", import.meta.url)).text();
        expect(source).toContain(String.raw`/^\/workspace\/image(?:\/|$)/`);
    });
});
