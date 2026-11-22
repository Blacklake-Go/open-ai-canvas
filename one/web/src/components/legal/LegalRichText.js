import React from 'react';

/**
 * Inline markup for the legal dictionaries.
 *
 * `messages/<locale>/legal.json` holds plain strings, which is what keeps the
 * copy readable in the admin language workbench and checkable by the CI parity
 * gate. Three markers are enough to reproduce the markup these pages used to
 * hardcode:
 *
 *   {{brand}}     → the supdance wordmark span (font-jost)
 *   **…**         → <strong>
 *   `…`           → <code>, cyan when the content is an email address
 *
 * The email heuristic is deliberate: the original page styled exactly the
 * `privacy@supdance.com` / `support@supdance.com` codes with text-cyan-400 and
 * the scope codes plainly, so deriving the style from the content removes a
 * per-language styling decision the translator must never have to make.
 *
 * Only `matchAll` is used on the global pattern — `test()`/`exec()` on a `/g`
 * regex leaks `lastIndex` between calls, which is exactly the bug class that
 * made the plugin uninstaller silently skip files.
 */
const TOKEN_PATTERN = /\{\{brand\}\}|(?<strong>\*\*[^*]+\*\*)|(?<code>`[^`]+`)/g;
const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

export default function LegalRichText({ value }) {
  const text = String(value ?? '');
  if (!text) return null;

  const nodes = [];
  let cursor = 0;
  for (const match of text.matchAll(TOKEN_PATTERN)) {
    const token = match[0];
    const start = match.index;
    if (start > cursor) nodes.push(text.slice(cursor, start));

    if (token === '{{brand}}') {
      nodes.push(<span key={nodes.length} className="font-jost font-medium">supdance</span>);
    } else if (match.groups?.strong) {
      nodes.push(<strong key={nodes.length}>{token.slice(2, -2)}</strong>);
    } else {
      const inner = token.slice(1, -1);
      nodes.push(
        <code key={nodes.length} className={EMAIL_PATTERN.test(inner) ? 'text-cyan-400' : undefined}>
          {inner}
        </code>,
      );
    }
    cursor = start + token.length;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));

  return <>{nodes}</>;
}
