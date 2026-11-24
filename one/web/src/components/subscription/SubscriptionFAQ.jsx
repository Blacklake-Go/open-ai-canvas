import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSubscriptionFAQ } from '@/lib/hooks/useSubscriptionFAQ';
import { getSubscriptionStrings } from './subscriptionI18n';

export default function SubscriptionFAQ({ locale, pricing = false, collapsible = false, className = '' }) {
  const t = useTranslations('subscriptionFaq');
  const listId = useId();
  const { data, isPending, isError, refetch, isFetching } = useSubscriptionFAQ(locale);
  const [expanded, setExpanded] = useState(true);
  const defaults = pricing
    ? ['Quota', 'Payment', 'Delivery'].map(key => ({ id: key, question: t(`pricing${key}Question`), answer: t(`pricing${key}Answer`) }))
    : (locale === 'zh-CN' ? data?.items : getSubscriptionStrings(locale).faqs) || [];
  const items = data?.configured ? data.items : defaults;
  return (
    <section className={`mx-auto max-w-4xl space-y-3 ${className}`} data-subscription-faq={locale}>
      <h2 className="text-section-title font-semibold text-ink">
        {collapsible ? <button type="button" aria-expanded={expanded} aria-controls={listId}
          className="control-focus inline-flex min-h-control-lg items-center gap-2 rounded-lg"
          onClick={() => setExpanded(value => !value)}>
          {t('title')}
          <ChevronDown aria-hidden="true" className={`size-4 transition-transform duration-fast ${expanded ? 'rotate-180' : ''}`} />
        </button> : t('title')}
      </h2>
      <div id={listId} hidden={!expanded} className="space-y-3">
      {isPending && <p role="status" className="text-body-sm text-ink-muted">{t('loading')}</p>}
      {isError && <div role="alert" className="flex flex-wrap items-center gap-3 text-body-sm text-ink">
        <span>{t('error')}</span>
        <Button size="lg" variant="outline" loading={isFetching} onClick={() => void refetch()}>{t('retry')}</Button>
      </div>}
      {!isPending && !isError && <>
        {data?.configured && data.notice && <p className="whitespace-pre-wrap text-body-sm text-ink-muted">{data.notice}</p>}
        {items.length ? (
          <div className="space-y-2">
            {items.map((item, index) => (
              <details key={item.id} name={pricing ? `${listId}-item` : undefined}
                open={(pricing ? index === 0 : item.id === 'faq-4' || item.id === 'faq-5') || undefined}
                className="group overflow-hidden rounded-xl border border-line bg-surface-raised open:border-line-strong">
                <summary className="control-focus flex min-h-control-lg cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 text-body-sm font-semibold text-ink hover:bg-wash [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0 break-words">{item.question}</span>
                  <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-ink-muted transition-transform duration-fast ease-standard group-open:rotate-180" />
                </summary>
                <p className="whitespace-pre-wrap break-words border-t border-line-subtle px-4 py-3 text-body-sm text-ink-muted">{item.answer}</p>
              </details>
            ))}
          </div>
        ) : <p className="text-body-sm text-ink-muted">{t('empty')}</p>}
        {data?.configured && data.invoiceNotice && <p className="whitespace-pre-wrap text-body-sm text-ink-muted">{data.invoiceNotice}</p>}
        {data?.supportEmail && <p className="text-body-sm text-ink-muted">
          {t('contact')}{' '}
          <a className="control-focus break-all text-brand-text hover:underline" href={`mailto:${data.supportEmail}`}>{data.supportEmail}</a>
        </p>}
      </>}
      </div>
    </section>
  );
}
