# 02 — Design Tokens 变量体系与运行时映射字典 (Design Tokens Dictionary)

> **设计层级**：Layer 1 & Layer 2 — Primitive → Semantic → Component  
> **权威原则**：禁止在业务组件或样式表中随意硬编码 Hex 色值、裸像素尺寸与随意 Z-Index。所有样式必须通过本字典中的语义变量进行消费。

---

## 1. 三层 Token 架构

SupDance 采用严格的三层 Token 架构：

```text
Layer 1: Primitive Tokens (纯值，无业务语义，不随主题直接变化)
   ↓ 抽象
Layer 2: Semantic Tokens (语义角色，按 Light / Dark 自动适配，承接后台主题配置)
   ↓ 消费
Layer 3: Component Tokens (具体控件契约，如 --btn-solid-bg、--control-radius)
```

---

## 2. 颜色令牌字典 (Color Tokens)

### 2.1 品牌与强调色 (Brand & Accent)
| 语义令牌 (CSS Variable) | 浅色模式默认值 | 深色模式默认值 | 用途与对比度约束 |
| :--- | :--- | :--- | :--- |
| `--primary` | `#17171a` | `#f5f5f5` | 主操作、关键强调底色（文本对底色对比度 ≥ 7:1） |
| `--primary-foreground` | `#ffffff` | `#171717` | 主操作按钮前景文字、图标 |
| `--primary-hover` | `#303030` | `#ffffff` | 主操作悬停态 |
| `--primary-active` | `#404040` | `#e5e5e5` | 主操作按下态 |
| `--accent` | `rgba(17,17,17,0.09)` | `rgba(255,255,255,0.12)`| 选中项背景、轻量激活态 |
| `--accent-foreground` | `#171717` | `#f5f5f5` | 选中项前景文本 |

### 2.2 文本与图标色 (Text & Icon)
| 语义令牌 | 浅色模式默认值 | 深色模式默认值 | 说明与无障碍要求 |
| :--- | :--- | :--- | :--- |
| `--foreground` | `#171717` | `#f5f5f5` | 一级正文、主要标题（对比度 ≥ 10:1） |
| `--muted-foreground` | `rgba(23,23,23,0.64)` | `rgba(245,245,245,0.64)`| 二级辅助说明、表单占位符（对比度 ≥ 4.5:1） |
| `--text-tertiary` | `rgba(23,23,23,0.42)` | `rgba(245,245,245,0.42)`| 三级失效文本、只读提示（对比度 ≥ 3.0:1） |
| `--icon-foreground` | `var(--foreground)` | `var(--foreground)` | 标准交互图标色 |
| `--icon-muted` | `var(--muted-foreground)` | `var(--muted-foreground)`| 弱化提示图标 |
| `--icon-active` | `var(--primary)` | `var(--primary)` | 激活/选中状态图标 |

### 2.3 表面与背景色 (Surface & Background)
| 语义令牌 | 浅色模式默认值 | 深色模式默认值 | 说明 |
| :--- | :--- | :--- | :--- |
| `--background` | `#ffffff` | `#0f0f11` | 页面最底层画布基底 |
| `--card` / `--surface` | `#ffffff` | `#18181b` | 标准卡片表面 |
| `--card-surface` | `#f6f6f8` | `#1c1c20` | 高频次级卡片（如列表项） |
| `--card-surface-hover` | `#efeff2` | `#232328` | 卡片悬停底色 |
| `--card-surface-raised`| `#eaeaed` | `#2a2a30` | 抬升次级卡片 |
| `--popover` | `#ffffff` | `#1f1f20` | 浮动下拉、气泡浮层（实底不透明） |
| `--workspace-surface` | `#fafafa` | `#121214` | 创作者工作台主背景 |
| `--workspace-grid-line`| `rgba(0,0,0,0.06)` | `rgba(255,255,255,0.06)`| 画布网格线色 |

### 2.4 边框与控件控制 (Borders & Controls)
| 语义令牌 | 浅色模式默认值 | 深色模式默认值 | 说明 |
| :--- | :--- | :--- | :--- |
| `--border` | `rgba(17,17,17,0.12)` | `rgba(255,255,255,0.12)`| 容器默认分隔线 |
| `--control-border` | `rgba(17,17,17,0.18)` | `rgba(255,255,255,0.22)`| 输入控件、下拉默认边框 |
| `--ring` / `--control-focus`| `rgba(17,17,17,0.24)` | `rgba(255,255,255,0.32)`| 焦点轮廓光圈色 |
| `--control-disabled-bg` | `rgba(17,17,17,0.05)` | `rgba(255,255,255,0.06)`| 禁用控件背景 |
| `--control-disabled-fg` | `rgba(17,17,17,0.36)` | `rgba(255,255,255,0.38)`| 禁用控件文字 |

