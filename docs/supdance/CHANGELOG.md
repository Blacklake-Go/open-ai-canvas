# SupDance Canvas — 定制维护变更日志 (CHANGELOG.md)

## v1.8.4.1-supdance.1 候选

- 合并上游 v1.8.4.1，本站 Schema 目标为 99；保留既有插件与二次开发，新增迁移顺延并保持既有名称和 checksum。
- 保留画布多段媒体剪辑、选中视频合并和上游图片对比；短剧造型及参考图片字段补齐原生六语词条。
- 保留上游删除的时间线、字幕、剪辑插件，以及 Markdown、HTML、SVG、图表和对比节点。
- 尚未执行生产迁移或部署。详细冲突处理与验证范围见[源码合并记录](./UPSTREAM_V1_8_4_1_SOURCE_MERGE.md)。

## v1.8.3-supdance.1

- 合并上游 v1.8.3 和已发布生产定制。合并范围、迁移映射与语言覆盖见[源码合并记录](./UPSTREAM_V1_8_3_SOURCE_MERGE.md)。

## 模型选择器手机品牌与音乐版本

- 旧菜单的手机单列样式与简洁菜单隔离，图片、视频、音乐及文本保留品牌栏。
- 独立音乐工作台使用共享模型菜单，显示完整版本、简介和积分报价；不可用型号及忙碌状态受控，生成与支付流程保持原合同。

## Waffo 企业版沙盒插件

- 使用官方 Go SDK 与现有支付 RPC 接入整页一次性充值收银台，指定账号可用，正式收款关闭。
- 宿主支持签名通知应答、下单交易号提前绑定与未知结果原请求号查单，复用原有金额校验和幂等账本。
- SDK、仓储及相关宿主专项测试通过；真实收银台和设备钱包验收范围以 `.waffo/integration-manifest.json` 为准。

## Waffo 重审所需的生成前安全筛查

- 生产 Compose 显式透传既有 Waffo 筛查配置，沿用最终图片、视频提示词的强校验入口与失败退款路径。
- 隐私政策补充生成前向 Waffo 发送文本提示词的六语说明。申请须以生产开关、公开页面及真实扫描结果验收后提交。
## 视觉引擎页面规则与原生回退

- 页面规则与已发布配置选择同一预设时，沿用发布色值，再应用页面自定义令牌。页面深度与动效规则同步应用到 AntD 和启动加载入口。
- 模型选择器的精简总开关关闭时恢复宿主展示。开启后，渠道信息、采样状态和卡片布局分别受各自选项控制，菜单列宽由宿主的响应式规则管理。
- 原生预设、后台与正式非 Classic 皮肤沿用宿主加载入口。上游合并门禁覆盖视觉配置发布、页面规则、主题契约和启停回归。

## 视觉引擎宿主能力适配与热插拔

- 以宿主能力决定视觉运行时启用条件，修复版本升级后已发布配置未生效。停用、卸载或能力缺失时，主题、AntD、画布和浮层回退至宿主。已打开的浮层随发布和启停更新，保持显式样式参数的合并顺序。
- 发布修订和草稿基线独立跟踪。相同修订轮询复用现有运行配置，丢弃草稿后采用最新已发布修订。升级检查覆盖应用挂载、控制台路由、主题回调和浮层扩展。

## 视觉引擎 1.8.0 宿主适配

- 修复宿主升级到 1.8.0 后版本检查拦截主题运行时的问题。使用现有发布配置通过本地工作台、画布及登录弹窗的明暗主题验收。生产待发布后复核。

## v1.7.4-supdance.8

完整合并上游 v1.7.3.7 与 Schema 82；使用原生中英法德日韩语言、共用登录面板。移除旧全页 DOM 翻译与上游词条覆盖，扩展词条使用原生 i18next 独立 namespace。保留音乐、社交登录、品牌、法务与视觉引擎。验证及发布边界见 `NATIVE_I18N_UPSTREAM_SYNC.md`。

