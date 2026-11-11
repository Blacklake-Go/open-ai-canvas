import { useEffect, useState } from "react";
import { Alert, Button, Card, Form, Input, Typography } from "antd";
import { useTranslation } from "react-i18next";
import { i18n } from "@/i18n";
import { http } from "@/services/api/request";

const messages = {
    "zh-CN": {
        title: "连接 ONE 创作者账户",
        intro: "请核对双方账户。连接后，新创作使用主站钱包；ONE 历史积分和交易保留原值及有效期。",
        one: "ONE 账户",
        main: "主站账户",
        password: "当前主站密码",
        passwordHint: "无密码账户请先在账户安全设置完成已绑定登录方式的身份验证。",
        confirm: "验证身份并连接",
        cancel: "返回创作台",
        missing: "连接请求缺失，请从 ONE 账户页面重新发起。",
        failed: "连接失败，请重新发起或稍后重试。",
    },
    "en-US": {
        title: "Connect your ONE creator account",
        intro: "Check both accounts. New creations use the main wallet; historical ONE credits and transactions keep their original values and expiry.",
        one: "ONE account",
        main: "Main account",
        password: "Current main-site password",
        passwordHint: "If you have no password, first verify your existing sign-in method in account security settings.",
        confirm: "Verify and connect",
        cancel: "Back to create",
        missing: "The connection request is missing. Start again from your ONE account.",
        failed: "Connection failed. Start again or try later.",
    },
    "fr-FR": {
        title: "Connecter votre compte créateur ONE",
        intro: "Vérifiez les deux comptes. Les nouvelles créations utilisent le portefeuille principal ; les anciens crédits et transactions ONE conservent leur valeur et leur expiration.",
        one: "Compte ONE",
        main: "Compte principal",
        password: "Mot de passe actuel du site principal",
        passwordHint: "Sans mot de passe, vérifiez d’abord votre méthode de connexion dans les paramètres de sécurité.",
        confirm: "Vérifier et connecter",
        cancel: "Retour à la création",
        missing: "La demande manque. Recommencez depuis votre compte ONE.",
        failed: "Échec de la connexion. Recommencez ou réessayez plus tard.",
    },
    "de-DE": {
        title: "ONE-Kreativkonto verbinden",
        intro: "Prüfen Sie beide Konten. Neue Erstellungen nutzen das Hauptguthaben; bisherige ONE-Credits und Transaktionen behalten ihren Wert und Ablauf.",
        one: "ONE-Konto",
        main: "Hauptkonto",
        password: "Aktuelles Passwort der Hauptseite",
        passwordHint: "Ohne Passwort bestätigen Sie zuerst Ihre bestehende Anmeldemethode in den Sicherheitseinstellungen.",
        confirm: "Bestätigen und verbinden",
        cancel: "Zurück zur Erstellung",
        missing: "Die Anfrage fehlt. Starten Sie erneut in Ihrem ONE-Konto.",
        failed: "Verbindung fehlgeschlagen. Starten Sie erneut oder versuchen Sie es später.",
    },
    "ja-JP": {
        title: "ONE クリエイターアカウントを連携",
        intro: "両方のアカウントを確認してください。新しい作成にはメインウォレットを使用し、ONE の過去のポイントと取引は元の値と有効期限を維持します。",
        one: "ONE アカウント",
        main: "メインアカウント",
        password: "メインサイトの現在のパスワード",
        passwordHint: "パスワードがない場合は、先にセキュリティ設定で既存のログイン方法による本人確認を行ってください。",
        confirm: "本人確認して連携",
        cancel: "作成画面に戻る",
        missing: "連携リクエストがありません。ONE のアカウント画面からやり直してください。",
        failed: "連携できませんでした。やり直すか後でお試しください。",
    },
    "ko-KR": {
        title: "ONE 크리에이터 계정 연결",
        intro: "두 계정을 확인하세요. 새 창작에는 메인 지갑을 사용하며 ONE의 기존 포인트와 거래는 원래 값과 유효기간을 유지합니다.",
        one: "ONE 계정",
        main: "메인 계정",
        password: "메인 사이트 현재 비밀번호",
        passwordHint: "비밀번호가 없으면 먼저 보안 설정에서 기존 로그인 방식으로 본인 확인을 완료하세요.",
        confirm: "본인 확인 후 연결",
        cancel: "창작 화면으로 돌아가기",
        missing: "연결 요청이 없습니다. ONE 계정 화면에서 다시 시작하세요.",
        failed: "연결에 실패했습니다. 다시 시작하거나 나중에 시도하세요.",
    },
};
const loginMessages = {
    "zh-CN": { loginIntro: "使用主站账户登录 ONE。若你已有 ONE 账户，请先用原登录方式进入 ONE，再连接账户，以保留原有资产。", continueLogin: "继续登录 ONE" },
    "en-US": { loginIntro: "Sign in to ONE with your main account. If you already have a ONE account, sign in there first and connect it to retain your existing assets.", continueLogin: "Continue to ONE" },
    "fr-FR": { loginIntro: "Connectez-vous à ONE avec votre compte principal. Si vous avez déjà un compte ONE, connectez-vous-y d’abord puis associez-le pour conserver vos ressources.", continueLogin: "Continuer vers ONE" },
    "de-DE": { loginIntro: "Melden Sie sich mit Ihrem Hauptkonto bei ONE an. Besteht bereits ein ONE-Konto, melden Sie sich dort zuerst an und verbinden es, um Ihre Assets zu behalten.", continueLogin: "Weiter zu ONE" },
    "ja-JP": { loginIntro: "メインアカウントで ONE にログインします。既存の ONE アカウントがある場合は、先に元の方法でログインして連携し、既存の素材を保持してください。", continueLogin: "ONE に進む" },
    "ko-KR": { loginIntro: "메인 계정으로 ONE에 로그인합니다. 기존 ONE 계정이 있으면 먼저 기존 방식으로 로그인한 뒤 연결하여 기존 자료를 유지하세요.", continueLogin: "ONE으로 계속" },
};
for (const [locale, translation] of Object.entries(messages)) i18n.addResourceBundle(locale, "supdance-federation", { ...translation, ...loginMessages[locale as keyof typeof loginMessages] }, true, true);

