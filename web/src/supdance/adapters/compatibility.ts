// SupDance 兼容层适配器与上游补丁注册表。
//
// 所有对上游核心源码的不可避免接触点、路由扩展、插件能力映射均在此登记，
// 以便每次上游升级时自动化测试与同步脚本能够精确定位耦合点。

import type { RouteObject } from "react-router";
import type { PluginHostContext, PluginManifest, PluginManifestV2, RegisteredPlugin } from "@/lib/plugins/plugin-types";
import { getRegisteredPlugin, registerPlugin, unregisterPlugin } from "@/lib/plugins/plugin-registry";

export const SUPDANCE_HOST_VERSION = "1.7.4" as const;
export const SUPDANCE_SCHEMA_BASELINE = 82 as const;

export type UpstreamPatchRecord = {
    id: string;
    upstreamBaseline: string;
    feature: string;
    coupledUpstreamFiles: readonly string[];
    files: readonly string[];
    reason: string;
    upgradeRisk: "LOW" | "MEDIUM" | "HIGH";
};

/**
 * 当前已登记的不可避免上游核心文件补丁清单。
 * 新增核心文件修改时必须同步登记，并由架构回归测试与 baseline.json 对齐校验。
 */
export const SUPDANCE_UPSTREAM_PATCH_REGISTRY: readonly UpstreamPatchRecord[] = [
    {
        id: "supdance-agent-snapshot-throttle",
        upstreamBaseline: "main@8de0a239",
        feature: "Agent 画布快照实际请求的最短刷新间隔",
        coupledUpstreamFiles: ["web/src/services/agent-canvas-sync.ts"],
        files: ["web/src/services/agent-canvas-sync.ts", "web/test/agent-canvas-sync.test.ts"],
        reason: "刷新函数同步准备之后再记录节流时间，避免准备耗时侵占实际请求之间的最短间隔；保留批量增量与单个在途请求约束。",
        upgradeRisk: "LOW",
    },
    {
        id: "supdance-agent-cancellation-cleanup",
        upstreamBaseline: "main@8de0a239",
        feature: "Agent 取消后的并发清理重试",
        coupledUpstreamFiles: ["backend/internal/app/cloud_agent_runtime_media.go"],
        files: ["backend/internal/app/cloud_agent_runtime_media.go", "backend/internal/app/cloud_agent_diagnostics_test.go"],
        reason: "取消意图持久化后，清理与调度器的 revision 冲突须重读重试，保留已提交媒体任务和幂等取消事件。",
        upgradeRisk: "MEDIUM",
    },
    {
        id: "supdance-music-original-asset-titles",
        upstreamBaseline: "v1.7.3.5",
        feature: "共享资产卡片和详情保留用户标题原文",
        coupledUpstreamFiles: ["web/src/pages/assets/asset-library-cards.tsx", "web/src/pages/assets/asset-library-panels.tsx"],
        files: ["web/src/pages/assets/asset-library-cards.tsx", "web/src/pages/assets/asset-library-panels.tsx"],
        reason: "阻止界面或浏览器的 DOM 翻译改写音乐及其他用户作品标题，不改变资产查询与操作。",
        upgradeRisk: "LOW",
    },
    {
        id: "supdance-music-player-docking",
        upstreamBaseline: "v1.7.3.5",
        feature: "宿主浮动助手避让音乐底部播放器",
        coupledUpstreamFiles: ["web/src/components/canvas/use-agent-launcher-position.ts", "web/src/lib/canvas/agent-launcher-position.ts"],
        files: ["web/src/components/canvas/use-agent-launcher-position.ts", "web/src/lib/canvas/agent-launcher-position.ts", "web/src/supdance/plugins/music-generation/components/waveform-player.tsx", "web/test/agent-launcher-position.test.mjs"],
        reason: "以通用底部工具栏标记及尺寸事件约束助手停靠，不导入音乐业务；保留用户拖拽与键盘控制。",
        upgradeRisk: "MEDIUM",
    },
    {
        id: "supdance-music-host-tasks",
        upstreamBaseline: "v1.7.3.5",
        feature: "音乐主站渠道、持久任务、归档和账务闭环",
        coupledUpstreamFiles: [
            "backend/internal/app/channel_models_test_call.go",
            "backend/internal/app/provider.go",
            "backend/internal/app/provider_audio.go",
            "backend/internal/app/provider_http_client.go",
            "backend/internal/app/provider_protocol.go",
            "backend/internal/app/provider_protocol_async.go",
            "backend/internal/app/provider_protocol_request.go",
            "backend/internal/app/task_creation.go",
            "backend/internal/app/task_media_assets.go",
            "backend/internal/app/task_worker.go",
            "web/src/components/layout/workspace-top-bar.tsx",
            "web/src/pages/admin/components/channel-model-editor.tsx",
            "web/src/pages/create/creation-workspace-messages.tsx",
            "web/src/pages/create/creation-workspace.tsx",
            "web/src/router.tsx",
            "web/src/stores/use-locale-store.ts",
        ],
        files: [
            "backend/internal/app/supdance_music_site.go",
            "backend/internal/app/supdance_music_reads.go",
            "backend/internal/app/supdance_music_recovery.go",
            "web/src/supdance/plugins/music-generation/services/music-site-api.ts",
            "plugin-packages/runninghub-standard/manifest.json",
        ],
        reason: "音乐业务保持 SupDance 模块隔离；宿主只扩展音频分离轮询、回执记录、稳定资产与既有模型测试入口。",
        upgradeRisk: "HIGH",
    },
    {
        id: "supdance-agent-history-pagination",
        upstreamBaseline: "v1.7.3.5",
        feature: "Agent 历史分页的多语言与设计令牌适配",
        coupledUpstreamFiles: ["web/src/components/canvas/canvas-cloud-agent-panel-parts.tsx", "web/src/components/canvas/canvas-cloud-agent.css"],
        files: ["web/src/components/canvas/canvas-cloud-agent-panel-parts.tsx", "web/src/components/canvas/canvas-cloud-agent.css"],
        reason: "复用 SupDance common.load_more 词条与现有令牌，保留上游按 80 段展开历史的性能修复。",
        upgradeRisk: "LOW",
    },
    {
        id: "supdance-upstream-stage2",
        upstreamBaseline: "v1.7.3.5",
        feature: "正式版隔离集成候选的电商侧栏准入与插件导航保留",
        coupledUpstreamFiles: ["web/src/components/layout/workspace-sidebar-nav.tsx"],
        files: ["web/src/components/layout/workspace-sidebar-nav.tsx", "web/test/music-hotplug-lifecycle.test.ts"],
        reason: "只参考 e1f8b8c9 的侧栏开关条件，使用现有 SupDance 词条，并保留音乐插件入口与登录守卫。",
        upgradeRisk: "MEDIUM",
    },
    {
        id: "supdance-codex-agent-connector",
        upstreamBaseline: "v1.7.3",
        feature: "本机 SupDance Canvas Agent (Codex) 连接器发现、配对、SSE 与对话转发",
        coupledUpstreamFiles: [
            "web/src/components/canvas/canvas-cloud-agent-connectors.css",
            "web/src/components/canvas/canvas-cloud-agent-connectors.tsx",
            "web/src/components/canvas/canvas-cloud-agent-panel.tsx",
            "web/src/components/canvas/canvas-cloud-agent-settings.tsx",
        ],
        files: [
            "web/src/components/canvas/canvas-cloud-agent-connectors.css",
            "web/src/components/canvas/canvas-cloud-agent-connectors.tsx",
            "web/src/components/canvas/canvas-cloud-agent-panel.tsx",
            "web/src/components/canvas/canvas-cloud-agent-settings.tsx",
            "web/src/components/canvas/use-codex-connector.ts",
            "web/src/services/api/codex-connector.ts",
        ],
        reason: "在 Agent 设置的工具与连接页挂载本机 Codex 协作入口与状态机，同时保留上游云端 Agent 队列、附件和插话行为。",
        upgradeRisk: "MEDIUM",
    },
    {
        id: "supdance-workspace-governance",
        upstreamBaseline: "v1.7.3",
        feature: "SupDance 二开文档放行规则与 AI 编程工作区索引入口",
        coupledUpstreamFiles: [".gitignore", "AGENTS.md"],
        files: [".gitignore", "AGENTS.md"],
        reason: "上游 .gitignore 默认忽略 docs/*，需最小化放行 !docs/supdance/ 并在 AGENTS.md 末尾追加文档入口指针。",
        upgradeRisk: "LOW",
    },
    {
        id: "supdance-i18n-plugin",
        upstreamBaseline: "v1.7.3",
        feature: "上游原生六语言与 SupDance 扩展词条：独立命名空间、共享语言菜单及后台词条编辑",
        coupledUpstreamFiles: [
            ".github/workflows/quality.yml",
            "web/src/pages/create/index.tsx",
            ".github/workflows/supdance-upstream-sync.yml",
            "scripts/verify-before-push.mjs",
            "web/package.json",
            "VERSION",
            "backend/internal/app/plugin_management.go",
            "backend/internal/handler/api.go",
            "web/src/lib/plugins/builtin/index.ts",
            "web/src/components/layout/app-changelog-dialog.tsx",
            "web/src/components/layout/app-changelog-modal.tsx",
            "web/src/components/layout/app-providers.tsx",
            "web/src/components/layout/site-compliance-footer.tsx",
            "web/src/components/layout/system-announcement-center.tsx",
            "web/src/components/layout/user-oss-settings-form.tsx",
            "web/src/components/layout/workspace-account-card.tsx",
            "web/src/components/layout/workspace-account-menu.tsx",
            "web/src/components/layout/workspace-sidebar-footer.tsx",
            "web/src/components/layout/workspace-sidebar-nav.tsx",
            "web/src/components/layout/workspace-top-bar.tsx",
            "web/src/components/layout/workspace-wallet-modal.tsx",
            "web/src/components/layout/workspace-wallet-topup.tsx",
            "web/src/pages/auth/auth-scene.tsx",
            "web/src/pages/auth/login.tsx",
            "web/src/pages/canvas/canvas-project-top-bar.tsx",
            "web/src/pages/admin/components/admin-shell.tsx",
            "web/src/pages/admin/plugins/plugins-page.tsx",
            "web/src/pages/settings/index.tsx",
            "web/src/pages/settings/model-default-grid.tsx",
            "web/src/pages/settings/profile-pane.tsx",
            "web/src/router.tsx",
        ],
        files: [
            "supdance/plugins/supdance-i18n/manifest.json",
            "backend/internal/supdance/i18n/types.go",
            "backend/internal/supdance/i18n/defaults.go",
            "backend/internal/supdance/i18n/manager.go",
            "backend/internal/supdance/i18n/workflow.go",
            "backend/internal/app/supdance_i18n_workflow.go",
            "web/scripts/i18n-scan.mjs",
            "web/scripts/i18n-draft.mjs",
            "backend/internal/app/supdance_i18n_plugin.go",
            "backend/internal/service/aliases_supdance.go",
            "backend/internal/handler/supdance_i18n.go",
            "web/src/supdance/plugins/i18n/index.ts",
            "web/src/supdance/plugins/i18n/types.ts",
            "web/src/supdance/plugins/i18n/api.ts",
            "web/src/supdance/plugins/i18n/store.ts",
            "web/src/supdance/adapters/upstream-i18n.ts",
            "web/src/supdance/plugins/i18n/locales/index.ts",
            "web/src/supdance/plugins/i18n/engine/translator.ts",
            "web/src/supdance/plugins/i18n/engine/dom-observer.ts",
            "web/src/supdance/plugins/i18n/engine/antd-locale.ts",
            "web/src/supdance/plugins/i18n/components/topbar-language-switcher.tsx",
            "web/src/supdance/plugins/i18n/components/i18n-runtime-host.tsx",
            "web/src/supdance/plugins/i18n/admin/i18n-settings-page.tsx",
            "web/src/supdance/plugins/i18n/admin/i18n-entries-page.tsx",
        ],
        reason: "上游原生语言菜单、设备偏好与 AntD locale 接管界面；保留扩展词条 namespace 与审核发布接口，停止 DOM 翻译和上游词条覆盖。",
        upgradeRisk: "LOW",
    },
    {
        id: "supdance-native-auth-social-entry",
        upstreamBaseline: "v1.7.3.7",
        feature: "上游共用登录面板保留 SupDance 社交登录与协议确认",
        coupledUpstreamFiles: ["web/src/components/auth/auth-login-form.tsx", "web/src/components/auth/auth-register-form.tsx"],
        files: ["web/src/components/auth/auth-login-form.tsx", "web/src/components/auth/auth-register-form.tsx"],
        reason: "社交登录挂载点随上游登录/注册共用面板迁移，注册继续要求协议同意，不复制旧登录流程。",
        upgradeRisk: "MEDIUM",
    },
    {
        id: "supdance-music-plugin-gates",
        upstreamBaseline: "v1.7.3",
        feature: "音乐生成插件 (supdance-music-generation) 路由守卫、侧栏入口与创作岛模式药丸统一按清单 id 与服务端状态判定",
        coupledUpstreamFiles: ["web/src/components/auth/require-plugin.tsx", "web/src/lib/model-picker-groups.ts", "web/src/lib/model-pricing.ts", "web/src/pages/create/creation-workspace.tsx", "web/src/stores/use-plugin-store.ts"],
        files: [
            "web/src/components/auth/require-plugin.tsx",
            "web/src/lib/model-picker-groups.ts",
            "web/src/lib/model-pricing.ts",
            "web/src/pages/create/creation-workspace.tsx",
            "web/src/stores/use-plugin-store.ts",
            "web/src/supdance/plugins/music-generation/types.ts",
        ],
        reason: "上游路由守卫与入口显隐原先优先读取本地安装记录（ensurePlugin 新建记录默认 enabled=false）或别名 id（服务端无对应状态记录），会把服务端已生效的插件误判为停用；现统一收敛为 use-plugin-store 的 selectPluginEffectivelyEnabled（服务端 states -> 运行时 statuses -> 本地安装记录），插件 id 一律使用清单 id。",
        upgradeRisk: "LOW",
    },
    {
        id: "supdance-legal-docs",
        upstreamBaseline: "v1.7.3",
        feature: "公开可访问的服务条款 (/terms) 与隐私政策 (/privacy) 页面，并在通用页脚挂接入口",
        coupledUpstreamFiles: ["web/src/router.tsx", "web/src/components/layout/site-compliance-footer.tsx"],
        files: ["web/src/router.tsx", "web/src/components/layout/site-compliance-footer.tsx"],
        reason: "收单机构（Waffo Pancake）账户审核要求条款与隐私政策在未登录状态可访问且从站内可达；上游仅有登录页内联的 /terms /privacy 死链，故在顶层路由注册公开页并在通用合规页脚补入口。",
        upgradeRisk: "LOW",
    },
    {
        id: "supdance-visual-engine",
        upstreamBaseline: "v1.7.3",
        feature: "全站视觉与交互引擎 (supdance-visual-engine)：集中管理三层 Token、E0–E4 深度阴影、Motion 动效、图 1 工作区恢复动画及后台专属控制台",
        coupledUpstreamFiles: [
            "web/src/lib/canvas-theme.ts",
            "web/src/stores/canvas/use-canvas-theme-store.ts",
            "backend/internal/app/plugin_management.go",
            "backend/internal/handler/api.go",
            "web/src/application.tsx",
            "web/src/components/auth/auth-session-hydrator.tsx",
            "web/src/components/layout/app-providers.tsx",
            "web/src/components/ui/product/app-modal/app-modal.tsx",
            "web/src/components/ui/product/app-drawer/app-drawer.tsx",
            "web/src/layouts/user-layout.tsx",
            "web/src/lib/skin-themes.ts",
            "web/src/pages/admin/components/admin-shell.tsx",
            "web/src/pages/admin/plugins/plugins-page.tsx",
            "web/src/router.tsx",
            "web/src/services/diagnostics/client-diagnostics.ts",
        ],
        files: ["supdance/plugins/supdance-visual-engine/manifest.json", "web/src/supdance/plugins/visual-engine/index.ts", "web/src/supdance/plugins/visual-engine/types.ts", "web/src/supdance/plugins/visual-engine/admin/VisualConsole.tsx"],
        reason: "以独立插件形式挂载双入口统一控制台 (/admin/plugins/visual-engine)、全站设计令牌桥接与工作区恢复动画，不侵入宿主业务逻辑。",
        upgradeRisk: "LOW",
    },
    {
        id: "supdance-public-pricing",
        upstreamBaseline: "main@8de0a239",
        feature: "公开定价表入口和法律页共享导航",
        coupledUpstreamFiles: ["web/src/styles/globals.css", "web/src/pages/create/creation-product.css", "web/src/pages/create/index.tsx", "web/src/components/layout/workspace-sidebar-nav.tsx"],
        files: ["web/public/pricing.html", "web/public/pricing-i18n.js", "web/scripts/generate-public-pricing.py", "web/src/supdance/pages/legal/legal-header-nav.tsx"],
        reason: "统一保留并行任务已发布的静态价目表和入口，法律页样式限定 legal 作用域，静态页面链接使用完整导航。",
        upgradeRisk: "LOW",
    },
] as const;

