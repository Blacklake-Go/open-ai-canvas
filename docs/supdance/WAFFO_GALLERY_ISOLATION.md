# 灵感大厅公开隔离与合规恢复

## 控制入口和权威配置

使用「页面管理 → 模型展示 → 灵感大厅管理」`/admin/plugins/page-management?page=models`。三个开关保存在既有 `system_settings` 的 `plugin.supdance-compact-model-picker.display`，通过既有管理员 API `/api/admin/supdance/compact-model-picker/settings` 读取与保存。模型选择器的启用、说明、价格字段保留原义。

| 字段 | 含义 | 缺失时 |
| --- | --- | --- |
| `showInspirations` | 原有开关，扩展为灵感大厅全局公开开关 | false |
| `homepageShowcaseEnabled` | 首页案例展示，还受全局开关与锁控制 | false |
| `complianceLock` | 合规审核锁；开启时禁止保存公开开启状态 | true |

服务端每次公开请求读取数据库，不缓存公开授权决策；错误时拒绝公开。前端浏览器缓存只保留选择器外观，不能授权公开案例。保存与管理审计使用同一数据库事务。关闭全局开关会将首页展示同时保存为关闭。

## 数据和素材边界

- 原始 `web/public/inspirations/` 与 `web/public/inspiration-thumbs/` 保留源码；Vite 构建移除这两个目录，禁止直接发布原始目录和翻译包。
- 服务器应把原始包和缩略图放在后端数据目录的 `inspiration-archive/inspirations/` 与 `inspiration-archive/inspiration-thumbs/`，不挂载到任何公开 Web 根目录。权限只允许运行后端的用户读取。
- `backend/internal/supdance/gallery` 只读取上述归档和 `inspiration_feed_entries`；不查询、不删除用户项目、任务和个人资源。
- 开启后公开归档的来源目录和已启用的上新。没有个案审核记录的条目按普通目录展示。已有的待审核、限制公开和归档记录继续隐藏，内容变更会使已批准条目失去公开资格。
- 审核记录复用 `system_settings`，键为 `supdance.ir.<ID 的 SHA256>`，总长 76，满足 PostgreSQL 的 varchar(80) 限制。值包含状态、授权依据、内容摘要、管理员与时间，可选替换封面。无需新增表或迁移 Schema。
- 可选替换封面仅接受不带身份凭证、查询参数或片段的 HTTPS URL，或归档内的 `/inspiration-thumbs/` 路径。替换地址与授权依据一同受管理员审计。它不会上传、删除或改写私人资产。

## 公开请求

| 入口 | 执行逻辑 |
| --- | --- |
| `/inspirations`、`/inspirations/` | Nginx 核验全局公开状态，通过后旧页面地址跳到已集成灵感大厅的创作首页；拒绝时 403 |
| `/inspirations/<source>.json` | 反代受控 catalog API，返回符合当前策略的来源条目 |
| `/inspirations/gallery-pool.json` | 按原始精选池顺序返回当前可见条目，首页开关必须开启 |
| `/inspirations/manifest.json` | 返回来源版本、当前可见条目计数和分类标签 |
| `/inspirations/translations/*` | 返回当前可见目录条目及内置原创的已有翻译 |
| `/inspiration-thumbs/*` | 只有当前可见案例引用的归档缩略图可以下载 |
| `/api/public/inspirations/feed` | 与静态目录走同一过滤规则，无公开参数或管理员参数绕过 |
| `/api/public/inspirations/catalog/*`、`media/*` | 直接调用也执行相同策略，禁止绕过 Nginx |

关闭时 catalog、media 和 feed 返回 404，网关应急隔离或回滚保护返回 410。受控返回使用 `Cache-Control: no-store`。已由浏览器下载的历史内容无法远程收回；第三方源站 URL 的撤销需要源站所有者操作，不能声称本平台已经撤销。若部署另有 CDN，必须清除该 CDN 的目录、缩略图和响应缓存，并保留服务商确认凭证。

## 审核与恢复

后台同页展开逐条审核区域，按 ID、标题或正文搜索（每次最多 100 条，可细化搜索）。支持 `pending_review`、`restricted`、`archived`、`approved`；批准必须填写授权或原创依据。每条审核绑定当前内容摘要，正文、标题、封面等原始条目变化会自动失去公开资格。

由管理员确认解锁、按需开启全局和首页，再保存设置。解锁无需逐个批准普通目录，仍需明确确认。已处置的条目继续按原审核记录过滤；调整开关不会改变个案审核记录。素材授权应按来源和用途独立核对。

## 发布、验证和回滚

先备份数据库、配置、原始 Web 文件和后端数据，并验证备份可读取及摘要。对实际生产提交建立独立整改分支；不得用旧工作区覆盖新生产版本。部署前运行专项测试、质量检查、前端构建，并在非生产数据库测试解锁、批准、变更失效和重新关闭。

生产切换前先启用 `tools/supdance/gallery-quarantine.conf`，验证首页正常和内容入口返回 410；它不按 IP、UA 或审核身份区分。切换新后端与 Nginx 后，才能把应急隔离入口交回统一服务端配置。旧静态目录移至受保护归档后再发布新 Web，禁止把旧文件重新复制到公开根目录。

回滚顺序必须先恢复应急隔离网关并通过 Nginx 配置验证，再恢复旧镜像与 Web 构建。保持归档和审核状态，不把旧公开案例包恢复到 Web 根目录。不得用回滚撤销内容整改。无 Schema 变更，不需要数据库降级；恢复全库备份会覆盖新业务数据，不能作为常规应用回滚方式。

真实付费生成、支付、订阅和登录验收与健康检查分开记录。缺少实际运行证据的项目保持未验证。重审说明必须如实区分已隔离的本站 URL、无法控制的第三方源站和待管理员确认的恢复步骤。
