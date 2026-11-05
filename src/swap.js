// StableSwap — one-way by design: any crypto IN, USDC OUT. Never the reverse.
// The whole point of stable.bonds is to pull value INTO stables and keep it there.
// Rates are fixed demo rates (no oracle in this demo backend).

const SWAP_FEE = 0.003; // 0.3%

const RATES_USD = {
  SOL: 168.4,
  ETH: 3421.5,
  BTC: 101250.0,
  BNB: 612.3,
  AVAX: 31.9,
  DOGE: 0.142,
  LINK: 16.75,
  SUI: 2.31
};

function assets() {
  return Object.keys(RATES_USD);
}

function quote(fromAsset, amount) {
  fromAsset = String(fromAsset || '').toUpperCase();
  amount = Number(amount);
  if (fromAsset === 'USDC' || fromAsset === 'USDT' || fromAsset === 'DAI') {
    const e = new Error('Stables stay stable: swapping OUT of USDC is not a thing here.');
    e.status = 400; throw e;
  }
  if (!RATES_USD[fromAsset]) {
    const e = new Error(`Unsupported asset ${fromAsset}.`);
    e.status = 400; throw e;
  }
  if (!(amount > 0)) {
    const e = new Error('Amount must be greater than zero.');
    e.status = 400; throw e;
  }
  const usdValue = amount * RATES_USD[fromAsset];
  const fee = usdValue * SWAP_FEE;
  const usdcOut = Math.round((usdValue - fee) * 100) / 100;
  return {
    fromAsset,
    amount,
    rateUsd: RATES_USD[fromAsset],
    usdValue: Math.round(usdValue * 100) / 100,
    fee: Math.round(fee * 100) / 100,
    toAsset: 'USDC',
    usdcOut
  };
}

module.exports = { RATES_USD, SWAP_FEE, assets, quote };
