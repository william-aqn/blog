/* Общие пресеты стилей QR для qr-code-styling.
   Используется и интерактивным генератором (qr-generator.js),
   и простым инклудом-компонентом (qr-widget.js). DRY. */
(function () {
  'use strict';

  var DARK = '#161310';
  var TAN = '#E4C49F';
  var WHITE = '#ffffff';

  var DEFAULT_SIZE = 320;
  var DEFAULT_QUIET = 16;
  var DEFAULT_ECL = 'H';
  var LOGO_SIZE = 0.3;   // доля логотипа от стороны
  var LOGO_MARGIN = 6;   // отступ вокруг логотипа, px

  var STYLES = {
    site:    { label: 'В стиле сайта',    bg: TAN,       dot: DARK,      dotType: 'dots',   cornerSq: 'extra-rounded', cornerDot: 'dot' },
    dots:    { label: 'Точки',            bg: WHITE,     dot: DARK,      dotType: 'dots',   cornerSq: 'extra-rounded', cornerDot: 'dot' },
    classic: { label: 'Классический',     bg: WHITE,     dot: '#000000', dotType: 'square', cornerSq: 'square',        cornerDot: 'square' },
    gold:    { label: 'Золото на тёмном', bg: '#0d0d0d',                 dotType: 'dots',   cornerSq: 'extra-rounded', cornerDot: 'dot',
               gradient: { type: 'linear', rotation: 0.79, colorStops: [{ offset: 0, color: '#fcf6ba' }, { offset: 1, color: '#bf953f' }] },
               warn: 'Светлые точки на тёмном фоне (инверсная полярность) — часть сканеров и кошельков может не прочитать.' }
  };

  function build(data, styleKey, ecl, logo, size, quiet) {
    var s = STYLES[styleKey] || STYLES.site;
    var dotsOptions = s.gradient ? { type: s.dotType, gradient: s.gradient } : { type: s.dotType, color: s.dot };
    var cornerColor = s.gradient ? s.gradient.colorStops[1].color : s.dot;
    var opts = {
      width: size || DEFAULT_SIZE,
      height: size || DEFAULT_SIZE,
      type: 'svg',
      data: data,
      margin: quiet == null ? DEFAULT_QUIET : quiet,
      qrOptions: { errorCorrectionLevel: ecl || DEFAULT_ECL },
      dotsOptions: dotsOptions,
      cornersSquareOptions: { type: s.cornerSq, color: cornerColor },
      cornersDotOptions: { type: s.cornerDot, color: cornerColor },
      backgroundOptions: { color: s.bg },
      imageOptions: { hideBackgroundDots: true, imageSize: LOGO_SIZE, margin: LOGO_MARGIN, saveAsBlob: false }
    };
    if (logo) opts.image = logo;
    return opts;
  }

  window.QRStyles = { STYLES: STYLES, build: build };
})();
