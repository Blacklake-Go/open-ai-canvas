# 01 — 全局设计基石规范 (Global Design Foundations)

> **设计层级**：Layer 1 — Global Design Foundation  
> **适用范围**：全站所有模块（Public、Admin、Studio、Canvas、Plugin）共用的设计基准。  
> **权威原则**：作为全站设计系统的底层根基，任何业务组件和页面不得脱离本规范自造度量单位。

---

## 1. 字体排印系统 (Typography System)

### 1.1 字体栈 (Font Stacks)
全站统一采用无衬线与等宽双栈设计，支持多语言及中文无衬线平滑回退：

```css
/* 西文与中文混排主字体栈 */
--font-sans: "Inter Variable", "Inter", "Inter Fallback", -apple-system, BlinkMacSystemFont,
             "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "WenQuanYi Micro Hei",
             ui-sans-serif, system-ui, sans-serif;

/* 等宽、代码、模型参数与数字字体栈 */
--font-mono: "JetBrains Mono Variable", "JetBrains Mono", ui-monospace,
             SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;

/* 标题字体栈 */
--font-heading: var(--font-sans);
```

### 1.2 字号与行高阶梯 (Type Scale)
全站正文与控件收敛为 **6 个基础档位**，另加用于数据看板、数字与 Hero 标题的 Display 档位：

| 语义层级 | 字号 (px/rem) | 行高 | 推荐字重 | 适用场景 |
| :--- | :--- | :--- | :--- | :--- |
| **Micro / Label** | `11px` (0.6875rem) | `1.4` (16px) | 500 / 600 | 标签、角标、快捷键徽章、小提示 |
| **Caption** | `12px` (0.75rem) | `1.5` (18px) | 400 / 500 | 次要辅助说明、时间戳、表单帮助文本 |
| **UI Compact** | `13px` (0.8125rem) | `1.5` (20px) | 400 / 500 | 导航菜单项、紧凑表格内容、工具栏 |
| **Body (基准)** | `14px` (0.875rem) | `1.65` (22px) | 400 / 500 | 绝大多数常规正文、标准输入框、卡片描述 |
| **Body Large** | `16px` (1rem) | `1.6` (26px) | 400 / 500 | 强调正文、模态框描述、引言 |
| **Heading** | `16px` (1rem) | `1.3` (22px) | 600 | 弹窗标题、卡片分组标题、二级区域标题 |
| **Section Title** | `18px` (1.125rem) | `1.3` (24px) | 600 | 页面内分区大标题、设置组标题 |
| **Page Title** | `22px` (1.375rem) | `1.25` (28px) | 600 | 页面主标题 (`h1`)、工作台顶部名称 |
| **Display SM** | `24px` (1.5rem) | `1.2` (30px) | 600 / 700 | 统计卡片指标数字、运营看板 |
| **Display MD** | `32px` (2rem) | `1.2` (38px) | 600 / 700 | 登录页 Hero 主标题、突出数据展示 |
| **Display LG** | `44px` (2.75rem) | `1.15` (50px)| 700 | 官网宣传口号、重磅数字 |

### 1.3 字体排印硬性纪律
1. **数字与表格对齐**：金额、耗时、Token 数、坐标及表格中的所有数值，必须显式启用等宽数字特性：
   ```css
   font-variant-numeric: tabular-nums;
   ```
2. **禁止通过极小字体换取布局密度**：正文或可读内容绝对禁止低于 `12px`（缩略图内无交互示意文字 `7px` 除外）。
3. **字重约束**：全站字重严格限制为 `400` (Regular)、`500` (Medium)、`600` (Semibold)。禁止随意使用 `800` 或 `900` 粗体造成视觉跳跃。
4. **长文本折断与溢出**：
   - 模型名称与参数名：`overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`
   - 提示词与长说明：`word-break: break-word; overflow-wrap: break-word;`

---

## 2. 4px 间距系统 (Spacing System)

统一采用以 `4px` 为基础栅格的间距系统：

| 令牌名 | 像素值 | 适用场景 |
| :--- | :--- | :--- |
| `--space-0` | `0px` | 重置间距 |
| `--space-half` | `2px` | 像素级视觉微调、发丝线缝隙 |
| `--space-1` | `4px` | 紧凑元素内边距、图标与文字微距、角标偏移 |
| `--space-2` | `8px` | 按钮内部元素间距、表单字段内紧凑间隙、列表项内距 |
| `--space-3` | `12px` | 控件水平内边距、卡片紧凑间隙、下拉项高度微调 |
| `--space-4` | `16px` | 默认卡片内边距、表单上下字段间隙、标准栅格槽宽 |
| `--space-5` | `20px` | 页面区块间隙、宽松卡片内边距 |
| `--space-6` | `24px` | 模态框内边距、页面主容器留白 |
| `--space-8` | `32px` | 大区块纵向分隔、抽屉内边距 |
| `--space-10` | `40px` | 页面顶部导航栏外侧边距 |
| `--space-12` | `48px` | 登录页分区纵向间距 |
| `--space-16` | `64px` | Hero 宣传区留白 |

