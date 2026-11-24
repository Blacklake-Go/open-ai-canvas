'use client';

import { cloneElement, useId, useRef, useState } from 'react';
import { Dialog } from 'radix-ui';
import { useLocale, useTranslations } from 'next-intl';
import { History, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, StatusBadge } from '@/components/admin/AdminUi';
import { SiteAnnouncement, bannerThemeAppearance } from '@/components/GlobalSiteBanner';
import { useSiteContentConfig } from '@/lib/hooks/useSiteContentConfig';
import { useAdminData } from '@/pages/helpers/pageHelpers';
import { oneApi } from '@/services/api/http';
import { Drawer, DrawerContent } from 'studio/ui/overlay';

const bannerPath = '/api/admin/content/banner';
const historyPath = `${bannerPath}/history`;
const fieldClass = 'control-focus min-h-control-lg w-full rounded-lg border border-line bg-surface px-3 py-2 text-body-sm text-ink';

function Field({ label, children }) {
  const id = useId();
  return <div className="grid min-w-0 gap-1.5 text-body-sm text-ink-muted">
    <label htmlFor={id}>{label}</label>
    {cloneElement(children, { id })}
  </div>;
}

export default function BannerTab({ canWrite, refreshPublicContent }) {
  const t = useTranslations('adminBanner');
  const locale = useLocale();
  const current = useAdminData(bannerPath);
  const { data: publicContent } = useSiteContentConfig();
  const [draft, setDraft] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [busy, setBusy] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const inFlight = useRef(false);
  const history = useAdminData(historyOpen ? historyPath : null);
  const banner = draft ?? current.data;

  function update(key, value) {
    setDraft({ ...banner, [key]: value });
  }

  async function mutate(action, id) {
    if (!canWrite || inFlight.current) return;
    inFlight.current = true;
    setBusy(action);
    setFeedback(null);
    try {
      const deleting = action === 'delete';
      const saved = await oneApi.adminRequest(id ? `${historyPath}/${encodeURIComponent(id)}` : bannerPath, {
        method: deleting ? 'DELETE' : 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        ...(action === 'publish' ? { body: banner } : {}),
      });
      if (!deleting) {
        setDraft(saved);
        refreshPublicContent();
      }
      history.reload();
      setDeleteId(null);
      setFeedback({ text: t(deleting ? 'deleted' : action === 'restore' ? 'restored' : 'published') });
    } catch (error) {
      setFeedback({ error: true, text: error.message });
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  }

  if (!banner && current.loading) return <p role="status">{t('loading')}</p>;
  if (!banner || current.error) return <Card className="space-y-3 p-5">
    <p role="alert">{current.error}</p>
    <Button variant="outline" onClick={current.reload}>{t('retry')}</Button>
  </Card>;

  const displayedFeedback = feedback && <p role={feedback.error ? 'alert' : 'status'} className={feedback.error ? 'text-danger' : 'text-success'}>{feedback.text}</p>;
  const input = (key, props = {}) => <input className={fieldClass} value={banner[key] ?? ''}
    onChange={(event) => update(key, event.target.value)} {...props} />;
  const selection = (key, options, value = banner[key]) => (
    <select className={fieldClass} value={value} onChange={(event) => update(key, event.target.value)}>
      {options.map(([id, label = id]) => <option key={id} value={id}>{t(label)}</option>)}
    </select>
  );
  const toggle = (key, label) => <label className="control-focus flex min-h-control-lg items-center gap-3 text-body-sm text-ink">
    <input type="checkbox" className="size-4 accent-brand" checked={Boolean(banner[key])}
      onChange={(event) => update(key, event.target.checked)} />
    {t(label)}
  </label>;

  return <div className="grid gap-4">
    <Card className="min-w-0 space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-body font-semibold text-ink">{t('preview')}</h2>
        <Drawer open={historyOpen} onOpenChange={(open) => {
          if (busy) return;
          setHistoryOpen(open);
          setDeleteId(null);
          setFeedback(null);
        }}>
          <Dialog.Trigger asChild>
            <Button size="lg" variant="outline"><History className="size-4" aria-hidden="true" />{t('history')}</Button>
          </Dialog.Trigger>
          <DrawerContent title={t('history')} aria-describedby={undefined}>
            <div className="space-y-3">
              {displayedFeedback}
              {history.loading && <p role="status">{t('historyLoading')}</p>}
              {history.error && <div className="space-y-2">
                <p role="alert" className="text-danger">{history.error}</p>
                <Button variant="outline" onClick={history.reload}>{t('retry')}</Button>
              </div>}
              {!history.loading && !history.error && history.data?.length === 0 && <p>{t('empty')}</p>}
              {history.data?.map((item) => <article key={item.id} className="space-y-3 rounded-xl border border-line bg-surface-raised p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="min-w-0 break-words text-body-sm font-semibold">{item.title}</h3>
                  {item.isActive && <StatusBadge tone="brand">{t('active')}</StatusBadge>}
                  {!item.enabled && <StatusBadge tone="neutral">{t('disabled')}</StatusBadge>}
                </div>
                <p className="line-clamp-2 text-body-sm text-ink-muted">{item.message}</p>
                {item.createdAt && <time className="text-caption text-ink-subtle" dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })}</time>}
                {canWrite && <div className="flex flex-wrap gap-2">
                  {deleteId === item.id ? <>
                    <p className="w-full text-body-sm text-ink">{t('confirmDelete')}</p>
                    <Button size="lg" variant="outline" disabled={Boolean(busy)} onClick={() => setDeleteId(null)}>{t('cancel')}</Button>
                    <Button size="lg" variant="destructive" loading={busy === 'delete'} onClick={() => mutate('delete', item.id)}>{t('delete')}</Button>
                  </> : <>
                    <Button size="lg" variant="outline" disabled={Boolean(busy)} onClick={() => {
                      const { id, campaignId, isActive, createdAt, updatedAt, createdBy, ...settings } = item;
                      setDraft({ ...settings, id: `banner-${crypto.randomUUID()}` });
                      setHistoryOpen(false);
                      setFeedback(null);
                    }}>{t('copy')}</Button>
                    {!item.isActive && <>
                      <Button size="lg" variant="outline" disabled={Boolean(busy)} onClick={() => mutate('restore', item.id)}>{t('apply')}</Button>
                      <Button size="lg" variant="ghost" disabled={Boolean(busy)} onClick={() => setDeleteId(item.id)}>{t('delete')}</Button>
                    </>}
                  </>}
                </div>}
              </article>)}
            </div>
          </DrawerContent>
        </Drawer>
      </div>
      {banner.enabled ? <SiteAnnouncement banner={banner} pulse={publicContent?.motion?.bannerPulse !== false} preview /> : <StatusBadge tone="neutral">{t('disabled')}</StatusBadge>}
    </Card>

    <Card className="min-w-0 p-4 sm:p-6">
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void mutate('publish'); }}>
        <h2 className="text-body font-semibold text-ink">{t('editor')}</h2>
        {!canWrite && <p className="text-body-sm text-ink-muted">{t('readOnly')}</p>}
        <fieldset disabled={!canWrite || Boolean(busy)} className="grid gap-4 sm:grid-cols-2">
          <Field label={t('title')}>{input('title', { maxLength: 128 })}</Field>
          <Field label={t('scope')}>{selection('targetScope', [['all'], ['home'], ['studio']])}</Field>
          <div className="sm:col-span-2">
            <Field label={t('message')}>
              <textarea className={fieldClass} value={banner.message} rows={2}
                required={banner.enabled} onChange={(event) => update('message', event.target.value)} />
            </Field>
          </div>
          <Field label={t('highlight')}>{input('highlightText', { maxLength: 64 })}</Field>
          <Field label={t('badge')}>{input('badgeText', { maxLength: 10 })}</Field>
          <Field label={t('cta')}>{input('ctaText', { maxLength: 32 })}</Field>
          <Field label={t('url')}>{input('linkUrl', { inputMode: 'url' })}</Field>
          <Field label={t('target')}>{selection('linkTarget', [['_self', 'sameTab'], ['_blank', 'newTab']])}</Field>
          <Field label={t('palette')}>{selection('theme', [['neutral'], ['brand'], ['inverse']], bannerThemeAppearance(banner.theme))}</Field>
          <Field label={t('effect')}>{selection('dynamicEffect', [['none'], ['breathe'], ['drift'], ['shimmer'], ['both']])}</Field>
          <Field label={t('glowStyle')}>{selection('glowStyle', [['aurora'], ['brand'], ['amber'], ['rose']], banner.glowStyle === 'cyan' ? 'brand' : banner.glowStyle)}</Field>
          <div className="grid grid-cols-2 gap-x-3">
            {toggle('enabled', 'enabled')}
            {toggle('ambientGlow', 'glow')}
            {toggle('showPulseDot', 'pulse')}
            {toggle('dismissible', 'dismissible')}
          </div>
          {banner.dismissible && <Field label={t('hideDays')}>{input('autoHideDays', {
            type: 'number', min: 0, required: true,
            onChange: (event) => update('autoHideDays', event.target.value === '' ? '' : Number(event.target.value)),
          })}</Field>}
        </fieldset>
        {canWrite && <Button type="submit" size="lg" variant="primary" loading={busy === 'publish'} disabled={Boolean(busy)}>
          <Save className="size-4" aria-hidden="true" />{t(busy === 'publish' ? 'publishing' : 'publish')}
        </Button>}
        {!historyOpen && displayedFeedback}
      </form>
    </Card>
  </div>;
}
