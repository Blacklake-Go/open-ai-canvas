'use client';

/**
 * Universal popup opening utility for OAuth flows.
 * - Uses a unique window name with 'oauth_' prefix to prevent COOP / window recycling freezes
 *   while ensuring window.name.includes('oauth') evaluates to true for callback detection.
 * - Synchronously detects popup blocker (blocked popup returns null or closed) and
 *   immediately falls back to window.location.assign(url).
 * - Focuses popup if successfully opened.
 */
export function openOAuthPopup(url) {
  if (typeof window === 'undefined') return null;

  const isMobile =
    typeof navigator !== 'undefined' &&
    (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      window.innerWidth < 768);

  if (isMobile) {
    window.location.assign(url);
    return null;
  }

  const popupName = `oauth_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  let popup = null;
  try {
    popup = window.open(url, popupName, 'popup=yes,width=580,height=720,scrollbars=yes,resizable=yes');
  } catch {
    window.location.assign(url);
    return null;
  }

  try {
    if (!popup || popup.closed || typeof popup.closed === 'undefined') {
      window.location.assign(url);
      return null;
    }
    popup.focus();
  } catch {
    window.location.assign(url);
    return null;
  }

  return popup;
}
