const SUCCESS_STATUSES = new Set(['succeeded', 'completed', 'success']);
const FAILURE_STATUSES = new Set(['failed', 'error', 'cancelled', 'canceled']);

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function createIdempotencyKey() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const values = new Uint8Array(16);
  globalThis.crypto?.getRandomValues?.(values);
  const suffix = [...values].map((value) => value.toString(16).padStart(2, '0')).join('');
  return `studio-${Date.now()}-${suffix || Math.random().toString(36).slice(2)}`;
}

const GENERATION_INTENT_STORAGE_PREFIX = 'supdance:generation-intent:v1:';

function stableSerialize(value) {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') {
    const serialized = JSON.stringify(value);
    return serialized === undefined ? 'null' : serialized;
  }
  if (Array.isArray(value)) {
    return '[' + value.map((item) => stableSerialize(item)).join(',') + ']';
  }

  const keys = Object.keys(value)
    .filter((key) => value[key] !== undefined && typeof value[key] !== 'function')
    .sort();
  return '{' + keys.map((key) => JSON.stringify(key) + ':' + stableSerialize(value[key])).join(',') + '}';
}

function resolveIntentStorage(storageOverride) {
  if (storageOverride) return storageOverride;
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

async function buildIntentStorageKey({ studioId, modelId, prompt, parameters, ownerUserId }) {
  if (!globalThis.crypto?.subtle || typeof TextEncoder !== 'function') return null;
  const intent = stableSerialize({ studioId, modelId, prompt, parameters, ...(ownerUserId ? {ownerUserId} : {}) });
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(intent));
  const hex = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
  return GENERATION_INTENT_STORAGE_PREFIX + hex;
}

async function resolveGenerationIntent({
  idempotencyKey,
  idempotencyStorage,
  studioId,
  modelId,
  prompt,
  parameters,
  ownerUserId,
}) {
  if (idempotencyKey !== undefined && idempotencyKey !== null) {
    return { key: String(idempotencyKey), storage: null, storageKey: null };
  }

  const storage = resolveIntentStorage(idempotencyStorage);
  let storageKey = null;
  if (storage) {
    try {
      storageKey = await buildIntentStorageKey({ studioId, modelId, prompt, parameters, ownerUserId });
      if (storageKey) {
        const existing = storage.getItem(storageKey);
        if (existing && String(existing).trim().length >= 8 && String(existing).trim().length <= 200) {
          return { key: String(existing).trim(), storage, storageKey, resumed:true };
        }
      }
    } catch {
      storageKey = null;
    }
  }

  const key = createIdempotencyKey();
  if (storage && storageKey) {
    try {
      storage.setItem(storageKey, key);
    } catch {
      return { key, storage: null, storageKey: null };
    }
  }
  return { key, storage, storageKey };
}

function clearGenerationIntent(intent) {
  if (!intent?.storage || !intent.storageKey) return;
  try {
    if (intent.storage.getItem(intent.storageKey) === intent.key) {
      intent.storage.removeItem(intent.storageKey);
    }
  } catch {}
}

function generationId(payload) {
  return payload?.creation_id || payload?.creation?.id || payload?.id || payload?.request_id || null;
}

async function quoteIdempotencyKey(generationKey) {
  const candidate = `${generationKey}:quote`;
  if (candidate.length <= 200) return candidate;

  if (!globalThis.crypto?.subtle || typeof TextEncoder !== 'function') {
    throw Object.assign(new Error('The generation idempotency key is too long to quote safely.'), {
      code: 'IDEMPOTENCY_KEY_INVALID',
    });
  }

  const bytes = new TextEncoder().encode(generationKey);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  const suffix = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
  return `quote_${suffix}`;
}

async function readJson(response) {
  return response.json().catch(() => ({}));
}

function requestError(payload, response, fallback) {
  const error = new Error(payload?.error || payload?.message || fallback);
  error.status = response.status;
  error.code = payload?.code || `HTTP_${response.status}`;
  const id = generationId(payload);
  if (id) error.requestId = id;
  return error;
}

