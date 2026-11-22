/**
 * KOYO Studio Design Tokens (Source of Truth)
 * Visual Direction: "Premium AI Creative Workspace"
 * 
 * Rules:
 * 1. All colors, radii, spacing, elevations, and motions must come from these semantic tokens.
 * 2. Never hardcode arbitrary hex (#xxxxxx), arbitrary px or ad-hoc classes.
 */

export const tokens = {
  colors: {
    // Background Surface Levels (True Neutral OLED Black - Consistent with Studio Home)
    bg: {
      canvas: '#030303',        // 页面底层极纯黑画布 (Deep Neutral Canvas)
      base: '#070708',          // 基础工作区底板 (Workbench Base)
      surface: '#0d0e12',       // 一级容器/面板，杜绝蓝灰塑料感 (Panels, Sidebars)
      surfaceRaised: '#13151c', // 二级卡片/悬浮块 (Cards, Active Elements)
      overlay: '#181a22',       // 模态弹窗/下拉菜单 (Modals, Popovers, Menus)
      subtle: '#0f1015',        // 微弱底色/输入框未激活
    },
    // Text Semantic Hierarchy
    text: {
      primary: '#f3f4f6',       // 一级文字/主标题/核心数值 (gray-100)
      secondary: '#9ca3af',     // 二级描述/标签名/次级文本 (gray-400)
      tertiary: '#868b8f',      // 辅助说明/占位符/失焦图标 (5.05:1 on overlay)
      disabled: '#4b5563',      // 禁用态文字 (gray-600)
      inverse: '#ffffff',       // 反色文字（用于高亮强调背景上，洋红配纯白）
    },
    // Borders & Dividers
    border: {
      subtle: 'rgba(255, 255, 255, 0.06)',  // 极细微分割线 (Hairline)
      default: 'rgba(255, 255, 255, 0.10)', // 标准卡片/面板边框
      strong: 'rgba(255, 255, 255, 0.18)',  // 聚焦/悬停/高亮边框
      accent: 'rgba(225, 29, 116, 0.45)',    // 品牌强调边框
    },
    // Brand Accent (Professional Magenta - Controlled, Refined, WCAG AA Compliant)
    accent: {
      primary: '#e11d74',       // 核心品牌主色 (Magenta, 4.54:1 on white)
      hover: '#f43f5e',         // 非文字悬停边缘/光晕；白字按钮禁用
      active: '#c0175f',        // 点击激活主色 (Deep Magenta Active)
      hoverSolid: '#c0175f',    // 承载白字的实心悬停 (5.95:1)
      activeSolid: '#9f1239',   // 承载白字的实心按压
      text: '#f472b6',          // 深色表面品牌小字 (canvas 7.79:1 / overlay 6.55:1)
      soft: 'rgba(225, 29, 116, 0.10)', // 浅底强调色（薄雾层）
      border: 'rgba(225, 29, 116, 0.28)', // 高光边缘
    },
    // Functional Feedback
    feedback: {
      success: '#10b981',       // 成功/已完成 (Emerald 500)
      successSoft: 'rgba(16, 185, 129, 0.14)',
      warning: '#f59e0b',       // 警告/排队中 (Amber 500)
      warningSoft: 'rgba(245, 158, 11, 0.14)',
      danger: '#ef4444',        // 错误/失败/危险操作 (Red 500)
      dangerSoft: 'rgba(239, 68, 68, 0.14)',
      info: '#3b82f6',          // 提示/信息 (Blue 500)
      infoSoft: 'rgba(59, 130, 246, 0.14)',
    },
  },

  // 4px Grid Spacing Scale
  spacing: {
    1: '4px',
    2: '8px',
    3: '12px',
    4: '16px',
    5: '20px',
    6: '24px',
    8: '32px',
    10: '40px',
    12: '48px',
    16: '64px',
  },

  // Controlled Radius System
  radius: {
    none: '0px',
    xs: '4px',      // 微小标签/Badge
    sm: '6px',      // 基础参数控件/Small Button
    md: '8px',      // 标准按钮/输入框 (Button, Input, Select)
    lg: '12px',     // 控件/按钮/选择器触发器 (Control, Button, Select Trigger)
    xl: '16px',     // 字段/卡片/下拉浮层 (Field, Card, Dropdown, Popover)
    '2xl': '20px',  // 模态/抽屉 (Modal, Drawer)
    full: '9999px', // 药丸标签/头像/圆形图标按钮 (Pill, Avatar)
  },

  // Standard Height Contracts
  heights: {
    controlXs: '28px',
    controlSm: '32px',
    controlMd: '38px',
    controlLg: '44px',
    segmentTrackSm: '36px',
    segmentTrackMd: '40px',
    segmentItemSm: '28px',
    segmentItemMd: '32px',
    header: '56px',
    composerTrigger: '38px',
  },

  // Typography System
  typography: {
    fontSans: '"Inter", "Geist", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif',
    fontMono: '"JetBrains Mono", "Fira Code", monospace',
    scale: {
      display: { size: '32px', lineHeight: '40px', weight: '700', tracking: '-0.025em' },
      pageTitle: { size: '24px', lineHeight: '32px', weight: '600', tracking: '-0.02em' },
      sectionTitle: { size: '18px', lineHeight: '26px', weight: '600', tracking: '-0.015em' },
      cardTitle: { size: '15px', lineHeight: '22px', weight: '600', tracking: '-0.01em' },
      body: { size: '14px', lineHeight: '20px', weight: '400', tracking: '-0.005em' },
      bodySmall: { size: '13px', lineHeight: '18px', weight: '400', tracking: '0em' },
      label: { size: '12px', lineHeight: '16px', weight: '500', tracking: '0.01em' },
      caption: { size: '11px', lineHeight: '14px', weight: '400', tracking: '0.015em' },
      mono: { size: '12px', lineHeight: '16px', weight: '400', tracking: '0' },
    }
  },

  // Neutral multi-layer elevations (no coloured glow; v3.8.0 §4.17)
  elevation: {
    none: 'none',
    1: '0 1px 2px rgba(0, 0, 0, 0.46), 0 0 0 1px rgba(255, 255, 255, 0.018)',
    2: '0 4px 12px -4px rgba(0, 0, 0, 0.58), 0 1px 3px rgba(0, 0, 0, 0.34), 0 0 0 1px rgba(255, 255, 255, 0.022)',
    3: '0 12px 32px -10px rgba(0, 0, 0, 0.74), 0 4px 12px -6px rgba(0, 0, 0, 0.48), 0 0 0 1px rgba(255, 255, 255, 0.025)',
    4: '0 28px 80px -24px rgba(0, 0, 0, 0.90), 0 14px 36px -18px rgba(0, 0, 0, 0.68), 0 0 0 1px rgba(255, 255, 255, 0.030)',
  },

  glassPopover: {
    bg: 'rgba(24, 26, 34, 0.94)',
    border: 'rgba(255, 255, 255, 0.14)',
    shadow: '0 20px 52px rgba(0, 0, 0, 0.34), inset 0 1px 0 rgba(255, 255, 255, 0.055)',
    blur: '28px',
  },

  // Z-Index Layers (v3.8.0 §5)
  zIndex: {
    base: 0,
    raised: 1,
    sticky: 10,
    header: 40,
    drawer: 50,
    dropdown: 60,
    popover: 70,
    overlay: 80,
    modal: 90,
    toast: 100,
    tooltip: 110,
  },

  // Dual-semantic motion (v3.8.0 §4.7.6)
  motion: {
    durationInstant: '80ms',
    durationFast: '120ms',
    durationBase: '180ms',
    durationSmooth: '240ms',
    durationModal: '400ms',
    productFast: '120ms',
    productState: '180ms',
    productEnter: '360ms',
    press: '90ms',
    theme: '400ms',
    stagger: '45ms',
    easeStandard: 'cubic-bezier(0.16, 1, 0.3, 1)',
    easeEnter: 'cubic-bezier(0.05, 0.7, 0.1, 1)',
    easeExit: 'cubic-bezier(0.3, 0, 0.8, 0.15)',
    easeOvershoot: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    easeTheme: 'ease-in-out',
  }
};