网站集成补充音乐1.3.0／RunningHub1.1.2、电商与小说改编六语、访客入口与页脚、原有模型与法律模板品牌行为。业务 Schema 83 增加文本上下文售价／成本分档与一小时缓存写入子集；公开价表补齐25条文本计费项目。Waffo生成前提示词筛查默认关闭，商户配置、外发授权和运行验收独立记录。具体证据与未完成项见 `SITE_CLOSURE.md`。


本文件专用于记录 SupDance 二次开发架构、扩展模块、自定义插件与上游版本同步记录。上游核心功能变更请查阅仓库根目录 [`CHANGELOG.md`](../../CHANGELOG.md)。

---

## 音乐工作台 1.2.1 — 平台渠道与真实账务

- 修复与上游通用素材恢复的重复写入冲突：音乐任务素材统一由后端创建稳定 ID，移除前端随机副本桥接，历史恢复和轮询不再新增素材。已有重复条目保留，避免未检查引用就删除用户数据。
- 独立音乐工作台使用后台配置的音乐目录、统一音频任务与实时报价；移除固定供应商目录、按秒假估价及未支持的转码下载入口。
- RunningHub Standard 1.1.1 支持 Suno、Mureka 和 MiniMax Music 的独立字段映射，过滤 Suno 封面及空 URL 文本。
- 创作页音乐模型按品牌归组去重，增加目标时长滑块；音乐结果使用正确文案和可收缩播放器标题。
- 保留旧音乐专用服务与历史表，不迁移历史账本；当前候选的运行态范围以待测试清单为准。
## 音乐工作台 1.3.0 候选 — 主站任务、归档与统一后台

- 独立音乐工作台使用后台配置的音乐目录、统一音频任务与实时报价；移除固定供应商目录、按秒假估价及未支持的转码下载入口。
- RunningHub Standard 1.1.2 对已接通的 Suno/Mureka 音乐操作使用分离轮询，保留真实歌词换行、独立风格与原生 instrumental，过滤封面和无 URL 文本。
- 工作岛按能力展示表单、实时费用与余额，提供作品分组、详情、单一播放器、窄屏切换和六语词条，不承诺未接通时长、人声或转码。
- 统一后台接入主站任务和实际账务；原测试器跳转显示报价的测试中心。旧日志回执只恢复查询及归档；生命周期事务与卸载保留配置、作品、用户偏好和流水。
- 本地真实 A/B 生成共结算 27.8 积分，生产未发布。执行范围、浏览器下载策略限制和未验项见 `music-studio/VERIFICATION.md`。

## v1.7.4-supdance.7 — 完整上游同步

- 修复画布快照节流把同步准备开销计入最短间隔的问题；真实请求间距仍遵守配置，不放宽测试断言。
- 修复取消意图已保存后清理阶段的并发 revision 冲突，使用有界重读重试，保留幂等事件、已提交媒体任务和原有账务策略。
- 合并正式版 v1.7.3.5 与 main@8de0a239，目标 Schema 81，保留 SupDance 插件、Codex 连接和前期 UI 适配。
- 新增独立多语言桥接：插件发布词条优先，保留繁体中文/西班牙语和停用中文回退；同步上游支付/TOS 新合同。
- PostgreSQL 备份恢复、迁移和运行态部署分别验收，结果见完整集成记录；真实计费与外部 OAuth 不属于本次自动验证范围。

## v1.7.4-supdance.6 — 国际化插件 1.2.0

- 新增源码 AST 增量扫描、源文/译文 hash 基线、静态引用检查、上游 Release 差异报告及无付费字段草稿；可选模型补译需要明确字符预算和独立受控配置。
- 后台翻译更新中心支持草稿编辑、六语种校验、审核发布、人工锁定和最近十次发布前快照恢复。所有词条写路径共享行锁，发布/回滚与审计原子提交。
- 前后端生成脚本直接加载模块，避免格式化后漏读；修复零预算扫描门禁、连续 DOM 批次丢失、部分语种更新覆盖人工翻译，增加 alt、显式 key、用户内容隔离及语言包错误反馈。
- 插件版本、公开 bundle、导出版本与应用版本同步更新；数据库不新增表或 schema 迁移，使用独立 SystemSetting 键。
- 验证与部署结果以本次交付记录为准；未执行真实付费模型补译。

