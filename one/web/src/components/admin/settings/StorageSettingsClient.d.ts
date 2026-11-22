import type { ReactElement } from 'react';

export default function StorageSettingsClient(props: {
  initial?: any;
  catalog?: readonly any[];
  s3Presets?: readonly any[];
  canWrite?: boolean;
  [key: string]: any;
}): ReactElement;
