import { useEffect, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useLocation, useParams, useSearchParams } from 'react-router';
import StudioHeader from '@/components/site/StudioHeader';
import { SpatialBackground } from '@/components/spatial';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getAuthRoutes } from '@/lib/authCopy';
import { useUserSession } from '@/lib/hooks/useUserSession';
import { getLocaleConfig, isSupportedLocale } from '@/lib/locales';
import RootNotFound from '@/pages/boundaries/RootNotFound';
import { useDocumentTitle } from '@/pages/helpers/pageHelpers';
import { ApiClientError } from '@/services/api/http';
import {
  getBillingOrder,
  getBillingOrderHistory,
  normalizedOrderStatus,
  type BillingOrder,
  type OrderStatus,
} from '@/services/api/billing-orders';

const ordersPerPage = 20;
const pollingLimit = 120_000;
const statusClass: Record<OrderStatus, string> = {
  pending: 'border-warning-line bg-warning-soft text-warning',
  paid: 'border-success-line bg-success-soft text-success',
  refunded: 'border-line bg-well text-ink',
  closed: 'border-line bg-well text-ink-muted',
  failed: 'border-danger-line bg-danger-soft text-danger',
  unknown: 'border-line bg-well text-ink-muted',
};

function orderIdFrom(params: URLSearchParams) {
  const value = params.get('orderId')?.trim() || '';
  return /^[\w-]{1,128}$/.test(value) ? value : '';
}

function noOrderAccess(error: unknown) {
  return error instanceof ApiClientError && (error.status === 403 || error.status === 404);
}

function shouldRetry(failures: number, error: unknown) {
  return failures < 1 && (!(error instanceof ApiClientError) || error.status >= 500);
}

function formatAmount(order: BillingOrder, locale: string) {
  const currency = order.currency?.trim().toUpperCase();
  const cents = order.paid_amount_cent || order.amount_cent;
  if (!/^[A-Z]{3}$/.test(currency || '') || !Number.isFinite(cents)) return '—';
  return new Intl.NumberFormat(locale, { style: 'currency', currency, currencyDisplay: 'code' }).format(cents / 100);
}

function formatTime(value: string, locale: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(parsed);
}