## v1.7.4-supdance.2 — 上游 v1.7.3.4 集成

- 从已提交发布分支 v1.7.4-supdance.1 合并上游 dc035d51，保持三个自定义插件的业务逻辑、清单和已保存配置合同；原有检查问题仅做格式、字号 token 与测试时钟/超时修正。
- 保留多语言挂载点、社交登录和音乐工作台路由；后台采用上游分组导航并保留插件管理入口。
- 本机 Codex 连接器迁入 Agent 设置「工具与连接」，与新增云端消息队列分别派发。
- 上游数据库版本为 78。本记录为源码集成，生产备份、恢复、迁移、部署与真实业务验收另行执行。
- 并行插件任务的未提交代码和未发布修复分支不纳入本次集成。
- 详细边界、冲突处理和部署要求见 [源码同步记录](./UPSTREAM_SYNC_v1.7.3.4.md)。

## [supdance/v2026.11.01.1] — 2026-11-01

### 浏览器 UI 验收驱动的插件生效判定修复（P1）
- **现象**：登录后访问 `/toolbox/music` 被 `RequirePlugin` 整页拦截为"Supdance音乐音频生成已停用"，侧栏"音乐生成"入口与创作岛"音乐"药丸同时消失；而服务端 `/api/plugins/status` 中 `supdance-music-generation.effectiveEnabled=true`。
- **根因**：路由守卫与入口显隐读取了错误的插件身份——别名 `music-generation`（后端曾为其登记幽灵策略，服务端状态默认未激活）或本地安装记录（`ensurePlugin` 新建记录默认 `enabled=false`），未以服务端 `effectiveEnabled` 为权威结论。
- **修复**：
  - `web/src/stores/use-plugin-store.ts` 新增 `selectPluginEffectivelyEnabled(pluginId, unknownFallback)`，统一判定顺序：服务端 states → 运行时 statuses → 本地安装记录 → unknownFallback。
  - `web/src/components/auth/require-plugin.tsx` 改用统一选择器（服务端状态未就绪时放行，后端 `CheckMusicTaskAdmission` 仍是最终准入闸门），停用文案区分"用户可自行开启（前往插件中心）"与"管理员统一停用"。
  - `web/src/router.tsx`、`web/src/components/layout/workspace-sidebar-nav.tsx`、`web/src/pages/create/creation-workspace.tsx` 统一改用清单 id `SUPDANCE_MUSIC_PLUGIN_ID`。
  - 后端移除幽灵别名策略 `PluginSupDanceMusicAlias`（`backend/internal/app/supdance_music_plugin.go`、`backend/internal/service/aliases_supdance.go`），`/api/plugins/status` 不再暴露无清单、无入口、默认未激活的 `music-generation` 身份。
- **登记**：新增补丁 ID `supdance-music-plugin-gates`，同步 `SUPDANCE_UPSTREAM_PATCH_REGISTRY`、`supdance/config/baseline.json` 与 `docs/supdance/CUSTOMIZATIONS.md`。
- **验证**：真实 Chrome 验收 `/toolbox/music` 暗/亮两主题三栏工作台渲染、"停用 → 守卫页 → 再启用"回环、`/create` 音乐药丸与侧栏入口恢复；`web/test/supdance-*` 10 个文件 70 项通过；`bun run typecheck` 通过；`backend go build ./...` 与 `go test ./internal/app/... ./internal/service/... ./internal/supdance/...` 通过。

