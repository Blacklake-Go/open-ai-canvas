# 影策组件规范与全量目录 (COMPONENT-CATALOG.md)

> **版本**：2.0.0  
> **制定日期**：2026-11-13  
> **组件架构**：Celadon UI (React Aria + CVA + Tailwind v4) 配合 Ant Design 6 隔离桥接层  
> **适用范围**：全站通用基础组件、数据反馈组件、浮层组件与 AI 创作业务复合组件。

---

## 1. 组件分层与治理总览

SupDance / 影策组件体系采用三层治理架构：
1. **基础原子层 (Base Primitives)**：位于 `web/src/components/ui/base/`，基于 Web 标准与无障碍 APG 封装的纯净受控控件（Button, Input, Select, Checkbox, Switch）。
2. **产品结构层 (Product Patterns)**：位于 `web/src/components/ui/product/`，解决全站共性交互模式（AppModal, AppDrawer, EmptyState, SettingsRow）。
3. **业务复合层 (Composite Domain Controls)**：服务于 AI 创作、短剧分镜与无限画布的高阶组件（ModelPicker, ParameterPill, PromptBox, AssetCard）。

### 存量组件盘点与技术选型契约
- **复用 (Retain & Standardize)**：`web/src/components/ui/base/select/select.tsx`（已集成 `useDismissPopupOnAnchorMove`）、`AppModal`、`AppDrawer`。
- **封装与收敛 (Wrap & Restrict)**：所有业务模块禁用原生 `<select>`、`<input type="checkbox">` 和散落的 AntD 原生标签，统一收敛至本目录导出的规范组件。
- **废弃防线 (Retirement Baseline)**：严禁直接调用静态 `Modal.confirm`（打破 React 上下文与主题继承）和全局未包装的 `Empty`。

---

## 2. 布局与导航类组件规范

### 2.1 工作区外壳 (AppShell)
- **用途**：承载左侧导航、顶部工具条及主创作/画布滚动视口。
- **结构与子元素**：
  - `AppSidebar`：左侧固定/折叠容器。
  - `AppTopbar`：顶部吸顶工具栏。
  - `AppNoticeBanner`：可选顶部系统公告条。
  - `AppContent`：主工作区弹性滚动容器 (`flex-1 overflow-auto`)。
- **状态矩阵**：
  - 侧栏展开态 (`width: 220px`)。
  - 侧栏图标折叠态 (`width: 64px`)。
  - 移动端隐藏态（通过汉堡按钮呼出 `AppDrawer` 抽屉）。
- **Props 契约**：
  ```ts
  interface AppShellProps {
    sidebarCollapsed?: boolean;
    onSidebarCollapseChange?: (collapsed: boolean) => void;
    banner?: React.ReactNode;
    topbar: React.ReactNode;
    children: React.ReactNode;
  }
  ```

### 2.2 顶部工具条 (Header / Topbar)
- **实测与规范**：固定高度 `48px`，背景 `var(--ui-bg-canvas)` 配合毛玻璃效果。
- **子元素构成**：
  - 左侧：当前工作区面包屑 (`Breadcrumb`)。
  - 右侧：操作区组合（语言药丸 `LanguagePill`、积分药丸 `CreditPill`、主题切换器 `ThemeToggler`、用户头像/游客状态 `UserPill`）。
- **长文本截断**：面包屑在窄屏下自动隐藏中间层级，仅保留“上一级 / 当前页”。

---

## 3. 按钮与标签类组件规范

### 3.1 按钮 (Button)
- **变体分类 (Variants)**：
  1. `solid` (主操作按钮)：背景 `var(--ui-primary)`，前景 `var(--ui-primary-foreground)`，轻微抬升阴影。
  2. `secondary` (次级按钮)：背景 `var(--ui-bg-surface-subtle)`，前景 `var(--ui-text-primary)`，边框 `var(--ui-border-control)`。
  3. `outline` (描边按钮)：透明背景，`1px solid var(--ui-border-control)`。
  4. `ghost` / `text` (文字按钮)：无背景无边框，悬停时浅灰底 `rgba(0,0,0,0.05)`。
  5. `danger` (危险按钮)：背景 `var(--ui-status-danger)`，前景纯白。
