# ONE 工作流

从顶部导航「智能体与工作流」进入。模板可以复制到个人库并编辑。个人工作流支持从空白开始、修改、删除，以及通过 `/workflow/:id/builder` 和 `/workflow/:id/playground` 深层链接重新打开。

工作流由 1 到 6 个顺序步骤组成。首步读取运行时输入，后续步骤读取上一步的文本结果。图片可以作为最后一步。每次运行冻结创建时的工作流版本和步骤。用户可以逐步确认，也可以确认剩余步骤的自动执行报价。成功后由现有积分账本结算，生成图片以账户私有素材归档。运行面板在刷新后恢复任务与结果。

自动执行报价列出每个剩余步骤的积分上限和总上限，有效期 5 分钟。确认后，Worker 会在每个步骤开始前基于实际输入重新报价，只有在对应步骤上限内才创建任务和预扣积分。已经完成的步骤不重复执行。上游任务失败时释放该任务的预扣，剩余步骤停止。模型停用、报价涨过上限、频率限制或余额不足时，运行停在当前步骤。解决问题后可为剩余步骤重新确认。停止自动执行会拦住后续提交，已进入队列的步骤可以完成。删除定义前需停止其自动运行，删除后历史任务及已生成素材仍保留。

## API 与数据

`092_one_workflows.sql` 新增 `ai_studio.one_workflows` 和 `ai_studio.one_workflow_runs`。`093_workflow_automatic_runs.sql` 为运行增加自动状态、已确认报价、每步积分上限和检查时间，并新增 `ai_studio.one_workflow_auto_quotes`。工作流和运行归属 ONE 用户，保存和删除检查 `revision`，创建和创建运行接受账户范围内的 UUID `creationKey`。

| 方法 | 路径 | 行为 |
| --- | --- | --- |
| GET、POST | `/api/one/workflows` | 列出个人工作流、创建工作流 |
| GET、PUT、DELETE | `/api/one/workflows/:id` | 读取、修改、软删除工作流 |
| GET、POST | `/api/one/workflows/:id/runs` | 列出最近的运行、创建版本快照 |
| GET | `/api/one/workflows/runs/:id` | 读取运行快照和步骤结果 |
| POST | `/api/one/workflows/runs/:id/steps/:index/quote` | 按已保存的输入和步骤获取报价 |
| POST | `/api/one/workflows/runs/:id/steps/:index` | 确认报价并提交指定步骤 |
| POST | `/api/one/workflows/runs/:id/automatic/quote` | 获取剩余步骤的积分上限 |
| POST | `/api/one/workflows/runs/:id/automatic` | 用 `quoteId` 确认该运行的自动执行 |
| DELETE | `/api/one/workflows/runs/:id/automatic` | 停止自动提交后续步骤 |

步骤索引从零开始。报价参数由服务端从运行快照和已成功的上游结果构建。提交检查模型能力、报价归属及参数一致性。任务使用 `workflow:<run-id>` 和服务端生成的固定步骤键，共用 ONE 的生成任务、积分账本与后台查询。重复确认会返回原任务。

Worker 通过 PostgreSQL 的有期限领取记录接续待执行运行。确认、停止和扣费共享同一运行行锁。并行 Worker 用固定步骤键复用任务，进程重启后由数据库恢复已提交的任务与尚待提交的步骤。自动和手动生成共用用户限流桶。

## 联调和回退

先在隔离或预生产库执行现有迁移并核对待执行数和校验偏差。自动执行需要至少一个启用 Worker 的 ONE 后端实例。用两个独立账号验证归属和重复提交，在隔离供应商上验证关页、重启、停止、涨价、失败退款及后台结算。

回退前停止尚在自动运行的流程，再恢复前后端版本并保留新增表。已排队任务、素材和积分记录继续由原表保存。