export const SUPDANCE_RESERVED_PLUGIN_PREFIX = "supdance-" as const;

export type SupDancePluginManifest = (PluginManifest | PluginManifestV2) & {
    minHostVersion?: string;
};

export type SupDancePluginCompatibilityReport = {
    compatible: boolean;
    pluginId: string;
    version: string;
    apiVersion: string;
    minHostVersion?: string;
    errors: string[];
};

const SEMVER_REGEX = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

export function compareSemVer(a: string, b: string): number {
    const parse = (v: string) => {
        const cleaned = v.trim().replace(/^v/, "");
        const [core = "", pre = ""] = cleaned.split("-", 2);
        const nums = core.split(".").map((n) => Number.parseInt(n, 10) || 0);
        while (nums.length < 4) nums.push(0);
        return { nums, pre };
    };
    const pa = parse(a);
    const pb = parse(b);
    for (let i = 0; i < 4; i++) {
        if (pa.nums[i] !== pb.nums[i]) return pa.nums[i] > pb.nums[i] ? 1 : -1;
    }
    if (!pa.pre && pb.pre) return 1;
    if (pa.pre && !pb.pre) return -1;
    return pa.pre.localeCompare(pb.pre);
}

/**
 * 校验 SupDance 自定义插件清单是否满足宿主契约、最低兼容宿主版本与命名空间隔离规则。
 */
