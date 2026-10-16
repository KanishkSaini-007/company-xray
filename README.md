# Company X-Ray

Pick a listed company (US, India or global). The page shows its share price, ranks its products from weakest to strongest using real filings, and writes an acquisition pitch built on the weakest one.

**Live site:** https://kanishksaini-007.github.io/company-xray/

I started this as a Power BI idea, then rebuilt it as a web page so anyone can open it with no software. It is a learning project: I wanted to see how far public data can go.

## What it does
1. **Share price** - 1 year chart, 52-week range, day change. Tries a live Yahoo Finance quote in the browser every minute and falls back to a saved snapshot (the badge says LIVE or SNAPSHOT).
2. **Product ranking** - each company's revenue by product or segment, sorted by growth (or by size). The slowest-growing line with at least 3% of revenue is flagged as the weak spot.
3. **Pitch** - a written case for why a buyer should look at the company, using only the numbers on the page: weak spot, size of the prize if it grew at the company's pace, price timing, and risks.

## Companies (14)
- **US (11)**, read automatically from SEC EDGAR 10-K filings: Apple, Microsoft, Amazon, Alphabet, Tesla, NVIDIA, Meta, Disney, Nike, Walmart, Coca-Cola
- **India (2)**, typed in from official results: Reliance Industries, Hindustan Unilever
- **Global (1)**: Nestle

## What is really live
| Part | How fresh |
|---|---|
| Share price | Live when the browser can reach Yahoo (often blocked by CORS), otherwise the last GitHub Actions snapshot (every 6 hours) |
| US product revenue | From the latest 10-K on EDGAR, re-checked every 6 hours. A 10-K only comes out once a year, so it cannot be "live" |
| India / global product revenue | Copied by hand from the company's results release |
| Pitch | Numbers computed, wording is a template. It finds the weak spot but cannot say why it is weak |

For truly live US prices, paste a free [Twelve Data](https://twelvedata.com) key in "Live price settings". It stays in your browser only.

## How the data is built
`scripts/edgar_segments.mjs` downloads a company's latest 10-K, reads the inline XBRL tags and collects revenue facts that have a product or segment dimension. `scripts/config.mjs` says which tagged lines to use per company (parent totals would double count). `scripts/build_data.mjs` writes `data/companies.json` and `data/prices.json`.

```bash
node scripts/build_data.mjs      # Node 18+
python -m http.server            # then open http://localhost:8000
```

Add a US company: one entry in `scripts/config.mjs` (pick the axis and member names that `node scripts/edgar_segments.mjs TICKER` prints).

## Limits I know about
- Segment definitions change between years, so growth for a renamed line can be off.
- Reliance is one quarter (Q1 FY27) with YoY growth as reported; the others are full years.
- Large companies are not really bought whole. The pitch is a thinking framework.
- Not investment advice.

Data: SEC EDGAR, Yahoo Finance, company results releases. Built by Kanishk Saini x Instinct.
