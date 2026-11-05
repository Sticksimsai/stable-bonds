// stable.bonds — a meme launchpad for stables. Everything priced and quoted in USD.
const express = require('express');
const path = require('path');
const store = require('./src/store');
const swap = require('./src/swap');
const { TOKENOMICS } = require('./src/tokenomics');
const pages = require('./src/html');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

/* ---------- pages ---------- */
app.get('/', (req, res) => {
  res.send(pages.boardPage({ q: req.query.q || '', sort: req.query.sort || 'new' }));
});

app.get('/coin/:ticker', (req, res) => {
  const coin = store.get(req.params.ticker);
  if (!coin) return res.status(404).send(pages.notFoundPage());
  res.send(pages.coinPage(coin));
});

app.get('/launch', (req, res) => res.send(pages.launchPage()));
app.get('/swap', (req, res) => res.send(pages.swapPage()));
app.get('/tokenomics', (req, res) => res.send(pages.tokenomicsPage()));

// non-JS fallback for the launch form
app.post('/launch', (req, res) => {
  try {
    const coin = store.create(req.body);
    res.redirect('/coin/' + encodeURIComponent(coin.ticker));
  } catch (e) {
    res.status(e.status || 500).send(pages.launchPage(e.message));
  }
});

/* ---------- API ---------- */
app.get('/api/tokenomics', (req, res) => res.json(TOKENOMICS));

app.get('/api/coins', (req, res) => {
  res.json(store.list().map((c) => ({
    ticker: c.ticker, name: c.name, peg: c.peg, reserveAsset: c.reserveAsset,
    creator: c.creator, createdAt: c.createdAt,
    priceUsd: store.lastPrice(c), change24hPct: store.change24h(c),
    marketCapUsd: c.reserveUsd, reserveUsd: c.reserveUsd,
    circulating: c.circulating, graduated: c.graduated,
    graduationUsd: TOKENOMICS.GRADUATION_USD,
    page: '/coin/' + c.ticker
  })));
});

app.get('/api/coins/:ticker', (req, res) => {
  const c = store.get(req.params.ticker);
  if (!c) return res.status(404).json({ error: 'Coin not found.' });
  res.json({
    ticker: c.ticker, name: c.name, desc: c.desc, peg: c.peg, reserveAsset: c.reserveAsset,
    creator: c.creator, createdAt: c.createdAt,
    priceUsd: store.lastPrice(c), change24hPct: store.change24h(c),
    marketCapUsd: c.reserveUsd, reserveUsd: c.reserveUsd, circulating: c.circulating,
    feesPegReserve: c.feesPegReserve, graduated: c.graduated,
    graduationUsd: TOKENOMICS.GRADUATION_USD,
    history: c.history, trades: c.trades, holders: store.holders(c)
  });
});

app.post('/api/coins', (req, res) => {
  try {
    const coin = store.create(req.body);
    res.status(201).json({ ok: true, ticker: coin.ticker, page: '/coin/' + coin.ticker });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

app.post('/api/coins/:ticker/trade', (req, res) => {
  try {
    const { result, coin } = store.trade(req.params.ticker, req.body.side, req.body.usd, 'you…demo');
    res.json({ ok: true, result, reserveUsd: coin.reserveUsd, graduated: coin.graduated });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

// One-way by design: the API itself refuses anything but crypto -> USDC.
app.post('/api/swap', (req, res) => {
  try {
    if (req.body.toAsset && String(req.body.toAsset).toUpperCase() !== 'USDC') {
      return res.status(400).json({ error: 'Output is USDC. Always USDC. Only USDC.' });
    }
    const q = swap.quote(req.body.fromAsset, req.body.amount);
    res.json({ ok: true, ...q });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

app.get('/api/swap/rates', (req, res) => res.json({ rates: swap.RATES_USD, feePct: swap.SWAP_FEE * 100, out: 'USDC', oneWay: true }));

app.get('/healthz', (req, res) => res.json({ ok: true }));

app.use((req, res) => res.status(404).send(pages.notFoundPage()));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`stable.bonds listening on :${PORT}`));
