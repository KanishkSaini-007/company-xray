# Company X-Ray - Power BI dashboard + acquisition pitch

A Power BI project that studies real, listed companies (US, India, global) from two angles:

1. **Live share price** - pulled straight into Power BI from market APIs, refreshes on open.
2. **Product / segment performance** - from the company's actual filings (SEC 10-K for US, results press releases for India, IR reports for global), ranked lowest to highest.

Then the fun part: a pitch page that argues why someone should **acquire the company, using its weakest product as the reason** - the weak segment is the discount, the fix is the upside.

## Companies included (real data, pulled Oct 16, 2026)
| Company | Market | Weak spot found | Source |
|---|---|---|---|
| Apple (AAPL) | US | Wearables, Home & Accessories: -4% in FY2025, only shrinking category | Apple FY2025 Form 10-K, SEC EDGAR |
| Reliance (RELIANCE.NS) | India | Oil & Gas: smallest segment, +3.2% growth, EBITDA -0.5% | RIL Q1 FY2026-27 media release |
| Nestle (NESN.SW) | Global (Swiss) | Prepared dishes: -0.4% organic growth, only negative group | Nestle Full-Year Results 2025 |

## What's in here
- `data/` - real segment/product CSVs + 1 year of daily prices for all three companies
- `powerquery/` - paste-in Power Query (M) scripts: live Yahoo prices, Stooq fallback, SEC EDGAR filings API, plus a source guide per market
- `powerbi/` - step-by-step build guide, DAX measures (latest price, 52W range, segment share/rank, weakest-segment finder, RAG status), dark theme
- `pitch/` - the acquisition pitch template + a worked pitch for each of the three companies

## How to rebuild it
Follow `powerbi/build-guide.md`. About 2-3 hours in Power BI Desktop. Live prices need internet; the CSVs in `data/` work offline.

## Honest limitations
- Share prices are live-ish (15-20 min delayed, unofficial Yahoo endpoint). Segment/product numbers only update when the company reports - quarterly for US/India, half-yearly for many global companies. The dashboard says this on the page, because that's what makes it a real analyst project.
- Segment splits are typed into CSVs from filings by hand (10 min per company per quarter). There is no free API that streams product-level revenue.

## What I learned
- Power Query against real APIs (JSON and CSV), with a fallback source
- Modeling two data grains (daily prices vs quarterly segments) in one report
- DAX: ranking, share %, RAG conditional logic
- Reading actual filings: SEC 10-K product tables, Indian results press releases, European annual reports
- Turning analysis into an investment-banking style pitch instead of just charts

Built while learning Power BI and equity research. MBA Tech, NMIMS.