### 生产发布（先演练后切换）
- **发布内容**：`bc5ebcf7`（`supdance/main`）以服务器本地构建镜像 `supdance-canvas-backend:bc5ebcf7` / `supdance-canvas-web:bc5ebcf7` + 宿主发布产物 `yingce-backend-1.7.3-supdance-v4` / `releases/1.7.3-supdance-v6` 上线 `43.133.253.76` 主栈 `y-supdance-canvas`；`yingce-agent` 镜像与其余 `.env` 键未变更。
- **门禁**：隔离演练栈（`127.0.0.1:3270/3271`，独立数据库与卷）先完成 `migrate` 与真实浏览器验收；生产 `pg_dump` 恢复到演练库后执行新镜像 `migrate-schema up`，迁移台账与生产逐行一致 → 本次发布零 Schema 变更；切换前完成数据库 custom-format + plain 双备份。
- **验证**：生产 `/api/health/ready` 为 `v1.7.3` / `schema 77/77 ready`；`https://www.supdance.com/toolbox/music` 真实浏览器渲染工作台；`/api/plugins/status` 仅返回 `supdance-music-generation`（幻影别名消失）；旧入口 chunk 仍保留可访问。完整坐标、回滚方式与遗留风险见 [`DEPLOYMENT.md`](./DEPLOYMENT.md) 第 4 节。

## [supdance/v2026.10.31.1] — 2026-10-31

### 自研插件规范化审计与上游兼容性加固 V2.0
- **插件显示名称规范化（内部唯一 ID 保持不变，无数据迁移）**：
  - `supdance-social-auth`：`第三方社交统一登录 (Social Auth)` → `Supdance社交登录配置`。
  - `supdance-music-generation`：`AI 音乐生成 (Music Studio)` → `Supdance音乐音频生成`。
  - `supdance-i18n`：`站点多语言与实时词条中心` → `Supdance国际化`。
- **版本升级（SemVer MINOR：`1.0.0` → `1.1.0`）**：三个插件的前端 Manifest、`supdance/plugins/*/manifest.json` 包清单、后台词条导出回退版本与 `docs/content/docs/plugins/music-generation-lifecycle.mdx` 示例同步升级；`publishedAt` 保留原值，`updatedAt` 更新为 `2026-10-31`。
- **清单契约统一**：`supdance-social-auth` 前端 Manifest 由 `yingce.plugin/v1` 升级为 `yingce.plugin/v2`，补齐 `minHostVersion: 1.7.1`、`runtime: { backend: declarative, web: declarative }` 与后台配置命令声明（`supdance-social-auth.admin-settings`），三个插件自此遵循同一套标准插件结构；包清单权限声明与前端 Manifest 对齐为 `canvas.read`。
- **兼容性登记表补全**：`docs/supdance/PLUGIN_COMPATIBILITY.md` 补齐 `supdance-social-auth` 与 `supdance-music-generation` 登记行并更新 `supdance-i18n` 版本与测试证据。
- **文档体系**：新增 `docs/plugins/` 插件规范目录（README、PLUGIN_COMPATIBILITY、PLUGIN_LIFECYCLE、PLUGIN_VERSIONING、UPSTREAM_UPDATE、PLUGIN_AUDIT_REPORT、PLUGIN_TEST_REPORT），与 `docs/supdance/` 既有文档交叉引用、不重复不冲突。
- **验证**：`web/test/supdance-*` 10 个测试文件 70 项全部通过（含清单挑战者、生命周期升级/降级拒绝、扩展隔离与上游补丁注册表对齐校验）；`backend go test ./internal/supdance/...` 全部通过；`bun run typecheck` 通过；未改动任何上游核心源码文件。

## [supdance/v2026.10.29.1] — 2026-10-29

### 上游基线深度同步
- **Tag**: `v1.7.3`
- **Commit**: `0a6f7c4d345d75e9f5f596644c88410e63bb1bc6`（含正式 Release `v1.7.3` 与最新修复）
- **Database Schema**: `77`