export default function ConnectOnePage() {
    const { t } = useTranslation("supdance-federation");
    const [request] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get("request") || "");
    const [accounts, setAccounts] = useState<{ oneUserId: string; mainUserId: string; mainDisplayName: string; purpose: string }>();
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    useEffect(() => {
        window.history.replaceState(null, "", window.location.pathname);
        if (!request) return;
        let current = true;
        void http
            .post<typeof accounts>("/supdance/federation/link", { request })
            .then((value) => {
                if (current) setAccounts(value);
            })
            .catch((reason: unknown) => {
                if (current) setError(reason instanceof Error ? reason.message : t("failed"));
            });
        return () => {
            current = false;
        };
    }, [request, t]);
    async function confirm(values: { password?: string }) {
        setBusy(true);
        setError("");
        try {
            const result = await http.post<{ assertion: string }>("/supdance/federation/link", { request, password: values.password || "", confirm: true });
            const form = document.createElement("form");
            form.method = "POST";
            form.action = accounts?.purpose === "login-request" ? "https://one.supdance.com/api/federation/login/complete" : "https://one.supdance.com/api/federation/link/complete";
            const input = document.createElement("input");
            input.type = "hidden";
            input.name = "assertion";
            input.value = result.assertion;
            form.append(input);
            document.body.append(form);
            form.submit();
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : t("failed"));
            setBusy(false);
        }
    }
    return (
        <main className="mx-auto w-full max-w-xl p-4 sm:p-6">
            <Card title={t("title")}>
                <Typography.Paragraph>{t(accounts?.purpose === "login-request" ? "loginIntro" : "intro")}</Typography.Paragraph>
                {error && <Alert type="error" title={error} showIcon className="mb-4" />}
                {!request && <Alert type="warning" title={t("missing")} showIcon />}
                {accounts && (
                    <>
                        {accounts.purpose !== "login-request" && (
                            <Typography.Paragraph>
                                {t("one")}: <Typography.Text code>{accounts.oneUserId}</Typography.Text>
                            </Typography.Paragraph>
                        )}
                        <Typography.Paragraph>
                            {t("main")}: {accounts.mainDisplayName} <Typography.Text code>{accounts.mainUserId}</Typography.Text>
                        </Typography.Paragraph>
                        <Form layout="vertical" onFinish={confirm}>
                            {accounts.purpose !== "login-request" && (
                                <Form.Item label={t("password")} name="password" extra={t("passwordHint")}>
                                    <Input.Password autoComplete="current-password" maxLength={200} />
                                </Form.Item>
                            )}
                            <Button type="primary" htmlType="submit" loading={busy} block>
                                {t(accounts.purpose === "login-request" ? "continueLogin" : "confirm")}
                            </Button>
                        </Form>
                    </>
                )}
                <Button href="/" type="link" className="mt-4">
                    {t("cancel")}
                </Button>
            </Card>
        </main>
    );
}
