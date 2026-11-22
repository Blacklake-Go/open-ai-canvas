import type { ReactElement, ReactNode } from 'react';

export function Select(props: {
  value?: string;
  defaultValue?: string;
  onValueChange?: (val: string) => void;
  children?: ReactNode;
  [key: string]: any;
}): ReactElement;
export function SelectTrigger(props: { className?: string; children?: ReactNode; [key: string]: any }): ReactElement;
export function SelectValue(props: { placeholder?: string; children?: ReactNode; [key: string]: any }): ReactElement;
export function SelectContent(props: { className?: string; children?: ReactNode; [key: string]: any }): ReactElement;
export function SelectGroup(props: { children?: ReactNode; [key: string]: any }): ReactElement;
export function SelectLabel(props: { className?: string; children?: ReactNode; [key: string]: any }): ReactElement;
export function SelectItem(props: { value: string; className?: string; children?: ReactNode; [key: string]: any }): ReactElement;
export function SelectSeparator(props: { className?: string; [key: string]: any }): ReactElement;
export function SelectScrollUpButton(props: { className?: string; [key: string]: any }): ReactElement;
export function SelectScrollDownButton(props: { className?: string; [key: string]: any }): ReactElement;
