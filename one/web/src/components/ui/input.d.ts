import type { ForwardRefExoticComponent, InputHTMLAttributes, RefAttributes } from 'react';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: 'xs' | 'sm' | 'md' | 'lg' | string;
  error?: boolean;
}

export const Input: ForwardRefExoticComponent<InputProps & RefAttributes<HTMLInputElement>>;
