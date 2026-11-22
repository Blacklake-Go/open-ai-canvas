import type { ReactElement } from 'react';

export default function FrontendConfigClient(props: {
  initialModels?: any[];
  initialBrand?: string;
  pendingPricesCount?: number;
  canWrite?: boolean;
  [key: string]: any;
}): ReactElement;
