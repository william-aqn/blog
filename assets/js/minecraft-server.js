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
  var VERSION_WIKI_PREFIX = 'https://ru.minecraft.wiki/w/';
  var VERSION_WIKI_SUFFIX = '_(Java_Edition)';
  var ADDR_ID = 'mc-addr';
  var ADDR_LABEL_ID = 'mc-addr-label';
  var COPIED_FEEDBACK_MS = 1500;
  var CSS_COPIED = 'is-copied';
  var CSS_COPY = 'mc-copy';

  var TXT = {
    error: 'Не удалось получить статус',
    empty: 'Серверы не найдены',
    noConfig: 'Источник данных не настроен',
    online: 'Онлайн',
    starting: 'Запускается…',
    offline: 'Оффлайн',
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
  var CSS_SEP = 'mc-card__sep';
  var CSS_STATE = 'mc-state';
  var CSS_ONLINE = 'is-online';
  var CSS_STARTING = 'is-starting';
  var CSS_OFFLINE = 'is-offline';

  var root = document.getElementById(ROOT_ID);
  if (!root) return;

  var box = document.getElementById(SERVERS_ID);
  if (!box) return;

  var defaultIcon = root.getAttribute('data-default-icon') || '';

  initCopy();
  initCopyButtons();

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

  // Crafty при недоступном сервере отдаёт строку "False" / null вместо данных — считаем это «нет значения».
  function cleanStr(value) {
    if (value === null || value === undefined) return '';
    var s = String(value).trim();
    var low = s.toLowerCase();
    if (s === '' || low === 'false' || low === 'none' || low === 'null') return '';
    return s;
  }

  function truthy(value) {
    if (value === true) return true;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
      var s = value.trim().toLowerCase();
      return s === 'true' || s === '1' || s === 'yes';
    }
    return false;
  }

  function createStatus(state) {
    var map = {
      online: { mod: CSS_ONLINE, text: TXT.online },
      starting: { mod: CSS_STARTING, text: TXT.starting },
      offline: { mod: CSS_OFFLINE, text: TXT.offline }
    };
    var s = map[state] || map.offline;

    var wrap = document.createElement('span');
    wrap.className = CSS_STATUS;

    var dot = document.createElement('span');
    dot.className = CSS_DOT + ' ' + s.mod;
    wrap.appendChild(dot);

    var label = document.createElement('span');
    label.className = CSS_LABEL + ' ' + s.mod;
    label.textContent = s.text;
    wrap.appendChild(label);

    return wrap;
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

    var desc = cleanStr(server.desc);
    var world = cleanStr(server.world_name);
    var version = cleanStr(server.version);
    var running = truthy(server.running);
    var state = running ? (version !== '' ? 'online' : 'starting') : 'offline';
    var titleText = desc || world || TXT.unknown;

    if (world && world !== titleText) {
      var worldEl = document.createElement('div');
      worldEl.className = CSS_WORLD;
      worldEl.textContent = world;
      body.appendChild(worldEl);
    }

    var title = document.createElement('div');
    title.className = CSS_TITLE;
    title.textContent = titleText;
    body.appendChild(title);

    var meta = document.createElement('div');
    meta.className = CSS_META;
    meta.appendChild(createStatus(state));

    var max = Number(server.max) || 0;
    var extras = [];
    if (max > 0) extras.push((Number(server.online) || 0) + ' / ' + max);
    if (version !== '') extras.push(version);
    extras.forEach(function (text) {
      var sep = document.createElement('span');
      sep.className = CSS_SEP;
      sep.textContent = '·';
      meta.appendChild(sep);
      var seg = document.createElement('span');
      seg.textContent = text;
      meta.appendChild(seg);
    });

    body.appendChild(meta);

    card.appendChild(body);
    return card;
  }

  function updateVersion(rawVersion) {
    var el = document.getElementById(VERSION_ID);
    if (!el) return;
    var clean = cleanStr(rawVersion);
    if (clean === '') return;                 // нет данных (сервер не опрошен) — оставляем дефолт
    var match = clean.match(VERSION_RE);
    if (!match) return;                       // обновляем только если нашли номер версии
    el.textContent = match[0];
    if (el.tagName === 'A') {                 // ссылка на вики синхронизируется с версией
      el.href = VERSION_WIKI_PREFIX + match[0] + VERSION_WIKI_SUFFIX;
    }
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

  // Обобщённое копирование для любых кнопок .mc-copy (адреса голосовых серверов и т.п.).
  function initCopyButtons() {
    var buttons = document.querySelectorAll('.' + CSS_COPY);
    Array.prototype.forEach.call(buttons, function (btn) {
      btn.addEventListener('click', function () {
        copyText((btn.getAttribute('data-copy') || btn.textContent).trim()).then(function () {
          btn.classList.add(CSS_COPIED);
          setTimeout(function () { btn.classList.remove(CSS_COPIED); }, COPIED_FEEDBACK_MS);
        }).catch(function () {});
      });
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
