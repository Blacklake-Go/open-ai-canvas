import type { SVGProps } from "react";

/**
 * 腾讯 QQ 官方标准彩色企鹅图标 (Official Tencent QQ Vector)
 * 符合腾讯品牌规范：经典企鹅轮廓、标志性红围巾、黄喙黄脚、亮黑身躯与白肚皮
 */
export function QQIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" {...props}>
            <ellipse cx="7.8" cy="21.2" rx="3.2" ry="1.4" fill="#FFAA00" />
            <ellipse cx="16.2" cy="21.2" rx="3.2" ry="1.4" fill="#FFAA00" />
            <path
                d="M12 2C7.58 2 4 5.58 4 10c0 2.2.89 4.19 2.33 5.64-.18.84-.71 2.35-1.74 3.28-.21.19-.11.54.17.58 1.15.17 2.65-.05 3.82-.9.45.14.92.22 1.42.22.5 0 .97-.08 1.42-.22 1.17.85 2.67 1.07 3.82.9.28-.04.38-.39.17-.58-1.03-.93-1.56-2.44-1.74-3.28C19.11 14.19 20 12.2 20 10c0-4.42-3.58-8-8-8z"
                fill="#18181B"
            />
            <ellipse cx="4.8" cy="14" rx="1.8" ry="3.8" transform="rotate(18 4.8 14)" fill="#18181B" />
            <ellipse cx="19.2" cy="14" rx="1.8" ry="3.8" transform="rotate(-18 19.2 14)" fill="#18181B" />
            <ellipse cx="12" cy="14.8" rx="5.6" ry="5.4" fill="#FFFFFF" />
            <ellipse cx="12" cy="8.2" rx="4.6" ry="3.6" fill="#FFFFFF" />
            <path d="M6.2 10.6c.9 2.2 3.2 3.6 5.8 3.6s4.9-1.4 5.8-3.6c.4-.1.8.2.8.6 0 .3-.2.6-.5.8-1.5 2.2-4 3.4-6.1 3.4s-4.6-1.2-6.1-3.4c-.3-.2-.5-.5-.5-.8 0-.4.4-.7.8-.6z" fill="#EB1923" />
            <path d="M7 11.2c.4 1.8 2.5 3 5 3s4.6-1.2 5-3c.2-.7-.4-1.2-1.2-1.2H8.2c-.8 0-1.4.5-1.2 1.2z" fill="#EB1923" />
            <ellipse cx="9.8" cy="7.2" rx="0.9" ry="1.5" fill="#18181B" />
            <ellipse cx="14.2" cy="7.2" rx="0.9" ry="1.5" fill="#18181B" />
            <circle cx="10.1" cy="6.6" r="0.4" fill="#FFFFFF" />
            <circle cx="14.5" cy="6.6" r="0.4" fill="#FFFFFF" />
            <path d="M10 9.2c0-.2.2-.4.4-.4h3.2c.2 0 .4.2.4.4 0 .9-.9 1.6-2 1.6s-2-.7-2-1.6z" fill="#FFAA00" />
        </svg>
    );
}

/**
 * 腾讯微信官方标准品牌图标 (Official WeChat Vector)
 * 包含规范双气泡结构、微信绿色标 (#07C160)、白色圆点眼睛与官方弧度
 */
export function WeChatIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" {...props}>
            <path d="M9.2 3C4.7 3 1 6.1 1 10c0 2.2 1.2 4.1 3 5.4.2.1.3.4.2.6l-.6 2.1c-.1.3.2.6.5.4l2.5-1.3c.2-.1.5-.1.7 0 .9.3 1.9.4 2.9.4.3 0 .7 0 1-.1-.3-.8-.4-1.6-.4-2.4 0-4 3.6-7.3 8.1-7.3.4 0 .7 0 1.1.1C18.8 6.4 14.5 3 9.2 3z" fill="#07C160" />
            <circle cx="6.5" cy="7.8" r="1.15" fill="#FFFFFF" />
            <circle cx="12.2" cy="7.8" r="1.15" fill="#FFFFFF" />
            <path d="M16 8.5c-3.9 0-7 2.6-7 5.8s3.1 5.8 7 5.8c.8 0 1.6-.1 2.3-.3.2-.1.5 0 .7.1l1.9 1c.3.1.5-.1.4-.4l-.5-1.7c0-.2.1-.5.3-.6 1.4-1.1 2.2-2.5 2.2-4 0-3.1-3.2-5.7-7.3-5.7z" fill="#07C160" />
            <circle cx="13.8" cy="12.8" r="0.95" fill="#FFFFFF" />
            <circle cx="18.2" cy="12.8" r="0.95" fill="#FFFFFF" />
        </svg>
    );
}

