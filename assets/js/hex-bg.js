/*
 * hex-bg.js - animated layer of the vector hex grille background (see hex-bg.scss).
 * Light flows behind the holes of the fixed grille: a funnel of light from edge to edge of the visible area, tokens
 * streaming into the AI. A diagonal band with a dense bright core and scattered edges that pulse in waves enters at
 * the lower left edge wide and sparse, gathers towards the middle, where it is liveliest, then narrows, speeds up and
 * heats up and runs off the top right edge, as if sucked in there; the pattern inside it streams towards the top
 * right. The mouse sends ripples through it (a tap: one ripple); while the mouse rests, faint ripples run along the
 * middle of the band by themselves.
 * Everything is placed on the layer, so the light scrolls together with the grille; the band rides along while the
 * page scrolls and glides back to its place in the visible area afterwards.
 * Once the visitor runs a command in the console (script.js announces it with CONSOLE_COMMAND_EVENT), the light
 * fades out and comes back as the black hole of hex-bg-blackhole.js, for the rest of the page view.
 * The light is drawn on a 2D canvas (.hex-bg__fx) under the grille, one canvas pixel per half hole, so every hole gets
 * one colour and the browser only scales a tiny image. The canvas covers only the part of the layer on screen and is
 * updated at most FPS_MAX times a second; nothing runs offscreen, in a hidden tab or with reduced motion. When the
 * browser cannot keep up with the frames (software rendering in a VM, a weak device), the effect switches off for the
 * rest of the session, whatever scene it shows.
 * Structure: a Field runs the light of one layer (canvas, frames, pauses, auto-off, mouse ripples); what the light
 * shows is the field's scene (see Scenes): the funnel here, the black hole in hex-bg-blackhole.js, which plugs in
 * through the API this file puts on window (see api).
 */
