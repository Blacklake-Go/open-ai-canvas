'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Button, DataTable, StatusBadge } from '@/components/admin/AdminUi';

const field = 'w-full rounded-xl border border-line bg-well px-3 py-2 text-sm text-ink outline-none focus:border-brand';

export default function ReconciliationClient({ rows, canPoll, canRelease }) {
  const router = useRouter();
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [reference, setReference] = useState('');
  const [reviewed, setReviewed] = useState(false);
  const [expiries, setExpiries] = useState({});

  const run = async (row, action) => {
    setBusy(true); setNotice('');
    try {
      const originalExpiries = Object.fromEntries(Object.entries(expiries).map(([bucket, value]) =>
        [bucket, { kind: value.kind, ...(value.kind === 'expires' ? { expiresAt: new Date(value.expiresAt).toISOString() } : {}) }]));
      const response = await fetch('/api/admin/generations/reconciliation', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ action, creationId: row.creation_id, reservationId: row.reservation_id, originalExpiries,
          evidence: { kind: row.provider_request_id ? 'provider_failed' : 'not_submitted', reference,
            providerRequestId: row.provider_request_id, observedAt: new Date().toISOString() } }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || body.error || '核对未完成');
      setNotice(action === 'poll' ? '已读取上游状态；未确认终态的任务继续保留冻结额度。'
        : `已按凭据核对：返还 ${body.data.releasedAmount} 积分，原有效期已结束 ${body.data.expiredAmount} 积分。`);
      setSelected(null); router.refresh();
    } catch (error) { setNotice(error.message); }
    finally { setBusy(false); }
  };

  const columns = [
    { key: 'id', label: '任务 / 预扣', render: row => <span className="font-mono text-xs text-ink">{row.id}</span> },
    { key: 'user_id', label: '用户' },
    { key: 'model_id', label: '模型' },
    { key: 'reserved_amount', label: '冻结积分' },
    { key: 'reason', label: '待核对原因', render: row => <div className="space-y-1 text-xs text-ink-muted">
      <p>{row.reason === 'UNLINKED_RESERVATION' ? '独立预扣未绑定任务' : row.reason === 'TERMINAL_TASK_RESERVED_FUNDS' ? '任务已结束，资金仍冻结' : '上游结果未确认'}</p>
      {row.needs_expiry_evidence && <StatusBadge tone="warn">缺少原有效期凭据</StatusBadge>}
    </div> },
    { key: 'actions', label: '操作', render: row => <div className="flex flex-wrap gap-2">
      {canPoll && row.provider_request_id && <Button disabled={busy} onClick={() => run(row, 'poll')}>读取上游状态</Button>}
      {canRelease && <Button disabled={busy} onClick={() => { setSelected(row); setReference(''); setExpiries({}); setReviewed(false); }}>凭据核对</Button>}
    </div> },
  ];
  return <div className="space-y-4">
    {notice && <p role="status" className="text-sm text-ink-muted">{notice}</p>}
    <DataTable rows={rows} columns={columns} empty="当前没有待核对的任务或冻结款" />
    {selected && <Card><form className="space-y-4" onSubmit={event => { event.preventDefault(); if (reviewed) run(selected, 'confirm_failure'); }}>
      <p className="text-sm font-semibold text-ink">{selected.id}</p>
      <p className="text-sm text-ink-muted">{selected.provider_request_id ? `核实供应商任务 ${selected.provider_request_id} 已失败。` : '核实请求未被供应商接收。'} 仅凭超时不能确认失败。</p>
      <label className="block space-y-2 text-sm text-ink-muted"><span>供应商工单、账单或未提交证明编号</span>
        <input required className={field} value={reference} onChange={event => setReference(event.target.value)} placeholder="填写凭据编号，勿填密钥或带访问参数的网址" />
      </label>
      {selected.needs_expiry_evidence && ['daily', 'subscription'].filter(bucket => Number(selected.bucket_split_json?.[bucket]) > 0).map(bucket =>
        <div key={bucket} className="space-y-2 text-sm text-ink-muted"><label>{bucket === 'daily' ? '原每日额度' : '原订阅额度'}有效期
          <select required className={field} value={expiries[bucket]?.kind || ''} onChange={event => setExpiries(current => ({ ...current, [bucket]: { ...current[bucket], kind: event.target.value } }))}>
            <option value="">按原凭据选择</option><option value="expires">有明确到期时间</option><option value="permanent">原凭据证明永久有效</option>
          </select></label>
          {expiries[bucket]?.kind === 'expires' && <input aria-label="原到期时间" required type="datetime-local" className={field} value={expiries[bucket]?.expiresAt || ''}
            onChange={event => setExpiries(current => ({ ...current, [bucket]: { ...current[bucket], expiresAt: event.target.value } }))} />}
        </div>)}
      <label className="flex items-start gap-2 text-sm text-ink-muted"><input type="checkbox" required checked={reviewed} onChange={event => setReviewed(event.target.checked)} />我已核对上述凭据，确认失败或未提交事实及原资金有效期。</label>
      <div className="flex gap-2"><Button type="submit" disabled={busy || !reviewed}>按凭据处理资金</Button><Button type="button" disabled={busy} onClick={() => setSelected(null)}>关闭</Button></div>
    </form></Card>}
  </div>;
}
