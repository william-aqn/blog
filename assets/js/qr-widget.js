/* Простой QR-компонент: читает data-атрибуты контейнера .qr-widget
   и рендерит готовый QR (без формы). Пресеты — из QRStyles. */
(function () {
  'use strict';

  if (typeof QRCodeStyling === 'undefined' || !window.QRStyles) return;

  var DONE_ATTR = 'data-qr-done';
  var WIDGET_QUIET = 12;
  var DEFAULT_SIZE = 240;

  function render(node) {
    if (node.getAttribute(DONE_ATTR)) return;
    var data = node.getAttribute('data-qr');
    if (!data) return;
    node.setAttribute(DONE_ATTR, '1');

    var style = node.getAttribute('data-style') || 'site';
    var ecl = node.getAttribute('data-ecl') || 'H';
    var size = parseInt(node.getAttribute('data-size'), 10) || DEFAULT_SIZE;
    var logo = node.getAttribute('data-logo') || '';

    var qr = new QRCodeStyling(window.QRStyles.build(data, style, ecl, logo, size, WIDGET_QUIET));
    node.innerHTML = '';
    qr.append(node);
  }

  function init() {
    var nodes = document.querySelectorAll('.qr-widget');
    for (var i = 0; i < nodes.length; i++) render(nodes[i]);
  }

  init();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  }
})();
