'use strict';
// Company X-Ray. Plain JS, no libraries. Data: data/companies.json (SEC EDGAR + curated filings),
// data/prices.json (Yahoo snapshot refreshed by GitHub Actions). Live prices are attempted in the browser.
const $ = s => document.querySelector(s);
const state = { companies: [], prices: {}, snapshot: null, id: null, market: ['All', 'US', 'India', 'Global'].includes(localStorage.getItem('xray_market')) ? localStorage.getItem('xray_market') : 'All', sort: ['growth', 'rev'].includes(localStorage.getItem('xray_sort')) ? localStorage.getItem('xray_sort') : 'growth', range: [21, 126, 252].includes(+localStorage.getItem('xray_range')) ? +localStorage.getItem('xray_range') : 252, live: {}, q: '' };
const YAHOO = { AAPL: 'AAPL', MSFT: 'MSFT', AMZN: 'AMZN', GOOGL: 'GOOGL', TSLA: 'TSLA', NVDA: 'NVDA', META: 'META', DIS: 'DIS', NKE: 'NKE', WMT: 'WMT', KO: 'KO', RELIANCE: 'RELIANCE.NS', HUL: 'HINDUNILVR.NS', NESTLE: 'NESN.SW' };
const SYM = { USD: '$', INR: 'Rs ', CHF: 'CHF ' };

// ---------- formatting ----------
function money(v, c) { // v is in the company's reporting unit
  const u = c.unit, s = SYM[c.currency] || '';
  if (u === 'Rs crore') return v >= 1e5 ? `${s}${(v / 1e5).toFixed(2)} lakh cr` : `${s}${Math.round(v).toLocaleString('en-IN')} cr`;
  return Math.abs(v) >= 1e3 ? `${s}${(v / 1e3).toFixed(1)}B` : `${s}${Math.round(v)}M`;
}
const pct = (v, d = 1) => (v > 0 ? '+' : '') + v.toFixed(d) + '%';
const px = (v, cur) => (SYM[cur] || '') + v.toLocaleString(cur === 'INR' ? 'en-IN' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = s => String(s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));

// ---------- analysis ----------
function analyse(c) {
  const segs = c.segments.filter(s => s.cur != null).map(s => ({ ...s }));
  const tot = segs.reduce((a, s) => a + s.cur, 0);
  const totPrev = segs.reduce((a, s) => a + (s.prev ?? 0), 0);
  segs.forEach(s => { s.share = s.cur / tot * 100; });
  const avg = totPrev ? (tot / totPrev - 1) * 100 : null;
  const pool = segs.filter(s => s.share >= 3 && s.growth != null); // ignore tiny "other" lines when naming the weak spot
  const base = pool.length >= 2 ? pool : segs.filter(s => s.growth != null);
  const weak = [...base].sort((a, b) => a.growth - b.growth)[0];
  const strong = [...base].sort((a, b) => b.growth - a.growth)[0];
  const biggest = [...segs].sort((a, b) => b.cur - a.cur)[0];
  return { segs, tot, totPrev, avg, weak, strong, biggest };
}

