// In-memory store for stable.bonds (demo backend — resets on restart).
const { TOKENOMICS, quoteBuy, quoteSell, round2, round4 } = require('./tokenomics');

const PEGS = ['fully-backed', 'yield-bearing', 'algorithmic'];
const RESERVES = ['USDC', 'USDT', 'DAI'];

const coins = new Map(); // ticker -> coin

function now() { return Date.now(); }

function makeHistory(points, drift) {
  // small random walk around $1.00 so charts have life; stables wiggle, they don't moon
  const hist = [];
  let p = 1.0 + (Math.random() - 0.5) * 0.002;
  const t0 = now() - points * 60 * 60 * 1000;
  for (let i = 0; i < points; i++) {
    p += (Math.random() - 0.5) * 0.0018 + drift / points;
    p = Math.min(1.012, Math.max(0.988, p));
    hist.push({ t: t0 + i * 60 * 60 * 1000, p: round4(p) });
  }
  return hist;
}

function lastPrice(coin) {
  return coin.history.length ? coin.history[coin.history.length - 1].p : 1.0;
}

function change24h(coin) {
  if (coin.history.length < 2) return 0;
  const a = coin.history[0].p;
  const b = lastPrice(coin);
  return round4(((b - a) / a) * 100);
}

function addCoin({ name, ticker, desc, peg, reserveAsset, creator, reserveUsd = 0, drift = 0, ageMs = 0, replies = 0 }) {
  const coin = {
    ticker,
    name,
    desc: desc || '',
    peg,
    reserveAsset,
    creator,
    createdAt: now() - ageMs,
    reserveUsd: round2(reserveUsd),          // USD held in the curve (backs the peg)
    circulating: round4(reserveUsd / TOKENOMICS.MINT_PRICE_USD),
    feesProtocol: 0,
    feesPegReserve: 0,
    graduated: reserveUsd >= TOKENOMICS.GRADUATION_USD,
    replies,
    trades: [],
    history: makeHistory(24, drift)
  };
  coins.set(ticker, coin);
  return coin;
}

function seedTrades(coin, rows) {
  for (const r of rows) {
    coin.trades.unshift({ who: r.who, side: r.side, usd: r.usd, tokens: round4(r.usd / 1.0), t: now() - r.agoMin * 60000 });
  }
}

function seed() {
  const s = [
    { name: 'Hat Dollar',      ticker: 'WIFUSD',  peg: 'yield-bearing', reserveAsset: 'USDC', creator: '4kDw…9je', reserveUsd: 87310, drift: 0.002,  ageMs: 1 * 3600e3,  replies: 342, desc: 'the hat stays on. the peg stays on.' },
    { name: 'Doge Dollar',     ticker: 'USDOGE',  peg: 'yield-bearing', reserveAsset: 'USDC', creator: '7xKq…3f1', reserveUsd: 41230, drift: 0.004,  ageMs: 2 * 3600e3,  replies: 128, desc: 'much stable. very dollar. wow.' },
    { name: 'Pepe Peso',       ticker: 'PEPUSD',  peg: 'fully-backed',  reserveAsset: 'USDT', creator: '9mTt…7aa', reserveUsd: 18940, drift: -0.002, ageMs: 5 * 3600e3,  replies: 64,  desc: 'feels good man. feels like a dollar.' },
    { name: 'Cat Buck',        ticker: 'CATBUCK', peg: 'algorithmic',   reserveAsset: 'USDC', creator: '2bNf…c04', reserveUsd: 6120,  drift: 0.001,  ageMs: 6 * 3600e3,  replies: 31,  desc: 'nine lives, one peg.' },
    { name: 'Moon Money',      ticker: 'MOONUSD', peg: 'fully-backed',  reserveAsset: 'DAI',  creator: 'Hq8s…1dd', reserveUsd: 12480, drift: -0.001, ageMs: 9 * 3600e3,  replies: 57,  desc: 'we are NOT going to the moon. we are staying at $1.' },
    { name: 'Giga Greenback',  ticker: 'GIGAUSD', peg: 'yield-bearing', reserveAsset: 'USDC', creator: 'Lm3v…8kp', reserveUsd: 33760, drift: 0.0015, ageMs: 12 * 3600e3, replies: 96,  desc: 'gigastable. gigabased. gigadollar.' },
    { name: 'Frog Franc',      ticker: 'FROGUSD', peg: 'fully-backed',  reserveAsset: 'USDC', creator: 'Qw7h…5tz', reserveUsd: 9870,  drift: 0.0005, ageMs: 14 * 3600e3, replies: 22,  desc: 'ribbit. redeemable.' },
    { name: 'Snail Scrip',     ticker: 'SNLUSD',  peg: 'algorithmic',   reserveAsset: 'USDT', creator: 'Zx1c…b7q', reserveUsd: 4310,  drift: -0.003, ageMs: 18 * 3600e3, replies: 14,  desc: 'slow money. stays put.' },
    { name: 'Rocket Ration',   ticker: 'RKTUSD',  peg: 'yield-bearing', reserveAsset: 'USDC', creator: 'Vb6n…e92', reserveUsd: 27540, drift: 0.002,  ageMs: 24 * 3600e3, replies: 88,  desc: 'fuel for the mission: one dollar at a time.' }
  ];
  for (const c of s) addCoin(c);
  seedTrades(coins.get('USDOGE'), [
    { who: 'Lm3v…8kp', side: 'BUY',  usd: 1000, agoMin: 15 },
    { who: 'Hq8s…1dd', side: 'SELL', usd: 18,   agoMin: 11 },
    { who: 'Pq9x…04r', side: 'BUY',  usd: 500,  agoMin: 7 },
    { who: 'Zx1c…b7q', side: 'SELL', usd: 32.5, agoMin: 3 },
    { who: 'Ady5…k2w', side: 'BUY',  usd: 50,   agoMin: 1 },
    { who: 'Jr2p…77m', side: 'BUY',  usd: 120,  agoMin: 0.2 }
  ]);
  seedTrades(coins.get('WIFUSD'), [
    { who: 'Jr2p…77m', side: 'BUY', usd: 2500, agoMin: 40 },
    { who: '4kDw…9je', side: 'BUY', usd: 300,  agoMin: 22 },
    { who: 'Pq9x…04r', side: 'BUY', usd: 980,  agoMin: 5 }
  ]);
}

