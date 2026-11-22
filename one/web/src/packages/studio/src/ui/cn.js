/**
 * Zero-dependency class joiner. Kept local to the package so `studio` never
 * imports from the host app. Behaviour-compatible with the app's `cn`.
 */
export function cn(...inputs) {
  const classes = [];
  for (const input of inputs) {
    if (!input) continue;
    if (typeof input === 'string' || typeof input === 'number') {
      classes.push(input);
    } else if (Array.isArray(input)) {
      const inner = cn(...input);
      if (inner) classes.push(inner);
    } else if (typeof input === 'object') {
      for (const key in input) if (input[key]) classes.push(key);
    }
  }
  return classes.join(' ');
}

export default cn;
