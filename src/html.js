// Server-rendered pages for stable.bonds
const { TOKENOMICS } = require('./tokenomics');
const store = require('./store');
const swap = require('./swap');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const fmtUsd = (n, dp = 2) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
const fmtNum = (n) => Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
const fmtPrice = (p) => '$' + Number(p).toFixed(4);

const TILE_COLORS = ['#38bdf8', '#f59e0b', '#4ade80', '#a78bfa', '#60a5fa', '#f472b6', '#34d399', '#fb923c', '#22d3ee', '#facc15'];
function tileColor(ticker) {
  let h = 0;
  for (const ch of ticker) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return TILE_COLORS[h % TILE_COLORS.length];
}
function initials(coin) {
  const words = coin.name.split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] || coin.ticker[0]) + (words[1]?.[0] || coin.ticker[1] || '')).toUpperCase();
}
function ago(t) {
  const s = Math.max(1, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return s + 's';
  const m = Math.floor(s / 60);
  if (m < 60) return m + 'm';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h';
  return Math.floor(h / 24) + 'd';
}
function deltaSpan(pct) {
  const cls = pct >= 0 ? 'up' : 'down';
  const sign = pct >= 0 ? '+' : '';
  return `<span class="${cls}">${sign}${pct.toFixed(2)}%</span>`;
}

function chartSvg(history, ticker) {
  if (!history.length) return '';
  const w = 640, h = 200, pMin = 0.985, pMax = 1.015;
  const x = (i) => (i / Math.max(1, history.length - 1)) * w;
  const y = (p) => h - ((p - pMin) / (pMax - pMin)) * h;
  const pts = history.map((d, i) => `${x(i).toFixed(1)},${y(d.p).toFixed(1)}`).join(' ');
  const area = `0,${y(history[0].p).toFixed(1)} ${pts} ${w},${h} 0,${h}`;
  return `
  <svg role="img" aria-label="${esc(ticker)} price over the last 24 hours, trading in a narrow band around one dollar" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="display:block;width:100%;height:200px">
    <line x1="0" y1="${y(1.01)}" x2="${w}" y2="${y(1.01)}" stroke="#121c33" stroke-width="1"></line>
    <line x1="0" y1="${y(1.0)}" x2="${w}" y2="${y(1.0)}" stroke="#1c2a4a" stroke-width="1" stroke-dasharray="6 5"></line>
    <line x1="0" y1="${y(0.99)}" x2="${w}" y2="${y(0.99)}" stroke="#121c33" stroke-width="1"></line>
    <polygon points="${area}" fill="rgba(73,183,255,0.12)"></polygon>
    <polyline points="${pts}" fill="none" stroke="#49b7ff" stroke-width="3" vector-effect="non-scaling-stroke"></polyline>
  </svg>
  <div style="display:flex;justify-content:space-between;margin-top:8px" class="vt ghost" aria-hidden="true">
    <span>$0.99</span><span>peg $1.00</span><span>$1.01</span>
  </div>`;
}

function layout({ title, active = '', flash = '' }, body) {
  const coinsForTicker = store.list().slice(0, 6);
  const ticker = coinsForTicker.map((c) => {
    const p = store.lastPrice(c);
    return `${esc(c.ticker)} ${fmtPrice(p)} ${deltaSpan(store.change24h(c))}`;
  }).join(' &nbsp;//&nbsp; ');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · stable.bonds</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&family=IBM+Plex+Mono:wght@400;500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/style.css">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect width='16' height='16' fill='%2349b7ff'/%3E%3Ctext x='8' y='12' font-size='11' text-anchor='middle' fill='%2304101f' font-family='monospace'%3E%24%3C/text%3E%3C/svg%3E">
</head>
<body>
<div class="tickerbar" aria-hidden="true">${ticker}</div>
<header class="site">
  <a class="logo" href="/">
    <span class="logo-mark">$</span>
    <span class="logo-text">STABLE<em>.BONDS</em></span>
  </a>
  <nav class="site">
    <a href="/" class="${active === 'board' ? 'active' : ''}">Board</a>
    <a href="/launch" class="${active === 'launch' ? 'active' : ''}">Launch</a>
    <a href="/swap" class="${active === 'swap' ? 'active' : ''}">StableSwap</a>
    <a href="/tokenomics" class="${active === 'tokenomics' ? 'active' : ''}">Tokenomics</a>
  </nav>
  <div class="header-right">
    <button class="btn" type="button" onclick="alert('Demo build — wallets land with the on-chain release.')">Connect wallet</button>
  </div>
</header>
${flash}
${body}
<footer class="site">
  <p class="ps">STABLE.BONDS · A MEME LAUNCHPAD FOR STABLES</p>
  <p style="margin:0">USD bonding curve · graduates to LaunchLab at ${fmtUsd(TOKENOMICS.GRADUATION_USD, 0)} · demo build, simulated trades, nothing here is financial advice</p>
</footer>
<script src="/app.js"></script>
</body>
</html>`;
}

/* ---------------- board ---------------- */

function boardPage({ q = '', sort = 'new' } = {}) {
  let coins = store.list();
  const query = q.trim().toUpperCase();
  if (query) coins = coins.filter((c) => c.ticker.includes(query) || c.name.toUpperCase().includes(query));
  if (sort === 'mcap') coins = [...coins].sort((a, b) => b.reserveUsd - a.reserveUsd);
  if (sort === 'grad') coins = [...coins].filter((c) => !c.graduated).sort((a, b) => b.reserveUsd - a.reserveUsd);
  const king = [...store.list()].filter((c) => !c.graduated).sort((a, b) => b.reserveUsd - a.reserveUsd)[0];

  const cards = coins.map((c) => {
    const pct = Math.round((Math.min(1, c.reserveUsd / TOKENOMICS.GRADUATION_USD)) * 100);
    return `
    <a class="coin-card" href="/coin/${esc(c.ticker)}">
      <span style="display:flex;gap:12px;align-items:center">
        <span class="tile" style="background:${tileColor(c.ticker)}">${esc(initials(c))}</span>
        <span style="min-width:0">
          <span style="display:block;font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.name)} <span class="muted" style="font-weight:400">· ${esc(c.ticker)}</span></span>
          <span class="small faint" style="display:block;margin-top:2px">by ${esc(c.creator)} · ${ago(c.createdAt)} ago</span>
        </span>
      </span>
      <span style="display:flex;justify-content:space-between;align-items:baseline">
        <span class="mono-num" style="font-size:26px">${fmtPrice(store.lastPrice(c))}</span>
        <span class="small" style="font-weight:700">${deltaSpan(store.change24h(c))}</span>
      </span>
      <span>
        <span class="small muted" style="display:flex;justify-content:space-between;margin-bottom:5px"><span>mkt cap ${fmtUsd(c.reserveUsd, 0)}</span><span>${c.graduated ? 'GRADUATED' : pct + '% to grad'}</span></span>
        <span class="bar" style="height:10px"><span style="width:${pct}%"></span></span>
      </span>
      <span style="display:flex;justify-content:space-between;align-items:center" class="small faint">
        <span class="tag">${esc(c.peg)}</span>
        <span>${c.replies} replies</span>
      </span>
    </a>`;
  }).join('');

  const kingHtml = king ? `
  <section class="wrap" style="padding-bottom:28px">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 18h18M4 17l1-9 5 4 2-7 2 7 5-4 1 9" stroke="#facc15" stroke-width="2" stroke-linejoin="round"></path></svg>
      <h2 style="margin:0;font-family:'Press Start 2P',monospace;font-size:12px;color:#facc15;text-transform:uppercase">King of the peg</h2>
    </div>
    <a href="/coin/${esc(king.ticker)}" style="display:flex;flex-wrap:wrap;gap:20px;align-items:center;background:var(--panel);border:2px solid var(--gold);box-shadow:6px 6px 0 var(--shadow);padding:20px;color:var(--ink)">
      <span class="tile tile-lg" style="background:${tileColor(king.ticker)}">${esc(initials(king))}</span>
      <span style="flex:1 1 260px;min-width:0">
        <span style="display:block;font-size:16px;font-weight:700">${esc(king.name)} <span class="muted" style="font-weight:400">· ${esc(king.ticker)}</span></span>
        <span class="small faint" style="display:block;margin-top:4px">created by ${esc(king.creator)} · ${ago(king.createdAt)} ago · ${esc(king.peg)} peg</span>
      </span>
      <span style="flex:1 1 220px;min-width:180px">
        <span class="small muted" style="display:flex;justify-content:space-between;margin-bottom:6px"><span>Curve progress</span><span style="color:var(--gold);font-weight:700">${fmtUsd(king.reserveUsd, 0)} / ${fmtUsd(TOKENOMICS.GRADUATION_USD, 0)}</span></span>
        <span class="bar gold" style="display:block;height:14px"><span style="width:${Math.round((king.reserveUsd / TOKENOMICS.GRADUATION_USD) * 100)}%"></span></span>
      </span>
      <span style="text-align:right">
        <span class="mono-num" style="display:block;font-size:34px">${fmtPrice(store.lastPrice(king))}</span>
        <span class="small" style="display:block">${deltaSpan(store.change24h(king))} / 24h</span>
      </span>
    </a>
  </section>` : '';

  return layout({ title: 'Board', active: 'board' }, `
  <section class="wrap" style="padding:48px 24px 32px;display:flex;flex-wrap:wrap;gap:32px;align-items:flex-end">
    <div style="flex:1 1 520px;min-width:0">
      <h1 class="display" style="font-size:64px">Launch a stable.<br><span style="color:var(--accent)">Everything in USD.</span><span class="cursor"></span></h1>
      <p class="muted" style="margin:12px 0 0;max-width:560px;font-size:14px;line-height:1.7">Fair-launch a meme stablecoin on a USD bonding curve. No presale, no team allocation. Every coin is priced and quoted in dollars, has its own pegged token page, and graduates to a LaunchLab pool at a <strong style="color:var(--ink)">${fmtUsd(TOKENOMICS.GRADUATION_USD, 0)} market cap</strong>.</p>
    </div>
    <div style="flex:0 1 320px;display:flex;flex-direction:column;gap:12px">
      <a href="/launch" class="btn btn-green btn-big" style="box-shadow:5px 5px 0 var(--shadow),5px 5px 0 2px var(--line)">+ New stable</a>
      <p class="small faint" style="margin:0;text-align:center">Deploy cost ${fmtUsd(TOKENOMICS.DEPLOY_COST_USD)} · 1% trade fee · peg your way</p>
    </div>
  </section>
  ${kingHtml}
  <section class="wrap" style="padding-bottom:20px;display:flex;flex-wrap:wrap;gap:12px;align-items:center">
    <form method="GET" action="/" style="flex:1 1 260px;display:flex;align-items:center;gap:8px;background:var(--panel);border:2px solid var(--line);padding:10px 12px">
      <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5" stroke="#7e92b8" stroke-width="2"></circle><path d="M11 11l3.5 3.5" stroke="#7e92b8" stroke-width="2"></path></svg>
      <label for="q" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">Search stables</label>
      <input id="q" name="q" type="text" value="${esc(q)}" placeholder="search ticker or name" style="flex:1;min-width:0;background:transparent;border:0;outline:none;color:var(--ink);font-family:'IBM Plex Mono',monospace;font-size:13px">
    </form>
    <div class="chip-row" style="font-size:12px;text-transform:uppercase;letter-spacing:1px">
      <a class="btn ${sort === 'new' ? '' : 'btn-ghost'}" style="padding:9px 14px;font-size:12px;box-shadow:none" href="/?sort=new">Newest</a>
      <a class="btn ${sort === 'mcap' ? '' : 'btn-ghost'}" style="padding:9px 14px;font-size:12px;box-shadow:none" href="/?sort=mcap">Market cap</a>
      <a class="btn ${sort === 'grad' ? '' : 'btn-ghost'}" style="padding:9px 14px;font-size:12px;box-shadow:none" href="/?sort=grad">About to graduate</a>
    </div>
  </section>
  <section class="wrap" style="padding-bottom:24px">
    <div class="grid">${cards || '<p class="muted">No stables match. Launch one?</p>'}</div>
  </section>`);
}

/* ---------------- coin page ---------------- */

function coinPage(coin, flash = '') {
  const pct = Math.round(Math.min(1, coin.reserveUsd / TOKENOMICS.GRADUATION_USD) * 100);
  const price = store.lastPrice(coin);
  const trades = coin.trades.map((t) => `
    <tr>
      <td class="muted">${esc(t.who)}</td>
      <td style="font-weight:700" class="${t.side === 'BUY' ? 'up' : 'down'}">${t.side}</td>
      <td class="num">${fmtUsd(t.usd)}</td>
      <td class="num muted">${fmtNum(t.tokens)}</td>
      <td class="num faint">${ago(t.t)}</td>
    </tr>`).join('');
  const holders = store.holders(coin).map((h, i) => `
    <li style="display:flex;justify-content:space-between"><span class="muted">${i + 1}. ${esc(h.who)}</span><span>${h.pct}%</span></li>`).join('');

  return layout({ title: `${coin.ticker} — ${coin.name}`, active: 'board', flash }, `
  <main class="wrap" style="padding-top:24px;display:flex;flex-wrap:wrap;gap:24px;align-items:flex-start">
    <section style="flex:999 1 560px;min-width:0;display:flex;flex-direction:column;gap:20px">
      <a href="/" class="small muted" style="text-transform:uppercase;letter-spacing:1px">&lt; back to board</a>
      <div style="display:flex;flex-wrap:wrap;gap:16px;align-items:center">
        <span class="tile tile-lg" style="background:${tileColor(coin.ticker)}">${esc(initials(coin))}</span>
        <div style="flex:1 1 240px;min-width:0">
          <h1 style="margin:0;font-size:20px;font-weight:700">${esc(coin.name)} <span class="muted" style="font-weight:400">· ${esc(coin.ticker)}</span></h1>
          <p class="small faint" style="margin:4px 0 0">created by ${esc(coin.creator)} · ${ago(coin.createdAt)} ago · <span class="tag">${esc(coin.peg)}</span> <span class="tag">${esc(coin.reserveAsset)} reserve</span>${coin.graduated ? ' <span class="tag" style="color:var(--gold);border-color:var(--gold)">GRADUATED</span>' : ''}</p>
          ${coin.desc ? `<p class="small muted" style="margin:8px 0 0;max-width:520px">${esc(coin.desc)}</p>` : ''}
        </div>
        <div style="text-align:right">
          <p class="mono-num" style="margin:0;font-size:44px;line-height:1">${fmtPrice(price)}</p>
          <p class="small" style="margin:4px 0 0">${deltaSpan(store.change24h(coin))} / 24h · <span class="muted">peg target $1.0000</span></p>
        </div>
      </div>

      <div class="panel">
        <div class="small faint" style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px;margin-bottom:10px;text-transform:uppercase;letter-spacing:1px">
          <span>${esc(coin.ticker)} / USD · 24h</span>
          <span>circulating ${fmtNum(coin.circulating)} ${esc(coin.ticker)}</span>
        </div>
        ${chartSvg(coin.history, coin.ticker)}
      </div>

      <div class="panel" style="padding:0">
        <div style="display:flex;border-bottom:2px solid var(--line);font-size:12px;text-transform:uppercase;letter-spacing:1px">
          <span style="background:#121c33;color:var(--ink-bright);font-weight:700;border-right:2px solid var(--line);padding:12px 18px">Trades</span>
          <span class="faint" style="border-right:2px solid var(--line);padding:12px 18px">Thread (${coin.replies})</span>
        </div>
        <div class="scroll-x">
          <table class="retro">
            <thead><tr><th>Account</th><th>Side</th><th class="num">USD</th><th class="num">${esc(coin.ticker)}</th><th class="num">Time</th></tr></thead>
            <tbody>${trades || '<tr><td colspan="5" class="muted" style="padding:16px">No trades yet — be first on the curve.</td></tr>'}</tbody>
          </table>
        </div>
      </div>
    </section>

    <aside style="flex:1 1 320px;min-width:280px;display:flex;flex-direction:column;gap:20px">
      <div class="panel" style="box-shadow:6px 6px 0 var(--shadow)" id="trade-panel" data-ticker="${esc(coin.ticker)}" ${coin.graduated ? 'data-graduated="1"' : ''}>
        <div style="display:flex;gap:8px;margin-bottom:14px">
          <button type="button" class="btn btn-green" data-side="buy" style="flex:1;box-shadow:none">Buy</button>
          <button type="button" class="btn btn-ghost" data-side="sell" style="flex:1">Sell</button>
        </div>
        <label class="field" for="usd-amount">Amount (USD)</label>
        <div class="amount-box" style="margin-bottom:10px">
          <span class="sym">$</span>
          <input id="usd-amount" type="text" inputmode="decimal" value="50.00">
          <span class="small faint">USD</span>
        </div>
        <div class="chip-row" style="margin-bottom:14px">
          <button type="button" class="btn btn-ghost" data-amt="10">$10</button>
          <button type="button" class="btn btn-ghost" data-amt="50">$50</button>
          <button type="button" class="btn btn-ghost" data-amt="100">$100</button>
          <button type="button" class="btn btn-ghost" data-amt="1000">$1k</button>
        </div>
        <div class="small muted" style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px">
          <span style="display:flex;justify-content:space-between"><span id="recv-label">You receive (est.)</span><span style="color:var(--ink-bright)" id="recv-value">~49.50 ${esc(coin.ticker)}</span></span>
          <span style="display:flex;justify-content:space-between"><span>Fee (1%)</span><span style="color:var(--ink-bright)" id="fee-value">$0.50</span></span>
          <span style="display:flex;justify-content:space-between"><span>Curve price</span><span style="color:var(--ink-bright)">$1.0000 flat</span></span>
        </div>
        <button type="button" class="btn btn-green btn-block" id="trade-btn" ${coin.graduated ? 'disabled' : ''}>${coin.graduated ? 'Graduated — trade on LaunchLab' : 'Place buy — $50.00'}</button>
        <p class="notice" style="margin:10px 0 0;text-align:center">quoted vs ${esc(coin.reserveAsset)} · settles on-curve until graduation · simulated</p>
        <div id="trade-msg"></div>
      </div>

      <div class="panel">
        <h2 class="panel-title">Bonding curve</h2>
        <div class="small muted" style="display:flex;justify-content:space-between;margin-bottom:6px">
          <span>${fmtUsd(coin.reserveUsd, 0)} raised</span><span style="color:var(--accent);font-weight:700">${pct}%</span>
        </div>
        <div class="bar" style="height:14px;margin-bottom:10px"><span style="width:${pct}%"></span></div>
        <p class="small faint" style="margin:0;line-height:1.6">${coin.graduated
          ? `Graduated. Curve reserves migrated to a <strong style="color:var(--ink)">LaunchLab</strong> ${esc(coin.reserveAsset)} pool.`
          : `At <strong style="color:var(--ink)">${fmtUsd(TOKENOMICS.GRADUATION_USD, 0)}</strong> market cap, liquidity migrates to a <strong style="color:var(--ink)">LaunchLab</strong> ${esc(coin.reserveAsset)} pool and the curve closes. <strong style="color:var(--ink)">${fmtUsd(Math.max(0, TOKENOMICS.GRADUATION_USD - coin.reserveUsd), 0)}</strong> to go.`}</p>
      </div>

      <div class="panel">
        <h2 class="panel-title">Peg &amp; reserves</h2>
        <ul class="small" style="margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:8px">
          <li style="display:flex;justify-content:space-between"><span class="muted">Peg mechanism</span><span>${esc(coin.peg)}</span></li>
          <li style="display:flex;justify-content:space-between"><span class="muted">Reserve asset</span><span>${esc(coin.reserveAsset)}</span></li>
          <li style="display:flex;justify-content:space-between"><span class="muted">Curve reserve</span><span>${fmtUsd(coin.reserveUsd)}</span></li>
          <li style="display:flex;justify-content:space-between"><span class="muted">Peg-stability reserve</span><span>${fmtUsd(coin.feesPegReserve)}</span></li>
          <li style="display:flex;justify-content:space-between"><span class="muted">Backing ratio</span><span>${coin.circulating > 0 ? Math.round((coin.reserveUsd / coin.circulating) * 100) : 100}%</span></li>
        </ul>
      </div>

      <div class="panel">
        <h2 class="panel-title">Top holders</h2>
        <ul class="small" style="margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:8px">${holders}</ul>
      </div>
    </aside>
  </main>`);
}

/* ---------------- launch ---------------- */

function launchPage(err = '') {
  const flash = err ? `<div class="wrap" style="padding-top:20px"><div class="flash err">${esc(err)}</div></div>` : '';
  return layout({ title: 'Launch a stable', active: 'launch', flash }, `
  <main class="wrap" style="padding:40px 24px 16px;display:flex;flex-wrap:wrap;gap:32px;align-items:flex-start">
    <section style="flex:999 1 520px;min-width:0">
      <a href="/" class="small muted" style="text-transform:uppercase;letter-spacing:1px">&lt; back to board</a>
      <h1 class="display" style="margin:14px 0 6px;font-size:52px">New stable<span class="cursor"></span></h1>
      <p class="small muted" style="margin:0 0 28px">Fair launch on a USD bonding curve. Fixed supply of ${fmtNum(TOKENOMICS.MAX_SUPPLY)} tokens, all sold on-curve at $1.00. Your coin gets its own pegged token page the second it deploys.</p>
      <form id="launch-form" method="POST" action="/launch" style="display:flex;flex-direction:column;gap:18px">
        <div style="display:flex;flex-wrap:wrap;gap:18px">
          <div style="flex:2 1 260px;min-width:0">
            <label class="field" for="name">Name</label>
            <input class="field" id="name" name="name" type="text" maxlength="40" required placeholder="e.g. Hamster Dollar">
          </div>
          <div style="flex:1 1 160px;min-width:0">
            <label class="field" for="ticker">Ticker</label>
            <input class="field" id="ticker" name="ticker" type="text" maxlength="10" required placeholder="HAMUSD" style="text-transform:uppercase">
          </div>
        </div>
        <div>
          <label class="field" for="desc">Description</label>
          <textarea class="field" id="desc" name="desc" rows="3" maxlength="280" placeholder="what is your stable about?"></textarea>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:18px">
          <div style="flex:1 1 220px;min-width:0">
            <label class="field" for="peg">Peg mechanism</label>
            <select class="field" id="peg" name="peg">
              <option value="fully-backed">Fully backed (1:1 reserve)</option>
              <option value="yield-bearing">Yield-bearing (reserve earns)</option>
              <option value="algorithmic">Algorithmic (degen mode)</option>
            </select>
          </div>
          <div style="flex:1 1 220px;min-width:0">
            <label class="field" for="reserveAsset">Reserve asset</label>
            <select class="field" id="reserveAsset" name="reserveAsset">
              <option>USDC</option><option>USDT</option><option>DAI</option>
            </select>
          </div>
          <div style="flex:1 1 220px;min-width:0">
            <label class="field" for="initialBuyUsd">Initial buy (USD, optional)</label>
            <input class="field" id="initialBuyUsd" name="initialBuyUsd" type="text" inputmode="decimal" placeholder="$0.00">
          </div>
        </div>
        <button type="submit" class="btn btn-green btn-big" style="margin-top:8px;box-shadow:5px 5px 0 var(--shadow),5px 5px 0 2px var(--line)">Launch stable — ${fmtUsd(TOKENOMICS.DEPLOY_COST_USD)}</button>
        <p class="notice" style="margin:0">By launching you agree the token is a meme and your peg is your problem.</p>
      </form>
    </section>
    <aside style="flex:1 1 300px;min-width:260px" class="panel">
      <h2 class="panel-title">How it works</h2>
      <ol class="small muted" style="margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:14px;line-height:1.6">
        <li style="display:flex;gap:12px"><span class="tile" style="width:24px;height:24px;font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:700;background:var(--accent)">1</span><span>Pick a name, ticker and peg mechanism. Supply is fixed at 1B.</span></li>
        <li style="display:flex;gap:12px"><span class="tile" style="width:24px;height:24px;font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:700;background:var(--accent)">2</span><span>Trading opens on a flat $1.00 bonding curve — priced and quoted in dollars against your reserve asset.</span></li>
        <li style="display:flex;gap:12px"><span class="tile" style="width:24px;height:24px;font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:700;background:var(--accent)">3</span><span>At <strong style="color:var(--ink)">${fmtUsd(TOKENOMICS.GRADUATION_USD, 0)}</strong> raised the coin graduates: reserves migrate to a LaunchLab pool.</span></li>
        <li style="display:flex;gap:12px"><span class="tile" style="width:24px;height:24px;font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:700;background:var(--accent)">4</span><span>No presale, no team allocation. Dev buys on the same curve as everyone else.</span></li>
      </ol>
      <div class="small muted" style="margin-top:18px;border-top:1px solid var(--line);padding-top:14px;display:flex;flex-direction:column;gap:6px">
        <span style="display:flex;justify-content:space-between"><span>Deploy cost</span><span style="color:var(--ink-bright)">${fmtUsd(TOKENOMICS.DEPLOY_COST_USD)}</span></span>
        <span style="display:flex;justify-content:space-between"><span>Trade fee</span><span style="color:var(--ink-bright)">1%</span></span>
        <span style="display:flex;justify-content:space-between"><span>Graduation</span><span style="color:var(--ink-bright)">${fmtUsd(TOKENOMICS.GRADUATION_USD, 0)}</span></span>
      </div>
    </aside>
  </main>`);
}

/* ---------------- swap ---------------- */

function swapPage() {
  const options = swap.assets().map((a) => `<option value="${a}">${a} — ${fmtUsd(swap.RATES_USD[a], swap.RATES_USD[a] < 1 ? 4 : 2)}</option>`).join('');
  return layout({ title: 'StableSwap', active: 'swap' }, `
  <main class="wrap" style="padding:40px 24px 16px;display:flex;flex-wrap:wrap;gap:32px;align-items:flex-start">
    <section style="flex:999 1 480px;min-width:0;max-width:620px">
      <h1 class="display" style="font-size:52px">StableSwap<span class="cursor"></span></h1>
      <p class="small muted" style="margin:12px 0 24px;line-height:1.7">Swap <strong style="color:var(--ink)">any crypto into USDC</strong>. There is no reverse direction — value flows into stables and stays there. That's the whole idea.</p>

      <div class="panel" style="box-shadow:6px 6px 0 var(--shadow)" id="swap-panel" data-rates='${esc(JSON.stringify(swap.RATES_USD))}' data-fee="${swap.SWAP_FEE}">
        <label class="field" for="swap-from">You pay</label>
        <div style="display:flex;gap:10px;margin-bottom:14px">
          <select class="field" id="swap-from" style="flex:0 0 190px">${options}</select>
          <div class="amount-box" style="flex:1;min-width:0">
            <input id="swap-amount" type="text" inputmode="decimal" value="1" aria-label="Amount to swap">
          </div>
        </div>

        <div style="display:flex;align-items:center;gap:10px;margin:4px 0 14px" aria-hidden="true">
          <span style="flex:1;height:2px;background:var(--line)"></span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 4v14M6 12l6 6 6-6" stroke="#49b7ff" stroke-width="2.5" stroke-linejoin="round"></path></svg>
          <span class="small ghost" style="text-transform:uppercase;letter-spacing:1px">one way only</span>
          <span style="flex:1;height:2px;background:var(--line)"></span>
        </div>

        <label class="field" for="swap-out">You receive (always USDC)</label>
        <div class="amount-box" style="margin-bottom:12px;border-color:#1f3a2a">
          <span class="sym" style="color:var(--green)">$</span>
          <input id="swap-out" type="text" value="" readonly aria-label="USDC you receive">
          <span class="small" style="color:var(--green);font-weight:700">USDC</span>
        </div>

        <div class="small muted" style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px">
          <span style="display:flex;justify-content:space-between"><span>Rate</span><span style="color:var(--ink-bright)" id="swap-rate">—</span></span>
          <span style="display:flex;justify-content:space-between"><span>Fee (0.3%)</span><span style="color:var(--ink-bright)" id="swap-fee">—</span></span>
          <span style="display:flex;justify-content:space-between"><span>Swap back to crypto?</span><span class="down" style="font-weight:700">NO. NEVER.</span></span>
        </div>
        <button type="button" class="btn btn-green btn-block" id="swap-btn">Swap to USDC</button>
        <p class="notice" style="margin:10px 0 0;text-align:center">demo rates, simulated execution · exits are via your own wallet, not this venue</p>
        <div id="swap-msg"></div>
      </div>
    </section>

    <aside style="flex:1 1 300px;min-width:260px" class="panel">
      <h2 class="panel-title">Why one-way?</h2>
      <p class="small muted" style="margin:0 0 12px;line-height:1.7">Every launchpad leaks value back into volatile coins. stable.bonds is a roach motel for dollars: crypto checks in, USDC checks out, and the USDC feeds the bonding curves that back every stable on the board.</p>
      <ul class="small muted" style="margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:10px;line-height:1.6">
        <li>→ Any listed crypto swaps to USDC at the quoted rate.</li>
        <li>→ USDC → crypto is rejected at the API level, not just hidden in the UI.</li>
        <li>→ 0.3% swap fee goes to the protocol peg-insurance fund.</li>
      </ul>
    </aside>
  </main>`);
}

/* ---------------- tokenomics ---------------- */

function tokenomicsPage() {
  const T = TOKENOMICS;
  const row = (k, v, note = '') => `
    <tr><td class="muted">${k}</td><td style="color:var(--ink-bright);font-weight:700">${v}</td><td class="faint">${note}</td></tr>`;
  return layout({ title: 'Tokenomics', active: 'tokenomics' }, `
  <main class="wrap" style="padding:40px 24px 16px;max-width:980px">
    <h1 class="display" style="font-size:52px">Tokenomics<span class="cursor"></span></h1>
    <p class="small muted" style="margin:12px 0 24px;max-width:640px;line-height:1.7">Every stable launched on stable.bonds runs the same rules. No exceptions, no presales, no team bags. These are stablecoins: the curve is flat at $1.00 and the fun is in the memes, the fees and the race to graduation.</p>

    <div class="panel" style="padding:0;margin-bottom:24px">
      <div class="scroll-x">
        <table class="retro">
          <thead><tr><th>Parameter</th><th>Value</th><th>Notes</th></tr></thead>
          <tbody>
            ${row('Max supply', fmtNum(T.MAX_SUPPLY) + ' tokens', 'fixed; minted on-curve only')}
            ${row('Mint price', '$1.00 flat', 'the curve mints and redeems at exactly one dollar')}
            ${row('Buy fee', (T.BUY_FEE * 100) + '%', 'paid in USD on every curve buy')}
            ${row('Sell fee', (T.SELL_FEE * 100) + '%', 'sell back to the curve at $0.99 net')}
            ${row('Fee split', '50 / 50', '50% protocol · 50% to the coin&#39;s peg-stability reserve')}
            ${row('Deploy cost', fmtUsd(T.DEPLOY_COST_USD), 'one-time, paid by the creator')}
            ${row('Graduation', fmtUsd(T.GRADUATION_USD, 0) + ' raised', 'reserves + remaining supply migrate to a LaunchLab pool')}
            ${row('Presale', 'NONE', 'dev buys on the same curve as everyone else')}
            ${row('Team allocation', 'NONE', 'zero. zip. zilch.')}
            ${row('Backing', '1:1 in reserve asset', 'USDC / USDT / DAI held by the curve until graduation')}
          </tbody>
        </table>
      </div>
    </div>

    <div style="display:flex;flex-wrap:wrap;gap:20px">
      <div class="panel" style="flex:1 1 280px">
        <h2 class="panel-title">The curve</h2>
        <p class="small muted" style="margin:0;line-height:1.7">Buys mint tokens at $1.00; the net USD sits in the curve as reserve. Sells redeem at $1.00 minus the 1% exit fee. Market price floats in a tight band around the peg because arbitrage against the curve is always open — until graduation closes it.</p>
      </div>
      <div class="panel" style="flex:1 1 280px">
        <h2 class="panel-title">Graduation</h2>
        <p class="small muted" style="margin:0;line-height:1.7">When a coin&#39;s curve reserve hits ${fmtUsd(T.GRADUATION_USD, 0)}, it graduates: the USD reserve and remaining supply migrate into a LaunchLab pool against the coin&#39;s reserve asset, and secondary trading takes over. The peg-stability reserve stays with the coin as de-peg insurance.</p>
      </div>
      <div class="panel" style="flex:1 1 280px">
        <h2 class="panel-title">StableSwap flywheel</h2>
        <p class="small muted" style="margin:0;line-height:1.7">The one-way swap turns any crypto into USDC (never back). Swap fees feed the protocol peg-insurance fund, and the USDC it mints is what buys on the curves. Value flows in; it does not flow back out into volatility.</p>
      </div>
    </div>
  </main>`);
}

function notFoundPage() {
  return layout({ title: '404' }, `
  <main class="wrap" style="padding:64px 24px;text-align:center">
    <h1 class="display" style="font-size:72px">404<span class="cursor"></span></h1>
    <p class="muted">That page de-pegged. <a href="/">Back to the board</a>.</p>
  </main>`);
}

module.exports = { boardPage, coinPage, launchPage, swapPage, tokenomicsPage, notFoundPage };
