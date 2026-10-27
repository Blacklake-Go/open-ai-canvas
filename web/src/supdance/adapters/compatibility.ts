// SupDance 兼容层适配器与上游补丁注册表。
//
// 所有对上游核心源码的不可避免接触点、路由扩展、插件能力映射均在此登记，
// 以便每次上游升级时自动化测试与同步脚本能够精确定位耦合点。

import type { RouteObject } from "react-router";
import type { PluginManifest, PluginManifestV2, RegisteredPlugin } from "@/lib/plugins/plugin-types";
import { getRegisteredPlugin, registerPlugin, unregisterPlugin } from "@/lib/plugins/plugin-registry";

export type UpstreamPatchRecord = {
    id: string;
    upstreamBaseline: string;
    feature: string;
    files: readonly string[];
    reason: string;
    upgradeRisk: "LOW" | "MEDIUM" | "HIGH";
};

/**
 * 当前已登记的不可避免上游核心文件补丁清单。
 * 新增核心文件修改时必须同步登记，并由架构回归测试校验。
 */
export const SUPDANCE_UPSTREAM_PATCH_REGISTRY: readonly UpstreamPatchRecord[] = [
    {
        id: "supdance-codex-agent-connector",
        upstreamBaseline: "v1.7.1",
        feature: "本机 SupDance Canvas Agent (Codex) 连接器发现、配对、SSE 与对话转发",
        files: [
            "web/src/components/canvas/canvas-cloud-agent-connectors.css",
            "web/src/components/canvas/canvas-cloud-agent-connectors.tsx",
            "web/src/components/canvas/canvas-cloud-agent-panel.tsx",
            "web/src/components/canvas/use-codex-connector.ts",
            "web/src/services/api/codex-connector.ts",
        ],
        reason: "在画布底部 Agent 连接器栏挂载本机 Codex 协作入口与状态机，同时保留上游云端 Agent 撤回插话、后台标签页不轮询等原生行为。",
        upgradeRisk: "MEDIUM",
    },
] as const;

export const SUPDANCE_RESERVED_PLUGIN_PREFIX = "supdance-" as const;

export type SupDancePluginCompatibilityReport = {
    compatible: boolean;
    pluginId: string;
    version: string;
    apiVersion: string;
    errors: string[];
};

/**
 * 校验 SupDance 自定义插件清单是否满足宿主契约与命名空间隔离规则。
 */
export function validateSupDancePluginManifest(manifest: PluginManifest | PluginManifestV2, existingIds: ReadonlySet<string> = new Set()): SupDancePluginCompatibilityReport {
    const errors: string[] = [];
    if (!manifest.id.startsWith(SUPDANCE_RESERVED_PLUGIN_PREFIX)) {
        errors.push(`SupDance 自定义插件 ID 必须以 "${SUPDANCE_RESERVED_PLUGIN_PREFIX}" 开头（当前：${manifest.id}）`);
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(manifest.id)) {
        errors.push("插件 ID 必须符合小写 kebab-case 规范");
    }
    if (existingIds.has(manifest.id)) {
        errors.push(`插件 ID "${manifest.id}" 与现有插件冲突`);
    }
    const rawApiVersion = String((manifest as { apiVersion?: unknown }).apiVersion ?? "");
    if (rawApiVersion !== "yingce.plugin/v1" && rawApiVersion !== "yingce.plugin/v2") {
        errors.push(`不支持的宿主 apiVersion：${rawApiVersion}`);
    }
    if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(manifest.version)) {
        errors.push(`插件版本号 "${manifest.version}" 必须遵循 SemVer`);
    }
    if (new Set(manifest.permissions).size !== manifest.permissions.length) {
        errors.push("插件权限声明包含重复项");
    }
    return {
        compatible: errors.length === 0,
        pluginId: manifest.id,
        version: manifest.version,
        apiVersion: manifest.apiVersion,
        errors,
    };
}

/**
 * 安全注册 SupDance 插件：先做命名空间与兼容性校验，再委托给宿主 registerPlugin。
 */
export function registerSupDancePlugin(plugin: RegisteredPlugin): void {
    const existing = getRegisteredPlugin(plugin.manifest.id);
    const conflictSet = new Set<string>();
    if (existing && existing.manifest.version !== plugin.manifest.version) {
        conflictSet.add(plugin.manifest.id);
    }
    const report = validateSupDancePluginManifest(plugin.manifest, conflictSet);
    if (!report.compatible) {
        throw new Error(`SupDance 插件兼容性校验失败（${plugin.manifest.id}）：${report.errors.join("；")}`);
    }
    registerPlugin(plugin);
}

export function unregisterSupDancePlugin(pluginId: string): void {
    unregisterPlugin(pluginId);
}

/**
 * 校验并合并 SupDance 扩展路由，防止自定义路由意外覆盖上游既有路由。
 */
export function mergeSupDanceRoutes(upstreamRoutes: readonly RouteObject[], supdanceRoutes: readonly RouteObject[]): RouteObject[] {
    const collectPaths = (routes: readonly RouteObject[], prefix = ""): Set<string> => {
        const set = new Set<string>();
        for (const route of routes) {
            const currentPath = route.path ? (route.path.startsWith("/") ? route.path : `${prefix}/${route.path}`.replace(/\/+/g, "/")) : prefix;
            if (route.path) set.add(currentPath);
            if (route.children?.length) {
                for (const childPath of collectPaths(route.children, currentPath)) {
                    set.add(childPath);
                }
            }
        }
        return set;
    };

    const existingPaths = collectPaths(upstreamRoutes);
    for (const route of supdanceRoutes) {
        if (route.path && existingPaths.has(route.path)) {
            throw new Error(`SupDance 扩展路由 "${route.path}" 与上游路由冲突，禁止覆盖上游核心路径`);
        }
    }
    return [...upstreamRoutes, ...supdanceRoutes];
}
