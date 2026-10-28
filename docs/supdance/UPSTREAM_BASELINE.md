# SupDance Canvas — 上游基线记录 (UPSTREAM_BASELINE.md)

## 1. 当前集成的上游版本基线

| 维度 | 值 |
| --- | --- |
| **上游仓库** | `https://github.com/ddcat-ai/open-ai-canvas` |
| **当前采用的上游正式标签** | `v1.7.2` |
| **上游基线 Commit SHA** | `e4e3a40c94242b8845650e4c7090ec7cb6c46ed0` |
| **上游发布时间** | `2026-10-27T22:41:37+08:00` |
| **数据库 Schema 版本** | `74` |
| **外观配置 JSON 合同版本** | `10` (`updates` / `canvas` / `skinThemes` buttons v8+) |
| **插件宿主 API 版本** | `yingce.plugin/v1`、`yingce.plugin/v2` |
| **前端包管理器与锁文件** | `bun@1.3.9` (`web/bun.lock`) |
| **后端 Go 版本** | `go 1.25.0` (生产镜像运行 `go1.25.14`) |

## 2. 生产镜像基线 (GHCR Digests)

当前生产环境 (`y.supdance.com` / `one.supdance.com`) 对应 `v1.7.2` 升级周期：

- **`CANVAS_BACKEND_IMAGE`**：
  `ghcr.io/ddcat-ai/open-ai-canvas-backend@sha256:da21981ba178b3ce5e77b0ab19de828457f31275a404a77e98d263a51f9297fc`
- **`CANVAS_WEB_IMAGE`**：
  `ghcr.io/ddcat-ai/open-ai-canvas-web@sha256:833ecbfa99fe88ee7e8e5aff21c98db07da6033db905ad63454d89363a23e952`
- **`CANVAS_YINGCE_AGENT_IMAGE`**：
  `ghcr.io/ddcat-ai/open-ai-canvas-yingce-agent@sha256:c821a60623f23bc9b75af26f9f426e3bcd7a88b35029a9421263932d791667c6`

## 3. 上游未发布分支动态观察

截至本次基线记录时，上游 `upstream/main` 在 `v1.7.2` 之后有 2 个文档提交：

- `d77e977a914b9758b2e8023c6c34173b9f078e0f`：`docs(readme): 产品介绍 - 新增影策世界引擎内测预告`
- `dd121d798fefdbcf1914eb4f94fc2a76fdf2592d`：`docs(readme): 产品介绍 - 重写产品宣传并补充核心页面截图`
- **分析结论**：两项均为根 `README.md` 与产品宣传截图更新，无业务逻辑、数据表、路由或核心 API 变更，当前基线 `v1.7.2` 运行稳健。
