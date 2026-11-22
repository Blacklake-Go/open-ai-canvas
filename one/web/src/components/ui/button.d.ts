import type { ButtonHTMLAttributes, ElementType, ForwardRefExoticComponent, ReactNode, RefAttributes } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'tertiary' | 'outline' | 'danger' | 'default' | 'destructive' | 'link' | string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'default' | 'icon' | 'icon-xs' | 'icon-sm' | 'icon-md' | 'icon-lg' | string;
  shape?: string;
  as?: ElementType;
  asChild?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  children?: ReactNode;
}

export const Button: ForwardRefExoticComponent<ButtonProps & RefAttributes<HTMLButtonElement>>;
export const IconButton: ForwardRefExoticComponent<ButtonProps & RefAttributes<HTMLButtonElement>>;
export const buttonVariants: (opts?: any) => string;
export function withoutRadiusUtilities(className?: string): string;
export default Button;
