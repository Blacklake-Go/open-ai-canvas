import { useEffect, useId, useState, type FormEvent } from 'react';
import { useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Link, useLocation, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useUserSession } from '@/lib/hooks/useUserSession';
import { ApiClientError } from '@/services/api/http';
import { workshopApi, type WorkshopDraft, type WorkshopProject } from '@/services/api/workshop';
import './workshop-projects.css';

const listKey = (owner: string) => ['one-workshop', owner, 'projects'];
const projectKey = (owner: string, id: string) => ['one-workshop', owner, 'project', id];
const saveKey = (owner: string) => ['one-workshop', owner, 'save'];
const emptyDraft = { title: '', story: '' };

function WorkshopProjects() {
  const t = useTranslations('workshopProjects');
  const { user } = useUserSession();
  const location = useLocation();
  const loginPath = `/login?${new URLSearchParams({ redirect: location.pathname + location.search })}`;
  return (
    <section aria-labelledby="workshop-projects-title" className="workshop-projects mt-8 rounded-2xl border border-line bg-surface p-4 sm:p-6">
      <h2 id="workshop-projects-title" className="text-lg font-semibold text-ink">{t('heading')}</h2>
      {user?.id ? (
        <ProjectWorkspace key={String(user.id)} owner={String(user.id)} loginPath={loginPath} />
      ) : (
        <Button asChild variant="secondary" size="lg" className="mt-3"><Link to={loginPath}>{t('signIn')}</Link></Button>
      )}
    </section>
  );
}

function ProjectWorkspace({ owner, loginPath }: { owner: string; loginPath: string }) {
  const t = useTranslations('workshopProjects');
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [offset, setOffset] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [created, setCreated] = useState(false);
  const isSaving = useIsMutating({ mutationKey: saveKey(owner) }) > 0;
  const selection = params.get('project') || '';
  const isNew = selection === 'new';
  const list = useQuery({
    queryKey: [...listKey(owner), offset],
    queryFn: ({ signal }) => workshopApi.list(owner, offset, signal),
    retry: false,
  });
  const detail = useQuery({
    queryKey: projectKey(owner, selection),
    queryFn: ({ signal }) => workshopApi.get(owner, selection, signal),
    enabled: Boolean(selection) && !isNew,
    refetchOnWindowFocus: false,
    gcTime: 0,
    retry: false,
  });

  useEffect(() => {
    if (!dirty) return;
    const preventUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', preventUnload);
    return () => window.removeEventListener('beforeunload', preventUnload);
  }, [dirty]);

  function selectProject(next: string, saved = false) {
    if (next === selection || (!saved && (isSaving || (dirty && !window.confirm(t('discard')))))) return;
    const nextParams = new URLSearchParams(params);
    if (next) nextParams.set('project', next);
    else nextParams.delete('project');
    setDirty(false);
    setCreated(saved);
    setParams(nextParams, { replace: saved });
  }

  async function projectSaved(project: WorkshopProject) {
    setDirty(false);
    queryClient.setQueryData(projectKey(owner, project.id), project);
    if (isNew) {
      setOffset(0);
      selectProject(project.id, true);
    }
    await queryClient.invalidateQueries({ queryKey: listKey(owner) });
  }

  const page = list.data;

  return (
    <div className="mt-4 grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <div>
        <Button variant="secondary" size="lg" disabled={isSaving} onClick={() => selectProject('new')}>{t('create')}</Button>
        {list.isPending && <p role="status" className="mt-3 text-ink-muted">{t('loading')}</p>}
        {list.isError && <WorkshopError error={list.error} loginPath={loginPath} onRetry={() => void list.refetch()} />}
        {page?.projects.length === 0 && <p className="mt-3 text-ink-muted">{t('empty')}</p>}
        <ul className="mt-3 space-y-2">
          {page?.projects.map(project => (
            <li key={project.id}>
              <Button fullWidth variant={selection === project.id ? 'secondary' : 'ghost'} size="lg" disabled={isSaving}
                aria-current={selection === project.id ? 'true' : undefined}
                onClick={() => selectProject(project.id)}>
                <span className="min-w-0 truncate">{project.title}</span>
              </Button>
            </li>
          ))}
        </ul>
        {page && (offset > 0 || page.hasMore) && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="ghost" size="lg" disabled={offset === 0}
              onClick={() => setOffset(value => value - page.pageSize)}>{t('previous')}</Button>
            <Button variant="ghost" size="lg" disabled={!page.hasMore}
              onClick={() => setOffset(value => value + page.pageSize)}>{t('next')}</Button>
          </div>
        )}
      </div>
      <div className="min-w-0">
        {selection && <Button variant="ghost" size="lg" disabled={isSaving} onClick={() => selectProject('')}>{t('close')}</Button>}
        {created && <p role="status" className="mt-3 text-ink">{t('saved')}</p>}
        {selection && !isNew && detail.isPending && <p role="status" className="mt-3 text-ink-muted">{t('loading')}</p>}
        {detail.isError && <WorkshopError error={detail.error} loginPath={loginPath} onRetry={() => void detail.refetch()} />}
        {(isNew || detail.isSuccess) && (
          <ProjectEditor key={selection} owner={owner} project={detail.data} loginPath={loginPath}
            onDirty={value => { setDirty(value); setCreated(false); }} onSaved={projectSaved} />
        )}
      </div>
    </div>
  );
}

