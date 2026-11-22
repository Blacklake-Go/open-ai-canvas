// 基础 CSS 样式片段（兼容主流邮件客户端与暗色模式：黑曜石高级黑 Obsidian Dark）
const EMAIL_BASE_STYLE = `
  :root { color-scheme: dark only; supported-color-schemes: dark; }
  body { margin: 0; padding: 0; background-color: #0a0b0d; color: #ededf0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; }
  table { border-collapse: collapse; }
  img { border: 0; line-height: 100%; outline: none; text-decoration: none; }
  .email-container { max-width: 600px; margin: 0 auto; background-color: #131519; border: 1px solid #23272f; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6); }
  .email-header { padding: 28px 32px 20px; text-align: center; border-bottom: 1px solid #23272f; background: linear-gradient(180deg, #181b22 0%, #131519 100%); }
  .email-body { padding: 32px; color: #ededf0; font-size: 15px; line-height: 1.6; }
  .email-title { font-size: 24px; font-weight: 700; color: #ededf0; margin: 0 0 16px; line-height: 1.3; }
  .email-subtitle { font-size: 15px; color: #9aa0a6; margin: 0 0 24px; }
  .card { background-color: #0d0e12; border-radius: 12px; padding: 20px; margin-bottom: 24px; border: 1px solid #23272f; }
  .card-title { font-size: 15px; font-weight: 600; color: #ededf0; margin: 0 0 8px; }
  .card-text { font-size: 14px; color: #9aa0a6; margin: 0; line-height: 1.6; }
  .btn-primary { display: inline-block; background-color: #e11d74; color: #ffffff !important; font-weight: 600; font-size: 15px; text-decoration: none; padding: 12px 32px; border-radius: 10px; margin: 8px 0 24px; text-align: center; box-shadow: 0 4px 16px rgba(225, 29, 116, 0.35); }
  .email-footer { padding: 24px 32px 32px; text-align: center; font-size: 12px; color: #70757e; border-top: 1px solid #23272f; background-color: #0d0e12; line-height: 1.6; }
  .footer-link { color: #9aa0a6; text-decoration: underline; margin: 0 8px; }
  @media only screen and (max-width: 620px) {
    .email-container { width: 100% !important; border-radius: 0 !important; }
    .email-body { padding: 24px 16px !important; }
    .email-header { padding: 24px 16px 16px !important; }
  }
`;

