const SENSITIVE_KEY_REGEX = /password|token|secret|api.?key|authorization|cookie|private.?key|ciphertext/i;

export function redact(value) {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(redact);

  const clean = {};
  for (const [k, v] of Object.entries(value)) {
    if (SENSITIVE_KEY_REGEX.test(k)) {
      continue;
    }
    clean[k] = redact(v);
  }
  return clean;
}

export function maskEmail(email) {
  if (!email || typeof email !== 'string') return '—';
  const parts = email.split('@');
  if (parts.length !== 2) return email;
  const name = parts[0];
  const domain = parts[1];
  if (name.length <= 2) {
    return `${name[0]}*@${domain}`;
  }
  return `${name[0]}${'*'.repeat(Math.min(name.length - 2, 4))}${name[name.length - 1]}@${domain}`;
}

export function shortId(id, prefixLen = 8, suffixLen = 6) {
  if (!id || typeof id !== 'string') return '—';
  if (id.length <= prefixLen + suffixLen + 2) return id;
  return `${id.slice(0, prefixLen)}...${id.slice(-suffixLen)}`;
}

export function maskSecretKey(value) {
  if (!value || typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.length <= 4) return '••••' + trimmed;
  if (trimmed.length <= 6) return '••••' + trimmed.slice(-3);
  if (trimmed.length <= 10) return '••••' + trimmed.slice(-4);
  return '••••••••' + trimmed.slice(-4);
}
