# 12 — 插件 UI 强制兼容契约 (Plugin UI Mandatory Contract)

> **设计层级**：Layer 3 — Application Design System (Plugin Scope)  
> **适用范围**：所有内置插件（如 `supdance-i18n`、`social-auth`）、第三方扩展插件及通过 `.yingce-plugin` 机制加载的模块。  
> **核心原则**：插件是平台的受控客人，不是统治者。插件界面必须严格遵守 Design System 约束，严禁私自污染全局 DOM 与 CSS。

---

## 1. 插件 UI 十二条铁律 (The 12 Rules)

1. **禁止污染全局标签选择器**：插件样式表严禁裸写 `div { ... }`、`button { ... }`、`p { ... }`、`a { ... }`，必须全部被限定在插件自身的作用域选择器下。
2. **禁止修改根节点样式**：插件严禁通过脚本动态修改 `html` 或 `body` 的 `class`、内联样式或全局字体。
3. **必须消费宿主 Token**：按钮、文字、背景必须使用宿主当前生效的语义变量（如 `var(--primary)`、`var(--surface)`、`var(--border)`）。
4. **必须无条件继承主题**：当用户或系统切换暗黑/浅色模式或管理员更换皮肤时，插件界面必须自动同步响应，禁止写死固定背景色。
5. **禁止反向覆盖后台外观设置**：插件绝不允许使用 `!important` 覆盖宿主后台设置的品牌名称、Logo、圆角或主题色。
6. **布局独立作用域**：插件私有界面必须包裹在带独立命名空间的根容器内（如 `[data-plugin-scope="your-plugin-id"]`）。
7. **浮层接入宿主管理**：插件弹出的确认框、侧边抽屉或气泡，必须接入宿主统一的 `AppModal`、`AppDrawer` 或正确声明 `--z-popover` / `--z-dialog-popover`，禁止自造 `z-index: 999999`。
8. **多语言适配支持**：插件界面文案严禁硬编码中文，必须接入 `supdance-i18n` 字典或提供多语言对照包。
9. **具备基础响应式能力**：插件弹窗与面板在移动端（< 640px）必须自适应为全宽或抽屉，禁止出现横向视口截断。
10. **提供完整交互状态**：插件按钮必须提供 Hover、Active、Focus-visible、Disabled 和 Loading 状态。
11. **禁止引入不受信字体**：禁止外部网络加载体积庞大或未授权的第三方 Web 字体。
12. **保护宿主事件链条**：插件挂载到顶栏或画布时，必须正确处理点击阻止冒泡，严禁破坏宿主导航与画布拖拽功能。

---

## 2. 第三方插件无侵入适配层架构 (Plugin Adapter Pattern)

针对源码不可直接改动的第三方插件，采用**三层适配器封装模型**：

```text
┌────────────────────────────────────────────────────────┐
│  Component Wrapper (React 隔离外壳)                    │
│  · 注入 [data-plugin-scope="vendor-name"]              │
│  · 拦截事件穿透与全屏模式                              │
├────────────────────────────────────────────────────────┤
│  Design Token Adapter (运行时变量映射器)                │
│  · 将宿主 var(--primary) 桥接至第三方私有变量          │
│    例：--vendor-btn-color: var(--primary);             │
├────────────────────────────────────────────────────────┤
│  Scoped Styles (局部覆盖补丁)                          │
│  · 消除第三方私有圆角、异常阴影与破坏性层级            │
└────────────────────────────────────────────────────────┘
```

**示例代码**：
```tsx
import { ReactNode } from "react";
import "@/supdance/plugins/vendor-adapter.css";

export function VendorPluginAdapter({ pluginId, children }: { pluginId: string; children: ReactNode }) {
    return (
        <div className="plugin-scoped-host" data-plugin-scope={pluginId}>
            {children}
        </div>
    );
}
```

```css
/* vendor-adapter.css 隔离映射 */
[data-plugin-scope="vendor-name"] {
    --thirdparty-primary: var(--primary);
    --thirdparty-bg: var(--surface);
    --thirdparty-text: var(--foreground);
    --thirdparty-radius: var(--control-radius);
}
```
