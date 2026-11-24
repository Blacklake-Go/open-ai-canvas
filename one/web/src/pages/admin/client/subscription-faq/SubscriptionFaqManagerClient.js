'use client';

import { cloneElement, useId, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowDown, ArrowUp, Edit3, Plus, Save, Trash2 } from 'lucide-react';
import { Card, PageHeader } from '@/components/admin/AdminUi';
import { Button, IconButton } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { getSubscriptionStrings } from '@/components/subscription/subscriptionI18n';
import { notifySubscriptionFAQPublished } from '@/lib/hooks/useSubscriptionFAQ';
import { getLocaleConfig, SUPPORTED_LOCALES } from '@/lib/locales';
import { useAdminData } from '@/pages/helpers/pageHelpers';
import { oneApi } from '@/services/api/http';

const categories = ['quota', 'subscription', 'payment', 'refund', 'copyright', 'legal', 'general'];
const fieldStyle = 'control-focus min-h-control-lg w-full rounded-lg border border-line bg-surface px-3 py-2 text-body-sm text-ink';
const ordered = items => items.map((item, index) => ({ ...item, order: index + 1 }));

function Field({ label, children }) {
  const id = useId();
  return <div className="grid min-w-0 gap-1.5 text-body-sm text-ink">
    <label htmlFor={id}>{label}</label>
    {cloneElement(children, { id, className: fieldStyle })}
  </div>;
}

function ConfirmDraftAction({ confirmation, close, opener }) {
  const t = useTranslations('adminSubscriptionFaq');
  return <AlertDialog open={Boolean(confirmation)} onOpenChange={open => { if (!open) close(); }}>
    <AlertDialogContent onCloseAutoFocus={event => {
      event.preventDefault();
      opener.current?.focus();
    }}>
      <AlertDialogTitle>{confirmation?.title}</AlertDialogTitle>
      <AlertDialogDescription>{confirmation?.description}</AlertDialogDescription>
      <AlertDialogFooter>
        <AlertDialogCancel size="lg">{t('cancel')}</AlertDialogCancel>
        <AlertDialogAction size="lg" variant={confirmation?.danger ? 'danger' : 'primary'} onClick={confirmation?.action}>
          {t('confirm')}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}

