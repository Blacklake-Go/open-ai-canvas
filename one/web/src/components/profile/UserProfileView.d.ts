import type { ReactElement } from 'react';

export default function UserProfileView(props: {
  creator?: Record<string, any> | null;
  userId?: string | number | null;
  showHeader?: boolean;
  showBackLink?: boolean;
  embedded?: boolean;
  [key: string]: any;
}): ReactElement;