function ProjectEditor({ owner, project, loginPath, onDirty, onSaved }: {
  owner: string;
  project?: WorkshopProject;
  loginPath: string;
  onDirty: (dirty: boolean) => void;
  onSaved: (project: WorkshopProject) => Promise<void>;
}) {
  const t = useTranslations('workshopProjects');
  const titleId = useId();
  const storyId = useId();
  const [creationKey] = useState(() => project ? '' : crypto.randomUUID());
  const [revision, setRevision] = useState(project?.revision ?? 0);
  const [baseline, setBaseline] = useState<WorkshopDraft>(project || emptyDraft);
  const [draft, setDraft] = useState<WorkshopDraft>(project || emptyDraft);
  const [invalid, setInvalid] = useState(false);
  const save = useMutation({
    mutationKey: saveKey(owner),
    gcTime: 0,
    mutationFn: (input: WorkshopDraft) => project
      ? workshopApi.update(owner, project.id, revision, input)
      : workshopApi.create(owner, input, creationKey),
    onSuccess: async result => {
      setRevision(result.revision);
      setBaseline(result);
      setDraft({ title: result.title, story: result.story });
      await onSaved(result);
    },
  });

  function change(next: WorkshopDraft) {
    setDraft(next);
    onDirty(next.title !== baseline.title || next.story !== baseline.story);
    setInvalid(false);
    if (save.isSuccess || save.isError) save.reset();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = draft.title.trim();
    if (!title || Array.from(title).length > 160 || Array.from(draft.story).length > 20000) {
      setInvalid(true);
      return;
    }
    save.mutate({ title, story: draft.story });
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-4">
      <div>
        <label htmlFor={titleId} className="mb-2 block font-medium text-ink">{t('title')}</label>
        <Input id={titleId} size="lg" value={draft.title} required disabled={save.isPending}
          onChange={event => change({ ...draft, title: event.target.value })} />
      </div>
      <div>
        <label htmlFor={storyId} className="mb-2 block font-medium text-ink">{t('story')}</label>
        <Textarea id={storyId} rows={8} value={draft.story} disabled={save.isPending}
          onChange={event => change({ ...draft, story: event.target.value })} />
      </div>
      <Button type="submit" variant="primary" size="lg" loading={save.isPending}
        disabled={save.isPending || Boolean(project && draft.title === baseline.title && draft.story === baseline.story)}>
        {t('save')}
      </Button>
      {invalid && <p role="alert" className="text-danger">{t('invalid')}</p>}
      {save.isError && <WorkshopError error={save.error} loginPath={loginPath} />}
      {save.isSuccess && <p role="status" className="text-ink">{t('saved')}</p>}
    </form>
  );
}

function WorkshopError({ error, loginPath, onRetry }: { error: Error; loginPath: string; onRetry?: () => void }) {
  const t = useTranslations('workshopProjects');
  const apiError = error instanceof ApiClientError ? error : undefined;
  if (apiError?.status === 401 || apiError?.code === 'WORKSHOP_ACCOUNT_CHANGED') {
    return <Button asChild variant="secondary" size="lg" className="mt-3"><Link to={loginPath}>{t('signIn')}</Link></Button>;
  }
  return (
    <div className="mt-3">
      <p role="alert" className="text-danger">
        {t(apiError?.status === 404 ? 'missing' : apiError?.status === 409 ? 'conflict' : apiError?.status === 400 ? 'invalid' : 'failed')}
      </p>
      {onRetry && <Button variant="ghost" size="lg" onClick={onRetry}>{t('retry')}</Button>}
    </div>
  );
}

export default WorkshopProjects;
