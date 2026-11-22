function toBase64Url(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) {
    bytes[i] = bin.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

export function cursorEncode(row) {
  if (!row || !row.id) return null;
  const payload = {
    id: row.id,
    createdAt: row.created_at || null,
  };
  return toBase64Url(JSON.stringify(payload));
}

export function cursorDecode(cursor) {
  if (!cursor || typeof cursor !== 'string') return null;
  try {
    const parsed = JSON.parse(fromBase64Url(cursor));
    if (!parsed || !parsed.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function toSearchParams(input = {}) {
  if (input instanceof URLSearchParams) return input;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input || {})) {
    if (Array.isArray(value)) {
      value.forEach((item) => params.append(key, String(item)));
    } else if (value !== undefined && value !== null) {
      params.set(key, String(value));
    }
  }
  return params;
}

export function getPaginationArgs(searchParams, defaultLimit = 25) {
  const params = toSearchParams(searchParams);
  const limit = Math.min(100, Math.max(1, Number(params.get('limit') || defaultLimit)));
  const cursor = cursorDecode(params.get('cursor'));
  return { limit, cursor };
}
