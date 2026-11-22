'use client';

import { useState } from 'react';
import { useHasPermission } from './AdminPermissions';

function createKey() {
  return globalThis.crypto?.randomUUID?.() || `export-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function ExportButton({ type, label, requiredPermission }) {
  const canExport = useHasPermission(requiredPermission);
  const [state, setState] = useState('idle');
  const [message, setMessage] = useState('');

  async function startExport() {
    setState('working');
    setMessage('正在准备导出…');
    try {
      const response = await fetch('/api/admin/exports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': createKey() },
        body: JSON.stringify({ type }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message || '导出请求失败');

      const jobId = payload.data?.jobId;
      for (let attempt = 0; attempt < 30; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const statusResponse = await fetch(`/api/admin/exports/${jobId}`, { cache: 'no-store' });
        const statusPayload = await statusResponse.json();
        if (!statusResponse.ok) throw new Error(statusPayload?.error?.message || '导出状态查询失败');
        const job = statusPayload.data;
        if (job.status === 'succeeded') {
          window.location.assign(job.downloadUrl);
          setState('idle');
          setMessage('导出已开始下载');
          return;
        }
        if (job.status === 'failed' || job.status === 'expired') throw new Error(job.errorMessage || '导出任务失败');
        setMessage(`正在生成文件（${job.status}）…`);
      }
      throw new Error('导出任务等待超时，请稍后在导出记录中重试');
    } catch (error) {
      setState('idle');
      setMessage(error.message || '导出失败');
    }
  }

  if (!canExport) return null;

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={startExport}
        disabled={state === 'working'}
        className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/70 hover:bg-white/10 transition disabled:cursor-wait disabled:opacity-50"
      >
        {state === 'working' ? '⏳ 处理中…' : `⬇ ${label}`}
      </button>
      {message && <span className="max-w-[220px] text-[11px] text-white/40">{message}</span>}
    </div>
  );
}
