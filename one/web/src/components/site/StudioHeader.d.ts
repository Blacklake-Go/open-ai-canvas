import type { ReactElement } from 'react';

export default function StudioHeader(props: {
  locale?: string | null;
  activeTab?: string | null;
  className?: string;
  initialUser?: Record<string, any> | null;
  [key: string]: any;
}): ReactElement;
