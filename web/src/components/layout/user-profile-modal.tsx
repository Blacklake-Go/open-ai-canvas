import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { App, Button, Form, Input, Skeleton, Tooltip } from "antd";
import { Camera, CheckCircle2, Eye, EyeOff, Globe, KeyRound, Link2, Lock, Mail, Moon, Shield, ShieldCheck, SlidersHorizontal, Sparkles, Sun, Upload, User, UserRound, X } from "lucide-react";

import { AppModal } from "@/components/ui/product/app-modal";
import { Switch } from "@/components/ui/base/switch";
import { UserAvatar } from "@/components/layout/user-avatar";
import { UserGroupBadge } from "@/components/layout/user-group-badge";
import { DEFAULT_USER_AVATARS } from "@/lib/default-user-avatars";
import { applyUserSession } from "@/lib/user-session";
import { changeProfileEmail, changeProfilePassword, getUserProfile, requestProfileEmailCode, selectDefaultProfileAvatar, uploadProfileAvatar, type UserProfile } from "@/services/api/profile";
import { useAppearanceStore } from "@/stores/use-appearance-store";
import { useThemeStore } from "@/stores/use-theme-store";
import { useUserStore } from "@/stores/use-user-store";
import { useUserProfileModalStore, type UserProfileModalTab, USER_PROFILE_MODAL_EVENT } from "@/stores/use-user-profile-modal-store";
import { SocialAccountBindings } from "@/supdance/plugins/social-auth/components/social-account-bindings";
import { useSupDanceI18nStore } from "@/supdance/plugins/i18n/store";

export function UserProfileModalHost() {
    const isOpen = useUserProfileModalStore((state) => state.isOpen);
    const activeTab = useUserProfileModalStore((state) => state.activeTab);
    const setTab = useUserProfileModalStore((state) => state.setTab);
    const closeModal = useUserProfileModalStore((state) => state.closeModal);
    const openModal = useUserProfileModalStore((state) => state.openModal);
    const currentUser = useUserStore((state) => state.user);

    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            openModal(detail?.tab || "profile");
        };
        window.addEventListener(USER_PROFILE_MODAL_EVENT, handler);
        return () => window.removeEventListener(USER_PROFILE_MODAL_EVENT, handler);
    }, [openModal]);

    if (!currentUser) return null;

    return <UserProfileModal open={isOpen} activeTab={activeTab} onTabChange={setTab} onClose={closeModal} />;
}

interface UserProfileModalProps {
    open: boolean;
    activeTab: UserProfileModalTab;
    onTabChange: (tab: UserProfileModalTab) => void;
    onClose: () => void;
}

