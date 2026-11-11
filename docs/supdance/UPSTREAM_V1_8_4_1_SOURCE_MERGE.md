# 上游 v1.8.4.1 源码合并记录

## 来源与范围

- 上游仓库：`https://github.com/ddcat-ai/open-ai-canvas`
- 目标正式标签与 `upstream/main`：`v1.8.4.1`，提交 `c8d274f43c92f6a3d4aa0355f775b1b14c2fbc25`
- 本地集成分支：`integration/upstream-v1.8.4.1`
- 上一上游基线：`v1.8.3`，提交 `ee6c0ee201b8b711aee0554280e169c0115dc144`，Schema 92。
- 上游更新范围为 62 个提交、923 个变更路径。此合并保留用户插件、自有扩展与已记录的 SupDance 接缝；没有推送或部署。

## 冲突处理与保留内容

- 保留画布本地多段视频剪辑、选中视频合并，以及分镜成片的合并入口；改用上游 `runFFmpegTask` 串行任务队列。上游图片对比能力保持可用。
- 保留短剧造型、角色参考图、分辨率回退等本地交互，并将新增界面文案接入原生 `supdance-creation` 六语词条。用户输入、提示词和生成参数保持原值。
- 保留被上游删除、但仍被测试与兼容注册表引用的 `canvas-agent-hud.tsx`。
- 上游删除了时间线编辑器、字幕工具、短剧到画布精剪和内置剪辑插件。按本次要求全部保留，并重新接回画布工具条、素材插入和短剧流程；登记为 `supdance-canvas-timeline-editor`。多段视频合并仍登记在 `supdance-canvas-video-merge`，时间线导出改走上游 `runFFmpegTask`。
- Markdown、HTML、SVG、图表和对比节点继续按原节点类型注册。Agent 插入 Markdown 仍创建独立 Markdown 节点；上游文本节点的 `textFormat: "markdown"` 只用于文本节点，不把仍为 Markdown 格式的独立节点改成文本节点。
- 兼容登记见 `web/src/supdance/adapters/compatibility.ts`；基线与扩展清单见 `supdance/config/baseline.json`。

## 数据库迁移映射

本站已应用的迁移记录 1–93 保持原样；本次上游新增迁移 93–98 映射为本站 94–99。每项保留上游名称、checksum、实现和相对顺序：

| 上游版本 | 本站版本 | 名称 |
| --- | --- | --- |
| 93 | 94 | `ecommerce_round_history` |
| 94 | 95 | `drama_cast_styles_import` |
| 95 | 96 | `ark_private_asset_binding_identity` |
| 96 | 97 | `canvas_unified_text_nodes` |
| 97 | 98 | `channel_websites` |
| 98 | 99 | `api_log_generation_content` |

上游目标 Schema 为 98，本地目标 Schema 为 99。迁移代码和数据模型已随源码合并；本次没有对生产数据、现有开发数据库或其他用户数据库运行迁移。

## 验证与发布边界

- 前端 `cd web && bun run typecheck` 在接回扩展节点后通过。未跑全量测试、浏览器验收或数据库迁移。
- 本记录只描述源码集成候选。上线前仍需按部署规范准备数据库备份、恢复演练和迁移验证，并同步发布 Web、Backend 与 yingce-agent。
