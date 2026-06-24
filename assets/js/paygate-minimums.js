/* Живая таблица минимальных сумм выплат PayGate.
   Тянет данные с API на стороне клиента (значения зависят от курса). */
(function () {
  'use strict';

  var CONTAINER_ID = 'paygate-minimums';
  var DEFAULT_WALLETS = 5;
  var API = 'https://api.paygate.to/crypto/mass-payout-info.php?wallet_count=';

  var NETWORK_NAMES = {
    btc: 'Bitcoin', bch: 'Bitcoin Cash', ltc: 'Litecoin', doge: 'Dogecoin',
    eth: 'Ethereum', trx: 'Tron',
    bep20: 'BNB Smart Chain (BEP-20)', erc20: 'Ethereum (ERC-20)', trc20: 'Tron (TRC-20)',
    arbitrum: 'Arbitrum', polygon: 'Polygon', 'avax-c': 'Avalanche C-Chain',
    base: 'Base', optimism: 'Optimism', linea: 'Linea', monad: 'Monad', sol: 'Solana'
  };

  var node = document.getElementById(CONTAINER_ID);
  if (!node) return;

  var wallets = parseInt(node.getAttribute('data-wallets'), 10) || DEFAULT_WALLETS;

  function fmtAmount(n) {
    if (!n) return '0';
    var s = n >= 1 ? n.toFixed(6) : Number(n).toPrecision(4);
    return String(Number(s)); // нормализует и убирает хвостовые нули
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function rowHtml(network, coin) {
    var ticker = (coin.ticker || '').toUpperCase();
    return '<tr>' +
      '<td>' + escapeHtml(network) + '</td>' +
      '<td class="paygate__coin">' +
        '<img class="paygate__logo" src="' + escapeHtml(coin.logo) + '" alt="" loading="lazy" width="18" height="18" />' +
        escapeHtml(coin.coin) +
      '</td>' +
      '<td>' + escapeHtml(ticker) + '</td>' +
      '<td class="paygate__min">' + fmtAmount(coin.minimum_transaction_coin) + ' ' + escapeHtml(ticker) + '</td>' +
      '</tr>';
  }

  function buildTable(data) {
    var rows = [];
    Object.keys(data).forEach(function (key) {
      var value = data[key];
      var network = NETWORK_NAMES[key] || key.toUpperCase();
      if (value && value.ticker) {
        rows.push(rowHtml(network, value));
      } else if (value) {
        Object.keys(value).forEach(function (coinKey) {
          rows.push(rowHtml(network, value[coinKey]));
        });
      }
    });
    return '<div class="paygate__scroll"><table class="paygate"><thead><tr>' +
      '<th>Сеть</th><th>Монета</th><th>Тикер</th><th>Минимум</th>' +
      '</tr></thead><tbody>' + rows.join('') + '</tbody></table></div>';
  }

  node.textContent = 'Загрузка минимальных сумм…';

  fetch(API + wallets)
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function (data) {
      node.innerHTML = buildTable(data);
    })
    .catch(function (e) {
      node.innerHTML = '<p class="paygate__error">Не удалось загрузить данные PayGate: ' +
        escapeHtml(e.message) + '. <a href="' + API + wallets + '" target="_blank" rel="noopener noreferrer">Открыть API</a></p>';
    });
})();
