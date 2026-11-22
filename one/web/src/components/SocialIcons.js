'use client';

/**
 * 官方高保真第三方品牌矢量图标库 (Official Brand Vector SVGs)
 * 来源：各品牌官方设计系统与开放平台标准资产
 * - 微信 (WeChat): 腾讯官方 TDesign / WeDesign 矢量规范
 * - QQ: 腾讯官方 TDesign / QQ互联官方标准矢量
 * - 抖音 (Douyin): 字节跳动 Semi Design (@douyinfe/semi-icons) 官方 3D 拟态音符
 * - 哔哩哔哩 (Bilibili): Bilibili 官方开放平台标准小电视
 * - Google: 官方四色 G 标
 * - X (Twitter): 官方 𝕏 矢量
 * - TikTok: 官方双色色偏音符
 * - Instagram: 官方渐变多彩镜头
 * - YouTube: 官方标准红白播放按钮矢量
 * - 小红书 (Xiaohongshu / RED): 官方标准矢量
 */

export function GoogleIcon({ className = '', size = 20, style, ...props }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={`shrink-0 ${className}`}
      style={{ width: size, height: size, ...style }}
      {...props}
    >
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3h3.88c2.27-2.09 3.665-5.17 3.665-9.09z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.27v3.09C3.25 21.3 7.34 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.32c-.25-.72-.38-1.49-.38-2.32s.14-1.6.38-2.32V6.59H1.27C.46 8.21 0 10.05 0 12s.46 3.79 1.27 5.41l4.01-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.25 2.7 1.27 6.59l4.01 3.09c.95-2.83 3.6-4.93 6.72-4.93z"
      />
    </svg>
  );
}

export function WeChatIcon({ className = '', size = 20, style, ...props }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={`shrink-0 ${className}`}
      style={{ width: size, height: size, ...style }}
      {...props}
    >
      {/* 腾讯官方 TDesign / WeDesign 标准双气泡矢量 */}
      {/* 1. 大气泡 (微信原版绿 #07C160) */}
      <path
        fill="#07C160"
        d="M8.8 17.03h-.05c-1.15 0-2.25-.2-3.26-.53l-2.84 1.42.35-2.71a6.95 6.95 0 01-3-5.57c0-4.08 3.92-7.39 8.75-7.39 4.17 0 7.66 2.47 8.54 5.77a9.4 9.4 0 00-.6-.02c-4.36 0-8.19 3.04-8.19 7.11 0 .67.1 1.31.3 1.92z"
      />
      {/* 大气泡双眼 (纯白镂空发光圆点) */}
      <circle cx="6" cy="7.2" r="1.1" fill="#FFFFFF" />
      <circle cx="11.5" cy="7.2" r="1.1" fill="#FFFFFF" />

      {/* 2. 小气泡 (微信原版绿 #07C160) */}
      <path
        fill="#07C160"
        d="M21.87 19.52A5.72 5.72 0 0024 15.16C24 11.76 20.75 9 16.75 9S9.5 11.76 9.5 15.16c0 3.4 3.25 6.16 7.25 6.16.95 0 1.86-.15 2.69-.43l2.43 1.4v-2.77z"
      />
      {/* 小气泡双眼 (纯白镂空发光圆点) */}
      <circle cx="14.3" cy="14.2" r="0.9" fill="#FFFFFF" />
      <circle cx="19.2" cy="14.2" r="0.9" fill="#FFFFFF" />
    </svg>
  );
}

// 官方 QQ 企鹅图标（高精度 75x90 透明底企鹅矢量容器，正方居中）
const QQ_PENGUIN_BASE64 =
  "data:image/png;base64,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";

export function QQIcon({ className = "", size = 20, style, ...props }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 90 90"
      className={`shrink-0 ${className}`}
      style={{ width: size, height: size, ...style }}
      {...props}
    >
      {/* 腾讯官方 QQ 企鹅图标资产（精确裁剪企鹅主体 75x90） */}
      <image
        href={QQ_PENGUIN_BASE64}
        xlinkHref={QQ_PENGUIN_BASE64}
        x="7.5"
        y="0"
        width="75"
        height="90"
        preserveAspectRatio="xMidYMid meet"
      />
    </svg>
  );
}

