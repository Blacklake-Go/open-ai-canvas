# ONE 短剧工作坊项目

访问 `/zh/lab` 的「我的项目」，用 ONE 账号创建项目、编辑名称和故事草稿。保存后，`/zh/lab?project=<id>` 可重新打开项目。既有工作坊工具仍在同一页面。

## 数据与接口

`089_workshop_projects.sql` 在 ONE 的 PostgreSQL 中新增 `ai_studio.workshop_projects`。项目属于当前登录的 ONE 用户。列表按创建时间分页，项目详情和写入都以账号和项目 ID 查询。

- `GET /api/workshop/projects?offset=0` 返回个人项目列表。
- `POST /api/workshop/projects` 接收 `title`、`story` 和客户端生成的 UUID `creationKey`。重试沿用同一个 `creationKey`，同一账号只创建一条项目。
- `GET /api/workshop/projects/:id` 返回项目内容和 `revision`。
- `PUT /api/workshop/projects/:id` 接收 `title`、`story` 和读取时的 `revision`。新版本已经写入时，服务端拒绝过期的编辑，编辑页面保留当前草稿供复制。

## 发布与回退

在 ONE 的预生产数据库运行现有迁移任务并核对 `pending=0`、`drifted=0`。部署 ONE 后端和前端后，用两个独立帐号分别验证保存、深层链接刷新和访问权限。

需要回退时恢复上一个 ONE 前后端版本。新增表可以留在数据库中保全已经保存的故事。恢复数据库备份前先单独保留这张表的数据。
