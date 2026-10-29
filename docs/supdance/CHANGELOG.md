# SupDance Canvas — 定制维护变更日志 (CHANGELOG.md)

本文件专用于记录 SupDance 二次开发架构、扩展模块、自定义插件与上游版本同步记录。上游核心功能变更请查阅仓库根目录 [`CHANGELOG.md`](../../CHANGELOG.md)。

---

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
  - **统一第三方社交登录插件 (`supdance-social-auth`)**：
    - 校验在登录页 (`/login`) 与管理后台配置中心 (`/admin/settings/social-auth`) 的挂载点与交互，与全站统一按钮规范（墨色主按钮与实体次要按钮）完美对齐。
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
