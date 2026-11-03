/**
 * 网站核心法务条款多语言内容模型（以 English 英语为根语言/权威版本，提供 5 大语言翻译版本）
 *
 * 严格依据 Waffo Pancake MOR 审核规范与 Supdance 站点实际业务（V2 积分制、纯数字交付、PCI-DSS 支付）：
 * - Terms of Service (TOS)
 * - Privacy Policy
 * - Acceptable Use Policy (AUP - 包含 #content-standards, #enforcement-actions, #reporting 锚点)
 */

export type SupportedLegalLanguage = "en" | "zh-CN" | "zh-TW" | "ja" | "ko" | "es";

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
    authoritativeNotice: string;
    sections: LegalSectionItem[];
}

export const LEGAL_OPERATOR_CONFIG = {
    legalName: "Zhang Donghe",
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
    en: {
        title: "Acceptable Use Policy",
        badge: "AUP · CONTENT STANDARDS & ENFORCEMENT",
        summary: "Standards, monitoring, reporting channels, and enforcement actions for AI-generated content across the Supdance platform.",
        effectiveDate: LEGAL_OPERATOR_CONFIG.effectiveDate,
        version: LEGAL_OPERATOR_CONFIG.version,
        authoritativeNotice: "Authoritative English Version. In the event of any discrepancies or conflicting interpretations between translations and this English text, the English version shall prevail.",
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
        authoritativeNotice: "本文为中文参考译本。如不同语言版本之间存在任何歧义或冲突，均以英文原版（Authoritative English Version）为准。",
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
        authoritativeNotice: "本文為繁體中文參考譯本。如不同語言版本之間存在任何歧異或衝突，均以英文原版（Authoritative English Version）為準。",
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
        authoritativeNotice: "本文は日本語参考訳です。翻訳と英語原文の間に不一致がある場合は、英語原文（Authoritative English Version）が優先されます。",
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
        authoritativeNotice: "본 문서는 한국어 번역본입니다. 번역본과 영어 원문 간에 불일치가 발생하는 경우 영어 원문(Authoritative English Version)이 우선합니다.",
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
        authoritativeNotice: "Versión en español para fines informativos. En caso de discrepancia, prevalecerá la versión oficial en inglés (Authoritative English Version).",
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
export const TOS_DOC_MAP: Record<SupportedLegalLanguage, LocalizedLegalDoc> = {
    en: {
        title: "Terms of Service",
        badge: "TOS · V2 CREDITS MODEL · WAFFO PANCAKE MOR",
        summary: "Legally binding agreement governing account usage, digital instant delivery of credits, PCI-DSS billing, and AI asset ownership.",
        effectiveDate: LEGAL_OPERATOR_CONFIG.effectiveDate,
        version: LEGAL_OPERATOR_CONFIG.version,
        authoritativeNotice: "Authoritative English Version. In the event of any discrepancies or conflicting interpretations between translations and this English text, the English version shall prevail.",
        sections: [
            {
                id: "acceptance",
                title: "1. Acceptance of Terms",
                paragraphs: [
                    `Welcome to ${LEGAL_OPERATOR_CONFIG.productName} (operated by individual merchant ${LEGAL_OPERATOR_CONFIG.legalName}, doing business as "${LEGAL_OPERATOR_CONFIG.tradeName}", hereinafter "we", "us", or "Platform").`,
                    `These Terms of Service ("Terms") govern your access to and use of our web-based creative platform accessible at ${LEGAL_OPERATOR_CONFIG.domain}. By registering an account, purchasing credits, or using our services, you confirm that you are at least 18 years old, have read and agreed to these Terms and our Privacy Policy, and possess the authority to enter into this agreement.`,
                ],
                callout: "Important: If you do not agree to these Terms, please immediately discontinue use of the platform. Continued use following any posted revisions constitutes binding acceptance of the updated terms.",
            },
            {
                id: "services",
                title: "2. Digital Services & Instant Delivery",
                paragraphs: [
                    `${LEGAL_OPERATOR_CONFIG.tradeName} provides a digital software-as-a-service (SaaS) suite for creative AI workflows, including multi-modal script adaptation, character and storyboard design, image/video generation, and audio synthesis.`,
                    "Instant Digital Delivery: All credit top-up packages and storage expansion packs purchased on the platform are purely digital rights and intangibles. Upon successful payment verification by our payment processor, the purchased credits or storage quotas are immediately credited to your account and made available for execution without physical shipment or tangible logistics.",
                ],
            },
            {
                id: "account",
                title: "3. Account Security & Verification",
                paragraphs: [
                    "You agree to provide true, accurate, and current information when registering. You are exclusively responsible for maintaining the confidentiality of your login credentials and for all activities that occur under your account.",
                    `If you detect unauthorized access or security compromises, notify us immediately at ${LEGAL_OPERATOR_CONFIG.supportEmail}.`,
                ],
            },
            {
                id: "billing",
                title: "4. Pricing & Credits Model (V2 One-Time Credits)",
                paragraphs: [
                    "Our service strictly operates on a pre-paid, one-time credits model. We do NOT operate recurring subscription plans, and we will NEVER initiate recurring automatic renewals or unexpected periodic debits.",
                    "Every debit transaction is solely initiated by your active, deliberate purchase action.",
                ],
                bullets: [
                    "Credit Top-up Packs: One-time purchase of computing tokens used to execute image, video, voice, or tool tasks based on published unit rates.",
                    "Storage Expansion Packs: One-time purchase of asset storage capacity valid for a defined operational period.",
                    "Credits Validity: Purchased credits remain active throughout the operational life of the platform and do not expire. Promotional or promotional gift credits follow the specific promotional expiry terms.",
                ],
            },
            {
                id: "payment",
                title: "5. Payment Authorization & PCI-DSS Processing",
                paragraphs: [
                    `All online payment transactions are processed securely through our authorized Merchant of Record (MOR) and payment service partner, ${LEGAL_OPERATOR_CONFIG.paymentProcessor}.`,
                    "Our servers never store or process your complete credit card number, expiration date, or CVC security codes. Payment card data is processed directly within PCI-DSS certified vaults.",
                    "All displayed prices include standard processing fees. You will not be assessed surprise surcharges at checkout.",
                ],
            },
            {
                id: "refund",
                title: "6. Refund Policy & Failed Task Reversal",
                paragraphs: ["Due to the immediate provisioning nature of digital computing resources, refunds are governed by the following clear terms:"],
                bullets: [
                    "7-Day Unused Refund: You are entitled to request a 100% full refund on any credit top-up purchase within 7 calendar days of purchase, provided that zero credits from that package have been consumed.",
                    "Generated Resource Consumption: Once computing credits have been consumed to render AI imagery, videos, or audio, those consumed portions cannot be refunded.",
                    "Automated Failure Reversal: If an AI generation task fails due to internal system errors or upstream infrastructure outages, the frozen credits are automatically reversed and credited back to your balance.",
                    `Refund Submission: Email ${LEGAL_OPERATOR_CONFIG.supportEmail} with your account ID and payment order number. Approved refunds are credited back to the original payment method within 5–10 business days.`,
                ],
            },
            {
                id: "disputes",
                title: "7. Billing Inquiries & Chargeback Prevention",
                paragraphs: [
                    `Your credit card billing statement will display our verified trade name: "${LEGAL_OPERATOR_CONFIG.tradeName}" or "PANCAKE*SUPDANCE".`,
                    `If you believe a billing error has occurred, please contact us at ${LEGAL_OPERATOR_CONFIG.supportEmail} before filing a bank dispute or chargeback. We commit to responding within 2 business days and resolving legitimate billing discrepancies promptly.`,
                ],
            },
            {
                id: "intellectual-property",
                title: "8. AI Output Rights & Intellectual Property",
                paragraphs: [
                    "Subject to your full compliance with these Terms and our Acceptable Use Policy, you retain all legal rights, title, and ownership in the prompts you provide and the output assets generated via your purchased credits.",
                    "You may freely utilize, commercialize, publish, and license your generated assets, provided they do not infringe upon third-party rights or violate statutory content prohibitions.",
                ],
            },
            {
                id: "disclaimers",
                title: "9. Disclaimers & Limitation of Liability",
                paragraphs: [
                    'The platform and all AI outputs are provided strictly on an "AS IS" and "AS AVAILABLE" basis without warranties of any kind. AI models may occasionally generate inaccurate, unpolished, or unpredictable results.',
                    `To the maximum extent permitted by law, ${LEGAL_OPERATOR_CONFIG.tradeName} shall not be liable for any indirect, incidental, or consequential damages. Our aggregate liability for all claims shall not exceed the total fees paid by you in the 3 months preceding the event.`,
                ],
            },
            {
                id: "general",
                title: "10. Governing Law & General Provisions",
                paragraphs: [
                    "These Terms and any billing relationships shall be governed by the applicable laws of the operator's jurisdiction, excluding conflict of law principles. Parties agree to resolve any dispute through good-faith informal negotiations first.",
                    "Language Clause: These Terms are executed and governed in English as the authoritative source text. Translations in other languages are provided solely for convenience.",
                ],
            },
        ],
    },
    "zh-CN": {
        title: "服务条款",
        badge: "TOS · V2 积分制口径 · WAFFO PANCAKE 记录商户",
        summary: "约定账号使用、积分数字即时交付、PCI-DSS 安全支付、退款保障与 AI 创作资产归属的具有法律约束力的协议。",
        effectiveDate: "2026年11月04日",
        version: LEGAL_OPERATOR_CONFIG.version,
        authoritativeNotice: "本文为中文参考译本。如不同语言版本之间存在任何歧义或冲突，均以英文原版（Authoritative English Version）为准。",
        sections: [
            {
                id: "acceptance",
                title: "1. 条款的接受",
                paragraphs: [
                    `欢迎使用 ${LEGAL_OPERATOR_CONFIG.productName}（由个人独立经营者 ${LEGAL_OPERATOR_CONFIG.legalName} 运营，对外经营名称为“${LEGAL_OPERATOR_CONFIG.tradeName}”，以下简称“我们”或“平台”）。`,
                    `本服务条款（“本条款”）规范您访问与使用我们位于 ${LEGAL_OPERATOR_CONFIG.domain} 的在线创作平台。注册账号、充值积分或使用服务即表示您已年满 18 周岁，已完整阅读并同意受本条款及《隐私政策》约束。`,
                ],
                callout: "特别提示：若您不同意本条款全部或部分内容，请立即停止使用本服务。条款更新后继续使用即视为接受最新修订。",
            },
            {
                id: "services",
                title: "2. 数字服务说明与即时交付",
                paragraphs: [
                    `${LEGAL_OPERATOR_CONFIG.tradeName} 是一套面向 AI 影视与短剧创作的数字化在线软件工具（SaaS），提供剧本分镜改编、文生图、文生视频、音频生成及项目画布协同。`,
                    "即时数字交付：您购买的积分充值包与存储扩容包均为纯数字化无形权益。在支付通道确认扣款成功后，系统即时完成账户充值入账，即刻具备调用能力，不涉及任何物理货物的物流运输或实物签收环节。",
                ],
            },
            {
                id: "account",
                title: "3. 账号注册与安全保管",
                paragraphs: ["注册时须提供真实、准确的个人信息。您对妥善保管登录凭据及该账号下的全部操作负有完全法律责任。", `如发现账号存在任何未经授权的异常登录，应立即通过 ${LEGAL_OPERATOR_CONFIG.supportEmail} 通知我们协助处理。`],
            },
            {
                id: "billing",
                title: "4. 计费模式与积分方案（V2 一次性充值）",
                paragraphs: ["本平台严格采用一次性预付积分计费体系，绝无订阅自动续费、无任何形式的周期性静默扣款，每一笔账单均由您本人主动下单支付触发。"],
                bullets: [
                    "积分充值包：一次性购买相应额度的算力积分，按各 AI 模型公开明码标价进行调用扣除。",
                    "存储扩容包：一次性购买一定有效期的项目素材存储配额。",
                    "积分有效期：通过主动购买获得的算力积分在本平台正常营运期内永久有效、不设过期时间。活动赠送积分以公示活动规则为准。",
                ],
            },
            {
                id: "payment",
                title: "5. 支付授权与 PCI-DSS 处理合规",
                paragraphs: [
                    `本站在线收款业务由具有 PCI-DSS 国际安全认证资质的记录商户（MOR）服务商 ${LEGAL_OPERATOR_CONFIG.paymentProcessor} 提供处理。`,
                    "本站服务器绝不留存或触碰您的完整银行卡号、有效期或 CVC 安全码，支付卡数据全程由持牌支付机构在加密环境中处理。",
                    "站内展示的标价已包含支付通道手续费，结账时不会向您加收意外附加费。",
                ],
            },
            {
                id: "refund",
                title: "6. 退款政策与生成失败冲正",
                paragraphs: ["基于数字算力即时履约的特性，退款适用以下明确透明规则："],
                bullets: [
                    "7 天未使用全额退款：自充值购买之日起 7 个自然日内，若该笔订单对应的积分尚未产生任何实际算力消耗，您可以申请 100% 全额原路退款。",
                    "已消耗算力不予退还：若积分已实际调用模型用于渲染图像、生成视频或音乐，已消耗部分无法申请退款。",
                    "生成失败自动冲正：因平台技术故障或上游模型供应商中断导致任务生成失败而未交付结果的，为该任务冻结的积分将自动解冻并冲正退回账户。",
                    `退款申请方式：致信 ${LEGAL_OPERATOR_CONFIG.supportEmail} 注明注册邮箱与订单号，审核通过后将在 5–10 个工作日内由原支付渠道原路退回。`,
                ],
            },
            {
                id: "disputes",
                title: "7. 账单争议与拒付防范",
                paragraphs: [
                    `您的信用卡对账单将显示对外经营名称：“${LEGAL_OPERATOR_CONFIG.tradeName}”或“PANCAKE*SUPDANCE”。`,
                    `若您对扣款存在任何疑问，请优先联系 ${LEGAL_OPERATOR_CONFIG.supportEmail}。我们承诺在 2 个工作日内回复并在 5 个工作日内核实处理，避免不必要的银行争议或拒付。`,
                ],
            },
            {
                id: "intellectual-property",
                title: "8. AI 输出内容与知识产权",
                paragraphs: ["在您遵守本条款及 AUP 的前提下，您使用已购积分生成的最终创作产物（包含图片、视频与剧本分镜）的合法权益均归您所有。", "您可以将该产物自由用于商业运营、发布或授权，但不得用于违反公序良俗或侵害他人知识产权的非法用途。"],
            },
            {
                id: "disclaimers",
                title: "9. 免责声明与责任上限",
                paragraphs: [
                    "本服务按“现状”和“现有可用状态”提供。受限于生成式 AI 技术的客观发展阶段，平台不保证模型生成内容的绝对真实性或无暇性。",
                    `在法律允许的最大范围内，平台累计承担的赔偿责任上限以您在争议发生前 3 个月内向平台实际支付的总费用为限。`,
                ],
            },
            {
                id: "general",
                title: "10. 适用法律与通用条款",
                paragraphs: ["本条款受运营主体所在司法管辖区法律管辖。双方发生争议时应秉持诚信友好原则先予协商解决。", "语言效力：本服务条款以英文文本（Authoritative English Version）为唯一权威依据，多语言翻译件仅供创作者理解参考。"],
            },
        ],
    },
    "zh-TW": {
        title: "服務條款",
        badge: "TOS · V2 積分制口徑 · WAFFO PANCAKE 記錄商戶",
        summary: "約定帳號使用、積分數位即時交付、PCI-DSS 安全支付、退款保障與 AI 創作資產歸屬的具有法律約束力的協議。",
        effectiveDate: "2026年11月04日",
        version: LEGAL_OPERATOR_CONFIG.version,
        authoritativeNotice: "本文為繁體中文參考譯本。如不同語言版本之間存在任何歧異或衝突，均以英文原版（Authoritative English Version）為準。",
        sections: [
            {
                id: "acceptance",
                title: "1. 條款的接受",
                paragraphs: [
                    `歡迎使用 ${LEGAL_OPERATOR_CONFIG.productName}（由個人獨立經營者 ${LEGAL_OPERATOR_CONFIG.legalName} 營運，對外經營名稱為「${LEGAL_OPERATOR_CONFIG.tradeName}」，以下簡稱「我們」或「平台」）。`,
                    `本服務條款（「本條款」）規範您存取與使用我們位於 ${LEGAL_OPERATOR_CONFIG.domain} 的線上創作平台。註冊帳號、充值積分或使用服務即表示您已年滿 18 歲，已完整閱讀並同意受本條款及《隱私權政策》約束。`,
                ],
                callout: "特別提示：若您不同意本條款全部或部分內容，請立即停止使用本服務。條款更新後繼續使用即視為接受最新修訂。",
            },
            {
                id: "services",
                title: "2. 數位服務說明與即時交付",
                paragraphs: [
                    `${LEGAL_OPERATOR_CONFIG.tradeName} 是一套面向 AI 影視與短劇創作的數位化線上軟體工具（SaaS），提供劇本分鏡改編、文生圖、文生影片、音訊生成及專案畫布協同。`,
                    "即時數位交付：您購買的積分充值包與儲存擴容包均為純數位化無形權益。在支付通道確認扣款成功後，系統即時完成帳戶充值入帳，即刻具備呼叫能力，不涉及任何物理貨物的物流運輸或實物簽收環節。",
                ],
            },
            {
                id: "account",
                title: "3. 帳號註冊與安全保管",
                paragraphs: ["註冊時須提供真實、準確的個人資訊。您對妥善保管登入憑證及該帳號下的全部操作負有完全法律責任。", `如發現帳號存在任何未經授權的異常登入，應立即透過 ${LEGAL_OPERATOR_CONFIG.supportEmail} 通知我們協助處理。`],
            },
            {
                id: "billing",
                title: "4. 計費模式與積分方案（V2 一次性充值）",
                paragraphs: ["本平台嚴格採用一次性預付積分計費體系，絕無訂閱自動續費、無任何形式的週期性靜默扣款，每一筆帳單均由您本人主動下單支付觸發。"],
                bullets: [
                    "積分充值包：一次性購買相應額度的算力積分，按各 AI 模型公開明碼標價進行呼叫扣除。",
                    "儲存擴容包：一次性購買一定有效期的專案素材儲存配額。",
                    "積分有效期：透過主動購買獲得的算力積分在本平台正常營運期內永久有效、不設過期時間。活動贈送積分以公示活動規則為準。",
                ],
            },
            {
                id: "payment",
                title: "5. 支付授權與 PCI-DSS 處理合規",
                paragraphs: [
                    `本站線上收款業務由具有 PCI-DSS 國際安全認證資質的記錄商戶（MOR）服務商 ${LEGAL_OPERATOR_CONFIG.paymentProcessor} 提供處理。`,
                    "本站伺服器絕不留存或觸碰您的完整銀行卡號、到期日或 CVC 安全碼，支付卡資料全程由持牌支付機構在加密環境中處理。",
                    "站內展示的標價已包含支付通道手續費，結帳時不會向您加收意外附加費。",
                ],
            },
            {
                id: "refund",
                title: "6. 退款政策與生成失敗沖正",
                paragraphs: ["基於數位算力即時履約的特性，退款適用以下明確透明規則："],
                bullets: [
                    "7 天未使用全額退款：自充值購買之日起 7 個日曆天內，若該筆訂單對應的積分尚未產生任何實際算力消耗，您可以申請 100% 全額原路退款。",
                    "已消耗算力不予退還：若積分已實際呼叫模型用於渲染圖像、生成影片或音樂，已消耗部分無法申請退款。",
                    "生成失敗自動沖正：因平台技術故障或上游模型供應商中斷導致任務生成失敗而未交付結果的，為該任務凍結的積分將自動解凍並沖正退回帳戶。",
                    `退款申請方式：致信 ${LEGAL_OPERATOR_CONFIG.supportEmail} 註明註冊信箱與訂單號，審核通過後將在 5–10 個工作日內由原支付管道原路退回。`,
                ],
            },
            {
                id: "disputes",
                title: "7. 帳單爭議與拒付防範",
                paragraphs: [
                    `您的信用卡對帳單將顯示對外經營名稱：「${LEGAL_OPERATOR_CONFIG.tradeName}」或「PANCAKE*SUPDANCE」。`,
                    `若您對扣款存在任何疑問，請優先聯繫 ${LEGAL_OPERATOR_CONFIG.supportEmail}。我們承諾在 2 個工作日內回覆並在 5 個工作日內核實處理，避免不必要的銀行爭議或拒付。`,
                ],
            },
            {
                id: "intellectual-property",
                title: "8. AI 輸出內容與智慧財產權",
                paragraphs: ["在您遵守本條款及 AUP 的前提下，您使用已購積分生成的最終創作產物（包含圖片、影片與劇本分鏡）的合法權益均歸您所有。", "您可以將該產物自由用於商業營運、發布或授權，但不得用於違反公序良俗或侵害他人智慧財產權的非法用途。"],
            },
            {
                id: "disclaimers",
                title: "9. 免責聲明與責任上限",
                paragraphs: [
                    "本服務按「現狀」和「現有可用狀態」提供。受限於生成式 AI 技術的客觀發展階段，平台不保證模型生成內容的絕對真實性或無瑕性。",
                    `在法律允許的最大範圍內，平台累計承擔的賠償責任上限以您在爭議發生前 3 個月內向平台實際支付的總費用為限。`,
                ],
            },
            {
                id: "general",
                title: "10. 適用法律與通用條款",
                paragraphs: ["本條款受營運主體所在司法管轄區法律管轄。雙方發生爭議時應秉持誠信友好原則先予協商解決。", "語言效力：本服務條款以英文文本（Authoritative English Version）為唯一權威依據，多語言翻譯件僅供創作者理解參考。"],
            },
        ],
    },
    ja: {
        title: "利用規約 (Terms of Service)",
        badge: "TOS · V2 都度払いクレジット制 · WAFFO PANCAKE 記録商標",
        summary: "アカウントの利用、デジタル即時提供、PCI-DSS 安全決済、返金保証、および AI 創作資産の帰属を定める法的合意文書。",
        effectiveDate: "2026年11月04日",
        version: LEGAL_OPERATOR_CONFIG.version,
        authoritativeNotice: "本文は日本語参考訳です。翻訳と英語原文の間に不一致がある場合は、英語原文（Authoritative English Version）が優先されます。",
        sections: [
            {
                id: "acceptance",
                title: "1. 規約への同意",
                paragraphs: [
                    `${LEGAL_OPERATOR_CONFIG.productName}（個人事業者 ${LEGAL_OPERATOR_CONFIG.legalName} が運営、屋号「${LEGAL_OPERATOR_CONFIG.tradeName}」、以下「当社」または「当プラットフォーム」）へようこそ。`,
                    `本利用規約（以下「本規約」）は、${LEGAL_OPERATOR_CONFIG.domain} にて提供するオンライン制作ツールの利用条件を定めます。アカウント登録、クレジット購入または本サービスの利用により、お客様は18歳以上であり、本規約およびプライバシーポリシーに同意したものとみなされます。`,
                ],
                callout: "重要なお知らせ：本規約の全部または一部に同意いただけない場合は、直ちにサービスの利用を中止してください。規約改定後の継続利用は改定への同意とみなされます。",
            },
            {
                id: "services",
                title: "2. デジタルサービスと即時提供",
                paragraphs: [
                    `${LEGAL_OPERATOR_CONFIG.tradeName} は、AI 映像・ショートドラマ制作向けの SaaS スイートを提供し、脚本改編、画像生成、動画合成、音声合成および無限キャンバス連携を含みます。`,
                    "即時デジタル提供：当サイトで購入されるクレジットパックおよびストレージ拡張パックは、純粋な無形デジタル権利です。決済完了と同時にアカウントへ即時反映され、利用可能状態となります。物理的な商品の発送や受領書発行は伴いません。",
                ],
            },
            {
                id: "account",
                title: "3. アカウント管理とセキュリティ",
                paragraphs: [
                    "登録時には正確かつ最新の個人情報を提供してください。ログイン情報の厳格な保管およびアカウント下で行われるすべての活動については、お客様自身が責任を負うものとします。",
                    `不正アクセスや異常を検知した場合は、直ちに ${LEGAL_OPERATOR_CONFIG.supportEmail} までご連絡ください。`,
                ],
            },
            {
                id: "billing",
                title: "4. 料金体系とクレジットモデル（V2 都度払い）",
                paragraphs: [
                    "当サービスは、事前チャージによる都度払い（プリペイド）クレジットモデルを採用しています。定期購入（サブスクリプション）の自動更新や周期的な引き落としは一切ありません。すべての請求はお客様自身のアクティブな購入操作によってのみ発生します。",
                ],
                bullets: [
                    "クレジットチャージパック：AI モデルの公開レートに従って消費される計算リソーストークンの一括購入。",
                    "ストレージ拡張パック：一定期間有効なプロジェクト素材ストレージ容量の一括購入。",
                    "クレジットの有効期限：正規購入されたクレジットはプラットフォームの営業継続中無期限で有効であり、失効しません。キャンペーン付与クレジットは各キャンペーン規約に準じます。",
                ],
            },
            {
                id: "payment",
                title: "5. 決済承認と PCI-DSS コンプライアンス",
                paragraphs: [
                    `すべてのオンライン決済取引は、認定 Merchant of Record（MOR）パートナーである ${LEGAL_OPERATOR_CONFIG.paymentProcessor} を通じて安全に処理されます。`,
                    "当社のサーバーはお客様の完全なクレジットカード番号、有効期限、または CVC セキュリティコードを保持または保存しません。カードデータは PCI-DSS レベル 1 認証の保護ボールト内で直接処理されます。",
                    "表示価格には決済手数料が含まれており、決済時に予告のない追加手数料が加算されることはありません。",
                ],
            },
            {
                id: "refund",
                title: "6. 返金ポリシーと失敗タスクの自動返還",
                paragraphs: ["デジタル計算リソースの即時提供という性質に基づき、返金には以下の明確なルールが適用されます："],
                bullets: [
                    "7 日間未使用 100% 返金保証：購入日から 7 暦日以内であり、かつ当該パッケージのクレジットが 1 トークンも消費されていない場合に限り、全額返金を申請できます。",
                    "消費済み計算リソースの返金不可：AI 画像、動画、または音声の生成に実際に消費されたクレジットの返金はできません。",
                    "生成失敗時の自動返還：システム障害や上流モデルの中断により生成が失敗した場合、当該タスク用に凍結されたクレジットは自動的に残高へ即座に返還されます。",
                    `返金申請方法：登録メールアドレスと注文番号を明記の上、${LEGAL_OPERATOR_CONFIG.supportEmail} までご連絡ください。承認後 5〜10 営業日以内に購入元の決済手段へ返金されます。`,
                ],
            },
            {
                id: "disputes",
                title: "7. 請求に関するお問い合わせとチャージバック防止",
                paragraphs: [
                    `クレジットカード明細書には「${LEGAL_OPERATOR_CONFIG.tradeName}」または「PANCAKE*SUPDANCE」と表示されます。`,
                    `請求に関してご不明な点がございましたら、銀行への異議申立を行う前に ${LEGAL_OPERATOR_CONFIG.supportEmail} までお問い合わせください。2 営業日以内に確認し、誠実に対応いたします。`,
                ],
            },
            {
                id: "intellectual-property",
                title: "8. AI 生成物の権利帰属と商用利用",
                paragraphs: [
                    "本規約および AUP を遵守する限り、購入クレジットを使用して生成された画像、動画、音声などの最終生成物に関する合法的な知的財産権はお客様に帰属します。",
                    "お客様は生成物を商業目的で自由に利用、公開、ライセンス供与できます。ただし、第三者の権利侵害や公序良俗に反する用途は固く禁じられます。",
                ],
            },
            {
                id: "disclaimers",
                title: "9. 免責事項と責任の制限",
                paragraphs: [
                    "本サービスは「現状有姿」かつ「提供可能な範囲」で提供されます。生成 AI 技術の特性上、モデル生成結果の絶対的な正確性や無謬性は保証されません。",
                    `法令で認められる最大限の範囲において、当社の責任上限は請求事由発生前 3 ヶ月間にお客様が当社に支払った総額を上限とします。`,
                ],
            },
            {
                id: "general",
                title: "10. 準拠法と一般条項",
                paragraphs: [
                    "本規約および一切の取引関係は、運営主体の管轄区域の準拠法に従うものとします。紛争が発生した場合は、信義誠実の原則に基づき協議解決を優先します。",
                    "言語条項：本規約は英語原文（Authoritative English Version）が唯一の法的基準であり、日本語訳は創作者の理解のための参考情報として提供されます。",
                ],
            },
        ],
    },
    ko: {
        title: "서비스 이용약관 (Terms of Service)",
        badge: "TOS · V2 일회성 충전 크레딧 모델 · WAFFO PANCAKE MOR",
        summary: "계정 이용, 디지털 크레딧의 즉시 제공, PCI-DSS 보안 결제, 7일 환불 정책 및 AI 창작물 지적 재산권 귀속에 관한 법적 계약.",
        effectiveDate: "2026년 11월 04일",
        version: LEGAL_OPERATOR_CONFIG.version,
        authoritativeNotice: "본 문서는 한국어 번역본입니다. 번역본과 영어 원문 간에 불일치가 발생하는 경우 영어 원문(Authoritative English Version)이 우선합니다.",
        sections: [
            {
                id: "acceptance",
                title: "1. 약관의 동의",
                paragraphs: [
                    `${LEGAL_OPERATOR_CONFIG.productName}(개인 사업자 ${LEGAL_OPERATOR_CONFIG.legalName} 운영, 상호 "${LEGAL_OPERATOR_CONFIG.tradeName}", 이하 "당사" 또는 "플랫폼")에 오신 것을 환영합니다.`,
                    `본 이용약관(이하 "약관")은 ${LEGAL_OPERATOR_CONFIG.domain}에서 제공하는 온라인 창작 플랫폼 서비스의 이용 조건을 규정합니다. 계정 등록, 크레딧 충전 또는 서비스를 이용함으로써 귀하는 만 18세 이상이며 본 약관 및 개인정보 처리방침에 구속되는 데 동의한 것으로 간주됩니다.`,
                ],
                callout: "중요 안내: 본 약관의 내용에 동의하지 않는 경우 서비스 이용을 즉시 중단하십시오. 약관 개정 후 계속 이용하는 것은 변경된 약관에 대한 동의로 간주됩니다.",
            },
            {
                id: "services",
                title: "2. 디지털 서비스 안내 및 즉시 공급",
                paragraphs: [
                    `${LEGAL_OPERATOR_CONFIG.tradeName}는 AI 영상 및 숏드라마 창작을 위한 온라인 SaaS 솔루션으로, 대본 각색, 텍스트 기반 이미지/비디오 생성, 음악 생성 및 무한 캔버스 협업을 제공합니다.`,
                    "즉시 디지털 공급: 플랫폼에서 구매하는 모든 크레딧 패키지 및 스토리지 확장팩은 순수한 디지털 권리입니다. 결제 승인 즉시 계정에 반영되어 사용 가능한 상태가 되며, 물리적 물품의 배송이나 택배 수령 과정은 포함되지 않습니다.",
                ],
            },
            {
                id: "account",
                title: "3. 계정 보안 및 정보 등록",
                paragraphs: [
                    "회원가입 시 정확하고 진실된 정보를 제공해야 합니다. 귀하는 계정 로그인 자격 증명의 기밀 유지와 계정 내에서 발생하는 모든 활동에 대해 전적인 책임을 집니다.",
                    `무단 접근이나 보안 위험이 감지되면 즉시 ${LEGAL_OPERATOR_CONFIG.supportEmail}로 알려주시기 바랍니다.`,
                ],
            },
            {
                id: "billing",
                title: "4. 요금 체계 및 크레딧 모델 (V2 일회성 충전)",
                paragraphs: ["당사 플랫폼은 철저히 선불형 일회성 충전 크레딧 체계로 운영됩니다. 정기 구독 자동 갱신이나 주기적인 묵시적 결제가 전혀 없으며, 모든 결제는 사용자가 직접 승인한 건에 한해 발생합니다."],
                bullets: [
                    "크레딧 충전팩: 게시된 AI 모델 단가에 따라 작업을 실행하는 데 사용되는 토큰 일회성 구매.",
                    "스토리지 확장팩: 일정 유효 기간 동안 프로젝트 자산 용량을 확장하는 일회성 구매.",
                    "크레딧 유효 기간: 정상 구매한 크레딧은 플랫폼 운영 기간 동안 만료일 없이 영구 유효합니다. 프로모션 무료 지급 크레딧은 해당 이벤트 공지 규정을 따릅니다.",
                ],
            },
            {
                id: "payment",
                title: "5. 결제 승인 및 PCI-DSS 보안 표준",
                paragraphs: [
                    `모든 온라인 카드 결제는 PCI-DSS 레벨 1 인증을 취득한 공인 MOR(Merchant of Record) 파트너인 ${LEGAL_OPERATOR_CONFIG.paymentProcessor}을 통해 안전하게 처리됩니다.`,
                    "당사 서버는 고객의 완전한 신용카드 번호, 유효기간, CVV 보안코드를 일체 보관하거나 처리하지 않으며, 결제 데이터는 인증된 결제 금고에서 암호화 처리됩니다.",
                    "표시된 금액에는 표준 결제 수수료가 포함되어 있으며 결제 시 불시의 추가 요금이 부과되지 않습니다.",
                ],
            },
            {
                id: "refund",
                title: "6. 환불 정책 및 실패 작업 자동 복구",
                paragraphs: ["디지털 컴퓨팅 자원의 즉시 이행 특성에 따라 환불은 아래의 명확한 기준에 따릅니다:"],
                bullets: [
                    "7일 미사용 전액 환불: 구매일로부터 7일 이내에 해당 충전팩의 크레딧을 단 1회도 사용하지 않은 경우 100% 전액 환불을 요청할 수 있습니다.",
                    "소비된 자원 환불 불가: 이미지 렌더링, 영상 생성 등에 실제로 소모된 크레딧 부분은 환불이 불가합니다.",
                    "생성 실패 시 자동 복구: 시스템 오류나 업스트림 장애로 작업이 실패하여 결과물이 제공되지 않은 경우 차감 동결된 크레딧은 계정 잔액으로 즉시 자동 환원됩니다.",
                    `환불 신청: 가입 이메일과 주문 번호를 첨부하여 ${LEGAL_OPERATOR_CONFIG.supportEmail}로 접수하며, 승인 후 5~10영업일 이내에 원래 결제 수단으로 환불됩니다.`,
                ],
            },
            {
                id: "disputes",
                title: "7. 청구 문의 및 차지백 방지",
                paragraphs: [
                    `신용카드 청구 내역에는 "${LEGAL_OPERATOR_CONFIG.tradeName}" 또는 "PANCAKE*SUPDANCE"로 표기됩니다.`,
                    `결제 내역에 의문이 있으신 경우 카드사 분쟁을 제기하기 전에 ${LEGAL_OPERATOR_CONFIG.supportEmail}로 먼저 연락해 주시면 2영업일 이내에 성실히 확인 및 처리해 드립니다.`,
                ],
            },
            {
                id: "intellectual-property",
                title: "8. AI 생성물 권리 귀속 및 상업적 이용",
                paragraphs: [
                    "본 약관과 AUP를 준수하는 조건 하에, 구매한 크레딧으로 생성한 이미지, 동영상 등 모든 최종 작업물에 대한 권리는 창작자 본인에게 귀속됩니다.",
                    "귀하는 결과물을 상업적 용도로 자유롭게 활용, 배포, 라이선스할 수 있으나 제3자의 권리를 침해하거나 법률을 위반하는 용도로는 사용할 수 없습니다.",
                ],
            },
            {
                id: "disclaimers",
                title: "9. 면책 조항 및 책임의 한계",
                paragraphs: [
                    '서비스 및 AI 산출물은 "있는 그대로(AS IS)" 제공됩니다. 생성형 AI 기술의 특성상 모델 결과물의 절대적인 무결성이나 정확성을 보증하지 않습니다.',
                    `법률이 허용하는 최대 범위 내에서 당사의 누적 배상 책임은 분쟁 발생 전 3개월 동안 귀하가 지불한 총 금액을 초과하지 않습니다.`,
                ],
            },
            {
                id: "general",
                title: "10. 준거법 및 일반 조항",
                paragraphs: [
                    "본 약관 및 서비스 이용과 관련된 분쟁은 운영 주체의 관할 법률을 따릅니다. 분쟁 발생 시 상호 신의성실의 원칙에 입각하여 원만한 협의를 우선 진행합니다.",
                    "언어 조항: 본 이용약관은 영어 원문(Authoritative English Version)이 법적 효력을 갖는 유일한 기준이며, 한국어 번역은 창작자의 이해를 돕기 위한 참고 자료입니다.",
                ],
            },
        ],
    },
    es: {
        title: "Términos de Servicio (Terms of Service)",
        badge: "TOS · MODELO DE CRÉDITOS V2 · WAFFO PANCAKE MOR",
        summary: "Contrato legal vinculante que regula el uso de cuentas, la entrega digital instantánea, facturación segura PCI-DSS y propiedad de activos de IA.",
        effectiveDate: "4 de noviembre de 2026",
        version: LEGAL_OPERATOR_CONFIG.version,
        authoritativeNotice: "Versión en español para fines informativos. En caso de discrepancia, prevalecerá la versión oficial en inglés (Authoritative English Version).",
        sections: [
            {
                id: "acceptance",
                title: "1. Aceptación de los Términos",
                paragraphs: [
                    `Bienvenido a ${LEGAL_OPERATOR_CONFIG.productName} (operado por el comerciante individual ${LEGAL_OPERATOR_CONFIG.legalName}, bajo el nombre comercial "${LEGAL_OPERATOR_CONFIG.tradeName}", en adelante "la Plataforma" o "nosotros").`,
                    `Estos Términos de Servicio ("Términos") rigen el acceso y uso de nuestra plataforma creativa en ${LEGAL_OPERATOR_CONFIG.domain}. Al registrar una cuenta, adquirir créditos o utilizar los servicios, usted confirma tener al menos 18 años y aceptar quedar vinculado por estos Términos y nuestra Política de Privacidad.`,
                ],
                callout: "Aviso importante: Si no está de acuerdo con estos Términos en su totalidad, cese inmediatamente el uso del servicio. El uso continuado tras modificaciones implica la aceptación vinculante.",
            },
            {
                id: "services",
                title: "2. Servicios Digitales y Entrega Instantánea",
                paragraphs: [
                    `${LEGAL_OPERATOR_CONFIG.tradeName} proporciona una suite SaaS en línea para flujos de trabajo creativos con IA, incluyendo adaptación de guiones, generación de imágenes, síntesis de video, audio y lienzos colaborativos.`,
                    "Entrega digital instantánea: Todos los paquetes de recarga de créditos y ampliación de almacenamiento adquiridos son derechos digitales intangibles. Una vez confirmado el pago por nuestro procesador, los créditos se abonan inmediatamente a su cuenta para su uso, sin envíos físicos ni logística de entrega tangible.",
                ],
            },
            {
                id: "account",
                title: "3. Seguridad de la Cuenta y Registro",
                paragraphs: [
                    "Usted se compromete a proporcionar información veraz, precisa y actualizada al registrarse. Es el único responsable de la confidencialidad de sus credenciales y de todas las actividades realizadas en su cuenta.",
                    `Si detecta cualquier acceso no autorizado, notifíquelo de inmediato a ${LEGAL_OPERATOR_CONFIG.supportEmail}.`,
                ],
            },
            {
                id: "billing",
                title: "4. Modelo de Precios y Créditos (V2 Pago Único)",
                paragraphs: [
                    "Nuestro servicio funciona exclusivamente mediante un modelo de créditos prepagados de pago único. NO tenemos planes de suscripción recurrente y NUNCA realizaremos cobros automáticos periódicos. Cada transacción se inicia voluntariamente por usted.",
                ],
                bullets: [
                    "Paquetes de créditos: Compra única de tokens de cálculo consumidos según las tarifas oficiales por modelo de IA.",
                    "Paquetes de almacenamiento: Compra única de cuota de almacenamiento para proyectos válida durante un periodo determinado.",
                    "Vigencia de los créditos: Los créditos adquiridos mediante compra no caducan mientras la plataforma permanezca operativa. Los créditos promocionales gratuitos se rigen por sus bases específicas.",
                ],
            },
            {
                id: "payment",
                title: "5. Autorización de Pago y Cumplimiento PCI-DSS",
                paragraphs: [
                    `Las transacciones de pago en línea son procesadas de forma segura a través de nuestro Merchant of Record (MOR) autorizado, ${LEGAL_OPERATOR_CONFIG.paymentProcessor}.`,
                    "Nuestros servidores nunca almacenan ni gestionan números de tarjeta de crédito completos ni códigos de seguridad CVV/CVC. Los datos se procesan en bóvedas certificadas con el estándar PCI-DSS Nivel 1.",
                    "Los precios indicados incluyen las tarifas de procesamiento estándar, sin recargos sorpresa al finalizar la compra.",
                ],
            },
            {
                id: "refund",
                title: "6. Política de Reembolso y Reversión Automática de Fallos",
                paragraphs: ["Debido a la naturaleza de aprovisionamiento inmediato de los recursos digitales, los reembolsos se rigen por los siguientes términos claros:"],
                bullets: [
                    "Garantía de reembolso de 7 días: Puede solicitar un reembolso del 100% de cualquier compra de créditos dentro de los 7 días naturales posteriores a la compra, siempre que no se haya consumido ningún crédito del paquete.",
                    "Consumo de recursos no reembolsable: Los créditos ya consumidos en la generación efectiva de imágenes, videos o audio no admiten reembolso.",
                    "Reversión automática por error: Si una tarea de generación falla por error interno del sistema o interrupción de proveedores ascendentes, los créditos bloqueados se devuelven automáticamente a su saldo.",
                    `Solicitud de reembolso: Escriba a ${LEGAL_OPERATOR_CONFIG.supportEmail} indicando su correo y número de pedido. Los reembolsos aprobados se devuelven al método de pago original en un plazo de 5 a 10 días hábiles.`,
                ],
            },
            {
                id: "disputes",
                title: "7. Consultas de Facturación y Prevención de Devoluciones",
                paragraphs: [
                    `En su extracto bancario aparecerá nuestra denominación: "${LEGAL_OPERATOR_CONFIG.tradeName}" o "PANCAKE*SUPDANCE".`,
                    `Si tiene dudas respecto a un cobro, contáctenos en ${LEGAL_OPERATOR_CONFIG.supportEmail} antes de iniciar una disputa bancaria o contracargo. Nos comprometemos a responder en 2 días hábiles y resolver discrepancias legítimas con prontitud.`,
                ],
            },
            {
                id: "intellectual-property",
                title: "8. Derechos sobre Contenidos de IA y Propiedad Intelectual",
                paragraphs: [
                    "Sujeto al cumplimiento de estos Términos y la AUP, usted conserva la titularidad y todos los derechos legales sobre los prompts y los activos generados con sus créditos adquiridos.",
                    "Puede utilizar, comercializar, publicar y licenciar libremente sus creaciones generadas, siempre que no infrinjan derechos de terceros ni violen prohibiciones legales.",
                ],
            },
            {
                id: "disclaimers",
                title: "9. Descargos de Responsabilidad y Límite de Responsabilidad",
                paragraphs: [
                    'El servicio y las salidas generadas se proporcionan "TAL CUAL" y "SEGÚN DISPONIBILIDAD", sin garantías de ningún tipo. La IA generativa puede producir resultados imprecisos.',
                    `En la medida máxima permitida por la ley, nuestra responsabilidad acumulada no excederá el importe total abonado por usted en los 3 meses anteriores al hecho causante.`,
                ],
            },
            {
                id: "general",
                title: "10. Ley Aplicable y Disposiciones Generales",
                paragraphs: [
                    "Estos Términos se regirán por las leyes aplicables en la jurisdicción del operador. En caso de disputa, las partes procurarán una resolución amistosa previa de buena fe.",
                    "Cláusula de idioma: La versión oficial en inglés (Authoritative English Version) prevalecerá legalmente ante cualquier discrepancia con versiones traducidas.",
                ],
            },
        ],
    },
};

// ==============================================================================
// 3. Privacy Policy - 包含 Waffo Pancake 与 GDPR/CCPA 合规条款
// ==============================================================================
export const PRIVACY_DOC_MAP: Record<SupportedLegalLanguage, LocalizedLegalDoc> = {
    en: {
        title: "Privacy Policy",
        badge: "PRIVACY POLICY · GDPR / CCPA COMPLIANCE",
        summary: "How Supdance collects, isolates, secures, and handles personal data, payment information, and your creative AI assets.",
        effectiveDate: LEGAL_OPERATOR_CONFIG.effectiveDate,
        version: LEGAL_OPERATOR_CONFIG.version,
        authoritativeNotice: "Authoritative English Version. In the event of any discrepancies or conflicting interpretations between translations and this English text, the English version shall prevail.",
        sections: [
            {
                id: "controller",
                title: "1. Data Controller Information",
                paragraphs: [
                    `The data controller responsible for the processing of your personal data under this policy is:`,
                    `Entity / Operator: ${LEGAL_OPERATOR_CONFIG.legalName} (Doing business as "${LEGAL_OPERATOR_CONFIG.tradeName}")`,
                    `Contact Email: ${LEGAL_OPERATOR_CONFIG.supportEmail}`,
                    `Official Website: ${LEGAL_OPERATOR_CONFIG.domain}`,
                ],
            },
            {
                id: "collection",
                title: "2. Information We Collect",
                paragraphs: ["We only collect the minimum personal data necessary to operate our creative studio platform:"],
                bullets: [
                    "Account Credentials: Email address, username, securely hashed passwords, and OAuth identifiers.",
                    "Transaction Metadata: Order IDs, timestamps, credit amounts, and payment status. We DO NOT collect or store your complete payment card number or CVV/CVC codes (handled directly by PCI-DSS certified processor Waffo Pancake).",
                    "Creative Content & Workspace Data: Text prompts, storyboard parameters, uploaded asset references, project canvas nodes, and generated media URLs.",
                    "Technical Logs: IP addresses, browser user agent, device timestamps, and error diagnostics for platform uptime and fraud detection.",
                ],
                callout: "Non-Sale Pledge: We do NOT sell, rent, or trade your personal information or your private creative assets to any third parties for monetary or marketing consideration under CCPA/CPRA.",
            },
            {
                id: "purposes",
                title: "3. Purposes and Legal Bases for Processing",
                paragraphs: ["We process your data strictly under recognized legal bases under the GDPR and applicable privacy frameworks:"],
                table: {
                    head: ["Processing Purpose", "Data Involved", "Legal Basis (GDPR)"],
                    rows: [
                        ["Service Provision & Canvas Rendering", "Account info, prompts, canvas state", "Performance of a Contract (Art. 6(1)(b))"],
                        ["Credit Billing & Order Verification", "Transaction IDs, amount, invoice records", "Performance of a Contract & Legal Obligation"],
                        ["Security & Fraud Prevention", "IP address, generation audit logs", "Legitimate Interests (Art. 6(1)(f))"],
                        ["Customer Support & Appeals", "Email inquiries, ticket messages", "Legitimate Interests & Performance of Contract"],
                    ],
                },
            },
            {
                id: "sharing",
                title: "4. Information Sharing & Third-Party Processors",
                paragraphs: ["We only share data with trusted infrastructure providers bound by strict confidentiality and data processing agreements:"],
                bullets: [
                    `Payment Processing: ${LEGAL_OPERATOR_CONFIG.paymentProcessor} (PCI-DSS Level 1 compliant Merchant of Record).`,
                    "AI Model Upstreams: Reputable, enterprise-grade model inference providers (e.g., text, image, and video synthesis APIs). Data transmitted to model endpoints is processed solely in-flight for generation and is not utilized for unauthorized public foundation model training.",
                    "Cloud Infrastructure: Certified cloud hosting and CDN partners for encrypted storage and fast asset delivery.",
                ],
            },
            {
                id: "security",
                title: "5. Data Security & Incident Notification",
                paragraphs: [
                    "We enforce industry-standard security protocols: end-to-end TLS/HTTPS encryption in transit, salted cryptographic password hashing, strict least-privilege role-based access control, and periodic vulnerability audits.",
                    "In the unlikely event of a confirmed security breach impacting your personal data, we will notify affected users and competent regulatory authorities within 72 hours in compliance with statutory obligations.",
                ],
            },
            {
                id: "rights",
                title: "6. Your Privacy Rights (GDPR & CCPA)",
                paragraphs: ["Depending on your geographic location, you enjoy the following enforceable rights:"],
                bullets: [
                    "Right of Access & Portability: Inquire what personal data we hold and receive a portable copy of your account assets.",
                    "Right to Rectification: Correct inaccurate or outdated profile information.",
                    'Right to Erasure ("Right to be Forgotten"): Request permanent deletion of your account and associated project data.',
                    "Account Deletion: Submit an account closure request directly in your workspace settings or email support.",
                ],
                callout: `To exercise any of these rights, contact our Privacy Desk at ${LEGAL_OPERATOR_CONFIG.supportEmail}. We will verify your identity and fulfill valid requests within 30 calendar days at no charge.`,
            },
            {
                id: "retention",
                title: "7. Data Retention & Minors",
                paragraphs: [
                    "We retain personal data only for as long as your account remains active. Upon verified account closure, all associated personal identifiers and project assets are permanently purged from active databases within 30 days.",
                    "Protection of Minors: Our services are designed for individuals aged 18 and older. We do not knowingly solicit or collect data from children.",
                ],
            },
            {
                id: "contact",
                title: "8. Policy Updates & Contact",
                paragraphs: [`We may update this Privacy Policy periodically. Significant changes will be announced on our website. For inquiries or rights requests, contact ${LEGAL_OPERATOR_CONFIG.supportEmail}.`],
            },
        ],
    },
    "zh-CN": {
        title: "隐私政策",
        badge: "PRIVACY POLICY · GDPR / CCPA 个人信息保护合规",
        summary: "详尽说明 Supdance 如何收集、隔离、加密保护您的个人数据、支付信息与 AI 影视创作资产。",
        effectiveDate: "2026年11月04日",
        version: LEGAL_OPERATOR_CONFIG.version,
        authoritativeNotice: "本文为中文参考译本。如不同语言版本之间存在任何歧义或冲突，均以英文原版（Authoritative English Version）为准。",
        sections: [
            {
                id: "controller",
                title: "1. 数据控制者基本信息",
                paragraphs: [
                    `依据适用个人信息保护法，您个人信息的数据控制者为：`,
                    `经营主体：${LEGAL_OPERATOR_CONFIG.legalName}（对外经营名称：“${LEGAL_OPERATOR_CONFIG.tradeName}”）`,
                    `隐私联系邮箱：${LEGAL_OPERATOR_CONFIG.supportEmail}`,
                    `服务网站：${LEGAL_OPERATOR_CONFIG.domain}`,
                ],
            },
            {
                id: "collection",
                title: "2. 我们收集的个人信息范围",
                paragraphs: ["我们遵循最小必要原则，仅收集维持影视创作服务正常运行所需的数据："],
                bullets: [
                    "账号凭据：登录邮箱、密码哈希（经加盐哈希保护，明文不可见）、第三方登录授权标识。",
                    "交易与流水记录：充值订单号、购买金额、积分消耗流水。我们绝不收集或存储您的完整信用卡卡号、到期日或 CVV 安全码（卡数据由持牌机构 Waffo Pancake 处理）。",
                    "创作资产与提示词：您在画布中编写的提示词指令、剧本分集、节点参数、参考图片与生成产物链接。",
                    "系统日志与网络诊断：访问 IP 地址、浏览器类型、操作时间戳与异常崩溃日志，用于系统稳定性维护与安全风控。",
                ],
                callout: "不出售承诺：依据 CCPA/CPRA 等法规要求，我们郑重承诺绝不出售、出租或交易用户的个人信息或私有创作资产以获取金钱或其他利益。",
            },
            {
                id: "purposes",
                title: "3. 个人信息使用目的与合法依据",
                paragraphs: ["我们严格基于 GDPR 及个人信息保护法规定的合法依据处理您的个人数据："],
                table: {
                    head: ["使用目的", "涉及数据类别", "法律依据（GDPR）"],
                    rows: [
                        ["提供 AI 画布创作与音视频生成服务", "账号信息、提示词、画布状态", "履行合同所必需（第 6(1)(b) 条）"],
                        ["处理积分充值、开具对账单据", "订单流水、充值记录", "履行合同及法定财务合规义务"],
                        ["防范网络滥用、保障平台安全", "IP 地址、异常调用审计日志", "合法利益（第 6(1)(f) 条）"],
                        ["受理客服咨询、退款与争议申诉", "工单记录、联络邮件", "履行合同及合法利益"],
                    ],
                },
            },
            {
                id: "sharing",
                title: "4. 共享与第三方处理者披露",
                paragraphs: ["我们仅在必要范围内与受保密协议及数据处理协议约束的可信第三方服务商共享数据："],
                bullets: [
                    `支付处理方：${LEGAL_OPERATOR_CONFIG.paymentProcessor}（具备 PCI-DSS Level 1 国际认证资质的合规记录商户）。`,
                    "主流 AI 模型供应商：业界合规的企业级大模型推理通道。系统仅传输生成必需的提示词，绝不将您的私有数据用于任何未经授权的公众大模型预训练。",
                    "云存储与 CDN 加速节点：用于加密存储素材并提供全球低延迟访问。",
                ],
            },
            {
                id: "security",
                title: "5. 数据安全措施与泄露应急响应",
                paragraphs: [
                    "我们部署了行业标准的安全防线：传输全程启用 TLS/HTTPS 加密，核心敏感数据使用高强度哈希加密，实施最小权限原则与访问控制审计。",
                    "如发生可能影响您个人信息安全的重大数据泄露事件，我们将在 72 小时内依法通报受影响用户及监管机构，并及时同步补救措施。",
                ],
            },
            {
                id: "rights",
                title: "6. 您的法定数据权利",
                paragraphs: ["依据 GDPR、CCPA 等适用法律，您对个人信息享有完整的自主权利："],
                bullets: [
                    "知情权与导出权：有权了解我们持有的数据并请求下载便携式副本。",
                    "更正权：随时在个人设置中心更新不准确或过时的信息。",
                    "删除权（被遗忘权）：请求永久抹除账号及关联的项目数据。",
                    "彻底注销通道：可在个人中心申请一键注销，或致信客服邮箱办理。",
                ],
                callout: `行使权利方式：请发送邮件至 ${LEGAL_OPERATOR_CONFIG.supportEmail}。我们将在核实身份后 30 个自然日内免费为您处理并回复。`,
            },
            {
                id: "retention",
                title: "7. 保留期限与未成年人保护",
                paragraphs: [
                    "我们仅在实现处理目的所需的最短期限内保留您的数据。账号注销后，所有非法律强制留存的个人数据将在 30 天内从活跃数据库彻底删除或做匿名化处理。",
                    "未成年人保护：本平台面向 18 周岁及以上的专业创作者，我们不会有意收集未成年人的个人信息。",
                ],
            },
            {
                id: "contact",
                title: "8. 政策变更与联系方式",
                paragraphs: [`政策发生重大变更时将提前公示通知。如对隐私保护有任何建议或投诉，请随时致信 ${LEGAL_OPERATOR_CONFIG.supportEmail}。`],
            },
        ],
    },
    "zh-TW": {
        title: "隱私權政策",
        badge: "PRIVACY POLICY · GDPR / CCPA 個人資訊保護合規",
        summary: "詳盡說明 Supdance 如何收集、隔離、加密保護您的個人資料、支付資訊與 AI 影視創作資產。",
        effectiveDate: "2026年11月04日",
        version: LEGAL_OPERATOR_CONFIG.version,
        authoritativeNotice: "本文為繁體中文參考譯本。如不同語言版本之間存在任何歧異或衝突，均以英文原版（Authoritative English Version）為準。",
        sections: [
            {
                id: "controller",
                title: "1. 資料控制者基本資訊",
                paragraphs: [
                    `依據適用個人資訊保護法，您個人資訊的資料控制者為：`,
                    `營運主體：${LEGAL_OPERATOR_CONFIG.legalName}（對外經營名稱：「${LEGAL_OPERATOR_CONFIG.tradeName}」）`,
                    `隱私聯繫信箱：${LEGAL_OPERATOR_CONFIG.supportEmail}`,
                    `服務網站：${LEGAL_OPERATOR_CONFIG.domain}`,
                ],
            },
            {
                id: "collection",
                title: "2. 我們收集的個人資訊範圍",
                paragraphs: ["我們遵循最小必要原則，僅收集維持影視創作服務正常運作所需之資料："],
                bullets: [
                    "帳號憑證：登入信箱、密碼雜湊（經加鹽保護，明文不可見）、第三方登入授權識別碼。",
                    "交易與流水紀錄：充值訂單號、購買金額、積分消耗流水。我們絕不收集或儲存您的完整信用卡卡號、到期日或 CVV 安全碼（卡片資料由持牌機構 Waffo Pancake 處理）。",
                    "創作資產與提示詞：您在畫布中編寫的提示詞指令、劇本分集、節點參數、參考圖片與生成產物連結。",
                    "系統日誌與網路診斷：連線 IP 位址、瀏覽器類型、操作時間戳記與異常崩潰紀錄，用於系統穩定性維護與安全風控。",
                ],
                callout: "不出售承諾：依據 CCPA/CPRA 等法規要求，我們鄭重承諾絕不出售、出租或交易使用者的個人資訊或私有創作資產以獲取金錢或其他利益。",
            },
            {
                id: "purposes",
                title: "3. 個人資訊使用目的與合法依據",
                paragraphs: ["我們嚴格基於 GDPR 及個人資訊保護法規定的合法依據處理您的個人資料："],
                table: {
                    head: ["使用目的", "涉及資料類別", "法律依據（GDPR）"],
                    rows: [
                        ["提供 AI 畫布創作與音視訊生成服務", "帳號資訊、提示詞、畫布狀態", "履行合約所必需（第 6(1)(b) 條）"],
                        ["處理積分充值、開具對帳單據", "訂單流水、充值紀錄", "履行合約及法定財務合規義務"],
                        ["防範網路濫用、保障平台安全", "IP 位址、異常呼叫審計日誌", "合法利益（第 6(1)(f) 條）"],
                        ["受理客服諮詢、退款與爭議申訴", "工單紀錄、聯絡郵件", "履行合約及合法利益"],
                    ],
                },
            },
            {
                id: "sharing",
                title: "4. 共享與第三方處理者揭露",
                paragraphs: ["我們僅在必要範圍內與受保密協議及資料處理協議約束的可信第三方服務商共享資料："],
                bullets: [
                    `支付處理方：${LEGAL_OPERATOR_CONFIG.paymentProcessor}（具備 PCI-DSS Level 1 國際認證資質的合規記錄商戶）。`,
                    "主流 AI 模型供應商：業界合規的企業級大模型推理通道。系統僅傳輸生成必需的提示詞，絕不將您的私有資料用於任何未經授權的公眾大模型預訓練。",
                    "雲端儲存與 CDN 加速節點：用於加密儲存素材並提供全球低延遲存取。",
                ],
            },
            {
                id: "security",
                title: "5. 資料安全措施與外洩應變響應",
                paragraphs: [
                    "我們部署了業界標準的安全防線：傳輸全程啟用 TLS/HTTPS 加密，核心敏感資料使用高強度雜湊加密，實施最小權限原則與存取控制審計。",
                    "如發生可能影響您個人資訊安全的重大資料外洩事件，我們將在 72 小時內依法通報受影響使用者及監管機構，並及時同步補救措施。",
                ],
            },
            {
                id: "rights",
                title: "6. 您的法定資料權利",
                paragraphs: ["依據 GDPR、CCPA 等適用法律，您對個人資訊享有完整的自主權利："],
                bullets: [
                    "知情權與匯出權：有權了解我們持有的資料並請求下載便攜式複本。",
                    "更正權：隨時在個人設定中心更新不準確或過時的資訊。",
                    "刪除權（被遺忘權）：請求永久抹除帳號及關聯的專案資料。",
                    "徹底註銷管道：可在個人中心申請一鍵註銷，或致信客服信箱辦理。",
                ],
                callout: `行使權利方式：請發送郵件至 ${LEGAL_OPERATOR_CONFIG.supportEmail}。我們將在核實身分後 30 個日曆天內免費為您處理並回覆。`,
            },
            {
                id: "retention",
                title: "7. 保留期限與未成年人保護",
                paragraphs: [
                    "我們僅在實現處理目的所需的最短期限內保留您的資料。帳號註銷後，所有非法律強制留存的個人資料將在 30 天內從活躍資料庫徹底刪除或做匿名化處理。",
                    "未成年人保護：本平台面向 18 歲及以上的專業創作者，我們不會有意收集未成年人的個人資訊。",
                ],
            },
            {
                id: "contact",
                title: "8. 政策變更與聯絡方式",
                paragraphs: [`政策發生重大變更時將提前公示通知。如對隱私保護有任何建議或投訴，請隨時致信 ${LEGAL_OPERATOR_CONFIG.supportEmail}。`],
            },
        ],
    },
    ja: {
        title: "プライバシーポリシー (Privacy Policy)",
        badge: "PRIVACY POLICY · GDPR / CCPA 個人情報保護基準",
        summary: "Supdance がお客様の個人データ、決済情報、および AI 創作プロジェクト資産をどのように収集、隔離、暗号化保護しているかを詳述します。",
        effectiveDate: "2026年11月04日",
        version: LEGAL_OPERATOR_CONFIG.version,
        authoritativeNotice: "本文は日本語参考訳です。翻訳と英語原文の間に不一致がある場合は、英語原文（Authoritative English Version）が優先されます。",
        sections: [
            {
                id: "controller",
                title: "1. データ管理者情報",
                paragraphs: [
                    `適用される個人情報保護法令に基づき、お客様の個人データの管理者は以下の通りです：`,
                    `事業者 / 運営主体: ${LEGAL_OPERATOR_CONFIG.legalName}（屋号:「${LEGAL_OPERATOR_CONFIG.tradeName}」）`,
                    `お問い合わせ窓口: ${LEGAL_OPERATOR_CONFIG.supportEmail}`,
                    `公式ウェブサイト: ${LEGAL_OPERATOR_CONFIG.domain}`,
                ],
            },
            {
                id: "collection",
                title: "2. 収集する個人情報の範囲",
                paragraphs: ["当社は、最小限度の原則に従い、創作サービスの正常な運営に不可欠な情報のみを収集します："],
                bullets: [
                    "アカウント認証情報：登録メールアドレス、ソルト付きハッシュ化パスワード、OAuth 連携識別子。",
                    "取引および決済履歴：注文番号、購入金額、クレジット消費履歴。完全なクレジットカード番号や CVV コードは一切収集・保存しません（認定機関 Waffo Pancake が処理）。",
                    "創作アセットおよびプロンプト：キャンバスに入力されたプロンプト、脚本設定、参照画像、生成されたメディアの URL。",
                    "システムログおよび診断情報：IP アドレス、ブラウザの種類、アクセス日時、エラーログ（安定性維持および不正防止目的）。",
                ],
                callout: "個人データ非売却の誓約：CCPA/CPRA 等に基づき、当社はお客様の個人情報やプライベートな創作資産を金銭的対価のために第三者へ販売、賃貸、または取引しないことを誓約します。",
            },
            {
                id: "purposes",
                title: "3. 個人情報の利用目的および法的根拠 (GDPR)",
                paragraphs: ["当社は、GDPR が定める適法な根拠に基づいてお客様の個人データを厳格に処理します："],
                table: {
                    head: ["利用目的", "対象データ項目", "法的根拠 (GDPR)"],
                    rows: [
                        ["AI キャンバス創作および映像生成の提供", "アカウント情報、プロンプト、キャンバス状態", "契約の履行 (第6条(1)(b))"],
                        ["クレジット決済および注文履歴の管理", "注文番号、決済金額、請求書履歴", "契約の履行および法的義務の遵守"],
                        ["不正利用防止およびセキュリティ確保", "IP アドレス、生成監査ログ", "正当な利益 (第6条(1)(f))"],
                        ["カスタマーサポートおよび異議申立への対応", "問い合わせ履歴、サポートメール", "契約の履行および正当な利益"],
                    ],
                },
            },
            {
                id: "sharing",
                title: "4. 第三者委託先およびデータ共有",
                paragraphs: ["当社は、守秘義務契約およびデータ処理契約（DPA）を締結した信頼できるインフラ事業者との間でのみデータを共有します："],
                bullets: [
                    `決済処理事業者: ${LEGAL_OPERATOR_CONFIG.paymentProcessor}（PCI-DSS レベル 1 認証済みの合規 MOR パートナー）。`,
                    "主要 AI モデルプロバイダー：エンタープライズ水準の公式推論 API。生成に必要なプロンプトのみが転送され、無許可の一般モデル事前学習には利用されません。",
                    "クラウドインフラおよび CDN：暗号化された安全なストレージと低遅延配信を提供。",
                ],
            },
            {
                id: "security",
                title: "5. データセキュリティ対策とインシデント通知",
                paragraphs: [
                    "通信経路全体の TLS/HTTPS 暗号化、最高強度のパスワードハッシュ化、最小権限アクセス制御など、業界標準のセキュリティプロトコルを徹底しています。",
                    "万が一、お客様の権利に重大な影響を及ぼすデータ漏洩事案が発生した場合は、法令に従い 72 時間以内に対象ユーザーおよび管轄監督機関に通知します。",
                ],
            },
            {
                id: "rights",
                title: "6. お客様のプライバシー権利 (GDPR & CCPA)",
                paragraphs: ["お客様は、居住地に応じて以下の正当な権利を行使できます："],
                bullets: [
                    "アクセス権およびデータポータビリティ：保有データの開示およびポータブルな形式でのエクスポート請求。",
                    "訂正権：不正確または古い登録情報の修正要求。",
                    "消去権（忘れられる権利）：アカウントおよび関連するプロジェクトデータの完全削除要求。",
                    "アカウント退会手続き：ワークスペースの設定からワンクリックで退会を申請可能。",
                ],
                callout: `権利行使のご連絡先: ${LEGAL_OPERATOR_CONFIG.supportEmail} まで。本人確認完了後、30日以内に手数料なしで対応いたします。`,
            },
            {
                id: "retention",
                title: "7. データ保持期間と未成年者保護",
                paragraphs: [
                    "アカウントが有効である期間中のみデータを保持します。退会手続き完了後、法的義務に基づくものを除き、すべての個人データは 30 日以内に完全に消去または匿名化されます。",
                    "未成年者の保護：当サービスは 18 歳以上の創作者を対象としており、未成年者の個人情報を意図的に収集することはありません。",
                ],
            },
            {
                id: "contact",
                title: "8. ポリシーの改定とお問い合わせ",
                paragraphs: [`重大な改定を行う場合は事前に告知します。プライバシーに関するご相談やご要望は ${LEGAL_OPERATOR_CONFIG.supportEmail} までお寄せください。`],
            },
        ],
    },
    ko: {
        title: "개인정보 처리방침 (Privacy Policy)",
        badge: "PRIVACY POLICY · GDPR / CCPA 개인정보 보호 규정",
        summary: "Supdance가 사용자의 개인정보, 결제 데이터 및 AI 프로젝트 자산을 수집, 격리, 암호화하여 보호하는 방법에 대한 안내.",
        effectiveDate: "2026년 11월 04일",
        version: LEGAL_OPERATOR_CONFIG.version,
        authoritativeNotice: "본 문서는 한국어 번역본입니다. 번역본과 영어 원문 간에 불일치가 발생하는 경우 영어 원문(Authoritative English Version)이 우선합니다.",
        sections: [
            {
                id: "controller",
                title: "1. 개인정보 처리자 정보",
                paragraphs: [
                    `적용되는 개인정보 보호 법률에 따른 사용자의 개인정보 처리자는 다음과 같습니다:`,
                    `사업자 / 운영 주체: ${LEGAL_OPERATOR_CONFIG.legalName}(상호: "${LEGAL_OPERATOR_CONFIG.tradeName}")`,
                    `개인정보 문의 이메일: ${LEGAL_OPERATOR_CONFIG.supportEmail}`,
                    `공식 웹사이트: ${LEGAL_OPERATOR_CONFIG.domain}`,
                ],
            },
            {
                id: "collection",
                title: "2. 수집하는 개인정보 항목",
                paragraphs: ["당사는 창작 서비스의 정상 운영에 필수적인 최소한의 정보만을 원칙에 따라 수집합니다:"],
                bullets: [
                    "계정 자격 증명: 가입 이메일, 솔트가 적용된 단방향 암호화 비밀번호, OAuth 간편 로그인 식별자.",
                    "거래 및 결제 내역: 주문 번호, 결제 금액, 크레딧 사용 내역. 완전한 신용카드 번호나 CVV 보안코드는 저장하지 않습니다(공인 MOR Waffo Pancake에서 처리).",
                    "창작 자산 및 프롬프트: 캔버스에 작성된 프롬프트 지시어, 대본 분화, 파라미터 노드, 참조 이미지 및 생성 미디어 링크.",
                    "시스템 로그 및 네트워크 진단: 접속 IP 주소, 브라우저 유형, 활동 타임스탬프, 오류 로그(플랫폼 안정성 유지 및 부정 이용 방지).",
                ],
                callout: "개인정보 비판매 서약: CCPA/CPRA 규정에 따라 당사는 사용자의 개인정보나 비공개 창작 자산을 금전적 대가를 위해 제3자에게 판매, 임대 또는 거래하지 않습니다.",
            },
            {
                id: "purposes",
                title: "3. 처리 목적 및 법적 근거 (GDPR)",
                paragraphs: ["당사는 GDPR 등 법률이 정한 정당한 법적 근거에 기반하여 데이터를 엄격히 처리합니다:"],
                table: {
                    head: ["처리 목적", "해당 데이터 항목", "법적 근거 (GDPR)"],
                    rows: [
                        ["AI 캔버스 창작 및 영상/오디오 생성 서비스 제공", "계정 정보, 프롬프트, 캔버스 상태", "계약의 이행 (제6조(1)(b))"],
                        ["크레딧 결제 처리 및 주문 내역 영수증 관리", "주문 번호, 결제액, 세금 영수 내역", "계약의 이행 및 법적 회계 의무"],
                        ["부정 행위 방지 및 플랫폼 보안 유지", "접속 IP, 비정상 호출 감사 로그", "정당한 이익 (제6조(1)(f))"],
                        ["고객 지원 문의, 환불 및 이의 제기 처리", "상담 기록, 지원 이메일", "계약의 이행 및 정당한 이익"],
                    ],
                },
            },
            {
                id: "sharing",
                title: "4. 제3자 제공 및 위탁 처리자",
                paragraphs: ["당사는 엄격한 비밀유지계약 및 데이터처리계약(DPA)을 체결한 신뢰할 수 있는 파트너에 한해서만 데이터를 공유합니다:"],
                bullets: [
                    `결제 처리 대행사: ${LEGAL_OPERATOR_CONFIG.paymentProcessor}(PCI-DSS 레벨 1 인증을 취득한 공인 MOR 파트너).`,
                    "엔터프라이즈 AI 모델 공급사: 정식 기업용 추론 API를 통해서만 프롬프트를 전송하며, 미승인 일반 기초 모델의 사전 학습에 사용되지 않습니다.",
                    "클라우드 스토리지 및 CDN: 암호화된 저장 공간과 전 세계 저지연 전송 제공.",
                ],
            },
            {
                id: "security",
                title: "5. 데이터 보안 조치 및 유출 사고 통지",
                paragraphs: [
                    "전송 전 구간 TLS/HTTPS 암호화 적용, 비밀번호 솔트 해시화, 최소 권한 원칙 기반 접근 제어 등 업계 표준 보안 조치를 시행하고 있습니다.",
                    "사용자의 권리에 중대한 영향을 미치는 개인정보 유출 사고가 확인될 경우, 법률에 따라 72시간 이내에 피해 사용자와 규제 기관에 통지합니다.",
                ],
            },
            {
                id: "rights",
                title: "6. 사용자의 법적 권리 (GDPR 및 CCPA)",
                paragraphs: ["귀하는 관련 법률에 따라 다음과 같은 권리를 언제든지 행사할 수 있습니다:"],
                bullets: [
                    "열람 및 데이터 이동권: 당사가 보유한 본인 데이터 확인 및 이동 가능한 사본 다운로드 요청.",
                    "정정권: 부정확하거나 오래된 계정 프로필 정보의 수정.",
                    "삭제권(잊힐 권리): 계정 및 연결된 프로젝트 데이터의 영구 삭제 요청.",
                    "회원 탈퇴: 설정 센터 내에서 즉시 탈퇴를 요청하거나 고객센터를 통해 신청 가능.",
                ],
                callout: `권리 행사 접수: ${LEGAL_OPERATOR_CONFIG.supportEmail}로 이메일을 발송해 주시면 본인 확인 후 30일 이내에 수수료 없이 처리해 드립니다.`,
            },
            {
                id: "retention",
                title: "7. 데이터 보유 기간 및 미성년자 보호",
                paragraphs: [
                    "계정이 유지되는 기간 동안만 데이터를 보관합니다. 계정 탈퇴 시 법령에 따른 보존 의무 데이터를 제외한 모든 개인 데이터는 30일 이내에 완전히 삭제 또는 익명화됩니다.",
                    "미성년자 보호: 당사 서비스는 만 18세 이상의 성인 창작자를 대상으로 하며, 미성년자의 개인정보를 의도적으로 수집하지 않습니다.",
                ],
            },
            {
                id: "contact",
                title: "8. 정책 변경 및 문의 창구",
                paragraphs: [`정책에 중대한 변경이 있을 경우 사전에 공지합니다. 개인정보 보호와 관련된 모든 문의는 ${LEGAL_OPERATOR_CONFIG.supportEmail}로 접수해 주시기 바랍니다.`],
            },
        ],
    },
    es: {
        title: "Política de Privacidad (Privacy Policy)",
        badge: "PRIVACY POLICY · CUMPLIMIENTO RGPD Y CCPA",
        summary: "Detalles sobre cómo Supdance recopila, aísla, cifra y protege sus datos personales, información de pago y activos de creación de IA.",
        effectiveDate: "4 de noviembre de 2026",
        version: LEGAL_OPERATOR_CONFIG.version,
        authoritativeNotice: "Versión en español para fines informativos. En caso de discrepancia, prevalecerá la versión oficial en inglés (Authoritative English Version).",
        sections: [
            {
                id: "controller",
                title: "1. Información del Responsable del Tratamiento",
                paragraphs: [
                    `El responsable del tratamiento de sus datos personales bajo esta política es:`,
                    `Titular / Operador: ${LEGAL_OPERATOR_CONFIG.legalName} (Nombre comercial: "${LEGAL_OPERATOR_CONFIG.tradeName}")`,
                    `Correo de privacidad: ${LEGAL_OPERATOR_CONFIG.supportEmail}`,
                    `Sitio web oficial: ${LEGAL_OPERATOR_CONFIG.domain}`,
                ],
            },
            {
                id: "collection",
                title: "2. Información que Recopilamos",
                paragraphs: ["Aplicamos el principio de minimización de datos, recopilando únicamente la información indispensable para el servicio:"],
                bullets: [
                    "Credenciales de cuenta: Correo electrónico, contraseñas cifradas con sal criptográfica y tokens de autorización OAuth.",
                    "Metadatos de transacciones: Números de pedido, importes y consumos de créditos. NUNCA recopilamos ni almacenamos números completos de tarjetas de crédito o códigos CVV (gestionados por Waffo Pancake con certificación PCI-DSS).",
                    "Contenido creativo y datos de proyectos: Prompts introducidos en el lienzo, guiones, parámetros de nodos, imágenes de referencia y enlaces a medios generados.",
                    "Registros técnicos y diagnóstico: Direcciones IP, tipo de navegador, marcas de tiempo y registros de incidentes para seguridad y prevención de fraudes.",
                ],
                callout: "Compromiso de no venta: Conforme a la CCPA/CPRA, declaramos expresamente que NO vendemos, alquilamos ni comercializamos sus datos personales ni sus activos creativos privados por dinero u otro beneficio.",
            },
            {
                id: "purposes",
                title: "3. Finalidades y Bases Legales del Tratamiento (RGPD)",
                paragraphs: ["Tratamos sus datos estrictamente conforme a las bases legales reconocidas por el RGPD:"],
                table: {
                    head: ["Finalidad del Tratamiento", "Datos Implicados", "Base Legal (RGPD)"],
                    rows: [
                        ["Prestación del servicio de lienzo de IA y generación audiovisual", "Datos de cuenta, prompts, estado del lienzo", "Ejecución de un contrato (Art. 6(1)(b))"],
                        ["Facturación de créditos y gestión de comprobantes de pago", "Números de pedido, importes, facturas", "Ejecución de contrato y obligación legal"],
                        ["Seguridad, prevención de abusos y estabilidad de la plataforma", "Direcciones IP, registros de auditoría", "Interés legítimo (Art. 6(1)(f))"],
                        ["Atención al cliente, soporte técnico y recursos", "Historial de tickets, correos de contacto", "Ejecución de contrato e interés legítimo"],
                    ],
                },
            },
            {
                id: "sharing",
                title: "4. Destinatarios y Encargados del Tratamiento Terceros",
                paragraphs: ["Solo compartimos datos con proveedores de infraestructura tecnológica vinculados por acuerdos estrictos de protección de datos (DPA):"],
                bullets: [
                    `Procesamiento de pagos: ${LEGAL_OPERATOR_CONFIG.paymentProcessor} (Merchant of Record certificado con PCI-DSS Nivel 1).`,
                    "Proveedores de modelos de IA: Canales oficiales de inferencia de modelos empresariales. Los prompts se procesan en tránsito y no se destinan al entrenamiento público no autorizado de modelos.",
                    "Infraestructura en la nube y CDN: Almacenamiento seguro cifrado y distribución global de baja latencia.",
                ],
            },
            {
                id: "security",
                title: "5. Seguridad de los Datos y Notificación de Incidentes",
                paragraphs: [
                    "Aplicamos estándares de seguridad avanzados: cifrado TLS/HTTPS de extremo a extremo en tránsito, contraseñas protegidas con hashes seguros y control de accesos por mínimos privilegios.",
                    "En el improbable caso de una brecha de seguridad que afecte a sus datos personales, notificaremos a los usuarios afectados y a las autoridades en un plazo de 72 horas conforme a las exigencias legales.",
                ],
            },
            {
                id: "rights",
                title: "6. Sus Derechos de Privacidad (RGPD y CCPA)",
                paragraphs: ["Usted disfruta de los siguientes derechos protegidos por ley:"],
                bullets: [
                    "Derecho de acceso y portabilidad: Conocer qué datos personales conservamos y obtener una copia descargable.",
                    "Derecho de rectificación: Modificar información inexacta o desactualizada.",
                    'Derecho de supresión ("Derecho al olvido"): Solicitar el borrado definitivo de su cuenta y los proyectos asociados.',
                    "Cancelación de cuenta: Solicitud directa en los ajustes de su espacio de trabajo o mediante correo de soporte.",
                ],
                callout: `Para ejercer cualquiera de estos derechos, contáctenos en ${LEGAL_OPERATOR_CONFIG.supportEmail}. Atenderemos solicitudes verificadas en un plazo máximo de 30 días sin coste alguno.`,
            },
            {
                id: "retention",
                title: "7. Plazos de Conservación y Menores de Edad",
                paragraphs: [
                    "Conservamos los datos únicamente mientras su cuenta permanezca activa. Tras la confirmación de baja, los datos se eliminan definitivamente en un plazo de 30 días, salvo imperativo legal de conservación.",
                    "Protección de menores: Nuestros servicios están dirigidos a personas mayores de 18 años. No recopilamos conscientemente datos de menores de edad.",
                ],
            },
            {
                id: "contact",
                title: "8. Modificaciones y Contacto",
                paragraphs: [`Cualquier cambio sustancial en la política se notificará con anticipación. Para consultas de privacidad, escriba a ${LEGAL_OPERATOR_CONFIG.supportEmail}.`],
            },
        ],
    },
};
