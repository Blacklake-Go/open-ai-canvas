import type { HtmlTemplateMeta } from "../types";

export const BUILTIN_HTML_TEMPLATES: HtmlTemplateMeta[] = [
    {
        id: "linear-dark",
        name: "Linear 极简黑夜（Linear Dark Elegance）",
        category: "minimalist",
        badge: "强烈推荐 · 对标附图",
        theme: "dark",
        description: "纯粹深黑背景 (#000000)、极细微光描边、大字号轻量标题与舒缓行距，无多余干扰，专注阅读体验。",
        sampleHtml: `<!DOCTYPE html>
<html lang="zh-CN" data-theme="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>Terms of Service · 服务条款</title>
  <style>
    :root {
      --bg: #000000;
      --fg: #ffffff;
      --fg-muted: #8a8f98;
      --border: rgba(255, 255, 255, 0.08);
      --border-focus: rgba(255, 255, 255, 0.2);
      --accent: #5e6ad2;
      --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", sans-serif;
      --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      color: var(--fg);
      font-family: var(--font-sans);
      font-size: 15px;
      line-height: 1.8;
      letter-spacing: -0.011em;
      -webkit-font-smoothing: antialiased;
    }
    header {
      position: sticky;
      top: 0;
      z-index: 20;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 clamp(24px, 5vw, 64px);
      height: 64px;
      background: rgba(0, 0, 0, 0.85);
      backdrop-filter: blur(16px);
      border-bottom: 1px solid var(--border);
    }
    .logo {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 600;
      font-size: 16px;
      letter-spacing: -0.02em;
      color: var(--fg);
      text-decoration: none;
    }
    .nav-links a {
      color: var(--fg-muted);
      text-decoration: none;
      font-size: 13px;
      margin-left: 20px;
      transition: color 0.15s;
    }
    .nav-links a:hover { color: var(--fg); }
    main {
      max-width: 760px;
      margin: 0 auto;
      padding: clamp(48px, 8vw, 96px) 24px 120px;
    }
    h1 {
      font-size: clamp(38px, 6vw, 60px);
      font-weight: 600;
      letter-spacing: -0.035em;
      line-height: 1.08;
      margin-bottom: 16px;
    }
    .meta {
      font-family: var(--font-mono);
      font-size: 11px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--fg-muted);
      margin-bottom: 48px;
      padding-bottom: 24px;
      border-bottom: 1px solid var(--border);
    }
    .intro {
      font-size: 16px;
      line-height: 1.85;
      color: #e6e6e6;
      margin-bottom: 40px;
    }
    h2 {
      font-size: 20px;
      font-weight: 600;
      letter-spacing: -0.02em;
      margin: 48px 0 16px;
      color: var(--fg);
    }
    p {
      margin-bottom: 20px;
      color: #cccccc;
    }
    ul, ol {
      margin: 0 0 24px 20px;
      color: #cccccc;
    }
    li { margin-bottom: 8px; }
    .callout {
      border-left: 2px solid var(--fg);
      padding: 16px 20px;
      margin: 28px 0;
      background: rgba(255, 255, 255, 0.03);
      border-radius: 0 8px 8px 0;
      font-size: 14px;
      color: #e0e0e0;
    }
    footer {
      margin-top: 80px;
      padding-top: 32px;
      border-top: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      color: var(--fg-muted);
      flex-wrap: wrap;
      gap: 16px;
    }
    footer a { color: var(--fg); text-decoration: none; border-bottom: 1px solid var(--border); }
  </style>
</head>
<body>
  <header>
    <a href="/" class="logo">
      <svg width="22" height="22" viewBox="0 0 100 100" fill="none"><circle cx="50" cy="50" r="50" fill="currentColor"/></svg>
      Supdance
    </a>
    <div class="nav-links">
      <a href="/privacy">Privacy</a>
      <a href="/terms">Terms</a>
      <a href="/legal">Legal Hub</a>
    </div>
  </header>
  <main>
    <h1>Terms of Service</h1>
    <div class="meta">EFFECTIVE DATE: NOVEMBER 04, 2026 · VERSION 1.0</div>
    <div class="intro">
      本服务条款（“本条款”）约定您与 Supdance 运营主体之间就使用 AI 影视创作工作台及相关服务的权利与义务。使用本服务即表示您已完整阅读、理解并同意受本条款约束。
    </div>
    <h2>1. 服务说明与数字交付</h2>
    <p>Supdance 是一套面向创作者的在线 AI 影视与短剧创作工作台，提供画布协作、多模态音视频生成与项目资产管理服务。所有购买的积分和存储空间包均为即时数字交付权益，在支付成功并入账后即视为履约完成。</p>
    <h2>2. 计费模式与支付安全</h2>
    <p>本平台采用一次性积分预付模式，绝不进行未经授权的自动续费或周期性扣款。所有交易均由具备 PCI-DSS 合规资质的机构统一处理，平台不收集和存储您的卡号或完整安全码。</p>
    <div class="callout">
      特别说明：自购买之日起 7 天内，未产生任何消耗的积分充值包可申请全额原路退款；已实际消耗的算力资源不予退还。
    </div>
    <h2>3. AI 内容权利与合规使用</h2>
    <p>在法律允许的最大范围内，由您提供提示词并使用您已购算力生成的最终资产，相关权益归您所有。您承诺不利用本服务制作、传播违背公序良俗、侵犯他人肖像或著作权的恶意内容。</p>
    <h2>4. 联系与争议解决</h2>
    <p>如对条款有任何疑问，或需进行权利主张，请致信 <a href="mailto:support@supdance.com" style="color:#fff;">support@supdance.com</a>。双方应秉持友好原则协商解决。</p>
    <footer>
      <span>© 2026 Supdance. All rights reserved.</span>
      <span>Language: 中文 (Authoritative)</span>
    </footer>
  </main>
</body>
</html>`,
    },
    {
        id: "linear-aup",
        name: "Linear 极简黑夜 · AUP 可接受使用政策",
        category: "minimalist",
        badge: "Waffo 审核必备",
        theme: "dark",
        description: "对标 Waffo Pancake 内容审核规范，覆盖 #content-standards、#enforcement-actions 与 #reporting 锚点要求。",
        sampleHtml: `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>Acceptable Use Policy (AUP) · Supdance</title>
  <style>
    :root {
      --bg: #000000;
      --fg: #ffffff;
      --fg-muted: #8a8f98;
      --border: rgba(255, 255, 255, 0.08);
      --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", sans-serif;
      --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      color: var(--fg);
      font-family: var(--font-sans);
      font-size: 15px;
      line-height: 1.8;
      -webkit-font-smoothing: antialiased;
    }
    header {
      position: sticky;
      top: 0;
      z-index: 20;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 clamp(24px, 5vw, 64px);
      height: 64px;
      background: rgba(0, 0, 0, 0.85);
      backdrop-filter: blur(16px);
      border-bottom: 1px solid var(--border);
    }
    .logo { color: var(--fg); text-decoration: none; font-weight: 600; font-size: 16px; }
    .nav-links a { color: var(--fg-muted); text-decoration: none; font-size: 13px; margin-left: 20px; }
    .nav-links a:hover { color: var(--fg); }
    main { max-width: 760px; margin: 0 auto; padding: clamp(48px, 8vw, 96px) 24px 120px; }
    h1 { font-size: clamp(38px, 6vw, 60px); font-weight: 600; letter-spacing: -0.035em; line-height: 1.08; margin-bottom: 16px; }
    .meta { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--fg-muted); margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid var(--border); }
    .notice { border: 1px solid var(--border); background: rgba(255, 255, 255, 0.02); padding: 14px 18px; border-radius: 8px; font-family: var(--font-mono); font-size: 12px; margin-bottom: 36px; line-height: 1.6; }
    h2 { font-size: 21px; font-weight: 600; margin: 48px 0 16px; color: var(--fg); scroll-margin-top: 80px; }
    p { margin-bottom: 16px; color: #cccccc; }
    ul { margin: 0 0 24px 20px; color: #cccccc; }
    li { margin-bottom: 8px; }
    .callout { border: 1px solid var(--border); padding: 16px 20px; margin: 24px 0; background: rgba(255, 255, 255, 0.02); border-radius: 8px; font-size: 14px; color: #e0e0e0; }
    table { width: 100%; border-collapse: collapse; margin: 24px 0; font-size: 13px; border: 1px solid var(--border); border-radius: 6px; }
    th, td { padding: 12px 14px; text-align: left; border-bottom: 1px solid var(--border); }
    th { background: rgba(255, 255, 255, 0.04); font-family: var(--font-mono); color: var(--fg-muted); }
    footer { margin-top: 80px; padding-top: 32px; border-top: 1px solid var(--border); display: flex; justify-content: space-between; font-size: 12px; color: var(--fg-muted); }
  </style>
</head>
<body>
  <header>
    <a href="/" class="logo">Supdance</a>
    <div class="nav-links">
      <a href="/terms">Terms</a>
      <a href="/privacy">Privacy</a>
      <a href="/aup">AUP</a>
      <a href="/legal">Legal Hub</a>
    </div>
  </header>
  <main>
    <h1>Acceptable Use Policy</h1>
    <div class="meta">EFFECTIVE DATE: NOVEMBER 04, 2026 · VERSION 1.0</div>
    <div class="notice">
      <strong>AUTHORITATIVE NOTICE: </strong>This policy is executed in English as the authoritative source text under international compliance standards.
    </div>

    <h2>1. Scope & Application</h2>
    <p>This policy applies to all AI creative inputs and outputs processed across Supdance, including prompts, text scripts, generated imagery, synthesized video, voice cloning, and project canvas states.</p>

    <h2 id="content-standards">2. Content Standards & Prohibited Categories</h2>
    <p>You may not use our services to generate, process, store, or disseminate content within the following prohibited classifications:</p>
    <ul>
      <li><strong>Pornographic & Adult Content:</strong> Sexually explicit material, non-consensual imagery, and nudity.</li>
      <li><strong>Violence & Physical Harm:</strong> Depictions of extreme violence, blood, gore, mutilation, self-harm, or suicide incitement.</li>
      <li><strong>Hate Speech & Harassment:</strong> Attacks, defamation, or hate speech targeting race, ethnicity, religion, disability, or gender.</li>
      <li><strong>Child Safety (CSAM) - Zero Tolerance:</strong> Any depiction or facilitation of child sexual abuse material or child exploitation. All violations will be reported to law enforcement immediately.</li>
      <li><strong>Deepfakes & Non-Consensual Impersonation:</strong> Deceptive synthetic representations of real individuals without verifiable explicit written consent.</li>
      <li><strong>Intellectual Property Infringement:</strong> Unauthorized reproduction of registered trademarks or proprietary copyrighted material.</li>
    </ul>
    <div class="callout">
      <strong>Real Person Material:</strong> If uploading photographs or voice references of real persons, you warrant that you hold explicit legal consent from the individuals depicted.
    </div>

    <h2>3. Content Moderation Framework</h2>
    <p>We deploy automated pre-flight filtering classifiers alongside human compliance auditing. Requests detected as violating policy will be blocked immediately without debiting credits.</p>

    <h2 id="reporting">4. Violation Reporting & Handling Timelines</h2>
    <p>Suspected violations, safety concerns, or copyright infringement claims may be submitted to our dedicated desk at <a href="mailto:safety@supdance.com" style="color:#fff;">safety@supdance.com</a>.</p>
    <table>
      <thead><tr><th>Severity Level</th><th>Initial Response</th><th>Resolution Window</th></tr></thead>
      <tbody>
        <tr><td>L1 Critical (CSAM, Extreme Violence)</td><td>Within 2 Hours</td><td>Within 24 Hours</td></tr>
        <tr><td>L2 High Risk (Deepfakes, Harassment)</td><td>Within 24 Hours</td><td>Within 3 Business Days</td></tr>
        <tr><td>L3 Standard (IP & General Concerns)</td><td>Within 48 Hours</td><td>Within 7 Business Days</td></tr>
      </tbody>
    </table>

    <h2 id="enforcement-actions">5. Enforcement Actions</h2>
    <p>Violations will incur immediate enforcement actions based on severity:</p>
    <table>
      <thead><tr><th>Action</th><th>Description</th><th>Typical Ground</th></tr></thead>
      <tbody>
        <tr><td>Warning</td><td>Formal notice to stop or modify prompt</td><td>First-time minor trigger</td></tr>
        <tr><td>Content Takedown</td><td>Removal of violating assets from cloud</td><td>Confirmed violating imagery/video</td></tr>
        <tr><td>Feature Restriction</td><td>Suspension of generation for 1-14 days</td><td>Repeated bypass attempts</td></tr>
        <tr><td>Account Termination</td><td>Permanent account closure and ban</td><td>Severe breaches or fraud</td></tr>
        <tr><td>Legal Referral</td><td>Preservation of logs and police reporting</td><td>Criminal conduct or statutory mandate</td></tr>
      </tbody>
    </table>

    <h2>6. Appeals Mechanism</h2>
    <p>If you believe an enforcement action was executed erroneously, you may appeal by contacting <a href="mailto:support@supdance.com" style="color:#fff;">support@supdance.com</a> within 14 calendar days.</p>

    <footer>
      <span>© 2026 Supdance. All rights reserved.</span>
      <span>Support: support@supdance.com</span>
    </footer>
  </main>
</body>
</html>`,
    },
    {
        id: "vercel-doc",
        name: "Vercel 结构化文档（Vercel Document Pro）",
        category: "documentation",
        badge: "长文利器 · 双栏吸顶",
        theme: "adaptive",
        description: "经典黑白冷淡风、顶部阅读进度条、左侧悬浮目录随滚动高亮、结构化表格展示个人信息与 SDK 清单。",
        sampleHtml: `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Privacy Notice · 隐私政策</title>
  <style>
    :root {
      --bg: #ffffff;
      --fg: #111111;
      --fg-secondary: #666666;
      --border: #eaeaea;
      --accent: #0070f3;
      --surface: #fafafa;
      --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      --font-mono: Menlo, Monaco, Consolas, monospace;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0a0a0a;
        --fg: #ededed;
        --fg-secondary: #888888;
        --border: #222222;
        --surface: #141414;
      }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--fg);
      font-family: var(--font-sans);
      font-size: 15px;
      line-height: 1.8;
    }
    .progress-bar {
      position: fixed;
      top: 0;
      left: 0;
      height: 2px;
      background: var(--fg);
      width: 100%;
      transform-origin: 0 50%;
      transform: scaleX(0);
      z-index: 100;
      transition: transform 0.1s linear;
    }
    header {
      position: sticky;
      top: 0;
      height: 60px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 40px;
      background: color-mix(in srgb, var(--bg) 85%, transparent);
      backdrop-filter: blur(8px);
      z-index: 50;
    }
    .brand { font-weight: 600; font-size: 15px; letter-spacing: -0.02em; color: var(--fg); text-decoration: none; }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 64px 24px;
      display: grid;
      grid-template-columns: 240px minmax(0, 760px);
      gap: 64px;
      align-items: start;
    }
    @media (max-width: 900px) {
      .container { grid-template-columns: 1fr; }
      .toc { display: none; }
    }
    .toc {
      position: sticky;
      top: 88px;
      font-size: 13px;
    }
    .toc-title { font-weight: 600; margin-bottom: 12px; font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; color: var(--fg-secondary); }
    .toc ul { list-style: none; border-left: 1px solid var(--border); padding-left: 12px; }
    .toc li { margin-bottom: 8px; }
    .toc a { color: var(--fg-secondary); text-decoration: none; transition: color 0.15s; }
    .toc a:hover { color: var(--fg); }
    h1 { font-size: 44px; font-weight: 700; letter-spacing: -0.04em; margin-bottom: 8px; }
    .sub { color: var(--fg-secondary); font-size: 14px; margin-bottom: 40px; font-family: var(--font-mono); }
    h2 { font-size: 22px; font-weight: 600; letter-spacing: -0.02em; margin: 48px 0 16px; scroll-margin-top: 80px; }
    p { margin-bottom: 16px; color: color-mix(in srgb, var(--fg) 88%, transparent); }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 24px 0;
      font-size: 13px;
      border: 1px solid var(--border);
      border-radius: 6px;
      overflow: hidden;
    }
    th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid var(--border); }
    th { background: var(--surface); font-weight: 600; color: var(--fg-secondary); }
  </style>
</head>
<body>
  <div class="progress-bar" id="bar"></div>
  <header>
    <a href="/" class="brand">Supdance · Legal</a>
    <a href="/terms" style="color:var(--fg-secondary);text-decoration:none;font-size:13px;">服务条款 &rarr;</a>
  </header>
  <div class="container">
    <aside class="toc">
      <div class="toc-title">目录导航</div>
      <ul>
        <li><a href="#sec-1">1. 个人信息收集清单</a></li>
        <li><a href="#sec-2">2. 使用目的与合法依据</a></li>
        <li><a href="#sec-3">3. 第三方模型与数据隔离</a></li>
        <li><a href="#sec-4">4. 权利与注销机制</a></li>
      </ul>
    </aside>
    <article>
      <h1>Privacy Notice</h1>
      <div class="sub">LAST UPDATED: 2026-11-04 · V1.0</div>
      <p>我们高度重视您的隐私权利。本隐私政策明确告知您在使用 Supdance 创作平台时，我们如何收集、使用、存储及保护您的个人数据，以及您享有的查阅、导出与删除权利。</p>
      <h2 id="sec-1">1. 个人信息收集清单</h2>
      <p>我们仅收集向您提供 AI 影视工作台所必需的最小化数据：</p>
      <table>
        <thead>
          <tr><th>数据类别</th><th>收集项</th><th>用途</th></tr>
        </thead>
        <tbody>
          <tr><td>账号凭据</td><td>手机号 / 邮箱 / 认证 Token</td><td>登录鉴权与密码找回</td></tr>
          <tr><td>业务数据</td><td>工作区画布、分镜剧本、输入提示词</td><td>云端协同与历史追溯</td></tr>
          <tr><td>交易记录</td><td>充值订单号、积分抵扣流水</td><td>对账审计与退款处理</td></tr>
        </tbody>
      </table>
      <h2 id="sec-2">2. 使用目的与合法依据</h2>
      <p>我们绝不出售您的个人隐私或商业创作资产。您输入的内容仅用于执行您明确触发的推理任务，不会被用于任何未经授权的第三方公众模型训练。</p>
      <h2 id="sec-3">3. 第三方模型与数据隔离</h2>
      <p>当您选择特定的图像或视频生成通道时，系统仅在任务生命周期内向对应 API 提供推理必需的提示词与参考图，任务完成后严格遵循生命周期清理机制。</p>
      <h2 id="sec-4">4. 权利与注销机制</h2>
      <p>您可随时在“个人中心”申请全量导出或彻底注销账号。注销后，所有关联的项目与隐私数据将从活跃数据库中物理抹除。</p>
    </article>
  </div>
  <script>
    window.addEventListener('scroll', () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      const bar = document.getElementById('bar');
      if (bar) bar.style.transform = 'scaleX(' + (h > 0 ? Math.min(1, Math.max(0, window.scrollY / h)) : 0) + ')';
    }, { passive: true });
  </script>
</body>
</html>`,
    },
    {
        id: "anthropic-hub",
        name: "Anthropic 法务总览中心（Anthropic Legal Hub）",
        category: "hub",
        badge: "总览入口 · 矩阵卡片",
        theme: "adaptive",
        description: "适合作为全站法务综合门户 (/legal)，包含视觉大标题、受众群体分类标签筛选与关键词即时查找。",
        sampleHtml: `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Legal Center · 法务中心</title>
  <style>
    :root {
      --bg: #fbfbfc;
      --fg: #191919;
      --fg-muted: #666;
      --border: #e6e6e8;
      --card-bg: #ffffff;
      --tag-bg: #efeff1;
      --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      --font-mono: ui-monospace, Menlo, Monaco, monospace;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #111113;
        --fg: #f2f2f4;
        --fg-muted: #8e8e93;
        --border: #242428;
        --card-bg: #19191d;
        --tag-bg: #222228;
      }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--fg);
      font-family: var(--font-sans);
      padding: 0 clamp(20px, 6vw, 80px) 100px;
    }
    header {
      height: 72px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--border);
      margin-bottom: 64px;
    }
    .brand { font-weight: 600; font-size: 17px; color: var(--fg); text-decoration: none; }
    .hero {
      max-width: 900px;
      margin-bottom: 48px;
    }
    .sec-num { font-family: var(--font-mono); font-size: 12px; color: var(--fg-muted); letter-spacing: 0.1em; }
    h1 {
      font-size: clamp(48px, 8vw, 88px);
      font-weight: 500;
      letter-spacing: -0.04em;
      line-height: 1;
      margin: 12px 0 20px;
    }
    .intro { font-size: 20px; color: var(--fg-muted); line-height: 1.6; max-width: 600px; }
    .controls {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
      padding: 16px 20px;
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      margin-bottom: 40px;
    }
    .tabs { display: flex; gap: 8px; }
    .tab-btn {
      background: transparent;
      border: none;
      padding: 8px 16px;
      font-size: 13px;
      font-weight: 500;
      border-radius: 20px;
      cursor: pointer;
      color: var(--fg-muted);
    }
    .tab-btn.active { background: var(--fg); color: var(--bg); }
    .search-box input {
      background: var(--bg);
      border: 1px solid var(--border);
      color: var(--fg);
      border-radius: 20px;
      padding: 8px 16px;
      font-size: 13px;
      width: 220px;
      outline: none;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 24px;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 28px;
      text-decoration: none;
      color: var(--fg);
      display: flex;
      flex-direction: column;
      gap: 12px;
      transition: transform 0.15s, border-color 0.15s;
    }
    .card:hover { transform: translateY(-2px); border-color: color-mix(in srgb, var(--border) 60%, var(--fg)); }
    .tags { display: flex; gap: 8px; }
    .tag { font-family: var(--font-mono); font-size: 11px; padding: 4px 10px; background: var(--tag-bg); border-radius: 12px; color: var(--fg-muted); }
    .tag.primary { background: var(--fg); color: var(--bg); }
    .card h2 { font-size: 20px; font-weight: 600; letter-spacing: -0.02em; }
    .card time { font-size: 12px; color: var(--fg-muted); font-family: var(--font-mono); }
    .card p { font-size: 14px; color: var(--fg-muted); line-height: 1.6; flex: 1; }
    .card-foot { border-top: 1px solid var(--border); padding-top: 12px; display: flex; justify-content: space-between; font-size: 12px; font-weight: 500; }
  </style>
</head>
<body>
  <header>
    <a href="/" class="brand">Supdance</a>
    <a href="/" style="font-size:13px;color:var(--fg-muted);text-decoration:none;">返回创作台 &rarr;</a>
  </header>
  <div class="hero">
    <div class="sec-num">§ 01</div>
    <h1>Legal Center</h1>
    <div class="intro">统一查阅与管理 Supdance 面向全球创作者的各项法律协议、隐私保护准则与商用许可政策。</div>
  </div>
  <div class="controls">
    <div class="tabs">
      <button class="tab-btn active">全部政策</button>
      <button class="tab-btn">个人创作者</button>
      <button class="tab-btn">企业与工作室</button>
    </div>
    <div class="search-box">
      <input type="search" placeholder="搜索条款关键词..." id="kw" />
    </div>
  </div>
  <div class="grid">
    <a href="/terms" class="card">
      <div class="tags"><span class="tag primary">TERMS</span><span class="tag">全员适用</span></div>
      <h2>服务条款</h2>
      <time>生效：2026-11-04 · V1.0</time>
      <p>约定用户与平台之间的账号权责、数字交付积分规则、AI 输出知识产权及使用规范。</p>
      <div class="card-foot"><span>阅读全文</span><span>PDF 下载</span></div>
    </a>
    <a href="/privacy" class="card">
      <div class="tags"><span class="tag primary">POLICY</span><span class="tag">数据合规</span></div>
      <h2>隐私与个人信息保护政策</h2>
      <time>生效：2026-11-04 · V1.0</time>
      <p>详尽说明用户信息收集范围、隔离存储方式、跨境传输合规说明与注销导出通道。</p>
      <div class="card-foot"><span>阅读全文</span><span>PDF 下载</span></div>
    </a>
    <a href="/refund" class="card">
      <div class="tags"><span class="tag">BILLING</span><span class="tag">退款政策</span></div>
      <h2>退款与争议处理政策</h2>
      <time>生效：2026-11-04 · V1.0</time>
      <p>明确 7 天未使用充值包全额退款流程、生成失败积分冲正机制与账单申诉规则。</p>
      <div class="card-foot"><span>阅读全文</span><span>PDF 下载</span></div>
    </a>
  </div>
</body>
</html>`,
    },
    {
        id: "supabase-clean",
        name: "Supabase 现代纸书（Supabase Editorial）",
        category: "editorial",
        badge: "沉浸阅读 · 单栏呼吸感",
        theme: "light",
        description: "精简优雅的单栏纸书阅读排版、舒适视线约束 (68ch)、带高亮注意项卡片与清晰章节。",
        sampleHtml: `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Refund Policy · 退款政策</title>
  <style>
    :root {
      --bg: #ffffff;
      --fg: #1a1a1a;
      --muted: #666666;
      --border: #eaeaea;
      --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      --font-mono: Menlo, Monaco, Consolas, monospace;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--fg);
      font-family: var(--font-sans);
      line-height: 1.8;
      font-size: 15px;
    }
    header {
      height: 64px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 clamp(20px, 5vw, 60px);
    }
    .brand { font-weight: 600; color: var(--fg); text-decoration: none; font-size: 16px; }
    main {
      max-width: 680px;
      margin: 0 auto;
      padding: 60px 24px 100px;
    }
    h1 { font-size: 38px; font-weight: 700; letter-spacing: -0.03em; margin-bottom: 12px; }
    .date { font-family: var(--font-mono); font-size: 12px; color: var(--muted); margin-bottom: 40px; }
    h2 { font-size: 19px; font-weight: 600; margin: 36px 0 12px; }
    p { margin-bottom: 16px; color: #333; }
    ul { margin: 0 0 20px 20px; }
    li { margin-bottom: 8px; }
    .notice {
      background: #f7f7f9;
      border-radius: 8px;
      padding: 16px 20px;
      margin: 24px 0;
      font-size: 14px;
      color: #444;
      border: 1px solid var(--border);
    }
  </style>
</head>
<body>
  <header>
    <a href="/" class="brand">Supdance</a>
    <a href="/terms" style="color:var(--muted);text-decoration:none;font-size:13px;">返回条款</a>
  </header>
  <main>
    <h1>退款与充值争议处理政策</h1>
    <div class="date">生效日期：2026年11月04日 · 版本 1.0</div>
    <p>为保障所有用户的合法交易权益与平台的良好运行，本政策就充值积分包与存储扩容包的退款申请条件做出明确规定。</p>
    <h2>1. 未使用积分的 7 天无理由退款</h2>
    <p>自购买完成之日起 7 个自然日内，若该笔充值订单对应的积分尚未发生任何实际算力消耗或调用扣减，您可以申请全额原路退款。</p>
    <h2>2. 生成失败自动冲正</h2>
    <p>若由于系统底层原因或上游模型供应商异常导致您的视频、图像或音频生成任务中断并报错，系统将自动解冻并原路冲正退回该任务占用的积分。</p>
    <h2>3. 退款申请流程</h2>
    <div class="notice">
      请将您的注册账号、订单流水号及申请原因发送邮件至 <strong>support@supdance.com</strong>。我们的财务团队将在 3 个工作日内核实并由原支付通道发起退款。
    </div>
  </main>
</body>
</html>`,
    },
];
