# SupDance Canvas — 上游基线记录 (UPSTREAM_BASELINE.md)

## 1. 当前集成的上游版本基线

| 维度 | 值 |
| --- | --- |
| **上游仓库** | `https://github.com/ddcat-ai/open-ai-canvas` |
| **当前采用的上游正式标签** | `v1.7.1` |
| **上游基线 Commit SHA** | `89fcb53fd65969cb58ae1eba5d18381db51819d1` |
| **上游发布时间** | `2026-10-26T23:26:38+08:00` |
| **数据库 Schema 版本** | `71` (`drama_segment_mode`) |
| **外观配置 JSON 合同版本** | `10` (`updates` / `canvas` / `skinThemes` buttons v8+) |
| **插件宿主 API 版本** | `yingce.plugin/v1`、`yingce.plugin/v2` |
| **前端包管理器与锁文件** | `bun@1.3.9` (`web/bun.lock`) |
| **后端 Go 版本** | `go 1.25.0` (生产镜像运行 `go1.25.14`) |

## 2. 生产镜像基线 (GHCR Digests)

当前生产环境 (`y.supdance.com` / `one.supdance.com`) 对应 `v1.7.1` 的固定镜像摘要：

- **`CANVAS_BACKEND_IMAGE`**：
  `ghcr.io/ddcat-ai/open-ai-canvas-backend@sha256:da21981ba178b3ce5e77b0ab19de828457f31275a404a77e98d263a51f9297fc`
- **`CANVAS_WEB_IMAGE`**：
  `ghcr.io/ddcat-ai/open-ai-canvas-web@sha256:833ecbfa99fe88ee7e8e5aff21c98db07da6033db905ad63454d89363a23e952`
- **`CANVAS_YINGCE_AGENT_IMAGE`**：
  `ghcr.io/ddcat-ai/open-ai-canvas-yingce-agent@sha256:c821a60623f23bc9b75af26f9f426e3bcd7a88b35029a9421263932d791667c6`

## 3. 上游未发布分支动态观察

截至本次基线记录时，上游 `upstream/main` 在 `v1.7.1` 之后有 1 个尚未打 Release 标签的提交：

- `e9ce0604f9896e533cd2230b3d2711bf0d3f0e85`：`feat(platform): 推广中心 - 支持邀请注册、推广人管理与充值积分返佣`（涉及 41 个文件改动及数据库 Schema 变更）。
- **处理策略**：遵循“默认优先稳定 Release，不自动部署上游 main”原则，暂不合并该未发布提交，待上游发布 `v1.7.2` 正式版后再通过 `integration/upstream-v1.7.2` 分支评估集成。
