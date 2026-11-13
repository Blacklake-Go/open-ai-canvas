# 影策 UI 设计系统总览与快速导航 (docs/ui-design-system.md)

> **版本**：2.0.0 (Latest)  
> **发布日期**：2026-11-13  
> **权威索引**：本文件是 `AGENTS.md` 引用的 UI 设计系统总入口。所有旧版设计规范已全面升级并归入 [docs/design-system/](docs/design-system/)。

---

## 1. 核心规范速查入口 (V2.0 权威发布)

所有 AI 协作者与前端开发人员在开发新页面、创建组件或编写样式前，必须以以下 V2.0 核心规范为唯一执行标准：

1. **[UI-SPEC.md](docs/design-system/UI-SPEC.md)**：全局视觉基石、Oklch 中性色板、排版 6 档字号、4px 间距网格、圆角与暗黑 Hairline 抬升体系、8 级 Z-Index 天梯及 WCAG 2.2 AA 标准。
2. **[design-tokens.json](docs/design-system/design-tokens.json)**：全站机器可读权威设计变量字典（Primitive → Semantic → Component 三层令牌及双模对称映射）。
3. **[COMPONENT-CATALOG.md](docs/design-system/COMPONENT-CATALOG.md)**：全量组件规范、状态矩阵与 WAI-ARIA APG 交互指南，含下拉框/模型选择 Popover 深度规范。
4. **[PLUGIN-THEME-CONTRACT.md](docs/design-system/PLUGIN-THEME-CONTRACT.md)**：插件接入契约、样式作用域隔离（`.plugin-scope-*`）与防上游代码覆盖三层防线。
5. **[REFERENCE-AUDIT.md](docs/design-system/REFERENCE-AUDIT.md)**：参考站点（https://yingce.tv/）真实视口/主题覆盖矩阵与实测参数。
6. **[MIGRATION-AND-ADMIN.md](docs/design-system/MIGRATION-AND-ADMIN.md)**：外观后台设置 JSON Schema V2、默认兜底与四阶段分批平滑迁移计划。
7. **[ACCEPTANCE-REPORT.md](docs/design-system/ACCEPTANCE-REPORT.md)**：阶段验收与自动化单测报告（3865 用例 100% 通过）。

---

## 2. 隔离可运行演示

- **演示组件源码**：[`web/src/pages/dev/design-system-showcase.tsx`](web/src/pages/dev/design-system-showcase.tsx)
- **本地体验地址**：启动本地开发环境后访问 `http://localhost:3000/dev/design-system`。
