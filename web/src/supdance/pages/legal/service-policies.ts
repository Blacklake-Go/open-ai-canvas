import type { AppLocale } from "@/i18n/locales";
import type { LocalizedLegalDoc } from "./legal-i18n-content";

export const LEGAL_LOCALE_MAP = { "zh-CN": "zh-CN", "en-US": "en", "fr-FR": "fr", "de-DE": "de", "ja-JP": "ja", "ko-KR": "ko" } as const satisfies Record<AppLocale, string>;
export type PolicyLanguage = (typeof LEGAL_LOCALE_MAP)[AppLocale];

type Copy = { terms: string; privacy: string; termsSummary: string; privacySummary: string; termsSections: [string, string][]; privacySections: [string, string][] };

// Reviewed document copy lives outside runtime translation: switching languages never translates user content.
const copy: Record<PolicyLanguage, Copy> = {
    en: {
        terms: "Terms of Service",
        privacy: "Privacy Policy",
        termsSummary: "These terms govern your use of Supdance at https://www.supdance.com, including its AI creative tools, projects, media assets and paid services. Please read them together with our Privacy Policy and Acceptable Use Policy.",
        privacySummary: "This policy explains how Supdance handles personal information when you use our website, creative workspace, AI generation tools and related support. It also explains your choices and how to contact us.",
        termsSections: [
            [
                "Scope and acceptance",
                "Supdance (‘we’, ‘us’) provides this web service. By creating an account or using a paid feature, you agree to these terms. If you disagree, stop using the service. You must be at least 18 and legally able to enter a contract. If you act for an organization, you must have authority to bind it. Questions may be sent to support@supdance.com.",
            ],
            [
                "Services and availability",
                "Our workspace supports scripts, storyboards, canvas projects, images, video, music and audio, subject to available models and enabled features. Services are delivered digitally. Model availability, processing time and output quality vary; a displayed estimate is not a guarantee. Maintenance, capacity limits or upstream failures may interrupt service. Material changes to paid entitlements will be communicated through the website or account contact details.",
            ],
            [
                "Accounts and security",
                "Provide accurate registration information, protect your credentials and keep account contact details current. You are responsible for your authorized use and for taking reasonable steps to secure access. Report suspected compromise promptly. Do not access another user’s account, share stolen credentials, bypass quotas or exploit errors. We may verify ownership before changing account access or handling sensitive requests.",
            ],
            [
                "Prices, credits and payments",
                "The purchase page and order confirmation specify the price, currency, taxes, credits, validity and any recurring payment terms. Check these before authorizing payment; a subscription requires the renewal terms shown at checkout. Credits are service units, not money, deposits or transferable currency. Task reservations and final charges follow the applicable model quote and settlement rules. A pending payment does not establish successful delivery; account entitlements follow verified payment status.",
            ],
            [
                "Refunds and billing issues",
                "You may request a full refund of an entirely unused credit purchase within 7 calendar days by emailing support@supdance.com with the account and order reference. Consumed generation resources are generally non-refundable, subject to mandatory consumer rights. Failed tasks release or reverse the relevant reservation according to the task’s final status; a credit reversal is different from a refund to a bank card. Report missing reversals, duplicate charges or non-delivery for review. Approved payment refunds use the original method where available; bank processing times vary. Nothing here limits statutory cancellation, refund or payment-dispute rights.",
            ],
            [
                "Your materials and AI outputs",
                "You retain your rights in materials you submit. You must have the rights and permissions needed for prompts, media, likenesses, voices and personal information. You authorize us and the providers involved to process, host, transmit and display those materials as necessary to deliver your requested features and secure the service. This does not give us an unrestricted right to advertise with private projects. Output rights depend on applicable law and model-specific terms; we do not guarantee copyright, uniqueness, exclusivity or freedom from third-party claims. Review outputs and licensing conditions before commercial use.",
            ],
            [
                "Acceptable use and sharing",
                "Do not create or distribute unlawful, sexually exploitative, fraudulent, threatening or infringing content, non-consensual intimate imagery, deceptive impersonation or malware. Do not evade safeguards, attack the service or obtain unauthorized data. Follow our Acceptable Use Policy at /aup. Obtain consent for a person’s face or voice where required and disclose synthetic content where applicable. You control deliberate publication and sharing; recipients may copy material and access links may be forwarded. Report abuse or rights violations to safety@supdance.com with the relevant URL and supporting details.",
            ],
            [
                "Suspension and termination",
                "You may stop using the service and request account closure through support. We may restrict content or access when reasonably necessary to address violations, fraud, security risks or legal requirements. Where feasible and lawful, we will explain the reason and provide an opportunity to contact support for review. Termination does not erase accrued payment obligations or mandatory refund rights. Data deletion and legally required retention are described in the Privacy Policy; export important work before closing an account.",
            ],
            [
                "AI limitations and liability",
                "AI output can be inaccurate, biased, unsafe or unsuitable. Independently review it before publication or decisions affecting others; it is not professional legal, medical or financial advice. We provide the service as available, subject to any non-excludable warranties. To the extent permitted by law, we exclude indirect or consequential losses, and our aggregate liability is limited to the service fees you paid in the three months preceding the event. These limits do not apply to fraud, intentional misconduct, liability that cannot lawfully be limited, or mandatory consumer protections.",
            ],
            [
                "Changes, disputes and contact",
                "We publish revisions on this page with an updated version. Material changes will be notified appropriately; where consent is legally required, we will request it. Contact support@supdance.com first so we can investigate a dispute. Applicable mandatory law and your right to approach a competent court or regulator remain unaffected. Translations support local understanding; no language clause removes mandatory local rights. If a provision is unenforceable, the remaining provisions continue to apply where lawful.",
            ],
        ],
        privacySections: [
            [
                "Scope and privacy contact",
                "This policy covers information handled through Supdance at https://www.supdance.com. Supdance is the service brand used in this policy. Send privacy requests to support@supdance.com. Third-party services you choose to use also apply their own privacy notices; this policy does not replace them.",
            ],
            [
                "Information we handle",
                "Depending on the features you use, we process account and contact information, password hashes, third-party login identifiers and authorized profile information; prompts, scripts, uploaded files, canvas and project data, generated media and task records; order references, amounts, payment status and credit ledger entries; and IP addresses, browser information, security logs and support correspondence. Do not submit unnecessary sensitive information or other people’s data without a lawful basis. Payment card details entered on a payment provider’s page are handled by that provider; never send full card details or passwords to support.",
            ],
            [
                "Purposes and legal grounds",
                "We use information to authenticate users, save projects, execute generation requests, deliver assets, settle orders and credits, respond to support, prevent abuse and meet legal obligations. Where applicable, processing relies on contract performance, legal obligations, legitimate interests balanced against your rights, or consent for optional features. Accepting terms is not blanket consent to every data use. We seek any separate consent required by law and explain material new purposes before processing on that basis.",
            ],
            [
                "AI models and service providers",
                "A generation request may transmit prompts, required reference media and task parameters to the selected model provider, including through configured routing services. Hosting, storage, delivery, login and payment providers receive information necessary for their function. Where generation safety screening is enabled, text prompts may be sent to Waffo Pancake; that screening request excludes reference media and model credentials. Provider retention and training practices depend on the selected service and its terms; we do not promise universal zero retention or no training. Avoid uploading confidential material unless the applicable arrangements meet your needs.",
            ],
            [
                "Publication and other disclosures",
                "Private workspace content is not authorized for public promotion merely because you use the service. If you deliberately publish or share material, it may be accessible to others and copied beyond our control. We may disclose information where reasonably necessary to comply with law, protect rights or investigate security incidents. In a business transfer, relevant information may transfer subject to applicable safeguards and notice obligations. We do not sell private projects as a product; optional advertising disclosures are explained separately below.",
            ],
            [
                "Cookies, local storage and advertising",
                "Necessary cookies maintain authentication. Browser storage retains preferences, and account-scoped IndexedDB caches projects and assets. Clearing local data may sign you out or remove unsynchronized work. Optional X advertising measurement activates only after consent and may communicate a confirmed purchase event, amount, currency and deduplication reference. Manage or withdraw that consent using the advertising preferences control on this page; withdrawal stops new measurement events but does not undo earlier lawful processing. X’s policy is available at https://x.com/en/privacy. Browser controls also let you clear or block storage.",
            ],
            [
                "International processing",
                "Our providers may process information in countries different from where you live, whose privacy rules may differ. Transfer requirements depend on your location and the receiving service. Where required, applicable safeguards or another lawful transfer mechanism must be used. You can ask support about the arrangements relevant to your task. Do not assume that choosing an interface language determines storage location or guarantees local-only processing.",
            ],
            [
                "Retention, deletion and security",
                "Retention depends on the service purpose, account status, asset references, backup cycles, legal recordkeeping and disputes. Deleting a project or account does not necessarily remove every linked asset, backup or transaction record immediately. Request deletion through support; we explain any lawful retention exceptions. We use access controls, credential hashing and secure transport to reduce risk, but no system is absolutely secure and storage is not represented as end-to-end encrypted. Where a reportable breach occurs, we notify the relevant authorities and affected people as required by applicable law.",
            ],
            [
                "Your rights and choices",
                "Depending on applicable law, you may request access, correction, deletion, a portable copy, restriction or objection, and withdraw consent. You may also have rights concerning sale/sharing, targeted advertising or significant automated decisions. Email support@supdance.com; we may request proportionate identity verification, never your password or full payment card number. We aim to respond within 30 calendar days and apply any shorter legal deadline; lawful extensions or refusals will be explained. Exports and requests may require manual handling. You may complain to a competent data protection authority and will not be penalized for exercising lawful rights.",
            ],
            [
                "Children and policy updates",
                "The service is intended for adults aged 18 and over. If you believe a child has provided personal information, contact support so we can investigate and take appropriate action. We update this notice when practices or requirements change and display the revision date. Material changes receive appropriate notice; new processing requiring consent will not rely solely on continued use. The advertising preferences control remains available for changing your choice.",
            ],
        ],
    },
    "zh-CN": {
        terms: "服务条款",
        privacy: "隐私政策",
        termsSummary: "本条款适用于你使用 https://www.supdance.com 提供的 Supdance AI 创作工具、项目工作区、媒体素材及付费服务。请结合《隐私政策》和《可接受使用政策》阅读。",
        privacySummary: "本政策说明 Supdance 在网站、创作工作区、AI 生成及客服服务中如何处理个人信息，以及你可以作出的选择、享有的权利和联系我们的方式。",
        termsSections: [
            ["适用范围与接受条款", "Supdance（下称“我们”）提供本网站服务。创建账号或使用付费功能，即表示你接受本条款；如不同意，请停止使用。你须年满 18 周岁，并具备订立合同的法律能力；代表组织使用时，须取得相应授权。疑问请联系 support@supdance.com。"],
            [
                "服务内容与可用性",
                "工作区支持剧本、分镜、画布项目、图片、视频、音乐及音频创作，具体以当前模型与已启用功能为准。服务均为数字交付。模型可用性、处理时间和生成质量可能变化，预计时间不构成保证。维护、容量限制或上游故障可能造成中断。付费权益的重大变更将通过网站或账号联系方式通知。",
            ],
            [
                "账号与安全",
                "请提供准确的注册信息，妥善保管登录凭据并及时更新联系方式。你应对授权使用行为负责，并采取合理措施保护账号；发现异常访问应及时通知我们。禁止访问他人账号、使用窃取的凭据、绕过配额或利用系统漏洞。修改账号访问权限或处理敏感请求前，我们可能核验账号归属。",
            ],
            [
                "价格、积分与支付",
                "购买页及订单确认信息载明价格、币种、税费、积分数量、有效期及可能存在的周期扣款条件，请在付款前核对。订阅须以结算页展示的续费条件为准。积分仅为服务计量单位，不是货币、存款或可转让的支付工具。任务预占与最终扣费遵循所选模型报价及结算规则。待支付状态不表示交易成功，权益以核验后的支付状态为准。",
            ],
            [
                "退款与账单问题",
                "购买积分后 7 个日历日内，若该笔购买的积分完全未使用，可向 support@supdance.com 提供账号及订单编号申请全额退款。已消耗的生成资源通常不予退款，但不影响法定消费者权利。失败任务按最终状态释放或退回相应预占积分；积分退回不同于银行卡退款。预占未退回、重复扣款或未交付时，请联系客服核查。获批退款在可行时原路退回，银行到账时间可能不同。本条不限制法定撤销、退款及支付争议权利。",
            ],
            [
                "输入素材与生成结果的权利",
                "你保留对提交素材原有的权利，并须确保提示词、媒体、肖像、声音及个人信息具备必要授权与合法依据。你授权我们及参与服务的供应商在交付所请求功能及维护安全所必需的范围内处理、托管、传输和展示素材；该授权不赋予我们任意使用私人项目进行宣传的权利。生成结果的权利取决于适用法律及模型条款，我们不保证其可获得著作权、唯一性、排他性或不侵犯第三方权利。商用前请自行审查结果和许可条件。",
            ],
            [
                "使用规范与公开分享",
                "禁止违法、性剥削、诈骗、威胁、侵权、非自愿私密影像、误导性冒充或恶意软件等内容；禁止绕过安全措施、攻击服务或擅自获取数据。请遵守 /aup 所载《可接受使用政策》。使用他人面容或声音时依法取得同意，并按规定标注合成内容。主动发布与分享由你控制，接收方可能复制素材，访问链接也可能被转发。举报滥用或侵权请向 safety@supdance.com 提供相关链接与证明。",
            ],
            [
                "限制、终止与申诉",
                "你可停止使用并通过客服申请注销。为处理违规、欺诈、安全风险或法律要求，我们可在合理必要范围内限制内容或访问；在可行且合法时说明原因，并提供联系客服复核的机会。终止不免除已发生的付款义务，也不影响法定退款权利。删除和依法保留数据的规则见《隐私政策》，注销前请导出重要作品。",
            ],
            [
                "AI 局限与责任范围",
                "AI 输出可能不准确、带有偏见、不安全或不适用。发布或据此作出影响他人的决定前，请独立审查；输出不构成法律、医疗或财务专业意见。服务按实际可用状态提供，法律不得排除的保证除外。在法律允许范围内，我们不承担间接或后果性损失，累计责任以上述事件发生前 3 个月你支付的服务费为限；欺诈、故意不当行为、依法不得限制的责任及强制性消费者保护不受此限。",
            ],
            [
                "条款变更、争议与联系",
                "修订将发布于本页并更新版本；重大变更会适当通知，依法需要同意的将另行征求。发生争议可先联系 support@supdance.com 以便调查处理。适用的强制性法律及向有管辖权的法院或监管机构寻求救济的权利不受影响。各语言版本帮助理解，不以语言优先约定排除当地法定权利。个别条款无效时，其余条款在合法范围内继续适用。",
            ],
        ],
        privacySections: [
            ["范围与隐私联系", "本政策适用于通过 https://www.supdance.com 提供的 Supdance 服务。Supdance 是本政策使用的服务品牌。隐私请求请发送至 support@supdance.com。你选择使用的第三方服务另有其隐私说明，本政策不替代第三方说明。"],
            [
                "处理的信息",
                "依你使用的功能，我们处理账号及联系方式、口令散列、第三方登录标识及授权资料；提示词、剧本、上传文件、画布与项目数据、生成媒体及任务记录；订单编号、金额、支付状态及积分账务；以及 IP 地址、浏览器信息、安全日志和客服往来。请勿提交无必要的敏感信息，或无合法依据处理他人资料。在支付机构页面输入的卡片信息由该机构处理；请勿向客服发送完整卡号或口令。",
            ],
            [
                "用途与法律依据",
                "信息用于身份认证、保存项目、执行生成、交付素材、结算订单与积分、客服处理、防范滥用及履行法定义务。在适用时，处理依据包括履行合同、法定义务、与个人权益相权衡的合法利益，或可选功能的同意。接受条款不等于对一切数据用途的概括同意；依法需要单独同意时另行征求，并在基于重大新用途处理前作出说明。",
            ],
            [
                "AI 模型与服务供应商",
                "生成请求可能将提示词、必要参考媒体及任务参数发送至所选模型供应商，也可能经配置的路由服务转发。托管、存储、分发、登录与支付供应商接收完成职责所必要的信息。启用生成安全筛查时，文本提示词可能发送至 Waffo Pancake，该筛查请求不包含参考媒体或模型密钥。供应商保留与训练规则取决于具体服务及条款，我们不承诺所有供应商均零留存或不训练。上传机密资料前请确认相关安排符合你的要求。",
            ],
            [
                "公开分享与其他披露",
                "使用服务本身不代表授权我们将私人工作区用于公开宣传。主动发布或分享后，其他人可能访问并复制内容，超出我们的控制范围。为遵守法律、保护权利或调查安全事件，我们可能作出合理必要的披露。业务转让时，相关信息可能在适用保障及通知要求下转移。我们不将私人项目作为商品出售；可选广告披露见下一节。",
            ],
            [
                "Cookie、本地存储与广告",
                "必要 Cookie 用于维持登录，浏览器存储保存偏好，按账号隔离的 IndexedDB 缓存项目与素材。清除本地数据可能导致退出登录或丢失未同步内容。可选 X 广告衡量仅在同意后启用，可能发送已确认购买事件、金额、币种及去重标识。你可用本页广告偏好按钮管理或撤回同意；撤回停止新的衡量事件，但不撤销此前合法处理。X 政策见 https://x.com/en/privacy。你也可通过浏览器清除或阻止存储。",
            ],
            [
                "跨境处理",
                "供应商可能在你所在国家或地区之外处理信息，当地隐私规则可能不同。跨境要求取决于你所在地及接收服务，依法需要时应采用相应保障或其他合法传输机制。你可向客服询问与你的任务相关的安排。界面语言不决定存储地点，也不代表数据仅在本地处理。",
            ],
            [
                "保留、删除与安全",
                "保留期限取决于服务目的、账号状态、素材引用、备份周期、法定记录义务及争议处理。删除项目或注销账号不代表所有关联素材、备份或交易记录立即清除。请通过客服申请删除，我们会说明依法保留的例外。我们采用访问控制、凭据散列及安全传输降低风险，但不存在绝对安全的系统，也不将存储表述为端到端加密。发生依法须报告的数据事件时，我们将依适用法律通知监管机构及受影响者。",
            ],
            [
                "你的权利与选择",
                "依适用法律，你可请求查阅、更正、删除、可携带副本、限制或反对处理，以及撤回同意；也可能享有涉及出售或共享、定向广告及重大自动化决策的相关权利。请联系 support@supdance.com，我们可能进行适度身份核验，但不会索要口令或完整卡号。我们以 30 个日历日内答复为目标，并遵守更短的法定期限；依法延期或拒绝时说明理由。导出与请求可能由人工处理。你可向有管辖权的数据保护机构投诉，不会因依法行权受到不利待遇。",
            ],
            [
                "未成年人及政策更新",
                "服务面向年满 18 周岁的成年人。若你认为未成年人向我们提供了个人信息，请联系客服调查并采取适当措施。处理实践或要求变化时，我们更新政策并展示修订日期。重大变化会适当通知；依法需要同意的新处理，不仅以继续使用作为依据。你始终可通过广告偏好按钮调整选择。",
            ],
        ],
    },
    fr: {
        terms: "Conditions d’utilisation",
        privacy: "Politique de confidentialité",
        termsSummary:
            "Ces conditions régissent l’utilisation de Supdance sur https://www.supdance.com : outils créatifs d’IA, projets, médias et services payants. Lisez-les avec notre politique de confidentialité et notre politique d’utilisation acceptable.",
        privacySummary: "Cette politique décrit le traitement des données personnelles sur notre site, dans l’espace créatif, lors des générations par IA et auprès de l’assistance, ainsi que vos choix et vos droits.",
        termsSections: [
            [
                "Champ d’application et acceptation",
                "Supdance (« nous ») fournit ce service web. Créer un compte ou utiliser une fonction payante implique l’acceptation de ces conditions. En cas de désaccord, cessez l’utilisation. Vous devez avoir au moins 18 ans et la capacité de contracter. Toute personne agissant pour une organisation doit être habilitée à l’engager. Contact : support@supdance.com.",
            ],
            [
                "Services et disponibilité",
                "L’espace de travail permet de créer des scénarios, storyboards, projets sur canevas, images, vidéos, musiques et contenus audio selon les modèles et fonctions disponibles. La livraison est numérique. Disponibilité, délais et qualité varient ; une estimation ne constitue pas une garantie. Maintenance, limites de capacité ou défaillances de fournisseurs peuvent interrompre le service. Les changements importants des droits payants seront communiqués sur le site ou via les coordonnées du compte.",
            ],
            [
                "Compte et sécurité",
                "Fournissez des informations exactes, protégez vos identifiants et actualisez vos coordonnées. Vous répondez des utilisations autorisées et devez prendre des précautions raisonnables. Signalez rapidement toute compromission présumée. N’accédez pas au compte d’autrui, n’utilisez pas d’identifiants volés et ne contournez ni quotas ni protections. Nous pouvons vérifier la propriété du compte avant de modifier son accès ou de traiter une demande sensible.",
            ],
            [
                "Prix, crédits et paiements",
                "La page d’achat et la confirmation précisent prix, devise, taxes, crédits, validité et éventuels paiements récurrents. Vérifiez-les avant paiement ; tout abonnement dépend des conditions de renouvellement affichées lors de la commande. Les crédits sont des unités de service, non une monnaie, un dépôt ou un moyen de paiement transférable. Réservations et débits définitifs suivent le devis du modèle et ses règles de règlement. Les droits sont accordés après vérification du paiement, pas sur la seule base d’un statut en attente.",
            ],
            [
                "Remboursements et facturation",
                "Dans les 7 jours calendaires suivant un achat de crédits intégralement inutilisé, demandez un remboursement complet à support@supdance.com avec le compte et la référence de commande. Les ressources consommées ne sont généralement pas remboursables, sous réserve des droits impératifs. Une tâche échouée libère ou restitue sa réservation selon son statut final ; restituer des crédits n’est pas rembourser une carte bancaire. Signalez les restitutions manquantes, doubles débits ou défauts de livraison. Les remboursements approuvés utilisent si possible le moyen initial ; les délais bancaires varient. Les droits légaux de rétractation, de remboursement et de contestation demeurent applicables.",
            ],
            [
                "Contenus et résultats d’IA",
                "Vous conservez vos droits sur vos contributions et devez disposer des autorisations nécessaires pour textes, médias, images de personnes, voix et données personnelles. Vous nous autorisez, ainsi que les fournisseurs concernés, à traiter, héberger, transmettre et afficher ces éléments dans la mesure nécessaire aux fonctions demandées et à la sécurité. Cette autorisation ne permet pas la promotion libre de projets privés. Les droits sur les résultats dépendent de la loi et des conditions du modèle : nous ne garantissons ni protection par droit d’auteur, ni unicité, exclusivité ou absence de droits de tiers. Vérifiez les résultats et licences avant tout usage commercial.",
            ],
            [
                "Utilisation acceptable et partage",
                "Sont interdits les contenus illicites, l’exploitation sexuelle, la fraude, les menaces, les atteintes aux droits, les images intimes non consenties, l’usurpation trompeuse et les logiciels malveillants. Ne contournez pas les protections et n’accédez pas sans autorisation aux données. Respectez la politique /aup. Obtenez les consentements requis pour un visage ou une voix et signalez les contenus synthétiques lorsque nécessaire. Vous contrôlez la publication volontaire ; les destinataires peuvent copier les contenus ou transmettre les liens. Signalements : safety@supdance.com, avec URL et justificatifs.",
            ],
            [
                "Restriction et résiliation",
                "Vous pouvez cesser l’utilisation et demander la fermeture du compte à l’assistance. Nous pouvons limiter des contenus ou accès lorsque cela est raisonnablement nécessaire face à une violation, une fraude, un risque de sécurité ou une obligation légale. Lorsque possible et licite, nous expliquons les motifs et permettons une demande de réexamen. La résiliation n’efface pas les obligations déjà acquises ni les droits impératifs au remboursement. La politique de confidentialité explique la suppression et la conservation légale. Exportez vos travaux importants avant fermeture.",
            ],
            [
                "Limites de l’IA et responsabilité",
                "Les résultats peuvent être inexacts, biaisés, dangereux ou inadaptés. Vérifiez-les avant publication ou décision affectant autrui ; ils ne constituent pas un conseil juridique, médical ou financier. Le service est fourni selon sa disponibilité, sans exclure les garanties impératives. Dans les limites légales, les dommages indirects sont exclus et notre responsabilité cumulée est limitée aux frais payés durant les trois mois précédant le fait. Ces limites ne couvrent pas la fraude, la faute intentionnelle, les responsabilités non limitables ou les protections impératives des consommateurs.",
            ],
            [
                "Modifications, litiges et contact",
                "Les révisions sont publiées ici avec une nouvelle version. Les changements importants font l’objet d’une information appropriée et du consentement lorsque la loi l’exige. Contactez d’abord support@supdance.com pour permettre une investigation. Les lois impératives et votre droit de saisir un tribunal ou une autorité compétente restent intacts. Les traductions facilitent la compréhension sans écarter les droits locaux. L’invalidité d’une clause n’affecte pas les autres dans la mesure permise par la loi.",
            ],
        ],
        privacySections: [
            [
                "Portée et contact",
                "Cette politique couvre Supdance sur https://www.supdance.com. Supdance désigne la marque du service. Adressez vos demandes à support@supdance.com. Les services tiers que vous choisissez disposent de leurs propres politiques, que celle-ci ne remplace pas.",
            ],
            [
                "Données traitées",
                "Selon les fonctions utilisées : coordonnées et compte, mots de passe hachés, identifiants de connexion tierce et profil autorisé ; instructions, scénarios, fichiers, canevas, projets, médias générés et tâches ; commandes, montants, statuts de paiement et écritures de crédits ; adresses IP, navigateur, journaux de sécurité et échanges avec l’assistance. Évitez les données sensibles inutiles et les données d’autrui sans base légale. Les données de carte saisies chez un prestataire de paiement sont traitées par celui-ci. Ne communiquez jamais de numéro de carte complet ni de mot de passe à l’assistance.",
            ],
            [
                "Finalités et bases légales",
                "Nous traitons les données pour authentifier, sauvegarder les projets, générer et livrer les contenus, régler commandes et crédits, répondre aux demandes, prévenir les abus et respecter la loi. Selon le cas : exécution du contrat, obligation légale, intérêts légitimes mis en balance avec vos droits, ou consentement aux fonctions optionnelles. Accepter les conditions ne vaut pas consentement général. Tout consentement distinct requis est demandé et toute nouvelle finalité importante est expliquée avant le traitement concerné.",
            ],
            [
                "Modèles d’IA et prestataires",
                "Les générations peuvent transmettre instructions, médias de référence nécessaires et paramètres au fournisseur du modèle choisi, éventuellement via un service de routage configuré. Hébergement, stockage, diffusion, connexion et paiement reçoivent les données nécessaires à leur rôle. Si le contrôle de sécurité est activé, des instructions textuelles peuvent être envoyées à Waffo Pancake, sans médias de référence ni clés de modèle. Conservation et entraînement dépendent des conditions du fournisseur ; nous ne promettons pas une absence universelle de conservation ou d’entraînement. Vérifiez les garanties avant d’envoyer des documents confidentiels.",
            ],
            [
                "Publication et autres communications",
                "Utiliser le service n’autorise pas la promotion publique de vos projets privés. Une publication ou un partage volontaire peut permettre des copies hors de notre contrôle. Nous pouvons communiquer les données raisonnablement nécessaires au respect de la loi, à la protection des droits ou à l’enquête sur un incident. Une transmission liée à une cession d’activité reste soumise aux garanties et informations applicables. Les projets privés ne sont pas vendus comme un produit ; les communications publicitaires optionnelles sont décrites ci-dessous.",
            ],
            [
                "Cookies, stockage et publicité",
                "Les cookies nécessaires maintiennent la connexion ; le navigateur conserve les préférences et IndexedDB met en cache projets et médias par compte. Effacer ces données peut déconnecter ou supprimer des travaux non synchronisés. La mesure publicitaire X n’est activée qu’après consentement et peut transmettre un achat confirmé, montant, devise et identifiant de déduplication. Le bouton de préférences publicitaires de cette page permet de retirer le consentement : les nouveaux événements cessent, sans annuler les traitements antérieurs licites. Politique X : https://x.com/en/privacy. Les paramètres du navigateur permettent aussi d’effacer ou bloquer le stockage.",
            ],
            [
                "Traitements internationaux",
                "Les prestataires peuvent traiter des données dans d’autres pays, dont les règles diffèrent. Les exigences dépendent de votre lieu et du destinataire. Les garanties ou mécanismes légaux de transfert requis doivent être utilisés. Demandez à l’assistance les arrangements applicables à votre tâche. La langue de l’interface ne détermine ni le lieu de stockage ni un traitement exclusivement local.",
            ],
            [
                "Conservation, suppression et sécurité",
                "La durée dépend des finalités, du compte, des références aux médias, des sauvegardes, des obligations documentaires et des litiges. Supprimer un projet ou un compte ne supprime pas instantanément tous les fichiers liés, sauvegardes ou transactions. Demandez la suppression à l’assistance ; les exceptions légales seront expliquées. Contrôles d’accès, hachage et transport sécurisé réduisent les risques, sans sécurité absolue ni promesse de stockage chiffré de bout en bout. Les incidents soumis à notification sont signalés aux autorités et personnes concernées conformément à la loi.",
            ],
            [
                "Droits et choix",
                "Selon la loi, vous pouvez demander accès, rectification, suppression, copie portable, limitation, opposition et retrait du consentement. Des droits relatifs à la vente ou au partage, à la publicité ciblée ou aux décisions automatisées importantes peuvent aussi s’appliquer. Contactez support@supdance.com ; une vérification proportionnée est possible, jamais votre mot de passe ou carte complète. Nous visons une réponse sous 30 jours calendaires et respectons tout délai légal plus court ; prolongations ou refus légaux seront motivés. Les exports peuvent être manuels. Vous pouvez saisir l’autorité de protection compétente sans être pénalisé pour l’exercice de vos droits.",
            ],
            [
                "Mineurs et mises à jour",
                "Le service est destiné aux adultes de 18 ans et plus. Signalez toute collecte présumée auprès d’un enfant pour investigation et mesures appropriées. Les changements de pratiques ou d’exigences entraînent une mise à jour datée. Les modifications importantes sont notifiées ; un nouveau traitement exigeant un consentement ne repose pas uniquement sur la poursuite de l’utilisation. Les préférences publicitaires restent modifiables.",
            ],
        ],
    },
    de: {
        terms: "Nutzungsbedingungen",
        privacy: "Datenschutzerklärung",
        termsSummary:
            "Diese Bedingungen gelten für Supdance auf https://www.supdance.com einschließlich KI-Kreativwerkzeugen, Projekten, Medien und kostenpflichtigen Leistungen. Bitte lesen Sie auch die Datenschutzerklärung und die Richtlinie zur zulässigen Nutzung.",
        privacySummary: "Diese Erklärung beschreibt die Verarbeitung personenbezogener Daten auf unserer Website, im Kreativbereich, bei KI-Generierungen und im Support sowie Ihre Wahlmöglichkeiten und Rechte.",
        termsSections: [
            [
                "Geltung und Zustimmung",
                "Supdance („wir“) stellt diesen Webdienst bereit. Mit der Kontoerstellung oder Nutzung einer kostenpflichtigen Funktion akzeptieren Sie diese Bedingungen. Andernfalls beenden Sie die Nutzung. Sie müssen mindestens 18 Jahre alt und zum Vertragsschluss berechtigt sein. Für eine Organisation dürfen Sie nur mit entsprechender Vertretungsmacht handeln. Kontakt: support@supdance.com.",
            ],
            [
                "Leistungen und Verfügbarkeit",
                "Der Arbeitsbereich unterstützt Drehbücher, Storyboards, Canvas-Projekte, Bilder, Videos, Musik und Audio je nach verfügbaren Modellen und Funktionen. Leistungen werden digital erbracht. Verfügbarkeit, Dauer und Qualität schwanken; Schätzungen sind keine Garantie. Wartung, Kapazitätsgrenzen oder Anbieterausfälle können Unterbrechungen verursachen. Wesentliche Änderungen bezahlter Ansprüche teilen wir über die Website oder die Kontaktdaten des Kontos mit.",
            ],
            [
                "Konto und Sicherheit",
                "Machen Sie zutreffende Angaben, schützen Sie Zugangsdaten und halten Sie Kontaktdaten aktuell. Sie verantworten autorisierte Nutzungen und angemessene Schutzmaßnahmen. Melden Sie vermuteten Missbrauch unverzüglich. Fremde Konten, gestohlene Zugangsdaten sowie das Umgehen von Kontingenten oder Ausnutzen von Fehlern sind untersagt. Vor Zugangsänderungen oder sensiblen Anfragen können wir die Kontoinhaberschaft prüfen.",
            ],
            [
                "Preise, Guthaben und Zahlung",
                "Kaufseite und Bestätigung nennen Preis, Währung, Steuern, Guthabeneinheiten, Gültigkeit und gegebenenfalls wiederkehrende Zahlungen. Prüfen Sie diese vor Zahlung; Abonnements richten sich nach den beim Abschluss angezeigten Verlängerungsbedingungen. Credits sind Leistungseinheiten, kein Geld, keine Einlage und kein übertragbares Zahlungsmittel. Reservierungen und endgültige Belastungen folgen Modellangebot und Abrechnungsregeln. Leistungen werden nach bestätigter Zahlung zugewiesen, nicht allein aufgrund eines ausstehenden Zahlungsstatus.",
            ],
            [
                "Erstattungen und Abrechnung",
                "Für einen vollständig ungenutzten Credit-Kauf können Sie binnen 7 Kalendertagen unter support@supdance.com mit Konto- und Bestellreferenz eine vollständige Erstattung beantragen. Verbrauchte Rechenressourcen sind grundsätzlich nicht erstattbar; zwingende Verbraucherrechte bleiben unberührt. Fehlgeschlagene Aufgaben geben Reservierungen nach ihrem Endstatus frei oder buchen sie zurück. Eine Credit-Rückbuchung ist keine Kartenerstattung. Melden Sie fehlende Rückbuchungen, Doppelbelastungen oder Nichtlieferung. Genehmigte Erstattungen erfolgen möglichst über den ursprünglichen Zahlungsweg; Banklaufzeiten variieren. Gesetzliche Widerrufs-, Erstattungs- und Zahlungsanfechtungsrechte bleiben bestehen.",
            ],
            [
                "Materialien und KI-Ergebnisse",
                "Ihre Rechte an eingereichten Materialien bleiben erhalten. Sie benötigen ausreichende Rechte an Texten, Medien, Bildnissen, Stimmen und personenbezogenen Daten. Sie gestatten uns und beteiligten Anbietern die für angeforderte Funktionen und Sicherheit notwendige Verarbeitung, Speicherung, Übertragung und Anzeige. Daraus folgt keine unbeschränkte Werbenutzung privater Projekte. Rechte an Ergebnissen hängen von Gesetz und Modellbedingungen ab; Urheberrechtsschutz, Einzigartigkeit, Exklusivität und Freiheit von Rechten Dritter werden nicht garantiert. Prüfen Sie Ergebnisse und Lizenzen vor kommerzieller Nutzung.",
            ],
            [
                "Zulässige Nutzung und Teilen",
                "Unzulässig sind rechtswidrige Inhalte, sexuelle Ausbeutung, Betrug, Drohungen, Rechtsverletzungen, intime Darstellungen ohne Einwilligung, täuschende Identitätsnachahmung und Schadsoftware. Umgehen Sie keine Schutzmaßnahmen und greifen Sie nicht unbefugt auf Daten zu. Beachten Sie /aup. Holen Sie erforderliche Einwilligungen für Gesichter und Stimmen ein und kennzeichnen Sie synthetische Inhalte, soweit vorgeschrieben. Freiwillige Veröffentlichungen können kopiert und Links weitergegeben werden. Missbrauch oder Rechtsverletzungen melden Sie mit URL und Belegen an safety@supdance.com.",
            ],
            [
                "Einschränkung und Beendigung",
                "Sie können die Nutzung beenden und beim Support die Kontoschließung beantragen. Bei Verstößen, Betrug, Sicherheitsrisiken oder gesetzlichen Vorgaben dürfen wir Inhalte oder Zugriff angemessen beschränken. Soweit möglich und zulässig erläutern wir Gründe und ermöglichen eine Überprüfung durch den Support. Entstandene Zahlungspflichten und zwingende Erstattungsrechte bleiben bestehen. Löschung und gesetzliche Aufbewahrung erklärt die Datenschutzerklärung. Exportieren Sie wichtige Arbeiten vor der Schließung.",
            ],
            [
                "KI-Grenzen und Haftung",
                "KI-Ergebnisse können falsch, voreingenommen, unsicher oder ungeeignet sein. Prüfen Sie diese vor Veröffentlichung oder Entscheidungen über andere Menschen; sie sind keine Rechts-, Medizin- oder Finanzberatung. Die Leistung wird nach Verfügbarkeit unter Wahrung zwingender Gewährleistungen erbracht. Soweit gesetzlich zulässig, schließen wir mittelbare Folgeschäden aus und begrenzen die Gesamthaftung auf die in den drei Monaten vor dem Ereignis gezahlten Entgelte. Ausgenommen sind Betrug, Vorsatz, gesetzlich nicht beschränkbare Haftung und zwingende Verbraucherrechte; insbesondere bleiben zwingende Ansprüche bei Verletzung von Leben, Körper oder Gesundheit unberührt.",
            ],
            [
                "Änderungen, Streitigkeiten und Kontakt",
                "Änderungen erscheinen hier mit neuer Version. Wesentliche Änderungen werden angemessen angekündigt; erforderliche Einwilligungen werden eingeholt. Kontaktieren Sie zunächst support@supdance.com zur Prüfung eines Problems. Zwingendes Recht und der Zugang zu zuständigen Gerichten oder Behörden bleiben unberührt. Übersetzungen unterstützen das Verständnis und schließen örtliche Rechte nicht aus. Ist eine Bestimmung unwirksam, gelten die übrigen im rechtlich zulässigen Umfang fort.",
            ],
        ],
        privacySections: [
            [
                "Geltungsbereich und Kontakt",
                "Diese Erklärung gilt für Supdance auf https://www.supdance.com. Supdance bezeichnet die Dienstleistungsmarke. Datenschutzanfragen richten Sie an support@supdance.com. Für von Ihnen gewählte Drittdienste gelten zusätzlich deren eigene Datenschutzhinweise.",
            ],
            [
                "Verarbeitete Informationen",
                "Je nach Funktion verarbeiten wir Konto- und Kontaktdaten, Passwort-Hashes, Drittanmeldekennungen und freigegebene Profile; Prompts, Drehbücher, Dateien, Canvas- und Projektdaten, generierte Medien und Aufgaben; Bestellreferenzen, Beträge, Zahlungsstatus und Credit-Buchungen; IP-Adressen, Browserdaten, Sicherheitsprotokolle und Supportnachrichten. Übermitteln Sie keine unnötigen sensiblen Daten oder fremde Daten ohne Rechtsgrundlage. Kartendaten auf der Seite eines Zahlungsanbieters verarbeitet dieser selbst. Senden Sie dem Support nie vollständige Kartennummern oder Passwörter.",
            ],
            [
                "Zwecke und Rechtsgrundlagen",
                "Wir verarbeiten Daten für Anmeldung, Projektspeicherung, Generierung, Medienlieferung, Abrechnung, Support, Missbrauchsschutz und gesetzliche Pflichten. Soweit anwendbar beruhen diese Vorgänge auf Vertragserfüllung, rechtlichen Pflichten, mit Ihren Rechten abgewogenen berechtigten Interessen oder Einwilligung für optionale Funktionen. Die Annahme der Bedingungen ist keine pauschale Einwilligung. Erforderliche gesonderte Einwilligungen werden eingeholt und wesentliche neue Zwecke vor der betreffenden Verarbeitung erläutert.",
            ],
            [
                "KI-Modelle und Dienstleister",
                "Generierungen können Prompts, notwendige Referenzmedien und Parameter an den gewählten Modellanbieter übertragen, gegebenenfalls über konfigurierte Routingdienste. Hosting-, Speicher-, Auslieferungs-, Anmelde- und Zahlungsanbieter erhalten die für ihre Aufgabe notwendigen Daten. Bei aktivierter Sicherheitsprüfung können Textprompts an Waffo Pancake gesendet werden, ohne Referenzmedien oder Modellschlüssel. Aufbewahrung und Training richten sich nach dem jeweiligen Anbieter; eine allgemeine Zusage ohne Speicherung oder Training geben wir nicht. Prüfen Sie die Bedingungen vor vertraulichen Uploads.",
            ],
            [
                "Veröffentlichung und Offenlegung",
                "Die Nutzung erlaubt uns nicht automatisch, private Projekte öffentlich zu bewerben. Freiwillig veröffentlichte oder geteilte Inhalte können außerhalb unserer Kontrolle kopiert werden. Angemessen notwendige Offenlegungen zur Einhaltung von Gesetzen, zum Schutz von Rechten oder zur Untersuchung von Sicherheitsvorfällen sind möglich. Bei einer Geschäftsübertragung gelten die erforderlichen Schutz- und Informationspflichten. Private Projekte werden nicht als Produkt verkauft; optionale Werbeübermittlungen sind im folgenden Abschnitt beschrieben.",
            ],
            [
                "Cookies, Browserdaten und Werbung",
                "Notwendige Cookies erhalten die Anmeldung; Browserdaten speichern Einstellungen und kontogetrennte IndexedDB-Caches Projekte und Medien. Löschen kann zur Abmeldung oder zum Verlust unsynchronisierter Arbeit führen. Optionale X-Werbemessung startet nur nach Einwilligung und kann bestätigte Käufe, Betrag, Währung und eine Deduplizierungskennung übermitteln. Über die Werbeeinstellungen dieser Seite können Sie widerrufen: Neue Ereignisse stoppen, frühere rechtmäßige Verarbeitung wird nicht rückgängig. X-Datenschutz: https://x.com/en/privacy. Auch Browsereinstellungen erlauben Löschen oder Blockieren.",
            ],
            [
                "Internationale Verarbeitung",
                "Anbieter können Daten in anderen Ländern mit abweichenden Datenschutzregeln verarbeiten. Anforderungen hängen von Ihrem Standort und dem Empfänger ab. Erforderliche Garantien oder andere rechtmäßige Übermittlungsmechanismen müssen eingesetzt werden. Fragen Sie den Support nach den für Ihre Aufgabe relevanten Vorkehrungen. Die Oberflächensprache bestimmt weder Speicherort noch eine ausschließlich lokale Verarbeitung.",
            ],
            [
                "Aufbewahrung, Löschung und Sicherheit",
                "Die Dauer hängt von Zwecken, Kontostatus, Medienverweisen, Sicherungszyklen, gesetzlichen Aufbewahrungspflichten und Streitigkeiten ab. Projekt- oder Kontolöschung entfernt nicht sofort alle verknüpften Dateien, Sicherungen oder Transaktionen. Beantragen Sie Löschung beim Support; rechtmäßige Ausnahmen werden erklärt. Zugriffskontrollen, Hashing und sichere Übertragung verringern Risiken, garantieren aber weder absolute Sicherheit noch Ende-zu-Ende-verschlüsselte Speicherung. Meldepflichtige Vorfälle teilen wir Behörden und Betroffenen nach geltendem Recht mit.",
            ],
            [
                "Ihre Rechte und Wahlmöglichkeiten",
                "Nach geltendem Recht können Sie Auskunft, Berichtigung, Löschung, Datenübertragbarkeit, Einschränkung, Widerspruch und Widerruf verlangen. Rechte bezüglich Verkauf oder Weitergabe, gezielter Werbung oder wesentlicher automatisierter Entscheidungen können hinzukommen. Schreiben Sie an support@supdance.com. Eine angemessene Identitätsprüfung ist möglich, nie durch Passwort oder vollständige Karte. Wir streben Antwort binnen 30 Kalendertagen an und beachten kürzere gesetzliche Fristen; zulässige Verlängerungen oder Ablehnungen werden begründet. Exporte können manuell bearbeitet werden. Sie können sich ohne Benachteiligung an die zuständige Datenschutzbehörde wenden.",
            ],
            [
                "Minderjährige und Aktualisierungen",
                "Der Dienst richtet sich an Erwachsene ab 18 Jahren. Vermutete Datenübermittlungen durch Kinder melden Sie bitte zur Prüfung und geeigneten Abhilfe. Bei Änderungen unserer Praxis oder rechtlicher Anforderungen aktualisieren wir die Erklärung mit Datum. Wesentliche Änderungen werden mitgeteilt; einwilligungsbedürftige neue Verarbeitung stützt sich nicht allein auf weitere Nutzung. Werbeeinstellungen bleiben jederzeit veränderbar.",
            ],
        ],
    },
    ja: {
        terms: "利用規約",
        privacy: "プライバシーポリシー",
        termsSummary: "本規約は https://www.supdance.com の Supdance が提供する AI 制作ツール、プロジェクト、メディア素材、有料サービスの利用に適用されます。プライバシーポリシーおよび利用可能コンテンツに関するポリシーと併せてお読みください。",
        privacySummary: "本ポリシーは、ウェブサイト、制作ワークスペース、AI 生成、サポートにおける個人情報の取扱いと、利用者の選択、権利、連絡方法を説明します。",
        termsSections: [
            [
                "適用と同意",
                "Supdance（以下「当サービス」）が本ウェブサービスを提供します。アカウントの作成または有料機能の利用により、本規約に同意したものとします。同意しない場合は利用を中止してください。利用者は18歳以上で契約を締結する能力を有する必要があります。組織を代表する場合は権限が必要です。お問い合わせ：support@supdance.com。",
            ],
            [
                "サービスと提供状況",
                "脚本、絵コンテ、キャンバス、画像、動画、音楽、音声の制作を、利用可能なモデルと機能に応じて提供します。提供はデジタル形式です。モデルの稼働状況、処理時間、品質は変動し、目安は保証ではありません。保守、容量制限、上流障害により中断する場合があります。有料の利用権に重大な変更がある場合、サイトまたは登録連絡先を通じて通知します。",
            ],
            [
                "アカウントと安全",
                "正確な登録情報を提供し、認証情報を保護し、連絡先を更新してください。利用者は許可した利用に責任を持ち、合理的な安全対策を講じるものとします。不正アクセスの疑いは速やかに報告してください。他人のアカウント、盗まれた認証情報、割当制限の回避、不具合の悪用は禁止します。アクセス変更や機微な請求では本人確認を行うことがあります。",
            ],
            [
                "料金・クレジット・支払い",
                "購入ページと注文確認に、料金、通貨、税、クレジット数、有効期間、継続課金がある場合の条件を表示します。支払い前に確認してください。定期契約の更新は決済時の表示条件によります。クレジットはサービス計量単位であり、通貨、預金、譲渡可能な決済手段ではありません。仮確保と最終課金はモデルの見積りと精算ルールに従います。支払待ちの状態だけでは権利は付与されず、確認済みの決済に基づきます。",
            ],
            [
                "返金と請求の問題",
                "購入したクレジットを全く使用していない場合、購入から7暦日以内にアカウントと注文番号を添えて support@supdance.com に全額返金を申請できます。消費済みの生成資源は通常返金対象外ですが、法定の消費者権利を制限しません。失敗したタスクは最終状態に応じて確保額を解除または返還します。クレジット返還とカードへの返金は異なります。未返還、重複請求、未提供はサポートにお知らせください。承認後の返金は可能な限り元の支払方法で行い、金融機関の処理時間は異なります。法定の解除・返金・支払異議の権利は維持されます。",
            ],
            [
                "素材と生成結果の権利",
                "提出した素材の既存の権利は利用者に残ります。文章、媒体、肖像、声、個人情報に必要な権利と許可を確保してください。要求された機能と安全確保に必要な範囲で、当サービスおよび関係する提供者による処理、保存、送信、表示を許可するものとします。非公開プロジェクトを自由に広告利用する権利を与えるものではありません。生成結果の権利は法律とモデル規約によって異なり、著作権、独自性、独占性、第三者権利の非侵害を保証しません。商用利用前に結果とライセンスを確認してください。",
            ],
            [
                "利用基準と共有",
                "違法、性的搾取、詐欺、脅迫、権利侵害、同意のない私的性的画像、誤認させるなりすまし、マルウェアは禁止します。安全対策の回避、攻撃、無断データ取得も禁止します。/aup のポリシーに従ってください。顔や声には必要な同意を取得し、法令に従い合成である旨を表示してください。公開・共有は利用者が選択し、受領者による複製やリンクの転送が生じ得ます。通報先：safety@supdance.com。URL と根拠資料をお送りください。",
            ],
            [
                "制限・終了・再審査",
                "利用を中止し、サポート経由で退会を申請できます。違反、詐欺、安全リスク、法的要請への対応に合理的に必要な場合、内容やアクセスを制限することがあります。可能かつ適法な範囲で理由を説明し、再審査の窓口を提供します。終了しても既発生の支払義務や法定返金権は失われません。削除と法定保存はプライバシーポリシーをご確認ください。退会前に重要な作品をエクスポートしてください。",
            ],
            [
                "AI の限界と責任",
                "AI 出力は不正確、偏り、危険、不適切な内容を含み得ます。公開や他者に影響する判断の前に確認してください。法律・医療・財務の専門的助言ではありません。サービスは提供可能な状態で提供し、排除できない保証は維持します。法律が許す範囲で間接的・結果的損害を除外し、累積責任は原因発生前3か月に支払われたサービス料金を上限とします。詐欺、故意の不正行為、法令上制限できない責任、強行的消費者保護には適用しません。",
            ],
            [
                "変更・紛争・連絡",
                "改定は本ページに新しい版として掲載します。重大な変更は適切に通知し、法律上必要な同意は別途取得します。紛争はまず support@supdance.com へご連絡ください。強行法規および管轄裁判所・規制当局への申立権は維持されます。翻訳は理解を支援するもので、地域の法定権利を排除しません。一部条項が無効でも、残りは適法な範囲で適用されます。",
            ],
        ],
        privacySections: [
            [
                "対象と連絡窓口",
                "本ポリシーは https://www.supdance.com の Supdance に適用されます。Supdance はサービスのブランド名です。個人情報に関する請求は support@supdance.com へお送りください。選択した第三者サービスには、それぞれのプライバシー規定も適用されます。",
            ],
            [
                "取り扱う情報",
                "機能に応じて、アカウント・連絡先、パスワードのハッシュ、外部ログイン識別子と許可されたプロフィール、プロンプト、脚本、ファイル、キャンバス・プロジェクト、生成媒体、タスク、注文番号、金額、支払状態、クレジット台帳、IP、ブラウザー、安全ログ、サポート記録を処理します。不要な機微情報や適法な根拠のない他人の情報は入力しないでください。決済事業者の画面に入力したカード情報はその事業者が扱います。カード番号全桁やパスワードをサポートに送らないでください。",
            ],
            [
                "目的と法的根拠",
                "認証、プロジェクト保存、生成・納品、注文・クレジット精算、問い合わせ対応、不正防止、法的義務のために利用します。適用に応じ、契約履行、法的義務、権利との衡量を経た正当利益、任意機能への同意を根拠とします。規約への同意は全用途への包括的同意ではありません。必要な個別同意を取得し、重要な新目的は事前に説明します。",
            ],
            [
                "モデルと提供者",
                "生成時はプロンプト、必要な参照媒体、パラメーターを、設定済みの中継を含め選択モデルの提供者へ送信する場合があります。ホスティング、保存、配信、ログイン、決済の提供者には業務上必要な情報を渡します。安全審査が有効な場合、参照媒体やモデル認証情報を含まないテキストを Waffo Pancake に送ることがあります。保存・学習方針は各提供者の条件によるため、一律の保存なし・学習なしは保証しません。機密素材の送信前に条件を確認してください。",
            ],
            [
                "公開とその他の開示",
                "利用だけで非公開作品の広告使用を許可したことにはなりません。自ら公開・共有した内容は第三者が複製する可能性があります。法令順守、権利保護、安全事件の調査に合理的に必要な開示を行う場合があります。事業移転時も適用される保護と通知義務に従います。非公開プロジェクトを商品として販売しません。任意広告に伴う送信は次項で説明します。",
            ],
            [
                "Cookie・保存領域・広告",
                "必須 Cookie はログインを維持し、ブラウザーは設定を保存し、アカウント別の IndexedDB は作品と素材をキャッシュします。消去するとログアウトや未同期データの損失が生じ得ます。任意の X 広告測定は同意後のみ有効化し、確認済み購入イベント、金額、通貨、重複排除番号を送る場合があります。本ページの広告設定ボタンで撤回できます。撤回後は新規イベントを停止しますが、過去の適法な処理は取り消しません。X の方針：https://x.com/en/privacy。ブラウザーから保存の消去・拒否も可能です。",
            ],
            [
                "国外での処理",
                "提供者は居住国と異なる国で処理する場合があり、保護規則も異なります。要件は所在地と受領者により異なり、必要な保護措置または適法な移転根拠を使用する必要があります。タスクに関係する取扱いはサポートへお問い合わせください。画面の言語は保存国や国内限定処理を意味しません。",
            ],
            [
                "保存・削除・安全",
                "保存期間は目的、アカウント、素材参照、バックアップ周期、法定記録、紛争によって異なります。作品やアカウントの削除で関連素材、バックアップ、取引記録が即時すべて消えるとは限りません。削除はサポートへ請求でき、法定保存の例外を説明します。アクセス制御、ハッシュ、安全な通信でリスクを低減しますが、絶対的安全や保存データのエンドツーエンド暗号化は保証しません。報告対象の漏えいは適用法に従い当局・対象者へ通知します。",
            ],
            [
                "権利と選択",
                "適用法に応じ、開示、訂正、削除、可搬形式の写し、制限、異議、同意撤回を求められます。販売・共有、ターゲティング広告、重大な自動決定に関する権利もあり得ます。support@supdance.com へご連絡ください。相応の本人確認を行う場合がありますが、パスワードやカード全桁は要求しません。30暦日以内の回答を目標とし、より短い法定期限を優先します。適法な延長・拒否は理由を説明します。出力や請求は手作業で扱う場合があります。正当な権利行使で不利益を受けず、管轄当局へ苦情を申し立てられます。",
            ],
            [
                "未成年者と更新",
                "サービスは18歳以上の成人向けです。子どもが情報を提供した疑いがある場合は、調査と適切な対応のためご連絡ください。取扱いや要件の変更時は改定日を表示して更新します。重大な変更を通知し、同意が必要な新処理を継続利用だけに依拠して行いません。広告設定はいつでも変更できます。",
            ],
        ],
    },
    ko: {
        terms: "서비스 이용약관",
        privacy: "개인정보 처리방침",
        termsSummary: "본 약관은 https://www.supdance.com 의 Supdance AI 창작 도구, 프로젝트, 미디어 자료 및 유료 서비스 이용에 적용됩니다. 개인정보 처리방침 및 허용되는 사용 정책과 함께 읽어 주세요.",
        privacySummary: "본 방침은 웹사이트, 창작 작업 공간, AI 생성 및 고객 지원에서 개인정보를 처리하는 방식과 이용자의 선택, 권리 및 연락 방법을 설명합니다.",
        termsSections: [
            [
                "범위 및 동의",
                "Supdance(이하 ‘당사’)가 본 웹 서비스를 제공합니다. 계정을 만들거나 유료 기능을 이용하면 본 약관에 동의하는 것입니다. 동의하지 않으면 이용을 중단하세요. 만 18세 이상이고 계약 체결 능력이 있어야 합니다. 조직을 대신하여 이용하려면 적법한 권한이 필요합니다. 문의: support@supdance.com.",
            ],
            [
                "서비스 및 가용성",
                "사용 가능한 모델과 기능에 따라 대본, 스토리보드, 캔버스, 이미지, 동영상, 음악 및 오디오 창작을 지원합니다. 서비스는 디지털로 제공됩니다. 모델 가용성, 처리 시간, 품질은 달라질 수 있으며 예상치는 보장이 아닙니다. 유지보수, 용량 제한, 공급자 장애로 중단될 수 있습니다. 유료 권리에 중요한 변경이 있으면 사이트나 계정 연락처로 안내합니다.",
            ],
            [
                "계정 및 보안",
                "정확한 정보를 등록하고 인증 정보를 보호하며 연락처를 최신으로 유지하세요. 허가한 이용에 책임을 지고 합리적인 보호 조치를 취해야 합니다. 침해가 의심되면 신속히 알려 주세요. 타인 계정 접근, 도난 인증 정보 사용, 할당량 우회 및 오류 악용은 금지됩니다. 접근 권한 변경이나 민감한 요청 처리 전에 계정 소유권을 확인할 수 있습니다.",
            ],
            [
                "가격·크레딧·결제",
                "구매 화면과 주문 확인에 가격, 통화, 세금, 크레딧, 유효기간 및 정기 결제 조건을 표시합니다. 결제 전에 확인하세요. 구독 갱신은 결제 화면의 조건에 따릅니다. 크레딧은 서비스 단위이며 화폐, 예금 또는 양도 가능한 지급 수단이 아닙니다. 사전 확보와 최종 차감은 모델 견적 및 정산 규칙을 따릅니다. 결제 대기만으로 제공이 확정되지 않으며 검증된 결제 상태에 따라 권리가 부여됩니다.",
            ],
            [
                "환불 및 청구 문제",
                "구매한 크레딧을 전혀 사용하지 않았다면 구매 후 7일 이내에 계정과 주문 번호를 support@supdance.com 으로 보내 전액 환불을 신청할 수 있습니다. 이미 소비한 생성 자원은 원칙적으로 환불되지 않지만 법정 소비자 권리는 보장됩니다. 실패한 작업은 최종 상태에 따라 확보된 크레딧을 해제하거나 반환합니다. 크레딧 반환과 카드 환불은 다릅니다. 미반환, 중복 청구 또는 미제공은 고객 지원에 알려 주세요. 승인된 환불은 가능한 경우 원래 수단으로 처리하며 은행 소요 시간은 다릅니다. 법정 철회·환불·결제 이의 권리는 제한되지 않습니다.",
            ],
            [
                "입력 자료 및 AI 결과 권리",
                "제출 자료의 기존 권리는 이용자에게 남습니다. 텍스트, 미디어, 초상, 음성 및 개인정보에 필요한 권리와 허가를 확보해야 합니다. 요청한 기능 제공과 보안에 필요한 범위에서 당사 및 관련 공급자의 처리, 저장, 전송, 표시를 허용합니다. 이는 비공개 프로젝트를 자유롭게 광고에 사용하는 권한이 아닙니다. 결과의 권리는 법률 및 모델 약관에 따라 다르며 저작권, 독창성, 독점성, 제3자 권리 비침해를 보장하지 않습니다. 상업적 이용 전에 결과와 라이선스를 확인하세요.",
            ],
            [
                "사용 기준 및 공유",
                "불법 콘텐츠, 성적 착취, 사기, 협박, 권리 침해, 동의 없는 사적 성적 이미지, 기만적 사칭 및 악성코드는 금지됩니다. 안전장치 우회, 공격, 무단 데이터 취득도 금지됩니다. /aup 정책을 준수하세요. 얼굴이나 음성 사용에 필요한 동의를 얻고 법에 따라 합성임을 표시하세요. 자발적 공개·공유는 이용자가 결정하며 수신자가 복사하거나 링크를 전달할 수 있습니다. 신고는 URL 및 증빙과 함께 safety@supdance.com 으로 보내 주세요.",
            ],
            [
                "제한·종료·재검토",
                "이용을 중단하고 고객 지원을 통해 계정 폐쇄를 신청할 수 있습니다. 위반, 사기, 보안 위험 또는 법적 요구에 합리적으로 필요한 경우 콘텐츠나 접근을 제한할 수 있습니다. 가능하고 적법한 범위에서 이유와 재검토 문의 방법을 제공합니다. 종료해도 발생한 지급 의무와 법정 환불 권리는 유지됩니다. 삭제와 법정 보관은 개인정보 처리방침을 참고하고, 폐쇄 전 중요한 작품을 내보내세요.",
            ],
            [
                "AI 한계 및 책임",
                "AI 결과는 부정확하거나 편향되고 위험하거나 부적절할 수 있습니다. 공개 또는 타인에게 영향을 주는 결정 전에 검토하세요. 법률·의료·재무 전문 조언이 아닙니다. 배제할 수 없는 보증을 유지하면서 가용한 상태로 서비스를 제공합니다. 법이 허용하는 범위에서 간접·결과적 손해를 제외하고 총책임을 사건 전 3개월간 지급한 서비스 요금으로 제한합니다. 사기, 고의적 위법행위, 법적으로 제한할 수 없는 책임 및 강행적 소비자 보호에는 적용하지 않습니다.",
            ],
            [
                "변경·분쟁·연락",
                "개정 내용과 버전을 이 페이지에 게시합니다. 중요한 변경은 적절히 알리고 법정 동의가 필요하면 별도로 받습니다. 분쟁은 우선 support@supdance.com 으로 문의해 주세요. 강행법규와 관할 법원 또는 감독기관에 구제를 구할 권리는 유지됩니다. 번역은 이해를 돕기 위한 것이며 지역의 법정 권리를 배제하지 않습니다. 일부 조항이 무효여도 나머지는 적법한 범위에서 유지됩니다.",
            ],
        ],
        privacySections: [
            [
                "범위 및 연락처",
                "본 방침은 https://www.supdance.com 의 Supdance 에 적용됩니다. Supdance 는 서비스 브랜드입니다. 개인정보 요청은 support@supdance.com 으로 보내 주세요. 선택한 외부 서비스에는 해당 서비스의 개인정보 안내도 적용되며 본 방침이 이를 대체하지 않습니다.",
            ],
            [
                "처리하는 정보",
                "기능에 따라 계정·연락처, 비밀번호 해시, 외부 로그인 식별자와 승인한 프로필, 프롬프트, 대본, 파일, 캔버스·프로젝트, 생성 미디어와 작업 기록, 주문 번호, 금액, 결제 상태 및 크레딧 원장, IP, 브라우저, 보안 로그와 상담 기록을 처리합니다. 불필요한 민감정보나 적법한 근거 없는 타인 정보를 제출하지 마세요. 결제업체 화면의 카드 정보는 해당 업체가 처리합니다. 전체 카드 번호나 비밀번호를 고객 지원에 보내지 마세요.",
            ],
            [
                "목적 및 법적 근거",
                "인증, 프로젝트 저장, 생성과 전달, 주문·크레딧 정산, 상담, 오남용 방지 및 법적 의무를 위해 사용합니다. 해당되는 경우 계약 이행, 법적 의무, 권리와 균형을 고려한 정당한 이익 또는 선택 기능 동의에 근거합니다. 약관 수락이 모든 데이터 사용에 대한 포괄적 동의는 아닙니다. 필요한 별도 동의를 받고 중요한 새 목적은 처리 전에 설명합니다.",
            ],
            [
                "AI 모델 및 공급자",
                "생성 시 프롬프트, 필요한 참조 미디어와 매개변수를 설정된 중계 서비스를 포함하여 선택 모델 공급자에게 보낼 수 있습니다. 호스팅, 저장, 전달, 로그인 및 결제 공급자는 업무에 필요한 정보를 받습니다. 안전 심사가 활성화되면 텍스트 프롬프트를 Waffo Pancake 에 보낼 수 있으며 참조 미디어나 모델 인증 정보는 제외합니다. 보관·학습 방식은 각 공급자 조건에 따라 달라 모든 공급자의 무보관·무학습을 보장하지 않습니다. 기밀 자료 전송 전에 조건을 확인하세요.",
            ],
            [
                "공개 및 기타 제공",
                "서비스 이용만으로 비공개 프로젝트의 공개 홍보를 허락한 것은 아닙니다. 자발적으로 공개·공유한 자료는 당사 통제 밖에서 복사될 수 있습니다. 법 준수, 권리 보호, 보안 사건 조사에 합리적으로 필요한 정보를 제공할 수 있습니다. 사업 이전 시에도 적용되는 보호 및 통지 의무를 따릅니다. 비공개 프로젝트를 상품으로 판매하지 않으며 선택적 광고 전송은 다음 항목에서 설명합니다.",
            ],
            [
                "쿠키·로컬 저장소·광고",
                "필수 쿠키는 로그인을 유지하고 브라우저는 설정을 저장하며 계정별 IndexedDB 는 프로젝트와 자료를 캐시합니다. 삭제하면 로그아웃되거나 미동기화 작업이 손실될 수 있습니다. 선택적 X 광고 측정은 동의 후에만 활성화되어 확인된 구매, 금액, 통화와 중복 제거 식별자를 보낼 수 있습니다. 이 페이지의 광고 설정 버튼으로 철회하면 새 이벤트를 중단하지만 이전의 적법한 처리는 취소되지 않습니다. X 방침: https://x.com/en/privacy. 브라우저에서도 저장소를 삭제하거나 차단할 수 있습니다.",
            ],
            [
                "국외 처리",
                "공급자는 이용자 거주국 외에서 처리할 수 있고 보호 규칙이 다를 수 있습니다. 요건은 위치와 수신 서비스에 따라 다르며 필요한 보호 조치 또는 적법한 이전 근거를 사용해야 합니다. 작업과 관련된 처리 방식은 고객 지원에 문의하세요. 화면 언어가 저장 위치나 국내 전용 처리를 의미하지 않습니다.",
            ],
            [
                "보관·삭제·보안",
                "기간은 목적, 계정 상태, 자료 참조, 백업 주기, 법정 기록 및 분쟁에 따라 다릅니다. 프로젝트나 계정을 삭제해도 연결 자료, 백업, 거래 기록이 모두 즉시 삭제되지는 않습니다. 고객 지원에 삭제를 요청하면 적법한 보관 예외를 설명합니다. 접근 통제, 해시 및 안전한 전송으로 위험을 줄이지만 절대적 보안이나 저장 데이터의 종단간 암호화를 보장하지 않습니다. 신고 대상 침해는 적용법에 따라 기관과 영향받은 사람에게 알립니다.",
            ],
            [
                "권리 및 선택",
                "적용법에 따라 열람, 정정, 삭제, 이동 가능한 사본, 처리 제한, 이의 및 동의 철회를 요청할 수 있습니다. 판매·공유, 맞춤 광고, 중대한 자동 결정 관련 권리도 있을 수 있습니다. support@supdance.com 으로 문의하세요. 합리적 본인 확인은 가능하지만 비밀번호나 전체 카드 번호를 요구하지 않습니다. 30일 이내 답변을 목표로 하며 더 짧은 법정 기한을 따릅니다. 적법한 연장·거절은 설명합니다. 내보내기와 요청은 수동 처리될 수 있습니다. 정당한 권리 행사로 불이익을 받지 않으며 관할 개인정보 감독기관에 민원을 제기할 수 있습니다.",
            ],
            [
                "아동 및 방침 변경",
                "서비스는 만 18세 이상 성인용입니다. 아동이 정보를 제공했다고 의심되면 조사와 적절한 조치를 위해 알려 주세요. 처리 방식이나 요건이 바뀌면 날짜와 함께 개정합니다. 중요한 변경은 알리고, 동의가 필요한 새 처리는 계속 이용만을 근거로 하지 않습니다. 광고 설정은 언제든 변경할 수 있습니다.",
            ],
        ],
    },
};

