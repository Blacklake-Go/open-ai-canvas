import type { ReactElement } from 'react';

export default function AdminActionForm(props: {
  action: string;
  method?: string;
  fields?: Array<{
    name: string;
    label?: string;
    placeholder?: string;
    type?: string;
    required?: boolean;
    defaultValue?: string;
    options?: Array<{ value: string; label: string }>;
    [key: string]: any;
  }>;
  label?: string;
  submitLabel?: string;
  tone?: string;
  confirmMessage?: string;
  confirmText?: string;
  requiredPermission?: string;
  onSuccess?: (data?: any) => void;
  [key: string]: any;
}): ReactElement;
