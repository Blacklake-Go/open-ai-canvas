# 影策插件与主题接入契约规范 (PLUGIN-THEME-CONTRACT.md)

> **版本**：2.0.0  
> **适用范围**：SupDance / 影策二次开发、第三方插件开发、定制外观皮肤制作及长期上游更新维护。  
> **核心原则**：样式作用域绝对隔离、契约化 Token 继承、防上游代码覆盖机制。

---

## 1. 架构定位与职责划分

在影策设计系统中：
- **主题 (Themes)** 负责“视觉外观与感知”：定义 CSS Variables、色板映射与组件度量参数，不侵入业务逻辑。
- **插件 (Plugins)** 负责“业务功能与交互扩展”：通过标准插槽 (Slots)、受控路由与公共 API 接入，消费共享设计系统。

```text
┌────────────────────────────────────────────────────────────────────────┐
│  Host Application (影策宿主核心)                                        │
│  提供公共 Design Tokens (--ui-*) · 共享组件库 · 扩展插槽与路由挂载点    │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ 契约分发
        ┌──────────────────────────┴──────────────────────────┐
        ▼                                                     ▼
┌──────────────────────────────┐              ┌──────────────────────────────┐
│  Theme Packs (主题皮肤包)    │              │  Plugin Modules (插件模块)   │
│  - 纯 CSS Variables 注入     │              │  - 继承 --ui-* 语义变量      │
│  - 不注入任何未受管的 JS 脚本 │              │  - 样式限制在 .plugin-* 作用域│
│  - 统一经由 Appearance 持久化│              │  - 弹层挂载至公共 Portal 根  │
└──────────────────────────────┘              └──────────────────────────────┘
```

---

## 2. 插件接入契约 (Plugin Interface Contract)

### 2.1 共享组件与变量消费规范
插件必须且仅能通过 `@/components/ui/` 引用经过合规包装的基础组件（Button, Input, Select, Switch, AppModal, AppDrawer）。
- **[严禁]** 插件自行打包第二套庞大的 Ant Design 运行时或独立注入全量 Tailwind Base 重置样式。
- **[强制]** 插件内部样式必须优先消费宿主语义变量（`var(--ui-bg-surface)`、`var(--ui-text-primary)`、`var(--ui-border-control)` 等）。

### 2.2 样式作用域与命名空间隔离 (Scope Isolation)
为杜绝插件 CSS 污染宿主或破坏画布工作区：
1. **命名空间前缀**：所有插件自定义类名必须带有命名空间前缀，如 `.plugin-[pluginId]-*`（例如音乐插件 `.plugin-music-*`）。
2. **样式隔离包裹层**：插件根视图必须包裹在带标识的容器中：
   ```tsx
   export function SamplePluginView() {
     return (
       <div className="plugin-scope-sample-widget p-4 rounded-xl bg-[var(--ui-bg-surface)] text-[var(--ui-text-primary)] border border-[var(--ui-border-subtle)]">
         {/* 插件内部内容 */}
       </div>
     );
   }
   ```
3. **弹窗与浮层挂载**：插件内部若需弹出 Dropdown、Tooltip 或 Modal，必须使用宿主提供的 `AppModal` 或向 `<ConfigProvider>` 声明 `getPopupContainer`，确保弹层正确继承宿主主题变量并应用正确的 `z-index`。

### 2.3 插件扩展插槽 (Extension Slots)
影策核心预留以下标准插槽：
- `workspace.sidebar.nav`: 侧边栏导航扩展条目。
- `workspace.topbar.action`: 顶栏右侧快捷功能入口。
- `studio.creator.tab`: 创作 Studio 模式选项卡（如新增“生音乐”）。
- `canvas.toolbar.tool`: 画布浮动工具栏自定义节点生成工具。
- `admin.settings.menu`: 管理后台独立配置菜单。

---

## 3. 主题系统契约 (Theme System Contract)

### 3.1 允许覆盖的变量范围
主题包以声明式 JSON 或 CSS Variables 形式存在，严禁包含任意 JavaScript 注入。允许覆盖的变量矩阵如下：

| 变量分组 | 典型变量名 | 覆盖影响与约束 |
| :--- | :--- | :--- |
| **基础表面色** | `--ui-bg-canvas`, `--ui-bg-surface`, `--ui-bg-overlay` | 必须维持文本与表面的对比度 $\ge 4.5:1$ |
| **品牌行动点** | `--ui-primary`, `--ui-primary-hover`, `--ui-primary-foreground` | 必须同时提供前景与背景成对色值 |
| **边框与阴影** | `--ui-border-subtle`, `--elevation-card`, `--elevation-overlay` | 必须提供贴合浅色与深色的成对效果 |
| **组件度量** | `--control-radius`, `--control-height`, `--font-weight-button` | 控件高度限制在 $28\text{px} \sim 48\text{px}$ 之间 |