- **尺寸档位 (Sizes)**：
  - `sm`：高度 `30px`，字号 `12px`，内边距 `0 8px`，圆角 `8px`。
  - `md`：高度 `36px`，字号 `13px`，内边距 `0 12px`，圆角 `8px`。
  - `lg`：高度 `42px`，字号 `14px`，内边距 `0 16px`，圆角 `8px`。
- **状态矩阵**：
  - Default（默认）、Hover（悬停）、Active（按下位移 1px）、Focus-Visible（2px 外光圈）、Disabled（禁用灰显、`cursor: not-allowed`）、Loading（Spinner 旋转、阻止重复点击）。
- **无障碍要求**：图标按钮必须显式传入 `aria-label`。

### 3.2 胶囊药丸按钮 (PillButton)
- **实测特征**：圆角 `9999px`，高度 `26px ~ 34px`，内边距左右留白与文字居中，常用于分类切换与顶栏元数据展示。

---

## 4. 表单与选择类组件深度规范 (核心重点)

### 4.1 输入框与密码框 (Input & PasswordInput)
- **规范度量**：
  - 高度：标准 `36px`，认证大尺寸 `42px`。
  - 圆角：标准 `8px`，认证表单 `12px`。
  - 边框：平时 `1px solid var(--ui-border-control)`，焦点态 `var(--ui-border-focus)` 配合 `box-shadow: 0 0 0 2px var(--ui-border-focus)`。
- **功能特性**：
  - 前缀与后缀图标插槽（如 Search 图标、清除按钮）。
  - 密码框右侧集成眼睛切换按钮（`<Eye />` / `<EyeOff />`），点击切换 `type="password" <-> type="text"`。

---

### 4.2 下拉框、选择器与参数浮层 (Dropdown, Select & Popover 专项)

本节响应审计重点，对全站下拉、模型选择与参数面板建立强契约规范：

#### A. 触发器规范 (Trigger Specification)
1. **尺寸与形态**：
   - 高度：标准控件 `34px ~ 36px`，紧凑型 `30px`。
   - 包含元素：前置语义图标（如模型 Logo、画幅比例图标）、当前选中值或占位符、右侧 Chevron 箭头。
   - 交互状态：展开时 Chevron 图标顺时针旋转 180° (`transform: rotate(180deg); transition: transform 180ms ease`)。
2. **禁用与只读态**：
   - 背景置灰 `var(--ui-bg-surface-subtle)`，透明度 0.6，禁止光标 `not-allowed`。

#### B. 弹出面板规范 (Overlay Panel Specification)
1. **尺寸与定位**：
   - 默认吸附在触发器正下方，间距 `4px` (`offset: 4`)。
   - 最小宽度等于触发器宽度，模型选择面板固定宽度 `320px`。
   - 最大高度：`320px`，超过时面板内部开启平滑滚动 (`overflow-y: auto`)。
2. **边界避让与挂载策略 (Collision & Portal)**：
   - 必须通过 `React Portal` 挂载至 `document.body` 或最近的模态上下文，严禁被父容器的 `overflow: hidden` 截断。
   - 启用边界碰撞翻转：当视口底部空间不足以容纳面板时，自动向上翻转弹出 (`placement: top-start`)。
3. **面板内部结构**：
   - **顶部搜索栏 (可选)**：针对长列表（>8 项），顶部提供搜索框，支持拼音与英文即时模糊过滤。
   - **分组与分割线**：多类别模型按供应商或类型（如“官方满血”、“社区微调”）分组，分组头高度 `28px`，字号 `11px`，字重 `600`。
   - **空数据状态**：当筛选无结果或系统未配置模型时，展示温和提示卡（如实测中的“当前没有可用模型，请联系管理员或检查模型配置”），禁止面板坍塌为 0 像素。

