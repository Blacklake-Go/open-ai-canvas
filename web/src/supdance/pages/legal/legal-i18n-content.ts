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
        authoritativeNotice: "本文為繁體中文參考譯本。如有歧異，均以英文原版（Authoritative English Version）為準。",
        sections: [
            {
                id: "scope",
                title: "1. 適用範圍",
                paragraphs: [`${LEGAL_OPERATOR_CONFIG.tradeName}（由 ${LEGAL_OPERATOR_CONFIG.legalName} 經營）致力於提供合法、安全之 AI 創作環境。本政策涵蓋提示詞、影像、音樂、影片及畫布專案。`],
            },
            {
                id: "content-standards",
                title: "2. 內容標準與禁止類別",
                paragraphs: ["嚴格禁止利用本服務生成或傳播以下六大類違規內容："],
                bullets: ["色情與成人內容（NSFW）", "暴力與血腥殘害內容", "仇恨言論與騷擾攻擊", "兒童不當內容（CSAM）—— 零容忍即時通報", "未經同意之深偽技術與冒充（Deepfake）", "侵犯專利、著作權或商標之行為"],
            },
            {
                id: "reporting",
                title: "3. 舉報管道與處理時效",
                paragraphs: [`舉報信箱：${LEGAL_OPERATOR_CONFIG.safetyEmail}。重大違規（L1）2小時內初步回應；高風險違規（L2）24小時內回應。`],
            },
            {
                id: "enforcement-actions",
                title: "4. 違規處置措施",
                paragraphs: ["平台可採取：書面警告、資產下架、暫時凍結生成權限、永久封禁帳號或移送司法機關。"],
            },
        ],
    },
    ja: {
        title: "利用許諾方針 (AUP)",
        badge: "AUP · コンテンツ基準と執行措置",
        summary: "Supdance プラットフォームにおける AI 生成コンテンツの安全基準、監査、通報窓口および違反対応措置。",
        effectiveDate: "2026年11月04日",
        version: LEGAL_OPERATOR_CONFIG.version,
        authoritativeNotice: "本文は日本語参考訳です。翻訳と英語原文の間に不一致がある場合は、英語原文（Authoritative English Version）が優先されます。",
        sections: [
            {
                id: "scope",
                title: "1. 適用範囲",
                paragraphs: [`${LEGAL_OPERATOR_CONFIG.tradeName}（運営者: ${LEGAL_OPERATOR_CONFIG.legalName}）は安全で責任ある AI 制作環境を提供します。本ポリシーはプロンプト、画像、動画、音声を含む全生成物に適用されます。`],
            },
            {
                id: "content-standards",
                title: "2. コンテンツ基準と禁止事項",
                paragraphs: ["以下のコンテンツの生成、処理、拡散を固く禁じます："],
                bullets: [
                    "ポルノおよび成人向け (NSFW) コンテンツ",
                    "暴力的および流血描写コンテンツ",
                    "ヘイトスピーチおよび嫌がらせ",
                    "児童虐待・搾取コンテンツ (CSAM) - ゼロトレランス対応",
                    "ディープフェイクおよび無断の成りすまし",
                    "知的財産権および商標権の侵害",
                ],
            },
            {
                id: "reporting",
                title: "3. 通報窓口および対応期間",
                paragraphs: [`通報専用窓口: ${LEGAL_OPERATOR_CONFIG.safetyEmail}。重大な違反は2時間以内に初期対応を行い、調査完了後に措置を実施します。`],
            },
            {
                id: "enforcement-actions",
                title: "4. 執行措置",
                paragraphs: ["警告、コンテンツ削除、機能制限、アカウント停止、および法執行機関への通報を含みます。"],
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
                title: "1. 적용 범위",
                paragraphs: [`${LEGAL_OPERATOR_CONFIG.tradeName}(운영자: ${LEGAL_OPERATOR_CONFIG.legalName})은 안전하고 합법적인 AI 창작 환경을 보장합니다. 본 정책은 프롬프트, 이미지, 비디오, 음성 등 모든 결과물에 적용됩니다.`],
            },
            {
                id: "content-standards",
                title: "2. 콘텐츠 표준 및 금지 카테고리",
                paragraphs: ["다음 카테고리에 해당하는 콘텐츠 생성 및 공유를 엄격히 금지합니다:"],
                bullets: ["음란물 및 성인(NSFW) 콘텐츠", "폭력적 및 유혈 표현물", "혐오 발언 및 괴롭힘", "아동 안전 침해(CSAM) - 무관용 즉각 신고", "딥페이크 및 무단 사칭", "지적 재산권 및 상표권 침해"],
            },
            {
                id: "reporting",
                title: "3. 신고 접수 및 처리 일정",
                paragraphs: [`신고 접수 이메일: ${LEGAL_OPERATOR_CONFIG.safetyEmail}. 중대 위반 건은 2시간 이내에 1차 조치를 진행합니다.`],
            },
            {
                id: "enforcement-actions",
                title: "4. 위반 제재 조치",
                paragraphs: ["서면 경고, 콘텐츠 삭제, 생성 기능 제한, 계정 영구 정지 및 사법 기관 인계를 포함합니다."],
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
                title: "1. Ámbito de Aplicación",
                paragraphs: [`${LEGAL_OPERATOR_CONFIG.tradeName} (operado por ${LEGAL_OPERATOR_CONFIG.legalName}) promueve un entorno creativo seguro y legal. Esta política rige todos los contenidos, prompts, imágenes, videos y pistas de audio.`],
            },
            {
                id: "content-standards",
                title: "2. Estándares de Contenido y Categorías Prohibidas",
                paragraphs: ["Queda estrictamente prohibido generar o divulgar:"],
                bullets: [
                    "Contenido pornográfico o explícito para adultos (NSFW)",
                    "Violencia gráfica, sangre y autolesiones",
                    "Discurso de odio y acoso sistemático",
                    "Material de abuso o explotación infantil (CSAM) - Tolerancia Cero",
                    "Deepfakes y suplantación no consentida de identidad",
                    "Vulneración de propiedad intelectual y marcas registradas",
                ],
            },
            {
                id: "reporting",
                title: "3. Reportes y Tiempos de Respuesta",
                paragraphs: [`Correo de denuncias: ${LEGAL_OPERATOR_CONFIG.safetyEmail}. Casos críticos se atienden en menos de 2 horas.`],
            },
            {
                id: "enforcement-actions",
                title: "4. Medidas Disciplinarias",
                paragraphs: ["Incluyen advertencia por escrito, retirada de activos, suspensión temporal, cierre definitivo de cuenta y derivación policial."],
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
        badge: "TOS · V2 點數計費模型",
        summary: "規範帳號使用、點數即時數位交付、PCI-DSS 安全付款、退款機制與 AI 成果權屬之具法律約束力條款。",
        effectiveDate: "2026年11月04日",
        version: LEGAL_OPERATOR_CONFIG.version,
        authoritativeNotice: "本文為繁體中文參考譯本。如有歧異，均以英文原版（Authoritative English Version）為準。",
        sections: [
            {
                id: "acceptance",
                title: "1. 條款接受",
                paragraphs: [`歡迎使用 ${LEGAL_OPERATOR_CONFIG.productName}（由 ${LEGAL_OPERATOR_CONFIG.legalName} 經營）。使用本服務即表示年滿 18 歲且同意本條款與隱私政策。`],
            },
            {
                id: "billing",
                title: "2. 點數方案與付款安全",
                paragraphs: ["本服務嚴格採用單次購買點數制，絕不自動扣款或訂閱續費。所有信用卡交易均由符合 PCI-DSS 規範之 Waffo Pancake 處理，平台不保存卡號。"],
            },
            {
                id: "refund",
                title: "3. 退款政策",
                paragraphs: [`未產生任何消耗的點數包可在購買後 7 天內全額退款。任務失敗點數自動回補。請致信 ${LEGAL_OPERATOR_CONFIG.supportEmail}。`],
            },
            {
                id: "intellectual-property",
                title: "4. AI 成果權利歸屬",
                paragraphs: ["在合乎法規與 AUP 前提下，您透過購買點數生成之創作產物，其權益歸您所有，可自由進行商業使用。"],
            },
        ],
    },
    ja: {
        title: "利用規約 (TOS)",
        badge: "TOS · V2 クレジットモデル",
        summary: "アカウント利用、クレジットの即時デジタル納品、PCI-DSS 決済、返金保証、AI 成果物の帰属に関する法的合意事項。",
        effectiveDate: "2026年11月04日",
        version: LEGAL_OPERATOR_CONFIG.version,
        authoritativeNotice: "本文は日本語参考訳です。翻訳と英語原文の間に不一致がある場合は、英語原文（Authoritative English Version）が優先されます。",
        sections: [
            {
                id: "acceptance",
                title: "1. 規約への同意",
                paragraphs: [`${LEGAL_OPERATOR_CONFIG.productName}（運営者: ${LEGAL_OPERATOR_CONFIG.legalName}）へようこそ。18歳以上のユーザーのみが本サービスを利用できます。`],
            },
            {
                id: "billing",
                title: "2. 料金体系および決済",
                paragraphs: ["本サービスは都度払いクレジット方式を採用しており、定期的な自動引き落としは一切ありません。カード決済は PCI-DSS 準拠の Waffo Pancake が処理します。"],
            },
            {
                id: "refund",
                title: "3. 返金ポリシー",
                paragraphs: [`未使用のクレジットは購入から7日以内であれば全額返金が可能です。生成失敗時はクレジットが即座に返還されます。申請は ${LEGAL_OPERATOR_CONFIG.supportEmail} まで。`],
            },
            {
                id: "intellectual-property",
                title: "4. AI 生成物の権利帰属",
                paragraphs: ["本規約を遵守する限り、購入クレジットで生成された画像や動画などの成果物の権利はお客様に帰属し、商用利用も可能です。"],
            },
        ],
    },
    ko: {
        title: "서비스 이용약관 (TOS)",
        badge: "TOS · V2 크레딧 모델",
        summary: "계정 이용, 디지털 크레딧의 즉시 제공, PCI-DSS 보안 결제, 환불 정책 및 AI 창작물 귀속에 대한 약관.",
        effectiveDate: "2026년 11월 04일",
        version: LEGAL_OPERATOR_CONFIG.version,
        authoritativeNotice: "본 문서는 한국어 번역본입니다. 불일치가 발생하는 경우 영어 원문(Authoritative English Version)이 우선합니다.",
        sections: [
            {
                id: "acceptance",
                title: "1. 약관의 동의",
                paragraphs: [`${LEGAL_OPERATOR_CONFIG.productName}(운영자: ${LEGAL_OPERATOR_CONFIG.legalName})에 오신 것을 환영합니다. 만 18세 이상 창작자만 이용할 수 있습니다.`],
            },
            {
                id: "billing",
                title: "2. 결제 방식 및 보안",
                paragraphs: ["정기 구독 자동 결제가 없으며, 일회성 크레딧 충전 방식으로만 운영됩니다. 결제는 PCI-DSS 인증 결제 대행사 Waffo Pancake을 통해 안전하게 처리됩니다."],
            },
            {
                id: "refund",
                title: "3. 환불 규정",
                paragraphs: [`사용하지 않은 크레딧은 구매 후 7일 이내에 전액 환불이 가능합니다. 작업 실패 시 크레딧은 자동 복구됩니다. 문의: ${LEGAL_OPERATOR_CONFIG.supportEmail}.`],
            },
            {
                id: "intellectual-property",
                title: "4. AI 창작물의 권리",
                paragraphs: ["약관을 준수하여 생성된 모든 이미지 및 비디오의 권리는 창작자 본인에게 귀속되며 상업적 활용이 가능합니다."],
            },
        ],
    },
    es: {
        title: "Términos de Servicio (TOS)",
        badge: "TOS · MODELO DE CRÉDITOS V2",
        summary: "Acuerdo legal que rige el uso de cuentas, entrega digital inmediata, facturación segura PCI-DSS y propiedad de activos de IA.",
        effectiveDate: "4 de noviembre de 2026",
        version: LEGAL_OPERATOR_CONFIG.version,
        authoritativeNotice: "Versión en español para fines informativos. En caso de discrepancia, prevalecerá la versión oficial en inglés (Authoritative English Version).",
        sections: [
            {
                id: "acceptance",
                title: "1. Aceptación de los Términos",
                paragraphs: [`Bienvenido a ${LEGAL_OPERATOR_CONFIG.productName} (operado por ${LEGAL_OPERATOR_CONFIG.legalName}). El uso del servicio está restringido a mayores de 18 años.`],
            },
            {
                id: "billing",
                title: "2. Facturación y Créditos V2",
                paragraphs: ["No realizamos cobros recurrentes automáticos. Los pagos con tarjeta se procesan en bóvedas certificadas PCI-DSS mediante Waffo Pancake."],
            },
            {
                id: "refund",
                title: "3. Política de Reembolso",
                paragraphs: [`Los créditos no utilizados pueden reembolsarse al 100% dentro de los primeros 7 días posteriores a la compra. Escriba a ${LEGAL_OPERATOR_CONFIG.supportEmail}.`],
            },
            {
                id: "intellectual-property",
                title: "4. Propiedad de Creaciones de IA",
                paragraphs: ["Usted conserva los derechos sobre los contenidos generados con sus créditos adquiridos, permitiéndose su explotación comercial."],
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
        title: "隱私政策",
        badge: "PRIVACY POLICY · 個資保護合規",
        summary: "說明 Supdance 如何收集、保護、隔離及處理您的個人資訊、支付記錄與 AI 影視專案資產。",
        effectiveDate: "2026年11月04日",
        version: LEGAL_OPERATOR_CONFIG.version,
        authoritativeNotice: "本文為繁體中文參考譯本。如有歧異，均以英文原版（Authoritative English Version）為準。",
        sections: [
            {
                id: "controller",
                title: "1. 數據控制者",
                paragraphs: [`控制者：${LEGAL_OPERATOR_CONFIG.legalName}（對外名稱：${LEGAL_OPERATOR_CONFIG.tradeName}），聯絡信箱：${LEGAL_OPERATOR_CONFIG.supportEmail}。`],
            },
            {
                id: "collection",
                title: "2. 收集範圍與承諾",
                paragraphs: ["僅收集帳號憑據、交易流水與創作畫布數據。絕不保存完整信用卡號（由 Waffo Pancake 處理），絕不出售個人資料。"],
            },
            {
                id: "rights",
                title: "3. 您的權益",
                paragraphs: [`享有查閱、複製、更正、刪除及註銷帳號之權利。請求請寄至 ${LEGAL_OPERATOR_CONFIG.supportEmail}。`],
            },
        ],
    },
    ja: {
        title: "プライバシーポリシー",
        badge: "PRIVACY POLICY · GDPR / CCPA 準拠",
        summary: "Supdance による個人情報、決済データおよび AI 制作アセットの収集、保護、安全管理に関する方針。",
        effectiveDate: "2026年11月04日",
        version: LEGAL_OPERATOR_CONFIG.version,
        authoritativeNotice: "本文は日本語参考訳です。翻訳と英語原文の間に不一致がある場合は、英語原文（Authoritative English Version）が優先されます。",
        sections: [
            {
                id: "controller",
                title: "1. 管理者情報",
                paragraphs: [`管理者: ${LEGAL_OPERATOR_CONFIG.legalName}（屋号: ${LEGAL_OPERATOR_CONFIG.tradeName}）、連絡先: ${LEGAL_OPERATOR_CONFIG.supportEmail}`],
            },
            {
                id: "collection",
                title: "2. 収集する情報と目的",
                paragraphs: ["アカウント情報、プロンプト、生成ログを収集します。カード情報は Waffo Pancake が処理し、当社のサーバーには保存されません。個人情報の第三者販売は行いません。"],
            },
            {
                id: "rights",
                title: "3. ユーザーの権利",
                paragraphs: [`データの開示、訂正、削除、アカウント消去を請求できます。連絡窓口: ${LEGAL_OPERATOR_CONFIG.supportEmail}`],
            },
        ],
    },
    ko: {
        title: "개인정보 처리방침",
        badge: "PRIVACY POLICY · 개인정보 보호",
        summary: "Supdance의 개인정보 수집, 암호화 보관, 제3자 비판매 원칙 및 AI 프로젝트 자산 관리에 대한 안내.",
        effectiveDate: "2026년 11월 04일",
        version: LEGAL_OPERATOR_CONFIG.version,
        authoritativeNotice: "본 문서는 한국어 번역본입니다. 불일치가 발생하는 경우 영어 원문(Authoritative English Version)이 우선합니다.",
        sections: [
            {
                id: "controller",
                title: "1. 개인정보 처리자",
                paragraphs: [`처리자: ${LEGAL_OPERATOR_CONFIG.legalName}(상호: ${LEGAL_OPERATOR_CONFIG.tradeName}), 문의 이메일: ${LEGAL_OPERATOR_CONFIG.supportEmail}`],
            },
            {
                id: "collection",
                title: "2. 수집 항목 및 비판매 원칙",
                paragraphs: ["계정 정보, 생성 프롬프트 및 거래 번호를 수집합니다. 신용카드 번호는 Waffo Pancake이 처리하며 당사는 저장하지 않습니다. 개인정보 판매는 절대 없습니다."],
            },
            {
                id: "rights",
                title: "3. 정보주체의 권리",
                paragraphs: [`열람, 정정, 삭제 및 계정 탈퇴를 요청할 수 있습니다. 문의: ${LEGAL_OPERATOR_CONFIG.supportEmail}`],
            },
        ],
    },
    es: {
        title: "Política de Privacidad",
        badge: "PRIVACY POLICY · RGPD Y CCPA",
        summary: "Recopilación, protección cifrada y derechos de los usuarios sobre sus datos personales y creaciones de IA en Supdance.",
        effectiveDate: "4 de noviembre de 2026",
        version: LEGAL_OPERATOR_CONFIG.version,
        authoritativeNotice: "Versión en español para fines informativos. En caso de discrepancia, prevalecerá la versión oficial en inglés (Authoritative English Version).",
        sections: [
            {
                id: "controller",
                title: "1. Responsable del Tratamiento",
                paragraphs: [`Responsable: ${LEGAL_OPERATOR_CONFIG.legalName} (${LEGAL_OPERATOR_CONFIG.tradeName}), Contacto: ${LEGAL_OPERATOR_CONFIG.supportEmail}`],
            },
            {
                id: "collection",
                title: "2. Información Recopilada",
                paragraphs: ["Recopilamos credenciales de cuenta, prompts y registros de transacciones. No almacenamos números de tarjeta de crédito (procesados por Waffo Pancake). No vendemos sus datos."],
            },
            {
                id: "rights",
                title: "3. Sus Derechos",
                paragraphs: [`Acceso, rectificación, portabilidad y supresión de cuenta. Escriba a ${LEGAL_OPERATOR_CONFIG.supportEmail}.`],
            },
        ],
    },
};
