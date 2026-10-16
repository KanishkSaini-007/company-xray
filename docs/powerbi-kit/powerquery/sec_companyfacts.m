// US company filings, straight from the SEC (EDGAR XBRL company facts API).
// Free, official, no key. SEC only asks for a User-Agent header with a contact email.
// Find a company's CIK here: https://www.sec.gov/files/company_tickers.json
// This pulls total quarterly/annual revenue from 10-K and 10-Q filings.
// Segment/product splits are in the 10-K "Net sales by category" table - see build guide step 3.
let
    Cik = "0000320193",   // Apple. Microsoft = 0000789019, Amazon = 0001018724, Tesla = 0001318605
    url = "https://data.sec.gov/api/xbrl/companyfacts/CIK" & Cik & ".json",
    raw = Json.Document(Web.Contents(url, [Headers = [#"User-Agent" = "student-project youremail@example.com"]])),
    revenue = raw[facts][#"us-gaap"][RevenueFromContractWithCustomerExcludingAssessedTax][units][USD],
    tbl = Table.FromList(revenue, Splitter.SplitByNothing(), null, null, ExtraValues.Error),
    expanded = Table.ExpandRecordColumn(tbl, "Column1", {"start", "end", "val", "fy", "fp", "form", "filed"}, {"Start", "End", "RevenueUSD", "FY", "Period", "Form", "Filed"}),
    typed = Table.TransformColumnTypes(expanded, {{"Start", type date}, {"End", type date}, {"RevenueUSD", Int64.Type}, {"Filed", type date}})
in
    typed
