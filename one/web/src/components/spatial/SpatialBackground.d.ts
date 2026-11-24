import type { ReactElement, ReactNode } from 'react';

export interface SpatialBackgroundProps {
  variant?: 'hero' | 'studio' | 'canvas' | 'minimal' | string;
  showGrid?: boolean;
  showAurora?: boolean;
  motionLevel?: string;
  showArc?: boolean | null;
  showPointer?: boolean | null;
  showNoise?: boolean;
  isFixed?: boolean;
  parallaxOffset?: { x: number; y: number } | null;
  className?: string;
  children?: ReactNode;
}

export default function SpatialBackground(props: SpatialBackgroundProps): ReactElement;
