# SupDance Canvas — 独立改造与定制代码清单 (CUSTOMIZATIONS.md)

本文件记录 SupDance Canvas 相对上游 `ddcat-ai/open-ai-canvas` 的每一项定制改造、耦合边界及升级处理方式。

## 统一社交登录插件：`supdance-social-auth` v1.3.4

补丁 ID：`supdance-social-auth`

分发工具：`python3 tools/supdance/package_social_auth.py --output-dir /tmp/supdance-social-auth-release`，生成 `.yingce-plugin`、SHA-256 清单和宿主部署说明。包仅携带清单与文档，使用宿主顶层 ID/名称/版本合同；不声明独立 Web 入口，不包含真实凭据。完整 Go/React 实现已随 `1.7.4-supdance-social-1.3.3`（`42de461f`）宿主部署，不能把元数据包上传等同于运行时代码升级。

Bilibili 依据[网页接入](https://open.bilibili.com/doc/4/aac73b2e-4ff2-b75c-4c96-35ced865797b)、[账号授权](https://openhome.bilibili.com/doc/4/eaf0e2b5-bde9-b9a0-9be1-019bb455701c)、[接口签名](https://open.bilibili.com/doc/4/8673959e-f7bb-56e6-6e68-d225f971b81b)与[用户信息](https://open.bilibili.com/doc/4/feb66f99-7d87-c206-00e7-d84164cd701c)实现真实协议；要求 USER_INFO 授权。令牌交换按官方合同在服务端 URL 参数传入凭据，禁止记录该请求 URL；用户资料使用随机 nonce、当前时间戳和 HMAC-SHA256。服务商头像禁止热链，当前保留原生头像回退，缓存适配待验收。端点可达与本地协议测试仍不能代替正式应用授权。

v1.3.2 根据真实 QQ 授权页的 100001 错误补齐数字 App ID 校验；无效或尚未就绪的历史配置在管理界面显示为停用，避免空凭据开关保持开启的误导。

v1.3.3 将授权后入站票据从单进程内存迁移至共享 Redis（键前缀 `supdance:socialauth:onboarding-ticket:`，TTL 与票据 30 分钟有效期一致）；消费使用 Lua 原子读取并删除，后端重启或多副本部署不再丢失票据，也无法重放已消费票据。Redis 不可用时自动降级为单进程内存票据，保持入站可用。

合并渠道凭据管理、运营控制与授权后入站流程。后台保留四列配置列表、480px 凭据浮窗和独立运营页；账号中心保留第三方身份展示、绑定、换绑与防孤立解绑保护。关闭插件后，授权开始、回调与入站完成均拒绝执行。

真实授权使用服务商令牌交换、浏览器绑定 Cookie、一次性 state 与 X S256 PKCE。移除默认 Mock 凭据与模拟身份链路，历史 Mock 凭据不能展示为可用渠道。QQ、微信、抖音、Bilibili、Google、X 已提供协议适配；Instagram、TikTok 保留配置入口，尚未开放真实登录。配置字段完整和授权端点可达不代表生产授权已验收。

入站票据仅在表单提交成功后消费，失败可重试；用户确认协议后才创建账号与身份。仅服务商确认已验证的邮箱可自动绑定，手填邮箱保持未验证状态。新增用户开关与必填邮箱策略在后端执行；注册奖励沿用站点统一积分策略，防孤立保护固定开启。入站票据默认保存在共享 Redis，重启与多副本安全；无 Redis 的环境降级为单进程内存票据，重启会失效。

与宿主耦合点为 `RegisterSocialAuthRoutes`、`supdance_social_auth_plugin.go`、`AppProviders`、登录注册页、用户资料浮窗与 `router.tsx`。服务商凭据由宿主加密，运营统计来自数据库，端点探测不携带凭据且不生成账号。真实服务商授权、回调验收与界面核对列于待测试文档。

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
| **统一第三方社交登录插件 (`supdance-social-auth`)** | [`web/src/supdance/plugins/social-auth/`](../../web/src/supdance/plugins/social-auth/)<br>[`backend/internal/supdance/socialauth/`](../../backend/internal/supdance/socialauth/)<br>[`supdance/plugins/supdance-social-auth/`](../../supdance/plugins/supdance-social-auth/) | `yingce.plugin/v2`、OAuth2、JWT、Ant Design | **低耦合（插件化热插拔架构）** | 登录页挂载第三方登录组件与后台独立管理配置 | 仅当登录页结构变化时需核对挂载点 |

---

## 2. 不可避免的上游核心文件补丁登记

所有对上游文件的直接修改均同步登记在 [`web/src/supdance/adapters/compatibility.ts`](../../web/src/supdance/adapters/compatibility.ts) 的 `SUPDANCE_UPSTREAM_PATCH_REGISTRY` 与 [`supdance/config/baseline.json`](../../supdance/config/baseline.json) 中：

### 补丁 ID：`supdance-codex-agent-connector`
- **被修改的上游文件**：
  1. `web/src/components/canvas/canvas-cloud-agent-connectors.css`
  2. `web/src/components/canvas/canvas-cloud-agent-connectors.tsx`
  3. `web/src/components/canvas/canvas-cloud-agent-panel.tsx`
  4. `web/src/components/canvas/canvas-cloud-agent-settings.tsx`
- **修改原因**：在面板挂载 `useCodexConnector` 并分流本机发送与停止；按上游新布局将连接器移入设置「工具与连接」，由面板注入真实状态和操作。连接本机期间阻止云端队列自动派发，保留云端队列和附件流程。
- **上游基线**：`v1.7.3.4` (`dc035d51311925e48ab1542df094bd1e2b07ba7f`)
- **升级风险与回归保障**：上述 4 个文件纳入 `coupledUpstreamFiles` 监控，并通过插件隔离、Agent 布局和模型选择专项检查；真实本机配对与页面验收仍需在运行环境完成。

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
