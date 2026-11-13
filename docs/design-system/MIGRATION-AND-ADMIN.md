# 影策 UI 设计系统管理与分批平滑迁移方案 (MIGRATION-AND-ADMIN.md)

> **版本**：2.0.0  
> **制定日期**：2026-11-13  
> **核心目标**：提供主题可视化管理架构 Schema，并制定平滑、零风险、可回滚的全站分批迁移计划。

---

## 1. 统一管理与后台外观架构

### 1.1 管理入口设计
优先复用项目既有成熟管理入口：`/admin/settings/appearance`（系统设置 → 外观设置）。
- **权限与隔离契约**：仅系统超级管理员可读写外观配置，普通用户与游客仅允许在客户端临时切换“明/暗/跟随系统”偏好。
- **职责边界分离**：
  - **外观设置 (Appearance)**：仅管辖品牌名称、字标 Logo、品牌主色、圆角阶梯、默认模式（Light/Dark）、字体方案与阴影风格。
  - **业务解耦**：模型渠道、支付账单、存储配置、会员权限与内容合规开关留存于对应独立管理页，严禁与外观配置杂糅。

### 1.2 外观配置数据 Schema (JSON Schema V2)
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "AppearanceConfigV2",
  "type": "object",
  "properties": {
    "schemaVersion": { "type": "integer", "const": 12 },
    "brandName": { "type": "string", "maxLength": 50 },
    "brandSlug": { "type": "string" },
    "logoUrl": { "type": "string" },
    "darkLogoUrl": { "type": "string" },
    "activeSkinId": { "type": "string", "default": "classic" },
    "appearanceSettings": {
      "type": "object",
      "properties": {
        "colorScheme": { "type": "string", "enum": ["system", "light", "dark"], "default": "system" },
        "density": { "type": "string", "enum": ["compact", "default", "spacious"], "default": "default" },
        "controlRadius": { "type": "integer", "minimum": 0, "maximum": 16, "default": 8 },
        "shadowStyle": { "type": "string", "enum": ["none", "soft", "strong"], "default": "soft" },
        "motionDuration": { "type": "string", "enum": ["reduced", "normal", "fast"], "default": "normal" }
      },
      "required": ["colorScheme", "density", "controlRadius"]
    },
    "customSkinOverrides": {
      "type": "object",
      "properties": {
        "primaryLight": { "type": "string", "pattern": "^#([0-9a-fA-F]{6})$" },
        "primaryDark": { "type": "string", "pattern": "^#([0-9a-fA-F]{6})$" }
      }
    }
  },
  "required": ["schemaVersion", "brandName", "activeSkinId"]
}
```

### 1.3 容灾、回退与持久化生命周期
1. **可靠默认兜底 (Fallback Strategy)**：若数据库未初始化或后台接口异常（如网络中断），前端立即启动本地硬编码的 `DEFAULT_APPEARANCE`（经典黑白、8px 圆角、无障碍高对比），确保首屏永不崩溃。
2. **草稿与即时预览 (Draft Preview)**：管理员调整滑块或取色器时，通过内存状态实时更新当前浏览器预览容器，只有在显式点击“保存发布”后才调用 `PUT /api/admin/settings/appearance`。
3. **版本回退与快照 (Revision Rollback)**：配置表中保存最近 10 次修改历史快照，管理员可随时一键恢复到上一版本或恢复出厂默认。

---

## 2. 全站分批平滑迁移计划 (Phased Migration Plan)

本阶段严格执行规范与隔离演示，全站页面改造按 **四阶段递进式推进**。每一批次均设立严格准入、验证与回滚边界：

```text
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 1: 共享底座就绪 (Shared Foundation)                              │
│ 交付 Design Tokens、CSS 变量、Base 原子组件规范、Storybook 展示页        │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ 验收准入
┌──────────────────────────────────▼─────────────────────────────────────┐
│ Phase 2: 全局框架与基础浮层 (Global Shell & Overlays)                  │
│ Topbar 顶栏 · Sidebar 侧栏 · Breadcrumb 面包屑 · AppModal 认证弹窗     │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ 验收准入
┌──────────────────────────────────▼─────────────────────────────────────┐
│ Phase 3: 代表性核心业务页面 (Representative Domain Pages)               │
│ AI 创作 Studio (/create) · 认证中心 (/login) · 项目中心 (/projects)    │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ 验收准入
┌──────────────────────────────────▼─────────────────────────────────────┐
│ Phase 4: 全量长尾与第三方插件 (Full Rollout & Plugins)                 │
│ 管理后台高密表格 · 无限画布节点 · 插件中心 · 移动端 Bottom Sheet 优化  │
└────────────────────────────────────────────────────────────────────────┘
```

---

### 2.1 第一阶段：共享底座就绪 (Phase 1: Shared Foundation)
- **范围**：建立设计令牌权威字典（`design-tokens.json`）、生成 CSS 变量、编写组件目录规范、搭建可交互的展示实验室页面。
- **影响面**：纯新增规范文档与独立开发路由，对线上现有页面 **零侵入、零破坏**。
- **验收标准**：
  - 展示实验室能在本地流畅运行，完整测试浅色/深色主题切换。
  - 项目既有测试套件（3800+ 用例）100% 通过。
- **回滚条件**：由于是新增隔离代码，删除分支或对应文件即可物理回滚。

---

### 2.2 第二阶段：全局框架与基础浮层 (Phase 2: Global Shell & Overlays)
- **范围**：改造 `AppShell`、`AppTopbar`、`AppSidebar`，收敛顶栏药丸组件（语言、积分、主题切换），接入标准 `AppModal` 登录认证模态框。
- **影响面**：所有页面的外层边框与菜单外壳。
- **验收标准**：
  - 侧栏展开（`220px`）与折叠（`64px`）动画顺滑，无内容横向溢出。
  - 在桌面端、平板端（768px）和手机端（375px）视口无遮挡。
  - 登录模态框正确捕获焦点，毛玻璃遮罩覆盖正常，按 `Esc` 正确关闭。
- **回滚条件**：保留旧版 `WorkspaceLayout.legacy.tsx`，通过配置标志位快速切换。

---

### 2.3 第三阶段：代表性核心业务页面 (Phase 3: Representative Pages)
- **范围**：
  1. **AI 创作 Studio (`/create`)**：收敛提示词多行输入框、模式切换器、模型选择 Popover、参数胶囊、开始创作主按钮及灵感大厅卡片。
  2. **认证中心 (`/login`, `/register`)**：将弹窗逻辑与独立路由页面对齐为同一份表单契约。
  3. **项目管理中心 (`/projects`)**：统一项目卡片栅格、空状态与筛选流。
- **影响面**：用户高频创作与浏览链路。
- **验收标准**：
  - 创作模型下拉框边界碰撞自动翻转，空模型与错误状态温和呈现。
  - 按钮各种禁用、加载与防重复提交逻辑严密。
- **回滚条件**：单页面独立 Git Commit 提交，发生回归时仅 Revert 该单页 Commit。

---

### 2.4 第四阶段：全量长尾与插件接入 (Phase 4: Remaining & Plugins)
- **范围**：
  - 管理后台高密度表格与配置卡（使用 `--admin-*` 专用高密 Token）。
  - 无限画布节点卡片与 Minimap 工具浮盘。
  - 音乐生成插件、电商广告工作台等第三方扩展。
- **影响面**：深度创作与后台运营功能。
- **验收标准**：
  - 插件在独立作用域运行，更换宿主主题时无错位、无色差、无层级穿透。
  - 全站消除裸写 Tailwind 色值（如 `text-[#171717]`）和裸写圆角。

---

## 3. 升级演练与风险排查手册

| 风险场景 | 根因假设 | 规避与防护方案 |
| :--- | :--- | :--- |
| **首屏闪烁 (FOUC)** | 主题数据异步加载，CSS 变量注入晚于 DOM 首次渲染 | 在 `index.html` 头部注入同步小脚本，首屏前直接读取本地偏好设置 `.dark` class |
| **浮层被父级裁剪** | 祖先容器含有 `overflow: hidden` 或 `transform` 创建局部层叠上下文 | 下拉浮层一律使用 `Portal` 挂载至 `document.body`，通过边界碰撞计算绝对坐标 |
| **高对比度失效** | 局部写死文字颜色而底色跟随主题变暗 | 强制使用成对 Token（如 `bg-surface` 必须配对 `text-primary`） |
| **上游更新代码冲突** | 官方仓库更新了 `router.tsx` 或顶层布局 | 严格执行 `SupDanceRouteHosts` 桥接层与最小补丁清单，不改写主干核心文件 |