function LocaleEditor({ locale, draft, updateDraft, canWrite, onSaving }) {
  const t = useTranslations('adminSubscriptionFaq');
  const path = `/api/admin/subscription-faq?locale=${encodeURIComponent(locale)}`;
  const remote = useAdminData(path);
  const [published, setPublished] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  const opener = useRef(null);
  const addButton = useRef(null);
  const [conflict, setConflict] = useState(false);

  if (remote.loading) return <p role="status">{t('loading')}</p>;
  if (remote.error || !remote.data) return <Card className="space-y-3">
    <p role="alert" className="text-danger">{remote.error || t('loadFailed')}</p>
    <Button size="lg" variant="outline" onClick={remote.reload}>{t('retry')}</Button>
  </Card>;

  const defaults = locale === 'zh-CN' ? remote.data.defaults : {
    ...remote.data.defaults,
    items: getSubscriptionStrings(locale).faqs.map(item => ({
      ...item, enabled: true, category: 'general',
    })),
  };
  const baseline = published || remote.data;
  const config = draft?.config || (baseline.revision === 0 ? defaults : baseline.config);
  const revision = draft?.revision ?? baseline.revision;
  const term = search.trim().toLowerCase();
  const visible = config.items.filter(item => (filter === 'all' || item.category === filter)
    && (!term || item.question.toLowerCase().includes(term) || item.answer.toLowerCase().includes(term)));
  const labelCategory = category => categories.includes(category) ? t(category) : category;

  function change(next) {
    updateDraft({ config: next, revision });
    if (!conflict) setFeedback(null);
  }
  function changeItems(items) {
    change({ ...config, items: ordered(items) });
  }
  function move(id, peerId) {
    const items = [...config.items];
    const first = items.findIndex(item => item.id === id);
    const second = items.findIndex(item => item.id === peerId);
    if (first < 0 || second < 0) return;
    [items[first], items[second]] = [items[second], items[first]];
    changeItems(items);
  }
  function startEditing(event, item) {
    opener.current = event.currentTarget;
    setEditing(item || {
      id: `faq-${crypto.randomUUID()}`, order: config.items.length + 1,
      enabled: true, category: filter === 'all' ? 'general' : filter, question: '', answer: '',
    });
  }
  function applyItem(event) {
    event.preventDefault();
    const question = editing.question.trim();
    const answer = editing.answer.trim();
    if (!question || !answer) {
      const field = event.currentTarget.elements.namedItem(question ? 'faqAnswer' : 'faqQuestion');
      field.setCustomValidity(t('required'));
      field.reportValidity();
      return;
    }
    const items = config.items.filter(item => item.id !== editing.id);
    items.splice(editing.order - 1, 0, { ...editing, question, answer });
    changeItems(items);
    setEditing(null);
  }
  function ask(event, request) {
    opener.current = event.currentTarget;
    setConfirmation(request);
  }
  async function save(event) {
    event.preventDefault();
    if (!canWrite || inFlight.current || conflict || !draft) return;
    inFlight.current = true;
    setSaving(true);
    onSaving(true);
    setFeedback(null);
    try {
      const saved = await oneApi.adminRequest(path, {
        method: 'PUT',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: { config, expectedRevision: revision },
      });
      setPublished(saved);
      updateDraft(null);
      setFeedback({ text: t('published') });
      notifySubscriptionFAQPublished(locale);
    } catch (error) {
      const stale = error.code === 'SUBSCRIPTION_FAQ_REVISION_CONFLICT';
      setConflict(stale);
      setFeedback({ error: true, text: stale ? t('conflict') : error.message });
    } finally {
      setSaving(false);
      onSaving(false);
      inFlight.current = false;
    }
  }

  const editField = (key, value) => setEditing(item => ({ ...item, [key]: value }));
  const itemCount = config.items.some(item => item.id === editing?.id) ? config.items.length : config.items.length + 1;
  const meta = [['notice', 'notice'], ['supportEmail', 'email'], ['invoiceNotice', 'invoice']];
  return <div className="space-y-4">
    <form onSubmit={save} className="space-y-4">
      <Card className="space-y-4">
        {!canWrite && <p className="text-body-sm text-ink-muted">{t('readOnly')}</p>}
        <fieldset disabled={!canWrite || saving} className="grid gap-4 md:grid-cols-3">
          {meta.map(([key, label]) => <Field key={key} label={t(label)}>
            {key === 'supportEmail'
              ? <input type="email" value={config[key]} onChange={event => change({ ...config, [key]: event.target.value })} />
              : <textarea rows={2} value={config[key]} onChange={event => change({ ...config, [key]: event.target.value })} />}
          </Field>)}
        </fieldset>
        {feedback && <p role={feedback.error ? 'alert' : 'status'} className={feedback.error ? 'text-danger' : 'text-success'}>{feedback.text}</p>}
        {canWrite && <div className="flex flex-wrap items-center gap-2">
          <Button size="lg" type="submit" variant="primary" loading={saving} disabled={!draft || conflict || saving}>
            <Save className="size-4" aria-hidden="true" />{t('save')}
          </Button>
          <Button size="lg" type="button" variant="outline" disabled={saving || conflict} onClick={event => ask(event, {
            title: t('reset'), description: t('resetDescription'), action: () => change(defaults),
          })}>{t('reset')}</Button>
          {conflict && <Button size="lg" type="button" variant="outline" onClick={event => ask(event, {
            title: t('reload'), description: t('reloadDescription'), action: () => {
              updateDraft(null);
              setPublished(null);
              setConflict(false);
              setFeedback(null);
              remote.reload();
            },
          })}>{t('reload')}</Button>}
          {draft && <span className="text-body-sm text-ink-muted">{t('unsaved')}</span>}
        </div>}
      </Card>
    </form>

    <Card className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <h2 className="mr-auto self-center text-body font-semibold text-ink">{t('items')}</h2>
        <Field label={t('category')}>
          <select value={filter} onChange={event => setFilter(event.target.value)}>
            {['all', ...categories].map(category => <option key={category} value={category}>{t(category)}</option>)}
          </select>
        </Field>
        <Field label={t('search')}>
          <input type="search" value={search} onChange={event => setSearch(event.target.value)} />
        </Field>
        {canWrite && <Button ref={addButton} size="lg" variant="outline" disabled={saving} onClick={event => startEditing(event)}>
          <Plus className="size-4" aria-hidden="true" />{t('add')}
        </Button>}
      </div>
      {!visible.length && <p role="status" className="text-body-sm text-ink-muted">{t('empty')}</p>}
      <ul className="divide-y divide-line-subtle">
        {visible.map((item, index) => <li key={item.id} data-faq-item={item.id} className="flex flex-wrap items-start gap-3 py-4">
          <div className="min-w-0 flex-1 basis-56 space-y-1">
            <span className="text-caption text-ink-subtle">{labelCategory(item.category)}</span>
            <h3 className="break-words text-body-sm font-semibold text-ink">{item.question}</h3>
            <p className="line-clamp-2 break-words whitespace-pre-wrap text-body-sm text-ink-muted">{item.answer}</p>
          </div>
          {canWrite ? <div className="flex flex-wrap gap-1">
            <IconButton size="lg" variant="ghost" icon={ArrowUp} label={t('up')} disabled={saving || index === 0} onClick={() => move(item.id, visible[index - 1].id)} />
            <IconButton size="lg" variant="ghost" icon={ArrowDown} label={t('down')} disabled={saving || index === visible.length - 1} onClick={() => move(item.id, visible[index + 1].id)} />
            <Button size="lg" variant="outline" aria-pressed={item.enabled} disabled={saving} onClick={() =>
              changeItems(config.items.map(candidate => candidate.id === item.id ? { ...item, enabled: !item.enabled } : candidate))}>
              {t(item.enabled ? 'enabled' : 'disabled')}
            </Button>
            <IconButton size="lg" variant="ghost" icon={Edit3} label={t('edit')} disabled={saving} onClick={event => startEditing(event, item)} />
            <IconButton size="lg" variant="ghost" icon={Trash2} label={t('delete')} disabled={saving} onClick={event => ask(event, {
              title: t('delete'), description: t('deleteDescription'), danger: true,
              action: () => changeItems(config.items.filter(candidate => candidate.id !== item.id)),
            })} />
          </div> : <span className="text-body-sm text-ink-muted">{t(item.enabled ? 'enabled' : 'disabled')}</span>}
        </li>)}
      </ul>
    </Card>

    <Dialog open={Boolean(editing)} onOpenChange={open => { if (!open) setEditing(null); }}>
      <DialogContent onCloseAutoFocus={event => {
        event.preventDefault();
        (opener.current?.isConnected ? opener.current : addButton.current)?.focus();
      }}>
        <DialogTitle>{t(config.items.some(item => item.id === editing?.id) ? 'edit' : 'add')}</DialogTitle>
        <DialogDescription>{t('draftDescription')}</DialogDescription>
        {editing && <form onSubmit={applyItem} className="space-y-3">
          <Field label={t('question')}>
            <input name="faqQuestion" required value={editing.question} onChange={event => {
              event.target.setCustomValidity('');
              editField('question', event.target.value);
            }} />
          </Field>
          <Field label={t('answer')}>
            <textarea name="faqAnswer" rows={5} required value={editing.answer} onChange={event => {
              event.target.setCustomValidity('');
              editField('answer', event.target.value);
            }} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('category')}>
              <select value={editing.category} onChange={event => editField('category', event.target.value)}>
                {(categories.includes(editing.category) ? categories : [...categories, editing.category])
                  .map(category => <option key={category} value={category}>{labelCategory(category)}</option>)}
              </select>
            </Field>
            <Field label={t('order')}>
              <input type="number" required min={1} max={itemCount} value={editing.order}
                onChange={event => editField('order', event.target.value === '' ? '' : Number(event.target.value))} />
            </Field>
          </div>
          <label className="flex min-h-control-lg items-center gap-3 text-body-sm text-ink">
            <input type="checkbox" checked={editing.enabled} className="size-4 accent-brand" onChange={event => editField('enabled', event.target.checked)} />
            {t('show')}
          </label>
          <DialogFooter>
            <Button size="lg" type="button" variant="outline" onClick={() => setEditing(null)}>{t('cancel')}</Button>
            <Button size="lg" type="submit" variant="primary">{t('apply')}</Button>
          </DialogFooter>
        </form>}
      </DialogContent>
    </Dialog>
    <ConfirmDraftAction confirmation={confirmation} opener={opener} close={() => {
      if (!opener.current?.isConnected) opener.current = addButton.current;
      setConfirmation(null);
    }} />
  </div>;
}

export default function SubscriptionFaqManagerClient({ canWrite }) {
  const t = useTranslations('adminSubscriptionFaq');
  const [locale, setLocale] = useState('zh-CN');
  const [drafts, setDrafts] = useState({});
  const [saving, setSaving] = useState(false);
  return <div className="space-y-4">
    <PageHeader title={t('heading')} description={t('description')} />
    <div className="max-w-xs">
      <Field label={t('locale')}>
        <select disabled={saving} value={locale} onChange={event => setLocale(event.target.value)}>
          {SUPPORTED_LOCALES.map(id => <option key={id} value={id}>{getLocaleConfig(id).nativeName}</option>)}
        </select>
      </Field>
    </div>
    <LocaleEditor key={locale} locale={locale} draft={drafts[locale]} canWrite={canWrite} onSaving={setSaving}
      updateDraft={next => setDrafts(previous => ({ ...previous, [locale]: next }))} />
  </div>;
}