export function validateSupDancePluginManifest(manifest: SupDancePluginManifest, existingIds: ReadonlySet<string> = new Set(), hostVersion: string = SUPDANCE_HOST_VERSION): SupDancePluginCompatibilityReport {
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
    if (!SEMVER_REGEX.test(manifest.version)) {
        errors.push(`插件版本号 "${manifest.version}" 必须遵循 SemVer`);
    }
    if (manifest.minHostVersion !== undefined) {
        const cleanedMin = manifest.minHostVersion.trim().replace(/^v/, "");
        if (!SEMVER_REGEX.test(cleanedMin)) {
            errors.push(`最低宿主版本声明 "${manifest.minHostVersion}" 必须遵循 SemVer`);
        } else if (compareSemVer(hostVersion, cleanedMin) < 0) {
            errors.push(`当前宿主版本 (${hostVersion}) 低于插件要求的最低兼容版本 (${manifest.minHostVersion})`);
        }
    }
    if (new Set(manifest.permissions).size !== manifest.permissions.length) {
        errors.push("插件权限声明包含重复项");
    }
    return {
        compatible: errors.length === 0,
        pluginId: manifest.id,
        version: manifest.version,
        apiVersion: manifest.apiVersion,
        minHostVersion: manifest.minHostVersion,
        errors,
    };
}