export function DouyinIcon({ className = '', size = 20, style, ...props }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={`shrink-0 ${className}`}
      style={{ width: size, height: size, ...style }}
      {...props}
    >
      {/* 字节跳动 Semi Design 官方标准音符矢量 (3D 拟态色偏通道) */}
      {/* 青色通道色偏 (#24F6F0) */}
      <path
        fill="#24F6F0"
        d="M16.07 1h-3.8V16.13A3.17 3.17 0 1 1 10.14 13v-3.9a6.98 6.98 0 1 0 5.94 6.91V8.47a9.05 9.05 0 0 0 5.3 1.7V6.37a5.3 5.3 0 0 1-5.3-5.31V1Z"
        transform="translate(-0.8, 0.7)"
      />
      {/* 洋红通道色偏 (#FE2C55) */}
      <path
        fill="#FE2C55"
        d="M16.07 1h-3.8V16.13A3.17 3.17 0 1 1 10.14 13v-3.9a6.98 6.98 0 1 0 5.94 6.91V8.47a9.05 9.05 0 0 0 5.3 1.7V6.37a5.3 5.3 0 0 1-5.3-5.31V1Z"
        transform="translate(0.8, -0.7)"
      />
      {/* 中央纯白主高光音符 (#FFFFFF) */}
      <path
        fill="#FFFFFF"
        d="M16.07 1h-3.8V16.13A3.17 3.17 0 1 1 10.14 13v-3.9a6.98 6.98 0 1 0 5.94 6.91V8.47a9.05 9.05 0 0 0 5.3 1.7V6.37a5.3 5.3 0 0 1-5.3-5.31V1Z"
      />
    </svg>
  );
}

export function BilibiliIcon({ className = '', size = 20, style, ...props }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={`shrink-0 ${className}`}
      style={{ width: size, height: size, ...style }}
      {...props}
    >
      {/* Bilibili 官方标准小电视矢量 (经典蓝 #00A1D6 + 纯白荧屏高对比) */}
      <rect x="5.2" y="7.2" width="13.6" height="9.7" rx="2" fill="#FFFFFF" />
      <path
        fill="#00A1D6"
        d="M17.813 4.653h.854c1.51.054 2.769.578 3.773 1.574 1.004.995 1.524 2.249 1.56 3.76v7.36c-.036 1.51-.556 2.769-1.56 3.773s-2.262 1.524-3.773 1.56H5.333c-1.51-.036-2.769-.556-3.773-1.56S.036 18.858 0 17.347v-7.36c.036-1.511.556-2.765 1.56-3.76 1.004-.996 2.262-1.52 3.773-1.574h.774l-1.174-1.12a1.234 1.234 0 0 1-.373-.906c0-.356.124-.658.373-.907l.027-.027c.267-.249.573-.373.92-.373.347 0 .653.124.92.373L9.653 4.44c.071.071.134.142.187.213h4.267a.836.836 0 0 1 .16-.213l2.853-2.747c.267-.249.573-.373.92-.373.347 0 .662.151.929.4.267.249.391.551.391.907 0 .355-.124.657-.373.906zM5.333 7.24c-.746.018-1.373.276-1.88.773-.506.498-.769 1.13-.786 1.894v7.52c.017.764.28 1.395.786 1.893.507.498 1.134.756 1.88.773h13.334c.746-.017 1.373-.275 1.88-.773.506-.498.769-1.129.786-1.893v-7.52c-.017-.765-.28-1.396-.786-1.894-.507-.497-1.134-.755-1.88-.773zM8 11.107c.373 0 .684.124.933.373.25.249.383.569.4.96v1.173c-.017.391-.15.711-.4.96-.249.25-.56.374-.933.374s-.684-.125-.933-.374c-.25-.249-.383-.569-.4-.96V12.44c0-.373.129-.689.386-.947.258-.257.574-.386.947-.386zm8 0c.373 0 .684.124.933.373.25.249.383.569.4.96v1.173c-.017.391-.15.711-.4.96-.249.25-.56.374-.933.374s-.684-.125-.933-.374c-.25-.249-.383-.569-.4-.96V12.44c.017-.391.15-.711.4-.96.249-.249.56-.373.933-.373Z"
      />
    </svg>
  );
}

