# Data sources by market

## Share prices (live-ish, all markets)
| Source | Coverage | Key needed | Notes |
|---|---|---|---|
| Yahoo Finance chart API (`yahoo_prices_live.m`) | US, India (NSE/BSE), global | No | 15-20 min delayed. Unofficial but stable. |
| Stooq (`stooq_prices.m`) | US + many global markets | No | Daily, free CSV. Good fallback. |
| Alpha Vantage | US + global | Free key | 25 requests/day on free tier. |
| Twelve Data | Global | Free key | 800 requests/day. Good for a "live tile" feel. |

## Product / segment revenue (the honest part)
Segment revenue only exists when a company reports it. Nobody streams it live.

### US companies
- SEC EDGAR full-text search: https://www.sec.gov/cgi-srv/efts/search?  (or efts.sec.gov/LATEST/search-index) - search the 10-K for "net sales by category" or "segment".
- XBRL company facts API (`sec_companyfacts.m`) gives total revenue per quarter from filings.
- Product split: open the 10-K, find the "Net sales by category" table, copy into a CSV like `data/apple_products.csv`. 10 minutes per company, once a year (10-K) or quarter (10-Q).

### India companies
- Company results press release each quarter (e.g. ril.com media releases) has the segment table.
- screener.in/company/TICKER/consolidated/ has quarterly totals; segment split still comes from the press release or annual report.
- BSE/NSE filings pages host the same PDFs.
- Workflow: once a quarter, update `data/reliance_segments.csv` from the latest press release.

### Global companies
- Annual/half-year results on the company's investor relations page (example used: Nestle full-year results PDF, product-group table copied into `data/nestle_products.csv`).

## What's in /data right now (real, pulled 2026-10-16)
- `apple_products.csv` - Apple net sales by category FY2023-25, from Apple's FY2025 Form 10-K on SEC EDGAR (filed 2025-10-31).
- `reliance_segments.csv` - Reliance segment revenue/EBITDA, Q1 FY2026-27 and FY2025-26, from RIL's official media release (2026-07-17).
- `nestle_products.csv` - Nestle 2024-25 sales by product group, from Nestle's full-year 2025 results (2026-02-19).
- `prices/*_1y.csv` - 1 year of daily closes for AAPL, RELIANCE.NS, NESN.SW, pulled from Yahoo Finance on 2026-10-16. Use these if you want the dashboard to work offline; use the live queries when online.
