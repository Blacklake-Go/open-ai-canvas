# SupDance Canvas — 独立改造与定制代码清单 (CUSTOMIZATIONS.md)

本文件记录 SupDance Canvas 相对上游 `ddcat-ai/open-ai-canvas` 的每一项定制改造、耦合边界及升级处理方式。

> 以下为历次定制的设计记录，部分连接器路径和版本声明已经过时。当前实际存在的差异、上游基线与验证结果以 [上游同步清单](./UPSTREAM_SYNC.md) 和 `supdance/config/baseline.json` 为准，不能将历史记录当作当前实现或验收证据。

## 1. 定制功能矩阵

| 功能名称 | 文件位置 | 依赖关系 | 与上游耦合程度 | 是否使用扩展接口 | 上游升级时是否需人工处理 |
| --- | --- | --- | --- | --- | --- |
| **本机 SupDance Canvas Agent (Codex) 连接器服务** | [`web/src/services/api/codex-connector.ts`](../../web/src/services/api/codex-connector.ts) | 浏览器原生 `fetch`、`EventSource`、`sessionStorage` | **无耦合（纯新增文件）** | 独立服务模块 | 否 |
| **Codex 连接器状态机 Hook** | [`web/src/components/canvas/use-codex-connector.ts`](../../web/src/components/canvas/use-codex-connector.ts) | `codex-connector.ts`、`@/lib/client-id`、`CloudAgentChatMessage` 类型 | **低耦合（纯新增文件）** | 引用上游聊天消息类型 | 仅当 `CloudAgentChatMessage` 结构变更时需适配 |
| **Agent 连接器底部入口栏与样式** | [`web/src/components/canvas/canvas-cloud-agent-connectors.tsx`](../../web/src/components/canvas/canvas-cloud-agent-connectors.tsx)<br>[`web/src/components/canvas/canvas-cloud-agent-connectors.css`](../../web/src/components/canvas/canvas-cloud-agent-connectors.css) | Ant Design `Popover`/`Button`、`lucide-react` | **中耦合（修改上游核心组件）** | 组件 Props 扩展 (`codex`, `onConnectCodex` 等) | 是（若上游修改底部连接器图标栏需合并） |
| **云端 Agent 面板 Codex 接入点** | [`web/src/components/canvas/canvas-cloud-agent-panel.tsx`](../../web/src/components/canvas/canvas-cloud-agent-panel.tsx) | `useCodexConnector`、`AgentConnectorsBar` | **中耦合（修改上游核心组件）** | 在 `CanvasCloudAgentPanel` 内挂载 Hook 并分流提交/停止动作 | 是（上游改动 Agent 面板时需重点核对） |
| **SupDance Studio 皮肤与主题扩展** | [`web/src/supdance/theme/supdance-skin.ts`](../../web/src/supdance/theme/supdance-skin.ts) | `@/lib/skin-themes` (`DEFAULT_CLASSIC_SKIN`, `applySkinTheme`) | **无侵入（纯新增命名空间）** | 100% 复用上游三层皮肤 Token 接口 | 否（除非上游增删 `SkinModeTokens` 字段，有单测自动捕获） |
| **前端兼容层与路由/插件守卫** | [`web/src/supdance/adapters/compatibility.ts`](../../web/src/supdance/adapters/compatibility.ts)<br>[`web/src/supdance/registry/index.ts`](../../web/src/supdance/registry/index.ts) | `@/lib/plugins/plugin-registry`、`react-router` | **无侵入（纯新增命名空间）** | 复用上游插件注册器 | 否 |
| **后端领域与兼容层守卫** | [`backend/internal/supdance/domain/extension.go`](../../backend/internal/supdance/domain/extension.go)<br>[`backend/internal/supdance/adapters/compatibility.go`](../../backend/internal/supdance/adapters/compatibility.go) | Go 标准库 | **无侵入（纯新增 internal 子包）** | 独立包，不反向依赖 `internal/app` | 否 |
| **SupDance 工作流助手插件模板** | [`supdance/plugins/supdance-workflow-assistant/manifest.json`](../../supdance/plugins/supdance-workflow-assistant/manifest.json) | `yingce.plugin/v2` 契约 | **无侵入（独立目录）** | 原生 `.yingce-plugin` Manifest 合同 | 否 |
| **站点多语言与实时词条插件 (`supdance-i18n`)** | [`web/src/supdance/plugins/i18n/`](../../web/src/supdance/plugins/i18n/)<br>[`backend/internal/supdance/i18n/`](../../backend/internal/supdance/i18n/)<br>[`supdance/plugins/supdance-i18n/`](../../supdance/plugins/supdance-i18n/) | `yingce.plugin/v2`、`SystemSetting`、Zustand、Ant Design `ConfigProvider` | **低耦合（插件化热插拔架构）** | 复用平台插件注册表、后台插件可用性开关与 `SystemSetting` KV存储 | 仅当顶栏或后台导航入口结构调整时需核对单行挂载点 |
| **SupDance 全站 UI Design System 规范与合规体系** | [`docs/design-system/`](../../docs/design-system/)<br>[`web/test/design-system-compliance.test.ts`](../../web/test/design-system-compliance.test.ts) | `@/lib/skin-themes`, `globals.css`, Ant Design | **无侵入（纯新增规范与非侵入式门禁单测）** | 遵守上游四层架构与多皮肤合同 | 否（上游升级零冲突） |
| **统一第三方社交登录插件 (`supdance-social-auth` v1.3.0)** | [`web/src/supdance/plugins/social-auth/`](../../web/src/supdance/plugins/social-auth/)<br>[`backend/internal/supdance/socialauth/`](../../backend/internal/supdance/socialauth/)<br>[`supdance/plugins/supdance-social-auth/`](../../supdance/plugins/supdance-social-auth/) | `yingce.plugin/v2`、OAuth2、JWT、Ant Design | **低耦合（插件化热插拔架构）** | 登录页挂载第三方登录组件与后台四列即时配置与运营大盘 | 仅当登录页结构变化时需核对挂载点 |
| **公开法律文件页（服务条款 / 隐私政策）** | [`web/src/supdance/pages/legal/`](../../web/src/supdance/pages/legal/) | `react-router` 顶层公开路由、`SiteComplianceFooter`、`supdance-i18n` 词条、Design Tokens | **低耦合（纯新增命名空间 + 两行路由注册）** | 复用上游公开路由注册位与通用合规页脚 | 仅当上游调整顶层路由表或页脚结构时需核对 |

