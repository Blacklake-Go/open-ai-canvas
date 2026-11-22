import type { ReactNode, ReactElement } from 'react';

export function sanitizeAvatarUrl(url?: string | null): string | null;
export function getDeterministicDefaultAvatar(seed?: string | number): string;

export default function UserAvatar(props: {
  src?: string | null;
  alt?: string;
  letter?: string;
  seed?: string | number;
  fallbackType?: string;
  className?: string;
  children?: ReactNode;
  [key: string]: any;
}): ReactElement;
