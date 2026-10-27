# SupDance Canvas — 定制维护变更日志 (CHANGELOG.md)

本文件专用于记录 SupDance 二次开发架构、扩展模块、自定义插件与上游版本同步记录。上游核心功能变更请查阅仓库根目录 [`CHANGELOG.md`](../../CHANGELOG.md)。

---

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
