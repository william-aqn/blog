/* Donation — копирование адреса в буфер обмена */
(function () {
  'use strict';

  var COPY_BUTTON_SELECTOR = '.donation__copy';
  var TARGET_ATTR = 'data-copy-target';
  var DEFAULT_LABEL_ATTR = 'data-copy-label';
  var COPIED_LABEL_ATTR = 'data-copied-label';
  var COPIED_CLASS = 'is-copied';
  var RESET_DELAY_MS = 2000;

  function fallbackCopy(text) {
    var area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'absolute';
    area.style.left = '-9999px';
    document.body.appendChild(area);
    area.select();

    var ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (e) {
      ok = false;
    }

    document.body.removeChild(area);
    return ok;
  }

  function showCopied(button) {
    var defaultLabel = button.getAttribute(DEFAULT_LABEL_ATTR);
    var copiedLabel = button.getAttribute(COPIED_LABEL_ATTR);

    button.textContent = copiedLabel;
    button.classList.add(COPIED_CLASS);

    window.setTimeout(function () {
      button.textContent = defaultLabel;
      button.classList.remove(COPIED_CLASS);
    }, RESET_DELAY_MS);
  }

  function copyToClipboard(text, button) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        showCopied(button);
      }, function () {
        if (fallbackCopy(text)) {
          showCopied(button);
        }
      });
    } else if (fallbackCopy(text)) {
      showCopied(button);
    }
  }

  function initCopyButtons() {
    var buttons = Array.prototype.slice.call(document.querySelectorAll(COPY_BUTTON_SELECTOR));

    buttons.forEach(function (button) {
      var targetId = button.getAttribute(TARGET_ATTR);
      var target = targetId ? document.getElementById(targetId) : null;
      if (!target) return;

      button.addEventListener('click', function () {
        copyToClipboard(target.textContent, button);
      });
    });
  }

  initCopyButtons();
})();
