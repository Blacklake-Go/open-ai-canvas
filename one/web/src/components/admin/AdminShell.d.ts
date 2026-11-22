import type { ReactNode } from 'react';

export interface AdminShellProps {
  user?: Record<string, any> | null;
  permissions?: string[];
  children?: ReactNode;
}

export default function AdminShell(props: AdminShellProps): JSX.Element;
