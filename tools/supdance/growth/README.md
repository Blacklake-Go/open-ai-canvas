# SupDance 站内增长巡检

使用主站数据库的 PostgreSQL 连接运行 `baseline.sql` 和 `media-reliability.sql`。使用 `psql -XAtq -v ON_ERROR_STOP=1` 可得到各自的一行 JSON。查询使用只读事务、台北时区和语句超时。输出不包含账户 ID、提示词、请求正文或渠道凭据。

- `baseline.sql` 用最近 28 个完整自然日建立注册队列，并按注册周追踪首次提交、24 小时及 7 日首次成功。最近 7 个完整日另按注册日列出，便于观察突发流量后的一批新用户。首次成功后的第 1–7 日以完整自然日计算。今天的未成熟队列单列。匿名访问覆盖由最早的观测日标记，匿名会话与注册账户缺少可直接关联的标识。
- `media-reliability.sql` 按任务创建时间统计图片和视频的成功或失败终态，分别观察上一段 21 个完整日、最近 7 个完整日、今天以及最近 90 分钟。优先用最后一条相关 API 记录的渠道，缺失时使用订单或渠道模型。失败分组中的人数在各组内去重，跨组相加会重复计算。最后 API 响应的分类提供排查线索，最终状态以任务表为准。
- `runninghub_image_edit_configuration` 分别统计 RunningHub Edit Ultra 和 Nano Banana Flash 官方图生图端点的启用档位。若 `enabled_without_edit_selector` 大于零，核对档位的生成方式和失败请求是否有参考图。旧输出 `runninghub_edit_ultra_configuration` 继续提供 Ultra 的单项计数。
- `landing-referrers.py` 从 Web 容器访问日志汇总页面文档请求的引荐来源。对 `/`、`/create` 和 SPA 回退后的 `/index.html` 计数。代理会把部分站内路径重写成 `/index.html`，请求可能重复。X 引荐包括自然访问和推广访问，缺少引荐字段时保留为未知。统计无需保存日志、点击标识或完整链接。

在生产主机上运行汇总，只将 JSON 输出带回本地。例如检查指定时间之后最多 50,000 行日志。

```sh
ssh -T -o BatchMode=yes supdance-prod 'set -e
script=$(cat)
set -o pipefail
docker logs --since 2026-11-26T00:00:00+08:00 --tail 50000 y-supdance-canvas-web-1 2>&1 |
  python3 -c "$script"' < tools/supdance/growth/landing-referrers.py
```

将起始时间换为本次巡检窗口。`log_lines` 达到上限时用更短的时间窗口。部署或容器日志轮转可能缩短实际覆盖期。
