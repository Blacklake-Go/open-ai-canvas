import type { ReactElement } from 'react';

export default function AuthModal(props: {
  isOpen?: boolean;
  onClose?: () => void;
  locale?: string | null;
  initialMode?: string | null;
  onSuccess?: (user?: any) => void;
  embedded?: boolean;
  parentOrigin?: string | null;
  redirectTarget?: string | null;
  [key: string]: any;
}): ReactElement | null;
