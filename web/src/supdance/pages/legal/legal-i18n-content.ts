/**
 * 网站核心法务条款多语言内容模型（以 English 英语为根语言/权威版本，提供 5 大语言翻译版本）
 *
 * 严格依据 Waffo Pancake MOR 审核规范与 Supdance 站点实际业务（V2 积分制、纯数字交付、PCI-DSS 支付）：
 * - Terms of Service (TOS)
 * - Privacy Policy
 * - Acceptable Use Policy (AUP - 包含 #content-standards, #enforcement-actions, #reporting 锚点)
 */

import additionalAup from "./additional-aup-locales.json";
export type SupportedLegalLanguage = "en" | "zh-CN" | "zh-TW" | "ja" | "ko" | "es" | "fr" | "de";

export interface LegalSectionItem {
    id: string; // 锚点 ID，如 content-standards, enforcement-actions, reporting
    title: string;
    paragraphs?: string[];
    bullets?: string[];
    callout?: string;
    table?: {
        head: string[];
        rows: string[][];
    };
}

export interface LocalizedLegalDoc {
    title: string;
    badge: string;
    summary: string;
    effectiveDate: string;
    version: string;
    sections: LegalSectionItem[];
}

export const LEGAL_OPERATOR_CONFIG = {
    legalName: "Supdance",
    tradeName: "Supdance",
    productName: "Supdance AI Canvas & Video Studio",
    domain: "https://www.supdance.com",
    supportEmail: "support@supdance.com",
    safetyEmail: "safety@supdance.com",
    billingEmail: "support@supdance.com",
    paymentProcessor: "Waffo Pancake",
    effectiveDate: "November 04, 2026",
    version: "v1.0",
} as const;

export const LEGAL_LANGUAGE_LABELS: Record<SupportedLegalLanguage, { label: string; code: string }> = {
    fr: { label: "Français (traduction)", code: "FR" },
    de: { label: "Deutsch (Übersetzung)", code: "DE" },
    en: { label: "English (Authoritative)", code: "EN" },
    "zh-CN": { label: "简体中文 (翻译件)", code: "简" },
    "zh-TW": { label: "繁體中文 (翻譯件)", code: "繁" },
    ja: { label: "日本語 (翻訳)", code: "日" },
    ko: { label: "한국어 (번역)", code: "한" },
    es: { label: "Español (Traducción)", code: "ES" },
};