**严禁事项**：禁止在页面与组件中随意出现 `7px`、`11px`、`19px`、`37px` 等脱离 4px 栅格的任意像素数值。

---

## 3. 圆角系统 (Radius System)

统一采用 **4 档标准圆角 + 1 档完全胶囊** 体系：

```css
--r-xs: 4px;    /* 徽章 (Badge)、快捷键 (Kbd)、勾选框 (Checkbox)、细轨道 (Track) */
--r-md: 8px;    /* 基础控件 (Button、Input、Select、Switch、菜单项) */
--r-lg: 12px;   /* 卡片 (Card)、轻量浮层 (Popover)、面板 (Panel) */
--r-2xl: 16px;  /* 大型弹窗 (Modal)、大容器容器壳 (Stage Shell) */
--r-full: 9999px; /* 胶囊按钮、圆形头像、状态圆点 (Dot) */
```

### 映射别名规则
- `--control-radius: var(--r-md)` (8px)
- `--card-radius: var(--r-lg)` (12px)
- `--overlay-radius: var(--r-lg)` (12px)
- `--modal-radius: var(--r-2xl)` (16px)

**规则**：同一层级的容器必须采用相同圆角，禁止同一卡片内部子元素圆角大于外部父容器圆角。

---

## 4. 阴影与抬升系统 (Elevation & Shadow System)

全站阴影遵循**双层光照模型**：
- **第一层（贴近、锐利）**：交代物理边界与接触面。
- **第二层（远处、漫射）**：交代垂直悬浮高度与空间层级。

```css
/* 浅色模式阴影（以冷灰微调，不使用浑浊纯黑） */
--shadow-xs: 0 1px 2px rgba(20, 20, 32, 0.06);
--shadow-sm: 0 1px 2px rgba(20, 20, 32, 0.06), 0 2px 8px rgba(20, 20, 32, 0.04);
--shadow-md: 0 1px 2px rgba(20, 20, 32, 0.06), 0 4px 16px rgba(20, 20, 32, 0.06);
--shadow-lg: 0 1px 3px rgba(20, 20, 32, 0.07), 0 8px 24px rgba(20, 20, 32, 0.08);
--shadow-xl: 0 2px 4px rgba(20, 20, 32, 0.07), 0 16px 40px rgba(20, 20, 32, 0.1);

/* 悬浮层抬升（双主题通用） */
--elevation-hairline: inset 0 0 0 1px rgba(17, 17, 17, 0.13);
--elevation-card: 0 1px 2px rgba(20, 20, 32, 0.05), 0 2px 8px rgba(20, 20, 32, 0.03);
--elevation-card-hover: 0 10px 26px rgba(0, 0, 0, 0.1), 0 2px 5px rgba(0, 0, 0, 0.05);
--elevation-overlay: 0 24px 60px rgba(0, 0, 0, 0.2), 0 3px 10px rgba(0, 0, 0, 0.09);
--elevation-panel: -1px 0 2px rgba(20, 20, 32, 0.06), -16px 0 48px rgba(20, 20, 32, 0.14);
```

### 深色主题阴影原则
- 在深色模式下，**浮层禁止使用发白光的扩散阴影**（会产生脏光与视疲劳）。
- 深色模式必须结合 `--elevation-hairline`（微弱内描边 `rgba(255,255,255,0.08)`）与表面明度提亮（Surface Step）来表达抬升。

---

## 5. 描边与焦点反馈规范 (Borders & Focus Rings)

### 5.1 描边
- **标准描边宽度**：`1px`（发丝线）。
- **默认边框**：`var(--border)`（浅色 `rgba(17,17,17,0.14)` / 深色 `rgba(255,255,255,0.14)`）。
- **弱化边框**：`var(--border-subtle)`（浅色 `rgba(17,17,17,0.08)` / 深色 `rgba(255,255,255,0.08)`）。
- **交互强化边框**：`var(--control-border)`（浅色 `rgba(17,17,17,0.22)` / 深色 `rgba(255,255,255,0.24)`）。

### 5.2 键盘焦点指示器 (:focus-visible)
- 键盘导航聚焦时，必须呈现清晰的焦点光圈（Focus Ring），不得随意添加 `outline: none` 而不设替代样式。
```css
/* 标准键盘焦点光圈 */
:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px var(--background), 0 0 0 4px var(--ring);
}
```

---

## 6. 无障碍设计底线 (Accessibility Foundations)

1. **色彩对比度 (WCAG 2.2 AA 标准)**：
   - 常规正文文本（< 18px 或未加粗 < 24px）：对背景对比度必须 **≥ 4.5:1**。
   - 大字号文本（≥ 18px 加粗或 ≥ 24px 常规）：对背景对比度必须 **≥ 3.0:1**。
   - 交互式 UI 组件（输入框边框、开关轨道）：对背景对比度必须 **≥ 3.0:1**。
2. **状态表达多重通道**：禁止单纯通过红/绿颜色表达成功或失败，必须同时具备**文本、图标或形状**三种通道之一作为辅助说明。
3. **触控与点击目标尺寸**：
   - 桌面端最小可操作区域：`32×32px`。
   - 移动端与触屏操作区域：推荐 **≥ 44×44px**（密集数据表格行除外）。
