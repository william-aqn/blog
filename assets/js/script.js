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
include('/assets/js/jquery.rd-navbar.js');

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
        decorateConsoleInputs(TermlyPrompt);
        var shell = new TermlyPrompt('#terminal-container', { /* options object */ });
        shell.run('help');
    }
});

/* Console input attributes
 =============================================*/
// Accessible name; mobile keyboards must not capitalize or autocorrect commands ("Help" is not a command).
// Termly creates and focuses every prompt input inside generateRow(): the attributes are set right there
// and the input is focused again, so the on-screen keyboard picks them up.
function decorateConsoleInputs(Prompt) {
    var INPUT_ATTRS = {
        'aria-label': 'Команда консоли',
        'autocapitalize': 'off',
        'autocorrect': 'off',
        'autocomplete': 'off',
        'spellcheck': 'false'
    };
    var generateRow = Prompt.prototype.generateRow;

    Prompt.prototype.generateRow = function () {
        var input = generateRow.apply(this, arguments);
        var name;
        for (name in INPUT_ATTRS) {
            if (INPUT_ATTRS.hasOwnProperty(name)) {
                input.setAttribute(name, INPUT_ATTRS[name]);
            }
        }
        input.blur();
        input.select();
        return input;
    };
}