/**
 * 安全注册 SupDance 插件：先做命名空间与兼容性校验，再委托给宿主 registerPlugin。
 */
export function registerSupDancePlugin(plugin: RegisteredPlugin, hostVersion: string = SUPDANCE_HOST_VERSION): void {
    const existing = getRegisteredPlugin(plugin.manifest.id);
    const conflictSet = new Set<string>();
    if (existing && existing.manifest.version !== plugin.manifest.version) {
        conflictSet.add(plugin.manifest.id);
    }
    const report = validateSupDancePluginManifest(plugin.manifest as SupDancePluginManifest, conflictSet, hostVersion);
    if (!report.compatible) {
        throw new Error(`SupDance 插件兼容性校验失败（${plugin.manifest.id}）：${report.errors.join("；")}`);
    }
    registerPlugin(plugin);
}

/**
 * 安全升级已注册的 SupDance 插件：校验新版本 > 旧版本，清理旧注册项后挂载新版本。
 */
export async function upgradeSupDancePlugin(nextPlugin: RegisteredPlugin, options: { context?: PluginHostContext; hostVersion?: string } = {}): Promise<{ previousVersion: string | null; currentVersion: string }> {
    const report = validateSupDancePluginManifest(nextPlugin.manifest as SupDancePluginManifest, new Set(), options.hostVersion ?? SUPDANCE_HOST_VERSION);
    if (!report.compatible) {
        throw new Error(`SupDance 插件升级校验失败（${nextPlugin.manifest.id}）：${report.errors.join("；")}`);
    }
    const existing = getRegisteredPlugin(nextPlugin.manifest.id);
    let previousVersion: string | null = null;
    if (existing) {
        previousVersion = existing.manifest.version;
        if (compareSemVer(nextPlugin.manifest.version, previousVersion) <= 0) {
            throw new Error(`SupDance 插件升级版本号 (${nextPlugin.manifest.version}) 必须高于当前已安装版本 (${previousVersion})`);
        }
        if (existing.deactivate && options.context) {
            await deactivateSupDancePluginSafely(existing.manifest.id, options.context);
        }
        unregisterPlugin(existing.manifest.id);
    }
    registerPlugin(nextPlugin);
    return { previousVersion, currentVersion: nextPlugin.manifest.version };
}

