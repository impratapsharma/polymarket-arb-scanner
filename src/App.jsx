import { useState, useEffect, useCallback } from "react";

const POLYMARKET_FEE = 0.02;

const SEED_DATA = [
  { id: "s1", question: "Will the Fed cut rates at the May 2025 FOMC meeting?", slug: "fed-cut-may-2025", yes: 0.44, no: 0.44, sum: 0.88, profitPct: 10.23, hasArb: true, liquidity: 182000, volume: 94000 },
  { id: "s2", question: "Will Bitcoin exceed $100k before June 2025?", slug: "btc-100k-june-2025", yes: 0.38, no: 0.39, sum: 0.77, profitPct: 24.03, hasArb: true, liquidity: 340000, volume: 210000 },
  { id: "s3", question: "Will Trump sign the border bill before April 2025?", slug: "trump-border-bill-april", yes: 0.31, no: 0.62, sum: 0.93, profitPct: 4.84, hasArb: true, liquidity: 95000, volume: 47000 },
  { id: "s4", question: "Will US GDP growth exceed 2% in Q1 2025?", slug: "us-gdp-q1-2025", yes: 0.47, no: 0.48, sum: 0.95, profitPct: 2.63, hasArb: true, liquidity: 61000, volume: 23000 },
  { id: "s5", question: "Will Ethereum ETF staking be approved in 2025?", slug: "eth-etf-staking-2025", yes: 0.61, no: 0.36, sum: 0.97, profitPct: 0.82, hasArb: true, liquidity: 128000, volume: 88000 },
  { id: "s6", question: "Will Apple announce a foldable iPhone in 2025?", slug: "apple-foldable-2025", yes: 0.28, no: 0.69, sum: 0.97, profitPct: 0.62, hasArb: true, liquidity: 44000, volume: 19000 },
  { id: "s7", question: "Will Kamala Harris run for president again in 2028?", slug: "harris-2028", yes: 0.33, no: 0.65, sum: 0.98, profitPct: 0.00, hasArb: false, liquidity: 72000, volume: 31000 },
  { id: "s8", question: "Will the S&P 500 hit 6000 by end of Q2 2025?", slug: "sp500-6000-q2", yes: 0.55, no: 0.44, sum: 0.99, profitPct: -1.01, hasArb: false, liquidity: 215000, volume: 103000 },
  { id: "s9", question: "Will OpenAI release GPT-5 before July 2025?", slug: "gpt5-july-2025", yes: 0.72, no: 0.29, sum: 1.01, profitPct: -3.00, hasArb: false, liquidity: 390000, volume: 280000 },
  { id: "s10", question: "Will Ukraine ceasefire be signed in 2025?", slug: "ukraine-ceasefire-2025", yes: 0.41, no: 0.61, sum: 1.02, profitPct: -4.00, hasArb: false, liquidity: 501000, volume: 324000 },
  { id: "s11", question: "Will Solana flip Ethereum by market cap in 2025?", slug: "sol-flip-eth-2025", yes: 0.12, no: 0.84, sum: 0.96, profitPct: 1.67, hasArb: true, liquidity: 88000, volume: 41000 },
  { id: "s12", question: "Will the NBA Finals go to 7 games in 2025?", slug: "nba-finals-7-games-2025", yes: 0.43, no: 0.50, sum: 0.93, profitPct: 4.84, hasArb: true, liquidity: 33000, volume: 14000 },
].sort((a, b) => b.profitPct - a.profitPct);

const API_URL = "/api/markets";

function processMarkets(data) {
  return data
    .filter(m => {
      if (!m.outcomePrices) return false;
      try { return JSON.parse(m.outcomePrices).length === 2; } catch { return false; }
    })
    .map(m => {
      const prices = JSON.parse(m.outcomePrices);
      const yes = parseFloat(prices[0]);
      const no = parseFloat(prices[1]);
      const sum = yes + no;
      const net = (1 - POLYMARKET_FEE) - sum;
      const profitPct = (net / sum) * 100;
      return { id: m.id, question: m.question || "", slug: m.slug || m.conditionId || "", yes: +yes.toFixed(4), no: +no.toFixed(4), sum: +sum.toFixed(4), profitPct: +profitPct.toFixed(4), hasArb: net > 0, liquidity: m.liquidity || 0, volume: m.volume24hr || m.volume || 0 };
    })
    .sort((a, b) => b.profitPct - a.profitPct);
}