export const MARKETING_TEMPLATES = {
  welcome: {
    key: 'welcome',
    name: '新用户注册欢迎',
    category: '用户激活',
    description: '用户通过邮箱注册成功后自动触发，引导新手体验核心创作功能与工作台',
    defaultSubject: '欢迎加入 {{brand_name}}，开启您的智能创作之旅',
    supportedVariables: [
      { key: 'name', label: '用户昵称', default: '创作者' },
      { key: 'email', label: '注册邮箱', default: 'user@example.com' },
      { key: 'action_url', label: '工作台链接', default: 'https://www.Supdance.com/studio' },
      { key: 'initial_credits', label: '初始赠送额度', default: '10' },
      { key: 'brand_name', label: '品牌名称', default: 'SupDance' },
      { key: 'support_email', label: '支持邮箱', default: 'support@Supdance.com' },
      { key: 'unsubscribe_url', label: '退订链接', default: 'https://www.Supdance.com/account/notifications' },
    ],
    sampleVariables: {
      name: '小溪',
      email: 'creator@example.com',
      action_url: 'https://www.Supdance.com/studio',
      initial_credits: '10',
      brand_name: 'SupDance',
      support_email: 'support@Supdance.com',
      unsubscribe_url: 'https://www.Supdance.com/account/notifications',
    },
    defaultHtml: `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark only">
  <meta name="supported-color-schemes" content="dark">
  <title>欢迎加入 {{brand_name}}</title>
  <style>${EMAIL_BASE_STYLE}</style>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0b0d;">
  <div style="background-color: #0a0b0d; padding: 24px 12px;">
    <div class="email-container">
      <div class="email-header">
        <div style="display: inline-flex; align-items: center; gap: 10px;">
          <div style="width: 32px; height: 32px; border-radius: 8px; background: linear-gradient(135deg, #e11d74 0%, #ff2d88 100%); display: inline-block; vertical-align: middle; box-shadow: 0 4px 12px rgba(225, 29, 116, 0.4);"></div>
          <span style="font-size: 20px; font-weight: 800; color: #ededf0; letter-spacing: -0.5px; vertical-align: middle;">{{brand_name}}</span>
        </div>
      </div>
      <div class="email-body">
        <h1 class="email-title">嗨，{{name}}！欢迎启程 🚀</h1>
        <p class="email-subtitle">感谢您注册 {{brand_name}}。我们已为您准备好专属的工作空间与新手体验算力。</p>

        <div class="card">
          <div class="card-title" style="color: #e11d74;">🎁 新手专属礼：{{initial_credits}} 算力额度已到账</div>
          <p class="card-text">您已获赠 {{initial_credits}} 点永不过期的初始体验额度，随时可以用于调用前沿 AI 大模型与工作流创作。</p>
        </div>

        <div style="margin-bottom: 24px;">
          <p style="font-weight: 600; color: #ededf0; margin-bottom: 8px;">快速开始您的第一次创作：</p>
          <ul style="padding-left: 20px; margin: 0; color: #9aa0a6; font-size: 14px; line-height: 1.8;">
            <li><strong style="color: #ededf0;">智能工作台 Studio：</strong>体验多模型同台对话与提示词即时调试。</li>
            <li><strong style="color: #ededf0;">Design Agent 画布：</strong>一句话生成全栈 Web 页面、UI 组件与代码产物。</li>
            <li><strong style="color: #ededf0;">多端同步：</strong>跨设备实时同步历史对话与创作成果。</li>
          </ul>
        </div>

        <div style="text-align: center; margin: 32px 0 16px;">
          <a href="{{action_url}}" class="btn-primary" target="_blank">进入工作台开启探索</a>
        </div>

        <p style="font-size: 13px; color: #70757e; text-align: center; margin: 0;">
          如果按钮无法点击，请复制并访问以下链接：<br>
          <a href="{{action_url}}" style="color: #e11d74; word-break: break-all;">{{action_url}}</a>
        </p>
      </div>

      <div class="email-footer">
        <p>本邮件由 {{brand_name}} 系统自动发送至您的注册邮箱 {{email}}。</p>
        <p>若有任何疑问或需要帮助，欢迎随时联系技术客服：<a href="mailto:{{support_email}}" class="footer-link">{{support_email}}</a></p>
        <p style="margin-top: 12px;">
          <a href="{{action_url}}" class="footer-link">官方主页</a> ·
          <a href="{{unsubscribe_url}}" class="footer-link">通知偏好设置</a> ·
          <a href="{{unsubscribe_url}}" class="footer-link">退订邮件</a>
        </p>
        <p style="margin-top: 16px; color: #70757e;">© 2026 {{brand_name}}. 保留所有权利。</p>
      </div>
    </div>
  </div>
</body>
</html>`,
  },

  newsletter: {
    key: 'newsletter',
    name: '产品更新与功能周报',
    category: '产品动态',
    description: '定期向创作者同步最新发布的模型工具、体验升级与优质创作示例',
    defaultSubject: '[{{brand_name}} 周报] {{update_title}}',
    supportedVariables: [
      { key: 'name', label: '用户昵称', default: '创作者' },
      { key: 'update_title', label: '更新主标题', default: '多智能体工作流重磅升级，算力调度全方位提速' },
      { key: 'feature_1_title', label: '新特性一标题', default: '全新协同智能体体系' },
      { key: 'feature_1_desc', label: '新特性一描述', default: '支持多角色模型并发作业与自循环对齐验证，任务交付质量跃迁。' },
      { key: 'feature_2_title', label: '新特性二标题', default: '极速响应与全域热部署' },
      { key: 'feature_2_desc', label: '新特性二描述', default: '构建速度提升 60%，带来真正零等待的流式生成交互。' },
      { key: 'action_url', label: '体验链接', default: 'https://www.Supdance.com/studio' },
      { key: 'brand_name', label: '品牌名称', default: 'SupDance' },
      { key: 'support_email', label: '支持邮箱', default: 'support@Supdance.com' },
      { key: 'unsubscribe_url', label: '退订链接', default: 'https://www.Supdance.com/account/notifications' },
    ],
    sampleVariables: {
      name: '创作者',
      update_title: '全新 AI 工作流引擎上线，带来更高效的协同体验',
      feature_1_title: '多智能体自动化流水线',
      feature_1_desc: '复杂工程与长篇写作任务可由智能体团队分工处理，自纠错自交付。',
      feature_2_title: '组件级沙箱双栏热预览',
      feature_2_desc: '支持在浏览器内实时构建与沙箱呈现，样式无污染。',
      action_url: 'https://www.Supdance.com/studio',
      brand_name: 'SupDance',
      support_email: 'support@Supdance.com',
      unsubscribe_url: 'https://www.Supdance.com/account/notifications',
    },
    defaultHtml: `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark only">
  <meta name="supported-color-schemes" content="dark">
  <title>{{brand_name}} 产品动态</title>
  <style>${EMAIL_BASE_STYLE}</style>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0b0d;">
  <div style="background-color: #0a0b0d; padding: 24px 12px;">
    <div class="email-container">
      <div class="email-header">
        <div style="display: inline-flex; align-items: center; gap: 10px;">
          <div style="width: 28px; height: 28px; border-radius: 8px; background: linear-gradient(135deg, #e11d74 0%, #ff2d88 100%); display: inline-block; vertical-align: middle;"></div>
          <span style="font-size: 18px; font-weight: 800; color: #ededf0; letter-spacing: 0.5px; vertical-align: middle;">{{brand_name}} PRODUCT NEWSLETTER</span>
        </div>
      </div>
      <div class="email-body">
        <h1 class="email-title">{{update_title}}</h1>
        <p class="email-subtitle">尊敬的 {{name}}，我们在过去的一周里为你带来了多项重磅功能优化与效能提升。</p>

        <div class="card">
          <div class="card-title" style="color: #e11d74;">✨ {{feature_1_title}}</div>
          <p class="card-text">{{feature_1_desc}}</p>
        </div>

        <div class="card">
          <div class="card-title" style="color: #e11d74;">⚡ {{feature_2_title}}</div>
          <p class="card-text">{{feature_2_desc}}</p>
        </div>

        <div style="text-align: center; margin: 32px 0 16px;">
          <a href="{{action_url}}" class="btn-primary" target="_blank">立即上手体验新功能</a>
        </div>
      </div>
      <div class="email-footer">
        <p>您之所以收到此周报，是因为您订阅了 {{brand_name}} 的产品资讯。</p>
        <p>如不想继续接收此类动态，可随时 <a href="{{unsubscribe_url}}" class="footer-link">点击此处退订</a>。</p>
        <p style="margin-top: 16px; color: #70757e;">© 2026 {{brand_name}}. 保留所有权利。</p>
      </div>
    </div>
  </div>
</body>
</html>`,
  },

  credit_alert: {
    key: 'credit_alert',
    name: '算力额度预警与充值礼遇',
    category: '运营转化',
    description: '当用户账户算力不足或促销节点时，推送专属充值优惠与加赠礼包',
    defaultSubject: '您的 {{brand_name}} 算力额度提醒：专属福利已送达',
    supportedVariables: [
      { key: 'name', label: '用户昵称', default: '创作者' },
      { key: 'current_credits', label: '当前剩余额度', default: '2' },
      { key: 'discount_rate', label: '折扣力度', default: '8折' },
      { key: 'promo_code', label: '专属优惠码', default: 'KOYO2026' },
      { key: 'bonus_credits', label: '限时加赠额度', default: '50' },
      { key: 'action_url', label: '充值中心链接', default: 'https://www.Supdance.com/pricing' },
      { key: 'brand_name', label: '品牌名称', default: 'SupDance' },
      { key: 'support_email', label: '支持邮箱', default: 'support@Supdance.com' },
      { key: 'unsubscribe_url', label: '退订链接', default: 'https://www.Supdance.com/account/notifications' },
    ],
    sampleVariables: {
      name: '小溪',
      current_credits: '2',
      discount_rate: '8折',
      promo_code: 'KOYO2026',
      bonus_credits: '50',
      action_url: 'https://www.Supdance.com/pricing',
      brand_name: 'SupDance',
      support_email: 'support@Supdance.com',
      unsubscribe_url: 'https://www.Supdance.com/account/notifications',
    },
    defaultHtml: `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark only">
  <meta name="supported-color-schemes" content="dark">
  <title>算力额度提醒 - {{brand_name}}</title>
  <style>${EMAIL_BASE_STYLE}</style>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0b0d;">
  <div style="background-color: #0a0b0d; padding: 24px 12px;">
    <div class="email-container">
      <div class="email-header">
        <div style="display: inline-flex; align-items: center; gap: 10px;">
          <div style="width: 28px; height: 28px; border-radius: 8px; background: linear-gradient(135deg, #e11d74 0%, #ff2d88 100%); display: inline-block; vertical-align: middle;"></div>
          <span style="font-size: 18px; font-weight: 800; color: #ededf0; letter-spacing: -0.3px; vertical-align: middle;">{{brand_name}} 算力守护</span>
        </div>
      </div>
      <div class="email-body">
        <h1 class="email-title">额度即将耗尽，创作不掉线 ⚡</h1>
        <p class="email-subtitle">亲爱的 {{name}}，系统检测到您当前的算力额度仅剩 <strong style="color: #e11d74;">{{current_credits}} 点</strong>，为避免生成任务中断，建议提前补充算力。</p>

        <div class="card" style="border-color: rgba(225, 29, 116, 0.4); background-color: rgba(225, 29, 116, 0.05);">
          <div class="card-title" style="color: #ff2d88;">🎉 专属特惠礼：充值享 {{discount_rate}} 优惠并加赠 {{bonus_credits}} 点</div>
          <p class="card-text">在结算时输入专属优惠码 <strong style="color: #ffffff; background: #23272f; padding: 2px 8px; border-radius: 6px; font-family: monospace;">{{promo_code}}</strong> 即可立享权益，本周内有效。</p>
        </div>

        <div style="text-align: center; margin: 32px 0 16px;">
          <a href="{{action_url}}" class="btn-primary" target="_blank">立即前往充值算力</a>
        </div>
      </div>
      <div class="email-footer">
        <p>本邮件为系统额度预警通知。如需调整通知设置，请前往 <a href="{{unsubscribe_url}}" class="footer-link">通知中心</a>。</p>
        <p style="margin-top: 16px; color: #70757e;">© 2026 {{brand_name}}. 保留所有权利。</p>
      </div>
    </div>
  </div>
</body>
</html>`,
  },

  winback: {
    key: 'winback',
    name: '沉睡促活与限时回归礼',
    category: '用户召回',
    description: '针对较长时间未登录的创作者，推送平台全新能力升级与专属回归体验金',
    defaultSubject: '好久不见，{{brand_name}} 为您准备了专属回归礼包 🎁',
    supportedVariables: [
      { key: 'name', label: '用户昵称', default: '创作者' },
      { key: 'inactive_days', label: '未登录天数', default: '30' },
      { key: 'gift_credits', label: '回归礼包额度', default: '20' },
      { key: 'highlight_feature', label: '主推亮点功能', default: '全新 Design Agent 智能生成画布' },
      { key: 'action_url', label: '立即回归链接', default: 'https://www.Supdance.com/login?ref=winback' },
      { key: 'brand_name', label: '品牌名称', default: 'SupDance' },
      { key: 'support_email', label: '支持邮箱', default: 'support@Supdance.com' },
      { key: 'unsubscribe_url', label: '退订链接', default: 'https://www.Supdance.com/account/notifications' },
    ],
    sampleVariables: {
      name: '小溪',
      inactive_days: '30',
      gift_credits: '20',
      highlight_feature: '全新 Design Agent 智能生成画布与双栏极速预览',
      action_url: 'https://www.Supdance.com/login?ref=winback',
      brand_name: 'SupDance',
      support_email: 'support@Supdance.com',
      unsubscribe_url: 'https://www.Supdance.com/account/notifications',
    },
    defaultHtml: `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark only">
  <meta name="supported-color-schemes" content="dark">
  <title>好久不见 - {{brand_name}}</title>
  <style>${EMAIL_BASE_STYLE}</style>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0b0d;">
  <div style="background-color: #0a0b0d; padding: 24px 12px;">
    <div class="email-container">
      <div class="email-header">
        <div style="display: inline-flex; align-items: center; gap: 10px;">
          <div style="width: 28px; height: 28px; border-radius: 8px; background: linear-gradient(135deg, #e11d74 0%, #ff2d88 100%); display: inline-block; vertical-align: middle;"></div>
          <span style="font-size: 18px; font-weight: 800; color: #ededf0; letter-spacing: -0.3px; vertical-align: middle;">{{brand_name}} 创作者回归计划</span>
        </div>
      </div>
      <div class="email-body">
        <h1 class="email-title">好久不见，{{name}} ✨</h1>
        <p class="email-subtitle">距离您上次登录已过去 {{inactive_days}} 天，{{brand_name}} 已经进化得更加强大与敏捷！</p>

        <div class="card" style="border-color: rgba(225, 29, 116, 0.4); background-color: rgba(225, 29, 116, 0.05);">
          <div class="card-title" style="color: #ff2d88;">🎁 专属回归礼已入库：免费领取 {{gift_credits}} 点算力</div>
          <p class="card-text">只要点击下方链接登录，系统将自动向您的账户发放 {{gift_credits}} 点回归体验金，无门槛即可畅享全新模型能力。</p>
        </div>

        <div style="margin: 20px 0;">
          <p style="font-weight: 600; color: #ededf0; margin-bottom: 6px;">这段时间我们上线了：</p>
          <p style="color: #9aa0a6; font-size: 14px; margin: 0;">🚀 <strong style="color: #ededf0;">{{highlight_feature}}</strong>：从想法到可运行的产品仅需数秒，诚邀您立即体验！</p>
        </div>

        <div style="text-align: center; margin: 32px 0 16px;">
          <a href="{{action_url}}" class="btn-primary" target="_blank">一键登录并领取回归礼包</a>
        </div>
      </div>
      <div class="email-footer">
        <p>我们非常想念您的灵感与创作。若您不想再收到促活通知，可 <a href="{{unsubscribe_url}}" class="footer-link">点击退订</a>。</p>
        <p style="margin-top: 16px; color: #70757e;">© 2026 {{brand_name}}. 保留所有权利。</p>
      </div>
    </div>
  </div>
</body>
</html>`,
  },
};

/**
 * 模板插值渲染函数：支持安全替换与默认保底
 */
export function renderMarketingTemplate(templateStr, variables = {}, templateKey = null) {
  if (typeof templateStr !== 'string') return '';
  const def = templateKey ? MARKETING_TEMPLATES[templateKey] : null;
  const mergedVars = {
    brand_name: 'SupDance',
    support_email: 'support@Supdance.com',
    action_url: 'https://www.Supdance.com/studio',
    unsubscribe_url: 'https://www.Supdance.com/account/notifications',
    ...(def?.sampleVariables || {}),
    ...variables,
  };

  return templateStr.replace(/\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g, (_, key) => {
    const val = mergedVars[key];
    if (val != null && val !== '') return String(val);
    const meta = def?.supportedVariables?.find((v) => v.key === key);
    return meta?.default != null ? String(meta.default) : '';
  });
}

/**
 * 将 HTML 转换为优雅的纯文本 fallback
 */
export function htmlToPlainText(html) {
  if (!html) return '';
  return String(html)
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi, '$2 ($1)')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