const termsIds = ["acceptance", "services", "account", "billing", "refund", "intellectual-property", "acceptable-use", "termination", "disclaimers", "general"];
const privacyIds = ["controller", "collection", "purposes", "sharing", "publication", "cookies", "international-transfers", "retention", "rights", "children-updates"];

function documents(kind: "terms" | "privacy"): Record<PolicyLanguage, LocalizedLegalDoc> {
    return Object.fromEntries(
        Object.entries(copy).map(([language, text]) => [
            language,
            {
                title: text[kind],
                badge: "SUPDANCE",
                version: "v2.0",
                effectiveDate: "2026-11-13",
                summary: kind === "terms" ? text.termsSummary : text.privacySummary,
                sections: (kind === "terms" ? text.termsSections : text.privacySections).map(([title, paragraph], index) => ({
                    id: (kind === "terms" ? termsIds : privacyIds)[index],
                    title: `${index + 1}. ${title}`,
                    paragraphs: [paragraph],
                })),
            },
        ]),
    ) as Record<PolicyLanguage, LocalizedLegalDoc>;
}

export const SERVICE_TERMS = documents("terms");
export const SERVICE_PRIVACY = documents("privacy");

export const LEGAL_PAGE_COPY: Record<PolicyLanguage, { effective: string; version: string; center: string; section: string }> = {
    en: { effective: "Revised", version: "Version", center: "Legal center", section: "Section link" },
    "zh-CN": { effective: "修订日期", version: "版本", center: "法律中心", section: "章节链接" },
    fr: { effective: "Révision", version: "Version", center: "Centre juridique", section: "Lien de section" },
    de: { effective: "Überarbeitet", version: "Version", center: "Rechtliches", section: "Abschnittslink" },
    ja: { effective: "改定日", version: "版", center: "法務情報", section: "節へのリンク" },
    ko: { effective: "개정일", version: "버전", center: "법률 정보", section: "섹션 링크" },
};