function calcTrade(yes, no, sum, capital) {
  const yesBet = (capital * no) / sum;
  const noBet = (capital * yes) / sum;
  const ret = (capital / sum) * (1 - POLYMARKET_FEE);
  return { yesBet, noBet, ret, profit: ret - capital };
}

const fmt$ = n => n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${Math.round(n)}`;
const fmtPct = n => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
const FILTERS = ["All", "Crypto", "Politics", "Economics", "Sports", "World"];

export default function App() {
  const [markets, setMarkets] = useState(SEED_DATA);
  const [dataSource, setDataSource] = useState("seed");
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [capital, setCapital] = useState(100);
  const [minSpread, setMinSpread] = useState(-5);
  const [filterTag, setFilterTag] = useState("All");
  const [expanded, setExpanded] = useState(null);
  const [scanCount, setScanCount] = useState(0);
  const [liveError, setLiveError] = useState(null);

  const fetchLive = useCallback(async () => {
    setLoading(true);
    setLiveError(null);
    try {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const processed = processMarkets(data);
      if (processed.length > 0) { setMarkets(processed); setDataSource("live"); }
      setLastRefresh(new Date());
      setScanCount(c => c + 1);
    } catch (e) {
      setLiveError(e.message);
      setDataSource("seed");
      setLastRefresh(new Date());
      setScanCount(c => c + 1);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLive();
    const id = setInterval(fetchLive, 30000);
    return () => clearInterval(id);
  }, [fetchLive]);

  const filtered = markets.filter(m => {
    if (m.profitPct < minSpread) return false;
    if (filterTag === "All") return true;
    const q = m.question.toLowerCase();
    if (filterTag === "Crypto") return /bitcoin|btc|eth|crypto|solana|defi|nft/.test(q);
    if (filterTag === "Politics") return /election|president|congress|senate|trump|biden|harris|vote|bill/.test(q);
    if (filterTag === "Sports") return /nba|nfl|world cup|champion|finals|league|match|mvp/.test(q);
    if (filterTag === "Economics") return /gdp|inflation|fed|rate|recession|s&p|dow/.test(q);
    if (filterTag === "World") return /war|peace|nato|ukraine|china|russia|iran/.test(q);
    return true;
  });

  const arbCount = filtered.filter(m => m.hasArb).length;
  const best = filtered.find(m => m.hasArb);

  return (
    <div style={{ minHeight: "100vh", background: "#030905", color: "#b3ffcc", fontFamily: "'JetBrains Mono','Courier New',monospace", fontSize: 13 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;700&family=Bebas+Neue&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:#030905}::-webkit-scrollbar-thumb{background:#0d2e1a}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.2}}
        @keyframes fadein{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:none}}
        @keyframes scanline{0%{top:-5%}100%{top:105%}}
        .pulse{animation:pulse 1.2s infinite}
        .fadein{animation:fadein .25s ease both}
        .scanline{position:absolute;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(0,255,100,.2),transparent);animation:scanline 4s linear infinite;pointer-events:none}
        .row{border-bottom:1px solid #0a1f10;transition:background .12s;cursor:pointer}
        .row:hover{background:rgba(0,255,100,.04)}
        .tag{background:transparent;border:1px solid #0d2e1a;color:#2d6644;font-family:inherit;font-size:10px;padding:3px 10px;cursor:pointer;letter-spacing:1px;transition:all .15s}
        .tag:hover,.tag.on{background:rgba(0,255,100,.08);border-color:#00ff64;color:#00ff64}
        .slider{-webkit-appearance:none;appearance:none;width:100%;height:2px;background:#0d2e1a;outline:none;cursor:pointer}
        .slider::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;border-radius:50%;background:#00ff64;cursor:pointer;border:2px solid #030905}
        .expand{background:#040f07;border-top:1px solid #0d2e1a;padding:16px 20px;animation:fadein .2s ease}
        .kv{display:flex;justify-content:space-between;margin-bottom:4px;font-size:11px}
        .open-btn{display:inline-block;background:rgba(0,255,100,.1);border:1px solid rgba(0,255,100,.3);color:#00ff64;font-size:10px;padding:5px 14px;text-decoration:none;letter-spacing:1px;margin-top:10px}
        .open-btn:hover{background:rgba(0,255,100,.2)}
        .badge{display:inline-flex;align-items:center;gap:4px;background:rgba(0,255,100,.1);border:1px solid rgba(0,255,100,.3);color:#00ff64;font-size:9px;padding:1px 7px;letter-spacing:1px}
        .warn{background:rgba(245,158,11,.1);border-color:rgba(245,158,11,.3);color:#f59e0b}
      `}</style>

      <div style={{ borderBottom: "1px solid #0d2e1a", padding: "10px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#040f07", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, letterSpacing: 3, color: "#00ff64" }}>POLYMARKET ARB SCANNER</span>
          <span className={`badge ${dataSource === "seed" ? "warn" : ""}`}>{dataSource === "live" ? "● LIVE" : "◌ DEMO DATA"}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 11, color: "#1a6635" }}>
          <span>SCAN #{String(scanCount).padStart(4, "0")}</span>
          <span className="pulse" style={{ color: "#00ff64" }}>●</span>
          <span>{lastRefresh ? lastRefresh.toLocaleTimeString() : "—"}</span>
          <button onClick={fetchLive} style={{ background: "transparent", border: "1px solid #0d2e1a", color: "#3d7a55", fontFamily: "inherit", fontSize: 11, padding: "3px 10px", cursor: "pointer", letterSpacing: 1 }}>
            {loading ? "SCANNING..." : "↺ REFRESH"}
          </button>
        </div>
      </div>

      {liveError && (
        <div style={{ background: "rgba(245,158,11,.06)", borderBottom: "1px solid rgba(245,158,11,.2)", padding: "7px 20px", fontSize: 11, color: "#f59e0b", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
          <span>⚠ API error — showing demo data.</span>
          <code style={{ color: "#6b4a10", fontSize: 10 }}>{liveError}</code>
        </div>
      )}

      <div style={{ borderBottom: "1px solid #0d2e1a", padding: "8px 20px", display: "flex", gap: 28, background: "#040f07", flexWrap: "wrap" }}>
        {[["MARKETS", markets.length], ["ARB OPPS", arbCount], ["BEST SPREAD", best ? fmtPct(best.profitPct) : "—"], ["AVG SPREAD", arbCount ? fmtPct(filtered.filter(m => m.hasArb).reduce((a, m) => a + m.profitPct, 0) / arbCount) : "—"], ["POLY FEE", "2%"]].map(([l, v]) => (
          <div key={l}><div style={{ fontSize: 9, color: "#1a6635", letterSpacing: 2, marginBottom: 2 }}>{l}</div><div style={{ color: "#00ff64", fontWeight: 700 }}>{v}</div></div>
        ))}
      </div>

      <div style={{ borderBottom: "1px solid #0d2e1a", padding: "9px 20px", display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 5 }}>{FILTERS.map(f => <button key={f} className={`tag ${filterTag === f ? "on" : ""}`} onClick={() => setFilterTag(f)}>{f}</button>)}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
          <span style={{ fontSize: 10, color: "#1a6635", whiteSpace: "nowrap" }}>MIN {fmtPct(minSpread)}</span>
          <input type="range" className="slider" min="-10" max="15" step="0.5" value={minSpread} onChange={e => setMinSpread(+e.target.value)} style={{ width: 90 }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10, color: "#1a6635", whiteSpace: "nowrap" }}>CAPITAL ${capital}</span>
          <input type="range" className="slider" min="10" max="10000" step="10" value={capital} onChange={e => setCapital(+e.target.value)} style={{ width: 90 }} />
        </div>
      </div>

      <div style={{ padding: "7px 20px", display: "grid", gridTemplateColumns: "1fr 76px 76px 76px 84px 90px", gap: 8, borderBottom: "1px solid #0d2e1a", background: "#040f07" }}>
        {["MARKET", "YES", "NO", "SUM", "SPREAD", `PROFIT/$${capital}`].map(h => <div key={h} style={{ fontSize: 9, color: "#1a6635", letterSpacing: 2 }}>{h}</div>)}
      </div>

      <div style={{ position: "relative" }}>
        {!loading && <div className="scanline" />}
        {filtered.length === 0 && <div style={{ padding: 40, textAlign: "center", color: "#1a6635" }}>NO MARKETS — lower MIN SPREAD filter</div>}
        {filtered.map((m, i) => {
          const trade = calcTrade(m.yes, m.no, m.sum, capital);
          const isOpen = expanded === m.id;
          const pc = m.hasArb ? "#00ff64" : m.profitPct > -2 ? "#f59e0b" : "#3d5a46";
          return (
            <div key={m.id} className="row fadein" style={{ animationDelay: `${i * 20}ms` }}>
              <div style={{ padding: "10px 20px", display: "grid", gridTemplateColumns: "1fr 76px 76px 76px 84px 90px", gap: 8, alignItems: "center" }} onClick={() => setExpanded(isOpen ? null : m.id)}>
                <div>
                  <div style={{ color: m.hasArb ? "#b3ffcc" : "#3d7a55", fontWeight: m.hasArb ? 600 : 400, fontSize: 12, lineHeight: 1.35, marginBottom: 3 }}>
                    {m.hasArb && <span style={{ color: "#00ff64", marginRight: 5 }}>►</span>}
                    {m.question.length > 78 ? m.question.slice(0, 78) + "…" : m.question}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {m.hasArb && <span className="badge">ARB</span>}
                    <span style={{ fontSize: 9, color: "#1a6635" }}>LIQ {fmt$(m.liquidity)}</span>
                    <span style={{ fontSize: 9, color: "#1a6635" }}>VOL {fmt$(m.volume)}</span>
                  </div>
                </div>
                <div style={{ color: "#60d494" }}>{(m.yes * 100).toFixed(1)}¢</div>
                <div style={{ color: "#60d494" }}>{(m.no * 100).toFixed(1)}¢</div>
                <div style={{ color: m.sum < 0.98 ? "#00ff64" : "#3d7a55", fontWeight: m.sum < 0.98 ? 700 : 400 }}>{(m.sum * 100).toFixed(1)}¢</div>
                <div style={{ color: pc, fontWeight: 700 }}>{fmtPct(m.profitPct)}</div>
                <div style={{ color: m.hasArb ? "#00ff64" : "#1a6635" }}>{m.hasArb ? `+$${trade.profit.toFixed(2)}` : "—"}</div>
              </div>
              {isOpen && (
                <div className="expand">
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 20 }}>
                    <div>
                      <div style={{ fontSize: 9, color: "#1a6635", letterSpacing: 2, marginBottom: 8 }}>PRICE BREAKDOWN</div>
                      {[["YES price", `${(m.yes*100).toFixed(2)}¢`],["NO price", `${(m.no*100).toFixed(2)}¢`],["Combined cost", `${(m.sum*100).toFixed(2)}¢`],["After 2% fee", "98.00¢ payout"],["Net edge", fmtPct(m.profitPct)]].map(([k,v]) => (
                        <div className="kv" key={k}><span style={{ color: "#1a6635" }}>{k}</span><span style={{ color: "#b3ffcc", fontWeight: 600 }}>{v}</span></div>
                      ))}
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: "#1a6635", letterSpacing: 2, marginBottom: 8 }}>TRADE PLAN (${capital})</div>
                      {m.hasArb ? (
                        <>
                          {[["Buy YES worth", `$${trade.yesBet.toFixed(2)}`],["Buy NO worth", `$${trade.noBet.toFixed(2)}`],["Total in", `$${capital}`],["Guaranteed return", `$${trade.ret.toFixed(2)}`],["Guaranteed profit", `$${trade.profit.toFixed(2)}`]].map(([k,v]) => (
                            <div className="kv" key={k}><span style={{ color: "#1a6635" }}>{k}</span><span style={{ color: k.includes("profit") ? "#00ff64" : "#b3ffcc", fontWeight: 600 }}>{v}</span></div>
                          ))}
                          <a className="open-btn" href={`https://polymarket.com/event/${m.slug}`} target="_blank" rel="noopener noreferrer">OPEN ON POLYMARKET ↗</a>
                        </>
                      ) : (
                        <div style={{ color: "#1a6635", fontSize: 11 }}>No guaranteed profit after fees at this spread.</div>
                      )}
                    </div>
                  </div>
                  <div style={{ borderTop: "1px solid #0d2e1a", marginTop: 12, paddingTop: 8, fontSize: 10, color: "#1a6635" }}>
                    ⚠ Verify prices live on Polymarket before trading. Slippage and liquidity depth affect real execution.
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ borderTop: "1px solid #0d2e1a", padding: "9px 20px", display: "flex", justifyContent: "space-between", fontSize: 10, color: "#1a6635" }}>
        <span>SOURCE: {dataSource === "live" ? "POLYMARKET GAMMA API // LIVE" : "DEMO DATA"}</span>
        <span>NOT FINANCIAL ADVICE // DYOR</span>
      </div>
    </div>
  );
}
