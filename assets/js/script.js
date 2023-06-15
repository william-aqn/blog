function include(scriptUrl) {
    document.write('<script src="' + scriptUrl + '"></script>');
}

function isIE() {
    var myNav = navigator.userAgent.toLowerCase();
    return (myNav.indexOf('msie') != -1) ? parseInt(myNav.split('msie')[1]) : false;
};

include('/assets/js/swiffy.js');
include('/assets/js/shape-1.js');
include('/assets/js/shape-2.js');
include('/assets/js/shape-3.js');
include('/assets/js/shape-4.js');
include('/assets/js/device.min.js');
include('/assets/js/termly-prompt.min.js');

/* cookie.JS
 ========================================================*/
include('/assets/js/jquery.cookie.js');

/* Easing library
 ========================================================*/
include('/assets/js/jquery.easing.1.3.js');

/* PointerEvents
 ========================================================*/
;
(function ($) {
    if(isIE() && isIE() < 11){
        include('/assets/js/pointer-events.js');
        $('html').addClass('lt-ie11');
        $(document).ready(function(){
            PointerEventsPolyfill.initialize({});
        });
    }
})(jQuery);

/* EqualHeights
 ========================================================*/
;
(function ($) {
    var o = $('[data-equal-group]');
    if (o.length > 0) {
        include('/assets/js/jquery.equalheights.js');
    }
})(jQuery); 

/* Copyright Year
 ========================================================*/
;
(function ($) {
    var currentYear = (new Date).getFullYear();
    $(document).ready(function () {
        $("#copyright-year").text((new Date).getFullYear());
    });
})(jQuery);


/* WOW
 ========================================================*/
;
(function ($) {
    var o = $('html');

    if ((navigator.userAgent.toLowerCase().indexOf('msie') == -1 ) || (isIE() && isIE() > 9)) {
        if (o.hasClass('desktop') && o.hasClass('wow-animation')) {
            include('/assets/js/wow.js');

            $(document).ready(function () {
                new WOW().init();
            });
        }
    }
})(jQuery);


/* Orientation tablet fix
 ========================================================*/
$(function () {
    // IPad/IPhone
    var viewportmeta = document.querySelector && document.querySelector('meta[name="viewport"]'),
        ua = navigator.userAgent,

        gestureStart = function () {
            viewportmeta.content = "width=device-width, minimum-scale=0.25, maximum-scale=1.6, initial-scale=1.0";
        },

        scaleFix = function () {
            if (viewportmeta && /iPhone|iPad/.test(ua) && !/Opera Mini/.test(ua)) {
                viewportmeta.content = "width=device-width, minimum-scale=1.0, maximum-scale=1.0";
                document.addEventListener("gesturestart", gestureStart, false);
            }
        };

    scaleFix();
    // Menu Android
    if (window.orientation != undefined) {
        var regM = /ipod|ipad|iphone/gi,
            result = ua.match(regM);
        if (!result) {
            $('.sf-menus li').each(function () {
                if ($(">ul", this)[0]) {
                    $(">a", this).toggle(
                        function () {
                            return false;
                        },
                        function () {
                            window.location.href = $(this).attr("href");
                        }
                    );
                }
            })
        }
    }
});
var ua = navigator.userAgent.toLocaleLowerCase(),
    regV = /ipod|ipad|iphone/gi,
    result = ua.match(regV),
    userScale = "";
if (!result) {
    userScale = ",user-scalable=0"
}
document.write('<meta name="viewport" content="width=device-width,initial-scale=1.0' + userScale + '">');


/* Scroll To
 =============================================*/
;(function ($) {
    include('/assets/js/scrollTo.js');
})(jQuery);

/* Shapes
=============================================*/

 $(document).ready(function () {
    var o = $('.sf-menu');
    
    if (o.length > 0) {

        var stage_1 = new swiffy.Stage(document.getElementById('shape-1'),
          swiffyobject, {  });

        stage_1.start();

        var stage_2 = new swiffy.Stage(document.getElementById('shape-2'),
          swiffyobject2, {  });

        stage_2.start();

        var stage_3 = new swiffy.Stage(document.getElementById('shape-3'),
          swiffyobject3, {  });

        stage_3.start();

        var stage_4 = new swiffy.Stage(document.getElementById('shape-4'),
          swiffyobject4, {  });

        stage_4.start();

    }
    if ($('#terminal-container').length) {
        var shell = new TermlyPrompt('#terminal-container', { /* options object */ });
        shell.run('help');
    }
});

/* Parallax 
=============================================*/ 
;(function ($) { 
    include('/assets/js/jquery.rd-parallax.js'); 
})(jQuery);