export function UserProfileModal({ open, activeTab, onTabChange, onClose }: UserProfileModalProps) {
    const { message } = App.useApp();
    const currentUser = useUserStore((state) => state.user);
    const theme = useThemeStore((state) => state.theme);
    const setTheme = useThemeStore((state) => state.setTheme);

    // i18n store integration
    const i18nLocale = useSupDanceI18nStore((state) => state.locale);
    const setI18nLocale = useSupDanceI18nStore((state) => state.setLocale);
    const i18nSettings = useSupDanceI18nStore((state) => state.settings);

    // Profile state from server
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loadingProfile, setLoadingProfile] = useState(false);

    // Avatar upload
    const avatarInputRef = useRef<HTMLInputElement>(null);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);

    // Password change
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmNewPassword, setConfirmNewPassword] = useState("");
    const [showPass, setShowPass] = useState(false);
    const [changingPassword, setChangingPassword] = useState(false);

    // Email change / bind
    const [newEmail, setNewEmail] = useState("");
    const [emailVerifyCode, setEmailVerifyCode] = useState("");
    const [emailCurrentPass, setEmailCurrentPass] = useState("");
    const [emailTicket, setEmailTicket] = useState<{ ticket: string; expiresIn: number } | null>(null);
    const [sendingCode, setSendingCode] = useState(false);
    const [bindingEmail, setBindingEmail] = useState(false);
    const [countdown, setCountdown] = useState(0);

    // Countdown timer for email verification code
    useEffect(() => {
        if (countdown <= 0) return;
        const timer = setInterval(() => {
            setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(timer);
    }, [countdown]);

    // Load full profile details whenever modal opens
    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        setLoadingProfile(true);

        getUserProfile()
            .then((data) => {
                if (!cancelled) setProfile(data);
            })
            .catch((err) => {
                console.warn("加载个人资料失败", err);
            })
            .finally(() => {
                if (!cancelled) setLoadingProfile(false);
            });

        return () => {
            cancelled = true;
        };
    }, [open]);

    // Avatar upload handler
    const handleAvatarFileSelected = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            message.warning("请选择图片格式的文件 (PNG, JPG, WebP)");
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            message.warning("头像图片大小不得超过 5MB");
            return;
        }

        try {
            setUploadingAvatar(true);
            const res = await uploadProfileAvatar(file);
            if (res.user) {
                await applyUserSession({ user: res.user });
                message.success("头像更新成功");
            }
        } catch (err) {
            message.error(err instanceof Error ? err.message : "头像上传失败");
        } finally {
            setUploadingAvatar(false);
            if (avatarInputRef.current) avatarInputRef.current.value = "";
        }
    };

    // Preset avatar selection
    const handleSelectPresetAvatar = async (preset: string) => {
        try {
            setUploadingAvatar(true);
            const res = await selectDefaultProfileAvatar(preset);
            if (res.user) {
                await applyUserSession({ user: res.user });
                message.success("已切换为预设头像");
            }
        } catch (err) {
            message.error(err instanceof Error ? err.message : "切换预设头像失败");
        } finally {
            setUploadingAvatar(false);
        }
    };

    // Password submit
    const handleChangePassword = async () => {
        if (!currentPassword && profile?.hasPassword) {
            message.warning("请输入当前密码");
            return;
        }
        if (newPassword.length < 6) {
            message.warning("新密码长度至少需要 6 个字符");
            return;
        }
        if (newPassword !== confirmNewPassword) {
            message.warning("两次输入的新密码不一致");
            return;
        }

        try {
            setChangingPassword(true);
            await changeProfilePassword({
                currentPassword,
                newPassword,
            });
            message.success("密码修改成功，请牢记您的新密码");
            setCurrentPassword("");
            setNewPassword("");
            setConfirmNewPassword("");
            if (profile) setProfile({ ...profile, hasPassword: true });
        } catch (err) {
            message.error(err instanceof Error ? err.message : "修改密码失败");
        } finally {
            setChangingPassword(false);
        }
    };

    // Request email code
    const handleSendEmailCode = async () => {
        if (!newEmail || !newEmail.includes("@")) {
            message.warning("请输入合法的邮箱地址");
            return;
        }
        if (profile?.hasPassword && !emailCurrentPass) {
            message.warning("请输入当前账号登录密码以验证身份");
            return;
        }

        try {
            setSendingCode(true);
            const ticketRes = await requestProfileEmailCode({
                email: newEmail.trim(),
                currentPassword: emailCurrentPass,
            });
            setEmailTicket(ticketRes);
            setCountdown(ticketRes.retryAfter || 60);
            message.success("验证码已发送至该邮箱，请查收");
        } catch (err) {
            message.error(err instanceof Error ? err.message : "发送验证码失败");
        } finally {
            setSendingCode(false);
        }
    };

    // Submit email change
    const handleBindEmail = async () => {
        if (!emailTicket) {
            message.warning("请先获取邮箱验证码");
            return;
        }
        if (!emailVerifyCode) {
            message.warning("请输入 6 位数字验证码");
            return;
        }

        try {
            setBindingEmail(true);
            await changeProfileEmail({
                ticket: emailTicket.ticket,
                emailCode: emailVerifyCode.trim(),
                currentPassword: emailCurrentPass,
            });
            message.success("邮箱绑定 / 更新成功！");
            setNewEmail("");
            setEmailVerifyCode("");
            setEmailCurrentPass("");
            setEmailTicket(null);
            // Refresh user profile
            const updated = await getUserProfile();
            setProfile(updated);
            if (updated.user) await applyUserSession({ user: updated.user });
        } catch (err) {
            message.error(err instanceof Error ? err.message : "邮箱绑定失败");
        } finally {
            setBindingEmail(false);
        }
    };

    const tabs: Array<{
        key: UserProfileModalTab;
        label: string;
        sublabel: string;
        icon: React.ReactNode;
    }> = [
        {
            key: "profile",
            label: "基本资料",
            sublabel: "昵称、头像与身份",
            icon: <User className="size-4" />,
        },
        {
            key: "security",
            label: "密码与安全",
            sublabel: "登录密码与邮箱管理",
            icon: <ShieldCheck className="size-4" />,
        },
        {
            key: "social",
            label: "第三方账号",
            sublabel: "社交授权绑定与换绑",
            icon: <Link2 className="size-4" />,
        },
        {
            key: "preferences",
            label: "个性偏好",
            sublabel: "深浅外观与语言界面",
            icon: <SlidersHorizontal className="size-4" />,
        },
    ];

    return (
        <AppModal open={open} flush closable={false} footer={null} width={860} centered onCancel={onClose}>
            <div
                className="relative flex h-[620px] w-full overflow-hidden rounded-2xl border border-white/10 text-foreground shadow-2xl backdrop-blur-2xl"
                style={{
                    backgroundColor: "#0e1117",
                    backgroundImage: "radial-gradient(ellipse 70% 40% at 70% -10%, rgba(0, 245, 212, 0.12), transparent)",
                }}
            >
                {/* Left Navigation Sidebar */}
                <aside className="flex w-60 shrink-0 flex-col border-r border-white/10 bg-white/[0.02] p-4">
                    {/* Header branding */}
                    <div className="mb-6 flex items-center gap-2.5 px-2 pt-1">
                        <div className="flex size-8 items-center justify-center rounded-xl bg-[#00f5d4]/10 text-[#00f5d4] ring-1 ring-[#00f5d4]/20">
                            <Sparkles className="size-4" />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-white">个人中心</h3>
                            <p className="text-[10px] text-foreground/45">SupDance Studio</p>
                        </div>
                    </div>

                    {/* Nav tabs */}
                    <nav className="flex-1 space-y-1.5" aria-label="个人中心导航">
                        {tabs.map((tab) => {
                            const isActive = activeTab === tab.key;
                            return (
                                <button
                                    key={tab.key}
                                    type="button"
                                    onClick={() => onTabChange(tab.key)}
                                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all ${
                                        isActive ? "border border-[#00f5d4]/30 bg-[#00f5d4]/10 text-[#00f5d4] shadow-sm" : "border border-transparent text-foreground/60 hover:bg-white/[0.04] hover:text-white"
                                    }`}
                                >
                                    <span className={isActive ? "text-[#00f5d4]" : "text-foreground/40"}>{tab.icon}</span>
                                    <div className="min-w-0 flex-1">
                                        <div className="text-xs font-medium leading-none">{tab.label}</div>
                                        <div className="mt-1 truncate text-[10px] text-foreground/40 leading-none">{tab.sublabel}</div>
                                    </div>
                                    {isActive && <span className="size-1.5 rounded-full bg-[#00f5d4]" />}
                                </button>
                            );
                        })}
                    </nav>

                    {/* Footer user identity mini card */}
                    <div className="mt-auto border-t border-white/10 pt-3">
                        <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl bg-white/[0.02]">
                            {currentUser && <UserAvatar user={currentUser} className="size-8 shrink-0 rounded-full" />}
                            <div className="min-w-0 flex-1">
                                <div className="truncate text-xs font-semibold text-white">{currentUser?.displayName || currentUser?.username}</div>
                                <div className="truncate text-[10px] text-foreground/40">@{currentUser?.username}</div>
                            </div>
                        </div>
                    </div>
                </aside>

                {/* Right Content Pane */}
                <main className="flex flex-1 flex-col overflow-hidden">
                    {/* Header bar with title and close button */}
                    <header className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 px-6">
                        <div>
                            <h2 className="text-base font-semibold text-white">{tabs.find((t) => t.key === activeTab)?.label}</h2>
                            <p className="text-xs text-foreground/50">{tabs.find((t) => t.key === activeTab)?.sublabel}</p>
                        </div>
                        <button type="button" onClick={onClose} className="flex size-8 items-center justify-center rounded-lg text-foreground/40 transition-colors hover:bg-white/10 hover:text-white" aria-label="关闭">
                            <X className="size-4" />
                        </button>
                    </header>

                    {/* Tab Body */}
                    <div className="flex-1 overflow-y-auto p-6">
                        {loadingProfile && !profile ? (
                            <div className="space-y-4">
                                <Skeleton active paragraph={{ rows: 5 }} />
                            </div>
                        ) : (
                            <>
                                {/* TAB 1: PROFILE */}
                                {activeTab === "profile" && (
                                    <div className="space-y-6">
                                        {/* Avatar configuration */}
                                        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                                            <div className="mb-3 text-xs font-semibold text-white">头像设置</div>
                                            <div className="flex items-center gap-5">
                                                <div className="relative group size-16 shrink-0">
                                                    {currentUser && <UserAvatar user={currentUser} className="size-16 rounded-full border-2 border-white/10 object-cover" />}
                                                    <button
                                                        type="button"
                                                        onClick={() => avatarInputRef.current?.click()}
                                                        className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60 opacity-0 transition-opacity group-hover:opacity-100 text-white"
                                                    >
                                                        <Camera className="size-5" />
                                                    </button>
                                                </div>

                                                <div className="space-y-1.5 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            size="small"
                                                            icon={<Upload className="size-3.5" />}
                                                            loading={uploadingAvatar}
                                                            onClick={() => avatarInputRef.current?.click()}
                                                            className="h-8 rounded-lg border-white/10 text-xs text-white hover:!border-white/30"
                                                        >
                                                            上传新头像
                                                        </Button>
                                                        <input ref={avatarInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleAvatarFileSelected} />
                                                    </div>
                                                    <p className="text-[11px] text-foreground/45">支持 JPG, PNG, WebP 格式，文件大小不超过 5MB</p>
                                                </div>
                                            </div>

                                            {/* Preset avatars */}
                                            <div className="mt-4 pt-3 border-t border-white/5">
                                                <div className="mb-2 text-[11px] text-foreground/50">使用预设创作形象:</div>
                                                <div className="flex flex-wrap gap-2">
                                                    {DEFAULT_USER_AVATARS.map((preset) => (
                                                        <button
                                                            key={preset.id}
                                                            type="button"
                                                            onClick={() => handleSelectPresetAvatar(preset.id)}
                                                            className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-foreground/70 hover:border-[#00f5d4]/40 hover:text-white"
                                                        >
                                                            {preset.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Account identity details */}
                                        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-4">
                                            <div className="text-xs font-semibold text-white">身份信息</div>
                                            <div className="grid grid-cols-2 gap-4 text-xs">
                                                <div>
                                                    <span className="text-foreground/40 block mb-1">创作者 ID</span>
                                                    <div className="font-mono text-white/90 bg-white/[0.03] px-3 py-2 rounded-lg border border-white/5">@{currentUser?.username}</div>
                                                </div>

                                                <div>
                                                    <span className="text-foreground/40 block mb-1">显示昵称</span>
                                                    <div className="text-white/90 bg-white/[0.03] px-3 py-2 rounded-lg border border-white/5">{currentUser?.displayName || currentUser?.username}</div>
                                                </div>

                                                <div>
                                                    <span className="text-foreground/40 block mb-1">账号角色</span>
                                                    <div className="flex items-center gap-2 bg-white/[0.03] px-3 py-2 rounded-lg border border-white/5">
                                                        <span className="text-white">{currentUser?.role === "admin" ? "平台管理员" : "创作者"}</span>
                                                        <UserGroupBadge />
                                                    </div>
                                                </div>

                                                <div>
                                                    <span className="text-foreground/40 block mb-1">系统 UID</span>
                                                    <div className="font-mono text-foreground/60 bg-white/[0.03] px-3 py-2 rounded-lg border border-white/5 truncate">{currentUser?.id}</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* TAB 2: SECURITY */}
                                {activeTab === "security" && (
                                    <div className="space-y-6">
                                        {/* Change Password Card */}
                                        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <KeyRound className="size-4 text-[#00f5d4]" />
                                                    <span className="text-xs font-semibold text-white">{profile?.hasPassword ? "修改独立登录密码" : "设置独立登录密码"}</span>
                                                </div>
                                                {!profile?.hasPassword && <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-400">尚未设置独立密码</span>}
                                            </div>
                                            <p className="text-[11px] text-foreground/50">设置独立密码后，可直接使用账号/邮箱配合密码登录，且支持解绑第三方快捷登录。</p>

                                            <div className="space-y-2.5 pt-1">
                                                {profile?.hasPassword && (
                                                    <Input
                                                        type={showPass ? "text" : "password"}
                                                        value={currentPassword}
                                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                                        placeholder="请输入当前密码"
                                                        prefix={<Lock className="size-3.5 text-foreground/40" />}
                                                        className="h-9 rounded-lg border-white/10 bg-white/[0.03] text-xs text-white"
                                                    />
                                                )}

                                                <Input
                                                    type={showPass ? "text" : "password"}
                                                    value={newPassword}
                                                    onChange={(e) => setNewPassword(e.target.value)}
                                                    placeholder="请输入新密码（至少 6 位）"
                                                    prefix={<KeyRound className="size-3.5 text-foreground/40" />}
                                                    className="h-9 rounded-lg border-white/10 bg-white/[0.03] text-xs text-white"
                                                />

                                                <Input
                                                    type={showPass ? "text" : "password"}
                                                    value={confirmNewPassword}
                                                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                                                    placeholder="再次输入新密码"
                                                    prefix={<KeyRound className="size-3.5 text-foreground/40" />}
                                                    className="h-9 rounded-lg border-white/10 bg-white/[0.03] text-xs text-white"
                                                />

                                                <div className="flex items-center justify-between pt-1">
                                                    <button type="button" onClick={() => setShowPass(!showPass)} className="flex items-center gap-1 text-[11px] text-foreground/50 hover:text-white">
                                                        {showPass ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                                                        <span>{showPass ? "隐藏明文" : "显示明文"}</span>
                                                    </button>

                                                    <Button
                                                        type="primary"
                                                        size="small"
                                                        loading={changingPassword}
                                                        disabled={!newPassword || newPassword !== confirmNewPassword}
                                                        onClick={handleChangePassword}
                                                        className="h-8 rounded-lg bg-[#00f5d4] text-xs font-semibold text-[#0e1117] hover:!bg-[#00f5d4]/90"
                                                    >
                                                        保存密码
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Bind / Change Email Card */}
                                        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Mail className="size-4 text-[#00f5d4]" />
                                                    <span className="text-xs font-semibold text-white">绑定与安全邮箱</span>
                                                </div>
                                                {currentUser?.email ? (
                                                    <span className="flex items-center gap-1 rounded-full bg-[#00f5d4]/10 px-2 py-0.5 text-[10px] text-[#00f5d4]">
                                                        <ShieldCheck className="size-3" /> 已绑定
                                                    </span>
                                                ) : (
                                                    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-400">未绑定</span>
                                                )}
                                            </div>

                                            {currentUser?.email ? (
                                                <div className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2 text-xs text-white/90">
                                                    当前绑定邮箱: <strong className="text-white">{currentUser.email}</strong>
                                                </div>
                                            ) : (
                                                <p className="text-[11px] text-foreground/50">绑定邮箱后可用于账号找回、接收安全与任务完成通知。</p>
                                            )}

                                            <div className="space-y-2.5 pt-1">
                                                {profile?.hasPassword && (
                                                    <Input
                                                        type="password"
                                                        value={emailCurrentPass}
                                                        onChange={(e) => setEmailCurrentPass(e.target.value)}
                                                        placeholder="请输入当前账号密码验证身份"
                                                        prefix={<Lock className="size-3.5 text-foreground/40" />}
                                                        className="h-9 rounded-lg border-white/10 bg-white/[0.03] text-xs text-white"
                                                    />
                                                )}

                                                <div className="flex gap-2">
                                                    <Input
                                                        value={newEmail}
                                                        onChange={(e) => setNewEmail(e.target.value)}
                                                        placeholder="输入新邮箱地址"
                                                        prefix={<Mail className="size-3.5 text-foreground/40" />}
                                                        className="h-9 rounded-lg border-white/10 bg-white/[0.03] text-xs text-white"
                                                    />
                                                    <Button
                                                        size="small"
                                                        loading={sendingCode}
                                                        disabled={countdown > 0 || !newEmail}
                                                        onClick={handleSendEmailCode}
                                                        className="h-9 shrink-0 rounded-lg border-white/10 text-xs text-white hover:!border-white/30"
                                                    >
                                                        {countdown > 0 ? `${countdown}s 后重新发送` : "获取验证码"}
                                                    </Button>
                                                </div>

                                                {emailTicket && (
                                                    <div className="flex gap-2">
                                                        <Input value={emailVerifyCode} onChange={(e) => setEmailVerifyCode(e.target.value)} placeholder="输入 6 位邮件验证码" className="h-9 rounded-lg border-white/10 bg-white/[0.03] text-xs text-white" />
                                                        <Button type="primary" size="small" loading={bindingEmail} onClick={handleBindEmail} className="h-9 shrink-0 rounded-lg bg-[#00f5d4] text-xs font-semibold text-[#0e1117] hover:!bg-[#00f5d4]/90">
                                                            确认绑定
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* TAB 3: SOCIAL ACCOUNTS */}
                                {activeTab === "social" && <SocialAccountBindings onNavigateSecurity={() => onTabChange("security")} />}

                                {/* TAB 4: PREFERENCES */}
                                {activeTab === "preferences" && (
                                    <div className="space-y-6">
                                        {/* Dark / Light Theme */}
                                        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="flex size-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04]">
                                                    {theme === "dark" ? <Moon className="size-4 text-[#00f5d4]" /> : <Sun className="size-4 text-amber-400" />}
                                                </div>
                                                <div>
                                                    <div className="text-xs font-semibold text-white">深色模式</div>
                                                    <div className="text-[11px] text-foreground/50">适配影视创作者工作台的专业暗色调视觉</div>
                                                </div>
                                            </div>
                                            <Switch size="sm" checked={theme === "dark"} onChange={(checked) => setTheme(checked ? "dark" : "light")} aria-label="深色模式切换" />
                                        </div>

                                        {/* i18n Language Settings */}
                                        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
                                            <div className="flex items-center gap-3">
                                                <div className="flex size-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04]">
                                                    <Globe className="size-4 text-[#00f5d4]" />
                                                </div>
                                                <div>
                                                    <div className="text-xs font-semibold text-white">界面语言</div>
                                                    <div className="text-[11px] text-foreground/50">切换 SupDance 系统显示的语言种类</div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2 pt-1">
                                                {i18nSettings.languages
                                                    .filter((lang: any) => lang.enabled)
                                                    .map((lang: any) => {
                                                        const isSelected = i18nLocale === lang.code;
                                                        return (
                                                            <button
                                                                key={lang.code}
                                                                type="button"
                                                                onClick={() => {
                                                                    setI18nLocale(lang.code as any);
                                                                    message.success(`已切换为 ${lang.name}`);
                                                                }}
                                                                className={`flex items-center justify-between rounded-xl border p-3 text-left transition-all ${
                                                                    isSelected ? "border-[#00f5d4]/40 bg-[#00f5d4]/10 text-[#00f5d4]" : "border-white/5 bg-white/[0.02] text-foreground/70 hover:border-white/15 hover:text-white"
                                                                }`}
                                                            >
                                                                <span className="text-xs font-medium">{lang.name}</span>
                                                                {isSelected && <CheckCircle2 className="size-4 text-[#00f5d4]" />}
                                                            </button>
                                                        );
                                                    })}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </main>
            </div>
        </AppModal>
    );
}
