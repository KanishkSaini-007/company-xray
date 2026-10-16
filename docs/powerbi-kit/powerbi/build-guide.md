# Build guide - Company X-Ray dashboard (Power BI Desktop)

Time: about 2-3 hours the first time. You need Power BI Desktop (free) on Windows and internet for the live price query.

## Step 1 - Get the prices (live)
1. Get Data > Blank Query > Advanced Editor.
2. Paste `powerquery/yahoo_prices_live.m`, replace the ticker list with the companies you want, Done.
3. Name the query `Prices`. Close & Apply.
4. If Yahoo ever blocks, use `powerquery/stooq_prices.m` instead, or load `data/prices/*_1y.csv` (offline snapshot from 2026-10-16).

## Step 2 - Get the segment data (real filings)
Pick your route per market - details in `powerquery/data-sources.md`:
- US: SEC EDGAR. Total revenue via `powerquery/sec_companyfacts.m`; product split from the 10-K "Net sales by category" table into a CSV like `data/apple_products.csv`.
- India: the company's quarterly results press release (segment table) into a CSV like `data/reliance_segments.csv`. screener.in for totals.
- Global: the IR results PDF (example: `data/nestle_products.csv`).
Load the CSVs as one `Segments` table (append them in Power Query: keep columns company, period, segment, revenue, growth, margin, source).

## Step 3 - Model
- Two tables: `Prices`, `Segments`. No relationship needed between them (different grains); link both to a small `Companies` table (ticker, name, market, currency) if you want one slicer to drive everything.
- View > Themes > Browse > load `powerbi/theme.json` (dark theme).
- Import measures from `powerbi/measures.dax` (create each as a new measure in `Prices` or `Segments` as marked).

## Step 4 - Pages
**Page 1 - Market view**
- KPI cards: Latest Price, Daily Change %, 1Y Return %, Distance from 52W High %.
- Line chart: Date vs Close, one line per company (normalize to % return if mixing currencies).
- Company slicer (dropdown) on top.

**Page 2 - Product ladder**
- Bar chart: Segment vs Segment Revenue, sorted ascending = "lowest to highest performing".
- Data labels on, segment share % as tooltip.
- Scatter: x = Segment Growth %, y = margin, bubble = revenue. This is your "who is really weak" view.
- Card: Weakest Segment measure.
- RAG table: segment, revenue, share, growth, Segment Status with conditional formatting (red/amber/green).

**Page 3 - Acquisition pitch**
Layout, top to bottom:
1. Title: "Acquire [Company]: the case built on [Weakest Segment]".
2. Left: the weak-segment facts (share of revenue, growth, margin trend).
3. Right: the pitch text from `pitch/` (5 bullets: why the rest of the business funds the fix, what the buyer changes, why now).
4. Bottom: risks (one honest line each).

## Step 5 - Refresh + honesty labels
- Prices refresh on open (live query). Segment data updates when the company reports - add a small text box: "Share price: live (delayed). Segment data: latest filings, updated [date]."
- That one line is what makes this look like a real analyst project instead of a demo.

## Step 6 - Publish
- File > Publish to Power BI Service (free account) for a shareable link, or export PDF for a static version.
- Screenshot the three pages into `docs/screenshots/` for the GitHub README.
