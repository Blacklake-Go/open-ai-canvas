'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import { Button, Card, EmptyState, PageHeader, StatusBadge } from '@/components/admin/AdminUi';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { EXCLUSIVE_BENEFITS } from '@/lib/pricing/exclusiveBenefits';
import { oneApi } from '@/services/api/http';

const adminPath = '/api/admin/plans';
const billingFields = ['monthlyCny', 'monthlyUsd', 'quarterlyCny', 'quarterlyUsd', 'yearlyCny', 'yearlyUsd'];
const quotaFields = ['quotaBase', 'concurrency', 'asyncConcurrency', 'portraitCapacity', 'storageGb'];
const numericFields = ['displayOrder', ...billingFields, ...quotaFields];

const newPlan = {
  id: '', name: '', badge: '', features: [], exclusiveFeatures: [], enabled: false,
  monthlyCny: 0, monthlyUsd: 0, quarterlyCny: 0, quarterlyUsd: 0, yearlyCny: 0, yearlyUsd: 0,
  quotaBase: 0, concurrency: 1, asyncConcurrency: 1, portraitCapacity: 0, storageGb: 1, displayOrder: 50,
};

function PlanForm({ plan, isNew, onSave, onCancel, onRefresh, inFlight }) {
  const t = useTranslations('adminPlans');
  const [draft, setDraft] = useState(() => ({ ...plan, badge: plan.badge || '', features: plan.features?.join('\n') || '' }));
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const update = (field, value) => setDraft((current) => ({ ...current, [field]: value }));
  const submit = async (event) => {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setError(null);
    setSaving(true);
    try {
      const changes = {
        name: draft.name, badge: draft.badge, enabled: draft.enabled,
        features: draft.features.split('\n').map((line) => line.trim()).filter(Boolean),
        exclusiveFeatures: draft.exclusiveFeatures,
      };
      for (const field of numericFields) changes[field] = Number(draft[field]);
      const url = isNew ? adminPath : `${adminPath}/${encodeURIComponent(plan.id)}`;
      const result = await oneApi.adminRequest(url, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: { ...changes, ...(isNew ? { id: draft.id } : { revision: plan.revision }) },
      });
      onSave(result);
    } catch (cause) {
      setError(cause);
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };
  const field = (key, attributes = {}) => (
    <label key={key} className="block min-w-0 space-y-1 text-body-sm text-ink-muted">
      <span>{t(key)}</span>
      <Input {...attributes} size="lg" value={draft[key]} onChange={(event) => update(key, event.target.value)} />
    </label>
  );
  const numberField = (key) => field(key, {
    type: 'number', min: ['concurrency', 'asyncConcurrency', 'storageGb'].includes(key) ? 1 : 0,
    step: 1, required: true,
  });
  return (
    <form className="space-y-4" onSubmit={submit}>
      <fieldset disabled={saving} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {isNew && field('id', { required: true, maxLength: 40, pattern: '[a-z0-9][a-z0-9_\\-]{0,39}' })}
          {field('name', { required: true, maxLength: 100 })}
          {field('badge', { maxLength: 40 })}
          {numberField('displayOrder')}
        </div>
        <fieldset className="space-y-2 border-t border-line pt-3">
          <legend className="pr-2 text-body font-medium text-ink">{t('prices')}</legend>
          <div className="grid grid-cols-2 gap-3">{billingFields.map(numberField)}</div>
        </fieldset>
        <fieldset className="space-y-2 border-t border-line pt-3">
          <legend className="pr-2 text-body font-medium text-ink">{t('quotas')}</legend>
          <div className="grid grid-cols-2 gap-3">{quotaFields.map(numberField)}</div>
        </fieldset>
        <fieldset className="space-y-2 border-t border-line pt-3">
          <legend className="pr-2 text-body font-medium text-ink">{t('benefits')}</legend>
          <div className="grid gap-1 sm:grid-cols-2">
            {EXCLUSIVE_BENEFITS.map(({ key }) => (
              <label key={key} className="flex min-h-11 items-center gap-2 text-body-sm text-ink">
                <input type="checkbox" className="control-focus size-4 accent-current" checked={draft.exclusiveFeatures.includes(key)}
                  onChange={(event) => update('exclusiveFeatures', event.target.checked
                    ? [...draft.exclusiveFeatures, key]
                    : draft.exclusiveFeatures.filter((value) => value !== key))}
                />
                {t(`benefitNames.${key}`)}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block space-y-1 text-body-sm text-ink-muted">
          <span>{t('features')}</span>
          <Textarea rows={3} value={draft.features} onChange={(event) => update('features', event.target.value)} />
        </label>
        <label className="flex min-h-11 items-center gap-2 text-body-sm text-ink">
          <input type="checkbox" className="control-focus size-4 accent-current" checked={draft.enabled}
            onChange={(event) => update('enabled', event.target.checked)}
          />
          {t('enabled')}
        </label>
      </fieldset>
      {error && (
        <div role="alert" className="space-y-2 rounded-lg border border-danger-line bg-danger-soft p-3 text-body-sm text-danger">
          <p>{['PLAN_CHANGED', 'PLAN_EXISTS', 'PLAN_NOT_READY', 'INVALID_PLAN_ID'].includes(error.code)
            ? t(`errors.${error.code}`) : t('saveFailed')}</p>
          {error.code === 'PLAN_CHANGED' && <Button size="lg" onClick={onRefresh}>{t('readLatest')}</Button>}
        </div>
      )}
      <DialogFooter>
        <Button size="lg" disabled={saving} onClick={onCancel}>{t('cancel')}</Button>
        <Button type="submit" size="lg" variant="primary" loading={saving}>{t('save')}</Button>
      </DialogFooter>
    </form>
  );
}

export default function PlansManagerClient({ initialPlans, loading, error, reload, canWrite }) {
  const t = useTranslations('adminPlans');
  const [saved, setSaved] = useState({});
  const [editing, setEditing] = useState(null);
  const [feedback, setFeedback] = useState('');
  const trigger = useRef(null);
  const inFlight = useRef(false);
  const plans = [...new Map(
    [...(initialPlans || []), ...Object.values(saved)].map((plan) => [plan.id, plan]),
  ).values()].sort((a, b) => a.displayOrder - b.displayOrder || a.id.localeCompare(b.id));
  const openEditor = (event, plan = null) => {
    trigger.current = event.currentTarget;
    setFeedback('');
    setEditing({ isNew: !plan, plan: plan || newPlan });
  };
  const refresh = () => {
    setEditing(null);
    setSaved({});
    setFeedback('');
    reload();
  };
  const commit = (plan) => {
    setSaved((current) => ({ ...current, [plan.id]: plan }));
    setFeedback(plan.enabled ? t('savedPublished') : t('savedHidden'));
    setEditing(null);
  };
  return (
    <>
      <PageHeader title={t('title')} description={t('description')}>
        {canWrite && !loading && !error && <Button size="lg" variant="primary" onClick={openEditor}><Plus aria-hidden />{t('create')}</Button>}
      </PageHeader>
      {!canWrite && <p className="mb-3 text-body-sm text-ink-muted">{t('readOnly')}</p>}
      {feedback && <p role="status" className="mb-3 text-body-sm text-success">{feedback}</p>}
      {loading ? <p role="status" className="text-ink-muted">{t('loading')}</p> : error ? (
        <Card className="space-y-3">
          <p role="alert" className="text-danger">{t('loadFailed')}</p>
          <Button size="lg" onClick={refresh}>{t('retry')}</Button>
        </Card>
      ) : plans.length === 0 ? <EmptyState title={t('empty')} description={t('emptyHint')} /> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.id} className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-mono text-caption text-ink-subtle">{plan.id}</p>
                  <h2 className="break-words text-section-title font-semibold text-ink">{plan.name}</h2>
                </div>
                <StatusBadge tone={plan.enabled ? 'good' : 'neutral'}>{t(plan.enabled ? 'published' : 'hidden')}</StatusBadge>
              </div>
              <dl className="grid grid-cols-2 gap-3 text-body-sm">
                <div><dt className="text-ink-muted">{t('monthlyCny')}</dt><dd className="text-ink">¥{plan.monthlyCny}</dd></div>
                <div><dt className="text-ink-muted">{t('monthlyUsd')}</dt><dd className="text-ink">${plan.monthlyUsd}</dd></div>
                <div><dt className="text-ink-muted">{t('quotaBase')}</dt><dd className="text-ink">{plan.quotaBase}</dd></div>
                <div><dt className="text-ink-muted">{t('storageGb')}</dt><dd className="text-ink">{plan.storageGb}</dd></div>
              </dl>
              {canWrite && <Button size="lg" onClick={(event) => openEditor(event, plan)}>{t('edit')}</Button>}
            </Card>
          ))}
        </div>
      )}
      <Dialog open={editing !== null} onOpenChange={(open) => { if (!open && !inFlight.current) setEditing(null); }}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-2xl"
          onCloseAutoFocus={(event) => { event.preventDefault(); trigger.current?.focus(); }}>
          {editing && (
            <>
              <DialogHeader>
                <DialogTitle>{t(editing.isNew ? 'create' : 'edit')}</DialogTitle>
                <DialogDescription>{t('editHint')}</DialogDescription>
              </DialogHeader>
              <PlanForm key={editing.plan.id} plan={editing.plan} isNew={editing.isNew}
                onSave={commit} onCancel={() => setEditing(null)} onRefresh={refresh} inFlight={inFlight} />
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
