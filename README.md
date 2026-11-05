# stable.bonds

A pump.fun-style meme launchpad — **but for stablecoins**. Everything is priced and quoted in USD. Retro dark/blue terminal UI.

> Demo build: trades, swaps and launches are simulated against an in-memory backend (state resets on restart). No wallets, no chain, no real funds.

## Features

- **Board** — live grid of launched stables: USD price, market cap, peg type, graduation progress, King of the Peg.
- **Dedicated pegged token pages** — every coin gets its own page at `/coin/:TICKER` with a 24h USD chart around the $1 peg, buy/sell panel (USD in, USD out), trade tape, bonding-curve progress, peg & reserve stats, holders.
- **Launch** — deploy a new stable (name, ticker, peg mechanism, reserve asset, optional initial buy in USD). Its token page exists the moment it deploys.
- **Tokenomics** — one shared ruleset for every coin (see below).
- **StableSwap** — swap **any crypto → USDC, one way only**. USDC → crypto is rejected at the API level. The idea is to keep stables.

## Tokenomics

| Parameter | Value |
|---|---|
| Max supply | 1,000,000,000 (minted on-curve only) |
| Mint price | $1.00 flat (curve mints & redeems at the peg) |
| Buy fee | 1% |
| Sell fee | 1% (sell back to curve at $0.99 net) |
| Fee split | 50% protocol / 50% coin's peg-stability reserve |
| Deploy cost | $2.00 |
| Graduation | $100,000 raised → reserves migrate to a LaunchLab pool |
| Presale / team allocation | none |
| Backing | 1:1 in reserve asset (USDC / USDT / DAI) until graduation |

## Run locally

```bash
npm install
npm start
# http://localhost:3000
```

## API

- `GET /api/coins` — all coins (USD prices, mcap, graduation progress)
- `GET /api/coins/:ticker` — full coin detail (history, trades, holders)
- `POST /api/coins` — `{ name, ticker, desc, peg, reserveAsset, initialBuyUsd }`
- `POST /api/coins/:ticker/trade` — `{ side: "buy"|"sell", usd }`
- `POST /api/swap` — `{ fromAsset, amount }` → USDC only (anything else is rejected)
- `GET /api/swap/rates`, `GET /api/tokenomics`, `GET /healthz`

## Deploy (Render)

Web service: build `npm install`, start `node server.js` (or use `render.yaml`). Point the custom domain `stable.bonds` at the service in Render's dashboard once DNS is set.
