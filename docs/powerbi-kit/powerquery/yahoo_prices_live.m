// Live-ish share prices (15-20 min delayed) for any listed company: US, India, global.
// Works in Power BI Desktop: Get Data > Blank Query > Advanced Editor > paste this.
// Edit the ticker list. Suffixes: India NSE = .NS (RELIANCE.NS, TCS.NS), India BSE = .BO,
// Switzerland = .SW, London = .L, Germany = .DE, Tokyo = .T. US stocks need no suffix.
let
    Tickers = {"AAPL", "RELIANCE.NS", "NESN.SW"},   // <-- add/remove tickers here
    GetPrices = (ticker as text) =>
        let
            url = "https://query1.finance.yahoo.com/v8/finance/chart/" & ticker & "?range=1y&interval=1d",
            raw = Json.Document(Web.Contents(url)),
            result = raw[chart][result]{0},
            meta = result[meta],
            ts = result[timestamp],
            quote = result[indicators][quote]{0},
            closes = quote[close],
            dates = List.Transform(ts, each #datetime(1970,1,1,0,0,0) + #duration(0,0,0,_)),
            tbl = Table.FromColumns({dates, closes}, {"Date", "Close"}),
            typed = Table.TransformColumnTypes(tbl, {{"Date", type date}, {"Close", type number}}),
            noNulls = Table.SelectRows(typed, each [Close] <> null),
            addTicker = Table.AddColumn(noNulls, "Ticker", each ticker, type text),
            addName = Table.AddColumn(addTicker, "Company", each Text.From(meta[shortName]), type text),
            addCcy = Table.AddColumn(addName, "Currency", each Text.From(meta[currency]), type text)
        in
            addCcy,
    Combined = Table.Combine(List.Transform(Tickers, each GetPrices(_)))
in
    Combined
// Note: Yahoo's public endpoint is unofficial but free and keyless. If it ever throttles,
// use stooq_prices.m as the fallback source.
