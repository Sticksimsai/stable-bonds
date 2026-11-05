// stable.bonds client — live board, bump animations, trade panel, one-way swap
(function () {
  /* ---------- shared helpers ---------- */
  function fmtUsd(n, dp) {
    if (dp === undefined) dp = 2;
    return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  }
  function fmtPrice(p) { return '$' + Number(p).toFixed(4); }
  function fmtNum(n) { return Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 }); }
  function parseAmt(s) { return parseFloat(String(s).replace(/[^0-9.]/g, '')) || 0; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function deltaHtml(pct) {
    pct = Number(pct) || 0;
    return '<span class="' + (pct >= 0 ? 'up' : 'down') + '">' + (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%</span>';
  }
  function ago(t) {
    var s = Math.max(1, Math.floor((Date.now() - t) / 1000));
    if (s < 60) return s + 's';
    var m = Math.floor(s / 60); if (m < 60) return m + 'm';
    var h = Math.floor(m / 60); if (h < 24) return h + 'h';
    return Math.floor(h / 24) + 'd';
  }
  var TILES = ['#38bdf8', '#f59e0b', '#4ade80', '#a78bfa', '#60a5fa', '#f472b6', '#34d399', '#fb923c', '#22d3ee', '#facc15'];
  function tileColor(t) {
    var h = 0;
    for (var i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) % 997;
    return TILES[h % TILES.length];
  }
  function initials(name, ticker) {
    var w = String(name || '').split(/\s+/).filter(Boolean);
    return (((w[0] && w[0][0]) || ticker[0]) + ((w[1] && w[1][0]) || ticker[1] || '')).toUpperCase();
  }
  function bump(el, cls) {
    if (!el) return;
    cls = cls || 'bump';
    el.classList.remove('bump', 'bump-new');
    void el.offsetWidth; // restart animation
    el.classList.add(cls);
    setTimeout(function () { el.classList.remove(cls); }, cls === 'bump-new' ? 2000 : 600);
  }
  function msg(el, text, ok) {
    if (!el) return;
    el.innerHTML = '<div class="flash' + (ok ? '' : ' err') + '" style="margin-top:12px;margin-bottom:0">' + text + '</div>';
  }

  /* ---------- live board: poll the backend, bump on activity ---------- */
  var grid = document.getElementById('coin-grid');
  if (grid) {
    var seen = null;

    function cardHtml(c) {
      var pct = Math.min(100, Math.round((c.marketCapUsd / c.graduationUsd) * 100));
      return '<a class="coin-card" data-ticker="' + esc(c.ticker) + '" href="/coin/' + encodeURIComponent(c.ticker) + '">' +
        '<span style="display:flex;gap:12px;align-items:center">' +
          '<span class="tile" style="background:' + tileColor(c.ticker) + '">' + esc(initials(c.name, c.ticker)) + '</span>' +
          '<span style="min-width:0">' +
            '<span style="display:block;font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(c.name) + ' <span class="muted" style="font-weight:400">· ' + esc(c.ticker) + '</span></span>' +
            '<span class="small faint" style="display:block;margin-top:2px">by ' + esc(c.creator) + ' · ' + ago(c.createdAt) + ' ago</span>' +
          '</span>' +
        '</span>' +
        '<span style="display:flex;justify-content:space-between;align-items:baseline">' +
          '<span class="mono-num c-price" style="font-size:26px">' + fmtPrice(c.priceUsd) + '</span>' +
          '<span class="small c-delta" style="font-weight:700">' + deltaHtml(c.change24hPct) + '</span>' +
        '</span>' +
        '<span>' +
          '<span class="small muted" style="display:flex;justify-content:space-between;margin-bottom:5px"><span class="c-mcap">mkt cap ' + fmtUsd(c.marketCapUsd, 0) + '</span><span class="c-pct">' + (c.graduated ? 'GRADUATED' : pct + '% to grad') + '</span></span>' +
          '<span class="bar" style="height:10px"><span class="c-bar" style="width:' + pct + '%"></span></span>' +
        '</span>' +
        '<span style="display:flex;justify-content:space-between;align-items:center" class="small faint">' +
          '<span class="tag-new">NEW</span>' +
          '<span class="tag">' + esc(c.peg) + '</span>' +
        '</span>' +
      '</a>';
    }

    function updateCard(card, c) {
      var pct = Math.min(100, Math.round((c.marketCapUsd / c.graduationUsd) * 100));
      var el;
      if ((el = card.querySelector('.c-price'))) el.textContent = fmtPrice(c.priceUsd);
      if ((el = card.querySelector('.c-delta'))) el.innerHTML = deltaHtml(c.change24hPct);
      if ((el = card.querySelector('.c-mcap'))) el.textContent = 'mkt cap ' + fmtUsd(c.marketCapUsd, 0);
      if ((el = card.querySelector('.c-pct'))) el.textContent = c.graduated ? 'GRADUATED' : pct + '% to grad';
      if ((el = card.querySelector('.c-bar'))) el.style.width = pct + '%';
      if ((el = card.querySelector('.c-replies'))) el.textContent = c.replies + ' replies';
    }

    function boardTick() {
      fetch('/api/coins').then(function (r) { return r.json(); }).then(function (list) {
        var first = seen === null;
        if (first) seen = {};
        list.forEach(function (c) {
          var card = grid.querySelector('[data-ticker="' + c.ticker + '"]');
          if (!card) {
            if (!first) { // a brand-new token just launched: drop it in with a shake
              grid.insertAdjacentHTML('afterbegin', cardHtml(c));
              card = grid.querySelector('[data-ticker="' + c.ticker + '"]');
              bump(card, 'bump-new');
            }
          } else {
            var prev = seen[c.ticker];
            updateCard(card, c);
            if (prev && (c.tradeCount !== prev.tc || c.marketCapUsd !== prev.mc)) bump(card); // fresh trade: bump
          }
          seen[c.ticker] = { tc: c.tradeCount, mc: c.marketCapUsd };
        });
      }).catch(function () { /* backend asleep or offline; try again next tick */ });
    }
    boardTick();
    setInterval(boardTick, 4000);
  }

  /* ---------- coin page: live price, curve, trade tape ---------- */
  var panel = document.getElementById('trade-panel');
  var livePrice = document.getElementById('live-price');
  if (panel && livePrice) {
    var liveTicker = panel.dataset.ticker;
    var lastTradeCount = null;

    function tradeRow(t) {
      return '<tr>' +
        '<td class="muted">' + esc(t.who) + '</td>' +
        '<td style="font-weight:700" class="' + (t.side === 'BUY' ? 'up' : 'down') + '">' + esc(t.side) + '</td>' +
        '<td class="num">' + fmtUsd(t.usd) + '</td>' +
        '<td class="num muted">' + fmtNum(t.tokens) + '</td>' +
        '<td class="num faint">' + ago(t.t) + '</td>' +
      '</tr>';
    }

    function coinTick() {
      fetch('/api/coins/' + encodeURIComponent(liveTicker)).then(function (r) { return r.json(); }).then(function (c) {
        if (!c || c.error) return;
        var pct = Math.min(100, Math.round((c.reserveUsd / c.graduationUsd) * 100));
        var el;
        var newPrice = fmtPrice(c.priceUsd);
        if (livePrice.textContent !== newPrice) { livePrice.textContent = newPrice; bump(livePrice); }
        if ((el = document.getElementById('live-delta'))) el.innerHTML = deltaHtml(c.change24hPct);
        if ((el = document.getElementById('live-circ'))) el.textContent = 'circulating ' + fmtNum(c.circulating) + ' ' + c.ticker;
        if ((el = document.getElementById('curve-raised'))) el.textContent = fmtUsd(c.reserveUsd, 0) + ' raised';
        if ((el = document.getElementById('curve-pct'))) el.textContent = pct + '%';
        if ((el = document.getElementById('curve-bar'))) el.style.width = pct + '%';
        var tb = document.getElementById('trades-body');
        if (tb && c.trades && c.trades.length) {
          tb.innerHTML = c.trades.map(tradeRow).join('');
          if (lastTradeCount !== null && c.tradeCount !== lastTradeCount && tb.firstElementChild) bump(tb.firstElementChild);
        }
        lastTradeCount = c.tradeCount;
      }).catch(function () { /* retry next tick */ });
    }
    coinTick();
    setInterval(coinTick, 4000);
  }

  /* ---------- coin trade panel ---------- */
  if (panel && !panel.dataset.graduated) {
    var ticker = panel.dataset.ticker;
    var side = 'buy';
    var amountEl = document.getElementById('usd-amount');
    var tradeBtn = document.getElementById('trade-btn');
    var tradeMsg = document.getElementById('trade-msg');

    var refresh = function () {
      var usd = parseAmt(amountEl.value);
      var fee = usd * 0.01;
      var tokens = (usd - fee) / 1.0;
      document.getElementById('fee-value').textContent = fmtUsd(fee);
      if (side === 'buy') {
        document.getElementById('recv-label').textContent = 'You receive (est.)';
        document.getElementById('recv-value').textContent = '~' + fmtNum(tokens) + ' ' + ticker;
        tradeBtn.textContent = 'Place buy — ' + fmtUsd(usd);
        tradeBtn.classList.add('btn-green'); tradeBtn.classList.remove('btn-red');
      } else {
        document.getElementById('recv-label').textContent = 'You receive (est.)';
        document.getElementById('recv-value').textContent = '~' + fmtUsd(usd - fee) + ' for ' + fmtNum(usd) + ' ' + ticker;
        tradeBtn.textContent = 'Place sell — ' + fmtUsd(usd);
        tradeBtn.classList.add('btn-red'); tradeBtn.classList.remove('btn-green');
      }
    };

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
          tradeBtn.disabled = false;
          if (!res.ok) return msg(tradeMsg, res.j.error || 'Trade failed.', false);
          msg(tradeMsg, res.j.result.side + ' filled: ' + fmtNum(res.j.result.tokens) + ' ' + ticker + ' @ $1.0000 (fee ' + fmtUsd(res.j.result.fee) + ').', true);
          bump(panel);
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

    var quote = function () {
      var from = fromEl.value;
      var amt = parseAmt(amtEl.value);
      var usd = amt * (rates[from] || 0);
      var fee = usd * feeRate;
      var out = usd - fee;
      outEl.value = out > 0 ? out.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
      document.getElementById('swap-rate').textContent = '1 ' + from + ' = ' + fmtUsd(rates[from], rates[from] < 1 ? 4 : 2);
      document.getElementById('swap-fee').textContent = out > 0 ? fmtUsd(fee) : '—';
      swapBtn.textContent = out > 0 ? 'Swap ' + amt.toLocaleString('en-US', { maximumFractionDigits: 6 }) + ' ' + from + ' → ' + fmtUsd(out) + ' USDC' : 'Swap to USDC';
    };
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
          bump(swapPanel);
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
