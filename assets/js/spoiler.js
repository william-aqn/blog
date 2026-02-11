(function () {
  'use strict';

  var WALL_ID = 'spoiler-wall';
  var CONTENT_ID = 'spoiler-content';
  var SPOILER_SELECTOR = '.spoiler[data-password]';
  var ERROR_TEXT = 'Неверный пароль';
  var PLACEHOLDER_TEXT = 'Введите пароль';
  var BUTTON_TEXT = 'Открыть';
  var PROTECTED_TEXT = 'Этот контент защищён паролем';

  function createForm() {
    var form = document.createElement('div');
    form.className = 'spoiler-form';

    var msg = document.createElement('p');
    msg.textContent = PROTECTED_TEXT;

    var input = document.createElement('input');
    input.type = 'password';
    input.className = 'spoiler-input';
    input.placeholder = PLACEHOLDER_TEXT;

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'spoiler-btn';
    btn.textContent = BUTTON_TEXT;

    var error = document.createElement('p');
    error.className = 'spoiler-error';
    error.textContent = ERROR_TEXT;
    error.hidden = true;

    form.appendChild(msg);
    form.appendChild(input);
    form.appendChild(btn);
    form.appendChild(error);

    return { form: form, input: input, btn: btn, error: error };
  }

  function bindCheck(input, btn, error, password, onSuccess) {
    function check() {
      if (input.value === password) {
        onSuccess();
      } else {
        error.hidden = false;
        input.value = '';
        input.focus();
      }
    }

    btn.addEventListener('click', check);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        check();
      }
    });
  }

  // --- Часть 1: полностраничный спойлер ---
  function initWall() {
    var wall = document.getElementById(WALL_ID);
    if (!wall) return;

    var password = wall.getAttribute('data-password');
    var content = document.getElementById(CONTENT_ID);
    if (!password || !content) return;

    var parts = createForm();
    wall.innerHTML = '';
    wall.appendChild(parts.form);

    bindCheck(parts.input, parts.btn, parts.error, password, function () {
      wall.hidden = true;
      content.hidden = false;
    });

    parts.input.focus();
  }

  // --- Часть 2: инлайн-спойлеры ---
  function initInline() {
    var spoilers = Array.prototype.slice.call(document.querySelectorAll(SPOILER_SELECTOR));

    spoilers.forEach(function (el) {
      var password = el.getAttribute('data-password');
      if (!password) return;

      var originalHTML = el.innerHTML;
      el.innerHTML = '';

      var parts = createForm();
      el.appendChild(parts.form);

      bindCheck(parts.input, parts.btn, parts.error, password, function () {
        el.innerHTML = originalHTML;
        el.removeAttribute('data-password');
      });
    });
  }

  // --- Часть 3: форма пароля в списке постов ---
  function initList() {
    var LIST_SELECTOR = '.spoiler-list[data-password]';
    var items = Array.prototype.slice.call(document.querySelectorAll(LIST_SELECTOR));

    items.forEach(function (el) {
      var password = el.getAttribute('data-password');
      var href = el.getAttribute('data-href');
      if (!password || !href) return;

      var parts = createForm();
      el.appendChild(parts.form);

      bindCheck(parts.input, parts.btn, parts.error, password, function () {
        window.location.href = href;
      });
    });
  }

  initWall();
  initInline();
  initList();
})();