### 深度升级与插件适配 (Upgrade & Plugins Adaptation)
- **上游核心功能深度集成**：
  - 合并上游 `v1.7.3` 官方 Release 及后续提交（22 个 Commit，419 个变更文件），包括：
    - Schema 75-77：用户分组体系、分组渠道权限、模型倍率与多币种计价（`models_user_group.go` 等）。
    - 短剧精修画布投送与采用、分集方式、制作台并行出片与提示词参考图引用约束。
    - 云端 Agent 个人记忆文件（`agent_memory_document`）、技能目录自动发现与推荐安装、回复选项卡与右侧停靠。
    - 全站统一墨色主按钮与实体次要按钮规范（`button-tokens.css`）。
    - 插件宿主素材上传、幂等交单与分离式回查。
    - xAI 视频协议嵌套 video.url 结果提取及 Pi 工具批次查看图片补送修复。
- **两大自研插件深度适配与兼容保障**：
  - **站点多语言与实时词条插件 (`supdance-i18n`)**：
    - 适配上游新增的用户分组体系（`<UserGroupAvatarRing>`、`<UserGroupBadge>`）、个人记忆文件面板、短剧精修画布及导航栏重构。
    - 词典新增 `admin.user_groups`、`admin.user_group_manage`、`admin.user_group_badge`、`settings.agent_memory_doc`、`projects.drama_refine_canvas`、`projects.drama_send_to_canvas`、`projects.drama_apply_canvas`、`projects.drama_parallel_produce`、`projects.drama_episode_split`、`skills.recommend_install` 等核心词条并覆盖全部 6 国语言（简中、英语、繁中、日文、韩文、西语）。
    - 保留全站动态 DOM 翻译观察器 (`dom-observer.ts`)，对上游所有新增页面与动态卡片提供零侵入自动翻译支持。
  - **统一第三方社交登录插件 (`supdance-social-auth`) 区域识别与热插拔重构**：
    - 彻底移除前台登录页用户区域切换按钮（「当前显示国内渠道 · 切换至国际登录」及空白态切换），前台严格依服务端高精度 IP 判定结果直接呈现，杜绝用户手动越界。
    - 根治 IP 误判技术根因：废除原粗暴 `/8` CIDR 段（修复日本、韩国、澳大利亚、新加坡等海外公网 IP 误判大陆问题），构建基于 APNIC 官方授权数据的高精度内存二分查找库（IPv4 匹配平均耗时 <20ns，零堆内存分配；IPv6 全面覆盖中国电信、中国移动、中国联通与教育科研网前缀）；支持 Cloudflare、AWS CloudFront、阿里云 CDN 等多边缘权威国家标头，港澳台（HK/MO/TW）及海外 IP 严格归入国际渠道。
    - 严格遵循插件热插拔规范：后端新增 `SocialAuthPluginAvailable()` 平台守卫，后台停用插件时前后台双向即时熔断；公开接口收敛为仅返回当前访客合规渠道，禁止泄露异区渠道配置。
    - 登录页表单联动：无可用渠道或插件停用时干净收起分割线，绝不悬挂多余视觉元素。
    - 8 大平台（微信、QQ、抖音、B站、Google、X、Instagram、TikTok）及 IP 分区检测机制运行稳定。
- **治理与基线对齐**：
  - 更新 `supdance/config/baseline.json` 与 `UPSTREAM_BASELINE.md` 至 `v1.7.3`（Schema 77）。
  - 更新 `web/src/supdance/adapters/compatibility.ts` 的 `SUPDANCE_HOST_VERSION` 至 `1.7.3`，并更新所有补丁基线。
  - 运行并通过全站 2910+ 前端测试与后端全量测试套件，Prettier 与 ESLint 检查全部通过。

## [supdance/v2026.10.27.1] — 2026-10-27

### 上游基线
- **Tag**: `v1.7.1`
- **Commit**: `89fcb53fd65969cb58ae1eba5d18381db51819d1`
- **Database Schema**: `71`

### 新增与初始化 (Added)
- **Git 维护体系**：
  - 配置 `origin` (`Blacklake-Go/open-ai-canvas`) 与 `upstream` (`ddcat-ai/open-ai-canvas`) 双远程并恢复完整提交历史。
  - 建立 `supdance/main` 长期产品主分支与 `supdance/v2026.10.27.1` 附注发布标签。
