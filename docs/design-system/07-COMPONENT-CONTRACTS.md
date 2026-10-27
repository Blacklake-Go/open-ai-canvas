# 07 — 核心基础组件契约规范 (Component Contracts Specification)

> **设计层级**：Layer 4 — Component Implementation  
> **适用范围**：全站所有基础控件与共享组件（位于 `web/src/components/ui/` 及统一封装）。  
> **核心原则**：任何被全站复用的组件必须具备严格的参数类型定义、完整交互状态矩阵、无障碍支持与自动化测试规则，严禁组件内部私自创建任意裸值。

---

## 1. Button 按钮组件契约 (`Button` / `IconButton` / `ToolButton`)

### 1.1 可用变体 (Variants)
1. **Primary (主要命令)**：墨色底白字（浅色）/ 浅灰底深字（深色）或渐变按钮；用于页面唯一主动作（如“开始生成”、“保存配置”）。
2. **Secondary (次要操作)**：次级背景 `var(--secondary)`，用于返回、取消、次要辅助操作。
3. **Outline (描边按钮)**：1px 边框 `var(--btn-outline-border)`，背景透明，用于“重置”、“刷新”。
4. **Ghost (幽灵按钮)**：无边框无背景，仅悬停时显示弱底色；用于顶栏图标按钮、行内轻量工具。
5. **Destructive (破坏性操作)**：红色警告底色或描边，用于“删除项目”、“重置数据”、“注销登录”。
6. **Tool Button (工具切换)**：支持 `aria-pressed="true"`，用于画布工具栏分段激活。
7. **Loading Button (异步加载)**：内置微型旋转加载器，**加载期间严格锁死物理尺寸，禁止宽度抖动**。

### 1.2 尺寸等级 (Size Scales)
| 尺寸 | 高度 | 水平内边距 | 字号 | 图标尺寸 | 默认圆角 | 适用场景 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **XS** | `28px` | `8px` | `12px` | `12px` | `6px` | 密集表格行内操作、标签内小按钮 |
| **SM** | `32px` | `12px` | `13px` | `14px` | `6px` | 管理后台常规操作、紧凑工具栏 |
| **MD (默认)** | `36px` | `16px` | `14px` | `16px` | `8px` | 绝大多数常规表单、工作台操作 |
| **LG** | `40px` | `20px` | `14px` | `16px` | `8px` | 认证表单提交、弹窗主操作栏 |
| **XL** | `44px` | `24px` | `16px` | `18px` | `8px` | 移动端大触控区、核心营销入口 |

### 1.3 状态矩阵与行为硬性契约
- **Loading 状态**：
  - 点击后立即进入 `disabled` 状态，拦截二次点击（防重复提交）。
  - 图标替换为旋转 Spinner，文字保持可见或通过渐隐占位保留原始宽度，**禁止因为文字改变导致按钮突然缩短或变长**。
- **Disabled 状态**：
  - 必须同时具备 `disabled` 属性与 `aria-disabled="true"`。
  - 彻底禁用鼠标指针事件 (`pointer-events: none` 或原生禁用)，禁止仅涂上一层灰颜色但依然可以被点击触发事件。
- **键盘支持**：获得焦点后支持 `Enter` 与 `Space`（空格键）触发点击。

---

## 2. Select / Dropdown 下拉组件契约

下拉组件是全站交互最复杂、最容易发生遮挡的组件，必须满足以下契约：

### 2.1 触发器外观与对齐
1. **高度一致性**：触发器高度与同尺寸 Input 保持绝对一致（默认 `36px`）。
2. **文本对齐**：触发器内部文字基线与前导图标必须与输入框左侧精确对齐（水平内边距 `12px`）。
3. **右侧指示器**：统一使用 `ChevronDown`（尺寸 `14px`），展开时平滑旋转 180 度。

### 2.2 弹出面板与定位契约 (Popup Overlay)
1. **Portal 传送**：弹出面板必须通过 `createPortal` 挂载至 `document.body`，**严禁被父容器 `overflow: hidden` 截断**。
2. **边缘自适应**：当视口下方空间不足时，必须自动向上翻转展开（Flip）。
3. **最大高度与滚动**：面板最大高度限制为 `256px`，超出部分纵向平滑滚动，保留细滚动条。
4. **层级保障（重点解决）**：
   - 当 Select 置于 Ant Design Modal（Z-Index 1000）内部时，下拉浮层必须分配 `--z-dialog-popover` (1100)，**坚决杜绝弹窗遮挡下拉菜单的问题**。

### 2.3 键盘与无障碍契约
- `ArrowDown` / `ArrowUp`：上下移动高亮选项。
- `Enter` / `Space`：确认选中高亮项并关闭面板。
- `Escape`：取消选择并关闭面板，**焦点平滑恢复至触发按钮**。
- `Tab`：关闭下拉面板，焦点移动至下一个表单元素。

---

## 3. Input / Form 表单组件契约

### 3.1 基础表单输入框 (Text / Password / Textarea / Number)
1. **基础外观**：
   - 默认高度：`36px`（单行输入），多行文本域最小高度 `72px`。
   - 边框：`1px solid var(--control-border)`，圆角 `var(--r-md)` (8px)。
   - 背景色：`var(--control-surface)`（浅色纯白 / 深色弱透黑）。
2. **交互状态**：
   - **Hover**：边框颜色微调加深至 `var(--border-strong)`。
   - **Focus**：边框色变为 `var(--primary)`，外加光圈 `0 0 0 2px var(--ring)`。
   - **Error 校验失败**：
     - 边框与光圈变为 `var(--palette-status-error)`。
     - 下方即时渲染红色错误文字提示，**错误文本容器必须预留最小行高或使用平滑展开动画，禁止错误出现时造成页面整体剧烈跳动**。
   - **Disabled**：底色变为 `var(--control-disabled-bg)`，文字变为 `var(--control-disabled-fg)`。

### 3.2 密码输入框 (Password Input)
- 右侧常驻显示眼睛图标切换按钮（`Eye` / `EyeOff`）。
- 切换按钮必须具有明确的 `aria-label="显示密码"` / `aria-label="隐藏密码"`，且点击不会导致表单提早提交。

---

## 4. Checkbox / Switch / Segmented 控件契约

### 4.1 Switch 开关
- 角色定义为“即时生效的状态切换”。
- 必须具备 `role="switch"` 与 `aria-checked="true|false"`。
- **开启状态**：必须使用成功绿 `var(--control-switch-checked-bg)` (#16a34a) 与纯白滑块。
- **关闭状态**：必须使用中性灰底色，深浅模式下都不能仅靠滑块位置表达状态。

### 4.2 Checkbox 复选框
- 采用 16×16px 正方形，圆角 `4px` (`--r-xs`)。
- 支持三态：`unchecked`、`checked`、`indeterminate`（半选态，常用于表格全选）。

### 4.3 SegmentedControl 分段切换器
- 容器采用 `bg-surface-subtle` 底色，滑块（Thumb）支持平滑滑动位移。
- 选项激活状态必须绑定 `aria-pressed="true"`，键盘支持左右方向键流畅切换。
