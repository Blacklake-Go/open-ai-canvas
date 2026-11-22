import type { ReactElement } from 'react';

export default function NewcomerOnboardingModal(props: {
  user?: Record<string, any> | null;
  locale?: string | null;
  studioHref?: string;
  isPageMode?: boolean;
  initialStep?: number;
  onClose?: () => void;
  onComplete?: () => void;
  [key: string]: any;
}): ReactElement;
