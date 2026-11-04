# 第二阶段：正式上游隔离候选

## 状态

候选以 `eadb3622` 合并正式上游 `v1.7.3.5`（`7c14ffdd8c5480eefc29e6f1ab7da4ef25da2856`），版本标识 `v1.7.4-supdance.6+upstream-stage2`。当前为未提交、未部署的合并结果；第一阶段已部署，线上 backend 与 Schema 仍分别为 `eadb3622`、78。禁止将本候选的 Schema 79 元数据当作线上升级证据。

## 合并与插件保护

九处冲突已处理：CHANGELOG、VERSION、OpenAPI、设置仓储、HTTP API 文档、功能文档、待测文档、侧栏、图片审批测试。设置仓储同时保留 SupDance `LockSystemSetting()` 和上游 `SystemSettingsWithPrefix()`，新增真实数据库事务与前缀转义测试。社交会话桥接、音乐插件路由与导航、翻译和视觉引擎入口保留。

电商侧栏跟随 `ecommerceEnabled`，默认关闭；仅参考正式版后 `e1f8b8c9` 的侧栏开关修复并使用既有 SupDance 词条，不导入整个上游开发分支。第一阶段的历史分页六语按钮、令牌/焦点适配和预演台品牌修复及测试已带入；前端兼容版本和 schema 元数据、baseline、补丁登记同步。正式版自身的部分 OpenAPI 缺失模型定义在候选中补齐，未修改运行时协议。

上游另一套 i18next、易支付扩展、TOS 和 Schema 80/81 不在本候选内。正式版的默认奖励归零、密码登录停止补发仍是本候选包含的业务变化，须验收现有显式策略、社交 onboarding、幂等与失败追踪。

## 实际验证

- 类型检查 `bun run typecheck`：主协作者复核 exit=0，日志 `.local/cache/verify-stage2/typecheck-delivery.log`。
- 前端专项 11 文件、50 pass、0 fail；包含插件隔离、设计规范与本次适配，日志 `.local/cache/verify-stage2/web-targeted.log`。这不等于第二阶段完整前端回归。
- SQLite Schema 79 新建迁移和 78→79 保留迁移历史，两项通过。
- 设置事务锁和转义前缀查询，一项通过。日志 `.local/cache/verify-stage2/backend-minimal.log`。adapters 包在此次过滤下无匹配测试，不计作测试通过数量。
- OpenAPI YAML 可解析，主协作者遍历 346 个内部 `$ref`，未发现未定义引用。
- 初次后端广范围命令因 `GOPROXY=off` 和缺少缓存依赖在 setup 阶段失败；改为在线补齐最小包依赖后，上述三项通过。不据此宣称 app、handler 或全部后端已编译与回归通过。

## 第三阶段上线前门槛

1. 在独立 PostgreSQL 恢复副本执行 78→79 迁移与 verify，核对旧插件数据、素材引用、迁移记录与校验和。SQLite 测试不能替代此步骤。
2. 完成 backend/app/handler 与前端完整质量门禁、生产构建及 Agent 协议匹配检查；最终待推送提交须遵守仓库 verify-before-push。
3. 验收管理员功能开关、关闭时服务端拒绝、登录态电商工作流、知识库隔离、任务预留/扣费/结算及资源恢复。无付费生成或真实 OAuth 验收记录。
4. 分别验证 RunningHub、生成岛音乐与独立音乐插件；覆盖换账号、双标签、刷新、Web Locks 支持及删除素材不复活。
5. 演练数据库升级后的恢复方案。旧程序会拒绝更高 schema，仅恢复镜像或二进制不能完成回滚；迁移后已有业务写入的处理必须纳入停服与恢复方案。

本候选未执行生产迁移、未开启电商、未更改线上积分策略。第三阶段完整功能发布尚未完成。
