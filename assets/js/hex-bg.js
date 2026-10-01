/*
 * hex-bg.js - animated layer of the vector hex grille background (see hex-bg.scss).
 * Draws glowing cells, a "data packet" running along a row of holes and a scan beam on a 2D canvas
 * (.hex-bg__fx) under the grille of every .hex-bg. CSS animations would make the browser recomposite
 * the screen at the display rate; the canvas covers only the part of the layer on screen, is updated
 * at most FPS_MAX times a second, only where an effect has changed and not at all while nothing is lit.
 * Nothing runs offscreen, in a hidden tab or with reduced motion. When the browser cannot keep up with the
 * frames (software rendering in a VM, a weak device), the effects switch off for the rest of the session.
 */
(function () {
    'use strict';

    var LAYER_SELECTOR = '.hex-bg';
    var FX_CLASS = 'hex-bg__fx';
    var CANVAS_TAG = 'canvas';
    var CONTEXT_TYPE = '2d';
    // Set on .hex-bg by hex-bg.scss: grid pitch, sprite sizes and gradients ("r g b alpha offset, ...")
    var CELL_W_VAR = '--hex-bg-cell-w';
    var ROW_H_VAR = '--hex-bg-row-h';
    var SPARK_SIZE_VAR = '--hex-bg-spark-size';
    var SPARK_VAR = '--hex-bg-spark';
    var SPARK_HOT_VAR = '--hex-bg-spark-hot';
    var BEAM_H_VAR = '--hex-bg-beam-h';
    var BEAM_VAR = '--hex-bg-beam';
    var STOP_SEPARATOR = ',';
    var FIELD_SEPARATOR = /\s+/;
    var RGBA_FIELDS = 4;                    // r g b alpha, then the offset
    var RGBA_OPEN = 'rgba(';
    var RGBA_CLOSE = ')';
    var REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
    var EVENT_CHANGE = 'change';
    var EVENT_VISIBILITY = 'visibilitychange';
    var EVENT_RESIZE = 'resize';
    var EVENT_SCROLL = 'scroll';
    var PASSIVE = { passive: true };
    var TRANSLATE_Y = 'translateY(';
    var PX = 'px';
    var CLOSE = ')';
    var MS_PER_S = 1000;

    // ---- Frames
    var FPS_MAX = 30;
    var FRAME_MS = MS_PER_S / FPS_MAX;
    var TIMER_LEAD_MS = 2;                  // the timer wakes a bit early, the frame itself waits for the vsync
    var PIXEL_RATIO_MAX = 1;                // soft light under a crisp grille: denser canvas pixels would not show
    var ALPHA_STEP = 1 / 64;                // smaller opacity changes are not redrawn (about 2 levels at the brightest)
    var BEAM_SPRITE_W = 1;                  // px, the beam sprite is stretched over the canvas width
    var HALF = 0.5;

    // ---- Auto-off: frames of an uninterrupted run come much slower than FPS_MAX
    var WARMUP_MS = 2000;                   // the first frames after the start are not judged (page still loading)
    var SAMPLE_FRAMES = 45;                 // about 1.5 s of continuous frames per verdict
    var SLOW_FRAME_MS = FRAME_MS * 2;       // average interval above this: slower than FPS_MAX / 2
    var OFF_KEY = 'hex-bg-fx-off';          // sessionStorage: remembered for the rest of the tab session
    var OFF_VALUE = '1';

    // ---- Keyframes: [phase of the cycle, value], linear in between, the last value holds to the cycle end
    var AT = 0;
    var VALUE = 1;

    // ---- Glowing cells
    var VIEWPORT_AREA_PER_CELL = 250000;    // px2 of viewport per glowing cell
    var CELL_COUNT_MIN = 2;
    var CELL_COUNT_MAX = 6;
    var CELL_TIME_MIN = 4;                  // s, flicker cycle
    var CELL_TIME_SPREAD = 3;
    var HOT_EVERY = 3;                      // every n-th cell glows orange
    // opacity: flash, dip, flash, slow fade; dark for the rest of the cycle
    var FLICKER = [[0, 0], [0.05, 1], [0.08, 0.25], [0.11, 1], [0.38, 0.7], [0.62, 0]];

    // ---- Data packet: a light dot running along a row of holes, then resting
    var PACKET_TIME_MIN = 8;                // s, one run per cycle
    var PACKET_TIME_SPREAD = 7;
    var PACKET_CELLS_MIN = 4;               // holes a packet runs across
    var PACKET_CELLS_SPREAD = 5;
    var PACKET_FADE = 0.02;
    var PACKET_RUN = 0.14;                  // the dot runs for this share of the cycle
    var PACKET = [[0, 0], [PACKET_FADE, 1], [PACKET_RUN - PACKET_FADE, 1], [PACKET_RUN, 0]];
    var RUN_LEFT = -1;
    var RUN_RIGHT = 1;

    // ---- Scan beam
    var SCAN_SPEED = 150;                   // px/s
    var SCAN_PAUSE = 1400;                  // px travelled below the layer = pause between sweeps

    // ---- Placement
    var EDGE_CELLS = 1;                     // keep effects off the edges of the visible part
    var ROW_PARITY = 2;
    var ODD_ROW_SHIFT = 0.5;                // odd rows of the pointy-top grid are shifted by half a cell

    var fields = [];
    var motion = window.matchMedia ? window.matchMedia(REDUCED_MOTION_QUERY) : null;
    var switchedOff = false;

    function now() {
        return window.performance.now();
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function randomInt(min, spread) {
        return min + Math.floor(Math.random() * (spread + 1));
    }

    // Storage may be unavailable (privacy modes, blocked cookies): then the switch lasts for this page only
    function rememberedOff() {
        try {
            return window.sessionStorage.getItem(OFF_KEY) === OFF_VALUE;
        } catch (e) {
            return false;
        }
    }

    function rememberOff() {
        try {
            window.sessionStorage.setItem(OFF_KEY, OFF_VALUE);
        } catch (e) {
            // the effects are off on this page anyway
        }
    }

    function keyframe(keys, phase) {
        var from;
        var to;
        var i;
        for (i = 1; i < keys.length; i++) {
            from = keys[i - 1];
            to = keys[i];
            if (phase < to[AT]) {
                return from[VALUE] + (to[VALUE] - from[VALUE]) * (phase - from[AT]) / (to[AT] - from[AT]);
            }
        }
        return keys[keys.length - 1][VALUE];
    }

    // Phase at which the effect goes dark
    function keysEnd(keys) {
        return keys[keys.length - 1][AT];
    }

    function readNumber(style, name) {
        return parseFloat(style.getPropertyValue(name));
    }

    function addStops(gradient, style, name) {
        style.getPropertyValue(name).split(STOP_SEPARATOR).forEach(function (stop) {
            var parts = stop.trim().split(FIELD_SEPARATOR);
            gradient.addColorStop(parseFloat(parts[RGBA_FIELDS]),
                RGBA_OPEN + parts.slice(0, RGBA_FIELDS).join(STOP_SEPARATOR) + RGBA_CLOSE);
        });
        return gradient;
    }

    // Gradient pre-rendered once (in CSS px), then only drawn scaled and with an opacity
    function sprite(width, height, gradient) {
        var canvas = document.createElement(CANVAS_TAG);
        var ctx;
        canvas.width = Math.ceil(width);
        canvas.height = Math.ceil(height);
        ctx = canvas.getContext(CONTEXT_TYPE);
        ctx.fillStyle = gradient(ctx, canvas.width, canvas.height);
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        return canvas;
    }

    function glowSprite(size, style, name) {
        return sprite(size, size, function (ctx, width) {
            var r = width * HALF;
            return addStops(ctx.createRadialGradient(r, r, 0, r, r, r), style, name);
        });
    }

    function beamSprite(height, style, name) {
        return sprite(BEAM_SPRITE_W, height, function (ctx, width, h) {
            return addStops(ctx.createLinearGradient(0, 0, 0, h), style, name);
        });
    }

    // Endless cycle on the field clock (ms); `start` is the time the current cycle began
    function Loop(duration, start) {
        this.duration = duration;
        this.start = start;
    }

    // Random length and phase keep the effects out of sync
    function randomLoop(min, spread) {
        var duration = (min + Math.random() * spread) * MS_PER_S;
        return new Loop(duration, -Math.random() * duration);
    }

    // Moves on to the cycle that contains `clock`; true when a new cycle has begun
    Loop.prototype.advance = function (clock) {
        var elapsed = clock - this.start;
        if (elapsed < this.duration) {
            return false;
        }
        this.start = clock - elapsed % this.duration;
        return true;
    };

    Loop.prototype.phase = function (clock) {
        return (clock - this.start) / this.duration;
    };

    // ms to the next cycle
    Loop.prototype.left = function (clock) {
        return this.start + this.duration - clock;
    };

    // A sprite drawn with an opacity at a box in canvas pixels, and the whole pixels the box touches
    function Shape(image, x, y, width, height, alpha) {
        this.image = image;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.alpha = alpha;
        this.left = Math.floor(x);
        this.top = Math.floor(y);
        this.right = Math.ceil(x + width);
        this.bottom = Math.ceil(y + height);
    }

    // Looks the same on the canvas as `other`
    Shape.prototype.matches = function (other) {
        return other !== null && this.image === other.image && this.x === other.x && this.y === other.y &&
            this.width === other.width && Math.abs(this.alpha - other.alpha) < ALPHA_STEP;
    };

    Shape.prototype.overlaps = function (other) {
        return this.left < other.right && other.left < this.right && this.top < other.bottom && other.top < this.bottom;
    };

    // An effect keeps the shape it wants on the canvas now (`shape`) and the one drawn there (`drawn`)
    function effect(loop, image) {
        return { loop: loop, image: image, shape: null, drawn: null };
    }

    function Field(layer, style, ctx) {
        var cellCount = clamp(Math.round(window.innerWidth * window.innerHeight / VIEWPORT_AREA_PER_CELL),
            CELL_COUNT_MIN, CELL_COUNT_MAX);
        var spark;
        var hot;
        var i;
        this.layer = layer;
        this.canvas = ctx.canvas;
        this.ctx = ctx;
        this.cellW = readNumber(style, CELL_W_VAR);
        this.rowH = readNumber(style, ROW_H_VAR);
        this.sparkSize = readNumber(style, SPARK_SIZE_VAR);
        this.beamH = readNumber(style, BEAM_H_VAR);
        spark = glowSprite(this.sparkSize, style, SPARK_VAR);
        hot = glowSprite(this.sparkSize, style, SPARK_HOT_VAR);
        this.cells = [];
        for (i = 0; i < cellCount; i++) {
            this.cells.push(effect(randomLoop(CELL_TIME_MIN, CELL_TIME_SPREAD), (i + 1) % HOT_EVERY ? spark : hot));
        }
        this.packet = effect(randomLoop(PACKET_TIME_MIN, PACKET_TIME_SPREAD), hot);
        // the first sweep starts at the layer top once the field runs
        this.beam = effect(new Loop(this.scanTime(), 0), beamSprite(this.beamH, style, BEAM_VAR));
        // in paint order
        this.effects = this.cells.concat(this.packet, this.beam);
        this.clock = 0;                     // ms the field has been running: effects keep their phase while paused
        this.time = null;                   // timestamp of the last frame since the field (re)started
        this.last = 0;                      // timestamp of the last frame
        this.view = { top: 0, width: 0, height: 0 };   // what the canvas covers, in layer px
        this.ratio = 0;                     // canvas pixels per CSS px
        // with an observer the first callback reports the real state (and places the effects on screen)
        this.visible = !window.IntersectionObserver;
        this.running = false;
        this.sleeping = false;              // no frames until the next effect lights up
        this.prevFrame = null;              // timestamp of the previous frame of an uninterrupted run
        this.sampleMs = 0;                  // frame intervals summed for the current verdict
        this.sampleFrames = 0;
        this.timer = null;
        this.request = null;
        this.tick = this.tick.bind(this);
        this.frame = this.frame.bind(this);
        this.placeAll();
    }

    // One sweep: the beam's bottom edge runs from the layer top to SCAN_PAUSE px below the layer and the beam
    Field.prototype.scanTime = function () {
        return (this.layer.clientHeight + SCAN_PAUSE + this.beamH) / SCAN_SPEED * MS_PER_S;
    };

    // The part of the layer on screen, one viewport tall (all of a shorter layer), in layer px
    Field.prototype.area = function () {
        var layerH = this.layer.clientHeight;
        var height = Math.min(layerH, window.innerHeight);
        return {
            top: Math.round(clamp(-this.layer.getBoundingClientRect().top, 0, layerH - height)),
            width: this.layer.clientWidth,
            height: height
        };
    };

    // Fits the canvas to the area on screen; a new size or place starts it over
    Field.prototype.sync = function () {
        var area = this.area();
        var ratio = Math.min(window.devicePixelRatio || 1, PIXEL_RATIO_MAX);
        var style = this.canvas.style;
        if (area.width !== this.view.width || area.height !== this.view.height || ratio !== this.ratio) {
            this.ratio = ratio;
            this.canvas.width = Math.round(area.width * ratio);
            this.canvas.height = Math.round(area.height * ratio);
            style.width = area.width + PX;
            style.height = area.height + PX;
            this.forget();
        }
        if (area.top !== this.view.top) {
            style.transform = TRANSLATE_Y + area.top + PX + CLOSE;
            this.clear();
        }
        this.view = area;
    };

    // Random hole on screen
    Field.prototype.slot = function () {
        var area = this.area();
        var rowMin = Math.ceil(area.top / this.rowH) + EDGE_CELLS;
        var rowMax = Math.floor((area.top + area.height) / this.rowH) - EDGE_CELLS;
        var colMax = Math.floor(area.width / this.cellW) - EDGE_CELLS;
        var row = randomInt(rowMin, Math.max(0, rowMax - rowMin));
        var col = randomInt(EDGE_CELLS, Math.max(0, colMax - EDGE_CELLS));
        return {
            x: (col + (row % ROW_PARITY) * ODD_ROW_SHIFT) * this.cellW,
            y: row * this.rowH,
            roomLeft: col - EDGE_CELLS,
            roomRight: colMax - col
        };
    };

    Field.prototype.placeCell = function (cell) {
        var slot = this.slot();
        cell.x = slot.x;
        cell.y = slot.y;
    };

    // The packet runs from its hole towards the side with more room
    Field.prototype.placePacket = function () {
        var slot = this.slot();
        var cells = Math.min(randomInt(PACKET_CELLS_MIN, PACKET_CELLS_SPREAD), Math.max(slot.roomLeft, slot.roomRight));
        this.packet.x = slot.x;
        this.packet.y = slot.y;
        this.packet.run = (slot.roomLeft > slot.roomRight ? RUN_LEFT : RUN_RIGHT) * cells * this.cellW;
    };

    Field.prototype.placeAll = function () {
        this.cells.forEach(this.placeCell, this);
        this.placePacket();
    };

    // Shape of a box given in layer px
    Field.prototype.shape = function (image, x, y, width, height, alpha) {
        var r = this.ratio;
        return alpha > 0 ? new Shape(image, x * r, (y - this.view.top) * r, width * r, height * r, alpha) : null;
    };

    // A glow centred at `y` reaches into the canvas
    Field.prototype.inView = function (y) {
        var reach = this.sparkSize * HALF;
        return y + reach > this.view.top && y - reach < this.view.top + this.view.height;
    };

    Field.prototype.glow = function (effect, x, y, alpha) {
        var size = this.sparkSize;
        effect.shape = this.shape(effect.image, x - size * HALF, y - size * HALF, size, size, alpha);
    };

    // Each update* sets the shape of its effect (none while dark or off the canvas) and returns 0 while it is lit,
    // otherwise the ms until it may light up. A new cycle starts dark: the effect moves to a new hole on screen then.
    Field.prototype.updateCell = function (cell, clock) {
        var phase;
        cell.shape = null;
        if (cell.loop.advance(clock)) {
            this.placeCell(cell);
        }
        phase = cell.loop.phase(clock);
        if (phase >= keysEnd(FLICKER) || !this.inView(cell.y)) {
            return cell.loop.left(clock);
        }
        this.glow(cell, cell.x, cell.y, keyframe(FLICKER, phase));
        return 0;
    };

    Field.prototype.updatePacket = function (clock) {
        var packet = this.packet;
        var phase;
        packet.shape = null;
        if (packet.loop.advance(clock)) {
            this.placePacket();
        }
        phase = packet.loop.phase(clock);
        if (phase >= keysEnd(PACKET) || !this.inView(packet.y)) {
            return packet.loop.left(clock);
        }
        this.glow(packet, packet.x + packet.run * phase / PACKET_RUN, packet.y, keyframe(PACKET, phase));
        return 0;
    };

    Field.prototype.updateBeam = function (clock) {
        var beam = this.beam;
        var top = this.view.top;
        var bottom;
        beam.shape = null;
        if (beam.loop.advance(clock)) {
            beam.loop.duration = this.scanTime();   // a new layer height applies from the next sweep on
        }
        bottom = (clock - beam.loop.start) * SCAN_SPEED / MS_PER_S;
        if (bottom <= top) {
            return (top - bottom) / SCAN_SPEED * MS_PER_S;
        }
        if (bottom - this.beamH >= top + this.view.height) {
            return beam.loop.left(clock) + top / SCAN_SPEED * MS_PER_S;
        }
        beam.shape = this.shape(beam.image, 0, bottom - this.beamH, this.view.width, this.beamH, 1);
        return 0;
    };

    // Nothing is drawn on the canvas any more (it has been cleared)
    Field.prototype.forget = function () {
        this.effects.forEach(function (fx) {
            fx.drawn = null;
        });
    };

    // Clearing an empty canvas would still make the browser recomposite all of it
    Field.prototype.clear = function () {
        var drawn = this.effects.some(function (fx) {
            return fx.drawn !== null;
        });
        if (drawn) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.forget();
        }
    };

    // Updates only the pixels of the effects that look different: their old and new boxes are cleared
    // and every effect reaching into them is drawn again there, so the browser recomposites just that part
    Field.prototype.paint = function () {
        var ctx = this.ctx;
        var dirty = [];
        this.effects.forEach(function (fx) {
            if (fx.shape && fx.shape.matches(fx.drawn)) {
                fx.shape = fx.drawn;
            } else if (fx.shape !== fx.drawn) {
                dirty.push.apply(dirty, [fx.drawn, fx.shape].filter(Boolean));
            }
        });
        if (!dirty.length) {
            return;
        }
        ctx.save();
        ctx.beginPath();
        dirty.forEach(function (box) {
            ctx.rect(box.left, box.top, box.right - box.left, box.bottom - box.top);
        });
        ctx.clip();
        dirty.forEach(function (box) {
            ctx.clearRect(box.left, box.top, box.right - box.left, box.bottom - box.top);
        });
        this.effects.forEach(function (fx) {
            var shape = fx.shape;
            if (shape && dirty.some(shape.overlaps, shape)) {
                ctx.globalAlpha = shape.alpha;
                ctx.drawImage(shape.image, shape.x, shape.y, shape.width, shape.height);
            }
            fx.drawn = shape;
        });
        ctx.restore();
    };

    // Returns the ms until something lights up (0 while something is lit)
    Field.prototype.render = function (clock) {
        var wait = Infinity;
        var i;
        for (i = 0; i < this.cells.length; i++) {
            wait = Math.min(wait, this.updateCell(this.cells[i], clock));
        }
        wait = Math.min(wait, this.updatePacket(clock), this.updateBeam(clock));
        this.paint();
        return wait;
    };

    Field.prototype.frame = function (time) {
        var wait;
        this.request = null;
        if (this.time !== null) {
            this.clock += time - this.time;
        }
        this.time = time;
        this.last = time;
        if (this.tooSlow(time)) {
            switchOff();
            return;
        }
        this.sync();
        wait = this.render(this.clock);
        this.sleeping = wait > 0;
        // a pause before the next effect is not a slow frame
        this.prevFrame = this.sleeping ? null : time;
        this.schedule(wait);
    };

    // Judges the intervals between frames of uninterrupted runs, SAMPLE_FRAMES at a time
    Field.prototype.tooSlow = function (time) {
        var slow;
        if (this.prevFrame === null || this.clock < WARMUP_MS) {
            return false;
        }
        this.sampleMs += time - this.prevFrame;
        this.sampleFrames++;
        if (this.sampleFrames < SAMPLE_FRAMES) {
            return false;
        }
        slow = this.sampleMs / this.sampleFrames > SLOW_FRAME_MS;
        this.sampleMs = 0;
        this.sampleFrames = 0;
        return slow;
    };

    Field.prototype.tick = function () {
        this.timer = null;
        this.request = window.requestAnimationFrame(this.frame);
    };

    // Next frame `wait` ms after the last one, at most FPS_MAX frames a second
    Field.prototype.schedule = function (wait) {
        window.clearTimeout(this.timer);
        this.timer = window.setTimeout(this.tick, this.last + Math.max(wait, FRAME_MS) - now() - TIMER_LEAD_MS);
    };

    // An asleep field may have an effect scrolled (or resized) into view
    Field.prototype.wake = function () {
        if (this.running && this.sleeping && this.timer !== null) {
            this.sleeping = false;
            this.schedule(0);
        }
    };

    Field.prototype.update = function () {
        var running = !switchedOff && this.visible && !document.hidden && !(motion && motion.matches);
        if (running === this.running) {
            return;
        }
        this.running = running;
        this.sleeping = false;
        this.prevFrame = null;
        window.clearTimeout(this.timer);
        window.cancelAnimationFrame(this.request);
        this.timer = null;
        this.request = null;
        if (running) {
            this.time = null;
            this.schedule(0);
        } else {
            this.clear();
        }
    };

    Field.prototype.setVisible = function (visible) {
        // re-place everything when the layer scrolls into view, so the effects start on screen
        if (visible && !this.visible) {
            this.placeAll();
        }
        this.visible = visible;
        this.update();
    };

    function refresh() {
        fields.forEach(function (field) {
            field.update();
        });
    }

    // The browser cannot keep up: static background only, for the rest of the session
    function switchOff() {
        switchedOff = true;
        rememberOff();
        refresh();
    }

    function wake() {
        fields.forEach(function (field) {
            field.wake();
        });
    }

    function observe() {
        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                fields.forEach(function (field) {
                    if (field.layer === entry.target) {
                        field.setVisible(entry.isIntersecting);
                    }
                });
            });
        });
        fields.forEach(function (field) {
            observer.observe(field.layer);
        });
    }

    function init() {
        var layers = document.querySelectorAll(LAYER_SELECTOR);
        var style;
        var canvas;
        var ctx;
        var i;
        if (rememberedOff()) {
            return;
        }
        for (i = 0; i < layers.length; i++) {
            style = window.getComputedStyle(layers[i]);
            canvas = document.createElement(CANVAS_TAG);
            ctx = canvas.getContext && canvas.getContext(CONTEXT_TYPE);
            // no CSS custom properties or no canvas: keep the static background only
            if (ctx && readNumber(style, CELL_W_VAR) && readNumber(style, ROW_H_VAR)) {
                canvas.className = FX_CLASS;
                layers[i].appendChild(canvas);
                fields.push(new Field(layers[i], style, ctx));
            }
        }
        if (!fields.length) {
            return;
        }
        if (window.IntersectionObserver) {
            observe();
        }
        if (motion) {
            if (motion.addEventListener) {
                motion.addEventListener(EVENT_CHANGE, refresh);
            } else {
                motion.addListener(refresh);
            }
        }
        document.addEventListener(EVENT_VISIBILITY, refresh);
        window.addEventListener(EVENT_SCROLL, wake, PASSIVE);
        window.addEventListener(EVENT_RESIZE, wake);
        refresh();
    }

    init();
})();
