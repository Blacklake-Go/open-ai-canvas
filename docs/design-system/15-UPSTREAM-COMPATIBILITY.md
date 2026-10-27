# 15 — Git 上游同步与二次开发兼容维护规范 (Upstream Compatibility)

> **设计层级**：Engineering Governance & Architecture Boundaries  
> **适用范围**：上游版本同步、二次开发补丁管理、自定义皮肤与插件隔离。  
> **核心原则**：严格遵守 `Upstream Core + SupDance Extensions + Compatibility Adapters` 架构。在建立完整 UI 设计系统的同时，最大限度降低对原作者上游核心文件的侵入，保障长期无痛同步上游新功能的能力。

---

## 1. 仓库拓扑与分支模型

```text
upstream/main (原作者开发分支，只读，禁止推送)
    │
    ▼
origin/main (干净镜像分支，只做 fast-forward 同步)
    │
    ├───────────────────────────────────────────┐
    ▼                                           ▼
supdance/main (长期产品主分支)               integration/upstream-vX.Y.Z
    │                                           ▲
    │                                           │ (prepare_integration.sh)
    └─────────────── merge ─────────────────────┘
```

- **上游基线仓库**：`https://github.com/ddcat-ai/open-ai-canvas.git`
- **自有仓库**：`https://github.com/Blacklake-Go/open-ai-canvas.git`
- **严禁事项**：严禁在 `origin/main` 直接提交任何 SupDance 业务或设计系统代码。所有修改必须在 `supdance/main` 或特性分支进行。

---

## 2. 二次开发目录边界与隔离铁律

为防止上游更新代码时产生海量 Git 冲突，UI 设计系统的代码落脚点严格遵循以下边界：

| 模块分类 | 推荐落脚目录 | 耦合度与上游关系 |
| :--- | :--- | :--- |
| **设计系统规范文档** | `docs/design-system/` | 纯新增目录，与上游完全零冲突 |
| **SupDance 专属皮肤与主题** | `web/src/supdance/theme/` | 独立命名空间，仅引用上游 Token 类型 |
| **多语言与自定义插件** | `web/src/supdance/plugins/` | 热插拔插件模式，宿主仅保留单行挂载点 |
| **后端扩展领域与适配器** | `backend/internal/supdance/` | 独立 internal 子包，不反向依赖 app |
| **自研核心组件层 (Celadon)** | `web/src/components/ui/` | 集中管理自研基础件，逐步接管 AntD |
| **上游核心样式与皮肤** | `web/src/styles/globals.css`<br>`web/src/lib/skin-themes.ts` | 最小化修补，所有补丁必须在注册表登记 |

---

## 3. 不可避免的上游核心补丁管理契约

若因为全局样式或关键挂载点必须修改上游原有文件，**必须同时在以下两处进行严格登记**：
1. `docs/supdance/CUSTOMIZATIONS.md` 中的“补丁清单”。
2. `web/src/supdance/adapters/compatibility.ts` 的 `SUPDANCE_UPSTREAM_PATCH_REGISTRY` 常量。

### 登记内容要素
- 补丁 ID（如 `supdance-design-system-tokens`）
- 被修改的上游文件列表及对应 Commit SHA
- 修改原因与业务价值
- 升级冲突预警等级 (`LOW` / `MEDIUM` / `HIGH`)
- 回归测试用例与验证依据

---

## 4. 上游版本集成与自动化冲突预警流程

每次集成上游正式 Release 时，必须严格执行以下四步流水线：

```bash
# 步骤 1：创建隔离集成分支
bash tools/supdance/prepare_integration.sh vX.Y.Z

# 步骤 2：运行上游重叠与冲突审计脚本
python3 tools/supdance/check_upstream.py

# 步骤 3：运行设计系统令牌与合规门禁测试
cd web && bun test test/design-system-compliance.test.ts
cd web && bun test test/site-appearance-and-skins.test.ts

# 步骤 4：运行全量类型检查与生产构建
cd web && bun run typecheck && bun run build
cd ../backend && go test ./...
```

若出现上游重构破坏了既有 Token 命名，由兼容适配器层 (`web/src/supdance/adapters/compatibility.ts`) 承接平滑桥接，**严禁静默覆盖或强行丢弃自定义实现**。
