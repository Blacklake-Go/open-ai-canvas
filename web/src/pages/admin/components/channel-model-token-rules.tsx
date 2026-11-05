import { useState } from "react";
import { Button, Checkbox, Form, Input, InputNumber, Switch, type FormInstance } from "antd";
import { Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { translate } from "@/i18n";
import { Select } from "@/components/ui/base/select";
import type { ChannelModelFormValues as FormValues } from "./channel-model-editor-form";
import { validateTokenPriceRules } from "./channel-model-editor-form";
import { defaultTokenPriceRule, tokenRuleClockMinutes, tokenRulesMatchingNow, type PriceTierFormValues, type TokenPriceRuleFormValues } from "./channel-model-price-tier-form";

/**
 * 文本 Token 价格档的分时与上下文价格。规则挂在某个 Token 价格档上：时段按任务创建时的上海时间锁定，
 * 上下文档位按上游真实输入 Token 结算；按顺序取首条命中，未命中时用该价格档的基础 Token 单价。
 */
export function TokenPriceRulesSection({ form, onDirty }: { form: FormInstance<FormValues>; onDirty: () => void }) {
    const { t, i18n } = useTranslation();
    const tiers: PriceTierFormValues[] = Form.useWatch("priceTiers", form) || [];
    const currency = Form.useWatch("priceCurrency", form);
    const priceUnit = currency === "USD" || currency === "CNY" ? currency : t("upstream.tokenRules.credits");
    const tokenTierIndexes = tiers.flatMap((tier, index) => (tier?.billingMode === "token" ? [index] : []));
    const [preferredTier, setPreferredTier] = useState<number>();
    const tierIndex = preferredTier !== undefined && tokenTierIndexes.includes(preferredTier) ? preferredTier : tokenTierIndexes[0];
    const rules: TokenPriceRuleFormValues[] = Form.useWatch(["priceTiers", tierIndex ?? 0, "tokenRules"], form) || [];
    const enabled = Form.useWatch(["priceTiers", tierIndex ?? 0, "tokenRulesEnabled"], form) === true;
    if (tierIndex === undefined) return null;
    const tier = tiers[tierIndex];
    const matching = tokenRulesMatchingNow(rules);
    const statusLabel = !enabled
        ? t("upstream.tokenRules.disabledStatus")
        : matching.length
          ? t("upstream.tokenRules.matchedStatus", { rules: new Intl.ListFormat(i18n.resolvedLanguage, { style: "short", type: "conjunction" }).format(matching.map((index) => String(index + 1))) })
          : t("upstream.tokenRules.unmatchedStatus");
    return (
        <section className="admin-model-editor-section" aria-label={t("upstream.tokenRules.title")}>
            <div className="admin-token-rules-header">
                <header className="admin-model-editor-section-heading">
                    <h2>{t("upstream.tokenRules.title")}</h2>
                    <p>{t("upstream.tokenRules.description")}</p>
                </header>
                <div className="admin-price-tier-toggle">
                    <span>{t("upstream.tokenRules.extension")}</span>
                    <Form.Item noStyle name={["priceTiers", tierIndex, "tokenRulesEnabled"]} valuePropName="checked">
                        <Switch aria-label={t("upstream.tokenRules.enabled")} onChange={onDirty} />
                    </Form.Item>
                </div>
            </div>
            <div className="admin-model-editor-section-content admin-token-rules-content">
                <div className="admin-token-rules-toolbar">
                    {tokenTierIndexes.length > 1 ? (
                        <label className="admin-token-rules-tier-picker">
                            <span>{t("upstream.tokenRules.baseTier")}</span>
                            <Select value={tierIndex} onChange={(value) => setPreferredTier(Number(value))} options={tokenTierIndexes.map((index) => ({ value: index, label: tierLabel(tiers[index], index) }))} />
                        </label>
                    ) : (
                        <span className="admin-token-rules-tier-name">{t("upstream.tokenRules.baseTierValue", { tier: tierLabel(tier, tierIndex) })}</span>
                    )}
                    <span className="admin-price-tier-cost-badge" role="status">
                        {statusLabel}
                    </span>
                </div>
                <Form.List
                    name={["priceTiers", tierIndex, "tokenRules"]}
                    rules={[
                        {
                            validator: async (_, value) => {
                                validateTokenPriceRules(form.getFieldValue(["priceTiers", tierIndex]), value);
                            },
                        },
                    ]}
                >
                    {(fields, { add, remove }, { errors }) => (
                        <div className="admin-price-tier-list-shell">
                            {fields.length ? (
                                <div className="admin-price-tier-list" aria-label={t("upstream.tokenRules.rules")}>
                                    {fields.map((field, ordinal) => (
                                        <TokenPriceRuleCard
                                            key={field.key}
                                            form={form}
                                            path={["priceTiers", tierIndex, "tokenRules", field.name]}
                                            name={field.name}
                                            ordinal={ordinal + 1}
                                            priceUnit={priceUnit}
                                            onDirty={onDirty}
                                            onRemove={() => {
                                                onDirty();
                                                remove(field.name);
                                            }}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <p className="admin-token-rules-empty">{t("upstream.tokenRules.empty")}</p>
                            )}
                            <div className="admin-price-tier-list-footer">
                                <Button
                                    className="admin-model-editor-add-tier"
                                    type="dashed"
                                    block
                                    icon={<Plus className="size-4" />}
                                    onClick={() => {
                                        onDirty();
                                        add(defaultTokenPriceRule(tier));
                                    }}
                                >
                                    {t("upstream.tokenRules.add")}
                                </Button>
                                <Form.ErrorList errors={errors} />
                            </div>
                        </div>
                    )}
                </Form.List>
            </div>
        </section>
    );
}

function tierLabel(tier: PriceTierFormValues | undefined, index: number) {
    return `${String(index + 1).padStart(2, "0")} · ${translate(tier?.matchMode === "default" ? "upstream.tokenRules.defaultTier" : "upstream.tokenRules.specTier")}`;
}

function TokenPriceRuleCard({ form, path, name, ordinal, priceUnit, onDirty, onRemove }: { form: FormInstance<FormValues>; path: (string | number)[]; name: number; ordinal: number; priceUnit: string; onDirty: () => void; onRemove: () => void }) {
    const { t, i18n } = useTranslation();
    const locale = i18n.resolvedLanguage;
    const weekdayFormat = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
    const weekdayOptions = Array.from({ length: 7 }, (_, index) => ({ label: weekdayFormat.format(new Date(Date.UTC(2024, 0, index + 1))), value: index + 1 }));
    const rule: TokenPriceRuleFormValues | undefined = Form.useWatch(path, form);
    const enabled = rule?.enabled !== false;
    const min = rule?.minInputTokens || 0;
    const max = rule?.maxInputTokens || 0;
    const summary = t(max > 0 ? "upstream.tokenRules.rangeSummary" : "upstream.tokenRules.minimumSummary", { min: min.toLocaleString(locale), max: max.toLocaleString(locale) });
    return (
        <article className="admin-price-tier-card">
            <header className="admin-price-tier-card-header">
                <div className="admin-price-tier-card-heading">
                    <span className="admin-price-tier-card-index">{String(ordinal).padStart(2, "0")}</span>
                    <div className="admin-price-tier-card-heading-copy">
                        <div className="admin-price-tier-card-title">{t(enabled ? "upstream.tokenRules.billingOn" : "upstream.tokenRules.billingOff")}</div>
                        <div className="admin-price-tier-card-summary">{summary}</div>
                    </div>
                </div>
                <div className="admin-price-tier-card-actions">
                    <Form.Item noStyle name={[name, "enabled"]} valuePropName="checked">
                        <Switch aria-label={t("upstream.tokenRules.billingRule", { number: ordinal })} onChange={onDirty} />
                    </Form.Item>
                    <Button type="text" danger aria-label={t("upstream.tokenRules.deleteRule", { number: ordinal })} icon={<Trash2 className="size-3.5" />} onClick={onRemove}>
                        {t("upstream.tokenRules.delete")}
                    </Button>
                </div>
            </header>
            <div className="admin-token-rule-body">
                <div className="admin-token-rule-column">
                    <Form.Item className="mb-0" name={[name, "weekdays"]} label={t("upstream.tokenRules.weekdays")} rules={[{ required: true, type: "array", min: 1, message: t("upstream.tokenRules.selectDay") }]}>
                        <Checkbox.Group options={weekdayOptions} />
                    </Form.Item>
                    <div className="admin-token-rule-pair">
                        <Form.Item className="mb-0" name={[name, "start"]} label={t("upstream.tokenRules.start")} rules={[{ validator: async (_, value) => clockRule(value, false) }]}>
                            <Input inputMode="numeric" maxLength={5} placeholder="00:00" />
                        </Form.Item>
                        <Form.Item className="mb-0" name={[name, "end"]} label={t("upstream.tokenRules.end")} rules={[{ validator: async (_, value) => clockRule(value, true) }]}>
                            <Input inputMode="numeric" maxLength={5} placeholder="24:00" />
                        </Form.Item>
                    </div>
                </div>
                <div className="admin-token-rule-column">
                    <span className="admin-token-rule-label">{t("upstream.tokenRules.context")}</span>
                    <div className="admin-token-rule-range">
                        <span aria-hidden>≥</span>
                        <Form.Item noStyle name={[name, "minInputTokens"]}>
                            <InputNumber aria-label={t("upstream.tokenRules.minContext")} className="w-full" min={0} precision={0} step={1000} />
                        </Form.Item>
                        <span>Token</span>
                    </div>
                    <div className="admin-token-rule-range">
                        <span aria-hidden>&lt;</span>
                        <Form.Item noStyle name={[name, "maxInputTokens"]}>
                            <InputNumber aria-label={t("upstream.tokenRules.maxContext")} className="w-full" min={1} precision={0} step={1000} placeholder={t("upstream.tokenRules.unlimited")} />
                        </Form.Item>
                        <span>Token</span>
                    </div>
                </div>
                <div className="admin-token-rule-prices">
                    {(
                        [
                            ["inputTokenPrice", "input"],
                            ["outputTokenPrice", "output"],
                            ["cachedTokenPrice", "cacheRead"],
                            ["cacheWriteTokenPrice", "cacheWrite"],
                        ] as const
                    ).map(([field, label]) => (
                        <Form.Item
                            key={field}
                            className="admin-price-tier-unit-price mb-0"
                            name={[name, field]}
                            label={t("upstream.tokenRules.priceLabel", { label: t(`upstream.tokenRules.${label}`), unit: priceUnit })}
                            rules={[{ required: true, message: t("upstream.tokenRules.requiredPrice", { label: t(`upstream.tokenRules.${label}`) }) }]}
                        >
                            <InputNumber className="w-full" min={0} max={1_000_000} precision={6} step={0.1} />
                        </Form.Item>
                    ))}
                </div>
            </div>
        </article>
    );
}

function clockRule(value: unknown, end: boolean) {
    if (tokenRuleClockMinutes(String(value ?? ""), end) === null) throw new Error(translate(end ? "upstream.tokenRules.clockEnd" : "upstream.tokenRules.clockStart"));
}