export type SupDancePluginLifecycleResult = {
    ok: boolean;
    pluginId: string;
    error?: string;
};

/**
 * 插件失败隔离激活：若插件 activate() 抛错，捕获异常并自动卸载该故障插件，确保不阻断宿主画布与工作台运行。
 */
export async function activateSupDancePluginSafely(pluginId: string, context: PluginHostContext): Promise<SupDancePluginLifecycleResult> {
    const registered = getRegisteredPlugin(pluginId);
    if (!registered) {
        return { ok: false, pluginId, error: `插件 ${pluginId} 未注册` };
    }
    try {
        await registered.activate?.(context);
        return { ok: true, pluginId };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        unregisterPlugin(pluginId);
        return { ok: false, pluginId, error: message };
    }
}

/**
 * 插件失败隔离停用：捕获 deactivate() 异常，确保停用与卸载流程不被插件内部错误中断。
 */
export async function deactivateSupDancePluginSafely(pluginId: string, context: PluginHostContext): Promise<SupDancePluginLifecycleResult> {
    const registered = getRegisteredPlugin(pluginId);
    if (!registered) {
        return { ok: false, pluginId, error: `插件 ${pluginId} 未注册` };
    }
    try {
        await registered.deactivate?.(context);
        return { ok: true, pluginId };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false, pluginId, error: message };
    }
}

