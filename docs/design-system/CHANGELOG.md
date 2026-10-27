# CHANGELOG — SupDance UI Design System 版本演进与变更记录

> 本文件遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/) 规范，版本号遵循 [语义化版本 2.0.0](https://semver.org/lang/zh-CN/)。

---

## [1.0.0] - 2026-10-27

### 架构突破 (Milestones)
- **正式建立 SupDance 全站 UI Design System V1.0**：全站确立“四层 UI 架构”（Global Foundation → Theme Runtime → Application Scope → Component Implementation）。
- **确定管理后台最高配置优先级**：正式确立 `/admin/settings/appearance` 线上正式生效配置对全站主题的绝对最高优先级。
- **确立六大物理作用域隔离**：划定 `global`、`public`、`admin`、`studio`、`canvas`、`plugin` 六大样式防火墙，阻断跨业务模块样式污染。

### 新增规范文件 (Added)
- `README.md`：设计系统总览索引与执行大纲。
- `00-UI-AUDIT.md`：全站真实架构技术栈深度调查报告与全站组件盘点表 (UI Inventory)。
- `01-DESIGN-FOUNDATIONS.md`：第一层全局设计基石（字体栈、4px 间距网格、4 档圆角、双层光照阴影、WCAG 2.2 AA 无障碍底线）。
- `02-DESIGN-TOKENS.md`：三层 Design Tokens 变量字典与运行时映射表。
- `03-PUBLIC-UI.md`：网站前台与认证系统视觉规范（登录、注册、找回密码、暗黑版登录、画布分享、工信部备案展示）。
- `04-ADMIN-UI.md`：管理后台专有视觉与布局规范（折叠侧栏、三大页面原型、高密度数据表格）。
- `05-STUDIO-UI.md`：AI 生成岛与创作工作台专属规范（四模态创作控制、真实状态机、拒绝假进度条、成果卡片）。
- `06-CANVAS-UI.md`：无限画布设计系统规范（空间坐标隔离、节点状态矩阵、拓扑连线、工具栏与小地图）。
- `07-COMPONENT-CONTRACTS.md`：核心基础组件契约（Button、Select/Dropdown、Input/Form、Switch、Checkbox、SegmentedControl）。
- `08-OVERLAY-AND-ZINDEX.md`：浮层遮罩与 Z-Index 层级管理系统规范（0–2000 语义阶梯、层叠上下文陷阱规避、焦点循环捕获）。
- `09-MOTION-SYSTEM.md`：统一动效与交互反馈规范（6 档时长阶梯、合成层动画铁律、prefers-reduced-motion 减弱动效响应）。
- `10-RESPONSIVE-SYSTEM.md`：全站响应式与跨端布局规范（6 档断点、表格横向滚动保护、44px 移动端触控目标）。
- `11-THEME-APPEARANCE.md`：后台外观配置最高优先级与作用域隔离规范（四级优先级判定法、首屏防闪烁）。
- `12-PLUGIN-UI-CONTRACT.md`：插件 UI 强制兼容契约（插件十二条铁律、第三方无侵入适配层架构）。
- `13-ACCESSIBILITY-I18N.md`：国际化与无障碍设计规范（六国语言适配、字符膨胀弹性布局、全键盘操作闭环）。
- `14-UI-TESTING.md`：自动化检测与视觉回归测试规范（静态检测规则、Bun Test 合规门禁、CI 流水线要求）。
- `15-UPSTREAM-COMPATIBILITY.md`：Git 上游同步与二次开发兼容维护规范（分支模型、补丁双重登记、冲突自动化预警）。
- `16-MIGRATION-PLAN.md`：存量页面平滑迁移方案与实施路线图（P0/P1/P2 阶段排序、安全回滚方案）。
- `EXCEPTIONS.md`：UI 设计系统例外登记、偏离审批机制与存量基线例外台账（RULE 015 落地）。
- `UI-CHECKLIST.md`：AI 编程与前端工程师上线前强制自检清单。

### 自动化检测 (Tooling)
- 新增 `web/test/design-system-compliance.test.ts`：以非侵入式自动化单测形式验证规范文件完整性、AI 规则对齐情况、Z-Index 合法性与主题令牌完整性。

### 永久规则更新 (Governance)
- 更新根目录 `AGENTS.md`，正式追加“第 11 节：SupDance 全站 UI Design System 长期执行规范 (RULE 001 - RULE 016)”。
