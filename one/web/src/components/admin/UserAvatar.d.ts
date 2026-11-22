import type { ReactElement, ReactNode } from 'react';

export function UserAvatar(props: {
  src?: string | null;
  alt?: string;
  letter?: string;
  seed?: string | number;
  fallbackType?: string;
  className?: string;
  children?: ReactNode;
  [key: string]: any;
}): ReactElement;

export default UserAvatar;
