import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  ReactElement,
  ReactNode,
  TextareaHTMLAttributes,
} from 'react';

export function promptControlClassName(opts?: { active?: boolean; className?: string }): string;
export function promptMediaButtonClassName(opts?: { active?: boolean; className?: string }): string;
export const PROMPT_MEDIA_PREVIEW_CLASS: string;
export const PROMPT_CONTROL_LABEL_CLASS: string;
export function PromptChevronIcon(props?: { className?: string }): ReactElement;
export function PromptAspectRatioIcon(props?: { className?: string }): ReactElement;
export function PromptDurationIcon(props?: { className?: string }): ReactElement;
export function PromptQualityIcon(props?: { className?: string }): ReactElement;
export function PromptPopover(props: HTMLAttributes<HTMLDivElement>): ReactElement;
export function PromptPopoverHeader(props: { children?: ReactNode; className?: string }): ReactElement;
export function PromptMenuList(props: { children?: ReactNode; className?: string }): ReactElement;
export function PromptMenuItem(props: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }): ReactElement;
export function PromptSegmentedControl(props: { children?: ReactNode; className?: string }): ReactElement;
export function PromptSegmentOption(props: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }): ReactElement;
export function PromptComposer(
  props: HTMLAttributes<HTMLDivElement> & { positionClassName?: string; children?: ReactNode }
): ReactElement;
export function PromptTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>): ReactElement;
export function PromptFooter(props: { children?: ReactNode; className?: string; bordered?: boolean }): ReactElement;
export function PromptControls(props: HTMLAttributes<HTMLDivElement>): ReactElement;
export function PromptAction(props: ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }): ReactElement;
