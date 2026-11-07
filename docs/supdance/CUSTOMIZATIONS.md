# SupDance Canvas — 独立改造与定制代码清单 (CUSTOMIZATIONS.md)

## Waffo 商户重审整改

- 复用既有 `contentsafety` 与生成任务筛查入口，通过生产 Compose 透传商户 ID、开关和私钥文件路径。密钥继续保存在服务器受限文件中。默认关闭，没有数据库迁移。
- 隐私政策六个文本版本补充 Waffo 生成前文本筛查、发送范围和官方披露的原文保留规则。首页、介绍页及法律链接复用 `SitePolicyLinks`。
- 上线前验证真实商户扫描接口、拦截时上游零调用与失败路由不切换。启用后任意创建型 custom relay 被拒绝，图片与视频创建使用任务队列。后续更新须保留 Compose 的三个环境变量映射。

## 账户浮窗窄屏修复

生产 390px 验收发现旧固定侧栏使资料正文仅剩84px。本站新增的 `web/src/components/layout/user-profile-modal.tsx` 改为小于LG时使用统一Select，沿用同一分组、插件准入和tab回调；桌面保留侧栏。使用现有语义token、原生词条和44px关闭目标，不改变资料、安全、计费和生成协议。运行态布局及关闭焦点须在新版本上线后重新验收。

## 上游 v1.8.0 合并接缝

- 数据库保留已应用的本站83，上游83–87映射为本站84–88，保留名称、校验和、实现与顺序。
- 售价上下文分档与分时规则按档互斥；保留成本分档、一小时缓存子集、订单快照与成本未知语义。
- 创作首页采用上游模式卡并保留音乐插件准入、独立音频模型回调、报价、歌词与时长控件；设置页采用上游分组与动态协议声明，保留社交账户入口。
- 合并新增短剧集插入、资产包和剪映导出入口时继续使用原生创建namespace；保留日推荐与上新标记的本地化。
- 新增核心标题与价格展示接缝登记于兼容注册表及 baseline；验证和部署记录见 [源码合并记录](./UPSTREAM_V1_8_SOURCE_MERGE.md)。

## 网站集成候选：六语、访客入口与文本定价

- 电商及小说改编页面显式接入 `supdance-creation` i18next namespace，使用宿主原生中英法德日韩。保留用户输入、模型 ID、请求参数与服务状态原文，不恢复 DOM 扫描翻译。
- 共享 `workspace-guest-actions` 为侧栏和顶栏提供登录／注册药丸；`SitePolicyLinks` 同时用于工作区与独立 welcome 入口。移动端法务链接横向换行，保留 44px 触控目标；账户菜单清理重复设置入口。
- 文本模型的上下文分档、五分钟／一小时缓存用量沿既有订单和成本快照实现，Schema 83 只增列；目录和管理表单传递完整售价分档，用户目录不公开成本。保留现有赠金、返佣及余额。
- 上游接缝完整登记于 `supdance-site-closure-interfaces` 和 `supdance/config/baseline.json`。这是涉及计费的高风险候选，必须通过本地推送门禁、CI、备份恢复演练及线上验收后才可视为已交付。
- 公开价目表复用原生六语与 `yingce:locale`，对页面完整静态文案显式翻译，不翻译模型标识和金额单元格；真实 HTML 的六语及回切测试保护此合同。
- `supdance-model-brand-mode-preservation` 保留原工作区既有 Mureka 图标及 ID；视频菜单只过滤当前输入不适用的型号，不全局下架模型，也不改变图生视频能力或后台启用状态。

## 原生多语言接管

界面语言以 `web/src/i18n` 与 `useLocaleStore` 为唯一来源；旧 DOM 翻译和上游目录 postprocessor 退出。扩展 key 在 `web/src/supdance/adapters/upstream-i18n.ts` 注册独立 namespace，所有语言入口与设置复用上游组件。登录共用表单保留社交登录和协议强校验。下方旧语言入口及 DOM 引擎描述为历史实现，现行合同见 [原生多语言集成](./NATIVE_I18N_UPSTREAM_SYNC.md)。


## 音乐素材写入边界

- 平台音频任务的规范素材由后端 `registerRecoveredMediaAssets` 按任务和输出序号生成稳定 ID；音乐工作台只读任务及资源，不再在载入历史或轮询完成时调用前端 `addAsset`。移除仅内存去重的旧桥接，避免目录未 hydration 或刷新后产生随机副本。历史重载、账号状态重置和轮询完成共用真实 store 回归；既有素材不自动删除。
- 创作页模型分组、目标时长与音乐结果组件保留最小适配，业务协议在 `plugin-packages/runninghub-standard/`，独立工作台适配在 `web/src/supdance/plugins/music-generation/services/music-site-api.ts`。
- 复用平台模型目录、报价、`canvas_audio` 任务和资源访问 API，不增加账本、用户或数据表；新文案通过 `supdance-i18n` 六语词条模块提供。
- 上游更新需保留 RunningHub 1.1.2 源清单与发行包，避免启动时旧官方包覆盖音乐接口；创作页、工作台、失败退款与账号切换需共同回归。
## 音乐工作台统一渠道补丁

