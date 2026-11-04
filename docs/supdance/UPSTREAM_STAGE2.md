# 第二阶段正式版隔离候选（未部署）

- 版本：`v1.7.4-supdance.6+upstream-stage2`。
- 来源：detached HEAD `eadb3622f302ade2b51c244ac6b7c6c9903a85a2`，以 `git merge --no-commit --no-ff 7c14ffdd` 合并正式版 v1.7.3.5；保持合并待提交，不提交、不推送、不部署。
- 第一阶段已由用户确认上线及中英、明暗浏览器验收。本候选不代表生产环境升级，线上数据库仍按 Schema 78 边界处理。

## 已保留的集成语义

- 九个冲突文件已处理：CHANGELOG、VERSION、设置仓储、OpenAPI、HTTP API 文档、功能文档、待测试文档、侧栏和图片审批测试。
- 同时保留 `LockSystemSetting` 与 `SystemSettingsWithPrefix`；保留视觉引擎和电商完整端点及各自请求体。审批测试外层 30 秒保留大于子进程 20 秒的期限。
- 电商入口跟随有效 `ecommerceEnabled`，默认关闭；仅参考后续 `e1f8b8c9` 的侧栏条件，复用 `workbench.ecommerce` 翻译，保留音乐插件导航与守卫。
- 保留已上线第一阶段：正式版自带的 b0d 分页、`common.load_more`、令牌／焦点／44px 适配、338b75c8 品牌与第二屏修复、相关测试及 E2E 参数、分页 registry 和 baseline 两条耦合路径。
- 前端宿主版本／Schema 常量、后端领域元数据、baseline tag／commit／schemaVersion 对齐正式版与 Schema 79；基线文档明确区分源码候选与生产状态。
- 未引入 upstream/main 的新 i18n、易支付、TOS 存储。未整体复制第一阶段文档。

## 本轮实际验证

| 检查 | 实际结果与范围 |
| --- | --- |
| 前端类型检查 | Bun 1.3.9，`bun run --cwd web typecheck`（执行 `tsc --noEmit`）exit 0；收尾 `typecheck-delivery.log` 亦记录 exit 0。只证明类型检查，不代表 Vite 生产构建或浏览器验收。 |
| Web 专项 | 11 个文件共 **50 pass / 0 fail**。覆盖音乐入口与统一生成、素材恢复、跨标签副作用锁、视频交付、插件隔离与生命周期、品牌监看窗口、Agent 分页、图片审批和 Design System。 |
| Schema | **2 项通过**：`TestEcommerceAgentSchemaMigration79`、`TestEcommerceAgentSchemaUpgradeFrom78PreservesMigrationHistory`。使用临时 SQLite，覆盖 78→79、历史迁移身份保留及重复迁移。 |
| 设置仓储 | **1 项通过**：`TestSystemSettingLockAndEscapedPrefixPreserveTransaction`，覆盖锁初始化不覆盖旧值、字面前缀转义及事务回滚。 |
| 后端兼容元数据 | **1 项通过**：`TestSupDanceDomainAndAdapterIsolation`，包括 Schema 79 接受、78 拒绝。首次筛选未匹配此测试，不计为通过数量；随后按正确名称运行通过。 |
| OpenAPI | 正式版自身缺少 `EcommerceAgentRequest` definition。本候选按实际 Go 请求结构补齐当前最小 definition；125 个路径、23 个双方新增端点合同保留，346 个内部引用无缺失。主 agent 收尾用 Bun.YAML 复核 missing=[]。未扩展修复其他上游规范欠账。 |

Web 的 11 个文件为：`music-hotplug-lifecycle`、`creation-island-music`、`generation-task-asset-recovery`、`provider-neutral-generation-effects`、`canvas-generation-video-delivery`、`supdance-extension-isolation`、`supdance-music-plugin-lifecycle`、`previs-monitor-window`、`agent-conversation-pagination`、`agent-image-approval`、`design-system-compliance`（均位于 `web/test/`）。

**保留的失败与编译边界：**上述 50 项通过后，增加 Schema 常量对齐断言的单文件复查在模块加载阶段失败：`SUPDANCE_SCHEMA_BASELINE` 已定义在 compatibility，但未从 `web/src/supdance/index.ts` 的公共导出链暴露，记录为 0 pass / 1 fail / 1 error。按用户停止修改要求保留该后续修复项；不能将先前 50 项结果声称为最终所有测试通过。TypeScript 配置不包含测试文件，因此此失败与 typecheck exit 0 可以同时成立。

最初 GOPROXY=off 的后端尝试在依赖解析阶段失败，不构成 app／handler 编译证据。随后允许联网下载，仅运行上述最小包与用例；**app／handler 编译和电商准入集成测试未完成**。未运行全量测试或生产构建。

## 发布前仍需完成

- 补齐前端 Schema 常量的公共导出，复验当前失败的单文件；确认 app／handler 编译和电商服务端准入。
- PostgreSQL 备份恢复副本 78→79、幂等与插件数据核对、回退演练。旧 Schema 78 程序拒绝连接 Schema 79，不能只回退二进制。
- 真实登录态电商启停、后台导航、知识与技能、音乐两条链路、RunningHub、跨标签／换账号、删除墓碑、资源播放下载。
- 生产积分策略、历史账本、真实生成与 OAuth 验收；本轮不连接生产，不创建真实收费任务。

交付定位：**第一阶段已上线；第二阶段为已解冲突、前端类型检查通过的隔离可审查候选，仍有测试与后端编译／迁移／登录态验收边界，未标记发布 ready。** 本工作树源码、文档、测试暂存；`.local` 与 `.impeccable` 排除，不提交。
