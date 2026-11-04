# SupDance Canvas — 上游基线记录 (UPSTREAM_BASELINE.md)

## 第二阶段源码候选（未部署）

`v1.7.4-supdance.6+upstream-stage2` 自 `eadb3622` 集成正式版 `v1.7.3.5`（`7c14ffdd8c5480eefc29e6f1ab7da4ef25da2856`），源码要求 Schema 79。前端宿主版本、后端领域元数据及 `supdance/config/baseline.json` 已按候选对齐；不表示线上已迁移。第一阶段前端已由用户确认上线验收，线上数据库仍按 Schema 78 边界处理，本轮未连接线上数据库。

候选同步方式、实际验证与未完成验收见 [第二阶段隔离集成](./UPSTREAM_STAGE2.md)。下方为候选之前的历史基线，不作为本候选的部署结果。

## 1. 当前集成的上游版本基线

| 维度 | 值 |
| --- | --- |
| **上游仓库** | `https://github.com/ddcat-ai/open-ai-canvas` |
| **当前采用的上游正式标签** | `v1.7.3.4` |
| **上游基线 Commit SHA** | `dc035d51311925e48ab1542df094bd1e2b07ba7f` |
| **上游发布提交时间** | `2026-11-02T21:40:52+08:00` |
| **数据库 Schema 版本** | `78`（生产迁移需恢复副本验证） |
| **外观配置 JSON 合同版本** | `10` (`updates` / `canvas` / `skinThemes` buttons v8+) |
| **插件宿主 API 版本** | `yingce.plugin/v1`、`yingce.plugin/v2` |
| **前端包管理器与锁文件** | `bun@1.3.9` (`web/bun.lock`) |
| **后端 Go 版本** | `go 1.25.0` (生产镜像运行 `go1.25.14`) |

本次源码集成版本为 `v1.7.4-supdance.2`，以已提交的 `release/supdance-1.7.4-supdance.1` 为定制来源。并行插件任务的未提交修改及其他修复分支不纳入本次发布；以下生产镜像坐标为历史记录，不能据此判断当前部署。

## 2. 历史生产镜像基线 (GHCR Digests)

当前生产环境 (`y.supdance.com` / `one.supdance.com`) 对应 `v1.7.2` 升级周期：

- **`CANVAS_BACKEND_IMAGE`**：
  `ghcr.io/ddcat-ai/open-ai-canvas-backend@sha256:da21981ba178b3ce5e77b0ab19de828457f31275a404a77e98d263a51f9297fc`
- **`CANVAS_WEB_IMAGE`**：
  `ghcr.io/ddcat-ai/open-ai-canvas-web@sha256:833ecbfa99fe88ee7e8e5aff21c98db07da6033db905ad63454d89363a23e952`
- **`CANVAS_YINGCE_AGENT_IMAGE`**：
  `ghcr.io/ddcat-ai/open-ai-canvas-yingce-agent@sha256:c821a60623f23bc9b75af26f9f426e3bcd7a88b35029a9421263932d791667c6`

## 3. 历史上游分支观察（v1.7.2 周期）

截至本次基线记录时，上游 `upstream/main` 在 `v1.7.2` 之后有 2 个文档提交：

- `d77e977a914b9758b2e8023c6c34173b9f078e0f`：`docs(readme): 产品介绍 - 新增影策世界引擎内测预告`
- `dd121d798fefdbcf1914eb4f94fc2a76fdf2592d`：`docs(readme): 产品介绍 - 重写产品宣传并补充核心页面截图`
- **分析结论**：两项均为根 `README.md` 与产品宣传截图更新，无业务逻辑、数据表、路由或核心 API 变更，当前基线 `v1.7.2` 运行稳健。
