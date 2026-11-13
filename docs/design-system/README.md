# SupDance / 影策全站 UI Design System 设计规范与长期执行体系 V2.0

> **版本**：2.0.0 (Latest)  
> **发布日期**：2026-11-13  
> **适用项目**：影策 / SupDance (`ddcat-ai/open-ai-canvas`)  
> **权威等级**：最高执行标准。所有后续 AI 编程任务、前端开发、管理后台与插件开发必须严格遵循本文档体系。

---

## 1. 体系定位与最高执行指令

SupDance / 影策 UI Design System 是面向 AI 影视与短剧创作工作台（Studio / Canvas / Admin / Public / Plugins）建立的一套**完整、统一、可扩展、可配置、可验证且长期强制执行**的全站设计系统与交互规范。

### V2.0 重大演进与废弃声明 (Superseded & Unified)
1. **单一真理源升级**：旧版 V1.0 本地草案及第三方规范包路径已全面废弃。全站唯一权威视觉参数以实测站点（https://yingce.tv/）为基准，收敛至 [`UI-SPEC.md`](./UI-SPEC.md) 与机器可读字典 [`design-tokens.json`](./design-tokens.json)。
2. **Design System First**：所有新页面、新组件、新插件及后续 UI 修改，必须优先阅读并遵循本规范体系，**严禁自行创造第二套样式标准或散落内联 Hex 色值**。
3. **Backend Appearance Priority**：后台（`/admin/settings/appearance`）已保存并启用的外观设置在其管辖作用域内享有最高优先级。
4. **Four-Layer Architecture**：全站严格按四层架构（Global Foundation → Theme & Appearance Runtime → Application Design System → Component Implementation）进行样式解耦。
5. **Scope Isolation**：前台（Public）、后台（Admin）、生成岛（Studio）、无限画布（Canvas）和插件（Plugin）各自维护作用域变量与隔离边界，杜绝样式污染。

---

## 2. V2.0 权威核心交付物索引 (Core Deliverables)

为防止文档碎片化与未来冲突，设计系统设立 7 大核心权威规范：

| 交付文件 | 链接 | 核心内容与职责 |
| :--- | :--- | :--- |
| **参考站点实测** | [REFERENCE-AUDIT.md](./REFERENCE-AUDIT.md) | yingce.tv 真实视口/主题覆盖矩阵、实测尺寸与证据索引（EVD-001 ~ EVD-017） |
| **视觉基石规范** | [UI-SPEC.md](./UI-SPEC.md) | Oklch 基础色板、6 档字号阶梯、4px 间距网格、圆角与暗黑 Hairline 抬升、8 级 Z-Index 天梯 |
| **机器可读字典** | [design-tokens.json](./design-tokens.json) | 机器可读单一真理源：Primitive → Semantic → Component 三层令牌及双模对称映射 |
| **全量组件契约** | [COMPONENT-CATALOG.md](./COMPONENT-CATALOG.md) | 20+ 组件全量契约、状态矩阵、WAI-ARIA APG 键盘交互及下拉/模型选择 Popover 深度规范 |
| **插件与主题契约** | [PLUGIN-THEME-CONTRACT.md](./PLUGIN-THEME-CONTRACT.md) | 样式隔离作用域（`.plugin-scope-*`）、插槽扩展机制、防上游代码覆盖三层防线及代码示例 |
| **管理与迁移方案** | [MIGRATION-AND-ADMIN.md](./MIGRATION-AND-ADMIN.md) | 外观设置 JSON Schema V2、默认兜底与快照回退、四阶段分批迁移路线图与排障手册 |
| **阶段验收报告** | [ACCEPTANCE-REPORT.md](./ACCEPTANCE-REPORT.md) | 证据链追踪、全量测试执行报告（3865 用例 100% 通过）与边界明确说明 |

---

## 3. 规范专题模块对照地图 (Module Map - V2.0 Aligned)

以下 21 份专题规范已全面对齐 V2.0 权威标准，持续受 `web/test/design-system-compliance.test.ts` 门禁守护：

