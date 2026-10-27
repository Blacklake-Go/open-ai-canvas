# 08 — 浮层遮罩与 Z-Index 层级管理系统规范 (Overlay & Z-Index Management)

> **设计层级**：Layer 1 & Layer 4 — Global Stacking Architecture  
> **适用范围**：Modal、Dialog、Drawer、Popover、Tooltip、Toast、Context Menu、Loading Overlay。  
> **核心原则**：严禁任意书写 `z-index: 99999` 或随机大数值。全站必须严格遵从声明式层级树，防止浮层穿透、嵌套遮挡与层叠上下文 (Stacking Context) 陷阱。

---

## 1. 全站 Z-Index 层级总览表

全站严格划分为 14 个语义层级，任何新增浮层必须在此区间内认领对应令牌：

```css
:root {
    --z-canvas: 0;              /* L0  画布最底空间 */
    --z-canvas-overlay: 5;      /* L1  画布网格、导轨、连线 */
    --z-node: 10;               /* L2  默认未激活节点 */
    --z-node-active: 20;        /* L3  当前拖拽/选中激活节点 */
    --z-toolbar: 30;            /* L4  顶部导航、浮动 Dock、视口控制器 */
    --z-node-toolbar: 50;       /* L5  节点上方随行快捷条 */
    --z-panel: 60;              /* L6  侧边面板、折叠托盘 */
    --z-panel-floating: 80;     /* L7  悬浮助手面板、实时状态监控 */
    --z-modal: 100;             /* L8  轻量级无遮罩对话框 */
    --z-modal-overlay: 110;     /* L9  轻量对话框遮罩 */
    --z-popover: 300;           /* L10 常规下拉选框、右键上下文菜单 */
    --z-drawer: 400;            /* L11 全局侧拉抽屉 (Drawer) */
    --z-toast: 500;             /* L12 全局操作通知 (Message/Toast) */
    --z-antd-modal: 1000;       /* L13 Ant Design 标准弹窗基底 */
    --z-dialog-popover: 1100;   /* L14 【核心】弹窗内嵌下拉、选择器浮层 */
    --z-tooltip: 1150;          /* L15 悬停提示文字 (必须压过弹窗与内嵌下拉) */
    --z-loader: 1200;           /* L16 全屏阻塞式加载指示器 */
    --z-max: 2000;              /* L17 最高紧急阻断通知 (如断网/强制登出) */
}
```

---

## 2. 遮罩层规范 (Backdrop & Scrim)

### 2.1 颜色与透明度
- **浅色模式**：`rgba(0, 0, 0, 0.45)`。
- **深色模式**：`rgba(0, 0, 0, 0.65)`。
- **毛玻璃滤镜约束 (Backdrop Blur)**：
  - 允许在工作台模态框中添加 `backdrop-filter: blur(4px)`。
  - **严禁过度模糊**：禁止在全局或低端设备上使用 `blur(16px)` 或更高模糊，防止低端显卡发生严重掉帧与发热。

### 2.2 页面滚动穿透锁定 (Scroll Lock)
- 当模态框或全屏抽屉打开时，必须在 `document.body` 上设置 `overflow: hidden`。
- **防止页面抖动 (Scrollbar Compensation)**：检测滚动条宽度，并在 `document.body` 自动补偿相应 `padding-right`，防止滚动条隐藏时整个页面内容突然向右平移跳动。
- 关闭浮层时，必须精准还原用户的原始滚动位置。

---

## 3. 模态框与对话框规范 (`Modal` / `Dialog`)

### 3.1 尺寸规范
- **紧凑型 (Confirm / Alert)**：宽度固定为 `440px`。
- **标准型 (Standard Form)**：宽度 `560px` 或 `640px`。
- **宽幅型 (Complex Workspace)**：宽度 `800px` 或 `960px`。
- **全屏响应式**：视口小于 `640px` 时，弹窗自动转为底部弹出的半屏抽屉（Action Sheet）或 `100%` 全屏展示。

### 3.2 结构与可滚动区 (Scrollable Container)
- 弹窗外壳必须分为三个独立结构：
  1. **标题区 (Header)**：固定在顶部，高度 `56px`，右侧带关闭按钮 (`X`)。
  2. **正文区 (Body)**：可滚动内容区，最大高度为 `calc(100vh - 160px)`，溢出时出现内滚动条。
  3. **操作区 (Footer)**：固定在底部，主要与次要操作右对齐，上边框为 `1px solid var(--border)`。

### 3.3 焦点陷阱与键盘导航 (Focus Trap)
- 弹窗必须具有 `role="dialog"` 与 `aria-modal="true"`。
- 打开时，焦点自动聚焦到弹窗内的第一个可交互元素（或取消按钮）。
- 在弹窗内部按 `Tab` 键切换时，焦点必须在弹窗内部首尾循环，**严禁焦点跳到弹窗下方的背景页面**。
- 按 `Escape` 键必须安全退出弹窗，并有确认防护机制（若表单有脏数据）。
- 弹窗关闭后，**焦点必须精准恢复至之前点击打开弹窗的触发按钮**。

---

## 4. 抽屉规范 (`AppDrawer` / `AdminDrawer`)

1. **滑出位置与方向**：绝大多数采用右侧滑出（Right Drawer），移动端导航可采用左侧滑出。
2. **动效时长**：展开与收拢过渡时长统一为 `260ms`，缓动曲线为 `cubic-bezier(0.16, 1, 0.3, 1)`。
3. **尺寸梯次**：
   - 窄抽屉（信息详情）：`360px`。
   - 标准抽屉（编辑表单）：`480px`。
   - 宽抽屉（代码/复杂配置）：`640px`。

---

## 5. 常见层叠上下文陷阱与规避指南 (Stacking Context Traps)

在开发中，经常遇到“明明设置了很大的 z-index，但组件依然被挡住”的现象，通常是由 CSS 层叠上下文引发的，必须按以下规则规避：

1. **Transform 陷阱**：
   - 任何父容器如果应用了 `transform`（例如画布的平移缩放 `scale/translate`）、`filter` 或 `perspective`，都会强行创建一个新的本地层叠上下文。
   - **规避方案**：画布内部节点的浮动弹窗、下拉菜单和 Tooltip，**必须通过 React Portal 挂载到 `document.body`**，严禁挂在画布内部节点 DOM 下。
2. **多层嵌套弹窗 (Nested Overlays)**：
   - 当在第一个 Modal A 内部点击再次弹出确认框 Modal B 时，Modal B 的 Z-Index 必须动态计算为 `Base + 20`，遮罩层计算为 `Base + 10`，保证 B 完整覆盖 A。
3. **Select 被 Modal 截断**：
   - 在 Modal 内部放置 Select 时，Ant Design 的 `getPopupContainer` 或 React Aria 的 Overlay 必须指定为 `document.body`，且其浮层 Z-Index 必须为 `--z-dialog-popover` (1100)。
