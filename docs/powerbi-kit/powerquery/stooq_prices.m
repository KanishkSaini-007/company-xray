// Fallback price source: Stooq. Free daily CSV, no key, very stable in Power BI.
// US tickers end in .us (aapl.us). It covers many global markets too.
let
    Tickers = {"aapl.us"},
    GetPrices = (ticker as text) =>
        let
            url = "https://stooq.com/q/d/l/?s=" & ticker & "&i=d",
            csv = Csv.Document(Web.Contents(url), [Delimiter = ",", Columns = 5, Encoding = 65001, QuoteStyle = QuoteStyle.Csv]),
            headers = Table.PromoteHeaders(csv, [PromoteAllScalars = true]),
            typed = Table.TransformColumnTypes(headers, {{"Date", type date}, {"Open", type number}, {"High", type number}, {"Low", type number}, {"Close", type number}}),
            addTicker = Table.AddColumn(typed, "Ticker", each ticker, type text)
        in
            addTicker,
    Combined = Table.Combine(List.Transform(Tickers, each GetPrices(_)))
in
    Combined