---

## 2. 不可避免的上游核心文件补丁登记

所有对上游文件的直接修改均同步登记在 [`web/src/supdance/adapters/compatibility.ts`](../../web/src/supdance/adapters/compatibility.ts) 的 `SUPDANCE_UPSTREAM_PATCH_REGISTRY` 与 [`supdance/config/baseline.json`](../../supdance/config/baseline.json) 中：

### 补丁 ID：`supdance-codex-agent-connector`
- **被修改的上游文件**：
  1. `web/src/components/canvas/canvas-cloud-agent-connectors.css`
  2. `web/src/components/canvas/canvas-cloud-agent-connectors.tsx`
  3. `web/src/components/canvas/canvas-cloud-agent-panel.tsx`
- **修改原因**：上游 `.yingce-plugin` 当前不开放云端 Agent 悬浮面板底部连接器栏与对话发送拦截钩子，因此需要在面板组件内挂载 `useCodexConnector`。
- **上游基线**：`v1.7.2` (`e4e3a40c94242b8845650e4c7090ec7cb6c46ed0`)
- **升级风险与回归保障**：已通过 `tools/supdance/check_upstream.py` 将上述 3 个文件纳入 `coupledUpstreamFiles` 监控；一旦上游修改这 3 个文件，升级报告会自动升级风险为 `HIGH` 并列出冲突路径。

### 补丁 ID：`supdance-workspace-governance`
- **被修改的上游文件**：
  1. `.gitignore`
  2. `AGENTS.md`
- **修改原因**：上游 `.gitignore` 默认忽略 `docs/*`，需最小化放行 `!docs/supdance/`；并在 `AGENTS.md` 末尾追加第 10 节二开文档索引指针，不改动上游既有 1–9 节约定。
- **上游基线**：`v1.7.2` (`e4e3a40c94242b8845650e4c7090ec7cb6c46ed0`)
- **升级风险与回归保障**：`LOW`，均位于文件尾部追加且已纳入 `coupledUpstreamFiles` 与 `SUPDANCE_UPSTREAM_PATCH_REGISTRY` 自动对齐校验。

### 补丁 ID：`supdance-i18n-plugin`
- **被修改的上游文件**：
  1. `backend/internal/app/plugin_management.go`
  2. `backend/internal/handler/api.go`
  3. `web/src/lib/plugins/builtin/index.ts`
  4. `web/src/components/layout/app-providers.tsx`
  5. `web/src/components/layout/workspace-top-bar.tsx`
  6. `web/src/pages/auth/auth-scene.tsx`
  7. `web/src/pages/canvas/canvas-project-top-bar.tsx`
  8. `web/src/pages/admin/components/admin-shell.tsx`
  9. `web/src/pages/admin/plugins/plugins-page.tsx`
  10. `web/src/router.tsx`
