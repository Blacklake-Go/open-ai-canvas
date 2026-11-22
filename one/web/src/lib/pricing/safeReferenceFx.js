export const SAFE_FX_URL = 'https://www.safe.gov.cn/AppStructured/hlw/RMBQuery.do';
const DAY = 86_400_000;

/** SAFE publishes CNY per 100 USD; reject changed layout, stale or implausible data. */
export function parseSafeUsdCny(html, now = Date.now()) {
  if (typeof html !== 'string' || html.length > 2_000_000) throw new Error('FX_SOURCE_INVALID');
  const table = html.match(/<table\b[^>]*\bid=["']InfoTable["'][^>]*>([\s\S]*?)<\/table>/i)?.[1];
  if (!table) throw new Error('FX_SOURCE_LAYOUT_CHANGED');
  const clean = (s) => s.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').trim();
  const headers = [...table.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map((m) => clean(m[1]));
  if (headers[0] !== '日期' || headers[1] !== '美元') throw new Error('FX_SOURCE_LAYOUT_CHANGED');
  const rows = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
  for (const row of rows) {
    const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => clean(m[1]));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cells[0] || '')) continue;
    const sourceDay = Date.parse(`${cells[0]}T00:00:00+08:00`);
    const currentDay = Math.floor((now + 8 * 3600_000) / DAY) * DAY - 8 * 3600_000;
    const age = (currentDay - sourceDay) / DAY;
    const rate = Number(cells[1]) / 100;
    if (!Number.isFinite(sourceDay) || new Date(sourceDay + 8 * 3600_000).toISOString().slice(0, 10) !== cells[0]
      || age < 0 || age > 4 || !Number.isFinite(rate) || rate < 4 || rate > 12) {
      throw new Error('FX_SOURCE_STALE_OR_INVALID');
    }
    return { sourceDate: cells[0], rate, expiresAt: new Date(sourceDay + 5 * DAY).toISOString() };
  }
  throw new Error('FX_SOURCE_MISSING');
}