export function TikTokIcon({ className = '', size = 20, style, ...props }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={`shrink-0 ${className}`}
      style={{ width: size, height: size, ...style }}
      {...props}
    >
      <path
        fill="#25F4EE"
        d="M18.6 6.3a4.8 4.8 0 0 1-3.6-4.1H12v13.6a2.9 2.9 0 1 1-2.9-2.9c.3 0 .6 0 .9.1V9.8a6.3 6.3 0 1 0 5.2 6.2V8.6a8.2 8.2 0 0 0 4.8 1.6V7a4.8 4.8 0 0 1-1.4-.7z"
      />
      <path
        fill="#FE2C55"
        d="M19.8 6.9a4.8 4.8 0 0 1-3.6-4.1h-3.1v13.6a2.9 2.9 0 1 1-2.9-2.9c.3 0 .6 0 .9.1v-3.2a6.3 6.3 0 1 0 5.2 6.2V9.2a8.2 8.2 0 0 0 4.8 1.6V7.6a4.8 4.8 0 0 1-1.3-.7z"
      />
      <path
        fill="#FFFFFF"
        d="M19.2 6.6a4.8 4.8 0 0 1-3.6-4.1h-3.1v13.6a2.9 2.9 0 1 1-2.9-2.9c.3 0 .6 0 .9.1V10a6.3 6.3 0 1 0 5.2 6.2V8.9a8.2 8.2 0 0 0 4.8 1.6V7.3a4.8 4.8 0 0 1-1.3-.7z"
      />
    </svg>
  );
}

export function InstagramIcon({ className = '', size = 20, style, ...props }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={`shrink-0 ${className}`}
      style={{ width: size, height: size, ...style }}
      {...props}
    >
      <defs>
        <radialGradient id="ig-grad-radial" cx="30%" cy="107%" r="150%">
          <stop offset="0%" stopColor="#fdf497" />
          <stop offset="5%" stopColor="#fdf497" />
          <stop offset="45%" stopColor="#fd5949" />
          <stop offset="60%" stopColor="#d6249f" />
          <stop offset="90%" stopColor="#285AEB" />
        </radialGradient>
      </defs>
      <rect width="22" height="22" x="1" y="1" rx="6" fill="url(#ig-grad-radial)" />
      <rect width="13" height="13" x="5.5" y="5.5" rx="3.5" fill="none" stroke="#FFFFFF" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="3.2" fill="none" stroke="#FFFFFF" strokeWidth="1.6" />
      <circle cx="15.8" cy="8.2" r="0.8" fill="#FFFFFF" />
    </svg>
  );
}

export function InstagramVectorIcon({ className = '', size = 20, style, ...props }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={`shrink-0 ${className}`}
      style={{ width: size, height: size, ...style }}
      {...props}
    >
      <path d="M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077" />
    </svg>
  );
}

