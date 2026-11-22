'use client';

import { useState } from 'react';
import EmailLogDrawer from './EmailLogDrawer';

export default function EmailLogDetailButton({ log }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-semibold text-brand hover:underline cursor-pointer inline-flex items-center gap-1"
      >
        查看详情
      </button>
      <EmailLogDrawer isOpen={open} onClose={() => setOpen(false)} log={log} />
    </>
  );
}
