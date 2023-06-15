; (function ($, Raphael) {
    'use strict'

    var $window = $(window);
    var options = {
        pID: 'radial-progress-bar',
        tID: 'radial-progress-text',
        barsCount: 0,
    }

    var defaults = {
        value: 50,
        stroke: 15,
        bg: '#999',
        fg: '#333'
    }

    $.fn.radialProgress = function (settings) {
        var $this = $(this),
            sz = $this.width(),
            pID = [options.pID, ++options.barsCount].join('_'),
            tID = [options.tID, options.barsCount].join('_'),
            $wr = $('<div/>', { id: tID }),
            $o = $('<div/>', { id: pID });

        $this.contents().wrapAll($wr);
        $this.prepend($o);

        settings = $.extend({}, defaults, settings);

        var p = Raphael(pID, sz, sz);

        // function to be called to draw the progress pie
        function draw() {                       
            var size = $this.width(),
                c = size / 2,
                r = (size - settings.stroke) / 2 - 2;

            p.clear();
            p.setSize(size, size);
            p.circle(c, c, r).attr({ stroke: settings.bg, fill: 'none', 'stroke-width': settings.stroke });
            p.path().attr({ path: path(settings.value, size, r), stroke: settings.fg, 'stroke-width': settings.stroke });
        }

        $window.on('resize', draw);
        draw();        
    }

    function path(v, sz, rad) {
        var v = 3.6 * v,
            c = sz / 2,
            alpha = v == 360 ? 359.99 : v,
            a = (90 - alpha) * Math.PI / 180,
            b = 90 * Math.PI / 180,
            sx = c + rad * Math.cos(b),
            sy = c - rad * Math.sin(b),
            x = c + rad * Math.cos(a),
            y = c - rad * Math.sin(a),
            path = [['M', sx, sy], ['A', rad, rad, 0, +(alpha > 180), 1, x, y]];
        return path;
    }    
})(jQuery, Raphael);

$(document).ready(function () {
    var obj, v;
    if ((obj = $('.radial-progress')).length > 0) {
        for (var i = 0; i < obj.length; i++) {
            $(obj[i]).radialProgress({
                value: parseInt(obj[i].innerHTML, 10),
                stroke: (v = obj[i].getAttribute('data-border')) !== null ? v: undefined,
                bg: (v = obj[i].getAttribute('data-border-bg')) !== null ? v : undefined,
                fg: (v = obj[i].getAttribute('data-border-fg')) !== null ? v : undefined
            });
        }
    }
});