import type { SupDanceI18nEntry } from "@/supdance/plugins/i18n/types";

const definitions = [
    ["title", "广告衡量偏好", "Advertising measurement", "廣告衡量偏好", "広告測定の設定", "광고 측정 설정", "Medición publicitaria"],
    [
        "description",
        "允许 X 衡量广告访问与真实付款？同意后，X 可能接收点击标识、页面地址、IP、浏览器信息、付款金额、币种和去重编号，并使用广告 Cookie。我们不向 X 发送邮箱、手机号或创作内容。拒绝不影响使用或付款。",
        "Allow X to measure ad visits and real purchases? With consent, X may receive click identifiers, page URLs, IP address, browser information, purchase amount, currency and a deduplication identifier, and use advertising cookies. We do not send email, phone or creative content to X. Declining does not affect service or payment.",
        "允許 X 衡量廣告造訪與真實付款？同意後，X 可能接收點擊識別碼、頁面網址、IP、瀏覽器資訊、付款金額、幣別和去重編號，並使用廣告 Cookie。我們不向 X 傳送信箱、手機號碼或創作內容。拒絕不影響使用或付款。",
        "広告訪問と実際の購入を X が測定することを許可しますか？同意後、クリック識別子、ページ URL、IP、ブラウザー情報、購入金額、通貨、重複排除 ID が X に送信され、広告 Cookie が使用される場合があります。メール、電話番号、創作内容は送信しません。拒否してもサービスや支払いに影響しません。",
        "X의 광고 방문 및 실제 구매 측정을 허용하시겠습니까? 동의하면 클릭 식별자, 페이지 URL, IP, 브라우저 정보, 구매 금액, 통화 및 중복 제거 ID가 X에 전송되고 광고 쿠키가 사용될 수 있습니다. 이메일, 전화번호, 창작 콘텐츠는 전송하지 않습니다. 거절해도 서비스나 결제에 영향이 없습니다.",
        "¿Permitir que X mida visitas publicitarias y compras reales? Con su consentimiento, X puede recibir identificadores de clic, URL, IP, información del navegador, importe, moneda e identificador de deduplicación, y usar cookies publicitarias. No enviamos correo, teléfono ni contenido creativo a X. Rechazar no afecta al servicio ni al pago.",
    ],
    ["accept", "允许广告衡量", "Allow measurement", "允許廣告衡量", "測定を許可", "측정 허용", "Permitir medición"],
    ["decline", "拒绝 / 撤回同意", "Decline / withdraw consent", "拒絕 / 撤回同意", "拒否・同意を撤回", "거절 / 동의 철회", "Rechazar / retirar consentimiento"],
    ["privacy", "隐私政策", "Privacy policy", "隱私政策", "プライバシーポリシー", "개인정보 처리방침", "Política de privacidad"],
    ["manage", "管理广告衡量偏好", "Manage advertising preferences", "管理廣告衡量偏好", "広告測定の設定を管理", "광고 측정 설정 관리", "Gestionar preferencias publicitarias"],
    [
        "storageDescription",
        "必要存储用于维持服务；可选广告存储仅在你同意后使用。广告衡量同意保存在本机，付款去重编号最多保存 200 条；撤回后停止新事件并卸载广告衡量运行环境。X 可使用其广告 Cookie，请参阅（https://x.com/en/privacy）。",
        "Essential storage maintains the service; optional advertising storage is used only with your consent. Advertising consent is saved on this device, with up to 200 purchase deduplication identifiers. Withdrawal stops new events and unloads advertising measurement. X may use advertising cookies; see (https://x.com/en/privacy).",
        "必要儲存用於維持服務；選用廣告儲存僅在你同意後使用。廣告衡量同意儲存在本機，付款去重編號最多儲存 200 筆；撤回後停止新事件並卸載廣告衡量執行環境。X 可使用其廣告 Cookie，請參閱（https://x.com/en/privacy）。",
        "必須ストレージはサービス維持に使用し、任意の広告ストレージは同意後のみ使用します。広告測定の同意はこの端末に保存され、購入の重複排除 ID は最大 200 件保存されます。同意を撤回すると新しいイベントを停止し、広告測定環境を終了します。X は広告 Cookie を使用する場合があります。（https://x.com/en/privacy）を参照してください。",
        "필수 저장소는 서비스 유지에 사용하며 선택적 광고 저장소는 동의한 경우에만 사용합니다. 광고 측정 동의는 이 기기에 저장되고 구매 중복 제거 ID는 최대 200개까지 저장됩니다. 동의를 철회하면 새 이벤트 전송을 중단하고 광고 측정 환경을 종료합니다. X는 광고 쿠키를 사용할 수 있습니다. (https://x.com/en/privacy)를 참조하세요.",
        "El almacenamiento esencial mantiene el servicio; el almacenamiento publicitario opcional solo se utiliza con su consentimiento. El consentimiento se guarda en este dispositivo, con un máximo de 200 identificadores de deduplicación de compras. Retirarlo detiene nuevos eventos y cierra el entorno de medición. X puede usar cookies publicitarias; consulte (https://x.com/en/privacy).",
    ],
] as const;

export const MARKETING_I18N_ENTRIES: SupDanceI18nEntry[] = definitions.map(([key, zh, en, tw, ja, ko, es]) => ({
    key: `marketing.${key}`,
    namespace: "legal",
    sourceText: zh,
    description: "Optional X conversion measurement",
    origin: "builtin",
    translations: { "zh-CN": zh, "en-US": en, "zh-TW": tw, "ja-JP": ja, "ko-KR": ko, "es-ES": es },
}));
