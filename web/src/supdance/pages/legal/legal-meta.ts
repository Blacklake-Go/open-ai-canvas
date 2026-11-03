/**
 * 法律文本（服务条款 / 隐私政策）的内容模型与共用主体信息。
 *
 * 为什么单独抽一个主体常量：两份文件必须署名同一个控制者，分别手写会随时间漂移，
 * 收单机构（Waffo Pancake）账户审核会交叉比对两份文档的一致性。
 *
 * 内容纪律：这里只允许写代码、配置或线上行为能够证实的事实。
 * 任何"我们不做 X"的声明都必须对应仓库里确实没有 X
 * （例如全站无第三方统计、后端不落卡号），否则属于对用户的虚假陈述。
 */

export const LEGAL_OPERATOR = {
    /** 个人商户：与护照/身份证一致的法定姓名，用于账单争议与法律文书署名。 */
    legalName: "Zhang Donghe",
    /** 对外经营名称，需与信用卡账单展示名、站点品牌一致。 */
    tradeName: "Supdance",
    /** 产品全称。 */
    product: "Supdance 影策",
    /** 服务入口，与收单后台已验证域名保持一致。 */
    site: "https://www.supdance.com",
    /** 客服与隐私权利请求共用同一个有人值守邮箱，不使用 noreply。 */
    contactEmail: "support@supdance.com",
    /** 送达地址：个人商户无工商注册地址时，仍需提供可用于送达的实际地址。 */
    mailingAddress: "【待补充：可用于法律文书送达的实际地址】",
    /** 条款与政策同步发布的版本号与生效日期。 */
    version: "v1.0",
    effectiveDate: "【待补充：生效日期】",
    /** 正文语言版本约定：法律文本不做机器翻译，界面外壳走 i18n，正文本身保持中文。 */
    authoritativeLanguage: "中文",
} as const;

export type LegalBlock =
    | { kind: "p"; text: string }
    | { kind: "ul"; items: string[] }
    | { kind: "ol"; items: string[] }
    | { kind: "table"; head: string[]; rows: string[][] };

export type LegalSection = {
    /** 锚点 id，同时用于目录导航。 */
    id: string;
    title: string;
    blocks: LegalBlock[];
};

export type LegalDocument = {
    slug: "terms" | "privacy";
    title: string;
    /** 一句话说明本文件约束什么，渲染在标题下方。 */
    summary: string;
    /** 导语段落，渲染在正文之前。 */
    lead: string[];
    sections: LegalSection[];
    /** 正文之后的收尾声明（语言版本、完整约定等），属于文件内容而非界面文案。 */
    closing: string;
    /** 交叉引用的另一份文件，保证两份文档互相链接。 */
    related: { slug: "terms" | "privacy"; label: string };
};

/** 尚未填写的运营方信息统一以此开头，渲染时高亮并在交付清单中列出。 */
export const LEGAL_PENDING_PREFIX = "【待补充";

export function legalPendingFields(): string[] {
    return Object.entries(LEGAL_OPERATOR)
        .filter(([, value]) => typeof value === "string" && value.startsWith(LEGAL_PENDING_PREFIX))
        .map(([key]) => key);
}