- **修改原因**：以可热插拔插件形式在站点右上角挂载语言切换器 `<TopbarLanguageSwitcher />`、在 `AppProviders` 注入动态 `ConfigProvider locale` 与 `<SupDanceI18nRuntimeHost />`，并在后台挂载语言管理设置 (`/admin/i18n/settings`) 与字段词条修改 (`/admin/i18n/entries`) 路由。
- **上游基线**：`v1.7.2` (`e4e3a40c94242b8845650e4c7090ec7cb6c46ed0`)
- **升级风险与回归保障**：`LOW`，所有核心状态、词库、DOM 翻译器与后台管理页面均隔离在 `web/src/supdance/plugins/i18n/` 与 `backend/internal/supdance/i18n/` 下，宿主仅保留单行组件挂载与路由注册。

### 补丁 ID：`supdance-music-plugin-gates`
- **被修改的上游文件**：
  1. `web/src/components/auth/require-plugin.tsx`
  2. `web/src/pages/create/creation-workspace.tsx`
  3. `web/src/stores/use-plugin-store.ts`
- **修改原因**：上游路由守卫 (`RequirePlugin`) 与创作岛模式药丸原先优先读取本地安装记录（`ensurePlugin` 新建记录默认 `enabled=false`）或别名 id `music-generation`（服务端无对应状态记录），会把服务端 `effectiveEnabled=true` 的插件误判为停用（`/toolbox/music` 曾因此整页拦截）。现将判定收敛为 `use-plugin-store` 导出的 `selectPluginEffectivelyEnabled`（服务端 states → 运行时 statuses → 本地安装记录），插件 id 一律使用清单 id `supdance-music-generation`，与后端 `CheckMusicTaskAdmission` 的准入判定保持一致。
- **上游基线**：`v1.7.3`
- **升级风险与回归保障**：`LOW`，仅调整插件生效判定的读取顺序与 id 常量来源，不改变任何路由、权限或业务逻辑；已纳入 `coupledUpstreamFiles` 与 `SUPDANCE_UPSTREAM_PATCH_REGISTRY` 自动对齐校验，并由 `web/test/supdance-extension-isolation.test.ts` 校验注册表与 `supdance/config/baseline.json` 对齐。

### 补丁 ID：`supdance-legal-docs`
- **被修改的上游文件**：
  1. `web/src/router.tsx`
  2. `web/src/components/layout/site-compliance-footer.tsx`
- **修改原因**：上游登录页 (`web/src/supdance/pages/dark-login-page.tsx`) 的《用户服务协议》《隐私政策》指向 `/terms` 与 `/privacy`，但仓库从未注册这两个路由，线上实际渲染 404 页（nginx SPA 回退使 HTTP 状态码仍为 200，因此收单机构的链接自检会给出假通过）。现注册为顶层公开路由（位于 `RequireAuth` 子树之外，未登录可访问），并在通用合规页脚补充两个入口，使任意页面均可达。
- **上游基线**：`v1.7.3`
- **升级风险与回归保障**：`LOW`，条款与政策正文、内容模型与渲染器全部隔离在 `web/src/supdance/pages/legal/`；宿主仅新增两行路由注册与页脚两个链接。正文按 `data-i18n-ignore` 排除在 DOM 自动翻译之外（法律文本不接受未经运营方审阅的机器改写），界面外壳走 `supdance-i18n` 词条。`web/test/supdance-extension-isolation.test.ts` 已校验新增路由不遮蔽上游路由、注册表与 `supdance/config/baseline.json` 对齐。

### 补丁 ID：`supdance-social-auth`
- **被修改的上游文件**：
  1. `backend/internal/auth/login_logs.go`
  2. `backend/internal/repository/oauth.go`
  3. `backend/internal/handler/social_auth.go`
  4. `web/src/router.tsx`
- **修改原因**：统一第三方社交登录插件 v1.3.0：支持 IP 智能分区展示、四列式即时生效设置面板、无沙盒 Mock 的 Fail-closed 严格鉴权架构，以及运营控制与大盘页面（/admin/settings/social-auth/operations）。
- **上游基线**：`v1.7.3`
- **升级风险与回归保障**：`LOW`，核心业务逻辑隔离在 `backend/internal/supdance/socialauth/` 与 `web/src/supdance/plugins/social-auth/`，宿主仅提供路由注册与登录审计导出。
