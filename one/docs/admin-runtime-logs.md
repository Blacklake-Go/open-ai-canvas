# ONE 管理后台运行日志

管理后台的「系统健康与日志」读取当前 ONE Go 进程的结构化运行事件。事件覆盖 PostgreSQL 连通与迁移校验、HTTP 服务启动、Worker 启动和运行失败，以及管理接口异常。标准输出和异常各保留最近 100 条，时间使用 UTC，进程重启后从新进程的启动事件开始显示。

`GET /api/admin/system/logs?type=out` 读取标准输出，`type=error` 读取异常。调用需要已登录且具备 `healthRead` 权限。返回仍使用管理接口信封，`data` 包含 `type`、`lines`、`maxLines` 和 `missing`。无事件时 `lines` 为空。响应禁用缓存。

后台事件仅包含静态事件名称和安全的计数。容器仍保留自己的标准日志输出，平台部署诊断可通过现有的容器日志访问方式查看。
