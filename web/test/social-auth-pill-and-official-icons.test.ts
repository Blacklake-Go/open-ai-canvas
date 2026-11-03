import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const webRoot = resolve(import.meta.dir, "..");

describe("三方登录药丸按钮与官网标准图标规范 (Pill-shaped Buttons & Official Brand SVGs)", () => {
    test("8 大社交渠道图标均升级为官方标准矢量几何与官方标准色值", () => {
        const iconSrc = readFileSync(resolve(webRoot, "src/supdance/plugins/social-auth/components/social-provider-icons.tsx"), "utf-8");

        // QQ: 腾讯官方标准企鹅 (黑白腹、黄脚 #FFAA00、标志性红围巾 #EB1923)
        expect(iconSrc).toContain('fill="#EB1923"');
        expect(iconSrc).toContain('fill="#FFAA00"');
        expect(iconSrc).toContain("QQIcon");

        // WeChat: 腾讯官方标准双气泡 (官方绿色 #07C160)
        expect(iconSrc).toContain('fill="#07C160"');
        expect(iconSrc).toContain("WeChatIcon");

        // Douyin: 字节跳动官方标准抖动音符 (青色 #24F6F0, 红色 #FE2C55, 白色主体)
        expect(iconSrc).toContain('fill="#24F6F0"');
        expect(iconSrc).toContain('fill="#FE2C55"');
        expect(iconSrc).toContain("DouyinIcon");

        // Bilibili: 官方标准小电视天线与屏幕 (#00A1D6)
        expect(iconSrc).toContain('fill="#00A1D6"');
        expect(iconSrc).toContain("BilibiliIcon");

        // Google: Google Identity 官方四色 G 标 (#4285F4, #34A853, #FBBC05, #EA4335)
        expect(iconSrc).toContain('fill="#4285F4"');
        expect(iconSrc).toContain('fill="#34A853"');
        expect(iconSrc).toContain('fill="#FBBC05"');
        expect(iconSrc).toContain('fill="#EA4335"');
        expect(iconSrc).toContain("GoogleIcon");

        // X: 官方几何 X 矢量路径
        expect(iconSrc).toContain("M18.244 2.25h3.308");
        expect(iconSrc).toContain("XIcon");

        // Instagram: 官方光谱渐变 (#FFD521 -> #F50000 -> #B900B4 -> #4F00BC) 与相机圆环
        expect(iconSrc).toContain("ig-official-gradient");
        expect(iconSrc).toContain("InstagramIcon");

        // TikTok: 官方音符双色色散 (#25F4EE 与 #FE2C55)
        expect(iconSrc).toContain('fill="#25F4EE"');
        expect(iconSrc).toContain("TikTokIcon");
    });

    test("SocialLoginButtons 严格遵循药丸胶囊 (rounded-full) 与 44px 黄金交互高度规范", () => {
        const btnSrc = readFileSync(resolve(webRoot, "src/supdance/plugins/social-auth/components/social-login-buttons.tsx"), "utf-8");

        // 必须具备完全圆角药丸属性 (rounded-full)
        expect(btnSrc).toContain("rounded-full");
        // 必须具备 44px 触控高度 (h-11)
        expect(btnSrc).toContain("h-11");
        // 必须具备内边距 px-5
        expect(btnSrc).toContain("px-5");
        // 必须具备交互动效与无障碍焦点环
        expect(btnSrc).toContain("focus-visible:ring-");
        expect(btnSrc).toContain("active:scale-[0.98]");
        expect(btnSrc).toContain("group-hover:scale-110");
    });

    test("主站卡片登录页 (login.tsx) 与注册页 (register.tsx) 实现分割线与三方登录联动防悬空", () => {
        const loginSrc = readFileSync(resolve(webRoot, "src/pages/auth/login.tsx"), "utf-8");
        const regSrc = readFileSync(resolve(webRoot, "src/pages/auth/register.tsx"), "utf-8");

        // login.tsx 必须受控于 hasSocialProviders 状态
        expect(loginSrc).toContain("hasSocialProviders");
        expect(loginSrc).toContain("onProvidersChange={(providers) => setHasSocialProviders(providers.length > 0)}");

        // register.tsx 必须受控于 hasSocialProviders 状态
        expect(regSrc).toContain("hasSocialProviders");
        expect(regSrc).toContain("onProvidersChange={(providers) => setHasSocialProviders(providers.length > 0)}");
    });
});
