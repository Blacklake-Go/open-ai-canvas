import { apiRequest } from './http';

export type OrderStatus = 'pending' | 'paid' | 'refunded' | 'closed' | 'failed' | 'unknown';

export interface BillingOrder {
  id: string;
  plan_id: string;
  status: string;
  provider: string;
  amount_cent: number;
  paid_amount_cent?: number;
  currency: string;
  createdAt: string;
  paidAt?: string;
  metadata?: { productName?: string };
}

function orderOptions(owner: string, signal: AbortSignal) {
  return { cache: 'no-store' as const, headers: { 'X-ONE-Expected-User': owner }, signal };
}

export function getBillingOrder(owner: string, orderId: string, signal: AbortSignal) {
  return apiRequest<{ order: BillingOrder }>(
    `/api/billing/orders/${encodeURIComponent(orderId)}/status`,
    orderOptions(owner, signal),
  ).then(result => result.order);
}

export function getBillingOrderHistory(owner: string, offset: number, limit: number, signal: AbortSignal) {
  const params = new URLSearchParams({ offset: String(offset), limit: String(limit) });
  return apiRequest<{ orders: BillingOrder[] }>(
    `/api/billing/orders/my?${params}`,
    orderOptions(owner, signal),
  ).then(result => result.orders);
}

export function normalizedOrderStatus(order: BillingOrder): OrderStatus {
  switch (order.status) {
    case 'pending': return 'pending';
    case 'paid':
    case 'completed': return 'paid';
    case 'refunded': return 'refunded';
    case 'expired':
    case 'closed':
    case 'cancelled':
    case 'canceled': return 'closed';
    case 'failed': return 'failed';
    default: return 'unknown';
  }
}
