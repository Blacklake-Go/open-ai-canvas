const COMPLETED_STATUSES = new Set(['succeeded', 'completed', 'success']);

function parseInputSummary(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {}
  }
  return {};
}

/** Convert owner-scoped server generation rows to the Vibe Motion gallery shape. */
export function mapServerVibeMotionHistory(creations) {
  if (!Array.isArray(creations)) return [];
  return creations.flatMap((creation) => {
    if (!creation || String(creation.studio_id || '').toLowerCase() !== 'vibemotion') return [];
    if (!COMPLETED_STATUSES.has(String(creation.status || '').toLowerCase())) return [];
    if (String(creation.storage_status || '').toLowerCase() !== 'ready') return [];
    if (typeof creation.result_url !== 'string' || !creation.result_url.trim()) return [];

    const summary = parseInputSummary(creation.input_summary_json);
    const parameters = summary.parameters && typeof summary.parameters === 'object'
      ? summary.parameters
      : {};
    return [{
      id: creation.id,
      requestId: creation.id,
      url: creation.result_url,
      prompt: String(summary.prompt || creation.label || ''),
      modelId: creation.model || summary.modelId || null,
      aspectRatio: parameters.aspect_ratio || parameters.aspectRatio || '',
      resolution: parameters.resolution || parameters.output_resolution || '',
      duration: parameters.duration ?? parameters.duration_seconds ?? null,
      mode: 'generate',
      timestamp: creation.created_at || creation.completed_at || null,
      canEdit: false,
    }];
  });
}

/** Fetch an owner-scoped creation and its current private Asset URL before use. */
export async function fetchVibeMotionResultUrl(generationId, fetcher = globalThis.fetch) {
  if (typeof generationId !== 'string' || !generationId.trim()) {
    throw new Error('Missing generation ID');
  }
  if (typeof fetcher !== 'function') throw new Error('Fetch is unavailable');

  const response = await fetcher(`/api/generations?id=${encodeURIComponent(generationId)}`, {
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`Generation result request failed (${response.status})`);

  const payload = await response.json();
  const creation = payload?.creation || payload?.trace?.creation;
  if (!creation || !COMPLETED_STATUSES.has(String(creation.status || '').toLowerCase())) {
    throw new Error('Generation has no completed private result');
  }
  if (String(creation.storage_status || '').toLowerCase() !== 'ready') {
    throw new Error('Generation result is not stored as a private Asset');
  }
  if (typeof creation.result_url !== 'string' || !creation.result_url.trim()) {
    throw new Error('Private generation result is unavailable');
  }
  return creation.result_url;
}
