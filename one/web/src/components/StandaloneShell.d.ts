import type { ReactElement } from 'react';

export default function StandaloneShell(props: {
  locale?: string | null;
  initialUser?: Record<string, any> | null;
  initialTab?: string | null;
  initialModel?: string | null;
  [key: string]: any;
}): ReactElement;
