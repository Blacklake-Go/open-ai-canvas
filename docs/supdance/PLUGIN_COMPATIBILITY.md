# SupDance Canvas — 插件兼容性与维护规范 (PLUGIN_COMPATIBILITY.md)

## 1. 宿主插件系统真实能力边界

经审计上游源码（[`web/src/lib/plugins/plugin-types.ts`](../../web/src/lib/plugins/plugin-types.ts)、[`web/src/lib/plugins/plugin-registry.ts`](../../web/src/lib/plugins/plugin-registry.ts)、[`backend/internal/app/plugin_management.go`](../../backend/internal/app/plugin_management.go) 及 [`backend/internal/app/protocol_plugins.go`](../../backend/internal/app/protocol_plugins.go)），当前宿主真实开放的能力与边界如下：

### 1.1 原生支持的能力（优先使用 `.yingce-plugin` 实现）

- **Manifest API 版本**：支持 `yingce.plugin/v1` 与 `yingce.plugin/v2`。
- **模型协议 Provider (`contributes.providers`)**：声明式 JSON 协议映射（支持 `text`、`image`、`video`、`audio` 能力，由后端 `internal/protocol` 执行）。
- **画布自定义节点 (`contributes.canvasNodes`)**：通过 `registerPluginCanvasNodes` 注册画布节点定义、默认尺寸、Schema 与输入输出连接规则。
- **编辑器插槽 (`contributes.editorSlots`, `v2` 专属)**：支持 `timeline-panel`、`preview-renderer`、`inspector`、`asset-ingest`、`subtitle-tool`、`transcription-provider`、`export-renderer`、`ai-assistant` 共 8 类插槽，受 `plugin-permission-check.ts` 严格权限校验。
- **AI 文本能力 (`services.ai.text`)**：声明 `ai.text` 权限后可通过宿主 `createPluginHostContext` 安全调用已配置的文本模型，无需接触 API Key。
- **外部素材源 (`createAssetSource`)** 与 **提示词优化器 (`createPromptOptimizer`)**。
- **插件隔离存储 (`PluginStorage`)**：按插件 ID 命名空间隔离浏览器本地存储。

### 1.2 宿主明确禁止或尚未开放的能力（需通过 `supdance/` 扩展模块实现）

- 插件**不能**自行修改 React Router 全局路由、替换登录认证流程或读取用户 Cookie/API Key。
- 插件**不能**动态注入 Gin HTTP 路由、GORM 数据库表或后台常驻 Worker。
- 上传的自定义 `.yingce-plugin` 包在后端由 `pluginManagement` 强制归类为 `Origin: uploaded, Kind: protocol, ActivationScope: system`，不能自行提权为平台内置系统支付或短信插件。

---

## 2. SupDance 自定义插件维护规则

1. **强制 ID 前缀**：所有 SupDance 自定义插件 ID 必须以 `supdance-` 开头（小写 kebab-case），防止与 `plugin-packages/` 下 110+ 个上游插件发生 ID 冲突。
2. **最小权限原则**：只声明必需权限，不得重复声明权限，不得硬编码任何密钥。
3. **注册前校验**：前端注册统一调用 `registerSupDancePlugin()`（内部执行 `validateSupDancePluginManifest`），后端校验调用 `adapters.CheckPluginManifestCompatibility()`。

---

## 3. 插件兼容性登记表

| 插件 ID | 插件名称 | 插件版本 | 所需宿主版本 | 宿主 API 版本 | 声明权限 | 测试结果 | 当前兼容状态 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `supdance-workflow-assistant` | SupDance 创作工作流助手 | `0.1.0` | `>= v1.7.1` | `yingce.plugin/v2` | `canvas.read`, `ai.text` | `web/test/supdance-extension-isolation.test.ts` 通过（含与上游 110+ 插件包的 ID 冲突扫描） | **兼容 (Verified)** |
