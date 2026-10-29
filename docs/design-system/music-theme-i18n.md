# SupDance AI Music Generation Theme Adaptation, Scoped CSS, A11y & i18n Specification (DOC-7)

本规范定义了 SupDance 专属 AI 音乐生成插件（`supdance-music-generation`）在全站设计系统（Design System RULE 001–016）指导下的主题自适应、样式沙箱隔离（Scoped CSS）、无障碍标准（WCAG 2.2 AA）与 6 语系国际化（i18n）实施细则。

---

## 1. 样式沙箱隔离与作用域限定 (Scoped CSS Isolation)

为杜绝任何形式的全局 CSS 污染，插件所有前端样式严格封装在 `.plugin-music-generation` 类选择器之下：

```css
/* web/src/supdance/plugins/music-generation/styles/music-generation.css */
.plugin-music-generation {
  --music-primary: var(--primary);
  --music-card-bg: var(--card);
  --music-waveform-bar: var(--primary);
  /* 严格使用宿主三层 Token 变量，禁止硬编码颜色值 */
}

/* 所有的子选择器均被约束在插件根容器之内 */
.plugin-music-generation .music-lyrics-editor { ... }
.plugin-music-generation .music-waveform-container { ... }
.plugin-music-generation .music-model-card { ... }
```

### 严格禁令：
- **禁止污染全局标签**：禁止在样式文件中直接对 `body`, `html`, `button`, `input` 等基础标签赋予无前缀的全局样式。
- **禁止污染 `:root`**：不得在插件内部直接改写 `:root` 或覆盖全站全局 CSS 变量。

---

## 2. 全主题自适应与后台外观配置最高优先级 (Theme & Appearance Priority)

遵循全站规范 **RULE 004 — Backend Appearance Priority**：
1. **三种模式自动同步**：无论是明亮模式（Light Mode）、暗黑模式（Dark Mode）还是随系统切换（System Mode），插件完全继承宿主当前渲染主题。
2. **后台外观优先级**：当管理员在 `/admin/settings/appearance` 调整了全站主题色、圆角（`--radius`）或背景色调时，音乐创作岛即刻动态响应，无需刷新页面，保持视觉风格的无缝一致性。

---

## 3. 响应式布局与无障碍访问 (Responsive & A11y Standards)

遵循全站规范 **RULE 007 — Responsive Required** 与 **RULE 011 — Accessibility**：

### 3.1 跨端断点响应 (360px – 1440px)
- **移动端与平板 (< 1024px)**：左右分栏自动折叠为单列流式布局，表单创作区位于上方，历史作品列表置于下方。
- **桌面端 ($\ge 1024px$)**：左 7 列表单与右 5 列作品列表双栏并排，右栏支持内容滚动自适应。

### 3.2 触控热区与色彩对比度
- **触控目标尺寸**：播放/暂停按钮、波形调节把手、下载按钮等关键触控区域均保证 $\ge 44 \times 44 \text{ px}$。
- **色彩对比度**：正文文字与背景对比度 $\ge 4.5:1$（符合 WCAG 2.2 AA 标准）。
- **动效抑制偏好**：完整支持 `prefers-reduced-motion: reduce`，当用户开启减弱动效偏好时，状态机脉冲动画与波形平滑过渡自动切换为瞬时状态更新。

---

## 4. 完整 6 语系国际化支持 (6-Locale i18n Dictionary)

遵循全站规范 **RULE 010 — Internationalization**，界面中杜绝任何写死的中文硬编码，全部接入 `supdance-i18n` 字典引擎。

### 4.1 命名空间与语系分布
所有音乐生成专有词条统一归集于 `music.*` 命名空间，完整提供以下 6 大主流语系的高质量地道翻译：
1. `zh-CN`：简体中文
2. `en-US`：英语 (English)
3. `zh-TW`：繁体中文 (繁體中文)
4. `ja-JP`：日文 (日本語)
5. `ko-KR`：韩文 (한국어)
6. `es-ES`：西班牙语 (Español)

### 4.2 词条举例
```typescript
e("music.nav_music_gen", "music", "音乐生成", "AI Music", "音樂生成", "音楽生成", "음악 생성", "Generación de música", "导航项"),
e("music.studio_title", "music", "AI 音乐创作岛 (Music Studio)", "AI Music Studio", "AI 音樂創作島 (Music Studio)", "AI 音楽スタジオ", "AI 음악 스튜디오", "Estudio de Música AI", "创作岛标题"),
e("music.download_flac", "music", "下载 FLAC", "Download FLAC", "下載 FLAC", "FLAC ダウンロード", "FLAC 다운로드", "Descargar FLAC", "无损下载")
```

前端界面组件通过 `useI18n()` 响应式获取当前语言译文，在用户切换语言时即时完成热重载。
