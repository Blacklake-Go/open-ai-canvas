# 14 — 自动化检测与视觉回归测试规范 (UI Testing & Linting System)

> **设计层级**：Layer 4 — Verification & CI Gateways  
> **适用范围**：前端自动化测试套件、静态代码扫描、视觉回归门禁与持续集成。  
> **核心原则**：规范不能仅停留在纸面上，必须通过机器自动化测试建立不可逾越的“防腐层门禁”，阻止不合规代码合入主干。

---

## 1. 静态检测与代码扫描规则 (Static Analysis)

基于 Bun Test 与 ESLint 体系建立自动化静态检测规则：

### 1.1 违规模式黑名单 (Banned Patterns)
1. **禁止裸写超高 Z-Index**：检测代码中是否存在 `z-[99999]`、`z-[9999]` 或大于 `2000` 的任意 Z-Index。
2. **禁止静态弹窗调用**：禁止使用 `Modal.confirm(...)`（无法感知 React 上下文与主题），必须使用 `App.useApp().modal`。
3. **禁止直接引用 AntD Empty**：禁止 `import { Empty } from "antd"`，必须统一使用自研 `EmptyState`。
4. **禁止裸写圆角与十六进制颜色**：检测组件中是否存在 `rounded-[7px]`、`text-[#4f46e5]` 等脱离 Token 体系的裸值。
5. **禁止在 Modal/Drawer 上手写内联内边距清理**：禁止 `styles={{ body: { padding: 0 } }}`，必须使用 `AppModal flush` 或 `AppDrawer`。

---

## 2. 自动化合规单元测试套件 (`design-system-compliance.test.ts`)

在 `web/test/design-system-compliance.test.ts` 中维护长期执行的自动化合规测试，测试用例必须覆盖：

1. **规范文档完整性测试**：断言 `docs/design-system/` 下所有 21 份规范、契约、清单与例外台账文件均存在，且文件体积实质有效（非占位空文件）。
2. **AI 永久指令对齐测试**：断言根目录 `AGENTS.md` 包含完整的 `RULE 001` 至 `RULE 016` 永久执行规则。
3. **Z-Index 令牌合法性测试**：扫描 `web/src/` 下所有 `.tsx` 与 `.css` 文件，确保不存在超出 `0–2000` 阶梯的非法裸写 Z-Index。
4. **皮肤令牌完整性测试**：断言预设皮肤（`classic` 与 `supdance-studio`）的 50 种语义色与 17 项组件参数完整无缺。

---

## 3. 视觉回归测试基线 (Visual Regression Testing)

根据实际技术栈与环境评估，建立以真实页面为基底的截图回归基准：

### 3.1 核心基准页面覆盖范围
- **公开认证页**：`/login`（浅色模式 1440×900，深色模式 1440×900，移动端 390×844）。
- **创作者工作台**：`/create`（默认创作岛，参数面板展开与成果卡片流）。
- **无限画布页**：`/canvas`（空状态与多节点连线视口）。
- **管理后台**：`/admin`（数据概览）、`/admin/models`（模型列表表格）、`/admin/settings/appearance`（外观配置工作台）。

### 3.2 判定标准
- **视口溢出检测**：页面 `document.documentElement.scrollWidth <= window.innerWidth`（无意外横向滚动条）。
- **文字对比度检测**：核心标题与正文像素对比度达标。
- **差异阈值**：图像像素差异（Diff Ratio）阈值设为 `< 0.2%`。任何超过阈值的改动必须区分为“预期重构”或“意外视觉回归”。

---

## 4. 持续集成 (CI) 与流水线门禁

在提交 Pull Request 或执行合并前，CI 必须串行通过以下门禁：
```bash
# 1. 静态格式与语法类型检查
cd web && bun run typecheck

# 2. UI 架构退场门禁与设计系统合规测试
cd web && bun test test/ui-kit-retirement.test.ts
cd web && bun test test/design-system-compliance.test.ts

# 3. 核心交互与主题单测
cd web && bun test test/site-appearance-and-skins.test.ts
```
所有门禁通过后，方可允许构建镜像与发布上线。