### 2.5 状态反馈色 (State Colors)
状态色成对定义，绝不出现仅有背景无文字颜色的情况：

```css
/* 成功色 */
--palette-status-success: #16a34a;       /* 浅色图标与边框 */
--palette-status-success-bg: #f0fdf4;    /* 浅色提示背景 */
--palette-status-success-dark: #4ade80;  /* 深色文字高亮 */

/* 警告色 */
--palette-status-warning: #d97706;
--palette-status-warning-bg: #fffbeb;
--palette-status-warning-dark: #fbbf24;

/* 危险/错误色 */
--palette-status-error: #dc2626;
--palette-status-error-bg: #fef2f2;
--palette-status-error-dark: #f87171;
--destructive: var(--palette-status-error);
--destructive-foreground: #ffffff;

/* 信息与任务加载中 */
--palette-status-loading: #2563eb;
--palette-status-loading-bg: #eff6ff;
--palette-status-loading-dark: #60a5fa;
```

---

## 3. 组件级核心映射字典 (Component Tokens)

### 3.1 按钮类 (Buttons)
```css
--btn-solid-bg: var(--primary);
--btn-solid-hover-bg: var(--primary-hover);
--btn-solid-active-bg: var(--primary-active);
--btn-solid-fg: var(--primary-foreground);

--button-radius: var(--r-md); /* 8px */
```

### 3.2 开关控件 (Switch)
主操作与开关是不同语义角色，开关开启固定使用成功绿：
```css
--control-switch-checked-bg: #16a34a;
--control-switch-checked-hover-bg: #15803d;
--control-switch-checked-handle: #ffffff;
--control-switch-off-bg: #b8b8b8;
--control-switch-off-hover-bg: #9f9f9f;
--control-switch-off-handle: #ffffff;
```

---

## 4. 全局 Z-Index 层级映射表

全站统一分配 `0–2000` 层级，严禁使用裸数字或随意 `99999`：

| 语义层级令牌 | 推荐值 | 适用场景 |
| :--- | :--- | :--- |
| `--z-canvas` | `0` | 画布最底层渲染容器 |
| `--z-canvas-overlay` | `5` | 画布网格、背景导轨、连接线 |
| `--z-node` | `10` | 未激活画布节点 |
| `--z-node-active` | `20` | 当前选中、拖拽中激活节点 |
| `--z-toolbar` | `30` | 浮动工具栏、工作台顶栏、吸底 Dock |
| `--z-node-toolbar` | `50` | 单个节点内弹出的微型快捷操作条 |
| `--z-panel` | `60` | 侧边栏面板、素材收纳抽屉 |
| `--z-panel-floating` | `80` | AI 创作悬浮面板、Agent 状态指示器 |
| `--z-modal` | `100` | 默认轻量对话框 (轻量级) |
| `--z-modal-overlay` | `110` | 模态框半透明遮罩 Backdrop |
| `--z-popover` / `--z-dropdown`| `300` | 常规下拉选框、上下文右键菜单 |
| `--z-drawer` | `400` | 全局滑动侧拉抽屉 |
| `--z-toast` | `500` | 顶层操作成功/错误提示 (Message / Toast) |
| `--z-dialog-popover` | `1100` | **Ant Design Modal (1000) 之上的内嵌下拉与日期选择器** |
| `--z-tooltip` | `1150` | 悬停提示 Tooltip（必须覆盖在 Modal 及其内嵌浮层之上） |
| `--z-loader` | `1200` | 全屏阻塞式加载指示器 |
| `--z-max` | `2000` | 紧急中断通知、系统脱机警报 |

---

## 5. 运行时映射链路与多出口保障

1. **CSS 变量导出出口**：
   - 由 `web/src/lib/skin-themes.ts` 的 `skinCSSVariables()` 计算生成，并通过 `applySkinTheme()` 注入至 `document.documentElement.style`。
2. **Ant Design 导出出口**：
   - 由 `web/src/lib/app-theme.ts` 的 `getAntThemeConfig()` 消费，生成 Ant Design `<ConfigProvider theme={...}>` 所需的 Token 配置（包含 `colorPrimary`、`colorBgContainer`、`borderRadius`、`controlHeight` 等）。
3. **管理后台隔离出口**：
   - 由 `web/src/pages/admin/theme/admin-tokens.css` 在 `[data-admin-root]` 作用域内独立定义 `--admin-*` 变量，与前台及工作台完全隔离。
