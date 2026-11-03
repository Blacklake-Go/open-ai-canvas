# SupDance 上游源码同步与差异清单

## 基线与结果

- 上游：`ddcat-ai/open-ai-canvas` 的 `main`，固定提交 `4d25e4a547fccdf8bf9bded53939a3378708ebb6`，版本 `v1.7.3.4`。
- 维护仓库：`Blacklake-Go/open-ai-canvas`，目标分支 `main`。
- 原工作区提交：`04f8cc6c`；更新前源码检查点：`19ff061a`。
- 合并提交：`be14d04c`，保留检查点与上游两个父提交。后续兼容回归修复：`5a937da8`。
- 合并包含 52 个原工作区缺少的上游提交。上游提交是当前结果的祖先；未用文件覆盖替代 Git 合并。
- 宿主 schema 基线为 78。兼容层元数据原来仍指向 77，现已对齐；本轮未执行生产数据库迁移。

## 升级内容

保留上游的后台分组折叠、页面预取和懒加载、创作生成工作台、画布提示词与字号、分镜和短剧、资源导入恢复、任务与 Agent 修复，以及新增的 Runcrate Chat 协议。上游完整历史可用以下命令核查：

```bash
git log --oneline 04f8cc6c..4d25e4a547fccdf8bf9bded53939a3378708ebb6
git merge-base --is-ancestor 4d25e4a547fccdf8bf9bded53939a3378708ebb6 HEAD
```

## 合并冲突与兼容处理

| 文件 | 合并处理 |
| --- | --- |
| `web/src/router.tsx` | 保留 Router 内的 AppProviders 与全部 SupDance 路由；接入上游 lazyAdminPage；前台模型功能关闭后仍允许管理员进入模型目录配置。 |
| `web/src/pages/admin/components/admin-shell.tsx` | 保留上游可折叠分组、菜单预取与面包屑；视觉引擎按新分组 key `creation` 插入，启停同步作用于桌面、移动端和面包屑，优先匹配具体插件路径。 |
| `web/src/styles/globals.css` | 保留上游组件规则，合并视觉引擎的文字保护渐变变量。 |
| `docs/content/docs/progress/pending-test.mdx` | 保留上游与 SupDance 双方的验收记录。 |

回归中补齐创作页实际调用但缺失的 35 个词条，覆盖简中、英文、繁中、日文、韩文与西文，并同步前后端词库。社交登录测试更新为当前浏览器绑定、待入站票据、条款确认、受限回调地址、实测连通性和中央赠额策略的合同；没有放宽业务安全校验。新增视觉引擎导航与实际面包屑渲染测试。

## 二开边界与保留情况

插件源码集中在 `web/src/supdance/`、`backend/internal/supdance/` 与 `supdance/`。本轮没有删除检查点中的插件文件，RunningHub 的协议源码与发行包也已保留。

独立目录之外仍有宿主文件的适配修改，包括 Provider、Router、后台导航、登录与会话、公开模型目录、外观元数据、仓储与插件状态。将这些改动纳入后续上游冲突检查，不能仅备份独立插件目录。

`SUPDANCE_UPSTREAM_PATCH_REGISTRY` 与旧 `CUSTOMIZATIONS.md` 含历史设计记录，部分 Codex 连接器路径在当前检查点中不存在。实际文件边界以本清单和 `supdance/config/baseline.json` 为准。

### 已知验收边界

- 此交付验证源码合并、前端构建、插件域、权限与整站自动化回归。未执行付费生成或真实第三方 OAuth 授权。
- 更新前检查点的 `RegisterCanvasAPI` 即未调用 `RegisterSupDanceI18nRoutes` 和 `RegisterSocialAuthRoutes`；本轮保留该现状。这些源文件存在不代表其 HTTP 路由已生效，也不代表生产环境中的插件已经验收。
- 工作流助手只有清单与说明，不能把它计作已完成的运行时插件。
- 生产服务器的运行版本、配置和数据库需以独立部署验收为准，不能由 Git 合并、单测或静态构建推断。

## 差异分类

分类以每个文件唯一归类，统计基于上游固定提交与本次结果。