### 3.2 覆盖优先级链 (Cascade Order)
样式最终解析遵循以下严格链条，低层级绝不可越权覆盖高层级：
$$\text{浏览器默认} \to \text{设计系统基石 (Primitive)} \to \text{站点默认皮肤} \to \text{后台外观设置 (/admin)} \to \text{用户个人偏好 (明/暗)}$$

---

## 4. 防上游代码覆盖机制 (Upstream Upgrade Defense)

### 4.1 核心挑战与物理边界
影策是快速迭代的开源/二开项目。当上游官方仓库更新时，直接合并可能导致以下风险：
1. 覆盖定制页面逻辑与本地插件代码。
2. 冲掉自定义主题变量与 CSS 修改。
3. 产生难以排查的冲突。

### 4.2 三层防线架构
为了让上游代码能够平滑同步且绝不覆盖二开资产，必须执行以下物理防线：

```text
[ 防线 1: 物理目录隔离 ]
  - 核心定制代码全部集中于独立的目录命名空间:
    • web/src/supdance/plugins/ (二开插件)
    • web/src/themes/ (自定义主题包)
    • backend/internal/supdance/ (二开后端扩展)
  - 宿主原生目录 (web/src/pages/, backend/internal/app/) 仅保留必要接入点 (Wiring Hook)。

[ 防线 2: 声明式注册与动态挂载 ]
  - 路由与插槽不直接硬编码在主页面 JSX 中，通过动态注册表载入:
    • 例如: `web/src/router.tsx` 中的 `SupDanceRouteHosts` 桥接层。
    • 插件卸载或未启用时自动优雅回退，主干代码无侵入。

[ 防线 3: 最小补丁清单与 Git 分支策略 ]
  - 维护独立的 `upstream` 远端: `git remote add upstream https://github.com/ddcat-ai/open-ai-canvas.git`
  - 升级时严格执行:
    1. 在隔离分支 `git fetch upstream && git checkout -b chore/upstream-merge`
    2. 执行 `git merge upstream/main`
    3. 核对最小侵入点清单（如 `router.tsx`、`globals.css` 变量声明），若产生冲突，按契约保留插槽引用，不接受覆盖定制逻辑。
```

---

## 5. 最小可运行示例 (Minimal Working Examples)

### 5.1 最小插件界面示例 (Minimal Plugin Widget)
```tsx
import React, { useState } from "react";
import { Button } from "@/components/ui/base/buttons";
import { Select } from "@/components/ui/base/select";

export interface SamplePluginProps {
  title?: string;
  onExecute?: (mode: string) => void;
}

export function SamplePluginWidget({ title = "音效生演插件", onExecute }: SamplePluginProps) {
  const [mode, setMode] = useState("cinematic");
  const [loading, setLoading] = useState(false);

  const handleRun = async () => {
    setLoading(true);
    try {
      await onExecute?.(mode);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="plugin-music-card p-4 rounded-xl bg-[var(--ui-bg-surface)] border border-[var(--ui-border-subtle)] shadow-[var(--elevation-card)] flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h4 className="text-[14px] font-semibold text-[var(--ui-text-primary)]">{title}</h4>
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--ui-bg-surface-raised)] text-[var(--ui-text-muted)]">v1.0</span>
      </div>
      <p className="text-[12px] text-[var(--ui-text-muted)]">
        消费宿主语义设计令牌，完全融入当前明暗主题环境。
      </p>
      <div className="flex items-center gap-2">
        <Select
          size="sm"
          appearance="pill"
          value={mode}
          onChange={(val) => setMode(val as string)}
          options={[
            { value: "cinematic", label: "电影级配乐" },
            { value: "ambient", label: "环境声学" },
            { value: "electronic", label: "赛博电子" },
          ]}
          className="w-36"
        />
        <Button
          variant="solid"
          size="sm"
          loading={loading}
          onClick={handleRun}
          className="flex-1"
        >
          立即生成
        </Button>
      </div>
    </div>
  );
}
```

### 5.2 最小自定义主题包示例 (Custom Theme Pack)
```css
/* web/src/themes/aurora-cyber/theme.css */
[data-skin="aurora-cyber"] {
  /* 品牌色覆写 */
  --ui-primary: #6366f1;
  --ui-primary-hover: #4f46e5;
  --ui-primary-active: #4338ca;
  --ui-primary-foreground: #ffffff;

  /* 卡片与控件微调 */
  --control-radius: 10px;
  --ui-border-focus: #6366f1;
}

[data-skin="aurora-cyber"].dark {
  --ui-bg-canvas: #0b0c10;
  --ui-bg-surface: #13141c;
  --ui-bg-surface-subtle: #1c1d29;
  --ui-bg-overlay: #181a24;
  --ui-primary: #818cf8;
  --ui-primary-foreground: #0b0c10;
}
```
通过上述结构，新增插件只需关注核心功能，外观与系统风格无缝一致，且即使上游大版本合并，插件目录与主题文件亦保持完好无损。