// ==============================================================================
// 1. Acceptable Use Policy (AUP) - 包含 #content-standards, #enforcement-actions, #reporting
// ==============================================================================
export const AUP_DOC_MAP: Record<SupportedLegalLanguage, LocalizedLegalDoc> = {
    fr: additionalAup.fr,
    de: additionalAup.de,
    en: {
        title: "Acceptable Use Policy",
        badge: "AUP · CONTENT STANDARDS & ENFORCEMENT",
        summary: "Standards, monitoring, reporting channels, and enforcement actions for AI-generated content across the Supdance platform.",
        effectiveDate: LEGAL_OPERATOR_CONFIG.effectiveDate,
        version: LEGAL_OPERATOR_CONFIG.version,
        sections: [
            {
                id: "scope",
                title: "1. Scope & Core Commitments",
                paragraphs: [
                    `${LEGAL_OPERATOR_CONFIG.tradeName} (operated by ${LEGAL_OPERATOR_CONFIG.legalName}, hereinafter "Platform", "we", "us", or "our") is dedicated to providing a safe, legal, and responsible AI-powered creative environment.`,
                    'This Acceptable Use Policy ("AUP") applies to all content modalities processed or generated through our services, including text prompts, image generation, video synthesis, audio/music generation, and multi-track project canvases.',
                ],
            },
            {
                id: "content-standards",
                title: "2. Content Standards & Prohibited Categories",
                paragraphs: ["We strictly prohibit the use of our services to generate, process, upload, or disseminate content within the following prohibited categories:"],
                bullets: [
                    "Pornographic / Explicit Adult / NSFW Content: Any sexually explicit depictions, nudity, or non-consensual sexual material.",
                    "Violent & Graphic Imagery: Content depicting graphic violence, blood, gore, mutilation, self-harm, suicide encouragement, or physical abuse.",
                    "Hate Speech & Harassment: Attacks, slurs, dehumanizing language, defamation, or harassment based on race, ethnicity, religion, disability, gender, age, or sexual orientation.",
                    "Child Safety (CSAM) - Zero Tolerance: Any depiction, generation, or facilitation of child sexual abuse material or child exploitation. Violations will be immediately reported to law enforcement agencies and NCMEC.",
                    "Deepfakes & Non-Consensual Impersonation: Realistic synthetic depiction of real living persons or deceased individuals without verifiable explicit consent, fraudulent voice cloning, or misleading political manipulation.",
                    "Intellectual Property & Trademark Infringement: Unauthorized generation that misappropriates third-party registered trademarks, proprietary trade dress, or copyrighted characters without legal entitlement.",
                ],
                callout:
                    "Real Person Material Restriction: If you upload real photographs or voice samples for character customization, you represent and warrant that you hold all necessary legal rights and explicit written consent from the depicted individuals.",
            },
            {
                id: "moderation",
                title: "3. Content Moderation & AI Safeguards",
                paragraphs: [
                    "We employ a multi-layered moderation pipeline combining automated pre-flight filtering, real-time safety inspection, and human compliance audit.",
                    "All input prompts and output generations pass through automated keyword and semantic safety classifiers. Generations flagged as high-risk will be intercepted immediately and will not consume computational credits.",
                ],
            },
            {
                id: "reporting",
                title: "4. Violation Reporting & Handling Timelines",
                paragraphs: ["We maintain an active, human-monitored reporting desk to respond to rights infringement, safety concerns, and policy violations."],
                bullets: [`Dedicated Compliance Email: ${LEGAL_OPERATOR_CONFIG.safetyEmail} (or support desk: ${LEGAL_OPERATOR_CONFIG.supportEmail})`, "Online Form: Accessible via the Help Center within your workspace dashboard."],
                table: {
                    head: ["Severity Level", "Initial Response", "Final Resolution"],
                    rows: [
                        ["Level 1 (Severe: CSAM, Terrorism, Extreme Harm)", "Within 2 Hours", "Within 24 Hours"],
                        ["Level 2 (High Risk: Deepfakes, Violence, Impersonation)", "Within 24 Hours", "Within 3 Business Days"],
                        ["Level 3 (General: IP Dispute, Moderate Infringement)", "Within 48 Hours", "Within 7 Business Days"],
                    ],
                },
            },
            {
                id: "enforcement-actions",
                title: "5. Enforcement Actions",
                paragraphs: ["In the event of an AUP violation, we reserve the full right to take prompt, proportional enforcement actions based on the severity and history of violations:"],
                table: {
                    head: ["Action", "Description", "Typical Circumstance"],
                    rows: [
                        ["Content Warning", "Formal written notification requiring immediate removal or prompt modification", "First-time minor or inadvertent prompt trigger"],
                        ["Asset Removal", "Immediate deletion or quarantine of violating project assets from cloud storage", "Confirmed policy-violating images, videos, or audio"],
                        ["Feature Restriction", "Temporary restriction of generation privileges or model endpoints for 1–14 days", "Repeated bypass attempts or high-risk generations"],
                        ["Account Termination", "Permanent ban of account credentials, forfeiture of remaining credits, and blacklist", "Severe violations (CSAM, fraud, systemic malicious generation)"],
                        ["Legal Escalation", "Preservation of audit logs and formal referral to law enforcement or regulators", "Criminal conduct, severe harm, or statutory legal mandate"],
                    ],
                },
            },
            {
                id: "appeals",
                title: "6. Appeals Mechanism",
                paragraphs: [
                    `If you believe an enforcement action was executed in error, you may file an appeal by emailing ${LEGAL_OPERATOR_CONFIG.supportEmail} within 14 calendar days of receiving notification.`,
                    "Our compliance committee will conduct an independent review within 10 business days and communicate the final determination in writing.",
                ],
            },
            {
                id: "transparency",
                title: "7. Transparency & Policy Revisions",
                paragraphs: [
                    "We review and update this Acceptable Use Policy periodically to align with evolving AI safety standards, upstream provider guidelines, and international statutory frameworks.",
                    "Material amendments will be announced at least 15 days in advance via platform notices or email. Continued use of the service constitutes full acceptance.",
                ],
            },
        ],
    },
    "zh-CN": {
        title: "可接受使用政策",
        badge: "AUP · 内容标准与违规处置",
        summary: "Supdance 平台针对 AI 生成内容制定的内容标准、审核机制、举报途径及违规处置行动。",
        effectiveDate: "2026年11月04日",
        version: LEGAL_OPERATOR_CONFIG.version,
        sections: [
            {
                id: "scope",
                title: "1. 适用范围与基本承诺",
                paragraphs: [
                    `${LEGAL_OPERATOR_CONFIG.tradeName}（由独立经营者 ${LEGAL_OPERATOR_CONFIG.legalName} 运营，以下简称“平台”或“我们”）致力于提供安全、合法、负责任的 AI 创作环境。`,
                    "本政策（AUP）适用于本平台处理或生成的全部内容形态，包括用户提示词（Prompt）、图像生成、视频合成、音频与音乐生成，以及项目无限画布协同内容。",
                ],
            },
            {
                id: "content-standards",
                title: "2. 内容标准与禁止类别",
                paragraphs: ["平台严格禁止利用本服务生成、处理、上传或传播下列任何类别的违规内容："],
                bullets: [
                    "色情与成人内容（NSFW）：任何露骨色情描绘、裸体、非自愿性内容或性暗示素材。",
                    "暴力与血腥内容：描绘血腥暴力、人体残害、自残、自杀诱导或虐待人身的内容。",
                    "仇恨言论与恶意骚扰：针对种族、宗教、性别、年龄、残障或性取向的歧视、诽谤、人身攻击或骚扰。",
                    "儿童不安全内容（CSAM）——零容忍：任何涉及儿童性侵害、虐待或利用未成年人的内容。一经发现立即处置并向司法机关和相关国际组织报案。",
                    "深度伪造与未经授权冒充他人（Deepfake）：未经本人明确书面许可，对在世或已故真实人物进行逼真模拟、伪造虚假言行、声音克隆或误导性政治操纵。",
                    "知识产权与商标侵权：未经授权盗用他人驰名商标、受保护商业外观或专有版权角色的生成行为。",
                ],
                callout: "真人素材限制声明：如您上传真实人物肖像或人声音频作为角色设定素材，您保证已获得被拍摄或被录音本人的明确知情同意与合法授权。",
            },
            {
                id: "moderation",
                title: "3. 内容审核机制",
                paragraphs: ["平台采用“实时机器安全拦截 + 人工合规复核”的多层级内容安全防护网。", "所有提示词与输出媒体均需经过合规分类器扫描，被识别为高风险的违规请求将直接予以拦截，且不会扣除您的积分余额。"],
            },
            {
                id: "reporting",
                title: "4. 举报渠道与处理时效",
                paragraphs: ["我们设立了有人值守的合规举报通道，确保及时受理各类侵权与违规反馈："],
                bullets: [`专用合规举报邮箱：${LEGAL_OPERATOR_CONFIG.safetyEmail}（或客服邮箱：${LEGAL_OPERATOR_CONFIG.supportEmail}）`, "站内表单：登录后可通过工作区底栏的“帮助与反馈”直接提交举报。"],
                table: {
                    head: ["违规严重度", "初步响应时限", "最终处置完成"],
                    rows: [
                        ["L1 严重违规（CSAM、恐怖主义、极端暴力）", "2 小时内", "24 小时内"],
                        ["L2 高风险违规（深度伪造、恶意骚扰、冒充）", "24 小时内", "3 个工作日内"],
                        ["L3 一般违规（普通版权争议、轻微违规）", "48 小时内", "7 个工作日内"],
                    ],
                },
            },
            {
                id: "enforcement-actions",
                title: "5. 违规处置措施",
                paragraphs: ["针对违反本政策的行为，平台有权视情节轻重采取以下相应处置行动："],
                table: {
                    head: ["处置措施", "说明", "适用情形"],
                    rows: [
                        ["内容书面警告", "发送正式通知并要求立即停止或修改提示词", "首次偶发、轻微提示词触碰敏感边界"],
                        ["资产下架删除", "从云存储中彻底删除或隔离违规生成的项目资产", "确认存在违规的图片、音视频素材"],
                        ["限制生成权限", "暂时冻结账号的生成调用权限 1 至 14 天", "多次恶意绕过安全词、反复尝试生成违规内容"],
                        ["永久封禁账号", "永久注销账号凭据，清空全部积分并不予退款", "触碰严重红线（如儿童色情、欺诈、极端黑灰产）"],
                        ["移交司法机关", "保全系统操作日志与生成证据，依法上报公安执法部门", "涉嫌严重违法犯罪、造成实质人身或财产损害"],
                    ],
                },
            },
            {
                id: "appeals",
                title: "6. 申诉机制",
                paragraphs: [`如您认为处置行动存在事实认定错误，可在收到通知后 14 个自然日内致信 ${LEGAL_OPERATOR_CONFIG.supportEmail} 提交申诉理由与证明材料。`, "合规团队将在 10 个工作日内完成独立复核，并向您的注册邮箱反馈复核结果。"],
            },
            {
                id: "transparency",
                title: "7. 透明度与政策变更",
                paragraphs: ["平台定期评估并修订本政策，以顺应不断发展的生成式人工智能安全准则与监管法规要求。", "重大政策变更将至少提前 15 天通过网站公告或邮件告知，继续使用服务即视为接受修订。"],
            },
        ],
    },
    "zh-TW": {
        title: "可接受使用政策",
        badge: "AUP · 內容標準與處置規範",
        summary: "Supdance 針對 AI 生成內容所制定的內容標準、審核機制、舉報途徑與違規處置規範。",
        effectiveDate: "2026年11月04日",
        version: LEGAL_OPERATOR_CONFIG.version,
        sections: [
            {
                id: "scope",
                title: "1. 適用範圍與基本承諾",
                paragraphs: [
                    `${LEGAL_OPERATOR_CONFIG.tradeName}（由獨立經營者 ${LEGAL_OPERATOR_CONFIG.legalName} 營運，以下簡稱「平台」或「我們」）致力於提供安全、合法、負責任的 AI 創作環境。`,
                    "本政策（AUP）適用於本平台處理或生成的全部內容形態，包括使用者提示詞（Prompt）、圖像生成、影片合成、音訊與音樂生成，以及專案無限畫布協同內容。",
                ],
            },
            {
                id: "content-standards",
                title: "2. 內容標準與禁止類別",
                paragraphs: ["平台嚴格禁止利用本服務生成、處理、上傳或傳播下列任何類別的違規內容："],
                bullets: [
                    "色情與成人內容（NSFW）：任何露骨色情描繪、裸體、非自願性內容或性暗示素材。",
                    "暴力與血腥內容：描繪血腥暴力、人體殘害、自殘、自殺誘導或虐待人身的內容。",
                    "仇恨言論與惡意騷擾：針對種族、宗教、性別、年齡、殘障或性傾向的歧視、誹謗、人身攻擊或騷擾。",
                    "兒童不安全內容（CSAM）—— 零容忍：任何涉及兒童性侵害、虐待或利用未成年人的內容。一經發現立即處置並向司法機關和相關國際組織報案。",
                    "深度偽造與未經授權冒充他人（Deepfake）：未經本人明確書面許可，對在世或已故真實人物進行逼真模擬、偽造虛假言行、聲音克隆或誤導性政治操縱。",
                    "智慧財產權與商標侵權：未經授權盜用他人馳名商標、受保護商業外觀或專有版權角色的生成行為。",
                ],
                callout: "真人素材限制聲明：如您上傳真實人物肖像或人聲音訊作為角色設定素材，您保證已獲得被拍攝或被錄音本人的明確知情同意與合法授權。",
            },
            {
                id: "moderation",
                title: "3. 內容審核機制",
                paragraphs: ["平台採用「即時機器安全攔截 + 人工合規複核」的多層級內容安全防護網。", "所有提示詞與輸出媒體均需經過合規分類器掃描，被識別為高風險的違規請求將直接予以攔截，且不會扣除您的積分餘額。"],
            },
            {
                id: "reporting",
                title: "4. 舉報管道與處理時效",
                paragraphs: ["我們設立了專人值守的合規舉報管道，確保及時受理各類侵權與違規反饋："],
                bullets: [`專用合規舉報信箱：${LEGAL_OPERATOR_CONFIG.safetyEmail}（或客服信箱：${LEGAL_OPERATOR_CONFIG.supportEmail}）`, "站內表單：登入後可透過工作區底欄的「幫助與反饋」直接提交舉報。"],
                table: {
                    head: ["違規嚴重度", "初步回應時限", "最終處置完成"],
                    rows: [
                        ["L1 嚴重違規（CSAM、恐怖主義、極端暴力）", "2 小時內", "24 小時內"],
                        ["L2 高風險違規（深度偽造、惡意騷擾、冒充）", "24 小時內", "3 個工作日內"],
                        ["L3 一般違規（普通版權爭議、輕微違規）", "48 小時內", "7 個工作日內"],
                    ],
                },
            },
            {
                id: "enforcement-actions",
                title: "5. 違規處置措施",
                paragraphs: ["針對違反本政策的行為，平台有權視情節輕重採取以下相應處置行動："],
                table: {
                    head: ["處置措施", "說明", "適用情形"],
                    rows: [
                        ["內容書面警告", "發送正式通知並要求立即停止或修改提示詞", "首次偶發、輕微提示詞觸碰敏感邊界"],
                        ["資產下架刪除", "從雲端儲存中徹底刪除或隔離違規生成的專案資產", "確認存在違規的圖片、音視訊素材"],
                        ["限制生成權限", "暫時凍結帳號的生成呼叫權限 1 至 14 天", "多次惡意繞過安全詞、反覆嘗試生成違規內容"],
                        ["永久封禁帳號", "永久註銷帳號憑據，清空全部積分並不予退款", "觸碰嚴重紅線（如兒童色情、詐欺、極端黑灰產）"],
                        ["移交司法機關", "保全系統操作日誌與生成證據，依法上報警察執法部門", "涉嫌嚴重違法犯罪、造成實質人身或財產損害"],
                    ],
                },
            },
            {
                id: "appeals",
                title: "6. 申訴機制",
                paragraphs: [`如您認為處置行動存在事實認定錯誤，可在收到通知後 14 個日曆天內致信 ${LEGAL_OPERATOR_CONFIG.supportEmail} 提交申訴理由與證明文件。`, "合規團隊將在 10 個工作日內完成獨立複核，並向您的註冊信箱反饋複核結果。"],
            },
            {
                id: "transparency",
                title: "7. 透明度與政策變更",
                paragraphs: ["平台定期評估並修訂本政策，以順應不斷發展的生成式人工智慧安全準則與監管法規要求。", "重大政策變更將至少提前 15 天透過網站公告或電子郵件告知，繼續使用服務即視為接受修訂。"],
            },
        ],
    },
    ja: {
        title: "利用許諾方針 (AUP)",
        badge: "AUP · コンテンツ基準および執行措置",
        summary: "Supdance プラットフォームにおける AI 生成コンテンツの安全基準、監視体制、通報窓口および違反執行措置。",
        effectiveDate: "2026年11月04日",
        version: LEGAL_OPERATOR_CONFIG.version,
        sections: [
            {
                id: "scope",
                title: "1. 適用範囲と基本コミットメント",
                paragraphs: [
                    `${LEGAL_OPERATOR_CONFIG.tradeName}（運営者: ${LEGAL_OPERATOR_CONFIG.legalName}、以下「当プラットフォーム」または「当社」）は、安全、適法かつ責任ある AI 創作環境の提供に尽力しています。`,
                    "本利用許諾方針（AUP）は、ユーザープロンプト、画像生成、動画合成、音声・音楽生成、マルチトラックプロジェクトキャンバスを含む、当サービスを通じて処理または生成されるすべてのコンテンツ形態に適用されます。",
                ],
            },
            {
                id: "content-standards",
                title: "2. コンテンツ基準および禁止カテゴリ",
                paragraphs: ["以下のカテゴリに該当するコンテンツの生成、処理、アップロード、または拡散を固く禁じます："],
                bullets: [
                    "ポルノおよび成人向け（NSFW）コンテンツ：露骨な性的描写、ヌード、非合意の性的素材、性的暗示を含む表現。",
                    "暴力的および流血描写：生々しい暴力、血液、身体の切断、自傷行為、自殺の教唆、人身への虐待を描写する内容。",
                    "ヘイトスピーチおよび嫌がらせ：人種、民族、宗教、障害、性別、年齢、性的指向に基づく差別、誹謗中傷、嫌がらせ。",
                    "児童虐待・搾取（CSAM）- ゼロトレランス：児童の性的虐待や搾取を含むいかなる生成も即座に法執行機関および NCMEC 等の国際機関に通報します。",
                    "ディープフェイクおよび無断の成りすまし：実在人物（存命・故人を問わず）の無許可のリアルな合成描写、不正な音声クローン、誤解を招く政治的操作。",
                    "知的財産権および商標権の侵害：第三者の登録商標、トレードドレス、著作権キャラクターを正当な権利なく盗用する生成行為。",
                ],
                callout: "実在人物素材の制限に関する声明：実在人物の写真や音声をキャラクター設定素材としてアップロードする場合、対象者本人からの明確な事前の書面同意および合法的ライセンスを取得していることを保証するものとします。",
            },
            {
                id: "moderation",
                title: "3. コンテンツモデレーションと AI セーフガード",
                paragraphs: [
                    "当社は、自動事前フィルタリング、リアルタイムの安全性検査、人間によるコンプライアンス監査を組み合わせた多層防御パイプラインを配備しています。",
                    "すべてのプロンプトおよび生成物は、自動化された安全性分類器を通過します。高リスクと判定された違反リクエストは即座にブロックされ、クレジットは消費されません。",
                ],
            },
            {
                id: "reporting",
                title: "4. 違反通報窓口および対応タイムライン",
                paragraphs: ["権利侵害やポリシー違反に迅速に対応するため、有人監視のコンプライアンス窓口を設置しています："],
                bullets: [`専用通報窓口: ${LEGAL_OPERATOR_CONFIG.safetyEmail}（またはサポート窓口: ${LEGAL_OPERATOR_CONFIG.supportEmail}）`, "オンラインフォーム: ワークスペースダッシュボード内のヘルプセンターから直接提出可能。"],
                table: {
                    head: ["重大度レベル", "初期対応目標", "最終解決目標"],
                    rows: [
                        ["レベル 1（深刻: CSAM、テロリズム、極端な危害）", "2 時間以内", "24 時間以内"],
                        ["レベル 2（高リスク: ディープフェイク、暴力、成りすまし）", "24 時間以内", "3 営業日以内"],
                        ["レベル 3（一般: 知的財産権紛争、軽微な違反）", "48 時間以内", "7 営業日以内"],
                    ],
                },
            },
            {
                id: "enforcement-actions",
                title: "5. 違反執行措置",
                paragraphs: ["本ポリシーへの違反が確認された場合、違反の重大度および履歴に応じて以下の措置を講じます："],
                table: {
                    head: ["措置", "説明", "適用状況"],
                    rows: [
                        ["書面警告", "正式通知を送付し、プロンプトの即時修正または停止を要求", "初回の軽微または偶発的なポリシー抵触"],
                        ["アセットの削除", "クラウドストレージから違反生成アセットを完全に隔離または削除", "ポリシー違反が確認された画像、動画、音声"],
                        ["機能制限", "生成機能またはモデルエンドポイントの利用を 1〜14 日間制限", "安全策の意図的な回避や繰り返される違反試行"],
                        ["アカウント停止", "認証情報を恒久的に停止、残存クレジットの没収およびブラックリスト化", "深刻な違反（CSAM、詐欺、組織的な悪用）"],
                        ["法的通報", "システムログおよび証拠を保全し、管轄法執行機関へ引き渡し", "重大な違法行為、実質的な身体・財産被害"],
                    ],
                },
            },
            {
                id: "appeals",
                title: "6. 異議申立手続き",
                paragraphs: [
                    `執行措置に事実誤認があると判断される場合は、通知受領後 14 日以内に ${LEGAL_OPERATOR_CONFIG.supportEmail} まで証拠を添えて異議申立書を送信してください。`,
                    "コンプライアンス委員会は 10 営業日以内に独立した再審査を実施し、結果を書面で回答します。",
                ],
            },
            {
                id: "transparency",
                title: "7. 透明性とポリシーの改定",
                paragraphs: ["当社は、生成 AI 安全基準や法規制の進展に合わせて、本利用許諾方針を定期的に見直し改定します。", "重要な改定は少なくとも 15 日前にウェブサイト告知またはメールで通知します。サービスの継続利用は改定への同意とみなされます。"],
            },
        ],
    },
    ko: {
        title: "이용 허용 정책 (AUP)",
        badge: "AUP · 콘텐츠 표준 및 제재 규정",
        summary: "Supdance 플랫폼의 AI 생성 콘텐츠에 대한 안전 표준, 모니터링, 신고 접수 및 위반 제재 조치.",
        effectiveDate: "2026년 11월 04일",
        version: LEGAL_OPERATOR_CONFIG.version,
        sections: [
            {
                id: "scope",
                title: "1. 적용 범위 및 기본 서약",
                paragraphs: [
                    `${LEGAL_OPERATOR_CONFIG.tradeName}(운영자: ${LEGAL_OPERATOR_CONFIG.legalName}, 이하 "당사" 또는 "플랫폼")은 안전하고 합법적이며 책임 있는 AI 창작 환경을 보장합니다.`,
                    "본 이용 허용 정책(AUP)은 텍스트 프롬프트, 이미지 생성, 비디오 합성, 오디오/음악 생성 및 무한 캔버스 협업을 포함하여 서비스를 통해 처리되거나 생성된 모든 콘텐츠 양식에 적용됩니다.",
                ],
            },
            {
                id: "content-standards",
                title: "2. 콘텐츠 표준 및 금지 카테고리",
                paragraphs: ["다음 카테고리에 해당하는 콘텐츠의 생성, 처리, 업로드 또는 유포를 엄격히 금지합니다:"],
                bullets: [
                    "음란물 및 성인(NSFW) 콘텐츠: 노골적인 성적 묘사, 누드, 비동의 성적 자료 또는 성적 암시 표현.",
                    "폭력적 및 유혈 표현물: 유혈 폭력, 신체 훼손, 자해, 자살 조장 또는 신체적 학대를 묘사하는 콘텐츠.",
                    "혐오 발언 및 괴롭힘: 인종, 민족, 종교, 장애, 성별, 연령, 성적 지향에 기반한 차별, 명예훼손 또는 조직적 괴롭힘.",
                    "아동 안전 침해(CSAM) - 무관용 원칙: 아동 성 착취물 또는 아동 학대와 관련된 모든 생성 행위는 즉시 사법 당국 및 NCMEC에 고발됩니다.",
                    "딥페이크 및 무단 사칭: 실제 인물(생존 또는 작고)의 명시적 서면 동의 없는 사실적 합성 묘사, 사기성 음성 복제 또는 오도하는 정치적 조작.",
                    "지적 재산권 및 상표권 침해: 제3자의 등록 상표, 트레이드 드레스 또는 저작권 보호 캐릭터를 무단 도용하는 행위.",
                ],
                callout: "실제 인물 자료 제한 성명: 실제 인물의 사진이나 음성을 캐릭터 설정 자료로 업로드하는 경우, 해당 인물로부터 명시적인 사전 서면 동의와 법적 사용 권한을 확보했음을 보증해야 합니다.",
            },
            {
                id: "moderation",
                title: "3. 콘텐츠 모니터링 및 AI 안전망",
                paragraphs: [
                    "당사는 자동 사전 필터링, 실시간 안전성 검사, 사람에 의한 규정 준수 검토를 결합한 다층적 안전 방어망을 운영합니다.",
                    "모든 프롬프트와 생성물은 자동화된 안전 분류기를 통과합니다. 고위험으로 식별된 위반 요청은 즉시 차단되며 크레딧이 차감되지 않습니다.",
                ],
            },
            {
                id: "reporting",
                title: "4. 신고 접수 및 처리 일정",
                paragraphs: ["권리 침해 및 정책 위반에 신속히 대응하기 위해 상시 모니터링 신고 창구를 운영합니다:"],
                bullets: [`전용 신고 이메일: ${LEGAL_OPERATOR_CONFIG.safetyEmail}(또는 고객 지원: ${LEGAL_OPERATOR_CONFIG.supportEmail})`, "온라인 접수: 작업 대시보드 내 도움말 센터를 통해 직접 제출 가능."],
                table: {
                    head: ["심각도 등급", "1차 응답 목표", "최종 조치 완료"],
                    rows: [
                        ["등급 1 (심각: CSAM, 테러, 극단적 위해)", "2시간 이내", "24시간 이내"],
                        ["등급 2 (고위험: 딥페이크, 폭력, 사칭)", "24시간 이내", "3영업일 이내"],
                        ["등급 3 (일반: 저작권 분쟁, 경미한 위반)", "48시간 이내", "7영업일 이내"],
                    ],
                },
            },
            {
                id: "enforcement-actions",
                title: "5. 위반 제재 조치",
                paragraphs: ["정책 위반이 확인된 경우 위반의 심각성 및 이력에 따라 다음과 같은 비례적 조치를 취합니다:"],
                table: {
                    head: ["조치 유형", "설명", "적용 상황"],
                    rows: [
                        ["서면 경고", "공식 통지를 발송하고 프롬프트 즉시 수정 또는 중단 요구", "최초의 경미하거나 우발적인 정책 저촉"],
                        ["자산 삭제", "클라우드 스토리지에서 위반 생성 자산을 영구 격리 또는 삭제", "정책 위반이 확인된 이미지, 비디오, 오디오"],
                        ["기능 제한", "생성 기능 또는 특정 모델 호출 권한을 1~14일간 정지", "반복적인 필터 우회 시도 또는 고위험 생성"],
                        ["계정 영구 정지", "계정 인증 정보를 영구 삭제하고 잔여 크레딧 몰수", "중대한 위반(CSAM, 사기, 악의적 조직적 생성)"],
                        ["사법 기관 인계", "시스템 로그 및 증거를 보전하여 관할 법 집행 기관에 고발", "중대한 범죄 혐의, 실질적 신체·재산상 피해"],
                    ],
                },
            },
            {
                id: "appeals",
                title: "6. 이의 신청 절차",
                paragraphs: [
                    `제재 조치에 사실 오인이 있다고 판단되는 경우 통지 수령 후 14일 이내에 ${LEGAL_OPERATOR_CONFIG.supportEmail}로 이의 신청서를 제출할 수 있습니다.`,
                    "컴플라이언스 위원회는 10영업일 이내에 독립적인 재심을 진행하고 서면으로 결과를 회신합니다.",
                ],
            },
            {
                id: "transparency",
                title: "7. 투명성 및 정책 개정",
                paragraphs: [
                    "당사는 생성형 AI 안전 기준 및 법률 규제 동향에 맞추어 본 이용 허용 정책을 정기적으로 검토하고 개정합니다.",
                    "중대한 정책 변경은 최소 15일 전에 웹사이트 공지 또는 이메일로 안내하며, 서비스를 계속 이용하는 것은 개정안에 동의한 것으로 간주됩니다.",
                ],
            },
        ],
    },
    es: {
        title: "Política de Uso Aceptable (AUP)",
        badge: "AUP · ESTÁNDARES Y MEDIDAS",
        summary: "Estándares de contenido, moderación, canales de denuncia y medidas disciplinarias para creaciones con IA en Supdance.",
        effectiveDate: "4 de noviembre de 2026",
        version: LEGAL_OPERATOR_CONFIG.version,
        sections: [
            {
                id: "scope",
                title: "1. Ámbito de Aplicación y Compromisos Fundamentales",
                paragraphs: [
                    `${LEGAL_OPERATOR_CONFIG.tradeName} (operado por ${LEGAL_OPERATOR_CONFIG.legalName}, en adelante "la Plataforma" o "nosotros") se compromete a proporcionar un entorno creativo seguro, legal y responsable.`,
                    "Esta Política de Uso Aceptable (AUP) se aplica a todas las modalidades de contenido procesadas o generadas a través de nuestros servicios, incluyendo prompts de texto, imágenes, videos sintetizados, música/audio y lienzos de proyectos colaborativos.",
                ],
            },
            {
                id: "content-standards",
                title: "2. Estándares de Contenido y Categorías Prohibidas",
                paragraphs: ["Queda estrictamente prohibido utilizar nuestros servicios para generar, procesar, subir o divulgar contenido perteneciente a las siguientes categorías:"],
                bullets: [
                    "Contenido pornográfico o explícito para adultos (NSFW): representaciones sexuales explícitas, desnudez o material sexual sin consentimiento.",
                    "Violencia gráfica y autolesiones: representaciones de violencia sangrienta, mutilación, suicidio, incitación a la autolesión o maltrato físico.",
                    "Discurso de odio y acoso: ataques, insultos, difamación o acoso por motivos de raza, religión, discapacidad, género, edad u orientación sexual.",
                    "Protección infantil (CSAM) - Tolerancia Cero: cualquier material de abuso o explotación sexual infantil será denunciado de inmediato ante las fuerzas de seguridad y el NCMEC.",
                    "Deepfakes y suplantación de identidad no consentida: recreación sintética de personas reales sin consentimiento explícito verificable, clonación fraudulenta de voz o manipulación política engañosa.",
                    "Vulneración de propiedad intelectual y marcas registradas: apropiación indebida y no autorizada de marcas registradas o personajes con derechos de autor protegidos.",
                ],
                callout:
                    "Restricción de material de personas reales: al subir fotografías o muestras de voz de personas reales para la personalización de personajes, usted declara y garantiza que posee todos los derechos legales y el consentimiento explícito por escrito de las personas representadas.",
            },
            {
                id: "moderation",
                title: "3. Moderación de Contenidos y Salvaguardas de IA",
                paragraphs: [
                    "Implementamos una línea de defensa multicapa que combina filtros automáticos previos, inspección en tiempo real y auditorías humanas de cumplimiento.",
                    "Todas las peticiones y resultados generados pasan por clasificadores de seguridad. Las solicitudes marcadas como de alto riesgo serán bloqueadas inmediatamente sin consumir créditos computacionales.",
                ],
            },
            {
                id: "reporting",
                title: "4. Canales de Denuncia y Plazos de Tramitación",
                paragraphs: ["Mantenemos un centro de atención atendido por personal cualificado para responder a infracciones de derechos y de políticas:"],
                bullets: [`Correo dedicado de cumplimiento: ${LEGAL_OPERATOR_CONFIG.safetyEmail} (o soporte general: ${LEGAL_OPERATOR_CONFIG.supportEmail})`, "Formulario en línea: disponible en el Centro de Ayuda dentro de su panel de trabajo."],
                table: {
                    head: ["Nivel de Gravedad", "Respuesta Inicial", "Resolución Final"],
                    rows: [
                        ["Nivel 1 (Grave: CSAM, terrorismo, daños extremos)", "Menos de 2 horas", "Menos de 24 horas"],
                        ["Nivel 2 (Alto riesgo: deepfakes, violencia, suplantación)", "Menos de 24 horas", "3 días hábiles"],
                        ["Nivel 3 (General: disputas de PI, infracciones menores)", "Menos de 48 horas", "7 días hábiles"],
                    ],
                },
            },
            {
                id: "enforcement-actions",
                title: "5. Medidas Disciplinarias",
                paragraphs: ["En caso de infracción de la AUP, nos reservamos el derecho de aplicar medidas proporcionales basadas en la gravedad y antecedentes:"],
                table: {
                    head: ["Medida", "Descripción", "Circunstancia Habitual"],
                    rows: [
                        ["Advertencia por escrito", "Notificación formal exigiendo la retirada inmediata o modificación del prompt", "Primera advertencia por coincidencia leve o involuntaria"],
                        ["Retirada de activos", "Eliminación o aislamiento inmediato del activo infractor del almacenamiento en la nube", "Imágenes, videos o pistas de audio que infrinjan la política"],
                        ["Restricción de funciones", "Suspensión temporal de privilegios de generación durante 1 a 14 días", "Intentos reiterados de eludir filtros o generaciones de alto riesgo"],
                        ["Cancelación de cuenta", "Bloqueo definitivo de credenciales de acceso y confiscación de créditos restantes", "Infracciones graves (CSAM, fraude, generación maliciosa sistemática)"],
                        ["Derivación judicial", "Preservación de registros de auditoría y remisión a las autoridades policiales o judiciales", "Conducta delictiva flagrante, daños corporales o patrimoniales sustanciales"],
                    ],
                },
            },
            {
                id: "appeals",
                title: "6. Procedimiento de Recurso",
                paragraphs: [
                    `Si considera que una medida disciplinaria se debió a un error de apreciación, puede presentar un recurso escribiendo a ${LEGAL_OPERATOR_CONFIG.supportEmail} dentro de los 14 días naturales siguientes.`,
                    "El comité de cumplimiento revisará el caso de forma independiente en un plazo de 10 días hábiles y notificará la resolución definitiva por escrito.",
                ],
            },
            {
                id: "transparency",
                title: "7. Transparencia y Modificaciones de la Política",
                paragraphs: [
                    "Revisamos y actualizamos periódicamente esta Política de Uso Aceptable para alinearnos con los estándares emergentes de seguridad en IA y normativas internacionales.",
                    "Las modificaciones sustanciales se anunciarán con al menos 15 días de antelación mediante avisos en el sitio web o por correo electrónico.",
                ],
            },
        ],
    },
};

// ==============================================================================
// 2. Terms of Service (TOS) - 包含 V2 积分制口径与 Waffo Pancake 记录商户条款
// ==============================================================================
export { SERVICE_TERMS as TOS_DOC_MAP, SERVICE_PRIVACY as PRIVACY_DOC_MAP } from "./service-policies";
