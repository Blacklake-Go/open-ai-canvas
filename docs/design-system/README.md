# SupDance 全站 UI Design System 设计规范与长期执行体系 V1.0

> **版本**：1.0.0  
> **发布日期**：2026-10-27  
> **适用项目**：SupDance (`ddcat-ai/open-ai-canvas` / `Blacklake-Go/open-ai-canvas`)  
> **权威等级**：最高执行标准。所有后续 AI 编程任务、前端开发、管理后台与插件开发必须严格遵循本文档体系。

---

## 1. 体系定位与最高执行指令

SupDance UI Design System 是面向 AI 影视与短剧创作工作台（SupDance Studio / Canvas / Admin / Public）建立的一套**完整、统一、可扩展、可配置、可验证且长期强制执行**的全站设计系统与交互规范。

### 最高执行原则
1. **Design System First**：所有新页面、新组件、新插件及后续 UI 修改，必须优先阅读并遵循本规范体系，**严禁 AI 或协作者自行创造第二套样式体系**。
2. **Backend Appearance Priority**：后台（`/admin/settings/appearance`）已保存并启用的外观设置在其管辖作用域内享有最高优先级，但不得破坏无障碍底线和系统核心功能状态。
3. **Four-Layer Architecture**：全站严格按四层架构（Global Foundation → Theme & Appearance Runtime → Application Design System → Component Implementation）进行样式解耦与渲染。
4. **Scope Isolation**：前台（Public）、后台（Admin）、生成岛（Studio）、无限画布（Canvas）和插件（Plugin）各自维护作用域变量与隔离边界，不得互相污染。
5. **Phase Boundary & Non-destructive Migration**：第一阶段建立规范文档、设计变量、组件契约、检查规则和非侵入式验证工具；严禁批量改写现有业务代码、破坏线上支付、登录与模型调度逻辑。

---

## 2. 规范文档地图 (Documentation Index)

本设计系统包含以下 19 份专题规范及配套检查工具与例外台账：