- 创作页模型分组与音乐结果组件保留最小适配；音乐工作台通过主站配置读取模型、能力和报价，不展示没有接通的时长、人声与格式参数。
- 复用平台模型目录、报价、`canvas_audio` 任务和资源访问 API，不增加账本、用户或数据表；新文案通过 `supdance-i18n` 六语词条模块提供。
- 音乐模块版本为 1.3.0、最低宿主版本 1.7.4，RunningHub 协议包为 1.1.2。源码与发行包必须一起升级并重启，不能只改插件数据库版本。
- 音频沿宿主分离轮询、媒体 checkpoint、稳定资产 ID 和账务状态机；恢复旧后台测试只回查原上游 ID，不创建任务到供应商、不补扣历史账目。生命周期状态、准入与管理员审计原子提交，卸载保留配置和用户偏好。
- 宿主接缝登记于 `supdance-music-host-tasks`、`supdance-music-player-docking`、`supdance-music-original-asset-titles` compatibility registry 与 `supdance/config/baseline.json`。实现、迁移与风险见 [音乐实现说明](music-studio/IMPLEMENTATION.md)，实测范围见 [音乐验收记录](music-studio/VERIFICATION.md)。

## 完整上游同步：正式版与 main

- 快照节流在刷新函数完成同步准备后记录时间，避免准备开销侵占实际请求的最短间隔。用 35 毫秒同步准备的真实回归先复现小于 100 毫秒的请求间隔，再验证修复；原有批处理、单个在途刷新与失败传播合同保留。登记为 `supdance-agent-snapshot-throttle`。
- 统一发布门禁复现 Agent 取消清理与调度器的 revision 冲突：`CancelCloudAgent` 在取消意图保存后，对清理阶段增加有界重读重试并保留 context 取消；不重复创建取消事件、不重提收费任务、不改变已提交媒体任务继续执行的策略。补丁登记为 `supdance-agent-cancellation-cleanup`。
- 统一发布收敛公开价目表、生成岛/侧栏入口和法律页共享导航；补丁登记为 `supdance-public-pricing`。静态价格保留已审核快照，不在构建或部署时重新抓取文档及换算价格。音乐工作台使用平台目录、报价和通用任务合同，保留 RunningHub 1.1.1 包与后台已配置售价。
- 法律页提取共享头部导致 10 个原有中文源文的扫描锚点变化；逐项与 `037b8ae9` 源文核对相同后更新扫描基线，不代表这些既有正文已补译。音乐能力按协议收敛：Suno 仅简单模式，Mureka 不提交纯音乐参数，MiniMax 保留歌词/纯音乐；时长为目标提示，实际以供应商音频为准。

- 版本 `v1.7.4-supdance.7` 自 `eadb3622` 顺序合并正式版 `7c14ffdd` 和 `main@8de0a239`；保留两个上游祖先及自有插件提交，实际部署以 [完整集成记录](./STAGED_UPSTREAM_CANDIDATE.md) 为准。
- 九个冲突按语义处理：设置仓储同时保留 `LockSystemSetting` 与 `SystemSettingsWithPrefix`；OpenAPI 按完整端点保留视觉引擎与电商请求体及响应；侧栏保留 SupDance `t()`、音乐开关、账号菜单；审批测试外层 30 秒保留大于子进程 20 秒的期限。版本、变更日志及三篇文档保留双方内容。
- 电商侧栏使用后台功能条件和既有六语词条；同步 main 的支付/币种和 TOS 表单协议，避免保留旧 UI 却调用新后端合同。
- 保留已上线第一阶段：正式版自带 `b0d56dea` 分页，再精确带入 `common.load_more`、令牌、焦点与 44px 触控适配；移植 `338b75c8` 品牌与第二屏修复、相关测试及 E2E 调用参数。`supdance-agent-history-pagination` registry 与 baseline 两个路径同步保留；第一阶段文档不整体覆盖候选。
- 集成包含 Schema 81、积分默认零奖励与取消登录补发，以及通用素材恢复。音乐插件复用后端规范素材；RunningHub 真实结果、素材去重和多标签恢复分别记录运行证据，不把静态合并视为业务闭环通过。
- 新适配器 `web/src/supdance/adapters/upstream-i18n.ts` 将上游 `web/src/i18n/index.ts` 的翻译后处理接入 SupDance 词库。插件语言、管理员词条和停用控制优先；仅保留一个语言选择器和 AntD locale 配置。新增耦合点已登记 compatibility registry 与 baseline。英文、西班牙语、繁体中文及停用回退有真实 React 渲染回归。
- 创作页上传提示复用上游原生翻译键，经同一桥接保留插件发布优先；源码扫描器识别两套合法目录并排除目录定义，未知键仍拒绝。上游待译候选与本次接入基线单独记录在 `supdance/i18n/upstream-main-8de0a239-review.json`，不计作补译完成。
- 迁移先在 PostgreSQL 备份恢复副本演练；旧 Schema 78 程序拒绝连接 Schema 81，回退必须恢复匹配数据库。源码元数据不能替代生产迁移证据。

