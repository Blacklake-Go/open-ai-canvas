import type { HTMLAttributes, ReactNode } from 'react';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: string;
  children?: ReactNode;
}

export function Badge(props: BadgeProps): ReactNode;
export const badgeVariants: (opts?: any) => string;
export default Badge;
