import type { ReactNode, ReactElement } from 'react';

export default function ModelNavTabs(props: {
  activeTab: string;
  pendingCount?: number;
  modelCount?: number;
  rightAction?: ReactNode;
}): ReactElement;
