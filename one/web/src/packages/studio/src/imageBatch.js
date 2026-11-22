const PREFIX = 'supdance:image-batch:v1:';

function makeId() {
  return globalThis.crypto?.randomUUID?.() || `batch-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// The descriptor is hashed: prompt and reference URLs are never storage keys.
async function storageKey(descriptor) {
  if (!globalThis.crypto?.subtle || typeof TextEncoder === 'undefined') return null;
  const bytes = new TextEncoder().encode(JSON.stringify(descriptor));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return PREFIX + [...new Uint8Array(digest)].map((n) => n.toString(16).padStart(2, '0')).join('');
}

function isTerminal(error) {
  if (error?.pending || (error?.requestId && !error?.generationResult)) return false;
  return Boolean(error?.generationResult) || (error?.status >= 400 && error.status < 500 && error.status !== 408 && error.status !== 409 && error.status !== 429);
}

/** Resume uncertain members with their original keys; each new batch gets a new ID. */
export async function runImageBatch({ descriptor, count, generate, recover, prepare, storage }) {
  if (!Number.isInteger(count) || count < 1) throw new Error('Invalid batch size');
  if (storage === undefined) {
    try { storage = globalThis.window?.sessionStorage || null; } catch { storage = null; }
  }
  const accountGate = globalThis.window?.__SUPDANCE_REQUIRE_ACCOUNT__;
  let accountId = null;
  if (accountGate) {
    const user = await accountGate();
    if (!user) throw new Error('请先登录后再生成');
    accountId = user.id || user.userId || null;
  }
  // A hosted session must be scoped to an authenticated user; never replay a
  // prior account's batch when an account identity is unavailable.
  if (globalThis.window && !accountId) storage = null;
  const key = storage ? await storageKey({ accountId, descriptor }) : null;
  let group;
  try { group = key ? JSON.parse(storage.getItem(key) || 'null') : null; } catch { group = null; }
  const resumed=Boolean(group && typeof group.id==='string' && Array.isArray(group.members) && group.members.length===count);
  if (!group || typeof group.id !== 'string' || !Array.isArray(group.members) || group.members.length !== count) {
    group = { id: makeId(), members: Array.from({ length: count }, () => null) };
  }
  const save = () => {
    if (!key) return;
    try { storage.setItem(key, JSON.stringify(group)); } catch { /* resume unavailable */ }
  };
  save();
  if (prepare && !group.context) {
    group.context = await prepare();
    save();
  }

  const settled = await Promise.allSettled(group.members.map(async (member, index) => {
    if (member?.state === 'success') return recover(member.id);
    if (member?.state === 'failed') throw Object.assign(new Error(member.message), { code: member.code });
    try {
      const result = await generate(index, `${group.id}:${index}`, group.context, {resumeExistingTask:resumed});
      if (!result?.id || !result?.url) throw new Error('生成结果缺少任务编号或图片');
      if (group.members.some((other, otherIndex) => otherIndex !== index && other?.state === 'success' && other.id === result.id)) {
        throw Object.assign(new Error('批次成员返回了重复的任务，请检查历史记录。'), { status: 422, code: 'DUPLICATE_BATCH_TASK' });
      }
      group.members[index] = { state: 'success', id: result.id };
      save();
      return result;
    } catch (error) {
      if (isTerminal(error)) {
        group.members[index] = { state: 'failed', code: error.code || 'GENERATION_FAILED', message: '该批次成员生成失败，请重新生成。' };
        save();
      }
      throw error;
    }
  }));
  if (group.members.every((member, index) => member?.state === 'failed'
    || (member?.state === 'success' && settled[index].status === 'fulfilled'))) {
    try { if (key) storage.removeItem(key); } catch { /* best effort */ }
  }
  return { batchId: group.id, settled };
}

export async function recoverImageBatchResult(id, fetchImpl = globalThis.fetch) {
  const response = await fetchImpl(`/api/generations?id=${encodeURIComponent(id)}`, { credentials: 'same-origin', cache: 'no-store' });
  if (!response.ok) throw new Error('无法恢复之前已完成的任务，请检查登录状态和历史记录。');
  const data = await response.json();
  const creation = data.creation;
  if (!['succeeded', 'completed', 'success'].includes(String(creation?.status || '').toLowerCase())) {
    throw new Error('之前的任务状态尚未确认，请检查历史记录。');
  }
  const assetId = creation.asset_id || creation.assetId;
  const url = assetId ? `/api/assets/${encodeURIComponent(assetId)}/download?inline=1` : creation.result_url;
  if (!url) throw new Error('之前的任务没有可读取的图片。');
  return { id, url };
}