function list() {
  return [...coins.values()].sort((a, b) => b.createdAt - a.createdAt);
}

function get(ticker) {
  return coins.get(String(ticker || '').toUpperCase());
}

function create({ name, ticker, desc, peg, reserveAsset, initialBuyUsd, creator }) {
  name = String(name || '').trim().slice(0, 40);
  ticker = String(ticker || '').trim().toUpperCase();
  desc = String(desc || '').trim().slice(0, 280);
  if (!name) throw httpErr(400, 'Name is required.');
  if (!/^[A-Z0-9]{3,10}$/.test(ticker)) throw httpErr(400, 'Ticker must be 3-10 letters/numbers.');
  if (coins.has(ticker)) throw httpErr(409, `Ticker ${ticker} is taken.`);
  if (!PEGS.includes(peg)) throw httpErr(400, 'Unknown peg mechanism.');
  if (!RESERVES.includes(reserveAsset)) throw httpErr(400, 'Unknown reserve asset.');
  const coin = addCoin({ name, ticker, desc, peg, reserveAsset, creator: creator || 'anon…dev', reserveUsd: 0, drift: 0, ageMs: 0, replies: 0 });
  coin.history = [{ t: now(), p: 1.0 }];
  const buy = Number(initialBuyUsd) || 0;
  if (buy > 0) trade(ticker, 'buy', buy, coin.creator);
  return coin;
}

function trade(ticker, side, usd, who) {
  const coin = get(ticker);
  if (!coin) throw httpErr(404, 'Coin not found.');
  if (coin.graduated) throw httpErr(400, 'Coin has graduated to LaunchLab — trade it in the pool.');
  usd = round2(Number(usd));
  if (!(usd > 0)) throw httpErr(400, 'Amount (USD) must be greater than zero.');
  if (usd > 1_000_000) throw httpErr(400, 'Demo cap: $1,000,000 per trade.');

  let result;
  if (side === 'buy') {
    const q = quoteBuy(usd);
    if (coin.circulating + q.tokens > TOKENOMICS.MAX_SUPPLY) throw httpErr(400, 'Max supply reached.');
    coin.reserveUsd = round2(coin.reserveUsd + q.net);
    coin.circulating = round4(coin.circulating + q.tokens);
    splitFee(coin, q.fee);
    result = { side: 'BUY', usd: q.usdIn, tokens: q.tokens, fee: q.fee, price: q.effectivePrice };
  } else if (side === 'sell') {
    const tokens = round4(usd / TOKENOMICS.MINT_PRICE_USD);
    const q = quoteSell(tokens);
    if (q.gross > coin.reserveUsd) throw httpErr(400, 'Not enough curve reserve for that sell.');
    coin.reserveUsd = round2(coin.reserveUsd - q.gross);
    coin.circulating = round4(Math.max(0, coin.circulating - q.tokens));
    splitFee(coin, q.fee);
    result = { side: 'SELL', usd: q.usdOut, tokens: q.tokens, fee: q.fee, price: q.effectivePrice };
  } else {
    throw httpErr(400, 'Side must be buy or sell.');
  }

  const drifted = round4(Math.min(1.012, Math.max(0.988, lastPrice(coin) + (side === 'buy' ? 1 : -1) * 0.0004 + (Math.random() - 0.5) * 0.0006)));
  coin.history.push({ t: now(), p: drifted });
  if (coin.history.length > 96) coin.history.shift();
  coin.trades.unshift({ who: who || 'you…demo', side: result.side, usd: result.usd, tokens: result.tokens, t: now() });
  coin.trades = coin.trades.slice(0, 50);

  if (coin.reserveUsd >= TOKENOMICS.GRADUATION_USD) coin.graduated = true;
  return { result, coin };
}

function splitFee(coin, fee) {
  coin.feesProtocol = round2(coin.feesProtocol + fee * TOKENOMICS.PROTOCOL_FEE_SHARE);
  coin.feesPegReserve = round2(coin.feesPegReserve + fee * TOKENOMICS.PEG_RESERVE_FEE_SHARE);
}

function holders(coin) {
  // synthetic holder split for the demo
  const curve = Math.max(0, 100 - Math.min(60, (coin.reserveUsd / TOKENOMICS.GRADUATION_USD) * 60) - 2);
  return [
    { who: 'bonding curve', pct: round2(curve) },
    { who: `${coin.creator} (dev)`, pct: 4.1 },
    { who: 'Jr2p…77m', pct: 3.3 },
    { who: 'Ady5…k2w', pct: 2.8 },
    { who: 'Pq9x…04r', pct: 2.2 }
  ];
}

function httpErr(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

seed();

module.exports = { list, get, create, trade, holders, lastPrice, change24h, PEGS, RESERVES };