function OrderBadge({ order }: { order: BillingOrder }) {
  const t = useTranslations('billingOrders');
  const status = normalizedOrderStatus(order);
  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-caption font-medium ${statusClass[status]}`}>
      {t(status)}
    </span>
  );
}

function OrderFacts({ order }: { order: BillingOrder }) {
  const t = useTranslations('billingOrders');
  const locale = useLocale();
  const entries = [
    [t('orderId'), order.id],
    [t('product'), order.metadata?.productName || order.plan_id || '—'],
    [t('amount'), formatAmount(order, locale)],
    [t('created'), formatTime(order.createdAt, locale)],
    ...(order.paidAt ? [[t('paidAt'), formatTime(order.paidAt, locale)]] : []),
  ];
  return (
    <dl className="grid min-w-0 gap-3">
      {entries.map(([label, value]) => (
        <div className="grid min-w-0 gap-1 border-b border-line-subtle pb-3 sm:grid-cols-2" key={label}>
          <dt className="text-ink-muted">{label}</dt>
          <dd className="break-words text-ink sm:text-end">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function BillingShell({ history = false, children }: { history?: boolean; children: ReactNode }) {
  const t = useTranslations('billingOrders');
  const locale = useLocale();
  const { locale: routeLocale } = useParams();
  const root = getLocaleConfig(locale).rootPath;
  const heading = t(history ? 'history' : 'result');
  useDocumentTitle(`${heading} — SupDance`);
  if (routeLocale && !isSupportedLocale(routeLocale)) return <RootNotFound />;
  return (
    <div className="relative isolate min-h-screen bg-base text-ink">
      <SpatialBackground variant="minimal" />
      <StudioHeader locale={locale} />
      <main className="relative mx-auto grid w-full max-w-3xl gap-6 px-4 py-10 sm:px-8">
        <header className="grid gap-3">
          <h1 className="text-page-title">{heading}</h1>
          <div className="flex flex-wrap gap-2">
            {history ? (
              <Button asChild variant="outline" size="lg"><Link href={`${root}/pricing`}>{t('pricing')}</Link></Button>
            ) : (
              <Button asChild variant="outline" size="lg"><Link href={`${root}/billing/orders`}>{t('history')}</Link></Button>
            )}
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}

function BillingSignIn() {
  const t = useTranslations('billingOrders');
  const locale = useLocale();
  const { pathname, search } = useLocation();
  const authHref = `${getAuthRoutes(locale).loginUrl}?redirect=${encodeURIComponent(pathname + search)}`;
  return (
    <Card className="grid justify-items-start gap-3 p-5 sm:p-6">
      <p className="text-ink-muted">{t('signInDetail')}</p>
      <Button asChild size="lg" variant="primary"><Link href={authHref}>{t('signIn')}</Link></Button>
    </Card>
  );
}

function BillingReturnStatus({ owner, orderId, canceled }: { owner: string; orderId: string; canceled: boolean }) {
  const t = useTranslations('billingOrders');
  const { refresh } = useUserSession();
  const [waitingLimit, setWaitingLimit] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setWaitingLimit(true), pollingLimit);
    return () => window.clearTimeout(timer);
  }, []);
  const result = useQuery({
    queryKey: ['one.billing.order', owner, orderId],
    queryFn: ({ signal }) => getBillingOrder(owner, orderId, signal),
    gcTime: 0,
    staleTime: 0,
    retry: shouldRetry,
    refetchOnWindowFocus: true,
    refetchInterval: query =>
      !canceled && !waitingLimit && !query.state.error && query.state.data?.status === 'pending' ? 3000 : false,
  });

  if (result.error instanceof ApiClientError && result.error.status === 401) return <BillingSignIn />;
  const denied = noOrderAccess(result.error);
  const sessionChanged = result.error instanceof ApiClientError && result.error.status === 409;
  const order = denied || sessionChanged ? undefined : result.data;
  const pending = order?.status === 'pending';
  return (
    <Card className="grid min-w-0 gap-5 p-5 sm:p-6">
      {result.isPending && <p role="status" className="text-ink-muted">{t('loading')}</p>}
      {result.isError && (
        <p role="alert" className="text-danger">{t(denied ? 'missing' : sessionChanged ? 'accountChanged' : 'readFailed')}</p>
      )}
      {order && (
        <>
          <div role="status" className="grid justify-items-start gap-3">
            <OrderBadge order={order} />
            {pending && <p className="text-ink-muted">{t(canceled ? 'canceledHint' : waitingLimit ? 'stillPending' : 'waiting')}</p>}
          </div>
          <OrderFacts order={order} />
        </>
      )}
      {!denied && (pending || result.isError) && (
        <Button
          size="lg"
          className="justify-self-start"
          loading={result.isFetching}
          onClick={() => {
            if (sessionChanged) void refresh();
            else void result.refetch();
          }}
        >
          {t('refresh')}
        </Button>
      )}
    </Card>
  );
}

export function BillingReturnPage() {
  const t = useTranslations('billingOrders');
  const { user } = useUserSession();
  const [params] = useSearchParams();
  const orderId = orderIdFrom(params);
  const owner = user?.id ? String(user.id) : '';
  return (
    <BillingShell>
      {!orderId ? (
        <Card className="p-5 sm:p-6"><p role="status" className="text-ink-muted">{t('missing')}</p></Card>
      ) : owner ? (
        <BillingReturnStatus key={`${owner}:${orderId}`} owner={owner} orderId={orderId} canceled={params.get('canceled') === '1'} />
      ) : <BillingSignIn />}
    </BillingShell>
  );
}

function BillingOrderList({ owner }: { owner: string }) {
  const t = useTranslations('billingOrders');
  const locale = useLocale();
  const root = getLocaleConfig(locale).rootPath;
  const [params, setParams] = useSearchParams();
  const requestedPage = Number(params.get('page'));
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 1 && requestedPage <= 10000 ? requestedPage : 1;
  const { refresh } = useUserSession();
  const history = useQuery({
    queryKey: ['one.billing.orders', owner, page],
    queryFn: ({ signal }) => getBillingOrderHistory(owner, (page - 1) * ordersPerPage, ordersPerPage + 1, signal),
    gcTime: 0,
    retry: shouldRetry,
    refetchOnWindowFocus: true,
  });

  if (history.error instanceof ApiClientError && history.error.status === 401) return <BillingSignIn />;
  const accountChanged = history.error instanceof ApiClientError && history.error.status === 409;
  const orders = history.error ? undefined : history.data;
  return (
    <Card className="grid min-w-0 gap-4 p-5 sm:p-6">
      {history.isPending && <p role="status" className="text-ink-muted">{t('loading')}</p>}
      {history.isError && (
        <>
          <p role="alert" className="text-danger">{t(accountChanged ? 'accountChanged' : 'readFailed')}</p>
          <Button size="lg" className="justify-self-start" loading={history.isFetching} onClick={() => {
            if (accountChanged) void refresh();
            else void history.refetch();
          }}>{t('refresh')}</Button>
        </>
      )}
      {orders && orders.length === 0 && <p role="status" className="text-ink-muted">{t('empty')}</p>}
      {orders && orders.length > 0 && (
        <ul className="divide-y divide-line-subtle">
          {orders.slice(0, ordersPerPage).map(order => (
            <li key={order.id} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="grid min-w-0 gap-2">
                <h2 className="break-words font-semibold">{order.metadata?.productName || order.plan_id || order.id}</h2>
                <p className="break-words text-caption text-ink-muted">{order.id} · {formatTime(order.createdAt, locale)}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <OrderBadge order={order} />
                  <span className="text-body-sm">{formatAmount(order, locale)}</span>
                </div>
              </div>
              <Button asChild size="lg" variant="outline" className="justify-self-start sm:justify-self-end">
                <Link
                  href={`${root}/billing/success?orderId=${encodeURIComponent(order.id)}`}
                  aria-label={t('detailsOf', { id: order.id })}
                >{t('details')}</Link>
              </Button>
            </li>
          ))}
        </ul>
      )}
      {(page > 1 || (orders?.length || 0) > ordersPerPage) && (
        <nav aria-label={t('history')} className="flex flex-wrap gap-2">
          <Button size="lg" disabled={page <= 1} onClick={() => setParams({ page: String(page - 1) })}>{t('prev')}</Button>
          <Button size="lg" disabled={(orders?.length || 0) <= ordersPerPage || page === 10000} onClick={() => setParams({ page: String(page + 1) })}>{t('next')}</Button>
        </nav>
      )}
    </Card>
  );
}

export function BillingHistoryPage() {
  const { user } = useUserSession();
  const owner = user?.id ? String(user.id) : '';
  return <BillingShell history>{owner ? <BillingOrderList key={owner} owner={owner} /> : <BillingSignIn />}</BillingShell>;
}