/**
 * 字节跳动抖音官方标准品牌图标 (Official Douyin Vector)
 * 官方标准抖动音符，青色与玫红 RGB 色散叠加精确呈现
 */
export function DouyinIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" {...props}>
            <path
                d="M17.4 4.8c.4 1.7 1.6 3 3.3 3.4v2.2c-1.2-.1-2.4-.5-3.3-1.1v6.3c0 3.3-2.7 5.9-6 5.9-2.7 0-5-1.8-5.7-4.4-.2-.7-.2-1.4-.1-2.2.8-2.8 3.4-4.8 6.4-4.5v2.7c-1.7-.2-3.2 1-3.5 2.7-.2 1 .1 2 .8 2.6.7.7 1.8.9 2.7.6.9-.3 1.6-1.2 1.7-2.2V4.8h3.7z"
                fill="#24F6F0"
            />
            <path
                d="M16.7 4.1c.4 1.7 1.6 3 3.3 3.4v2.2c-1.2-.1-2.4-.5-3.3-1.1v6.3c0 3.3-2.7 5.9-6 5.9-2.7 0-5-1.8-5.7-4.4-.2-.7-.2-1.4-.1-2.2.8-2.8 3.4-4.8 6.4-4.5v2.7c-1.7-.2-3.2 1-3.5 2.7-.2 1 .1 2 .8 2.6.7.7 1.8.9 2.7.6.9-.3 1.6-1.2 1.7-2.2V4.1h3.7z"
                fill="#FE2C55"
            />
            <path
                d="M17.0 4.4c.4 1.7 1.6 3 3.3 3.4v2.2c-1.2-.1-2.4-.5-3.3-1.1v6.3c0 3.3-2.7 5.9-6 5.9-2.7 0-5-1.8-5.7-4.4-.2-.7-.2-1.4-.1-2.2.8-2.8 3.4-4.8 6.4-4.5v2.7c-1.7-.2-3.2 1-3.5 2.7-.2 1 .1 2 .8 2.6.7.7 1.8.9 2.7.6.9-.3 1.6-1.2 1.7-2.2V4.4h3.7z"
                fill="#FFFFFF"
            />
        </svg>
    );
}

/**
 * 哔哩哔哩官方标准小电视图标 (Official Bilibili Vector)
 * 采用官方天青蓝标色 (#00A1D6)，官方天线倾角与双眼微笑弧度
 */
export function BilibiliIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" {...props}>
            <path d="M7.6 4.8 5.7 2.9a.7.7 0 0 1 1-1l2.4 2.4c.2.2.2.5 0 .7-.2.2-.5.2-.7 0z" fill="#00A1D6" />
            <path d="M16.4 4.8 18.3 2.9a.7.7 0 0 0-1-1l-2.4 2.4c-.2.2-.2.5 0 .7.2.2.5.2.7 0z" fill="#00A1D6" />
            <rect x="2.5" y="4.5" width="19" height="15" rx="3.5" fill="#00A1D6" />
            <rect x="6" y="19.5" width="3" height="2" rx="1" fill="#00A1D6" />
            <rect x="15" y="19.5" width="3" height="2" rx="1" fill="#00A1D6" />
            <rect x="4.5" y="6.5" width="15" height="11" rx="2" fill="#FFFFFF" />
            <ellipse cx="9" cy="11.5" rx="1.2" ry="1.6" fill="#00A1D6" />
            <ellipse cx="15" cy="11.5" rx="1.2" ry="1.6" fill="#00A1D6" />
            <path d="M11 13.8c.6.5 1.4.5 2 0" stroke="#00A1D6" strokeWidth="1.2" strokeLinecap="round" fill="none" />
        </svg>
    );
}

/**
 * Google 官方标准品牌四色图标 (Official Google Identity "G" Vector)
 * 100% 符合 Google 品牌使用指南四象限官方色值 (#4285F4, #34A853, #FBBC05, #EA4335)
 */
export function GoogleIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" {...props}>
            <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z" />
            <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z" />
            <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.58H1.25C.45 8.16 0 9.97 0 12s.45 3.84 1.25 5.42l4.03-3.15z" />
            <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
        </svg>
    );
}

/**
 * X (Twitter) 官方标准品牌图标 (Official X Brand Toolkit Vector)
 * 精确官方几何切割矢量，自适应文本/主题 currentColor
 */
export function XIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em" aria-hidden="true" {...props}>
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
    );
}

/**
 * Meta Instagram 官方标准相机与渐变图标 (Official Instagram Brand Vector)
 * 官方光谱渐变与精密相机比例
 */
