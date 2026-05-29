(function () {
  'use strict';

  var POLL_INTERVAL_MS = 15000;
  var STATUS_PATH = '/status';
  var ROOT_ID = 'minecraft-server';
  var SERVERS_ID = 'mc-servers';
  var TRAILING_SLASH = /\/+$/;
  var VALID_ICON = /^(data:image\/|https?:\/\/)/i;
  var VERSION_RE = /\d+(?:\.\d+)+/;
  var VERSION_ID = 'mc-version';
  var ADDR_ID = 'mc-addr';
  var ADDR_LABEL_ID = 'mc-addr-label';
  var COPIED_FEEDBACK_MS = 1500;
  var CSS_COPIED = 'is-copied';

  var TXT = {
    error: 'Не удалось получить статус',
    empty: 'Серверы не найдены',
    noConfig: 'Источник данных не настроен',
    online: 'Онлайн',
    offline: 'Оффлайн',
    players: 'Игроки',
    version: 'Версия',
    unknown: '—',
    copied: 'Скопировано!'
  };

  var CSS_CARD = 'mc-card';
  var CSS_ICON = 'mc-card__icon';
  var CSS_BODY = 'mc-card__body';
  var CSS_WORLD = 'mc-card__world';
  var CSS_TITLE = 'mc-card__title';
  var CSS_STATUS = 'mc-card__status';
  var CSS_DOT = 'mc-status-dot';
  var CSS_LABEL = 'mc-status-label';
  var CSS_META = 'mc-card__meta';
  var CSS_STATE = 'mc-state';
  var CSS_ONLINE = 'is-online';
  var CSS_OFFLINE = 'is-offline';

  var root = document.getElementById(ROOT_ID);
  if (!root) return;

  var box = document.getElementById(SERVERS_ID);
  if (!box) return;

  var defaultIcon = root.getAttribute('data-default-icon') || '';

  initCopy();

  var base = (root.getAttribute('data-proxy-base') || '').replace(TRAILING_SLASH, '');
  if (!base) {
    setState(TXT.noConfig);
    return;
  }

  function clearBox() {
    while (box.firstChild) {
      box.removeChild(box.firstChild);
    }
  }

  function setState(text) {
    clearBox();
    var p = document.createElement('p');
    p.className = CSS_STATE;
    p.textContent = text;
    box.appendChild(p);
  }

  function createMeta(label, value) {
    var span = document.createElement('span');
    var strong = document.createElement('strong');
    strong.textContent = label + ': ';
    span.appendChild(strong);
    span.appendChild(document.createTextNode(value));
    return span;
  }

  function createStatus(online) {
    var modifier = online ? CSS_ONLINE : CSS_OFFLINE;
    var row = document.createElement('div');
    row.className = CSS_STATUS;

    var dot = document.createElement('span');
    dot.className = CSS_DOT + ' ' + modifier;
    row.appendChild(dot);

    var label = document.createElement('span');
    label.className = CSS_LABEL + ' ' + modifier;
    label.textContent = online ? TXT.online : TXT.offline;
    row.appendChild(label);

    return row;
  }

  function createCard(server) {
    var card = document.createElement('div');
    card.className = CSS_CARD;

    var iconSrc = (server.icon && VALID_ICON.test(server.icon)) ? server.icon : defaultIcon;
    if (iconSrc) {
      var img = document.createElement('img');
      img.className = CSS_ICON;
      img.src = iconSrc;
      img.alt = '';
      card.appendChild(img);
    }

    var body = document.createElement('div');
    body.className = CSS_BODY;

    var titleText = server.desc || server.world_name || TXT.unknown;

    if (server.world_name && server.world_name !== titleText) {
      var world = document.createElement('div');
      world.className = CSS_WORLD;
      world.textContent = server.world_name;
      body.appendChild(world);
    }

    var title = document.createElement('div');
    title.className = CSS_TITLE;
    title.textContent = titleText;
    body.appendChild(title);

    body.appendChild(createStatus(!!server.running));

    var meta = document.createElement('div');
    meta.className = CSS_META;
    meta.appendChild(createMeta(TXT.players, server.online + ' / ' + server.max));
    if (server.version) {
      meta.appendChild(createMeta(TXT.version, server.version));
    }
    body.appendChild(meta);

    card.appendChild(body);
    return card;
  }

  function updateVersion(rawVersion) {
    var el = document.getElementById(VERSION_ID);
    if (!el || !rawVersion) return;
    var match = String(rawVersion).match(VERSION_RE);
    el.textContent = match ? match[0] : rawVersion;
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        resolve();
      } catch (e) {
        reject(e);
      }
    });
  }

  function initCopy() {
    var btn = document.getElementById(ADDR_ID);
    var label = document.getElementById(ADDR_LABEL_ID);
    if (!btn) return;
    var original = label ? label.textContent : '';
    btn.addEventListener('click', function () {
      copyText(btn.textContent.trim()).then(function () {
        if (!label) return;
        label.textContent = TXT.copied;
        label.classList.add(CSS_COPIED);
        setTimeout(function () {
          label.textContent = original;
          label.classList.remove(CSS_COPIED);
        }, COPIED_FEEDBACK_MS);
      }).catch(function () {});
    });
  }

  function render(json) {
    var list = json && json.status === 'ok' && json.data ? json.data : null;
    if (!list) {
      setState(TXT.error);
      return;
    }
    if (!list.length) {
      setState(TXT.empty);
      return;
    }
    updateVersion(list[0].version);
    clearBox();
    list.forEach(function (server) {
      box.appendChild(createCard(server));
    });
  }

  function load() {
    fetch(base + STATUS_PATH, { cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(render)
      .catch(function () {
        // Транзиентную ошибку не показываем поверх уже отрисованных серверов.
        if (!box.querySelector('.' + CSS_CARD)) {
          setState(TXT.error);
        }
      });
  }

  var timer = null;

  function startPolling() {
    stopPolling();
    timer = setInterval(load, POLL_INTERVAL_MS);
  }

  function stopPolling() {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  }

  load();
  startPolling();

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      stopPolling();
    } else {
      load();
      startPolling();
    }
  });
})();
