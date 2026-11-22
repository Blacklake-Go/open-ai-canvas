import type { ReactElement } from 'react';

export default function ExportButton(props: {
  type: string;
  label?: string;
  requiredPermission?: string;
  [key: string]: any;
}): ReactElement;
