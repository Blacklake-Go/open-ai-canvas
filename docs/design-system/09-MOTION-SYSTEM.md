# 09 — 统一动效与交互反馈规范 (Motion Design System)

> **设计层级**：Layer 1 — Global Motion Foundations  
> **适用范围**：按钮悬停、下拉展开、弹窗进出、抽屉滑动、Toast 浮现、画布节点交互与骨架屏流动。  
> **核心原则**：动效服务于“明确的空间关系”与“直接的交互因果”，禁止使用拖沓漫长、夸张晃动或消耗 GPU 性能的无意义动画。全站必须严格支持系统级减弱动效偏好 (`prefers-reduced-motion`)。

---

## 1. 动效时长与缓动体系 (Motion Tokens)

### 1.1 时长阶梯 (Duration Tokens)
全站动效严格划分在以下 6 档时长区间内：

| 语义时长令牌 | 推荐值 | 适用交互场景 |
| :--- | :--- | :--- |
| `--motion-instant` | `80ms` – `120ms` | 按钮点击微反馈、复选框打勾、图标状态瞬变 |
| `--motion-fast` | `120ms` – `180ms` | 按钮 Hover、背景色过渡、标签高亮移动 |
| `--motion-normal` | `150ms` – `220ms` | 下拉菜单展开、轻量气泡浮层 (Popover) |
| `--motion-medium` | `180ms` – `280ms` | 模态框 (Modal) 入场与退场、卡片扩展 |
| `--motion-slow` | `220ms` – `320ms` | 侧边栏折叠/展开、全屏侧拉抽屉 (Drawer) |
| `--motion-page` | `200ms` – `350ms` | 页面路由切换平滑交叉淡入 |

### 1.2 缓动曲线 (Easing Curves)
全站统一采用三种标准贝塞尔缓动曲线：

```css
/* 进场缓动 (Ease-out)：前快后慢，自然平滑停靠 */
--ease-out: cubic-bezier(0.16, 1, 0.3, 1);

/* 出场缓动 (Ease-in)：前慢后快，果断退出视口 */
--ease-in: cubic-bezier(0.7, 0, 0.84, 0);

/* 双向平滑过渡 (Standard)：用于位置、尺寸或颜色属性变化 */
--ease-standard: cubic-bezier(0.2, 0, 0, 1);
```

---

## 2. 动效实现与性能铁律 (Performance Rules)

### 2.1 仅允许合成层属性动画
为杜绝掉帧与重排（Reflow/Layout），**所有过渡动效原则上仅允许使用以下两个 CSS 属性**：
- `transform` (位移 `translate`、缩放 `scale`、旋转 `rotate`)
- `opacity` (透明度)

**严禁事项**：
- 严禁在展开折叠动画中高频连续修改 `width`、`height`、`padding`、`margin` 或 `top/left`。
- 高度折叠推荐使用 CSS Grid 方案：
  ```css
  .collapsible-container {
      display: grid;
      grid-template-rows: 0fr;
      transition: grid-template-rows var(--motion-normal) var(--ease-standard);
  }
  .collapsible-container.is-expanded {
      grid-template-rows: 1fr;
  }
  ```

---

## 3. 典型交互组件动效规范

1. **按钮点击微动效 (Press Motion)**：
   - 按下瞬间轻微缩放至 `scale(0.98)`，释放时弹性恢复至 `scale(1)`，时长 `100ms`。
2. **下拉菜单与气泡 (Dropdown / Popover)**：
   - 入场：初始 `opacity: 0; transform: translateY(-4px) scale(0.97)`，展开至 `opacity: 1; transform: translateY(0) scale(1)`。
   - 退场：`opacity: 0` 快速淡出，时长 `120ms`。
3. **模态框进出 (Modal Transition)**：
   - 遮罩层：`opacity: 0 → 1`（时长 `180ms`）。
   - 弹窗主体：初始 `scale(0.95); opacity: 0`，平滑缩放进入 `scale(1); opacity: 1`（时长 `240ms`）。
4. **抽屉滑入滑出 (Drawer Transition)**：
   - 采用单一 X 轴位移：`transform: translateX(100%) → transform: translateX(0)`，配合 `var(--ease-out)`。

---

## 4. 减弱动效偏好支持 (`prefers-reduced-motion`)

根据 WCAG 2.2 无障碍标准，患有前庭功能障碍或光敏性反应的用户可能在系统级开启“减少动态效果”。全站必须无条件尊重该偏好：

```css
@media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
        scroll-behavior: auto !important;
    }

    /* 暂停所有自动循环视频与背景动画 */
    video[autoplay] {
        animation: none !important;
    }
}
```

**应用保障**：
- 登录页视频自动暂停播放，展示静态海报。
- 弹窗、抽屉与下拉菜单取消缩放与位移动画，改为瞬间出现或轻微透明度微变。
