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
        bindConsoleKeys(shell);
        announceConsoleCommands(shell);
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

/* Console prompt
 =============================================*/
// The prompt input of a console row (Termly creates one per row), if the event comes from one
function consoleInput(event) {
    var INPUT_CLASS = 'terminal-input';
    var input = event.target;
    return input.classList && input.classList.contains(INPUT_CLASS) ? input : null;
}

/* Console keys
 =============================================*/
// The console keeps the keyboard like a terminal: Tab completes the command name instead of moving
// the focus out of the page widget; Escape releases the focus, so keyboard users can go on with Tab.
function bindConsoleKeys(shell) {
    var KEY_TAB = 9;
    var KEY_ESCAPE = 27;
    var ARG_SEPARATOR = ' ';

    function commonPrefix(words) {
        var prefix = words[0];
        var i;
        for (i = 1; i < words.length; i++) {
            while (words[i].indexOf(prefix) !== 0) {
                prefix = prefix.slice(0, -1);
            }
        }
        return prefix;
    }

    // Only the command name is completed: one match gets a separator after it, several - their common start
    function complete(input) {
        var typed = input.value;
        var matches;
        if (!typed || typed.indexOf(ARG_SEPARATOR) !== -1) {
            return;
        }
        matches = Object.keys(shell.ShellCommands).filter(function (name) {
            return name.indexOf(typed) === 0;
        });
        if (matches.length === 1) {
            input.value = matches[0] + ARG_SEPARATOR;
        } else if (matches.length > 1) {
            input.value = commonPrefix(matches);
        }
    }

    shell.container.addEventListener('keydown', function (event) {
        var input = consoleInput(event);
        if (!input) {
            return;
        }
        if (event.keyCode === KEY_TAB) {
            event.preventDefault();
            complete(input);
        } else if (event.keyCode === KEY_ESCAPE) {
            input.blur();
        }
    });
}

/* Console commands
 =============================================*/
// Tells the page when the visitor runs a console command (hex-bg.js turns the light of the blog into a black hole
// then): an event on document for Enter on a command that exists, "clear" included (Termly runs it apart from the
// others). The help the page runs at the start and mistyped commands do not count. The listener catches the key
// before Termly's own one on the input, which already starts the next prompt.
function announceConsoleCommands(shell) {
    var CONSOLE_COMMAND_EVENT = 'console-command';  // listened to by hex-bg.js (the same constant there)
    var EVENT_KEYUP = 'keyup';
    var KEY_ENTER = 13;
    var CLEAR_COMMAND = 'clear';
    var CAPTURE = true;

    // Termly's own parser finds the command name of the line, as when it runs it
    function isCommand(line) {
        try {
            return line === CLEAR_COMMAND || shell.ShellCommands.hasOwnProperty(shell.parse(line).command);
        } catch (e) {
            return false;                   // an empty or broken line: Termly cannot run it either
        }
    }

    shell.container.addEventListener(EVENT_KEYUP, function (event) {
        var input = consoleInput(event);
        if (input && event.keyCode === KEY_ENTER && isCommand(input.value.trim())) {
            document.dispatchEvent(new CustomEvent(CONSOLE_COMMAND_EVENT));
        }
    }, CAPTURE);
}
