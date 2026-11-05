// stable.bonds client — trade panel + one-way swap
(function () {
  function fmtUsd(n, dp) {
    if (dp === undefined) dp = 2;
    return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  }
  function parseAmt(s) {
    return parseFloat(String(s).replace(/[^0-9.]/g, '')) || 0;
  }
  function msg(el, text, ok) {
    el.innerHTML = '<div class="flash' + (ok ? '' : ' err') + '" style="margin-top:12px;margin-bottom:0">' + text + '</div>';
  }

  /* ---------- coin trade panel ---------- */
  var panel = document.getElementById('trade-panel');
  if (panel && !panel.dataset.graduated) {
    var ticker = panel.dataset.ticker;
    var side = 'buy';
    var amountEl = document.getElementById('usd-amount');
    var tradeBtn = document.getElementById('trade-btn');
    var tradeMsg = document.getElementById('trade-msg');

    function refresh() {
      var usd = parseAmt(amountEl.value);
      var fee = usd * 0.01;
      var tokens = (usd - fee) / 1.0;
      document.getElementById('fee-value').textContent = fmtUsd(fee);
      if (side === 'buy') {
        document.getElementById('recv-label').textContent = 'You receive (est.)';
        document.getElementById('recv-value').textContent = '~' + tokens.toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' ' + ticker;
        tradeBtn.textContent = 'Place buy — ' + fmtUsd(usd);
        tradeBtn.classList.add('btn-green'); tradeBtn.classList.remove('btn-red');
      } else {
        document.getElementById('recv-label').textContent = 'You receive (est.)';
        document.getElementById('recv-value').textContent = '~' + fmtUsd(usd - fee) + ' for ' + usd.toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' ' + ticker;
        tradeBtn.textContent = 'Place sell — ' + fmtUsd(usd);
        tradeBtn.classList.add('btn-red'); tradeBtn.classList.remove('btn-green');
      }
    }

    panel.querySelectorAll('[data-side]').forEach(function (b) {
      b.addEventListener('click', function () {
        side = b.dataset.side;
        panel.querySelectorAll('[data-side]').forEach(function (x) {
          var active = x.dataset.side === side;
          x.classList.toggle('btn-ghost', !active);
          x.classList.toggle('btn-green', active && side === 'buy');
          x.classList.toggle('btn-red', active && side === 'sell');
          x.style.boxShadow = 'none';
        });
        refresh();
      });
    });
    panel.querySelectorAll('[data-amt]').forEach(function (b) {
      b.addEventListener('click', function () { amountEl.value = Number(b.dataset.amt).toFixed(2); refresh(); });
    });
    amountEl.addEventListener('input', refresh);

    tradeBtn.addEventListener('click', function () {
      var usd = parseAmt(amountEl.value);
      if (!(usd > 0)) return msg(tradeMsg, 'Enter a USD amount first.', false);
      tradeBtn.disabled = true;
      fetch('/api/coins/' + encodeURIComponent(ticker) + '/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ side: side, usd: usd })
      })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (!res.ok) { tradeBtn.disabled = false; return msg(tradeMsg, res.j.error || 'Trade failed.', false); }
          msg(tradeMsg, res.j.result.side + ' filled: ' + res.j.result.tokens.toLocaleString('en-US') + ' ' + ticker + ' @ $1.0000 (fee ' + fmtUsd(res.j.result.fee) + '). Reloading…', true);
          setTimeout(function () { location.reload(); }, 900);
        })
        .catch(function () { tradeBtn.disabled = false; msg(tradeMsg, 'Network error.', false); });
    });
    refresh();
  }

  /* ---------- one-way swap ---------- */
  var swapPanel = document.getElementById('swap-panel');
  if (swapPanel) {
    var rates = JSON.parse(swapPanel.dataset.rates);
    var feeRate = parseFloat(swapPanel.dataset.fee);
    var fromEl = document.getElementById('swap-from');
    var amtEl = document.getElementById('swap-amount');
    var outEl = document.getElementById('swap-out');
    var swapBtn = document.getElementById('swap-btn');
    var swapMsg = document.getElementById('swap-msg');

    function quote() {
      var from = fromEl.value;
      var amt = parseAmt(amtEl.value);
      var usd = amt * (rates[from] || 0);
      var fee = usd * feeRate;
      var out = usd - fee;
      outEl.value = out > 0 ? out.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
      document.getElementById('swap-rate').textContent = '1 ' + from + ' = ' + fmtUsd(rates[from], rates[from] < 1 ? 4 : 2);
      document.getElementById('swap-fee').textContent = out > 0 ? fmtUsd(fee) : '—';
      swapBtn.textContent = out > 0 ? 'Swap ' + amt.toLocaleString('en-US', { maximumFractionDigits: 6 }) + ' ' + from + ' → ' + fmtUsd(out) + ' USDC' : 'Swap to USDC';
    }
    fromEl.addEventListener('change', quote);
    amtEl.addEventListener('input', quote);

    swapBtn.addEventListener('click', function () {
      var amt = parseAmt(amtEl.value);
      if (!(amt > 0)) return msg(swapMsg, 'Enter an amount first.', false);
      swapBtn.disabled = true;
      fetch('/api/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromAsset: fromEl.value, amount: amt })
      })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          swapBtn.disabled = false;
          if (!res.ok) return msg(swapMsg, res.j.error || 'Swap failed.', false);
          msg(swapMsg, 'Swapped ' + res.j.amount + ' ' + res.j.fromAsset + ' → ' + fmtUsd(res.j.usdcOut) + ' USDC (fee ' + fmtUsd(res.j.fee) + '). Welcome to stability. There is no way back.', true);
        })
        .catch(function () { swapBtn.disabled = false; msg(swapMsg, 'Network error.', false); });
    });
    quote();
  }

  /* ---------- launch form ---------- */
  var launchForm = document.getElementById('launch-form');
  if (launchForm) {
    launchForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = new FormData(launchForm);
      var body = {};
      fd.forEach(function (v, k) { body[k] = v; });
      body.initialBuyUsd = parseAmt(body.initialBuyUsd);
      fetch('/api/coins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (!res.ok) { alert(res.j.error || 'Launch failed.'); return; }
          location.href = '/coin/' + encodeURIComponent(res.j.ticker);
        })
        .catch(function () { alert('Network error.'); });
    });
  }
})();