function reportPhase(onPhase, phase, requestId) {
  onPhase?.(phase, requestId);
}

async function requestPlatformQuote({ modelId, parameters, capabilityVersion, idempotencyKey, fetchImpl, onAuthRequired, ownerUserId, signal }) {
  const response = await fetchImpl('/api/generation/quote', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': await quoteIdempotencyKey(idempotencyKey),
      ...(ownerUserId ? { 'X-ONE-Expected-User': String(ownerUserId) } : {}),
    },
    signal,
    body: JSON.stringify({ modelId, parameters, ...(capabilityVersion ? {capabilityVersion} : {}) }),
  });
  const payload = await readJson(response);

  if (!response.ok) {
    if (response.status === 401) onAuthRequired?.(response.status, payload?.error || '');
    throw requestError(payload, response, 'Could not get a valid server generation quote.');
  }

  const quoteId = payload?.quoteId || payload?.quote_id || null;
  if (!quoteId) {
    throw Object.assign(new Error('The server quote response did not include a quote ID.'), {
      code: 'QUOTE_REQUIRED',
    });
  }

  const credits = payload.creditsQuoted ?? payload.credits ?? null;
  if (typeof window !== 'undefined' && credits != null) {
    window.dispatchEvent(new CustomEvent('supdance:quote', {
      detail: {
        modelId,
        credits,
        quoteId,
        expiresAt: payload.expiresAt || payload.expires_at || null,
        pricingBreakdown: payload.pricingBreakdown || payload.pricing_breakdown || null,
      },
    }));
  }

  return { id: quoteId, credits };
}

function failedGeneration(creation, creationId) {
  const detail = creation.error_reason || creation.error_message || '生成失败';
  const error = new Error(`Generation failed: ${detail}`);
  error.code = creation.error_code || 'GENERATION_FAILED';
  error.requestId = creationId;
  error.generationResult = {
    id: creationId,
    request_id: creationId,
    status: creation.status,
    error: { message: detail, code: error.code },
    cost: {
      amount_credits: Number(creation.credit_cost || 0),
      refund_status: 'unverified',
    },
  };
  return error;
}

export function completedGeneration(creation, creationId) {
  const assetId = creation.asset_id || creation.assetId;
  const url = assetId ? `/api/assets/${encodeURIComponent(assetId)}/download?inline=1`
    : (creation.result_url || creation.resultUrl || null);
  let parsedOutputs = [];
  if (Array.isArray(creation.outputs) && creation.outputs.length > 0) {
    parsedOutputs = creation.outputs;
  } else if (creation.metadata_json) {
    const meta = typeof creation.metadata_json === 'string'
      ? (() => { try { return JSON.parse(creation.metadata_json); } catch { return {}; } })()
      : creation.metadata_json;
    if (Array.isArray(meta?.outputs) && meta.outputs.length > 0) parsedOutputs = meta.outputs;
    else if (Array.isArray(meta?.images) && meta.images.length > 0) parsedOutputs = meta.images;
  }
  if (!parsedOutputs.length && creation.result_text) {
    try {
      const parsed = JSON.parse(creation.result_text);
      if (Array.isArray(parsed)) parsedOutputs = parsed;
      else if (Array.isArray(parsed?.outputs)) parsedOutputs = parsed.outputs;
      else if (Array.isArray(parsed?.images)) parsedOutputs = parsed.images;
    } catch {}
  }
  const outputs = parsedOutputs.length > 0 ? parsedOutputs : (url ? [url] : []);
  const primaryUrl = outputs[0] || url;
  return {
    id: creationId,
    request_id: creationId,
    status: 'completed',
    url: primaryUrl,
    result_url: primaryUrl,
    outputs,
    images: outputs,
    result_text: creation.result_text || creation.resultText || null,
    output: creation.result_text || creation.resultText || null,
    cost: {
      refunded: false,
      amount_credits: Number(creation.credit_cost || 0),
    },
  };
}

/**
 * Submit a hosted Studio generation through the platform-owned billing API.
 * Provider credentials are deliberately not accepted by this client boundary.
 */
