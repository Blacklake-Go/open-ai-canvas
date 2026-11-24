import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { developerKeys, type DeveloperKeyInfo } from '@/services/api/developer';
import { ApiClientError } from '@/services/api/http';

type KeyAction = 'rotate' | 'revoke';

export default function DeveloperKeyPanel({ owner }: { owner: string }) {
  const t = useTranslations('developer');
  const locale = useLocale();
  const lifetime = useRef<AbortController | null>(null);
  const [keyInfo, setKeyInfo] = useState<DeveloperKeyInfo | null>(null);
  const [secret, setSecret] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setError('');
    setNotice('');
    setSecret('');
    try {
      const result = await developerKeys.read(owner, signal);
      if (signal.aborted) return;
      setKeyInfo(result.keyInfo);
      setStale(false);
    } catch {
      if (signal.aborted) return;
      setError('readError');
      setStale(true);
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [owner]);

  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  async function change(action: 'create' | KeyAction) {
    const signal = lifetime.current?.signal;
    if (!signal || signal.aborted || working || stale) return;
    setWorking(true);
    setSecret('');
    setNotice('');
    setError('');
    try {
      if (action === 'revoke' && keyInfo) {
        await developerKeys.revoke(owner, keyInfo.id, signal);
        if (signal.aborted) return;
        setKeyInfo(null);
        setNotice('revoked');
      } else if (action !== 'revoke') {
        const result = await developerKeys.issue(owner, keyInfo?.id, signal);
        if (signal.aborted) return;
        setKeyInfo(result.keyInfo);
        setSecret(result.apiKey);
      }
    } catch (err) {
      if (signal.aborted) return;
      setStale(true);
      setError(err instanceof ApiClientError && err.status === 409 ? 'keyChanged' : 'writeError');
    } finally {
      if (!signal.aborted) setWorking(false);
    }
  }

  async function copySecret() {
    try {
      await navigator.clipboard.writeText(secret);
      setError('');
      setNotice('copied');
    } catch {
      setNotice('');
      setError('copyError');
    }
  }

  if (loading) return <p role="status" className="text-ink-muted">{t('loading')}</p>;

  return (
    <div className="grid gap-4">
      {error && <p role="alert" className="text-danger">{t(error)}</p>}
      {notice && <p role="status" className="text-ink-muted">{t(notice)}</p>}
      {stale ? (
        <Button size="lg" className="justify-self-start" onClick={() => {
          const signal = lifetime.current?.signal;
          if (signal) void load(signal);
        }}>
          {t('refresh')}
        </Button>
      ) : keyInfo ? (
        <>
          <div className="grid gap-1 rounded-lg border border-line-subtle bg-well p-4">
            <code className="text-body text-ink">sk-one-••••{keyInfo.suffix}</code>
            <time dateTime={keyInfo.createdAt} className="text-caption text-ink-muted">
              {t('createdAt', { time: new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(keyInfo.createdAt)) })}
            </time>
          </div>
          <div className="flex flex-wrap gap-2">
            {(['rotate', 'revoke'] as const).map(action => (
              <AlertDialog key={action}>
                <AlertDialogTrigger asChild>
                  <Button size="lg" variant={action === 'revoke' ? 'danger' : 'secondary'} disabled={working}>
                    {t(action)}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="max-w-md">
                  <AlertDialogHeader className="text-start">
                    <AlertDialogTitle className="text-ink">{t(action)}</AlertDialogTitle>
                    <AlertDialogDescription className="text-ink-muted">{t('invalidate')}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="gap-2">
                    <AlertDialogCancel size="lg" className="w-full sm:w-auto">{t('cancel')}</AlertDialogCancel>
                    <AlertDialogAction size="lg" className="w-full sm:w-auto" variant={action === 'revoke' ? 'danger' : 'primary'} onClick={() => void change(action)}>
                      {t(action)}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ))}
          </div>
        </>
      ) : (
        <div className="grid justify-items-start gap-2">
          <p className="text-ink-muted">{t('empty')}</p>
          <Button size="lg" variant="primary" loading={working} onClick={() => void change('create')}>
            {t('create')}
          </Button>
        </div>
      )}
      {working && <p role="status" className="text-ink-muted">{t('saving')}</p>}
      {secret && (
        <div className="grid gap-3 rounded-lg border border-line bg-well p-4">
          <p role="status" className="text-ink">{t('reveal')}</p>
          <code className="break-all select-all text-body text-ink">{secret}</code>
          <div className="flex flex-wrap gap-2">
            <Button size="lg" onClick={() => void copySecret()}>{t('copyKey')}</Button>
            <Button size="lg" variant="ghost" onClick={() => { setSecret(''); setNotice(''); setError(''); }}>
              {t('hideKey')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