export function XIcon({ className = '', size = 18, style, ...props }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={`shrink-0 ${className}`}
      style={{ width: size, height: size, ...style }}
      {...props}
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function GithubIcon({ className = '', size = 20, style, ...props }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={`shrink-0 ${className}`}
      style={{ width: size, height: size, ...style }}
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

export function AppleIcon({ className = '', size = 20, style, ...props }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={`shrink-0 ${className}`}
      style={{ width: size, height: size, ...style }}
      {...props}
    >
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.38c.62-.75 1.04-1.8 0.92-2.85-.9.04-1.99.6-2.63 1.35-.57.65-1.06 1.72-.93 2.74 1 .08 2.02-.49 2.64-1.24z" />
    </svg>
  );
}

export function AlipayIcon({ className = '', size = 20, style, ...props }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={`shrink-0 ${className}`}
      style={{ width: size, height: size, ...style }}
      {...props}
    >
      <rect width="22" height="22" x="1" y="1" rx="5" fill="#1677FF" />
      <path
        fill="#FFFFFF"
        d="M17.8 11.2c-.6 0-2.8.2-5 .7-.8-1.5-1.5-3.3-1.8-5h5.1V5.7h-3.4V4.2h-1.6v1.5H8v1.2h4.5c-.3 1.4-.8 2.8-1.4 4H7.8v1.2h3.8c-1.3 3.2-3.1 5.3-5.2 6.6l.8 1.1c2.3-1.5 4.3-3.9 5.8-7.5 2.1-.5 4.2-.7 4.8-.7.2 0 .4 0 .5.1.2.2.3.8.3 1.8 0 1.9-.9 3.2-2.6 3.2-1.3 0-2.3-.7-2.6-1.7l-1.3.5c.5 1.7 2 2.5 3.9 2.5 2.5 0 3.9-1.8 3.9-4.5.1-1.7-.2-2.9-.6-3.4-.6-.7-1.6-.9-2.4-.9z"
      />
    </svg>
  );
}

export function MailIcon({ className = '', size = 18, style, ...props }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      style={{ width: size, height: size, ...style }}
      {...props}
    >
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

export function PhoneIcon({ className = '', size = 18, style, ...props }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      style={{ width: size, height: size, ...style }}
      {...props}
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

export function StripeIcon({ className = '', size = 20, style, ...props }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={`shrink-0 ${className}`}
      style={{ width: size, height: size, ...style }}
      {...props}
    >
      <rect width="22" height="22" x="1" y="1" rx="5" fill="#635BFF" />
      <path
        fill="#FFFFFF"
        d="M14.6 10.3c0-.8-.6-1.2-1.7-1.2-1.5 0-3.3.6-4.6 1.4V7.6c1.4-.7 3.2-1.1 4.7-1.1 3.5 0 5.6 1.7 5.6 4.5 0 4.4-6.1 3.7-6.1 5.6 0 .9.8 1.3 2 1.3 1.8 0 3.8-.8 5.2-1.7v2.9c-1.5.8-3.5 1.2-5.3 1.2-3.7 0-5.9-1.8-5.9-4.6 0-4.6 6.1-3.9 6.1-5.4z"
      />
    </svg>
  );
}

export function PayPalIcon({ className = '', size = 20, style, ...props }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={`shrink-0 ${className}`}
      style={{ width: size, height: size, ...style }}
      {...props}
    >
      <path
        fill="#003087"
        d="M7.4 20.6l2.1-13.3h5.4c3.3 0 5.4 1.6 4.9 4.8-.4 2.7-2.3 4.8-5.4 4.8H11l-1 6.3H7.4z"
      />
      <path
        fill="#0079C1"
        d="M10.1 16.9h3.4c2.8 0 4.7-1.8 5.1-4.2.4-2.7-1.4-4.1-4.3-4.1h-4.2l-2.1 13h2.1l1.1-4.7z"
      />
      <path
        fill="#001C64"
        opacity="0.3"
        d="M11 16.9l.7-4.4h2.6c1.9 0 3.3.6 3.7 2.2-.4 2.4-2.3 4.2-5.1 4.2H11v-2z"
      />
    </svg>
  );
}

