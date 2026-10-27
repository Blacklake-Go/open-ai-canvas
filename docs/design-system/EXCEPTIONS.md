# EXCEPTIONS — SupDance UI Design System 例外偏离登记与生命周期管理机制 (UI Exception Registry)

> **设计层级**：Governance & Compliance Protocol  
> **适用规则**：**RULE 015 — No Silent Exceptions**（严禁无声偏离；任何业务或技术原因导致的规范违规必须显式登记与审批）。  
> **权威原则**：例外不是特权，而是技术债务。任何未在此文件登记的硬编码颜色、非法 Z-Index、自造组件或样式跨域污染均视为严重 Lint 违规与 CI 阻断项。

---

## 1. 例外管理机制与生命周期 (Exception Lifecycle)

任何业务场景或存量代码若确需偏离 Design System 规范，必须严格遵循以下五阶段闭环生命周期：

```text
┌────────────────────────────────────────────────────────┐
│  Phase 1: 提报与动机分析 (Proposal & Rationale)         │
│  · 说明为何现有 Design Tokens 或 Celadon 组件无法满足业务  │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│  Phase 2: 作用域与影响面评估 (Scope & Impact Analysis)   │
│  · 评估是否破坏亮暗主题、是否破坏无障碍、是否污染外部 DOM │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│  Phase 3: 架构评审与正式审批 (Architect Review & Sign-off)│
│  · 由 UI/UX 架构负责人或前端 Lead 审批并分配台账编号     │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│  Phase 4: 边界隔离与补偿措施 (Compensating Measures)    │
│  · 必须限制在局部命名空间，提供 fallback 与安全边界     │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│  Phase 5: 限期治理与退场销号 (Remediation & Sunset)     │
│  · 关联至 Phase 5 迁移批次（P0/P1/P2），到期重构并销号   │
└────────────────────────────────────────────────────────┘
```

---

## 2. 例外登记标准契约模板 (Registration Template)

新增例外登记必须包含以下标准字段：

```markdown
### [EXC-YYYYMMDD-XXX] 例外简短标题

- **例外编号**：`EXC-YYYYMMDD-XXX`
- **所属作用域**：`public` | `admin` | `studio` | `canvas` | `plugin`
- **偏离规则**：`RULE 002 (Token First)` / `RULE 003 (Component Reuse)` / `RULE 007` / 等
- **涉及文件**：`web/src/...`（真实相对路径）
- **偏离现象**：如存在硬编码 Hex 色值、特殊 Z-Index、自定义组件包裹等。
- **业务/技术合理性**：为何当前阶段无法直接接入现有 Token 或共享组件。
- **补偿与安全防护措施**：如何确保该偏离不污染其他页面、不导致暗黑模式白屏、不破坏键盘导航。
- **审批责任人**：架构负责人（签名与审批日期）
- **当前状态**：`Active`（生效中） | `Scheduled`（已排期） | `Resolved`（已消除） | `Permanent`（永久豁免）
- **计划退场阶段**：`Phase 5 - P0` | `Phase 5 - P1` | `Phase 5 - P2` | 或指定版本号
```

---

## 3. 存量基线已知例外台账 (Phase 1 Baseline Inventory)

在第一阶段（规范建立与非侵入式治理阶段），为防止擅自改动线上生产环境导致业务中断，以下存量代码经审计后列入基线例外台账，并在后续 Phase 5 分批有序治理：

| 例外编号 | 所属系统 | 偏离规则 | 涉及文件/模块 | 现状与偏离说明 | 补偿隔离措施 | 计划退场阶段 | 状态 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **EXC-20261027-001** | 管理后台 | RULE 002 (Token) | `web/src/pages/admin/` 历史设置表单 | 部分老旧管理表单仍包含局部硬编码十六进制色值（如 `#17171a`、`#f5f5f7`） | 由 `[data-admin-root]` 作用域与 `admin-tokens.css` 强制隔离，不污染前台 | Phase 5 (P2-01) | Active |
| **EXC-20261027-002** | 管理后台 | RULE 003 (Reuse) | `web/src/pages/admin/` 复杂配置项 | 历史页面使用 Ant Design 原生 `<Select>`，与自研 Celadon RAC `<Select>` 并存 | 统一由 `app-theme.ts` 中的 `getIsolatedAdminAntTheme()` 控制 AntD 样式基线 | Phase 5 (P1-01) | Active |
| **EXC-20261027-003** | 无限画布 | RULE 002 (Z-Index)| `web/src/components/canvas/nodes/panorama-node.tsx` | 使用了局部固定 `z-[1200]` 弹窗遮罩 | 数值完全落在系统 `--z-loader: 1200` 合法层级之内，且通过 React Portal 挂载，无层叠上下文穿透 | Phase 5 (P0-01) | Active |
| **EXC-20261027-004** | 无限画布 | RULE 002 (Typography) | `web/src/components/canvas/canvas-image-tools/` | 缩略图小地图存在 `text-[7px]` 微型比例标注 | 该标注为视口缩放下的非交互装饰性比例示意，符合 `01-DESIGN-FOUNDATIONS.md` 第 1.3 节排他条款 | 永久豁免 | Permanent |
| **EXC-20261027-005** | 管理后台 | RULE 003 (Reuse) | `web/src/pages/admin/components/admin-ui.tsx` | 独立维护 `AdminStatusBadge` 状态组件 | 满足后台超高信息密度与紧凑行高（`40px`）专有排版需求，已完全连接 `--admin-*` 变量 | Phase 5 (P1-02) | Active |

---

## 4. 自动化检测与销号审计机制 (Auditing & Gateways)

1. **新增代码零容忍**：
   - 任何新提报的 PR 或 AI 提交，若包含未在此文件登记的新增硬编码色值、`z-99999` 或非法组件，合规门禁测试（`test/design-system-compliance.test.ts`）与 CI 流水线必须予以直接阻断。
2. **定期重构与销号**：
   - 在每个迭代周期的维护阶段，对照 Phase 5 迁移进度表逐项核销已修复的例外，将状态置为 `Resolved` 并注明实际修复的 Commit SHA。
