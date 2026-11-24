# ONE 普通 Agent

从 Studio 的 Agent 栏打开模板、我的智能体和我的对话。模板在 ONE 中有可运行的配置。已有模板链接，例如 `/agents/captioncrafterpro`，仍打开相应的模板。登录后可以创建私有智能体，编辑名称、描述、系统指令和欢迎语。

## 帐号与数据

`091_agent_profiles.sql` 新增 `ai_studio.agent_profiles` 和 `ai_studio.agent_conversations`。该迁移为旧界面上的六个模板入口补充了本地配置。私有智能体和每次对话由创建帐号持有。模板资料允许公开读取，模板系统指令由服务端使用。私有智能体的系统指令只在所有者的资料请求中返回。

- `GET /api/one/agents/templates` 读取模板。
- `GET /api/one/agents` 列出当前帐号的智能体，`POST` 用 `creationKey` 新建。
- `GET /api/one/agents/:slug` 读取资料，`PUT` 按 `revision` 保存私有智能体。
- `GET /api/one/agents/conversations` 列出当前帐号的会话。
- `POST /api/one/agents/:slug/conversations` 用 `creationKey` 建立会话，`GET /api/one/agents/:slug/conversations/:id/jobs` 查询已保存的任务。

在已发布文本模型中选择模型，点击发送后走现有 ONE 报价、排队和结算。工作器读取提交时保存的系统指令，并携带该会话最近八条成功回复的上下文。任务进度与回复可从同一会话链接恢复。会话正在生成时，重复的独立提交返回 HTTP 409。

## 联调与回退

在隔离 PostgreSQL 应用迁移并验证校验和。以匿名访客、所有者和另一个帐号检查模板、跨帐号权限、双标签编辑和对话恢复。用测试上游验证 Worker 的结果和积分账本，再按实际供应商配置验收。

这次迁移创建 ONE 本地数据。若需迁入已有外部账号资料和会话，需先取得来源数据和所有权映射。回退应用时可保留新增表备份已保存资料。
