# RunningHub Standard Model

该目录是独立官方协议插件源码。后端从生成的 `runninghub-standard.yingce-plugin` 包加载，不依赖系统内置 `host:` 适配器。

插件封装 RunningHub 标准模型 API（`https://www.runninghub.ai/openapi/v2/...`）：

- 创建：`POST /openapi/v2/{模型端点}`，`Authorization: Bearer <apiKey>`，模型端点由渠道模型的上游模型 ID 提供。
- 查询：`POST /openapi/v2/query`，请求体 `{"taskId": "..."}`。
- 响应：`taskId`、`status`（QUEUED/RUNNING/SUCCESS/FAILED）、`results[].url`，结果链接 24 小时有效，宿主按 ephemeral 立即转存。

同一插件包含 image / video / audio 三个 provider，分别用于图片、视频、音频标准模型。上游要求企业级-共享 API Key。

完整接口见 [docs/interface.md](docs/interface.md)。
