import { useId, useRef, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, PageHeader } from '@/components/admin/AdminUi';
import { PERMISSIONS, hasPermission } from '@/lib/admin/permissions';
import { useAdminData, useAdminPermissionGuard, useDocumentTitle } from '@/pages/helpers/pageHelpers';
import {
  saveWorkshopModels,
  workshopModelsAdminPath,
  workshopModelSettingsUpdateKey,
  type WorkshopModelConfiguration,
  type WorkshopModelSelection,
} from '@/services/api/workshop';

const selectClass = 'control-focus min-h-control-lg w-full rounded-lg border border-line bg-surface px-3 py-2 text-body-sm text-ink';

function WorkshopModelRow({
  tool, selected, disabled, onChange,
}: {
  tool: WorkshopModelConfiguration['tools'][number];
  selected?: WorkshopModelSelection;
  disabled: boolean;
  onChange: (selection: WorkshopModelSelection | null) => void;
}) {
  const t = useTranslations('workshopModels');
  const id = useId();
  const families = new Map(tool.versions.map(version => [version.modelId, version.modelName]));
  const choices = tool.versions.filter(version => version.modelId === selected?.modelId);
  const valid = choices.some(version => version.versionId === selected?.versionId && version.contract === selected?.contract);

  return <div data-workshop-tool={tool.id} className="grid gap-3 py-4 sm:grid-cols-3 sm:items-center">
    <h2 className="text-body-sm font-semibold text-ink">{t(`tools.${tool.id}`)}</h2>
    <div className="min-w-0 space-y-1">
      <label htmlFor={`${id}-model`} className="block text-body-sm text-ink-muted">{t('model')}</label>
      <select id={`${id}-model`} className={selectClass} disabled={disabled} value={selected?.modelId || ''}
        onChange={event => {
          const modelId = event.target.value;
          onChange(modelId ? { modelId, versionId: '', contract: '' } : null);
        }}>
        <option value="">{t('automatic')}</option>
        {selected && !families.has(selected.modelId) && <option value={selected.modelId}>{selected.modelId}</option>}
        {[...families].map(([modelId, name]) => <option key={modelId} value={modelId}>{name}</option>)}
      </select>
    </div>
    <div className="min-w-0 space-y-1">
      <label htmlFor={`${id}-version`} className="block text-body-sm text-ink-muted">{t('version')}</label>
      <select id={`${id}-version`} className={selectClass} disabled={disabled || !selected?.modelId}
        value={valid ? selected?.versionId : ''}
        onChange={event => {
          const v = choices.find(option => option.versionId === event.target.value);
          if (v) onChange({ modelId: v.modelId, versionId: v.versionId, contract: v.contract });
        }}>
        <option value="" disabled>{t('chooseVersion')}</option>
        {choices.map(version => <option key={version.versionId} value={version.versionId}>
          {version.versionName} · {version.provider}
        </option>)}
      </select>
      {selected?.versionId && !valid && <p role="status" className="text-body-sm text-warning">{t('unavailable')}</p>}
      {!families.size && !selected && <p className="text-body-sm text-ink-muted">{t('noVersions')}</p>}
    </div>
  </div>;
}

export default function AdminWorkshopModelsPage() {
  const t = useTranslations('workshopModels');
  const { user, redirectEl } = useAdminPermissionGuard(PERMISSIONS.modelsRead);
  const remote = useAdminData<WorkshopModelConfiguration>(redirectEl ? null : workshopModelsAdminPath);
  useDocumentTitle(`${t('title')} | SupDance`);
  const [draft, setDraft] = useState<Record<string, WorkshopModelSelection> | null>(null);
  const [published, setPublished] = useState<WorkshopModelConfiguration | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; error?: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  const canWrite = hasPermission(user?.role, PERMISSIONS.modelsWrite);
  const data = published || remote.data;

  if (redirectEl) return redirectEl;
  if (remote.loading) return <p role="status">{t('loading')}</p>;
  if (!data || remote.error) return <Card className="space-y-3">
    <p role="alert">{remote.error || t('loadFailed')}</p>
    <Button size="lg" type="button" variant="outline" onClick={remote.reload}>{t('retry')}</Button>
  </Card>;

  const defaults = draft || data.defaults;
  const valid = data.tools.every(tool => {
    const choice = defaults[tool.id];
    return !choice || tool.versions.some(v => v.modelId === choice.modelId && v.versionId === choice.versionId && v.contract === choice.contract);
  });

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!data || !canWrite || !valid || !draft || inFlight.current) return;
    setSaving(true);
    inFlight.current = true;
    setFeedback(null);
    try {
      const next = await saveWorkshopModels(draft, data.revision);
      setPublished(next);
      setDraft(null);
      setFeedback({ text: t('saved') });
      try { localStorage.setItem(workshopModelSettingsUpdateKey, String(Date.now())); } catch {}
    } catch (error) {
      setFeedback({ error: true, text: error instanceof Error ? error.message : t('saveFailed') });
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  return <div className="space-y-4">
    <PageHeader title={t('title')} description={t('description')} />
    <Card>
      <form onSubmit={submit} className="space-y-4">
        <div className="divide-y divide-line-subtle">
          {data.tools.map(tool => <WorkshopModelRow key={tool.id} tool={tool} selected={defaults[tool.id]}
            disabled={!canWrite || saving} onChange={selection => {
              const next = { ...defaults };
              if (selection) next[tool.id] = selection;
              else delete next[tool.id];
              setDraft(next);
              setFeedback(null);
            }} />)}
        </div>
        {feedback && <p role={feedback.error ? 'alert' : 'status'} className={feedback.error ? 'text-danger' : 'text-success'}>
          {feedback.text}
        </p>}
        {canWrite && <div className="flex flex-wrap gap-2">
          <Button size="lg" variant="primary" type="submit" loading={saving} disabled={!valid || !draft || saving}>{t('save')}</Button>
          <Button size="lg" variant="outline" type="button" disabled={saving} onClick={() => {
            setPublished(null);
            setDraft(null);
            setFeedback(null);
            remote.reload();
          }}>{t('reload')}</Button>
        </div>}
      </form>
    </Card>
  </div>;
}
