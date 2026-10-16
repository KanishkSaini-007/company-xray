// Rebuilds data/companies.json (SEC EDGAR + curated) and data/prices.json (Yahoo Finance).
// Run: node scripts/build_data.mjs   (Node 18+; run daily by .github/workflows/refresh.yml)
import fs from 'node:fs';
import { segments } from './edgar_segments.mjs';
import { US, YAHOO, META } from './config.mjs';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const out = [];
for (const [t, cfg] of Object.entries(US)) {
  try {
    const r = await segments(t);
    const ms = r.axes[cfg.axis] || {};
    const rows = [];
    for (const key of cfg.members) {
      const full = Object.keys(ms).find(k => k.split(':').pop().replace(/Member$/, '') === key);
      if (!full) continue;
      const yrs = Object.keys(ms[full]).sort();
      const cur = ms[full][yrs.at(-1)], prev = yrs.length > 1 ? ms[full][yrs.at(-2)] : null;
      rows.push({ name: cfg.labels?.[key] || key.replace(/([a-z])([A-Z])/g, '$1 $2'), cur, prev });
    }
    if (rows.length < 2) throw new Error('only ' + rows.length + ' segments matched');
    const [m, ex, cur] = [META[t][0], META[t][1], META[t][2]];
    out.push({ id: t, name: cfg.name, market: m, exchange: ex, currency: cur, unit: 'USD million', period: `Fiscal year ended ${r.report}, revenue by ${cfg.axis.includes('Segments') ? 'reportable segment' : 'product / service line'}`, periodType: 'year',
      source: `${r.name} Form 10-K (SEC EDGAR)`, sourceUrl: r.url, filed: r.filed, note: 'Pulled automatically from the 10-K inline XBRL tags on SEC EDGAR. Segment lines are the ones the company tags itself; sub-lines that would double count were left out.', segments: rows });
    console.log('ok', t, rows.length);
  } catch (e) { console.log('FAIL', t, e.message); }
  await sleep(400);
}
const cur = JSON.parse(fs.readFileSync(new URL('../data/curated.json', import.meta.url)));
const all = [...out, ...cur];
for (const c of all) for (const s of c.segments) { if (s.prev == null && s.growth != null) s.prev = Math.round(s.cur / (1 + s.growth / 100)); if (s.growth == null && s.prev) s.growth = +(((s.cur / s.prev) - 1) * 100).toFixed(1); }
fs.writeFileSync(new URL('../data/companies.json', import.meta.url), JSON.stringify({ generated: new Date().toISOString(), companies: all }, null, 1));

// prices
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const prices = { generated: new Date().toISOString(), source: 'Yahoo Finance chart API (query2.finance.yahoo.com)', series: {} };
for (const [id, y] of Object.entries(YAHOO)) {
  try {
    const r = await fetch(`https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(y)}?range=1y&interval=1d`, { headers: { 'User-Agent': UA } });
    if (!r.ok) throw new Error(r.status);
    const j = (await r.json()).chart.result[0], m = j.meta, q = j.indicators.quote[0];
    const pts = j.timestamp.map((t, i) => [t, q.close[i]]).filter(p => p[1] != null).map(p => [p[0], +p[1].toFixed(2)]);
    prices.series[id] = { symbol: y, currency: m.currency, price: m.regularMarketPrice, time: m.regularMarketTime, prevClose: m.chartPreviousClose, hi52: m.fiftyTwoWeekHigh, lo52: m.fiftyTwoWeekLow, exchange: m.fullExchangeName, pts };
    console.log('px', id, m.regularMarketPrice);
  } catch (e) { console.log('PXFAIL', id, e.message); }
  await sleep(500);
}
if (Object.keys(prices.series).length) fs.writeFileSync(new URL('../data/prices.json', import.meta.url), JSON.stringify(prices));
