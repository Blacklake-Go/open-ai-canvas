# 11 — 后台外观配置最高优先级与作用域隔离规范 (Theme & Appearance Runtime)

> **设计层级**：Layer 2 — Theme & Appearance Runtime  
> **权威原则**：管理后台（`/admin/settings/appearance`）已保存并启用的外观设置在其管辖范围内享有**全站最高配置优先级**。不得允许组件默认值、插件样式或浏览器陈旧缓存覆盖后台正式生效配置。

---

## 1. 四级配置优先级判定法 (Priority Hierarchy)

在同一受控主题作用域内，样式解析严格按以下优先级执行：

```text
Level 1: 当前会话已确认生效的后台正式外观配置 (SystemSetting.appearance) [最高优先级]
   ↓ 缺失或未配置
Level 2: 兼容的正式皮肤库配置 (skinThemes 中选中的 activeSkin)
   ↓ 缺失
Level 3: 项目 Design Tokens 默认主题 (DEFAULT_CLASSIC_SKIN / globals.css 基准)
   ↓ 缺失
Level 4: 组件内部安全回退硬编码值 (Safe Fallback) [最低优先级]
```

### 关键约束
1. **草稿隔离**：管理员在 `/admin/settings/appearance` 页面中的临时修改与输入属于**独立未保存草稿态**，绝不允许直接污染正在运行中的线上站点。仅在明确点击“保存修改”并成功通过接口校验后，方可向全站分发。
2. **无障碍底线不可逾越**：后台配置的优先级不得以牺牲基础可访问性为代价。若自定义皮肤中设置了文字与背景对比度严重不达标（如白底黄字），系统应在后台编辑器中拦截或触发自动对比度修正。
3. **系统偏好响应**：只有当主题模式设为 `auto`（跟随系统）时，浏览器的 `prefers-color-scheme` 才参与暗黑/浅色模式切换。

---

## 2. 命名空间与作用域物理隔离 (Scope Isolation)

为防止前后台或画布样式“牵一发而动全身”，全站划分以下 6 大样式作用域：

| 作用域名 (Scope) | 样式标记 / 容器 | 约束规则 |
| :--- | :--- | :--- |
| **`global`** | `:root` | 仅管理 Primitive 无语义纯值与全局 Z-Index 阶梯 |
| **`public`** | `.auth-scene` / `.public-portal` | 前台营销与认证界面，完全由后台品牌媒体与文案驱动 |
| **`admin`** | `[data-admin-root]` / `.admin-shell` | 管理后台独享，使用 `--admin-*` 变量，**严禁读取前台皮肤** |
| **`studio`** | `.creation-workspace` | 创作岛独享，承载任务状态机与多模态结果流 |
| **`canvas`** | `.canvas-workspace` / `.canvas-viewport`| 画布独享，隔离缩放矩阵与世界坐标，样式不溢出 |
| **`plugin`** | `[data-plugin-scope]` | 扩展插件沙箱，必须通过适配层继承宿主，严禁修改外部 DOM |

**防火墙规则**：
- 前台改动一个按钮的悬停圆角，绝不允许影响管理后台表格操作按钮。
- 后台开启紧凑密度，绝不允许影响前台创作岛的舒适间距。

---

## 3. 外观设置实时同步与全站分发机制

```text
┌────────────────────────────────────────────────────────┐
│  管理员在 /admin/settings/appearance 点击保存          │
└───────────────────────────┬────────────────────────────┘
                            │ PUT /api/admin/settings/appearance
┌───────────────────────────▼────────────────────────────┐
│  后端校验、持久化至 system_settings 并分发公开配置     │
└───────────────────────────┬────────────────────────────┘
                            │ commitPublicAppearance(updated.public)
┌───────────────────────────▼────────────────────────────┐
│  前端 useAppearanceStore 即时接收最新配置              │
├────────────────────────────────────────────────────────┤
│  1. applySkinTheme() → 批量更新 :root CSS Variables    │
│  2. applyAppearanceMetadata() → 更新 title/favicon/meta│
│  3. getAntThemeConfig() → 驱动 Ant Design ConfigProvider│
└────────────────────────────────────────────────────────┘
```

### 3.1 首屏防闪烁 (FOUC Prevention)
- 在 `web/src/main.tsx` 中，应用渲染挂载前先执行 `bootstrapAppearance()` 解析服务端最新外观，将品牌 Logo、背景色与字体在首屏渲染完成，防止出现由默认品牌突然跳变为自定义品牌的视觉闪烁。
- 若网络超时（> 4000ms），安全降级至内置默认配置，绝不导致页面白屏。

### 3.2 严禁反模式
- **严禁滥用 `!important`**：严禁用大面积 `!important` 粗暴解决主题优先级冲突，必须回到唯一 CSS 变量源或 Ant Design Token 进行修改。
- **严禁使用陈旧 localStorage 永久锁死**：主题更新必须以服务端返回的版本号/修订号 (`revision`) 为准，避免管理员修改外观后旧访客长期无法更新。
