// stable.bonds — tokenomics
// Every coin launches on a flat USD bonding curve pegged at $1.00.
// The curve is the primary market until graduation; the band around the peg
// comes from fees, not from a rising price curve (these are STABLES).

const TOKENOMICS = {
  MAX_SUPPLY: 1_000_000_000, // fixed, minted on-curve only
  MINT_PRICE_USD: 1.0,       // curve mints at exactly $1.00
  BUY_FEE: 0.01,             // 1% on buys
  SELL_FEE: 0.01,            // 1% on sells (sell back to curve at $0.99 net)
  DEPLOY_COST_USD: 2.0,      // one-time cost to launch a coin
  GRADUATION_USD: 100_000,   // reserve target: migrate to LaunchLab at $100k
  PROTOCOL_FEE_SHARE: 0.5,   // 50% of fees -> protocol
  PEG_RESERVE_FEE_SHARE: 0.5 // 50% of fees -> coin's peg-stability reserve
};

// Buy with USD: fee comes off the top, remainder mints tokens 1:1 at $1.00.
function quoteBuy(usd) {
  const fee = round2(usd * TOKENOMICS.BUY_FEE);
  const net = round2(usd - fee);
  const tokens = round4(net / TOKENOMICS.MINT_PRICE_USD);
  return { usdIn: round2(usd), fee, net, tokens, effectivePrice: round4(usd / tokens) };
}

// Sell tokens back to the curve: redeemed at $1.00 minus the 1% exit fee.
function quoteSell(tokens) {
  const gross = round2(tokens * TOKENOMICS.MINT_PRICE_USD);
  const fee = round2(gross * TOKENOMICS.SELL_FEE);
  const usdOut = round2(gross - fee);
  return { tokens: round4(tokens), gross, fee, usdOut, effectivePrice: round4(usdOut / tokens) };
}

function graduationProgress(reserveUsd) {
  return Math.min(1, reserveUsd / TOKENOMICS.GRADUATION_USD);
}

function round2(n) { return Math.round(n * 100) / 100; }
function round4(n) { return Math.round(n * 10000) / 10000; }

module.exports = { TOKENOMICS, quoteBuy, quoteSell, graduationProgress, round2, round4 };