export async function submitPlatformGeneration({
  modelId,
  capabilityVersion,
  ownerUserId,
  resumeExistingTask = false,
  returnOnQueue = false,
  studioId = 'studio',
  prompt = '',
  parameters = {},
  label,
  idempotencyKey,
  idempotencyStorage,
  onRequestId,
  onPhase,
  maxAttempts = 900,
  intervalMs = 2_000,
  fetchImpl = globalThis.fetch,
  waitImpl = wait,
  onAuthRequired,
  confirmQuote,
  signal,
} = {}) {
  if (!modelId) throw new Error('A model ID is required for platform generation.');
  if (typeof fetchImpl !== 'function') throw new Error('Platform generation transport is unavailable.');

  const generationIntent = await resolveGenerationIntent({
    idempotencyKey,
    idempotencyStorage,
    studioId,
    modelId,
    prompt,
    parameters,
    ownerUserId,
  });
  const normalizedIdempotencyKey = String(generationIntent.key || '').trim();
  if (normalizedIdempotencyKey.length < 8 || normalizedIdempotencyKey.length > 200) {
    throw Object.assign(new Error('A valid generation idempotency key is required.'), {
      code: 'IDEMPOTENCY_REQUIRED',
    });
  }

  // Quote the final model settings before creating a billable GenerationJob.
  // The same caller key makes retries reuse the quote and job identity.
  let submitData;
  let confirmedAbsent=false;
  if (resumeExistingTask || generationIntent.resumed) {
    const response=await fetchImpl(`/api/generations?idempotencyKey=${encodeURIComponent(normalizedIdempotencyKey)}`,{
      method:'GET', credentials:'same-origin', cache:'no-store', signal,
      headers:{ Accept:'application/json', ...(ownerUserId ? { 'X-ONE-Expected-User': String(ownerUserId) } : {}) },
    });
    const trace=await readJson(response);
    if (response.ok && trace?.creation?.id) {
      if (trace.creation.model && trace.creation.model!==modelId) throw Object.assign(new Error('恢复任务与所选模型不一致，请检查历史记录'),{code:'GENERATION_IDEMPOTENCY_CONFLICT',status:409,pending:true});
      submitData=trace;
    } else if (response.status===404 && trace?.code==='GENERATION_NOT_FOUND') confirmedAbsent=true;
    else {
      if(response.status===401)onAuthRequired?.(response.status,trace?.error || '');
      throw Object.assign(requestError(trace,response,'原任务状态暂时无法确认，请稍后恢复'),{pending:true});
    }
  }
  const recovered=Boolean(submitData);
  if (!submitData) {
    const quote = await requestPlatformQuote({
      modelId,
      capabilityVersion,
      parameters,
      // A confirmed missing job may need a fresh quote after the old quote expired.
      // Its member identity stays unchanged, so concurrent delayed submits deduplicate.
      idempotencyKey: confirmedAbsent ? `${normalizedIdempotencyKey}:${createIdempotencyKey()}` : normalizedIdempotencyKey,
      fetchImpl,
      onAuthRequired,
      ownerUserId,
      signal,
    });
    if (confirmQuote && !await confirmQuote(quote)) {
      throw Object.assign(new Error('Generation quote declined.'), { code: 'GENERATION_QUOTE_DECLINED' });
    }

    const submitResponse = await fetchImpl('/api/generations', {
      method: 'POST',
      credentials: 'same-origin',
      signal,
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': normalizedIdempotencyKey,
        ...(ownerUserId ? { 'X-ONE-Expected-User': String(ownerUserId) } : {}),
      },
      body: JSON.stringify({ modelId, studioId, prompt, parameters, label, quoteId: quote.id, ...(capabilityVersion ? {capabilityVersion} : {}) }),
    });
    submitData = await readJson(submitResponse);

    if (!submitResponse.ok) {
      const error = requestError(submitData, submitResponse, 'Could not create the generation task.');
      const submittedStatus = String(submitData?.creation?.status || submitData?.status || '').toLowerCase();
      if (FAILURE_STATUSES.has(submittedStatus)) clearGenerationIntent(generationIntent);
      if (submitResponse.status === 401) onAuthRequired?.(submitResponse.status, submitData?.error || '');
      throw error;
    }
  }

  const creationId = generationId(submitData);
  if (!creationId) {
    throw Object.assign(new Error('The platform accepted the request without returning a task ID.'), {
      code: 'GENERATION_RESPONSE_INVALID',
    });
  }
  onRequestId?.(creationId);
  reportPhase(onPhase, recovered ? 'recovered' : 'reserved', creationId);

  const initialCreation = submitData.creation || submitData.task || submitData;
  if (returnOnQueue) return { ...initialCreation, id: creationId };
  const initialStatus = String(initialCreation?.status || '').toLowerCase();
  if (SUCCESS_STATUSES.has(initialStatus)) {
    clearGenerationIntent(generationIntent);
    reportPhase(onPhase, 'completed', creationId);
    return completedGeneration(initialCreation, creationId);
  }
  if (FAILURE_STATUSES.has(initialStatus)) {
    clearGenerationIntent(generationIntent);
    reportPhase(onPhase,'failed',creationId);
    throw failedGeneration(initialCreation,creationId);
  }

  return pollPlatformGeneration({ creationId, maxAttempts, intervalMs, fetchImpl, waitImpl, onAuthRequired, onPhase, ownerUserId, signal,
    onTerminal: () => clearGenerationIntent(generationIntent) });
}