export function unregisterSupDancePlugin(pluginId: string): void {
    unregisterPlugin(pluginId);
}

function normalizeRoutePath(rawPath: string): string {
    const withLeadingSlash = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
    const collapsed = withLeadingSlash.replace(/\/+/g, "/");
    return collapsed.length > 1 && collapsed.endsWith("/") ? collapsed.slice(0, -1) : collapsed;
}

function collectNormalizedRoutePaths(routes: readonly RouteObject[], prefix = ""): string[] {
    const collected: string[] = [];
    for (const route of routes) {
        let currentPath = prefix;
        if (route.path) {
            const joined = route.path.startsWith("/") ? route.path : `${prefix}/${route.path}`;
            currentPath = normalizeRoutePath(joined);
            collected.push(currentPath);
        }
        if (route.children?.length) {
            collected.push(...collectNormalizedRoutePaths(route.children, currentPath));
        }
    }
    return collected;
}

/**
 * 校验并合并 SupDance 扩展路由，防止自定义路由（含嵌套子路由与尾部斜杠变体）意外覆盖上游既有路由。
 */
export function mergeSupDanceRoutes(upstreamRoutes: readonly RouteObject[], supdanceRoutes: readonly RouteObject[]): RouteObject[] {
    const existingPaths = new Set(collectNormalizedRoutePaths(upstreamRoutes));
    const customPaths = collectNormalizedRoutePaths(supdanceRoutes);
    const seenCustom = new Set<string>();

    for (const customPath of customPaths) {
        if (existingPaths.has(customPath)) {
            throw new Error(`SupDance 扩展路由 "${customPath}" 与上游路由冲突，禁止覆盖上游核心路径`);
        }
        if (seenCustom.has(customPath)) {
            throw new Error(`SupDance 扩展路由 "${customPath}" 在自定义路由表内重复声明`);
        }
        seenCustom.add(customPath);
    }
    return [...upstreamRoutes, ...supdanceRoutes];
}