#### C. 键盘与鼠标交互状态机 (Keyboard & A11y)
1. **聚焦打开**：Tab 键聚焦触发器，按 `Enter` 或 `Space` 展开面板。
2. **列表巡航**：面板展开后焦点落入选项列表，使用 `ArrowDown` / `ArrowUp` 移动高亮焦点；
3. **回车确认**：在目标选项上按 `Enter` 触发选中，面板立即收起，焦点自动退回至触发器；
4. **Esc 关闭**：按 `Escape` 立即关闭面板，不产生任何选择副作用；
5. **失焦与滚动关闭**：
   - 点击面板外部区域自动触发 `dismiss`。
   - 页面背景大幅度滚动时，触发 `useDismissPopupOnAnchorMove` 自动安全收起，防止面板漂浮在视口空白处。

#### D. 多选与单选语义
- 单选列表：选中项右侧显示 Checkmark 图标或高亮背景色 `var(--ui-bg-surface-raised)`。
- 多选列表：每个选项左侧展示 Checkbox 复选框，支持批量选取。

---

## 5. 数据展示与反馈组件规范

### 5.1 卡片体系 (Card System)
- **基础卡片 (Surface Card)**：背景 `var(--ui-bg-surface)`，圆角 `12px`，边框 `1px solid var(--ui-border-subtle)`。
- **悬停交互卡片 (Interactive Card)**：
  - 默认态：平整表面。
  - 悬停态：位移向上抬升 `1px` (`transform: translateY(-1px)`)，阴影切换为 `--elevation-card-hover`，过渡时间 `180ms`。
- **媒体卡片 (Media / Asset Card)**：
  - 封面区域：保持固定宽高比（`16:9`、`1:1` 或 `9:16`），图片填充模式必须使用 `object-fit: cover`。
  - 骨架占位：图片加载过程中展示 Shimmer 扫光骨架屏；加载失败时展示回退图标与失败状态。

### 5.2 空状态与缺省页 (EmptyState & 404)
- **结构规范**：居中对齐，包含语义图标（`48×48px`）、主标题（`16px` 字重 600）、副标题说明（`13px` 灰色）、行动按钮（如“返回首页”、“创建第一个项目”）。

---

## 6. 浮层与模态弹窗规范 (Overlays)

### 6.1 产品级模态弹窗 (AppModal / Dialog)
- **实测复刻规范**：
  - 视口遮罩 (Backdrop)：`background: rgba(0, 0, 0, 0.45)`，`backdrop-filter: blur(5px)`。
  - 弹窗外壳：圆角 `16px`，实底不透明，支持左右双栏或单栏居中。
  - 右上角关闭按钮：必须常驻且支持点击，同时监听全局 `Escape` 键关闭。
  - **焦点捕获 (Focus Trap)**：弹窗打开时，Tab 键只在弹窗内部元素循环，防止背景元素被误操作；关闭后焦点恢复至触发弹窗的按钮。
  - **滚动锁定**：弹窗打开时为 `document.body` 添加 `overflow: hidden`，防止背景连带滚动。

### 6.2 抽屉组件 (AppDrawer)
- **实测规范**：自右向左或自左向右滑入，宽度 `360px ~ 480px`，动画时长 `250ms`。

---

## 7. AI 创作业务复合组件规范 (Domain Components)

### 7.1 提示词编辑容器 (PromptBox)
- **结构构成**：
  - 上层：多行自适应文本域 (`AutoResizeTextarea`)。
  - 下层控制条：附件入口按钮、模型选择器触发器、参数药丸触发器、发送/开始创作主按钮。
- **快捷引用支持**：输入 `@` 弹出节点引用菜单，输入 `/` 弹出技能选择菜单。

### 7.2 任务状态机徽章 (TaskStatusBadge)
- **状态映射**：
  - 排队中 (Queued)：黄色点缀，文本“排队中”。
  - 生成中 (Generating)：蓝色旋转动画，展示进度百分比。
  - 成功 (Success)：绿色钩号。
  - 失败 (Failed)：红色感叹号，悬停展示错误原因。
