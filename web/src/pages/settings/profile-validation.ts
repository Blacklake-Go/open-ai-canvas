export const PROFILE_AVATAR_MAX_BYTES = 5 * 1024 * 1024;

export function profileAvatarError(file: Pick<File, "type" | "size">, t?: (key: string, params?: any, fallback?: string) => string): string | undefined {
    if (file.type !== "image/png" && file.type !== "image/jpeg") return t ? t("settings.err_avatar_format", undefined, "请选择 PNG 或 JPEG 图片") : "请选择 PNG 或 JPEG 图片";
    if (!file.size) return t ? t("settings.err_avatar_empty", undefined, "图片文件不能为空") : "图片文件不能为空";
    if (file.size > PROFILE_AVATAR_MAX_BYTES) return t ? t("settings.err_avatar_size", undefined, "图片大小不能超过 5 MB") : "图片大小不能超过 5 MB";
}

export function profilePasswordError(password: string, t?: (key: string, params?: any, fallback?: string) => string): string | undefined {
    if ([...password].length < 8) return t ? t("settings.err_password_len", undefined, "密码至少需要 8 个字符") : "密码至少需要 8 个字符";
    if (new TextEncoder().encode(password).length > 72) return t ? t("settings.err_password_bytes", undefined, "密码不能超过 72 字节，请缩短密码") : "密码不能超过 72 字节，请缩短密码";
}

export function profileSecondsRemaining(until: number, now: number): number {
    return Math.max(0, Math.ceil((until - now) / 1000));
}

export function profileReauthReady(until: string | undefined, now: number): boolean {
    return !!until && Date.parse(until) > now;
}