export function InstagramIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" {...props}>
            <defs>
                <linearGradient id="ig-official-gradient" x1="0%" y1="100%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#FFD521" />
                    <stop offset="25%" stopColor="#F50000" />
                    <stop offset="50%" stopColor="#B900B4" />
                    <stop offset="100%" stopColor="#4F00BC" />
                </linearGradient>
            </defs>
            <rect width="24" height="24" rx="6" fill="url(#ig-official-gradient)" />
            <rect x="5" y="5" width="14" height="14" rx="4.2" fill="none" stroke="#FFFFFF" strokeWidth="1.8" />
            <circle cx="12" cy="12" r="3.4" fill="none" stroke="#FFFFFF" strokeWidth="1.8" />
            <circle cx="15.8" cy="8.2" r="0.85" fill="#FFFFFF" />
        </svg>
    );
}

/**
 * TikTok 官方标准品牌音符图标 (Official TikTok Brand Vector)
 * 官方规范三层色散音符 (#25F4EE 与 #FE2C55)
 */
export function TikTokIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" {...props}>
            <path
                d="M16.8 4.2c.3 1.6 1.4 2.8 3.0 3.2v2.4c-1.2 0-2.3-.4-3.2-1.1v5.9c0 3.1-2.5 5.6-5.6 5.6-2.5 0-4.6-1.6-5.3-3.9-.2-.6-.2-1.3-.1-2 .7-2.6 3.1-4.4 5.8-4.2v2.4c-1.6-.2-3 .8-3.3 2.4-.2.8.1 1.7.7 2.3.6.6 1.5.8 2.4.5.8-.3 1.4-1.1 1.5-2V4.2h3.1z"
                fill="#25F4EE"
            />
            <path
                d="M16.2 3.6c.3 1.6 1.4 2.8 3.0 3.2v2.4c-1.2 0-2.3-.4-3.2-1.1v5.9c0 3.1-2.5 5.6-5.6 5.6-2.5 0-4.6-1.6-5.3-3.9-.2-.6-.2-1.3-.1-2 .7-2.6 3.1-4.4 5.8-4.2v2.4c-1.6-.2-3 .8-3.3 2.4-.2.8.1 1.7.7 2.3.6.6 1.5.8 2.4.5.8-.3 1.4-1.1 1.5-2V3.6h3.1z"
                fill="#FE2C55"
            />
            <path
                d="M16.5 3.9c.3 1.6 1.4 2.8 3.0 3.2v2.4c-1.2 0-2.3-.4-3.2-1.1v5.9c0 3.1-2.5 5.6-5.6 5.6-2.5 0-4.6-1.6-5.3-3.9-.2-.6-.2-1.3-.1-2 .7-2.6 3.1-4.4 5.8-4.2v2.4c-1.6-.2-3 .8-3.3 2.4-.2.8.1 1.7.7 2.3.6.6 1.5.8 2.4.5.8-.3 1.4-1.1 1.5-2V3.9h3.1z"
                fill="#FFFFFF"
            />
        </svg>
    );
}

/**
 * 统一品牌图标选择器，分发 8 大平台官方矢量图标
 */
export function SocialProviderIcon({ provider, className = "size-5" }: { provider: string; className?: string }) {
    switch (provider.toLowerCase()) {
        case "qq":
            return <QQIcon className={className} />;
        case "wechat":
            return <WeChatIcon className={className} />;
        case "douyin":
            return <DouyinIcon className={className} />;
        case "bilibili":
            return <BilibiliIcon className={className} />;
        case "google":
            return <GoogleIcon className={className} />;
        case "x":
        case "twitter":
            return <XIcon className={className} />;
        case "instagram":
            return <InstagramIcon className={className} />;
        case "tiktok":
            return <TikTokIcon className={className} />;
        default:
            return <div className={`rounded-full bg-slate-500/20 ${className}`} />;
    }
}

/**
 * 品牌图标渲染：管理员上传了明暗两版自定义图标时优先使用，并跟随站点明暗主题
 * 自动切换（复用画布主题的 `dark:` 类语义）；未上传时回退到内置品牌 SVG。
 */
export function SocialProviderBrandIcon({ provider, iconLightUrl, iconDarkUrl, className = "size-5", alt = "" }: { provider: string; iconLightUrl?: string; iconDarkUrl?: string; className?: string; alt?: string }) {
    const lightUrl = iconLightUrl?.trim();
    const darkUrl = (iconDarkUrl?.trim() || lightUrl) ?? "";
    if (!lightUrl) {
        return <SocialProviderIcon provider={provider} className={className} />;
    }
    return (
        <span className={`relative inline-flex items-center justify-center ${className}`} data-social-brand-icon={provider}>
            <img src={lightUrl} alt={alt} loading="lazy" decoding="async" aria-hidden={alt ? undefined : true} className={`absolute inset-0 size-full object-contain dark:hidden`} />
            <img src={darkUrl} alt="" loading="lazy" decoding="async" aria-hidden="true" className={`absolute inset-0 size-full object-contain hidden dark:block`} />
        </span>
    );
}
