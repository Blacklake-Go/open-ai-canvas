import type { SupDanceI18nEntry } from "../types";
const definitions = [
    ["title", "连接 ONE 创作者账户", "Connect your ONE creator account", "連接 ONE 創作者帳戶", "ONE クリエイターアカウントを連携", "ONE 크리에이터 계정 연결", "Conectar tu cuenta de creador ONE"],
    [
        "intro",
        "请核对双方账户。连接后，新创作使用主站钱包；ONE 历史积分和交易保留原值及有效期。",
        "Check both accounts. New creations use the main wallet; historical ONE credits and transactions retain their value and expiry.",
        "請核對雙方帳戶。連接後，新創作使用主站錢包；ONE 歷史積分與交易保留原值和有效期。",
        "両方のアカウントを確認してください。新規作成にはメインウォレットを使用し、ONE の過去のポイントと取引は元の値と有効期限を維持します。",
        "두 계정을 확인하세요. 새 창작에는 메인 지갑을 사용하며 ONE의 기존 포인트와 거래는 원래 값과 유효기간을 유지합니다.",
        "Comprueba ambas cuentas. Las nuevas creaciones usan la cartera principal; los créditos y las transacciones anteriores de ONE conservan su valor y vencimiento.",
    ],
    ["one", "ONE 账户", "ONE account", "ONE 帳戶", "ONE アカウント", "ONE 계정", "Cuenta ONE"],
    ["main", "主站账户", "Main account", "主站帳戶", "メインアカウント", "메인 계정", "Cuenta principal"],
    ["password", "当前主站密码", "Current main-site password", "目前主站密碼", "メインサイトの現在のパスワード", "메인 사이트 현재 비밀번호", "Contraseña actual del sitio principal"],
    [
        "passwordHint",
        "无密码账户请先在账户安全设置完成已绑定登录方式的身份验证。",
        "Without a password, first verify an existing sign-in method in account security settings.",
        "無密碼帳戶請先在安全設定完成既有登入方式的身分驗證。",
        "パスワードがない場合は、先にセキュリティ設定で既存のログイン方法による本人確認を行ってください。",
        "비밀번호가 없으면 먼저 보안 설정에서 기존 로그인 방식으로 본인 확인을 완료하세요.",
        "Si no tienes contraseña, verifica primero un método de acceso existente en la configuración de seguridad.",
    ],
    ["confirm", "验证身份并连接", "Verify and connect", "驗證身分並連接", "本人確認して連携", "본인 확인 후 연결", "Verificar y conectar"],
    ["cancel", "返回创作台", "Back to create", "返回創作台", "作成画面に戻る", "창작 화면으로 돌아가기", "Volver a crear"],
    [
        "missing",
        "连接请求缺失，请从 ONE 账户页面重新发起。",
        "The connection request is missing. Start again from your ONE account.",
        "缺少連接請求，請從 ONE 帳戶頁重新發起。",
        "連携リクエストがありません。ONE からやり直してください。",
        "연결 요청이 없습니다. ONE 계정 화면에서 다시 시작하세요.",
        "Falta la solicitud de conexión. Iníciala de nuevo desde ONE.",
    ],
    [
        "failed",
        "连接失败，请重新发起或稍后重试。",
        "Connection failed. Start again or try later.",
        "連接失敗，請重新發起或稍後重試。",
        "連携できませんでした。やり直すか後でお試しください。",
        "연결에 실패했습니다. 다시 시작하거나 나중에 시도하세요.",
        "No se pudo conectar. Inicia otra solicitud o inténtalo más tarde.",
    ],
    [
        "loginIntro",
        "使用主站账户登录 ONE。已有 ONE 账户请先用原方式登录，再连接账户以保留资产。",
        "Sign in to ONE with your main account. If you already have a ONE account, sign in there first and connect it to retain your assets.",
        "使用主站帳戶登入 ONE。已有 ONE 帳戶請先用原方式登入，再連接帳戶以保留資產。",
        "メインアカウントで ONE にログインします。既存の ONE アカウントがある場合は、先に元の方法でログインして連携し、素材を保持してください。",
        "메인 계정으로 ONE에 로그인합니다. 기존 ONE 계정이 있으면 먼저 기존 방식으로 로그인한 뒤 연결하여 자료를 유지하세요.",
        "Accede a ONE con tu cuenta principal. Si ya tienes una cuenta ONE, accede primero allí y conéctala para conservar tus archivos.",
    ],
    ["continueLogin", "继续登录 ONE", "Continue to ONE", "繼續登入 ONE", "ONE に進む", "ONE으로 계속", "Continuar a ONE"],
    [
        "handoff",
        "来自 ONE 的社区提示词；添加后请核对模型、设置和费用。",
        "A community prompt from ONE. Review the model, settings and price before creating.",
        "來自 ONE 的社區提示詞；新增後請核對模型、設定和費用。",
        "ONE のコミュニティプロンプトです。作成前にモデル、設定、料金をご確認ください。",
        "ONE 커뮤니티 프롬프트입니다. 생성 전에 모델, 설정, 요금을 확인하세요.",
        "Una indicación de la comunidad ONE. Revisa el modelo, la configuración y el precio antes de crear.",
    ],
    ["append", "添加到当前提示词", "Add to current prompt", "新增至目前提示詞", "現在のプロンプトに追加", "현재 프롬프트에 추가", "Añadir a la indicación actual"],
] as const;
const nativeTranslations: Record<string, Record<string, string>> = {
    title: {
        "fr-FR": "Connecter votre compte créateur ONE",
        "de-DE": "ONE-Kreativkonto verbinden",
    },
    intro: {
        "fr-FR": "Vérifiez les deux comptes. Les nouvelles créations utilisent le portefeuille principal ; les anciens crédits et transactions ONE conservent leur valeur et leur expiration.",
        "de-DE": "Prüfen Sie beide Konten. Neue Erstellungen nutzen das Hauptguthaben; bisherige ONE-Credits und Transaktionen behalten ihren Wert und Ablauf.",
    },
    one: {
        "fr-FR": "Compte ONE",
        "de-DE": "ONE-Konto",
    },
    main: {
        "fr-FR": "Compte principal",
        "de-DE": "Hauptkonto",
    },
    password: {
        "fr-FR": "Mot de passe actuel du site principal",
        "de-DE": "Aktuelles Passwort der Hauptseite",
    },
    passwordHint: {
        "fr-FR": "Sans mot de passe, vérifiez d’abord votre méthode de connexion dans les paramètres de sécurité.",
        "de-DE": "Ohne Passwort bestätigen Sie zuerst Ihre bestehende Anmeldemethode in den Sicherheitseinstellungen.",
    },
    confirm: {
        "fr-FR": "Vérifier et connecter",
        "de-DE": "Bestätigen und verbinden",
    },
    cancel: {
        "fr-FR": "Retour à la création",
        "de-DE": "Zurück zur Erstellung",
    },
    missing: {
        "fr-FR": "La demande manque. Recommencez depuis votre compte ONE.",
        "de-DE": "Die Anfrage fehlt. Starten Sie erneut in Ihrem ONE-Konto.",
    },
    failed: {
        "fr-FR": "Échec de la connexion. Recommencez ou réessayez plus tard.",
        "de-DE": "Verbindung fehlgeschlagen. Starten Sie erneut oder versuchen Sie es später.",
    },
    loginIntro: {
        "fr-FR": "메인 계정으로 ONE에 로그인합니다. 기존 ONE 계정이 있으면 먼저 기존 방식으로 로그인한 뒤 연결하여 기존 자료를 유지하세요.",
        "de-DE": "메인 계정으로 ONE에 로그인합니다. 기존 ONE 계정이 있으면 먼저 기존 방식으로 로그인한 뒤 연결하여 기존 자료를 유지하세요.",
    },
    continueLogin: {
        "fr-FR": "ONE으로 계속",
        "de-DE": "ONE으로 계속",
    },
    handoff: {
        "fr-FR": "Une invite communautaire de ONE. Vérifiez le modèle, les paramètres et le prix.",
        "de-DE": "Ein Community-Prompt aus ONE. Prüfen Sie Modell, Einstellungen und Preis.",
    },
    append: {
        "fr-FR": "Ajouter à l’invite actuelle",
        "de-DE": "Zum aktuellen Prompt hinzufügen",
    },
};
export const FEDERATION_I18N_ENTRIES: SupDanceI18nEntry[] = definitions.map(([key, zh, en, tw, ja, ko, es]) => ({
    key: `federation.${key}`,
    namespace: "auth",
    sourceText: zh,
    origin: "builtin",
    translations: { "zh-CN": zh, "en-US": en, "zh-TW": tw, "ja-JP": ja, "ko-KR": ko, "es-ES": es, ...nativeTranslations[key] },
}));