// ---------- prices ----------
function series(id) { return state.prices[id]; }
function latest(id) {
  const s = series(id); const lv = state.live[id];
  if (lv) return { price: lv.price, prev: lv.prev ?? s?.pts[s.pts.length - 2]?.[1], time: lv.time, live: true, hi: lv.hi ?? s?.hi52, lo: lv.lo ?? s?.lo52 };
  if (!s) return null;
  const n = s.pts.length;
  return { price: s.price, prev: s.pts[n - 2]?.[1] ?? s.prevClose, time: s.time, live: false, hi: s.hi52, lo: s.lo52 };
}
const UA_NOTE = 'Yahoo blocks direct browser calls for most sites, so this tries a couple of public CORS relays. If none answer, the badge says SNAPSHOT.';
async function timedFetch(url, ms = 6000) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetch(url, { signal: ctl.signal }); if (!r.ok) throw new Error(r.status); return await r.json(); } finally { clearTimeout(t); }
}
async function fetchLive(id) {
  const key = localStorage.getItem('xray_td_key');
  const c = state.companies.find(x => x.id === id);
  if (key && c && c.market === 'US') {
    try { const j = await timedFetch(`https://api.twelvedata.com/quote?symbol=${YAHOO[id]}&apikey=${encodeURIComponent(key)}`); if (j.close) return { price: +j.close, prev: +j.previous_close, time: Math.floor(Date.now() / 1000), hi: +j.fifty_two_week?.high || undefined, lo: +j.fifty_two_week?.low || undefined, via: 'Twelve Data' }; } catch (e) { }
  }
  const y = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(YAHOO[id])}?range=5d&interval=1d`;
  const routes = [y, 'https://api.allorigins.win/raw?url=' + encodeURIComponent(y), 'https://api.codetabs.com/v1/proxy/?quest=' + encodeURIComponent(y)];
  for (const u of routes) {
    try {
      const res = (await timedFetch(u)).chart.result[0], j = res.meta;
      const cl = (res.indicators.quote[0].close || []).filter(v => v != null);
      if (j.regularMarketPrice) return { price: j.regularMarketPrice, prev: cl.length > 1 ? cl[cl.length - 2] : undefined, time: j.regularMarketTime, hi: j.fiftyTwoWeekHigh, lo: j.fiftyTwoWeekLow, via: 'Yahoo Finance' };
    } catch (e) { }
  }
  return null;
}
async function refreshLive(id) {
  const r = await fetchLive(id);
  if (r) state.live[id] = r; else delete state.live[id];
  renderList(); if (state.id === id) { renderTop(); renderChart(); renderStats(); renderPitch(); }
}

// ---------- render ----------
function visible() {
  const q = state.q.toLowerCase();
  return state.companies.filter(c => (state.market === 'All' || c.market === state.market) && (!q || (c.name + ' ' + c.id).toLowerCase().includes(q)));
}
function renderTabs() {
  $('#tabs').innerHTML = ['All', 'US', 'India', 'Global'].map(m => `<button class="${state.market === m ? 'on' : ''}" data-m="${m}">${m}</button>`).join('');
}
function renderList() {
  const vis = visible();
  const count = state.q ? `<p class="sub" style="padding:2px 2px 8px">${vis.length} of ${state.companies.length} companies</p>` : '';
  $('#list').innerHTML = count + (vis.map(c => {
    const l = latest(c.id); const ch = l && l.prev ? (l.price / l.prev - 1) * 100 : null;
    return `<button class="item ${c.id === state.id ? 'on' : ''}" data-id="${c.id}"><span><b>${esc(c.name)}</b><small>${esc(YAHOO[c.id])} &middot; ${esc(c.exchange)}</small></span><span class="px">${l ? px(l.price, c.currency) : '-'}${ch != null ? `<i class="${ch >= 0 ? 'up' : 'dn'}">${pct(ch, 2)}</i>` : ''}</span></button>`;
  }).join('') || '<p class="err">No match.</p>');
}
function badge(id) {
  const l = latest(id); if (!l) return '';
  const when = new Date(l.time * 1000);
  if (l.live) return `<span class="badge live" title="${esc(state.live[id].via)}">LIVE &middot; ${esc(state.live[id].via)} &middot; ${when.toLocaleTimeString()}</span>`;
  return `<span class="badge" title="${esc(UA_NOTE)}">SNAPSHOT &middot; ${when.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>`;
}
function renderTop() {
  const c = cur(); const l = latest(c.id);
  document.title = c.name + (l ? ' - ' + px(l.price, c.currency) : '') + ' - Company X-Ray';
  const ch = l && l.prev ? l.price - l.prev : null, chp = ch != null ? ch / l.prev * 100 : null;
  $('#top').innerHTML = `<div><h1>${esc(c.name)}</h1><div class="chips"><span class="chip">${esc(YAHOO[c.id])}</span><span class="chip">${esc(c.exchange)}</span><span class="chip">${esc(c.market)}</span><span class="chip">${esc(c.currency)}</span></div></div>
  <div class="bigpx">${l ? `<div class="n">${px(l.price, c.currency)}</div><div class="d ${ch >= 0 ? 'up' : 'dn'}">${ch >= 0 ? '+' : ''}${ch.toFixed(2)} (${pct(chp, 2)}) vs previous close</div>${badge(c.id)}` : '<div class="err">No price data</div>'}</div>`;
}
function renderChart() {
  const c = cur(), s = series(c.id), el = $('#chartCard');
  if (!s) { el.innerHTML = '<h2>Share price</h2><p class="err">No price series for this company.</p>'; return; }
  let pts = s.pts.slice(-state.range).map(p => [p[0], p[1]]);
  const l = latest(c.id); if (l && l.live) pts.push([l.time, l.price]);
  const W = 900, H = 260, P = { l: 52, r: 14, t: 12, b: 24 };
  const ys = pts.map(p => p[1]), mn = Math.min(...ys), mx = Math.max(...ys), pad = (mx - mn) * .08 || 1;
  const x = i => P.l + i / (pts.length - 1) * (W - P.l - P.r), y = v => P.t + (1 - (v - (mn - pad)) / (mx - mn + 2 * pad)) * (H - P.t - P.b);
  const d = pts.map((p, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p[1]).toFixed(1)).join(' ');
  const up = pts.at(-1)[1] >= pts[0][1], col = up ? '#5eead4' : '#ff6b57';
  const ticks = [0, .25, .5, .75, 1].map(f => { const v = mn - pad + f * (mx - mn + 2 * pad); return `<line x1="${P.l}" x2="${W - P.r}" y1="${y(v)}" y2="${y(v)}" stroke="#16222f"/><text x="${P.l - 6}" y="${y(v) + 3}" text-anchor="end">${v >= 1000 ? Math.round(v) : v.toFixed(1)}</text>`; }).join('');
  const dl = i => new Date(pts[i][0] * 1000).toLocaleDateString([], { month: 'short', year: '2-digit' });
  const xl = [0, .33, .66, 1].map(f => { const i = Math.round(f * (pts.length - 1)); return `<text x="${x(i)}" y="${H - 6}" text-anchor="${f === 0 ? 'start' : f === 1 ? 'end' : 'middle'}">${dl(i)}</text>`; }).join('');
  const ret = (pts.at(-1)[1] / pts[0][1] - 1) * 100;
  el.innerHTML = `<div class="rng">${[[21, '1M'], [126, '6M'], [252, '1Y']].map(([n, t]) => `<button data-r="${n}" class="${state.range === n ? 'on' : ''}">${t}</button>`).join('')}</div>
  <h2>Share price trend</h2><p class="sub">${ret >= 0 ? 'Up' : 'Down'} <b class="${ret >= 0 ? 'up' : 'dn'}">${pct(ret)}</b> over the selected window &middot; daily closes from Yahoo Finance</p>
  <svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Price chart">${ticks}${xl}<defs><linearGradient id="g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity=".25"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs>
  <path d="${d} L${x(pts.length - 1)} ${H - P.b} L${P.l} ${H - P.b}Z" fill="url(#g)"/><path d="${d}" fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round"/><circle cx="${x(pts.length - 1)}" cy="${y(pts.at(-1)[1])}" r="4" fill="${col}"/><circle class="mk" r="5" fill="#0b1220" stroke="${col}" stroke-width="2" style="display:none"/></svg><div class="chartTip" style="display:none;position:absolute;top:8px;left:0;background:#0b1220;border:1px solid #1c2b3d;color:#dbe7f3;padding:4px 10px;border-radius:6px;font:12px 'JetBrains Mono',monospace;pointer-events:none;white-space:nowrap;z-index:2"></div>`;
  el.style.position = 'relative';
  const svgEl = el.querySelector('svg'), tip = el.querySelector('.chartTip'), mkEl = el.querySelector('.mk');
  svgEl.addEventListener('mousemove', e => {
    const r = svgEl.getBoundingClientRect(); if (!r.width) return;
    const fx = (e.clientX - r.left) / r.width * W;
    const i = Math.max(0, Math.min(pts.length - 1, Math.round((fx - P.l) / (W - P.l - P.r) * (pts.length - 1))));
    const [t, v] = pts[i];
    tip.style.display = 'block';
    tip.style.left = Math.max(4, Math.min(r.width - 160, e.clientX - r.left + 12)) + 'px';
    tip.textContent = new Date(t * 1000).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) + '  ' + px(v, c.currency);
    mkEl.style.display = ''; mkEl.setAttribute('cx', x(i)); mkEl.setAttribute('cy', y(v));
  });
  svgEl.addEventListener('mouseleave', () => { tip.style.display = 'none'; mkEl.style.display = 'none'; });
}
function renderLadder() {
  const c = cur(), a = analyse(c);
  const rows = [...a.segs].sort(state.sort === 'growth' ? (p, q) => (p.growth ?? 1e9) - (q.growth ?? 1e9) : (p, q) => p.cur - q.cur);
  const mx = Math.max(...a.segs.map(s => s.cur));
  $('#ladderCard').innerHTML = `<div class="seg" style="float:right"><button data-s="growth" class="${state.sort === 'growth' ? 'on' : ''}">By growth</button><button data-s="rev" class="${state.sort === 'rev' ? 'on' : ''}">By revenue</button></div>
  <h2>Products ranked weakest to strongest</h2><p class="sub">${esc(c.period)} &middot; ${esc(c.unit)}${c.periodType === 'quarter' ? ' &middot; growth = YoY % reported for the quarter' : ' &middot; growth = vs previous year'}</p>
  <div class="ladder">${rows.map((s, i) => {
    const isW = a.weak && s.name === a.weak.name, isS = a.strong && s.name === a.strong.name;
    return `<div class="lrow ${isW ? 'weak' : isS ? 'strong' : ''}"><span class="rk">#${i + 1}</span><span>${esc(s.name)}${isW ? ' <small class="dn">weak spot</small>' : isS ? ' <small class="up">engine</small>' : ''}</span><div class="bar"><i style="width:${Math.max(3, s.cur / mx * 66)}%"></i><em style="left:calc(${Math.max(3, s.cur / mx * 66)}% + 8px)">${money(s.cur, c)} &middot; ${s.share.toFixed(1)}%</em></div><span class="gr ${s.growth == null ? '' : s.growth >= 0 ? 'up' : 'dn'}">${s.growth == null ? 'n/a' : pct(s.growth)}</span></div>`;
  }).join('')}</div>
  ${a.avg != null ? `<p class="sub" style="margin-top:12px">Whole company, these lines combined: <b>${money(a.tot, c)}</b>, ${pct(a.avg)} vs prior period. The weak spot is the slowest-growing line with at least 3% of revenue.</p>` : ''}`;
}
function renderSrc() {
  const c = cur();
  $('#srcCard').innerHTML = `<h2>Where the product numbers come from</h2><p class="sub">Official filing, not a data vendor</p>
  <dl class="kv"><dt>Source</dt><dd>${esc(c.source)}</dd><dt>Filed</dt><dd>${esc(c.filed)}</dd><dt>Period</dt><dd>${esc(c.periodType === 'quarter' ? 'Quarterly' : 'Annual')}</dd><dt>Link</dt><dd><a href="${esc(c.sourceUrl)}" target="_blank" rel="noopener">open filing</a></dd></dl>
  <p class="sub" style="margin-top:12px">${esc(c.note)}</p>`;
}
function renderStats() {
  const c = cur(), l = latest(c.id), s = series(c.id);
  if (!l || !s) { $('#statsCard').innerHTML = ''; return; }
  const pos = l.hi && l.lo ? (l.price - l.lo) / (l.hi - l.lo) * 100 : null;
  const first = s.pts[0]?.[1], r1 = first ? (l.price / first - 1) * 100 : null;
  $('#statsCard').innerHTML = `<h2>Share snapshot</h2><p class="sub">${esc(s.exchange || c.exchange)} &middot; ${esc(c.currency)}</p>
  <dl class="kv"><dt>Price</dt><dd>${px(l.price, c.currency)}</dd><dt>52-week high</dt><dd>${l.hi ? px(l.hi, c.currency) : '-'}</dd><dt>52-week low</dt><dd>${l.lo ? px(l.lo, c.currency) : '-'}</dd><dt>Position in range</dt><dd>${pos != null ? pos.toFixed(0) + '%' : '-'}</dd><dt>1-year return</dt><dd class="${r1 != null ? (r1 >= 0 ? 'up' : 'dn') : ''}">${r1 != null ? pct(r1) : '-'}</dd></dl>`;
}
function pitch(c) {
  const a = analyse(c), l = latest(c.id), s = series(c.id);
  if (!a.weak) return null;
  const w = a.weak, st = a.strong, per = c.periodType === 'quarter' ? 'quarter' : 'year';
  const gap = a.avg != null ? w.growth - a.avg : null;
  const atAvg = a.avg != null && w.prev ? w.prev * (1 + a.avg / 100) - w.cur : null; // revenue missing vs growing at company pace
  const atBest = w.prev ? w.prev * (1 + st.growth / 100) - w.cur : null;
  const shrink = w.growth < 0;
  const pos = l && l.hi && l.lo ? (l.price - l.lo) / (l.hi - l.lo) * 100 : null;
  const r1 = l && s?.pts[0] ? (l.price / s.pts[0][1] - 1) * 100 : null;
  const items = [];
  items.push(a.biggest.name === st.name
    ? `<b class="gd">The core is worth owning.</b> ${esc(st.name)} is both the largest line (${money(st.cur, c)}, ${st.share.toFixed(0)}% of these revenues) and the fastest-growing at ${pct(st.growth)}.`
    : `<b class="gd">The core is worth owning.</b> ${esc(a.biggest.name)} is the largest line at ${money(a.biggest.cur, c)} (${a.biggest.share.toFixed(0)}% of these revenues), and ${esc(st.name)} is growing fastest at ${pct(st.growth)}.`);
  items.push(`<b class="hl">The weak spot is ${esc(w.name)}.</b> ${money(w.cur, c)} this ${per}, ${w.share.toFixed(1)}% of revenue, ${shrink ? `and it <b class="hl">shrank ${Math.abs(w.growth).toFixed(1)}%</b>` : `growing only ${pct(w.growth)}`}${gap != null ? `, ${Math.abs(gap).toFixed(1)} points behind the ${pct(a.avg)} the company grows overall` : ''}.`);
  if (atAvg != null && atAvg > 0) items.push(`<b>The size of the prize.</b> If ${esc(w.name)} grew at the company's own pace it would add about <b>${money(atAvg, c)}</b> of revenue; at ${esc(st.name)}'s pace, about <b>${money(atBest, c)}</b>.`);
  items.push(`<b>What a new owner changes.</b> ${shrink ? 'Stop the decline first: reprice or reposition the line, fold it into a bundle with the best-selling products, or cut cost to protect margin.' : 'Lift it to the company average: sell it through the same customers who already buy the ' + esc(st.name) + ' line, review pricing and mix, and strip out duplicate cost.'} This is a framework for thinking, not a forecast.`);
  if (pos != null) items.push(`<b>Timing.</b> The share price sits at ${pos.toFixed(0)}% of its 52-week range${r1 != null ? ` and is ${pct(r1)} over one year` : ''}. ${pos < 40 ? 'Near the lower part of its range, which is where an acquirer usually likes to start.' : pos > 75 ? 'Near the top of its range, so a buyer would pay up. The case needs a bigger fix to justify the premium.' : 'Mid-range, so the price does not hand the buyer an obvious edge.'}`);
  const risks = [
    'Segment numbers are one filing period. A weak year can be a blip, so check the next report before believing the trend.',
    `Large companies are rarely bought outright. In practice this is a case for buying or carving out the weak line, or for an activist push, not a takeover of the whole company.`,
    'A fix costs money and time, and a premium over the share price has to be earned back.',
    'Student project built from public data. It is not investment advice.'
  ];
  const text = `${c.name} (${YAHOO[c.id]}) - acquisition case built on ${w.name}\n\n` + items.map((t, i) => (i + 1) + '. ' + t.replace(/<[^>]+>/g, '')).join('\n') + '\n\nRisks\n- ' + risks.join('\n- ') + `\n\nSource: ${c.source} (filed ${c.filed}). Prices: Yahoo Finance.`;
  return { w, items, risks, text };
}
function renderPitch() {
  const c = cur(), p = pitch(c), el = $('#pitchCard');
  if (!p) { el.innerHTML = '<h2>Acquisition pitch</h2><p class="sub">Not enough growth data to find a weak spot.</p>'; return; }
  el.innerHTML = `<span class="tag">AUTO-WRITTEN FROM THE NUMBERS ABOVE</span><h3>Why a buyer should look at ${esc(c.name)}: the case built on ${esc(p.w.name)}</h3>
  <ol>${p.items.map(i => `<li>${i}</li>`).join('')}</ol><h4>Risks and honest limits</h4><ul>${p.risks.map(r => `<li>${esc(r)}</li>`).join('')}</ul>
  <div class="acts"><button class="ghost" id="copyP">Copy pitch</button><button class="ghost" onclick="window.print()">Print / save PDF</button></div>`;
  $('#copyP').onclick = e => { navigator.clipboard.writeText(p.text); e.target.textContent = 'Copied'; setTimeout(() => e.target.textContent = 'Copy pitch', 1400); };
}
function renderHonest() {
  const g = state.generated ? new Date(state.generated).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'unknown';
  $('#honest').className = 'card span2 honest';
  $('#honest').innerHTML = `<h2>What is live and what is not</h2><ul>
  <li><b>Share price:</b> tries a live Yahoo Finance quote in your browser every minute. If that is blocked, it shows the last saved price and says so in the badge (saved ${esc(g)}).</li>
  <li><b>Product revenue:</b> companies only publish this when they report (quarterly or yearly), so it cannot be live. US data is read straight from SEC EDGAR 10-K filings by a script; India and global companies are copied by hand from their official results releases.</li>
  <li><b>Pitch:</b> the numbers and ranking are computed, the wording is a template. It finds the weak spot, it does not know why the product is weak.</li>
  <li><b>Coverage:</b> ${state.companies.length} companies for now. Adding a US company is one entry in <code>scripts/config.mjs</code>.</li></ul>`;
}
const cur = () => state.companies.find(c => c.id === state.id);
function renderAll() { localStorage.setItem('xray_last', state.id); renderTabs(); renderList(); renderTop(); renderChart(); renderLadder(); renderSrc(); renderStats(); renderPitch(); renderHonest(); }

// ---------- events ----------
document.addEventListener('click', e => {
  const t = e.target.closest('[data-m],[data-id],[data-r],[data-s]'); if (!t) return;
  if (t.dataset.m) { state.market = t.dataset.m; localStorage.setItem('xray_market', state.market); renderTabs(); renderList(); }
  else if (t.dataset.id) { state.id = t.dataset.id; location.hash = state.id; renderAll(); refreshLive(state.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  else if (t.dataset.r) { state.range = +t.dataset.r; localStorage.setItem('xray_range', state.range); renderChart(); }
  else if (t.dataset.s) { state.sort = t.dataset.s; localStorage.setItem('xray_sort', state.sort); renderLadder(); }
});
// keyboard: / focuses search, ArrowUp/ArrowDown or j/k steps through the visible companies
document.addEventListener('keydown', e => {
  if ($('#keyDlg').open) return;
  if (e.key === '/' && document.activeElement !== $('#q')) { e.preventDefault(); $('#q').focus(); return; }
  if (document.activeElement === $('#q') || document.activeElement === $('#keyIn')) return;
  const down = e.key === 'ArrowDown' || e.key === 'j', up = e.key === 'ArrowUp' || e.key === 'k';
  if (!down && !up) return;
  const list = visible(); if (!list.length) return;
  const i = list.findIndex(c => c.id === state.id);
  const n = down ? Math.min(list.length - 1, i + 1) : Math.max(0, i - 1);
  if (n === i) return;
  e.preventDefault();
  state.id = list[n].id; location.hash = state.id; renderAll(); refreshLive(state.id);
});
$('#q').addEventListener('input', e => { state.q = e.target.value; renderList(); });
// search: Enter opens the first match, Escape clears the box
$('#q').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const first = visible()[0];
    if (!first) return;
    state.id = first.id; location.hash = first.id; renderAll(); refreshLive(first.id);
    e.target.blur(); window.scrollTo({ top: 0, behavior: 'smooth' });
  } else if (e.key === 'Escape') {
    e.target.value = ''; state.q = ''; renderList(); e.target.blur();
  }
});
$('#keyBtn').onclick = () => { $('#keyIn').value = localStorage.getItem('xray_td_key') || ''; $('#keyDlg').showModal(); };
$('#keySave').onclick = () => { const v = $('#keyIn').value.trim(); v ? localStorage.setItem('xray_td_key', v) : localStorage.removeItem('xray_td_key'); setTimeout(() => refreshLive(state.id), 50); };
window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (h && h !== state.id && state.companies.some(c => c.id === h)) { state.id = h; renderAll(); refreshLive(h); } });

(async function init() {
  try {
    const [co, pr] = await Promise.all([fetch('data/companies.json').then(r => r.json()), fetch('data/prices.json').then(r => r.json())]);
    state.companies = co.companies; state.generated = pr.generated || co.generated;
    for (const [k, v] of Object.entries(pr.series)) state.prices[k] = v;
    const h = location.hash.slice(1), last = localStorage.getItem('xray_last');
    state.id = state.companies.some(c => c.id === h) ? h : state.companies.some(c => c.id === last) ? last : 'AAPL';
    renderAll(); refreshLive(state.id);
    setInterval(() => refreshLive(state.id), 60000);
  } catch (e) { $('#main').innerHTML = '<p class="err">Could not load data files. If you opened index.html straight from disk, serve the folder instead: <code>python -m http.server</code></p>'; console.error(e); }
})();