(function () {
    'use strict';

    var NAMESPACE = 'hexBg';                // window.hexBg: the API for the scenes of other files (see api)
    var CONSOLE_COMMAND_EVENT = 'console-command';  // dispatched on document by script.js (the same constant there)
    var LAYER_SELECTOR = '.hex-bg';
    var FX_CLASS = 'hex-bg__fx';
    var FX_ON_CLASS = 'hex-bg__fx--on';     // shown (fades in and out in CSS)
    var CANVAS_TAG = 'canvas';
    var CONTEXT_TYPE = '2d';
    // Set on .hex-bg by hex-bg.scss: grid pitch and the colour ramp of the light ("r g b alpha offset, ...")
    var CELL_W_VAR = '--hex-bg-cell-w';
    var ROW_H_VAR = '--hex-bg-row-h';
    var LIGHT_VAR = '--hex-bg-light';
    var STOP_SEPARATOR = ',';
    var FIELD_SEPARATOR = /\s+/;
    var RGBA_FIELDS = 4;                    // r g b alpha, then the offset
    var ALPHA_FIELD = 3;
    var BYTE_MAX = 255;
    var REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
    var EVENT_CHANGE = 'change';
    var EVENT_VISIBILITY = 'visibilitychange';
    var EVENT_POINTER_MOVE = 'pointermove';
    var EVENT_POINTER_UP = 'pointerup';
    var POINTER_TOUCH = 'touch';
    var PASSIVE = { passive: true };
    var TRANSLATE = 'translate(';
    var PX = 'px';
    var COMMA = ',';
    var CLOSE = ')';
    var MS_PER_S = 1000;
    var HALF = 0.5;
    var TAU = Math.PI * 2;
    var DEG = Math.PI / 180;

    // ---- Frames
    var FPS_MAX = 30;
    var FRAME_MS = MS_PER_S / FPS_MAX;
    var TIMER_LEAD_MS = 2;                  // the timer wakes a bit early, the frame itself waits for the vsync

    // ---- Auto-off: frames of an uninterrupted run come much slower than FPS_MAX
    var WARMUP_MS = 2000;                   // the first frames after the start (or of a new scene) are not judged
    var SAMPLE_FRAMES = 45;                 // about 1.5 s of continuous frames per verdict
    var SLOW_FRAME_MS = FRAME_MS * 2;       // average interval above this: slower than FPS_MAX / 2
    var OFF_KEY = 'hex-bg-fx-off';          // sessionStorage: remembered for the rest of the tab session
    var OFF_VALUE = '1';

    // ---- Grid: canvas pixels are half a hole wide and one row tall; odd rows are shifted by half a hole
    var PIXELS_PER_HOLE = 2;
    var HOLE_SHIFT = 1;                     // log2(PIXELS_PER_HOLE): pixel column >> HOLE_SHIFT = hole
    var ROW_PARITY = 1;                     // r & ROW_PARITY: odd row
    var LEFT_PIXELS = 1;                    // the canvas starts half a hole left of the layer: the hole cut by the edge
    var COL_FIRST = -1;                     // pixel column of the first hole of odd rows (half a hole further left)
    var ODD_ROW_HOLES = 1;                  // so odd rows have one hole more
    var EDGE_ROWS = 2;                      // rows cut by the top and the bottom edge of the visible part
    var MARGIN_ROWS = 2;                    // rows drawn beyond each edge: a fast scroll does not uncover the edge
                                            // before the next frame

    // ---- Colour ramp: light intensity 0..1 -> colour of a hole
    var LUT_SIZE = 256;
    var LUT_MAX = LUT_SIZE - 1;

    // ---- Random values 0..1: a tile of NOISE_SIZE^2 holes repeated over the grille, or texels of a pattern
    var NOISE_SIZE = 64;
    var NOISE_MASK = NOISE_SIZE - 1;

    // ---- Ripples of every scene: rings from the recent points of the mouse path (lengths in holes)
    var TRAIL_MAX = 16;
    var TRAIL_STEP = 1.5;                   // between path points, and at least TRAIL_INTERVAL_MS: separate rings
    var TRAIL_INTERVAL_MS = 90;
    var RIPPLE_LIFE = 1.3;                  // s
    var RIPPLE_REACH = 7;                   // at the end of the life
    var RIPPLE_WIDTH = 0.8;
    var RIPPLE_SHELL = 2;                   // ring widths drawn on each side
    var RIPPLE_WOBBLE = 1;                  // rings are wavy, like on water
    var RIPPLE_WOBBLE_K = 1;                // rad per hole
    var RIPPLE_WOBBLE_SPEED = 4;            // rad/s
    var RIPPLE_PEAK = 1;                    // light of a ring crest
    // ---- Ambient ripples while the mouse rests: each source lights a new ring every cycle, at a place of the scene
    var AMBIENT_RATE = 0.2;                 // rings per s per source
    var AMBIENT_REACH = 6;                  // holes at the end of a cycle
    var AMBIENT_WIDTH = 1.1;                // holes
    var AMBIENT_RISE = 0.1;                 // share of a cycle the ring takes to light up
    var AMBIENT_IDLE_MS = 2500;             // they return this long after the last mouse move over the layer

    // ---- Funnel. Pattern streaming through the band: fine grain and streaks along the flow (lengths in holes,
    // times in s)
    var FLOW_ANGLE = -28 * DEG;             // up and to the right
    var FLOW_SPEED = 1.4;                   // holes per s
    var GRAIN_SIZE = 1;                     // holes per texel
    var GRAIN_GAIN = 0.3;                   // the grain makes a hole up to this share lighter or darker
    var STREAK_LENGTH = 4;                  // holes per texel along the flow
    var STREAK_WIDTH = 1.6;                 // holes per texel across it
    var STREAK_GAIN = 0.4;                  // the same for the streaks
    var FLOW_CALM = 0.45;                   // share of both gains left far from the middle: the middle is livelier

    // ---- Band: along the diagonal of the visible area, centred slightly low
    var BAND_ANGLE_MIN = 25 * DEG;
    var BAND_ANGLE_MAX = 60 * DEG;
    var BAND_CENTER_X = 0.5;                // share of the visible width
    var BAND_CENTER_Y = 0.56;               // share of the visible height
    var BAND_HALF = 0.18;                   // half width of the core, share of the shorter side
    var BAND_LENGTH = 0.4;                  // the flow calms down away from the middle with this radius (Gaussian),
                                            // share of the diagonal
    // ---- Funnel, from the middle to each edge of the visible area. At the lower left edge (the mouth) the band is
    // wider and sparser; at the top right edge it is narrower and denser, its pattern streams faster and its core is
    // hotter
    var MOUTH_FLARE = 0.35;                 // share of the width gained at the lower left edge
    var MOUTH_THIN = 0.3;                   // share of the density lost there
    var FUNNEL_TAPER = 0.45;                // share of the width lost at the top right edge
    var FUNNEL_GAIN = 0.25;                 // the band is this much denser there
    var FUNNEL_ACCEL = 2;                   // the flow is this many times faster again there
    var FUNNEL_HEAT = 1.5;                  // the hot core is this many times hotter again there
    var CORE_POWER = 1.5;                   // falloff of the core across the band: exp(-d^CORE_POWER), d in half widths
    var HALO_REACH = 2;                     // the scattered halo reaches this many core half widths (Gaussian)
    var HALO_GAIN = 0.3;
    var DITHER = 0.5;                       // where the band thins, holes drop out at random
    var SNAKE_AMP = 0.1;                    // the band bends like a ribbon: core half widths
    var SNAKE_WAVE = 34;                    // holes along the band
    var SNAKE_SPEED = 2.2;                  // rad/s
    var LIGHT_GAIN = 0.62;                  // the band mostly stays below the ripple crests
    // Profile of the band across it, tabulated once: PROFILE_SIZE steps over PROFILE_REACH core half widths
    var PROFILE_SIZE = 256;
    var PROFILE_REACH = 6;                  // beyond it the halo is dark
    // The band rides along with the grille while the page scrolls and glides back to its place when it stops
    var BAND_SCROLL_SPEED = 90;             // px/s at most while the page scrolls: a few px per frame
    var BAND_GLIDE_TIME = 0.5;              // s: time constant of the glide back
    var BAND_GLIDE_SPEED = 1200;            // px/s at most
    var BAND_LAG_MAX = 1.5;                 // visible heights: a band trailing further is out of sight anyway

    // ---- Hot core: the densest part of the band, frayed by the grain along its edges
    var CORE_START = 0.75;                  // band density where the hot core starts
    var CORE_FRAY = 1.3;                    // fraying fades out this fast away from the core edge
    var CORE_GAIN = 0.12;

    // ---- Edge waves: travel outwards from the core and pulse the scattered edges down to dark and back
    var DEPTH_START = 0.2;                  // edge depth: 0 in the core, 1 far out in the halo
    var DEPTH_RANGE = 0.6;
    var WAVE_LENGTH = 5;                    // holes
    var WAVE_SPEED = 3.4;                   // rad/s
    var WAVE_PHASE = 0.6 * TAU;             // random phase of a hole, at most
    var TURB_GAIN = 1.6;                    // swirling noise on the edge waves
    var TURB_X_LENGTH = 13;                 // holes, with its speed in rad/s
    var TURB_X_SPEED = 0.6;
    var TURB_Y_LENGTH = 9;
    var TURB_Y_SPEED = -0.85;
    var TURB_XY_LENGTH = 17;                // diagonal swirl
    var TURB_XY_SPEED = 0.4;

    // ---- Ripples in the band
    var RIPPLE_GAIN = 0.85;                 // how much a ring lights the holes of the band up
    var RIPPLE_FLOOR = 0.35;                // share of that outside the band: calm behind the heading
    var AMBIENT_COUNT = 4;                  // ambient sources in the middle of the band
    var AMBIENT_GAIN = 0.45;
    var AMBIENT_SPREAD_U = 0.3;             // along the band: share of the BAND_LENGTH radius
    var AMBIENT_SPREAD_V = 0.4;             // across it: share of the core half width

    var fields = [];
    var motion = window.matchMedia ? window.matchMedia(REDUCED_MOTION_QUERY) : null;
    var switchedOff = false;
    var listening = false;                  // pointer listeners are on while some field runs
    // Character of every hole: fraying (of the edge and of the hot core), phase of the edge waves (and of the
    // ambient rings of every scene); texels of the streaming grain and streaks
    var frayNoise = randomTable();
    var phaseNoise = randomTable();
    var grainNoise = randomTable();
    var streakNoise = randomTable();
    // Band density across it (core and halo) and the core alone, by distance from the axis
    var profileEnv = new Float32Array(PROFILE_SIZE);
    var profileCore = new Float32Array(PROFILE_SIZE);
    // Recent points of the mouse path in page px, a ring buffer
    var trail = {
        x: new Float64Array(TRAIL_MAX),
        y: new Float64Array(TRAIL_MAX),
        born: new Float64Array(TRAIL_MAX),
        seed: new Float64Array(TRAIL_MAX),
        next: 0,
        count: 0,
        step: 0                             // px between points
    };
    // API for the scenes of other files, loaded after this one (window.hexBg): a scene file sets consoleScene (a
    // scene constructor, see Scenes) and takes the grid, the maths and the shared random table from here
    var api = window[NAMESPACE] = {
        consoleScene: null,                 // the scene the light turns into after a console command
        HALF: HALF,
        TAU: TAU,
        DEG: DEG,
        PIXELS_PER_HOLE: PIXELS_PER_HOLE,
        HOLE_SHIFT: HOLE_SHIFT,
        ROW_PARITY: ROW_PARITY,
        RGBA_FIELDS: RGBA_FIELDS,
        ALPHA_FIELD: ALPHA_FIELD,
        BYTE_MAX: BYTE_MAX,
        LUT_MAX: LUT_MAX,
        NOISE_SIZE: NOISE_SIZE,
        RIPPLE_PEAK: RIPPLE_PEAK,
        clamp: clamp,
        smoothstep: smoothstep,
        noiseIndex: noiseIndex,
        smoothNoise: smoothNoise,
        randomTable: randomTable,
        phaseNoise: phaseNoise              // random phase of every hole (and of every ambient ring)
    };

    function now() {
        return window.performance.now();
    }

    function reducedMotion() {
        return !!motion && motion.matches;
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    // Random values whose columns repeat every `period` cells (a divisor of NOISE_SIZE; by default no repeat)
    function randomTable(period) {
        var table = new Float32Array(NOISE_SIZE * NOISE_SIZE);
        var i;
        var col;
        period = period || NOISE_SIZE;
        for (i = 0; i < table.length; i++) {
            col = i % NOISE_SIZE;
            table[i] = col < period ? Math.random() : table[i - col + col % period];
        }
        return table;
    }

    function buildProfile() {
        var i;
        var d;
        var halo;
        for (i = 0; i < PROFILE_SIZE; i++) {
            d = i / PROFILE_SIZE * PROFILE_REACH;
            halo = d / HALO_REACH;
            profileCore[i] = Math.exp(-Math.pow(d, CORE_POWER));
            profileEnv[i] = profileCore[i] + HALO_GAIN * Math.exp(-halo * halo);
        }
    }

    // 0..1 -> -1..1
    function centered(value) {
        return value * 2 - 1;
    }

    // 0..1 -> 0..1 with flat ends
    function smoothstep(share) {
        return share * share * (3 - 2 * share);
    }

    // Index of a cell (hole or texel) in a random table
    function noiseIndex(col, row) {
        return (row & NOISE_MASK) * NOISE_SIZE + (col & NOISE_MASK);
    }

    // Smooth value noise at (x, y) in texels
    function smoothNoise(table, x, y) {
        var ix = Math.floor(x);
        var iy = Math.floor(y);
        var fx = x - ix;
        var fy = y - iy;
        var a = table[noiseIndex(ix, iy)];
        var b = table[noiseIndex(ix + 1, iy)];
        var c = table[noiseIndex(ix, iy + 1)];
        var d = table[noiseIndex(ix + 1, iy + 1)];
        fx = smoothstep(fx);
        fy = smoothstep(fy);
        a += (b - a) * fx;
        c += (d - c) * fx;
        return a + (c - a) * fy;
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
            // the effect is off on this page anyway
        }
    }

    function readNumber(style, name) {
        return parseFloat(style.getPropertyValue(name));
    }

    // ms the canvas takes to fade in or out (its opacity transition in hex-bg.scss)
    function fadeMs(canvas) {
        return parseFloat(window.getComputedStyle(canvas).transitionDuration) * MS_PER_S || 0;
    }

    // Colour of every light intensity, as canvas pixels (no canvas read-back: it is blocked by anti-fingerprinting)
    function lightRamp(style) {
        var stops = style.getPropertyValue(LIGHT_VAR).split(STOP_SEPARATOR).map(function (stop) {
            return stop.trim().split(FIELD_SEPARATOR).map(parseFloat);
        });
        var bytes = new Uint8ClampedArray(LUT_SIZE * RGBA_FIELDS);
        var s = 0;
        var i;
        var k;
        var from;
        var to;
        var share;
        for (i = 0; i < LUT_SIZE; i++) {
            while (s < stops.length - 2 && i / LUT_MAX > stops[s + 1][RGBA_FIELDS]) {
                s++;
            }
            from = stops[s];
            to = stops[s + 1];
            share = clamp((i / LUT_MAX - from[RGBA_FIELDS]) / (to[RGBA_FIELDS] - from[RGBA_FIELDS]), 0, 1);
            for (k = 0; k < RGBA_FIELDS; k++) {
                bytes[i * RGBA_FIELDS + k] = (from[k] + (to[k] - from[k]) * share) * (k === ALPHA_FIELD ? BYTE_MAX : 1);
            }
        }
        return new Uint32Array(bytes.buffer);
    }

    // ---- Mouse path, shared by all layers (page px, so a point stays put while the page scrolls)

    function pageX(e) {
        return e.clientX + window.pageXOffset;
    }

    function pageY(e) {
        return e.clientY + window.pageYOffset;
    }

    function addPoint(e) {
        var i = trail.next;
        trail.x[i] = pageX(e);
        trail.y[i] = pageY(e);
        trail.born[i] = now();
        trail.seed[i] = Math.random() * TAU;
        trail.next = (i + 1) % TRAIL_MAX;
        trail.count = Math.min(trail.count + 1, TRAIL_MAX);
    }

    function onPointerMove(e) {
        var last = (trail.next + TRAIL_MAX - 1) % TRAIL_MAX;
        var dx = pageX(e) - trail.x[last];
        var dy = pageY(e) - trail.y[last];
        // a finger moving on the screen scrolls the page: only taps make ripples
        if (e.pointerType === POINTER_TOUCH || (trail.count && (dx * dx + dy * dy < trail.step * trail.step ||
            now() - trail.born[last] < TRAIL_INTERVAL_MS))) {
            return;
        }
        addPoint(e);
    }

    function onPointerUp(e) {
        if (e.pointerType === POINTER_TOUCH) {
            addPoint(e);
        }
    }

    // ---- Field: the light of one layer (all lengths in layer px)
    // Scenes: what the light of a field shows. A scene is made for one field by `new Scene(field)` and draws into the
    // field's buffers; its prototype has:
    //   place(width, height)   lays the picture out for the visible part of the layer (px): on the first frame, after
    //                          a resize, when the scene is made for a switch (so a slow layout comes right at the
    //                          command, not in a frame later on) and again when it is swapped in (the canvas and the
    //                          buffers are sized by then); a scene redoes a slow layout only for a new size
    //   resume()               the field runs again after a pause
    //   mouseSpot(x, y, life)  sets field.spot to the centre of the ring of a point of the mouse path at (x, y); life:
    //                          share of the ring's life gone, 0..1
    //   ambientSpot(n)         sets field.spot to the centre of a new ambient ring; n: its index in the random tables
    //   ambientCount, ambientGain: ambient sources and the light of their rings
    //   render(t, dt)          draws a frame into field.pixels: first field.ripples() for the light of the rings per
    //                          hole (field.ripple); t: s on the scene clock, dt: s since the previous frame

    function Field(layer, style, ctx) {
        this.layer = layer;
        this.canvas = ctx.canvas;
        this.ctx = ctx;
        this.cellW = readNumber(style, CELL_W_VAR);
        this.rowH = readNumber(style, ROW_H_VAR);
        this.pixelW = this.cellW / PIXELS_PER_HOLE;
        this.ramp = lightRamp(style);
        // the part of the layer on screen (from `top` down) and where the layer is on the page
        this.view = { top: 0, width: 0, height: 0, layerH: 0, pageLeft: 0, pageTop: 0 };
        this.scrolled = false;              // the page moved since the last frame
        this.pointerTime = -Infinity;       // when the mouse was last over the layer
        this.cols = 0;                      // canvas size in pixels
        this.rows = 0;
        this.holesPerRow = 0;
        this.firstRow = null;               // grid row of the top canvas row
        this.image = null;
        this.pixels = null;                 // Uint32 view of the image
        this.ripple = null;                 // light of the ripples per hole
        // the ring being drawn (see ring) and the centre of the next one, set by the scene
        this.ringState = { x: 0, radius: 0, widthSq: 0, shell: 0, strength: 0, spin: 0,
            wobble: RIPPLE_WOBBLE * this.cellW, wobbleK: RIPPLE_WOBBLE_K / this.cellW };
        this.spot = { x: 0, y: 0 };
        this.scene = new Funnel(this);
        this.next = null;                   // the scene to swap in (see switchTo)
        this.shown = false;                 // the canvas is faded in, or fading in
        this.hiddenAt = -Infinity;          // when the canvas started to fade out
        this.clock = 0;                    // ms the scene has been running: it keeps its phase while paused
        this.time = null;                   // timestamp of the last frame since the field (re)started
        this.last = 0;                      // timestamp of the last frame
        // with an observer the first callback reports the real state
        this.visible = !window.IntersectionObserver;
        this.running = false;
        this.prevFrame = null;              // timestamp of the previous frame of an uninterrupted run
        this.sampleMs = 0;                  // frame intervals summed for the current verdict
        this.sampleFrames = 0;
        this.timer = null;
        this.request = null;
        this.swapTimer = null;
        this.tick = this.tick.bind(this);
        this.frame = this.frame.bind(this);
        this.swap = this.swap.bind(this);
    }

    // Fits the canvas to the part of the layer on screen, one viewport tall (all of a shorter layer): whole rows of
    // holes, the hole cut by the left edge included
    Field.prototype.sync = function () {
        var view = this.view;
        var style = this.canvas.style;
        var rect = this.layer.getBoundingClientRect();
        var width = this.layer.clientWidth;
        var layerH = this.layer.clientHeight;
        var height = Math.min(layerH, window.innerHeight);
        var top = Math.round(clamp(-rect.top, 0, layerH - height));
        var firstRow;
        this.scrolled = top !== view.top;
        view.top = top;
        view.pageLeft = rect.left + window.pageXOffset;
        view.pageTop = rect.top + window.pageYOffset;
        view.layerH = layerH;
        if (width !== view.width || height !== view.height) {
            view.width = width;
            view.height = height;
            this.cols = Math.ceil(width / this.pixelW) + LEFT_PIXELS;
            this.rows = Math.ceil(height / this.rowH) + EDGE_ROWS + MARGIN_ROWS * 2;
            this.holesPerRow = Math.ceil(this.cols / PIXELS_PER_HOLE) + ODD_ROW_HOLES;
            this.canvas.width = this.cols;
            this.canvas.height = this.rows;
            style.width = this.cols * this.pixelW + PX;
            style.height = this.rows * this.rowH + PX;
            this.image = this.ctx.createImageData(this.cols, this.rows);
            this.pixels = new Uint32Array(this.image.data.buffer);
            this.ripple = new Float32Array(this.rows * this.holesPerRow);
            this.scene.place(width, height);
            this.firstRow = null;
        }
        firstRow = Math.floor(top / this.rowH) - MARGIN_ROWS;
        if (firstRow !== this.firstRow) {
            this.firstRow = firstRow;
            style.transform = TRANSLATE + -LEFT_PIXELS * this.pixelW + PX + COMMA +
                (firstRow * this.rowH - this.rowH * HALF) + PX + CLOSE;
        }
    };

    // Adds a ring of light around (x, y) to the ripple buffer of the holes it reaches; spin: wobble phase
    Field.prototype.ring = function (x, y, radius, width, strength, spin) {
        var ring = this.ringState;
        var rowH = this.rowH;
        var pixelW = this.pixelW;
        var outer;
        var inner;
        var rowFirst;
        var rowLast;
        var r;
        var dy;
        var reach;
        var gap;
        var base;
        var odd;
        ring.x = x;
        ring.radius = radius;
        ring.widthSq = width * width;
        ring.shell = RIPPLE_SHELL * width;
        ring.strength = strength;
        ring.spin = spin;
        outer = radius + ring.wobble + ring.shell;
        inner = Math.max(0, radius - ring.wobble - ring.shell);
        rowFirst = Math.max(this.firstRow, Math.ceil((y - outer) / rowH));
        rowLast = Math.min(this.firstRow + this.rows - 1, Math.floor((y + outer) / rowH));
        for (r = rowFirst; r <= rowLast; r++) {
            odd = r & ROW_PARITY;
            dy = r * rowH - y;
            reach = Math.sqrt(Math.max(0, outer * outer - dy * dy));
            gap = Math.sqrt(Math.max(0, inner * inner - dy * dy));
            base = (r - this.firstRow) * this.holesPerRow;
            // the row crosses the ring left and right of the centre (or once, through its middle)
            this.ringSpan(odd, base, dy, Math.ceil((x - reach) / pixelW), Math.floor((x - gap) / pixelW));
            this.ringSpan(odd, base, dy, Math.floor((x + gap) / pixelW) + 1, Math.floor((x + reach) / pixelW));
        }
    };

    // Holes of one row between two pixel columns, for the ring being drawn
    Field.prototype.ringSpan = function (odd, base, dy, first, last) {
        var ring = this.ringState;
        var p = Math.max(first, -odd);
        var end = Math.min(last, this.cols - 1);
        var dx;
        var diff;
        p += (p + odd) & ROW_PARITY;        // the holes of this row
        for (; p <= end; p += PIXELS_PER_HOLE) {
            dx = p * this.pixelW - ring.x;
            diff = Math.sqrt(dx * dx + dy * dy) - ring.radius -
                ring.wobble * Math.sin((dx + dy) * ring.wobbleK + ring.spin);
            if (diff < ring.shell && diff > -ring.shell) {
                this.ripple[base + ((p + odd) >> HOLE_SHIFT)] +=
                    ring.strength * Math.exp(-diff * diff / ring.widthSq);
            }
        }
    };

    // Light of the ripples per hole for this frame: rings of the recent mouse path inside the layer and, while the
    // mouse rests there, ambient ones; the scene places them (see Scenes)
    Field.prototype.ripples = function () {
        var view = this.view;
        var scene = this.scene;
        var spot = this.spot;
        var cell = this.cellW;
        var time = this.time;
        var t = this.clock / MS_PER_S;
        var ambient;
        var i;
        var k;
        var age;
        var life;
        var x;
        var y;
        var cycle;
        var phase;
        var n;
        for (i = 0; i < this.ripple.length; i++) {
            this.ripple[i] = 0;
        }
        for (k = 0; k < trail.count; k++) {
            i = (trail.next + TRAIL_MAX - 1 - k) % TRAIL_MAX;
            x = trail.x[i] - view.pageLeft;
            y = trail.y[i] - view.pageTop;
            if (x < 0 || x > view.width || y < 0 || y > view.layerH) {
                continue;
            }
            this.pointerTime = Math.max(this.pointerTime, trail.born[i]);
            age = (time - trail.born[i]) / MS_PER_S;
            if (age >= 0 && age < RIPPLE_LIFE) {
                life = age / RIPPLE_LIFE;
                scene.mouseSpot(x, y, life);
                this.ring(spot.x, spot.y, life * RIPPLE_REACH * cell, RIPPLE_WIDTH * cell,
                    1 - life, trail.seed[i] + age * RIPPLE_WOBBLE_SPEED);
            }
        }
        ambient = clamp((time - this.pointerTime) / AMBIENT_IDLE_MS - 1, 0, 1);
        if (!ambient) {
            return;
        }
        for (k = 0; k < scene.ambientCount; k++) {
            cycle = t * AMBIENT_RATE + k / scene.ambientCount;
            n = Math.floor(cycle);
            phase = cycle - n;
            // a new place for every ring
            n = noiseIndex(n * scene.ambientCount + k, 0);
            scene.ambientSpot(n);
            this.ring(spot.x, spot.y, phase * AMBIENT_REACH * cell, AMBIENT_WIDTH * cell,
                scene.ambientGain * ambient * Math.min(1, phase / AMBIENT_RISE) * (1 - phase),
                TAU * phaseNoise[n] + t * RIPPLE_WOBBLE_SPEED);
        }
    };

    Field.prototype.frame = function (time) {
        var dt = this.time === null ? 0 : time - this.time;
        this.request = null;
        this.clock += dt;
        this.time = time;
        this.last = time;
        if (this.tooSlow(time)) {
            switchOff();
            return;
        }
        this.sync();
        this.scene.render(this.clock / MS_PER_S, dt / MS_PER_S);
        this.ctx.putImageData(this.image, 0, 0);
        // the first frame of a run or of a new scene: the canvas fades in (not while it fades out for a swap)
        if (!this.shown && !this.next) {
            this.shown = true;
            this.canvas.classList.add(FX_ON_CLASS);
        }
        this.prevFrame = time;
        this.schedule();
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

    // Next frame FRAME_MS after the last one: at most FPS_MAX frames a second
    Field.prototype.schedule = function () {
        window.clearTimeout(this.timer);
        this.timer = window.setTimeout(this.tick, this.last + FRAME_MS - now() - TIMER_LEAD_MS);
    };

    // The canvas fades out (the static background stays)
    Field.prototype.hide = function () {
        if (this.shown) {
            this.shown = false;
            this.hiddenAt = now();
            this.canvas.classList.remove(FX_ON_CLASS);
        }
    };

    // Turns the light into another scene. The new scene is laid out at once, while the visitor is at the console; a
    // running field fades its canvas out and swaps the scenes when it is dark, a paused one when it runs again (see
    // update); the first frame of the new scene fades the canvas in
    Field.prototype.switchTo = function (Scene) {
        // a paused field may have missed a resize, or never been sized: the canvas and the buffers are sized first
        if (!this.running || !this.view.width) {
            this.sync();
        }
        this.next = new Scene(this);
        this.next.place(this.view.width, this.view.height);
        this.prevFrame = null;              // the layout is no frame: the auto-off does not judge the gap
        if (this.running) {
            this.hide();
            this.swapWhenDark();
        }
    };

    // Swaps the scenes when the canvas has faded out: at once if it has already
    Field.prototype.swapWhenDark = function () {
        var left = this.hiddenAt + fadeMs(this.canvas) - now();
        if (left > 0) {
            this.swapTimer = window.setTimeout(this.swap, left);
        } else {
            this.swap();
        }
    };

    Field.prototype.swap = function () {
        this.swapTimer = null;
        this.scene = this.next;
        this.next = null;
        // laid out again in case the visible part has changed size since, and on its own clock (so its first frames
        // are not judged by the auto-off either)
        this.scene.place(this.view.width, this.view.height);
        this.clock = 0;
        this.time = null;
    };

    Field.prototype.update = function () {
        var running = !switchedOff && this.visible && !document.hidden && !reducedMotion();
        if (running === this.running) {
            return;
        }
        this.running = running;
        this.prevFrame = null;
        window.clearTimeout(this.timer);
        window.clearTimeout(this.swapTimer);
        window.cancelAnimationFrame(this.request);
        this.timer = null;
        this.swapTimer = null;
        this.request = null;
        // stopped: the canvas fades out; running again: the first frame fades it in (a scene switched to meanwhile
        // swaps in once the canvas is dark: the old one goes on while it still fades out)
        if (running) {
            this.time = null;
            if (this.next) {
                this.swapWhenDark();
            }
            this.scene.resume();
            this.schedule();
        } else {
            this.hide();
        }
    };

    // ---- Funnel: the scene of the page (see Scenes; all lengths in layer px)

    function Funnel(field) {
        var cell = field.cellW;
        this.field = field;
        // wave numbers (per px) of the patterns
        this.k = {
            grain: 1 / (GRAIN_SIZE * cell),
            streakU: 1 / (STREAK_LENGTH * cell),
            streakV: 1 / (STREAK_WIDTH * cell),
            wave: TAU / (WAVE_LENGTH * cell),
            snake: TAU / (SNAKE_WAVE * cell),
            turbX: TAU / (TURB_X_LENGTH * cell),
            turbY: TAU / (TURB_Y_LENGTH * cell),
            swirl: TAU / (TURB_XY_LENGTH * cell)
        };
        // per pixel column, every frame: the parts of the band terms that depend on the column only
        this.columns = { along: null, snakeSin: null, snakeCos: null, turb: null, swirlSin: null, swirlCos: null };
        this.band = { anchor: null, cx: 0, cy: 0, dx: 0, dy: 0, half: 0, length: 0, back: 0, reach: 0 };
    }

    Funnel.prototype.ambientCount = AMBIENT_COUNT;
    Funnel.prototype.ambientGain = AMBIENT_GAIN;

    // The band runs along the diagonal of the visible area (within limits); back and reach: from its middle to where
    // its axis leaves the visible area at the lower left and at the top right
    Funnel.prototype.place = function (width, height) {
        var columns = this.columns;
        var band = this.band;
        var size = this.field.cols - COL_FIRST;
        var angle = clamp(Math.atan2(height, width), BAND_ANGLE_MIN, BAND_ANGLE_MAX);
        var name;
        for (name in columns) {
            if (columns.hasOwnProperty(name)) {
                columns[name] = new Float32Array(size);
            }
        }
        band.anchor = null;
        band.cx = width * BAND_CENTER_X;
        band.dx = Math.cos(angle);
        band.dy = -Math.sin(angle);
        band.half = Math.min(width, height) * BAND_HALF;
        band.length = Math.sqrt(width * width + height * height) * BAND_LENGTH;
        band.back = Math.min(width * BAND_CENTER_X / band.dx, height * (1 - BAND_CENTER_Y) / -band.dy);
        band.reach = Math.min(width * (1 - BAND_CENTER_X) / band.dx, height * BAND_CENTER_Y / -band.dy);
    };

    // The layer was out of sight: the band starts at its place
    Funnel.prototype.resume = function () {
        this.band.anchor = null;
    };

    // The rings stay where the mouse was
    Funnel.prototype.mouseSpot = function (x, y) {
        var spot = this.field.spot;
        spot.x = x;
        spot.y = y;
    };

    // Ambient rings rise at random places in the middle of the band
    Funnel.prototype.ambientSpot = function (n) {
        var band = this.band;
        var spot = this.field.spot;
        var u = centered(grainNoise[n]) * band.length * AMBIENT_SPREAD_U;
        var v = centered(frayNoise[n]) * band.half * AMBIENT_SPREAD_V;
        spot.x = band.cx + u * band.dx - v * band.dy;
        spot.y = band.cy + u * band.dy + v * band.dx;
    };

    // The band anchor (layer px) follows the top of the visible part: slowly while the page scrolls, so the light
    // does not jump back on every frame, then it glides to its place
    Funnel.prototype.follow = function (dt) {
        var band = this.band;
        var view = this.field.view;
        var target = view.top;
        var speed = (this.field.scrolled ? BAND_SCROLL_SPEED : BAND_GLIDE_SPEED) * dt;
        var lag = view.height * BAND_LAG_MAX;
        if (band.anchor === null) {
            band.anchor = target;
        } else {
            band.anchor = clamp(band.anchor +
                clamp((target - band.anchor) * (1 - Math.exp(-dt / BAND_GLIDE_TIME)), -speed, speed),
                target - lag, target + lag);
        }
        band.cy = band.anchor + view.height * BAND_CENTER_Y;
    };

    // Column parts of the band terms: the distance along the band from its middle, the ribbon bend
    // sin(u * k - phase) split into sin/cos of its column and row parts, the edge turbulence and its diagonal swirl
    Funnel.prototype.columnTerms = function (t) {
        var columns = this.columns;
        var band = this.band;
        var k = this.k;
        var pixelW = this.field.pixelW;
        var c;
        var x;
        var a;
        for (c = 0; c < columns.along.length; c++) {
            x = (c + COL_FIRST) * pixelW;
            columns.along[c] = (x - band.cx) * band.dx;
            a = columns.along[c] * k.snake - t * SNAKE_SPEED;
            columns.snakeSin[c] = Math.sin(a);
            columns.snakeCos[c] = Math.cos(a);
            columns.turb[c] = Math.sin(x * k.turbX + t * TURB_X_SPEED);
            a = x * k.swirl + t * TURB_XY_SPEED;
            columns.swirlSin[c] = Math.sin(a);
            columns.swirlCos[c] = Math.cos(a);
        }
    };

    // Light of every hole: band envelope x grain x streaks streaming with the flow x edge waves, hot core, ripples
    Funnel.prototype.render = function (t, dt) {
        var field = this.field;
        var band = this.band;
        var columns = this.columns;
        var k = this.k;
        var pixelW = field.pixelW;
        var rowH = field.rowH;
        var cols = field.cols;
        var pixels = field.pixels;
        var ripple = field.ripple;
        var ramp = field.ramp;
        var dark = ramp[0];
        var flowX = Math.cos(FLOW_ANGLE);
        var flowY = Math.sin(FLOW_ANGLE);
        var flow = FLOW_SPEED * t * field.cellW;   // px the pattern has moved
        var wavePhase = t * WAVE_SPEED;
        var snakeAmp;
        var profileK;
        var flowMiddle;
        var stretch;
        var j;
        var r;
        var p;
        var c;
        var odd;
        var row;
        var holes;
        var hole;
        var noise;
        var X;
        var Y;
        var oy;
        var a;
        var alongY;
        var snakeSinY;
        var snakeCosY;
        var turbY;
        var swirlSinY;
        var swirlCosY;
        var u;
        var v;
        var i;
        var mouth;
        var funnel;
        var middle;
        var strength;
        var env;
        var depth;
        var fray;
        var glow;
        var flowGain;
        var along;
        var across;
        var wave;
        var core;
        var light;
        var color;
        this.follow(dt);
        field.ripples();
        this.columnTerms(t);
        snakeAmp = SNAKE_AMP * band.half;
        profileK = PROFILE_SIZE / (PROFILE_REACH * band.half);
        flowMiddle = band.cx * flowX + band.cy * flowY;    // the middle of the band along the flow
        stretch = band.reach / FUNNEL_ACCEL;               // px: the pattern is twice as fast this far past it
        for (j = 0; j < field.rows; j++) {
            r = field.firstRow + j;
            odd = r & ROW_PARITY;
            Y = r * rowH;
            oy = Y - band.cy;
            alongY = oy * band.dy;
            a = alongY * k.snake;
            snakeSinY = Math.sin(a);
            snakeCosY = Math.cos(a);
            turbY = Math.sin(Y * k.turbY + t * TURB_Y_SPEED);
            a = Y * k.swirl;
            swirlSinY = Math.sin(a);
            swirlCosY = Math.cos(a);
            row = j * cols;
            holes = j * field.holesPerRow;
            for (p = -odd; p < cols; p += PIXELS_PER_HOLE) {
                c = p - COL_FIRST;
                X = p * pixelW;
                hole = (p + odd) >> HOLE_SHIFT;
                noise = noiseIndex(hole, r);
                fray = frayNoise[noise];
                glow = ripple[holes + hole];
                // along the band from its middle (towards the top right) and across it, bent like a ribbon
                u = columns.along[c] + alongY;
                v = Math.abs(oy * band.dx - (X - band.cx) * band.dy - snakeAmp *
                    (columns.snakeSin[c] * snakeCosY + columns.snakeCos[c] * snakeSinY));
                // 0 in the middle, 1 at the lower left (mouth) or the top right edge (funnel)
                mouth = u < 0 ? smoothstep(Math.min(1, -u / band.back)) : 0;
                funnel = u > 0 ? smoothstep(Math.min(1, u / band.reach)) : 0;
                i = (v * profileK / (1 + MOUTH_FLARE * mouth - FUNNEL_TAPER * funnel)) | 0;
                middle = 0;
                strength = 0;
                if (i < PROFILE_SIZE) {
                    a = u / band.length;
                    middle = Math.exp(-a * a);
                    strength = (1 - MOUTH_THIN * mouth) * (1 + FUNNEL_GAIN * funnel);
                }
                env = strength ? Math.min(1, profileEnv[i] * strength) : 0;
                depth = clamp((1 - env - DEPTH_START) / DEPTH_RANGE, 0, 1);
                // scattered edge: where the band thins, holes drop out at random
                env = Math.max(0, env - DITHER * fray * (1 - env));
                if (env > 0 || glow) {
                    light = 0;
                    if (env > 0) {
                        wave = HALF + HALF * Math.sin(v * k.wave - wavePhase + WAVE_PHASE * phaseNoise[noise] +
                            TURB_GAIN * depth * (columns.turb[c] + turbY +
                            columns.swirlSin[c] * swirlCosY - columns.swirlCos[c] * swirlSinY));
                        // grain and streaks stream along the flow, livelier in the middle (and in the funnel, where
                        // the pattern is stretched: it streams faster towards the edge)
                        flowGain = FLOW_CALM + (1 - FLOW_CALM) * Math.max(middle, funnel);
                        along = X * flowX + Y * flowY;
                        if (along > flowMiddle) {
                            along = flowMiddle + stretch * Math.log(1 + (along - flowMiddle) / stretch);
                        }
                        along -= flow;
                        across = Y * flowX - X * flowY;
                        light = env * LIGHT_GAIN * (1 - depth + depth * wave * wave) *
                            (1 + flowGain * GRAIN_GAIN *
                            centered(smoothNoise(grainNoise, along * k.grain, across * k.grain))) *
                            (1 + flowGain * STREAK_GAIN *
                            centered(smoothNoise(streakNoise, along * k.streakU, across * k.streakV)));
                        // hot core: solid along the middle of the band, frayed at its edges
                        core = (profileCore[i] - CORE_START) / (1 - CORE_START);
                        light += CORE_GAIN * (1 + FUNNEL_HEAT * funnel) * clamp(clamp(core, 0, 1) +
                            Math.max(0, 1 - Math.abs(core) * CORE_FRAY) * centered(fray), 0, 1);
                    }
                    if (glow) {
                        light += Math.min(1, glow) * RIPPLE_GAIN *
                            (RIPPLE_FLOOR + (1 - RIPPLE_FLOOR) * (1 - depth)) * (RIPPLE_PEAK - light);
                    }
                    color = ramp[Math.round(clamp(light, 0, 1) * LUT_MAX)];
                } else {
                    color = dark;
                }
                if (p >= 0) {
                    pixels[row + p] = color;
                }
                if (p + 1 < cols) {
                    pixels[row + p + 1] = color;
                }
            }
        }
    };

    // ---- Lifecycle of all fields

    // The mouse path is only recorded while some field shows it
    function listen() {
        var on = fields.some(function (field) {
            return field.running;
        });
        if (on === listening) {
            return;
        }
        listening = on;
        if (on) {
            window.addEventListener(EVENT_POINTER_MOVE, onPointerMove, PASSIVE);
            window.addEventListener(EVENT_POINTER_UP, onPointerUp, PASSIVE);
        } else {
            window.removeEventListener(EVENT_POINTER_MOVE, onPointerMove, PASSIVE);
            window.removeEventListener(EVENT_POINTER_UP, onPointerUp, PASSIVE);
        }
    }

    function refresh() {
        fields.forEach(function (field) {
            field.update();
        });
        listen();
    }

    // The browser cannot keep up: static background only, for the rest of the session
    function switchOff() {
        switchedOff = true;
        rememberOff();
        refresh();
    }

    // The first console command while the light is on turns it into the console scene for the rest of the page view;
    // while it is off (switched off, reduced motion) a command changes nothing
    function onConsoleCommand() {
        if (switchedOff || reducedMotion() || !api.consoleScene) {
            return;
        }
        document.removeEventListener(CONSOLE_COMMAND_EVENT, onConsoleCommand);
        fields.forEach(function (field) {
            field.switchTo(api.consoleScene);
        });
    }

    function observe() {
        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                fields.forEach(function (field) {
                    if (field.layer === entry.target) {
                        field.visible = entry.isIntersecting;
                    }
                });
            });
            refresh();
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
            if (ctx && readNumber(style, CELL_W_VAR) && readNumber(style, ROW_H_VAR) &&
                style.getPropertyValue(LIGHT_VAR)) {
                canvas.className = FX_CLASS;
                layers[i].appendChild(canvas);
                fields.push(new Field(layers[i], style, ctx));
            }
        }
        if (!fields.length) {
            return;
        }
        buildProfile();
        trail.step = fields[0].cellW * TRAIL_STEP;
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
        document.addEventListener(CONSOLE_COMMAND_EVENT, onConsoleCommand);
        refresh();
    }

    init();
})();
