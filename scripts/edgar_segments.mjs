// Pulls product/segment revenue from a company's latest 10-K (inline XBRL) on SEC EDGAR.
// Usage: node scripts/edgar_segments.mjs MSFT
import fs from 'node:fs';
const UA = 'CompanyXRay learning project its.kanishk.saini@gmail.com';
const get = async (u, json) => { const r = await fetch(u, { headers: { 'User-Agent': UA } }); if (!r.ok) throw new Error(u + ' ' + r.status); return json ? r.json() : r.text(); };
const REV = /^(us-gaap:)(RevenueFromContractWithCustomerExcludingAssessedTax|Revenues|SalesRevenueNet|RevenueFromContractWithCustomerIncludingAssessedTax|SalesRevenueGoodsNet)$/;
const AXES = ['srt:ProductOrServiceAxis', 'us-gaap:StatementBusinessSegmentsAxis', 'us-gaap:ProductOrServiceAxis'];

export async function tickerToCik(t) {
  const m = await get('https://www.sec.gov/files/company_tickers.json', true);
  const row = Object.values(m).find(x => x.ticker === t.replace('.', '-') || x.ticker === t);
  return row ? String(row.cik_str).padStart(10, '0') : null;
}
function label(member) { return member.split(':').pop().replace(/Member$/, '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' '); }
export async function latest10K(cik) {
  const s = await get(`https://data.sec.gov/submissions/CIK${cik}.json`, true);
  const r = s.filings.recent;
  for (let i = 0; i < r.form.length; i++) if (r.form[i] === '10-K') return { name: s.name, acc: r.accessionNumber[i], filed: r.filingDate[i], doc: r.primaryDocument[i], report: r.reportDate[i] };
}
export async function segments(ticker) {
  const cik = await tickerToCik(ticker); if (!cik) throw new Error('no cik');
  const f = await latest10K(cik);
  const base = `https://www.sec.gov/Archives/edgar/data/${parseInt(cik)}/${f.acc.replace(/-/g, '')}/`;
  const html = await get(base + f.doc);
  const ctx = {};
  for (const m of html.matchAll(/<xbrli:context id="([^"]+)">([\s\S]*?)<\/xbrli:context>/g)) {
    const dims = [...m[2].matchAll(/<xbrldi:explicitMember dimension="([^"]+)">([^<]+)<\/xbrldi:explicitMember>/g)].map(d => [d[1], d[2]]);
    const st = m[2].match(/<xbrli:startDate>([^<]+)/), en = m[2].match(/<xbrli:endDate>([^<]+)/);
    if (st && en) ctx[m[1]] = { dims, start: st[1], end: en[1] };
  }
  const out = {};
  for (const m of html.matchAll(/<ix:nonFraction([^>]*)>([\s\S]*?)<\/ix:nonFraction>/g)) {
    const a = m[1]; const name = (a.match(/name="([^"]+)"/) || [])[1]; if (!REV.test(name)) continue;
    const c = ctx[(a.match(/contextRef="([^"]+)"/) || [])[1]]; if (!c || c.dims.length !== 1) continue;
    const [axis, member] = c.dims[0]; if (!AXES.includes(axis)) continue;
    const days = (new Date(c.end) - new Date(c.start)) / 864e5; if (days < 340 || days > 380) continue;
    const scale = +((a.match(/scale="(-?\d+)"/) || [])[1] || 0); const sign = /sign="-"/.test(a) ? -1 : 1;
    const v = sign * parseFloat(m[2].replace(/<[^>]+>/g, '').replace(/,/g, '')) * 10 ** scale / 1e6;
    if (!isFinite(v)) continue;
    ((out[axis] ??= {})[member] ??= {})[c.end.slice(0, 4) + '|' + c.end] = Math.round(v);
  }
  return { ticker, cik, ...f, url: base + f.doc, axes: out };
}
if ((process.argv[1]||'').endsWith('edgar_segments.mjs') && process.argv[2]) {
  const r = await segments(process.argv[2]);
  console.log(JSON.stringify(r, null, 1));
}
