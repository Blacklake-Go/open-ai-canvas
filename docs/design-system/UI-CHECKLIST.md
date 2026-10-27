# UI-CHECKLIST — AI 编程与前端工程师上线前强制自检清单

> **执行原则**：任何涉及前端 UI 修改、新增页面或插件开发的 PR / Commit，在交付前必须逐项核对本清单。

---

## 1. 规范与令牌自检 (Design System & Tokens)

- [ ] **RULE 001 (Design System First)**：已先查阅 `docs/design-system/` 对应专题文档，未自行发明第二套样式规范。
- [ ] **RULE 002 (Token First)**：
  - [ ] 颜色：100% 使用语义变量（如 `var(--primary)`、`var(--surface)`、`var(--border)`），无硬编码 Hex（`#17171a` 等）。
  - [ ] 字号：使用 6 档标准字号（11/12/13/14/16/22px），无裸写 `text-[13px]`。
  - [ ] 间距：基于 4px 栅格（0/2/4/8/12/16/20/24/32px），无 `7px`、`19px` 等奇数裸值。
  - [ ] 圆角：收敛于 4 档（4/8/12/16px），无随意 `rounded-[9px]`。
  - [ ] 层级：Z-Index 取自标准阶梯（0–2000），绝无 `z-[99999]` 或未授权裸数值。
- [ ] **RULE 003 (Component Reuse)**：已优先复用 `@/components/ui/`（Celadon）共享组件，未重复封装功能相同的冗余组件。

---

## 2. 架构与作用域自检 (Architecture & Scoping)

- [ ] **RULE 004 (Backend Appearance Priority)**：未硬编码组件默认样式覆盖后台 `/admin/settings/appearance` 保存的正式配置。
- [ ] **RULE 005 (Scope Isolation)**：
  - 前台（Public）、后台（Admin）、生成岛（Studio）、画布（Canvas）和插件（Plugin）样式各自限定在对应命名空间，无跨域污染。
  - 管理后台严格使用 `--admin-*` 变量，未读取前台创作者皮肤。
- [ ] **RULE 012 (Upstream Compatibility)**：
  - 自定义逻辑位于 `web/src/supdance/` 独立目录。
  - 若修改了上游核心文件，已在 `docs/supdance/CUSTOMIZATIONS.md` 与 `compatibility.ts` 登记。

---

## 3. 交互与多端自检 (Interaction & Responsiveness)

- [ ] **RULE 006 (No Visual Regression)**：已在亮暗两种主题下核对相关页面与相邻浮层，无视觉退化。
- [ ] **RULE 007 (Responsive Required)**：
  - [ ] 桌面端（≥ 1024px）：布局完整，无横向意外滚动。
  - [ ] 移动端（< 640px）：触控目标保持 ≥ 44×44px，输入框不被软键盘遮挡。
- [ ] **RULE 008 (Complete Interaction States)**：交互组件具备完整的 Default、Hover、Active、Focus-visible、Disabled 和 Loading 状态。
- [ ] **RULE 009 (Motion Consistency)**：
  - 动效时长在 80ms–320ms 区间内，缓动曲线标准。
  - 已测试系统开启 `prefers-reduced-motion` 时，动效被安全降级或关闭。

---

## 4. 国际化与无障碍自检 (i18n & Accessibility)

- [ ] **RULE 010 (Internationalization)**：
  - 界面中文文本已提取至多语言词条体系，未在 TSX/JSX 中硬编码中文。
  - 按钮与表格预留了西文字符膨胀弹性空间，未写死窄宽度导致截断。
- [ ] **RULE 011 (Accessibility)**：
  - 纯图标按钮已显式包含 `aria-label`。
  - 文本对比度达到 WCAG 2.2 AA 标准（正文 ≥ 4.5:1）。
  - 键盘操作闭环：支持 `Tab` 移动、`Enter/Space` 激活、`Escape` 关闭，弹窗具备焦点陷阱与焦点恢复。

---

## 5. 业务安全与交付验证 (Business Safety & Verification)

- [ ] **RULE 013 (Business Logic Protection)**：纯 UI 改动未无意改变模型计费、积分扣除、权限鉴权或支付流程。
- [ ] **RULE 014 (Verify Before Completion)**：已实际运行对应验证命令：
  - `cd web && bun run typecheck`（TypeScript 类型检查通过）。
  - `cd web && bun test test/design-system-compliance.test.ts`（合规门禁测试通过）。
  - `cd web && bun test test/ui-kit-retirement.test.ts`（退场规则测试通过）。
- [ ] **RULE 015 (No Silent Exceptions)**：若确有业务需要偏离本规范，已在 [docs/design-system/EXCEPTIONS.md](./EXCEPTIONS.md) 正式登记例外原因、影响范围、补偿措施与审批结论。
- [ ] **RULE 016 (Future AI Agent Compliance)**：已确保下次任务启动前主动重温本设计系统。
