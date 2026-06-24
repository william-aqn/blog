/* Генератор QR-кодов на базе qr-code-styling (офлайн, самохостинг).
   Поля: адрес/текст, стиль, уровень коррекции, SVG-логотип в центр.
   Скачивание SVG/PNG — целиком на клиенте, без облаков.
   Пресеты стилей берутся из общего модуля QRStyles (qr-styles.js). */
(function () {
  'use strict';

  if (typeof QRCodeStyling === 'undefined' || !window.QRStyles) return;

  var IDS = {
    input: 'qrg-input', style: 'qrg-style', ecl: 'qrg-ecl',
    logo: 'qrg-logo', logoFile: 'qrg-logo-file', generate: 'qrg-generate',
    output: 'qrg-output', meta: 'qrg-meta', error: 'qrg-error',
    downloads: 'qrg-downloads', dlSvg: 'qrg-dl-svg', dlPng: 'qrg-dl-png'
  };
  var el = {};
  for (var key in IDS) { el[key] = document.getElementById(IDS[key]); }
  if (!el.generate || !el.output) return;

  // --- Константы оформления ---
  var SIZE = 320;            // сторона QR, px
  var QUIET_ZONE = 16;       // зона тишины, px
  var PNG_SCALE = 3;         // множитель для растрового экспорта
  var REVOKE_DELAY_MS = 1000;
  var SVG_NS_FIX = '<svg xmlns="http://www.w3.org/2000/svg" ';

  var STYLES = window.QRStyles.STYLES;

  var qr = null;
  var fileLogo = ''; // data URL логотипа из файла (приоритетнее текстового поля)

  function svgToDataUrl(svg) {
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function currentLogo() {
    if (fileLogo) return fileLogo;
    var text = (el.logo.value || '').trim();
    if (text.indexOf('<svg') !== -1) return svgToDataUrl(text);
    return '';
  }

  function showError(msg) {
    el.error.textContent = msg || '';
    el.error.hidden = !msg;
  }

  function setMeta(styleKey, ecl, hasLogo) {
    var s = STYLES[styleKey] || STYLES.site;
    var text = ['Стиль: ' + s.label, 'Коррекция: ' + ecl, 'Логотип: ' + (hasLogo ? 'да' : 'нет')].join(' · ');
    var warn = '';
    if (s.warn) warn = s.warn;
    else if (hasLogo && (ecl === 'L' || ecl === 'M')) warn = 'С логотипом надёжнее уровень Q или H.';
    el.meta.textContent = warn ? text + '  ⚠ ' + warn : text;
    el.meta.className = warn ? 'qrg__meta qrg__meta--warn' : 'qrg__meta';
  }

  function generate() {
    var data = (el.input.value || '').trim();
    if (!data) { showError('Введите адрес или текст.'); return; }
    showError('');
    var styleKey = el.style.value;
    var ecl = el.ecl.value;
    var logo = currentLogo();
    try {
      qr = new QRCodeStyling(window.QRStyles.build(data, styleKey, ecl, logo, SIZE, QUIET_ZONE));
      el.output.innerHTML = '';
      qr.append(el.output);
      setMeta(styleKey, ecl, !!logo);
      el.downloads.hidden = false;
    } catch (e) {
      showError('Ошибка генерации: ' + e.message);
    }
  }

  function getSvgString() {
    var svg = el.output.querySelector('svg');
    if (!svg) return '';
    var str = new XMLSerializer().serializeToString(svg);
    if (str.indexOf('xmlns=') === -1) str = str.replace('<svg ', SVG_NS_FIX);
    return str;
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, REVOKE_DELAY_MS);
  }

  function downloadSvg() {
    var str = getSvgString();
    if (!str) return;
    downloadBlob(new Blob([str], { type: 'image/svg+xml;charset=utf-8' }), 'qr-code.svg');
  }

  function downloadPng() {
    var str = getSvgString();
    if (!str) return;
    var img = new Image();
    img.onload = function () {
      var canvas = document.createElement('canvas');
      canvas.width = SIZE * PNG_SCALE;
      canvas.height = SIZE * PNG_SCALE;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(function (blob) { if (blob) downloadBlob(blob, 'qr-code.png'); }, 'image/png');
    };
    img.src = svgToDataUrl(str);
  }

  // --- События ---
  el.generate.addEventListener('click', generate);
  el.input.addEventListener('keydown', function (e) { if (e.key === 'Enter') generate(); });
  el.logo.addEventListener('input', function () { fileLogo = ''; });
  el.logoFile.addEventListener('change', function () {
    var file = el.logoFile.files && el.logoFile.files[0];
    if (!file) { fileLogo = ''; return; }
    var reader = new FileReader();
    reader.onload = function () { fileLogo = reader.result; };
    reader.readAsDataURL(file);
  });
  el.dlSvg.addEventListener('click', downloadSvg);
  el.dlPng.addEventListener('click', downloadPng);

  // Первая генерация по умолчанию
  generate();
})();