| 编号 | 文档名称 | 核心内容与适用范围 | 状态 |
| :--- | :--- | :--- | :--- |
| **00** | [00-UI-AUDIT.md](./00-UI-AUDIT.md) | 全站真实架构技术栈深度调查、UI Inventory 盘点表与风险分级 | 已就绪 |
| **01** | [01-DESIGN-FOUNDATIONS.md](./01-DESIGN-FOUNDATIONS.md) | 第一层全局设计基石：字体排印、4px 间距网格、圆角、阴影、层级与无障碍底线 | 已就绪 |
| **02** | [02-DESIGN-TOKENS.md](./02-DESIGN-TOKENS.md) | 全局 Design Tokens 字典：Primitive → Semantic → Component 三层令牌及映射 | 已就绪 |
| **03** | [03-PUBLIC-UI.md](./03-PUBLIC-UI.md) | 网站前台与认证体系规范（登录、注册、找回密码、暗黑版登录、画布分享、欢迎页、页尾与备案） | 已就绪 |
| **04** | [04-ADMIN-UI.md](./04-ADMIN-UI.md) | 管理后台专有规范：运营控制台骨架、侧栏折叠、表格密度、统计指标、设置卡与筛选流 | 已就绪 |
| **05** | [05-STUDIO-UI.md](./05-STUDIO-UI.md) | AI 生成岛与创作工作台规范：文生图、图生图、生视频、生音乐、文本生成、真实任务状态机、结果卡 | 已就绪 |
| **06** | [06-CANVAS-UI.md](./06-CANVAS-UI.md) | 无限画布设计系统：节点状态矩阵、连线吸附、浮动工具栏、Minimap、坐标系与局部层级隔离 | 已就绪 |
| **07** | [07-COMPONENT-CONTRACTS.md](./07-COMPONENT-CONTRACTS.md) | 核心组件契约：Button、Select / Dropdown、Input / Form、Switch、Checkbox、Segmented 等 | 已就绪 |
| **08** | [08-OVERLAY-AND-ZINDEX.md](./08-OVERLAY-AND-ZINDEX.md) | 浮层遮罩与 Z-Index 层级管理系统：Backdrop、Modal、Drawer、Popover、Tooltip、Toast 规则 | 已就绪 |
| **09** | [09-MOTION-SYSTEM.md](./09-MOTION-SYSTEM.md) | 统一动效与交互反馈系统：时长阶梯、缓动函数、硬件加速与 prefers-reduced-motion | 已就绪 |
| **10** | [10-RESPONSIVE-SYSTEM.md](./10-RESPONSIVE-SYSTEM.md) | 响应式断点与多端布局体系：手机、平板、桌面、宽屏适配原则与触控尺寸约束 | 已就绪 |
| **11** | [11-THEME-APPEARANCE.md](./11-THEME-APPEARANCE.md) | 后台外观设置优先与作用域隔离机制：`/admin/settings/appearance` 映射、优先级规则与实时同步 | 已就绪 |
| **12** | [12-PLUGIN-UI-CONTRACT.md](./12-PLUGIN-UI-CONTRACT.md) | 插件 UI 强制兼容契约：防止全局样式污染、令牌继承、弹窗管理与第三方适配层 | 已就绪 |
| **13** | [13-ACCESSIBILITY-I18N.md](./13-ACCESSIBILITY-I18N.md) | 多语言（六国语言）与无障碍规范：WCAG 2.2 AA、对比度、键盘闭环、长文本防溢出 | 已就绪 |
| **14** | [14-UI-TESTING.md](./14-UI-TESTING.md) | 自动化检测与持续执行：静态 AST/正则检查、令牌合规单测、视觉回归基线与 CI 门禁 | 已就绪 |
| **15** | [15-UPSTREAM-COMPATIBILITY.md](./15-UPSTREAM-COMPATIBILITY.md) | Git 上游更新与长期维护契约：上游同步保护、二次开发边界、补丁登记与冲突预警 | 已就绪 |
| **16** | [16-MIGRATION-PLAN.md](./16-MIGRATION-PLAN.md) | 存量页面平滑迁移方案：P0 / P1 / P2 阶段排序、兼容垫片、验证标准与安全回滚方案 | 已就绪 |
| **EXC**| [EXCEPTIONS.md](./EXCEPTIONS.md) | UI 设计系统例外登记、偏离审批机制与存量基线例外台账（RULE 015 落地） | 已就绪 |
| **CK** | [UI-CHECKLIST.md](./UI-CHECKLIST.md) | AI 与开发人员提交代码前强制自检清单（16 项规则对齐） | 已就绪 |
| **CL** | [CHANGELOG.md](./CHANGELOG.md) | 设计系统版本演进与变更记录（语义化版本控制） | 已就绪 |

---

## 3. 真实物理架构与核心资产映射表 (Physical Architecture & Source Mapping)

根据当前仓库真实工程结构，设计系统的 7 大物理要素落地与映射关系如下：