/** Resume a known owner-scoped job using reads only; this never quotes or submits. */
export async function pollPlatformGeneration({ creationId, maxAttempts = 900, intervalMs = 2_000,
  fetchImpl = globalThis.fetch, waitImpl = wait, onAuthRequired, onPhase, onTerminal, signal, ownerUserId } = {}) {
  if (!creationId) throw new Error('An existing generation ID is required.');
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await waitImpl(intervalMs);
    if (signal?.aborted) throw Object.assign(new Error('已停止等待原任务'), { name: 'AbortError', requestId: creationId, pending: true });
    let pollResponse;
    try {
      pollResponse = await fetchImpl(`/api/generations?id=${encodeURIComponent(creationId)}`, {
        method: 'GET', credentials: 'same-origin', cache: 'no-store', signal,
        headers: { Accept: 'application/json', ...(ownerUserId ? { 'X-ONE-Expected-User': String(ownerUserId) } : {}) },
      });
    } catch (error) { throw Object.assign(error, { requestId: creationId, pending: true }); }
    const trace = await readJson(pollResponse);
    if (!pollResponse.ok) {
      const error = requestError(trace, pollResponse, 'Could not read the generation task.');
      if (pollResponse.status === 401) onAuthRequired?.(pollResponse.status, trace?.error || '');
      if (pollResponse.status >= 500 && attempt + 1 < maxAttempts) continue;
      throw Object.assign(error,{requestId:creationId,pending:true});
    }

    const creation = trace.creation || trace.task || trace;
    const status = String(creation.status || trace.status || '').toLowerCase();
    if (SUCCESS_STATUSES.has(status)) {
      onTerminal?.();
      reportPhase(onPhase, 'completed', creationId);
      return completedGeneration(creation, creationId);
    }
    if (FAILURE_STATUSES.has(status)) {
      onTerminal?.();
      reportPhase(onPhase, 'failed', creationId);
      throw failedGeneration(creation, creationId);
    }
    if ((trace.events || []).some(event=>['TASK_RECONCILIATION_REQUIRED','PROVIDER_POLL_PAUSED'].includes(event.event_type))) {
      throw Object.assign(new Error('任务结果待核对，预留积分仍保留，请稍后在原任务中查看'),{code:'GENERATION_RECONCILIATION_REQUIRED',requestId:creationId,status:409,pending:true});
    }
  }

  const error = new Error(`Generation timed out after polling. Request ID: ${creationId}`);
  error.code = 'GENERATION_TIMEOUT';
  error.requestId = creationId;
  error.pending = true;
  throw error;
}
