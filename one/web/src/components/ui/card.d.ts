import type { HTMLAttributes, ReactElement, ReactNode } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  children?: ReactNode;
}

export function Card(props: CardProps): ReactElement;
export function CardHeader(props: HTMLAttributes<HTMLDivElement>): ReactElement;
export function CardTitle(props: HTMLAttributes<HTMLHeadingElement>): ReactElement;
export function CardDescription(props: HTMLAttributes<HTMLParagraphElement>): ReactElement;
export function CardContent(props: HTMLAttributes<HTMLDivElement>): ReactElement;
export function CardFooter(props: HTMLAttributes<HTMLDivElement>): ReactElement;
