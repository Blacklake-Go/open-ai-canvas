import type { ReactElement, ReactNode } from 'react';

export function Dialog(props: {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: ReactNode;
  [key: string]: any;
}): ReactElement;
export function DialogPortal(props: { children?: ReactNode; [key: string]: any }): ReactElement;
export function DialogOverlay(props: { className?: string; [key: string]: any }): ReactElement;
export function DialogTrigger(props: { asChild?: boolean; children?: ReactNode; [key: string]: any }): ReactElement;
export function DialogClose(props: { asChild?: boolean; children?: ReactNode; [key: string]: any }): ReactElement;
export function DialogContent(props: { className?: string; children?: ReactNode; [key: string]: any }): ReactElement;
export function DialogHeader(props: { className?: string; children?: ReactNode; [key: string]: any }): ReactElement;
export function DialogFooter(props: { className?: string; children?: ReactNode; [key: string]: any }): ReactElement;
export function DialogTitle(props: { className?: string; children?: ReactNode; [key: string]: any }): ReactElement;
export function DialogDescription(props: { className?: string; children?: ReactNode; [key: string]: any }): ReactElement;
