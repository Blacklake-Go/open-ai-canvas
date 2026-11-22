import type { ReactNode, ReactElement } from 'react';
export { CopyableId, ConfirmActionDialog } from './AdminUiClient';
export { Badge } from '@/components/ui/badge';
export { Button } from '@/components/ui/button';

export function PageHeader(props: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}): ReactElement;

export function Card(props: { children?: ReactNode; className?: string }): ReactElement;

export function StatusBadge(props: {
  children?: ReactNode;
  tone?: 'good' | 'warn' | 'danger' | 'info' | 'neutral' | string;
}): ReactElement;

export function MetricCard(props: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'good' | 'warn' | 'danger' | 'info' | 'neutral' | string;
}): ReactElement;

export function EmptyState(props: { title?: string; description?: string }): ReactElement;

export function AdminSettingRow(props: {
  label: ReactNode;
  value: ReactNode;
  context?: ReactNode;
  action?: ReactNode;
  onClickAction?: () => void;
  className?: string;
}): ReactElement;

export function AdminCardGridItem(props: {
  title: ReactNode;
  badge?: ReactNode;
  subtext?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}): ReactElement;

export function AdminUnderlineTabs(props: {
  tabs?: Array<{ id: string; label: string; count?: number }>;
  activeTab: string;
  onTabChange?: (tab: string) => void;
  rightAction?: ReactNode;
  className?: string;
}): ReactElement;

export function DataTable(props: {
  columns: Array<{ key?: string; label: ReactNode; render?: (row: any) => ReactNode; className?: string }>;
  rows?: any[];
  data?: any[];
  empty?: string;
  emptyText?: string;
}): ReactElement;

export function Pagination(props: {
  meta?: any;
  searchParams?: Record<string, any>;
}): ReactElement | null;

export function AdminChartCard(props: {
  title: ReactNode;
  subtitle?: ReactNode;
  filters?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}): ReactElement;

export function AdminDateStepper(props: {
  label: ReactNode;
  onPrev?: () => void;
  onNext?: () => void;
  canPrev?: boolean;
  canNext?: boolean;
}): ReactElement;