本文件记录 SupDance Canvas 相对上游 `ddcat-ai/open-ai-canvas` 的每一项定制改造、耦合边界及升级处理方式。

## v1.8.0 账户宿主与原生界面接入

- `supdance-profile-router-host`：账户浮窗的 `ProfilePane` 已使用 `useAuthEntry`、`useSearchParams`。全局 Provider 只管理通用上下文；账户宿主放在所有路由共享的 `SupDanceRouteHosts`，与 `Outlet` 共用 Router，跨页面保持窗口身份。不要重新把账户宿主挂到 `RouterProvider` 外，也不要用孤立的 MemoryRouter 绕过生产导航。真实资料窗口有独立 DOM 回归。
- `supdance-native-upstream-ui`：画布 HUD、批量进度、Token 规则与音乐建议使用宿主 `upstream` 区域六语目录。星期用当前语言的 `Intl` 标签，保存的星期编号、上海时段、价格字段和上下文阈值不变；音乐建议仅翻译标题和说明，点击发送的原提示词不变。面包屑与侧栏音乐名称读取原生词条。
- 外层反代若保留历史 `/api/v1/` 入口，必须让 `/api/v1/supdance/music/` 更长前缀指向当前应用，并沿用当前应用的 Cookie 隔离和转发头。仅容器健康检查不能发现这种错误；认证后的能力、报价、作品列表和原音频访问需一起验收。
- 本批不改变 Schema 88、模型价格、赠金、返佣、用户权限或已保存内容；其余上游文案继续保留明确的待译状态。

## 统一社交登录插件：`supdance-social-auth` v1.4.0

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
| **全站视觉与交互引擎 (`supdance-visual-engine`)** | [`web/src/supdance/plugins/visual-engine/`](../../web/src/supdance/plugins/visual-engine/)<br>[`backend/internal/supdance/visualengine/`](../../backend/internal/supdance/visualengine/)<br>[`supdance/plugins/supdance-visual-engine/`](../../supdance/plugins/supdance-visual-engine/) | `yingce.plugin/v2`、主题/浮层扩展接口、`SystemSetting`、Zustand | **低耦合（插件化热插拔架构）** | 双入口 Visual Console、主题/浮层扩展与独立生命周期管理 | 核对主题扩展、后台插件入口、路由与诊断订阅挂载点 |

---

## 2. 不可避免的上游核心文件补丁登记

### 补丁 ID：`supdance-asset-form-viewport`

- `web/src/pages/assets/index.tsx` 仅限制新增和编辑素材共用弹窗的高度，让正文独立滚动并保留可见的底部操作区。上游合并时核对弹窗正文与操作区的布局。

### 资产页方舟认证角标与浏览器翻译

- `web/src/pages/assets/asset-library-cards.tsx` 为认证状态保留独立文案元素。上游合并时保留此结构及 `web/index.html` 的 `translate="no"`，由站内国际化提供界面语言。自动测试覆盖入口声明与审核角标结构。

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
- **1.2.0 扩展**：增加 Babel AST 增量扫描、版本化源文/译文基线、上游 Release 扫描草稿产物、可选受预算约束的模型补译 CLI，以及后台翻译更新中心。工作流草稿、审核、发布、锁定和十次历史回滚复用 SystemSetting，发布与审计事务提交；已有编辑/导入接口共享行锁。公开版本、ETag 与语言包恢复逻辑同步升级。宿主新增修改仅涉及 Quality/Upstream CI、推送前验证脚本、service 别名和 VERSION；业务实现继续位于原插件边界。详见 `docs/content/docs/backend/supdance-i18n.mdx`。
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
  4. `web/src/lib/model-picker-groups.ts`