| 编号 | 文档名称 | 核心内容与适用范围 | 状态 |
| :--- | :--- | :--- | :--- |
| **00** | [00-UI-AUDIT.md](./00-UI-AUDIT.md) | 全站真实架构技术栈深度调查、UI Inventory 盘点表与风险分级 | 已对齐 V2.0 |
| **01** | [01-DESIGN-FOUNDATIONS.md](./01-DESIGN-FOUNDATIONS.md) | 第一层全局设计基石：字体排印、4px 间距网格、圆角、阴影、层级与无障碍底线 | 已对齐 V2.0 |
| **02** | [02-DESIGN-TOKENS.md](./02-DESIGN-TOKENS.md) | 全局 Design Tokens 字典：Primitive → Semantic → Component 三层令牌及映射 | 已对齐 V2.0 |
| **03** | [03-PUBLIC-UI.md](./03-PUBLIC-UI.md) | 网站前台与认证体系规范（登录、注册、找回密码、暗黑版登录、画布分享、页尾备案） | 已对齐 V2.0 |
| **04** | [04-ADMIN-UI.md](./04-ADMIN-UI.md) | 管理后台专有规范：运营控制台骨架、侧栏折叠、表格密度、统计指标、设置卡与筛选流 | 已对齐 V2.0 |
| **05** | [05-STUDIO-UI.md](./05-STUDIO-UI.md) | AI 生成岛与创作工作台规范：四模态切换、提示词容器、模型选择 Popover、成果卡 | 已对齐 V2.0 |
| **06** | [06-CANVAS-UI.md](./06-CANVAS-UI.md) | 无限画布设计系统：节点状态矩阵、连线吸附、浮动工具栏、Minimap、坐标系与局部层级隔离 | 已对齐 V2.0 |
| **07** | [07-COMPONENT-CONTRACTS.md](./07-COMPONENT-CONTRACTS.md) | 核心组件契约：Button、Select / Dropdown、Input / Form、Switch、Checkbox、Segmented 等 | 已对齐 V2.0 |
| **08** | [08-OVERLAY-AND-ZINDEX.md](./08-OVERLAY-AND-ZINDEX.md) | 浮层遮罩与 Z-Index 层级管理系统：8 级天梯、Backdrop、Modal、Drawer、Popover 规则 | 已对齐 V2.0 |
| **09** | [09-MOTION-SYSTEM.md](./09-MOTION-SYSTEM.md) | 统一动效与交互反馈系统：时长阶梯、缓动函数、硬件加速与 prefers-reduced-motion | 已对齐 V2.0 |
| **10** | [10-RESPONSIVE-SYSTEM.md](./10-RESPONSIVE-SYSTEM.md) | 响应式断点与多端布局体系：手机、平板、桌面、宽屏适配原则与触控尺寸约束 | 已对齐 V2.0 |
| **11** | [11-THEME-APPEARANCE.md](./11-THEME-APPEARANCE.md) | 后台外观设置优先与作用域隔离机制：`/admin/settings/appearance` 映射、优先级规则与实时同步 | 已对齐 V2.0 |
| **12** | [12-PLUGIN-UI-CONTRACT.md](./12-PLUGIN-UI-CONTRACT.md) | 插件 UI 强制兼容契约：防止全局样式污染、令牌继承、弹窗管理与第三方适配层 | 已对齐 V2.0 |
| **13** | [13-ACCESSIBILITY-I18N.md](./13-ACCESSIBILITY-I18N.md) | 多语言（六国语言）与无障碍规范：WCAG 2.2 AA、对比度、键盘闭环、长文本防溢出 | 已对齐 V2.0 |
| **14** | [14-UI-TESTING.md](./14-UI-TESTING.md) | 自动化检测与持续执行：静态 AST/正则检查、令牌合规单测、视觉回归基线与 CI 门禁 | 已对齐 V2.0 |
| **15** | [15-UPSTREAM-COMPATIBILITY.md](./15-UPSTREAM-COMPATIBILITY.md) | Git 上游更新与长期维护契约：上游同步保护、二次开发边界、补丁登记与冲突预警 | 已对齐 V2.0 |
| **16** | [16-MIGRATION-PLAN.md](./16-MIGRATION-PLAN.md) | 存量页面平滑迁移方案：P0 / P1 / P2 阶段排序、兼容垫片、验证标准与安全回滚方案 | 已对齐 V2.0 |
| **EXC**| [EXCEPTIONS.md](./EXCEPTIONS.md) | UI 设计系统例外登记、偏离审批机制与存量基线例外台账（RULE 015 落地） | 已就绪 |
| **CK** | [UI-CHECKLIST.md](./UI-CHECKLIST.md) | AI 与开发人员提交代码前强制自检清单（16 项规则对齐） | 已就绪 |
| **CL** | [CHANGELOG.md](./CHANGELOG.md) | 设计系统版本演进与变更记录（记录 V2.0.0 发布与旧版废弃） | 已就绪 |

---

## 4. 真实物理架构与核心资产映射表 (Physical Architecture)

根据当前仓库真实工程结构，设计系统的核心资产落地映射如下：

| 要素分类 | 仓库真实物理位置 | 核心职责与运行时机制 |
| :--- | :--- | :--- |
| **1. 机器可读 Tokens** | `docs/design-system/design-tokens.json` | 机器可读单一真理源，声明全部基础、语义与组件度量参数。 |
| **2. 样式变量源文件** | `web/src/styles/globals.css`<br>`web/src/lib/skin-themes.ts`<br>`web/src/supdance/theme/supdance-skin.ts`<br>`web/src/pages/admin/theme/admin-tokens.css` | 声明三层 Token（Primitive、Semantic、Component），定义语义色与组件度量，管理后台 `--admin-*` 变量隔离。 |
| **3. 运行时主题映射** | `web/src/lib/skin-themes.ts` (`skinCSSVariables()`)<br>`web/src/lib/app-theme.ts` (`getAntThemeConfig()`)<br>`web/src/pages/admin/theme/` (`getIsolatedAdminAntTheme()`) | 将后台保存的主题动态注入 `:root` CSS 变量，桥接 Ant Design `<ConfigProvider>` Token，保证首屏防闪烁与实时分发。 |
| **4. 共享组件目录** | `web/src/components/ui/` (Celadon UI)<br>`web/src/components/layout/`<br>`web/src/pages/admin/components/` & `web/src/pages/admin/ui/` | `base/` 提供标准 Button、Select、Switch、Checkbox；`product/` 提供 AppModal、AppDrawer、EmptyState；后台提供隔离高密度控件。 |
| **5. 隔离展示实验室** | `web/src/pages/dev/design-system-showcase.tsx`<br>路由：`http://localhost:3000/dev/design-system` | 隔离开发环境下的全套交互演示组件，生产打包自动剔除。 |
| **6. 自动化合规测试** | `web/test/design-system-compliance.test.ts`<br>`web/test/ui-kit-retirement.test.ts` | 自动化执行规范完整性、RULE 001–016 指令合规、Token 完整性、Z-Index 与圆角门禁以及退场规则守护。 |
| **7. CI 门禁配置** | `.github/workflows/quality.yml`<br>`scripts/verify-before-push.mjs` | 在提交与发布前串行执行类型检查、UI 退场门禁与合规单测，阻断不合规代码合入主干。 |