export function QQVectorIcon({ className = '', size = 20, style, ...props }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={`shrink-0 ${className}`}
      style={{ width: size, height: size, ...style }}
      {...props}
    >
      <path d="M21.395 15.035a40 40 0 0 0-.803-2.264l-1.079-2.695c.001-.032.014-.562.014-.836C19.526 4.632 17.351 0 12 0S4.474 4.632 4.474 9.241c0 .274.013.804.014.836l-1.08 2.695a39 39 0 0 0-.802 2.264c-1.021 3.283-.69 4.643-.438 4.673.54.065 2.103-2.472 2.103-2.472 0 1.469.756 3.387 2.394 4.771-.612.188-1.363.479-1.845.835-.434.32-.379.646-.301.778.343.578 5.883.369 7.482.189 1.6.18 7.14.389 7.483-.189.078-.132.132-.458-.301-.778-.483-.356-1.233-.646-1.846-.836 1.637-1.384 2.393-3.302 2.393-4.771 0 0 1.563 2.537 2.103 2.472.251-.03.581-1.39-.438-4.673" />
    </svg>
  );
}

export function YouTubeIcon({ className = '', size = 20, style, ...props }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={`shrink-0 ${className}`}
      style={{ width: size, height: size, ...style }}
      {...props}
    >
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

export function XiaohongshuIcon({ className = '', size = 20, style, ...props }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={`shrink-0 ${className}`}
      style={{ width: size, height: size, ...style }}
      {...props}
    >
      <path d="M22.405 9.879c.002.016.01.02.07.019h.725a.797.797 0 0 0 .78-.972.794.794 0 0 0-.884-.618.795.795 0 0 0-.692.794c0 .101-.002.666.001.777zm-11.509 4.808c-.203.001-1.353.004-1.685.003a2.528 2.528 0 0 1-.766-.126.025.025 0 0 0-.03.014L7.7 16.127a.025.025 0 0 0 .01.032c.111.06.336.124.495.124.66.01 1.32.002 1.981 0 .01 0 .02-.006.023-.015l.712-1.545a.025.025 0 0 0-.024-.036zM.477 9.91c-.071 0-.076.002-.076.01a.834.834 0 0 0-.01.08c-.027.397-.038.495-.234 3.06-.012.24-.034.389-.135.607-.026.057-.033.042.003.112.046.092.681 1.523.787 1.74.008.015.011.02.017.02.008 0 .033-.026.047-.044.147-.187.268-.391.371-.606.306-.635.44-1.325.486-1.706.014-.11.021-.22.03-.33l.204-2.616.022-.293c.003-.029 0-.033-.03-.034zm7.203 3.757a1.427 1.427 0 0 1-.135-.607c-.004-.084-.031-.39-.235-3.06a.443.443 0 0 0-.01-.082c-.004-.011-.052-.008-.076-.008h-1.48c-.03.001-.034.005-.03.034l.021.293c.076.982.153 1.964.233 2.946.05.4.186 1.085.487 1.706.103.215.223.419.37.606.015.018.037.051.048.049.02-.003.742-1.642.804-1.765.036-.07.03-.055.003-.112zm3.861-.913h-.872a.126.126 0 0 1-.116-.178l1.178-2.625a.025.025 0 0 0-.023-.035l-1.318-.003a.148.148 0 0 1-.135-.21l.876-1.954a.025.025 0 0 0-.023-.035h-1.56c-.01 0-.02.006-.024.015l-.926 2.068c-.085.169-.314.634-.399.938a.534.534 0 0 0-.02.191.46.46 0 0 0 .23.378.981.981 0 0 0 .46.119h.59c.041 0-.688 1.482-.834 1.972a.53.53 0 0 0-.023.172.465.465 0 0 0 .23.398c.15.092.342.12.475.12l1.66-.001c.01 0 .02-.006.023-.015l.575-1.28a.025.025 0 0 0-.024-.035zm-6.93-4.937H3.1a.032.032 0 0 0-.034.033c0 1.048-.01 2.795-.01 6.829 0 .288-.269.262-.28.262h-.74c-.04.001-.044.004-.04.047.001.037.465 1.064.555 1.263.01.02.03.033.051.033.157.003.767.009.938-.014.153-.02.3-.06.438-.132.3-.156.49-.419.595-.765.052-.172.075-.353.075-.533.002-2.33 0-4.66-.007-6.991a.032.032 0 0 0-.032-.032zm11.784 6.896c0-.014-.01-.021-.024-.022h-1.465c-.048-.001-.049-.002-.05-.049v-4.66c0-.072-.005-.07.07-.07h.863c.08 0 .075.004.075-.074V8.393c0-.082.006-.076-.08-.076h-3.5c-.064 0-.075-.006-.075.073v1.445c0 .083-.006.077.08.077h.854c.075 0 .07-.004.07.07v4.624c0 .095.008.084-.085.084-.37 0-1.11-.002-1.304 0-.048.001-.06.03-.06.03l-.697 1.519s-.014.025-.008.036c.006.01.013.008.058.008 1.748.003 3.495.002 5.243.002.03-.001.034-.006.035-.033v-1.539zm4.177-3.43c0 .013-.007.023-.02.024-.346.006-.692.004-1.037.004-.014-.002-.022-.01-.022-.024-.005-.434-.007-.869-.01-1.303 0-.072-.006-.071.07-.07l.733-.003c.041 0 .081.002.12.015.093.025.16.107.165.204.006.431.002 1.153.001 1.153zm2.67.244a1.953 1.953 0 0 0-.883-.222h-.18c-.04-.001-.04-.003-.042-.04V10.21c0-.132-.007-.263-.025-.394a1.823 1.823 0 0 0-.153-.53 1.533 1.533 0 0 0-.677-.71 2.167 2.167 0 0 0-1-.258c-.153-.003-.567 0-.72 0-.07 0-.068.004-.068-.065V7.76c0-.031-.01-.041-.046-.039H17.93s-.016 0-.023.007c-.006.006-.008.012-.008.023v.546c-.008.036-.057.015-.082.022h-.95c-.022.002-.028.008-.03.032v1.481c0 .09-.004.082.082.082h.913c.082 0 .072.128.072.128V11.19s.003.117-.06.117h-1.482c-.068 0-.06.082-.06.082v1.445s-.01.068.064.068h1.457c.082 0 .076-.006.076.079v3.225c0 .088-.007.081.082.081h1.43c.09 0 .082.007.082-.08v-3.27c0-.029.006-.035.033-.035l2.323-.003c.098 0 .191.02.28.061a.46.46 0 0 1 .274.407c.008.395.003.79.003 1.185 0 .259-.107.367-.33.367h-1.218c-.023.002-.029.008-.028.033.184.437.374.871.57 1.303a.045.045 0 0 0 .04.026c.17.005.34.002.51.003.15-.002.517.004.666-.01a2.03 2.03 0 0 0 .408-.075c.59-.18.975-.698.976-1.313v-1.981c0-.128-.01-.254-.034-.38 0 .078-.029-.641-.724-.998z" />
    </svg>
  );
}

export const SOCIAL_ICON_COMPONENTS = {
  google: GoogleIcon,
  wechat: WeChatIcon,
  wechat_oauth: WeChatIcon,
  weixin: WeChatIcon,
  qq: QQIcon,
  qq_vector: QQVectorIcon,
  douyin: DouyinIcon,
  bilibili: BilibiliIcon,
  bili: BilibiliIcon,
  tiktok: TikTokIcon,
  instagram: InstagramIcon,
  x: XIcon,
  twitter: XIcon,
  youtube: YouTubeIcon,
  xiaohongshu: XiaohongshuIcon,
  xhs: XiaohongshuIcon,
  redbook: XiaohongshuIcon,
  red: XiaohongshuIcon,
  github: GithubIcon,
  apple: AppleIcon,
  alipay: AlipayIcon,
  stripe: StripeIcon,
  paypal: PayPalIcon,
  phone: PhoneIcon,
  email: MailIcon,
  mail: MailIcon,
};

export function getSocialIcon(id) {
  if (!id) return null;
  const key = String(id).toLowerCase().trim();
  return SOCIAL_ICON_COMPONENTS[key] || null;
}