| 分类 | 文件数 |
| --- | ---: |
| 宿主修改 | 44 |
| 测试 | 18 |
| 新增后端适配与测试 | 14 |
| 独立插件与命名空间 | 164 |
| 文档 | 6 |
| RunningHub 协议插件 | 4 |
| 其他新增前端适配与资源 | 5 |
| 合计 | 255 |

新增 200 个文件，修改 55 个上游已有文件；无上游文件删除。完整路径如下。

## 逐文件差异

`A` 为相对上游新增，`M` 为修改上游已有文件。源码与插件清单、测试、文档均列入，生产数据和构建产物不作为新增源码提交。

| 状态 | 分类 | 路径 |
| --- | --- | --- |
| M | 宿主修改 | `.gitignore` |
| M | 宿主修改 | `backend/internal/app/appearance.go` |
| M | 测试 | `backend/internal/app/appearance_live2d_test.go` |
| M | 宿主修改 | `backend/internal/app/plugin_management.go` |
| A | 新增后端适配与测试 | `backend/internal/app/supdance_html_page_manager_plugin.go` |
| A | 新增后端适配与测试 | `backend/internal/app/supdance_html_page_manager_plugin_test.go` |
| A | 新增后端适配与测试 | `backend/internal/app/supdance_i18n_plugin.go` |
| A | 新增后端适配与测试 | `backend/internal/app/supdance_i18n_plugin_test.go` |
| A | 新增后端适配与测试 | `backend/internal/app/supdance_music_plugin.go` |
| A | 新增后端适配与测试 | `backend/internal/app/supdance_social_auth_plugin.go` |
| A | 新增后端适配与测试 | `backend/internal/app/supdance_social_auth_plugin_test.go` |
| A | 新增后端适配与测试 | `backend/internal/app/supdance_visual_engine_plugin.go` |
| A | 新增后端适配与测试 | `backend/internal/app/supdance_visual_engine_plugin_test.go` |
| M | 宿主修改 | `backend/internal/app/user_groups.go` |
| M | 宿主修改 | `backend/internal/auth/auth.go` |
| M | 宿主修改 | `backend/internal/auth/login_logs.go` |
| M | 宿主修改 | `backend/internal/handler/api.go` |
| M | 测试 | `backend/internal/handler/credit_cost_routes_test.go` |
| M | 宿主修改 | `backend/internal/handler/model_catalog.go` |
| M | 宿主修改 | `backend/internal/handler/openapi.yaml` |
| A | 新增后端适配与测试 | `backend/internal/handler/social_auth.go` |
| A | 新增后端适配与测试 | `backend/internal/handler/supdance_html_page_manager.go` |
| A | 新增后端适配与测试 | `backend/internal/handler/supdance_i18n.go` |
| A | 新增后端适配与测试 | `backend/internal/handler/supdance_visual_engine.go` |
| M | 宿主修改 | `backend/internal/repository/oauth.go` |
| M | 宿主修改 | `backend/internal/repository/repository.go` |
| M | 宿主修改 | `backend/internal/repository/repository_channels_settings.go` |
| A | 新增后端适配与测试 | `backend/internal/service/aliases_supdance.go` |
| A | 独立插件与命名空间 | `backend/internal/supdance/adapters/compatibility.go` |
| A | 独立插件与命名空间 | `backend/internal/supdance/adapters/compatibility_test.go` |
| A | 独立插件与命名空间 | `backend/internal/supdance/domain/extension.go` |
| A | 独立插件与命名空间 | `backend/internal/supdance/i18n/defaults.go` |
| A | 独立插件与命名空间 | `backend/internal/supdance/i18n/manager.go` |
| A | 独立插件与命名空间 | `backend/internal/supdance/i18n/manager_test.go` |
| A | 独立插件与命名空间 | `backend/internal/supdance/i18n/types.go` |
| A | 独立插件与命名空间 | `backend/internal/supdance/music/adapter.go` |
| A | 独立插件与命名空间 | `backend/internal/supdance/music/adapter_test.go` |
| A | 独立插件与命名空间 | `backend/internal/supdance/music/capabilities.go` |
| A | 独立插件与命名空间 | `backend/internal/supdance/music/capabilities_test.go` |
| A | 独立插件与命名空间 | `backend/internal/supdance/music/client.go` |
| A | 独立插件与命名空间 | `backend/internal/supdance/music/client_test.go` |
| A | 独立插件与命名空间 | `backend/internal/supdance/music/config.go` |
| A | 独立插件与命名空间 | `backend/internal/supdance/music/lifecycle_test.go` |
| A | 独立插件与命名空间 | `backend/internal/supdance/music/models.go` |
| A | 独立插件与命名空间 | `backend/internal/supdance/music/repository.go` |
| A | 独立插件与命名空间 | `backend/internal/supdance/music/service.go` |
| A | 独立插件与命名空间 | `backend/internal/supdance/music/service_test.go` |
| A | 独立插件与命名空间 | `backend/internal/supdance/music/transcoder.go` |
| A | 独立插件与命名空间 | `backend/internal/supdance/music/transcoder_test.go` |
| A | 独立插件与命名空间 | `backend/internal/supdance/music/vault.go` |
| A | 独立插件与命名空间 | `backend/internal/supdance/music/vault_test.go` |
| A | 独立插件与命名空间 | `backend/internal/supdance/socialauth/adversarial_stress_test.go` |
| A | 独立插件与命名空间 | `backend/internal/supdance/socialauth/apnic_data.go` |
| A | 独立插件与命名空间 | `backend/internal/supdance/socialauth/callback_security_test.go` |
| A | 独立插件与命名空间 | `backend/internal/supdance/socialauth/geoip.go` |
| A | 独立插件与命名空间 | `backend/internal/supdance/socialauth/live_payload_contract_test.go` |
| A | 独立插件与命名空间 | `backend/internal/supdance/socialauth/oauth_exchange.go` |
| A | 独立插件与命名空间 | `backend/internal/supdance/socialauth/onboarding_and_linking_test.go` |
| A | 独立插件与命名空间 | `backend/internal/supdance/socialauth/providers.go` |
| A | 独立插件与命名空间 | `backend/internal/supdance/socialauth/service.go` |
| A | 独立插件与命名空间 | `backend/internal/supdance/socialauth/service_test.go` |
| A | 独立插件与命名空间 | `backend/internal/supdance/socialauth/ticket_store.go` |
| A | 独立插件与命名空间 | `backend/internal/supdance/socialauth/ticket_store_test.go` |
| A | 独立插件与命名空间 | `backend/internal/supdance/socialauth/types.go` |
| A | 独立插件与命名空间 | `backend/internal/supdance/visualengine/publication.go` |
| A | 独立插件与命名空间 | `backend/internal/supdance/visualengine/publication_test.go` |
| A | 独立插件与命名空间 | `backend/internal/supdance/visualengine/service.go` |
| A | 独立插件与命名空间 | `backend/internal/supdance/visualengine/types.go` |
| A | 独立插件与命名空间 | `backend/internal/supdance/visualengine/validation.go` |
| M | 文档 | `docs/content/docs/backend/backend-database.mdx` |
| M | 文档 | `docs/content/docs/backend/http-api.mdx` |
| M | 文档 | `docs/content/docs/progress/pending-test.mdx` |
| M | 文档 | `docs/index.md` |
| A | 文档 | `docs/supdance/CUSTOMIZATIONS.md` |
| A | 文档 | `docs/supdance/UPSTREAM_SYNC.md` |
| A | RunningHub 协议插件 | `plugin-packages/runninghub-standard.yingce-plugin` |
| A | RunningHub 协议插件 | `plugin-packages/runninghub-standard/README.md` |
| A | RunningHub 协议插件 | `plugin-packages/runninghub-standard/docs/interface.md` |
| A | RunningHub 协议插件 | `plugin-packages/runninghub-standard/manifest.json` |
| A | 独立插件与命名空间 | `supdance/config/baseline.json` |
| A | 独立插件与命名空间 | `supdance/plugins/supdance-i18n/README.md` |
| A | 独立插件与命名空间 | `supdance/plugins/supdance-i18n/manifest.json` |
| A | 独立插件与命名空间 | `supdance/plugins/supdance-music-generation/manifest.json` |
| A | 独立插件与命名空间 | `supdance/plugins/supdance-social-auth/README.md` |
| A | 独立插件与命名空间 | `supdance/plugins/supdance-social-auth/manifest.json` |
| A | 独立插件与命名空间 | `supdance/plugins/supdance-visual-engine/README.md` |
| A | 独立插件与命名空间 | `supdance/plugins/supdance-visual-engine/manifest.json` |
| A | 独立插件与命名空间 | `supdance/plugins/supdance-workflow-assistant/README.md` |
| A | 独立插件与命名空间 | `supdance/plugins/supdance-workflow-assistant/manifest.json` |
| M | 宿主修改 | `web/index.html` |
| A | 其他新增前端适配与资源 | `web/public/robots.txt` |
| A | 其他新增前端适配与资源 | `web/public/sitemap.xml` |
| M | 宿主修改 | `web/src/application.tsx` |
| M | 宿主修改 | `web/src/components/auth/auth-session-hydrator.tsx` |
| M | 宿主修改 | `web/src/components/layout/app-providers.tsx` |
| M | 宿主修改 | `web/src/components/layout/client-root-init.tsx` |
| M | 宿主修改 | `web/src/components/layout/site-compliance-footer.tsx` |
| A | 其他新增前端适配与资源 | `web/src/components/layout/user-profile-modal.tsx` |
| M | 宿主修改 | `web/src/components/layout/workspace-account-card.css` |
| M | 宿主修改 | `web/src/components/layout/workspace-account-card.tsx` |
| M | 宿主修改 | `web/src/components/layout/workspace-sidebar-footer.tsx` |
| M | 宿主修改 | `web/src/components/layout/workspace-sidebar-storage-meter.tsx` |
| M | 宿主修改 | `web/src/components/layout/workspace-top-bar.tsx` |
| M | 宿主修改 | `web/src/components/ui/product/app-drawer/app-drawer.tsx` |
| M | 宿主修改 | `web/src/components/ui/product/app-modal/app-modal.tsx` |
| M | 宿主修改 | `web/src/lib/plugins/builtin/index.ts` |
| M | 宿主修改 | `web/src/lib/plugins/official-applications.ts` |
| A | 其他新增前端适配与资源 | `web/src/lib/session-recovery.ts` |
| M | 宿主修改 | `web/src/lib/user-session.ts` |
| M | 宿主修改 | `web/src/pages/admin/components/admin-shell.tsx` |
| M | 宿主修改 | `web/src/pages/admin/plugins/plugins-page.tsx` |
| M | 宿主修改 | `web/src/pages/auth/login.tsx` |
| M | 宿主修改 | `web/src/pages/auth/register.tsx` |
| M | 宿主修改 | `web/src/pages/create/creation-recent-canvases.tsx` |
| M | 宿主修改 | `web/src/pages/create/creation-workspace-empty.tsx` |
| M | 宿主修改 | `web/src/pages/create/creation-workspace.tsx` |
| M | 宿主修改 | `web/src/pages/create/index.tsx` |
| M | 宿主修改 | `web/src/pages/inspirations/index.tsx` |
| M | 宿主修改 | `web/src/pages/plugins/index.tsx` |
| M | 宿主修改 | `web/src/pages/settings/profile-pane.tsx` |
| M | 宿主修改 | `web/src/router.tsx` |
| M | 宿主修改 | `web/src/services/api/plugins.ts` |
| M | 宿主修改 | `web/src/stores/use-appearance-store.ts` |
| M | 宿主修改 | `web/src/stores/use-plugin-store.ts` |
| A | 其他新增前端适配与资源 | `web/src/stores/use-user-profile-modal-store.ts` |
| M | 宿主修改 | `web/src/styles/globals.css` |
| A | 独立插件与命名空间 | `web/src/supdance/adapters/compatibility.ts` |
| A | 独立插件与命名空间 | `web/src/supdance/adapters/plugin-runtime-sync.tsx` |
| A | 独立插件与命名空间 | `web/src/supdance/adapters/plugin-state-sync.ts` |
| A | 独立插件与命名空间 | `web/src/supdance/pages/dark-login-page.tsx` |
| A | 独立插件与命名空间 | `web/src/supdance/pages/legal/aup-page.tsx` |
| A | 独立插件与命名空间 | `web/src/supdance/pages/legal/legal-hub-page.tsx` |
| A | 独立插件与命名空间 | `web/src/supdance/pages/legal/legal-i18n-content.ts` |
| A | 独立插件与命名空间 | `web/src/supdance/pages/legal/legal-meta.ts` |
| A | 独立插件与命名空间 | `web/src/supdance/pages/legal/legal-page.tsx` |
| A | 独立插件与命名空间 | `web/src/supdance/pages/legal/linear-legal-page.tsx` |
| A | 独立插件与命名空间 | `web/src/supdance/pages/legal/privacy-content.ts` |
| A | 独立插件与命名空间 | `web/src/supdance/pages/legal/privacy-page.tsx` |
| A | 独立插件与命名空间 | `web/src/supdance/pages/legal/terms-content.ts` |
| A | 独立插件与命名空间 | `web/src/supdance/pages/legal/terms-page.tsx` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/html-page-manager/admin/html-page-manager.tsx` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/html-page-manager/api.ts` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/html-page-manager/index.ts` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/html-page-manager/manifest.json` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/html-page-manager/templates/index.ts` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/html-page-manager/types.ts` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/i18n/admin/i18n-entries-page.tsx` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/i18n/admin/i18n-settings-page.tsx` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/i18n/api.ts` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/i18n/components/i18n-runtime-host.tsx` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/i18n/components/topbar-language-switcher.tsx` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/i18n/engine/antd-locale.ts` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/i18n/engine/dom-observer.ts` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/i18n/engine/translator.ts` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/i18n/index.ts` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/i18n/locales/index.ts` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/i18n/locales/packs/en-US.ts` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/i18n/locales/packs/es-ES.ts` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/i18n/locales/packs/ja-JP.ts` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/i18n/locales/packs/ko-KR.ts` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/i18n/locales/packs/zh-TW.ts` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/i18n/store.ts` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/i18n/types.ts` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/music-generation/admin/music-admin-settings-page.tsx` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/music-generation/components/lyrics-editor.tsx` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/music-generation/components/music-form.tsx` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/music-generation/components/music-master-stage.tsx` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/music-generation/components/task-card.tsx` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/music-generation/components/waveform-player.tsx` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/music-generation/index.ts` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/music-generation/pages/music-workbench-page.tsx` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/music-generation/services/music-api.ts` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/music-generation/services/music-asset-bridge.ts` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/music-generation/stores/use-music-store.ts` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/music-generation/styles/music-generation.css` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/music-generation/styles/music-workbench.css` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/music-generation/types.ts` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/social-auth/admin/credential-helpers.ts` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/social-auth/admin/provider-credential-modal.tsx` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/social-auth/admin/social-auth-nav-tabs.tsx` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/social-auth/admin/social-auth-operations-page.tsx` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/social-auth/admin/social-auth-settings-page.tsx` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/social-auth/api.ts` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/social-auth/components/social-account-bindings.tsx` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/social-auth/components/social-login-buttons.tsx` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/social-auth/components/social-onboarding-modal.tsx` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/social-auth/components/social-provider-icons.tsx` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/social-auth/index.ts` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/social-auth/types.ts` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/visual-engine/admin/VisualConsole.tsx` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/visual-engine/admin/layouts/console-header.tsx` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/visual-engine/admin/layouts/console-preview-panel.tsx` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/visual-engine/admin/navigation/console-nav.ts` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/visual-engine/admin/pages/AuditLogsPane.tsx` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/visual-engine/admin/pages/ColorsPane.tsx` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/visual-engine/admin/pages/ComponentsPane.tsx` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/visual-engine/admin/pages/DashboardPane.tsx` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/visual-engine/admin/pages/DiagnosticsPane.tsx` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/visual-engine/admin/pages/EffectsPane.tsx` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/visual-engine/admin/pages/InteractionsPane.tsx` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/visual-engine/admin/pages/LoadingPane.tsx` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/visual-engine/admin/pages/MotionPane.tsx` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/visual-engine/admin/pages/PageRulesPane.tsx` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/visual-engine/admin/pages/PresetsPane.tsx` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/visual-engine/admin/pages/PreviewPane.tsx` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/visual-engine/admin/pages/ThemesPane.tsx` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/visual-engine/admin/pages/TransitionsPane.tsx` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/visual-engine/admin/pages/TypographyPane.tsx` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/visual-engine/admin/pages/VersionsPane.tsx` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/visual-engine/api/visual-engine-api.ts` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/visual-engine/config/default-config.ts` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/visual-engine/config/presets/dark-preset.ts` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/visual-engine/config/presets/light-preset.ts` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/visual-engine/config/presets/native-preset.ts` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/visual-engine/config/presets/studio-preset.ts` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/visual-engine/config/schema.ts` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/visual-engine/diagnostics/host-compatibility.ts` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/visual-engine/diagnostics/token-health-check.ts` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/visual-engine/index.ts` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/visual-engine/loading/stage-state-machine.ts` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/visual-engine/loading/workspace-recovery-animator.tsx` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/visual-engine/loading/workspace-recovery-loader.tsx` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/visual-engine/manifest.json` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/visual-engine/motion/motion-constants.ts` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/visual-engine/motion/motion-engine.ts` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/visual-engine/overlays/depth-system.ts` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/visual-engine/overlays/masks-scrims.ts` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/visual-engine/page-rules/page-rules-engine.ts` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/visual-engine/page-rules/rule-matcher.ts` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/visual-engine/runtime/use-visual-engine-policy.ts` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/visual-engine/runtime/visual-engine-runtime-host.tsx` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/visual-engine/storage/visual-engine-store.ts` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/visual-engine/themes/contrast-checker.ts` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/visual-engine/themes/css-variables.ts` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/visual-engine/themes/host-theme.ts` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/visual-engine/themes/theme-engine.ts` |
| A | 独立插件与命名空间 | `web/src/supdance/plugins/visual-engine/types.ts` |
| A | 独立插件与命名空间 | `web/src/supdance/registry/index.ts` |
| A | 独立插件与命名空间 | `web/src/supdance/theme/supdance-skin.ts` |
| M | 测试 | `web/test/admin-ui-regressions.test.ts` |
| M | 测试 | `web/test/app-icon-neutral-bootstrap.test.ts` |
| M | 测试 | `web/test/appearance-bootstrap.test.ts` |
| A | 测试 | `web/test/challenger-m1-empirical-stress.test.tsx` |
| M | 测试 | `web/test/create-library-button.test.ts` |
| A | 测试 | `web/test/e2e/i18n-localization-e2e.test.tsx` |
| A | 测试 | `web/test/i18n-adversarial-challenger.test.tsx` |
| A | 测试 | `web/test/i18n-key-parity.test.ts` |
| A | 测试 | `web/test/i18n-localization-4tier.test.tsx` |
| M | 测试 | `web/test/official-application-plugins.test.ts` |
| A | 测试 | `web/test/social-auth-ux-improvements.test.ts` |
| A | 测试 | `web/test/supdance-i18n-disabled-fallback.test.tsx` |
| A | 测试 | `web/test/supdance-plugin-state-sync.test.ts` |
| A | 测试 | `web/test/supdance-social-auth.test.ts` |
| A | 测试 | `web/test/supdance-visual-engine-regressions.test.tsx` |
| A | 测试 | `web/test/supdance-visual-engine.test.ts` |

## 验证与恢复

推送前运行仓库要求的 `bun scripts/verify-before-push.mjs --jobs 4`，覆盖前端格式、类型、lint、包含 pretest 的全量测试，以及 Go 格式、其他包与 app 四分片测试。另运行 `cd web && bun run build`。最终命令退出码与统计随交付测试报告保存。

本地未覆盖：支付插件 Docker 双架构产物、需要独立 PostgreSQL/Redis 服务的集成用例，以及真实浏览器全站视觉验收；这些不由构建成功代替。

原始未提交文件与二进制差异已在工作区之外备份，并保留 `codex/pre-upstream-20261104-04f8cc6c` 与源码检查点 `19ff061a`。恢复代码时在独立分支操作，禁止覆盖当前业务数据。生产回滚需要使用实际部署保留的镜像和数据库备份，不能用本地 Git 回退代替。