- **修改原因**：上游路由守卫 (`RequirePlugin`) 与创作岛模式药丸原先优先读取本地安装记录（`ensurePlugin` 新建记录默认 `enabled=false`）或别名 id `music-generation`（服务端无对应状态记录），会把服务端 `effectiveEnabled=true` 的插件误判为停用（`/toolbox/music` 曾因此整页拦截）。现将判定收敛为 `use-plugin-store` 导出的 `selectPluginEffectivelyEnabled`（服务端 states → 运行时 statuses → 本地安装记录），插件 id 一律使用清单 id `supdance-music-generation`，与后端 `CheckMusicTaskAdmission` 的准入判定保持一致。
- **上游基线**：`v1.7.3`
- **升级风险与回归保障**：`LOW`，仅调整插件生效判定的读取顺序与 id 常量来源，不改变任何路由、权限或业务逻辑；已纳入 `coupledUpstreamFiles` 与 `SUPDANCE_UPSTREAM_PATCH_REGISTRY` 自动对齐校验，并由 `web/test/supdance-extension-isolation.test.ts` 校验注册表与 `supdance/config/baseline.json` 对齐。
- **完整上游合并后的并行补丁收敛**：保留音乐配置任务已部署的 Suno / Mureka / MiniMax 品牌分组、选项去重与整数秒时长滑条。分组只影响显示，不合并渠道身份，不改变模型选择、报价或收费。滑条复用 AntD 和既有国际化词条，预设按钮同步禁用态与 `aria-pressed`。模型分组、渠道身份与报价回归位于 `web/test/model-picker-groups.test.ts`，后续更新须同时保留这些控件改动。

### 补丁 ID：`supdance-visual-engine`
- 运行时按宿主扩展能力启停，复用服务端发布包。应用挂载、Router、皮肤及浮层扩展由升级门禁检查。运行态验收和上游 UI 差异见 [宿主兼容性](visual-engine/HOST_COMPATIBILITY.md)。
- 动效总开关复用 `motion.enabled`，新配置默认关闭；插件生命周期内控制全站 CSS 与现有 Motion 库，页面规则不能越过总开关。关闭时复用上游 `WorkspaceRouteLoader`，不新增加载或路由动画、不新增宿主补丁点；既有发布配置需管理员关闭开关后发布。上游比对依据与回滚方式见 `visual-engine/MOTION_ENGINE.md`。
- **被修改的上游文件**：
  1. `backend/internal/app/plugin_management.go`
  2. `backend/internal/handler/api.go`
  3. `web/src/application.tsx`
  4. `web/src/components/auth/auth-session-hydrator.tsx`
  5. `web/src/components/layout/app-providers.tsx`
  6. `web/src/components/ui/product/app-drawer/app-drawer.tsx`
  7. `web/src/components/ui/product/app-modal/app-modal.tsx`
  8. `web/src/layouts/user-layout.tsx`
  9. `web/src/lib/canvas-theme.ts`
  10. `web/src/lib/skin-themes.ts`
  11. `web/src/pages/admin/components/admin-shell.tsx`
  12. `web/src/pages/admin/plugins/plugins-page.tsx`
  13. `web/src/router.tsx`
  14. `web/src/services/diagnostics/client-diagnostics.ts`
  15. `web/src/stores/canvas/use-canvas-theme-store.ts`
  16. `web/src/lib/overlay-extensions.ts`，为现有 Modal 和 Drawer 提供扩展变更订阅。
  17. `web/src/styles/globals.css`，空间工作台的现有遮罩规则读取扩展变量，默认值沿用宿主。
- **修改原因**：以独立插件形式挂载双入口 Visual Console、主题/浮层扩展、恢复动画边界和插件生命周期控制；业务配置、权限、审计、发布与回滚集中在 `web/src/supdance/plugins/visual-engine/` 和 `backend/internal/supdance/visualengine/`。
- **上游基线**：`v1.7.3`
- **升级风险与回归保障**：`LOW`，所有耦合点已纳入 `SUPDANCE_UPSTREAM_PATCH_REGISTRY`、`supdance/config/baseline.json` 与扩展隔离测试；配置热插拔、失败回退、停用清理和发布/回滚已有专项测试，但独立安装包闭环仍待完成。

## 法律页默认模板品牌标识

原工作区法律页默认模板的站点标识一并保留。独立 HTML 模板沿用既有黑底品牌和 32px 容器／27px 图像，不继承宿主设计 token；这是现有品牌图像的局部例外，只影响默认条款与 AUP 模板，不覆盖用户已保存页面。

## 网站生成前提示词筛查

独立 `backend/internal/supdance/contentsafety/` 负责 Waffo 签名、判定和有界重试。组合根仅初始化开关并在普通／工作流生成前调用；路由尝试拒绝针对筛查失败切换供应商。自定义 relay 的创建路径在启用时关闭，读取保留，避免任意 payload 绕过最终提示词检查。默认关闭，启用依赖商户配置、提示词外发授权与真实任务验收。没有数据库变更。配置、回退与影响见 [PROMPT_SCREENING.md](PROMPT_SCREENING.md)。