- **SupDance 独立扩展架构 (`Upstream Core + SupDance Extensions + Compatibility Adapters`)**：
  - 前端扩展命名空间 `web/src/supdance/`：包含 `supdance-studio` 三层令牌主题预设 (`theme/supdance-skin.ts`)、路由防冲突合并与插件 Manifest 兼容校验及上游补丁注册表 (`adapters/compatibility.ts`)、功能开关注册表 (`registry/index.ts`)。
  - 后端扩展命名空间 `backend/internal/supdance/`：包含表名前缀 (`supdance_`) 与插件 ID 前缀 (`supdance-`) 领域约束 (`domain/extension.go`) 及宿主 API 兼容性适配器 (`adapters/compatibility.go`)。
  - 自定义插件模板：`supdance/plugins/supdance-workflow-assistant/`（遵循 `yingce.plugin/v2` 清单契约）。
- **自动化上游同步与 CI 门禁**：
  - 新增 `supdance/config/baseline.json`、`tools/supdance/check_upstream.py`、`tools/supdance/prepare_integration.sh` 及单元测试 `tools/supdance/test_check_upstream.py`。
  - 新增 `.github/workflows/supdance-upstream-sync.yml`，支持每日定期检查上游正式 Release、生成 `UPSTREAM_UPDATE_REPORT.md` 报告及运行前后端扩展隔离测试。
- **本机 SupDance Canvas Agent (Codex) 连接器**（移植自 `6825bcd8`）：
  - 在 `v1.7.1` 云端 Agent 面板底部接入本机 Codex 连接器发现、配对、SSE 流与对话控制。
- **站点多语言与实时词条中心插件 (`supdance-i18n`)**：
  - 支持在后台「插件管理」(`/admin/plugins`) 一键开启或关闭，停用时卸载顶栏入口并无损回滚全站 DOM 为默认简体中文。
  - 在站点右上角（工作台顶栏、登录注册页、自由画布顶栏、管理后台顶栏）挂载语言切换图标，覆盖简体中文 (`zh-CN`)、英语 (`en-US`)、繁体中文 (`zh-TW`)、日文 (`ja-JP`)、韩国语 (`ko-KR`)、西班牙语 (`es-ES`) 六大语种。
  - 采用混合响应式 i18n 架构（Key-Value 词典 + ICU 参数插值 + Ant Design `ConfigProvider` Locale 联动 + `WeakMap` 零侵入响应式 DOM 观察器）。
  - 新增后台「语言管理设置」页面 (`/admin/i18n/settings`) 与「多语言词条与字段修改」页面 (`/admin/i18n/entries`)，支持随时在线编辑或新增六语词条并实时热生效，支持 JSON 词库导入导出。
- **维护文档体系 (`docs/supdance/`)**：
  - 建立 `INITIAL_AUDIT.md`、`WORKSPACE.md`、`ARCHITECTURE.md`、`UPSTREAM_BASELINE.md`、`UPSTREAM_SYNC.md`、`CUSTOMIZATIONS.md`、`PLUGIN_COMPATIBILITY.md`、`DEPLOYMENT.md`、`RECOVERY.md` 与 `CHANGELOG.md`。
# 全站过渡动效开关

- 补全视觉引擎现有 `motion.enabled` 总开关，新配置默认关闭；覆盖 CSS 与现有 Motion 库，停用插件时清理，页面规则不能重新开启。
- 关闭时复用上游 Logo、三点与「正在打开页面」加载组件，跳过插件额外恢复动画；未新增上游没有的路由动画。
- 保留已有发布配置，无数据库迁移；实际页面与服务器发布仍待验收，详见待测试清单。
## X 付款成功衡量接入

- 用户同意后的 X Pixel 与 Purchase 事件，独立文档隔离工作台 URL；金额和币种来自服务端确认的订单，去重摘要不暴露内部订单号。
- 沙盒、历史、未确认与无效金额订单不发送；广告衡量失败不改变支付结果。
- 新增六语言同意与撤回入口，更新隐私说明；测试、部署和真实购买验收分别记录在 `X_PURCHASE_MEASUREMENT.md`。