| 要素分类 | 仓库真实物理位置 | 核心职责与运行时机制 |
| :--- | :--- | :--- |
| **1. Design Tokens 源文件** | `web/src/styles/globals.css`<br>`web/src/lib/skin-themes.ts`<br>`web/src/supdance/theme/supdance-skin.ts`<br>`web/src/pages/admin/theme/admin-tokens.css` | 集中声明三层 Token（Primitive、Semantic、Component），定义 50 种语义色与 17 项组件度量，管理后台 `--admin-*` 变量隔离。 |
| **2. Tokens 编译与运行时映射** | `web/src/lib/skin-themes.ts` (`skinCSSVariables()`)<br>`web/src/lib/app-theme.ts` (`getAntThemeConfig()`)<br>`web/src/pages/admin/theme/` (`getIsolatedAdminAntTheme()`)<br>`web/src/main.tsx` (`bootstrapAppearance()`) | 将后台保存的主题动态注入 `:root` CSS 变量，桥接 Ant Design `<ConfigProvider>` Token，保证首屏防闪烁与实时分发。 |
| **3. 共享组件目录** | `web/src/components/ui/` (Celadon UI)<br>`web/src/components/layout/`<br>`web/src/pages/admin/components/` & `web/src/pages/admin/ui/` | `base/` 提供标准 Button、Select、Switch、Checkbox；`product/` 提供 AppModal、AppDrawer、EmptyState；后台提供隔离高密度控件。 |
| **4. 主题管理器位置** | 前端：`web/src/stores/use-appearance-store.ts`<br>服务：`web/src/services/api/appearance.ts`<br>后端：`backend/internal/app/appearance_*.go`<br>路由：`GET /api/public/appearance`<br>`PUT /api/admin/settings/appearance` | Zustand 管理前端运行时状态与持久化；Go Gin 后端通过 `system_settings` 数据表持久化并提供公开与管理员端 API。 |
| **5. 自动化测试目录** | `web/test/`<br>`web/test/design-system-compliance.test.ts`<br>`web/test/ui-kit-retirement.test.ts`<br>`web/test/site-appearance-and-skins.test.ts` | 自动化执行 21 份规范完整性、RULE 001–016 指令合规、Token 完整性、Z-Index 与圆角门禁以及退场规则守护。 |
| **6. CI 检查配置** | `.github/workflows/quality.yml`<br>`web/package.json` (`test`, `lint`, `typecheck`) | 在 GitHub Actions `web` job 中串行执行类型检查、UI 退场门禁与合规单测，阻断不合规代码合入主干。 |
| **7. UI 例外登记文件** | `docs/design-system/EXCEPTIONS.md` | 权威登记所有存量偏离与临时特批例外，实施全生命周期跟踪与 Phase 5 销号管理。 |

---

## 4. 四层架构关系示意

```text
┌────────────────────────────────────────────────────────────────────────┐
│  Layer 1: Global Design Foundation                                     │
│  间距 4px 网格 · 字号 6 档 · 圆角 4 档 · 阴影分层 · 动效 150-250ms · WCAG AA │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
┌──────────────────────────────────▼─────────────────────────────────────┐
│  Layer 2: Theme & Appearance Runtime                                   │
│  /admin/settings/appearance 后台外观配置 · CSS Variables (:root) · AntD  │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
       ┌───────────────────────────┼───────────────────────────┐
       ▼                           ▼                           ▼
┌──────────────┐            ┌──────────────┐            ┌──────────────┐
│  Public UI   │            │   Admin UI   │            │  Studio UI   │
│  认证/欢迎页 │            │  运营控制台  │            │  AI 创作工作台 │
└──────────────┘            └──────────────┘            └──────────────┘
       ▲                           ▲                           ▲
       │                           │                           │
┌──────┴───────┐            ┌──────┴───────┐            ┌──────┴───────┐
│  Canvas UI   │            │  Plugin UI   │            │ Shared Comp  │
│  无限节点画布 │            │  热插拔插件  │            │ Celadon UI   │
└──────────────┴────────────┴──────────────┴────────────┴──────────────┘
│  Layer 3 & 4: Application Design Systems & Component Contracts         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 5. 实施纪律与执行者必读

任何在当前仓库中编写或修改前端 UI 的 AI 助手与协作者，在每次执行任务前：
1. **先查阅**：检查本目录下的对应专题文档。
2. **先复用**：优先从 `@/components/ui/`（Celadon UI 自研层）或统一 Ant Design 封装（`AppModal`、`AppDrawer` 等）中选择已有组件。
3. **查令牌**：必须使用语义化 Token，禁止裸写 `text-[13px]`、`rounded-[7px]`、`#4f46e5` 或任意 `z-[99999]`。
4. **验证门禁**：改动后必须运行对应自动化合规测试（`cd web && bun test test/design-system-compliance.test.ts`）。
