// Scopes a studio's localStorage persistence key to the calling identity
// (white-label session token or BYOK API key). Without this, every identity
// sharing one browser (different white-label end users, or BYOK vs white-label
// mode) read/wrote the same fixed key — history and draft state leaked between
// unrelated accounts on a shared device.
export function scopedPersistKey(baseKey, apiKey) {
  if (!apiKey) return baseKey;
  // Short, stable hash — avoids putting a raw session token/API key verbatim
  // into a localStorage key name.
  let hash = 0;
  for (let i = 0; i < apiKey.length; i++) {
    hash = (hash * 31 + apiKey.charCodeAt(i)) | 0;
  }
  return `${baseKey}:${(hash >>> 0).toString(36)}`;
}

// One-time best-effort carryover from the old shared (unscoped) key into the
// current identity's scoped key, then clears the old key so the next different
// identity on this browser doesn't inherit (or re-leak) it.
export function migrateLegacyPersistKey(baseKey, scopedKey) {
  if (scopedKey === baseKey) return;
  try {
    if (localStorage.getItem(scopedKey)) return; // already migrated
    const legacy = localStorage.getItem(baseKey);
    if (legacy) {
      localStorage.setItem(scopedKey, legacy);
      localStorage.removeItem(baseKey);
    }
  } catch {
    // localStorage unavailable (SSR/private mode) — nothing to migrate
  }
}
