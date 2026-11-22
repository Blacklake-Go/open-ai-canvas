import type { ReactElement } from 'react';

export function CopyableId(props: { id: string | number; label?: string }): ReactElement;

export function ConfirmActionDialog(props: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  tone?: string;
  onConfirm?: () => void | Promise<void>;
  loading?: boolean;
  [key: string]: any;
}): ReactElement;
