/*
 * hex-bg-blackhole.js - the black hole scene of the hex grille background (see hex-bg.js, hex-bg.scss).
 * hex-bg.js shows it instead of the funnel once the visitor runs a command in the console: this file registers it as
 * the console scene of the API hex-bg.js puts on window (load it after hex-bg.js). It is drawn and paused like the
 * funnel, by the same frames, on the same canvas and with the same mouse ripples.
 * A black hole glows behind the holes of the fixed grille, the way Gargantua looks in "Interstellar": a pitch-dark
 * shadow edged by a thin photon ring; the accretion disk, seen almost edge-on, crosses in front of the shadow as a
 * thin bright band, and its far side, bent round the hole by gravity, arches over the shadow and, thinner, under it.
 * The disk turns differentially (Keplerian: the inner parts faster), its streaks and hot clumps spiral slowly in and
 * vanish at its inner edge, and the side that comes towards the viewer is brighter (Doppler beaming). The picture is
 * traced when the scene is laid out (once per size, the first time right at the command), ray by ray through the
 * curved space round the hole (Schwarzschild light paths); the frames only move the streaks and the clumps.
 * Faint stars twinkle all over the grille; near the hole they are seen through its lens, bent round the shadow.
 * The mouse ripples fall towards the hole, bend round it (lensing) and vanish in the shadow; while the mouse rests,
 * faint ripples rise near the hole by themselves.
 * The hole hangs in the open strip at the top of the layer, above the posts and right of the title, on a hole of the
 * grille: it scrolls with the grille, so nothing of it jumps and it never settles behind the posts.
 */
(function () {
    'use strict';

    var NAMESPACE = 'hexBg';                // the API of hex-bg.js (the same constant there)
    var hexBg = window[NAMESPACE];
    if (!hexBg) {
        return;                             // no hex-bg.js: no light at all
    }

    // ---- From hex-bg.js: grid, colour ramp, maths and the random phase of every hole
    var HALF = hexBg.HALF;
    var TAU = hexBg.TAU;
    var DEG = hexBg.DEG;
    var PIXELS_PER_HOLE = hexBg.PIXELS_PER_HOLE;
    var HOLE_SHIFT = hexBg.HOLE_SHIFT;
    var ROW_PARITY = hexBg.ROW_PARITY;
    var RGBA_FIELDS = hexBg.RGBA_FIELDS;
    var ALPHA_FIELD = hexBg.ALPHA_FIELD;
    var BYTE_MAX = hexBg.BYTE_MAX;
    var LUT_MAX = hexBg.LUT_MAX;
    var NOISE_SIZE = hexBg.NOISE_SIZE;
    var RIPPLE_PEAK = hexBg.RIPPLE_PEAK;
    var clamp = hexBg.clamp;
    var smoothstep = hexBg.smoothstep;
    var noiseIndex = hexBg.noiseIndex;
    var smoothNoise = hexBg.smoothNoise;
    var randomTable = hexBg.randomTable;
    var phaseNoise = hexBg.phaseNoise;

    // ---- The shadow: the darkest colour of the ramp made opaque step by step (the warm background must not shine
    // through the hole)
    var SHADE_SIZE = 64;
    var SHADE_MAX = SHADE_SIZE - 1;

    // ---- The hole hangs in the open strip at the top of the layer, above the posts, and scrolls with the grille
    // (nothing of it jumps, it never settles behind the posts). Its shadow radius is a share of the shorter side of
    // the visible area, at least HOLE_RADIUS_MIN holes (fewer do not draw a disc) and at most HOLE_RADIUS_MAX px (it
    // fits in the strip), in steps of RADIUS_STEP px (a resized window rarely traces it anew); its centre is a share
    // of the width from the left and HOLE_DROP radii below the top (the halo just clears the top edge). Phones
    // (portrait) get a relatively bigger hole in the corner right of the title, HOLE_INSET_NARROW radii from the
    // right edge (the halo runs past it, clear of the title), higher (its halo ends by the end of the title), seen
    // more from above (the shadow stays one dark blob with a ring) and with its disk tilted the other way, away
    // from the heading
    var HOLE_SIZE = 0.095;
    var HOLE_RADIUS_MIN = 2.5;              // holes
    var HOLE_RADIUS_MAX = 80;               // px
    var RADIUS_STEP = 4;                    // px
    var HOLE_X = 0.72;
    var HOLE_DROP = 1.85;
    var HOLE_SIZE_NARROW = 0.16;
    var HOLE_INSET_NARROW = 0.9;
    var HOLE_DROP_NARROW = 1.3;
    var TOP_FADE_ROWS = 3;                  // the light fades in over the top rows: no lit row cut by the edge

    // ---- Ray tracer: lengths in M (G = c = 1), the horizon has the radius 2
    var SHADOW_B = 3 * Math.sqrt(3);        // impact parameter of the photon sphere: the edge of the shadow
    var HORIZON_R = 2;
    var CAPTURE_R = 2.05;                   // a ray this close falls in (just outside the horizon: no stiff steps)
    var CAMERA_R = 40;                      // rays start this far from the hole, parallel (a distant camera)
    var STEP_SHARE = 0.08;                  // integration step, share of the distance to the hole
    var STEPS_MAX = 800;                    // a ray still circling the hole after this many steps falls in
    var BEND = 1.5 * HORIZON_R;             // light bends with the acceleration BEND * h^2 / r^4 towards the hole
    var ELEVATION = 3 * DEG;                // the camera is this much above the plane of the disk
    var ELEVATION_NARROW = 18 * DEG;        // phones: the near side crosses low, under a dark blob
    var ROLL = 9 * DEG;                     // the picture is turned anticlockwise: the disk rises to the right
    var ROLL_NARROW = -30 * DEG;            // phones: clockwise, the disk rises to the left, above the heading
    var SUB_SAMPLES = 3;                    // rays per hole along each axis, averaged: smooth edges
    var LANDED = 0;                         // what became of a ray
    var FELL_IN = 1;
    var ESCAPED = 2;
    var LENSED_COS = Math.cos(25 * DEG);    // a ray bent more than this shows the disk lensed round the hole
    // The disk seen in a hole: its near side and its far side directly (they stream opposite ways), and lensed
    var IMAGE_NEAR = 0;
    var IMAGE_FAR = 1;
    var IMAGE_LENSED = 2;
    var IMAGES = 3;
    // ---- Accretion disk (radii in M)
    var DISK_IN = 6;                        // innermost stable orbit
    var DISK_OUT = 26;
    var DISK_RISE = 1.5;                    // the inner edge lights up over this width
    var DISK_FADE = 9;                      // the outer edge fades out over this width
    var DISK_FALLOFF = 1.5;                 // the glow falls as (DISK_IN / r)^DISK_FALLOFF: a long band...
    var HALO_FALLOFF = 6;                   // ...and a thin halo hugging the shadow where it is seen lensed
    var SPIN = 1;                           // 1: the disk turns so that its left side comes towards the viewer
    var BEAM_SHARE = 0.6;                   // share of the orbital speed that beams the light (the full one would
                                            // put the receding side out)
    var BEAM_POWER = 3;                     // brightness ~ Doppler factor ^ BEAM_POWER
    var EXPOSURE = 4;                       // light = 1 - exp(-brightness * EXPOSURE), of all disk images together
    var EXPOSED_SIZE = 256;                 // table of it up to the brightness EXPOSED_MAX (the light is 1 there)
    var EXPOSED_MAX = 1.5;
    var EXPOSED_SCALE = (EXPOSED_SIZE - 1) / EXPOSED_MAX;
    var LENSED_GAIN = 1.3;                  // the halo (the disk seen lensed) outlines the shadow: a bit brighter
    // ---- Photon ring: a thin bright ring at the edge of the shadow (radii in shadow radii)
    var RING_RADIUS = 1.1;
    var RING_WIDTH = 0.1;
    var RING_GAIN = 2.2;                    // most of a hole is outside the thin ring: its share is small
    var RING_BEAM = 0.25;                   // share of it that follows the beaming: brighter on the approaching side
    var RING_STREAKS = 0.35;                // streaks run round it at the speed of the inner disk (depth of their
                                            // lanes)
    var RING_STREAK_ROW = 0;                // the texel row of the disk streaks they are taken from
    // ---- Streaks of the disk: smooth noise in (azimuth, log radius) that turns with the disk and drifts in
    var TEX_AROUND = 16;                    // texels around the disk (divides NOISE_SIZE: the noise wraps round)
    var TEX_RADIAL = 3;                     // texels per e-fold of the radius
    var TEX_DEPTH = 0.6;                    // dark lanes between the streaks take up to this share of the light
    var LANE_FROM = 0.3;                    // noise below this: no lane...
    var LANE_SPAN = 0.4;                    // ...above LANE_FROM + LANE_SPAN: the darkest lane (sharp streaks)
    var SPIN_RATE = 1.2;                    // rad/s at the inner edge, Keplerian outwards: ~ r^KEPLER_POWER
    var KEPLER_POWER = -1.5;
    var INFLOW = 0.25;                      // radial texels per s: the streaks spiral in
    // ---- Hot clumps in the disk: bright blobs (texels of a sparse table) that orbit with it and spiral in, faster and
    // brighter on the way, until they vanish at the inner edge; seen in every image of the disk, also bent over the
    // shadow when they pass behind it
    var CLUMP_SPACING = 4;                  // radial texels between rings of clumps: about one ring in the disk at a
                                            // time
    var CLUMPS_AROUND = 2;                  // clumps in each ring
    var CLUMP_GAIN = 1.5;                   // a clump is this much brighter than the disk round it...
    var CLUMP_CLEAR = 1;                    // ...and this share of the dark lanes leaves it
    // ---- Traced area round the centre, shadow radii
    var STAMP_HALF_W = 5.3;
    var STAMP_HALF_H = 3.2;
    var SIDES = 2;                          // as many holes (rows) on each side of the centre...
    var CENTRE = 1;                         // ...and the centre one
    // ---- Lens for the stars and the ripples: a point lens of EINSTEIN_RADIUS shadow radii, faded out up to
    // LENS_REACH shadow radii from the centre (within the traced area)
    var EINSTEIN_RADIUS = 1.5;
    var LENS_REACH = STAMP_HALF_H;
    var NEAREST = 2;                        // the place the lens takes them from lies between holes: it is blended
    var LENS_TAPS = NEAREST * NEAREST;      // from the two nearest holes of the two nearest rows

    // ---- Stars: faint holes scattered over the grille (they scroll with it) that twinkle slowly; near the hole they
    // are seen through the lens, pushed out of the shadow and crowded round its ring
    var STAR_SHARE = 0.05;                  // share of the holes
    var STAR_LIMIT = 1 - STAR_SHARE;        // random value of a hole above which it is a star
    var STAR_GAIN = 0.2;                    // light of the brightest star
    var TWINKLE_SPEED = 0.9;                // rad/s

    // ---- Ripples (see hex-bg.js): they light the holes near the hole more and fall towards it
    var RIPPLE_GAIN = 0.6;                  // how much a ring lights a hole up near the hole...
    var RIPPLE_GAIN_FAR = 0.3;              // ...and away from it (calm behind the heading and between the posts)
    var RIPPLE_FALL = 0.6;                  // share of the way to the hole a ring centre falls in its life...
    var FALL_REACH = 4;                     // ...when it starts this many shadow radii away (less further out)
    // ---- Ambient ripples near the hole while the mouse rests
    var AMBIENT_COUNT = 3;
    var AMBIENT_GAIN = 0.35;
    var AMBIENT_NEAR = 1.6;                 // they rise this many shadow radii from the centre...
    var AMBIENT_FAR = 3.5;                  // ...up to this many

    // Texels of the disk streaks (periodic round the disk) and its clumps, the exposure, stars of the holes (also the
    // directions of the ambient rings): built for the first black hole (see buildTables)
    var diskNoise = null;
    var clumpNoise = null;
    var exposed = null;
    var starNoise = null;
    // The camera of the trace (cosine and sine of its elevation) and the disk point a traced ray lands on (see trace)
    var camera = { cos: 1, sin: 0 };
    var hit = { s: 0, x: 0, z: 0, beam: 0, lensed: false };

    // Most page views never show a black hole: its tables are built when the first one is made
    function buildTables() {
        diskNoise = randomTable(TEX_AROUND);
        clumpNoise = clumpTable();
        exposed = exposureTable();
        starNoise = randomTable();
    }

    // Hot clumps: single texels in rings of CLUMPS_AROUND every CLUMP_SPACING rows (periodic round the disk)
    function clumpTable() {
        var table = new Float32Array(NOISE_SIZE * NOISE_SIZE);
        var row;
        var k;
        var col;
        for (row = 0; row < NOISE_SIZE; row += CLUMP_SPACING) {
            for (k = 0; k < CLUMPS_AROUND; k++) {
                for (col = Math.floor(Math.random() * TEX_AROUND); col < NOISE_SIZE; col += TEX_AROUND) {
                    table[noiseIndex(col, row)] = 1;
                }
            }
        }
        return table;
    }

    // Light of every brightness of the disk (see EXPOSURE), EXPOSED_SCALE entries per unit
    function exposureTable() {
        var table = new Float32Array(EXPOSED_SIZE);
        var i;
        for (i = 0; i < EXPOSED_SIZE; i++) {
            table[i] = 1 - Math.exp(-EXPOSURE * i / EXPOSED_SCALE);
        }
        return table;
    }

    // The darkest colour of the ramp from its own alpha (no shadow) to opaque (all of the hole in shadow)
    function shadeRamp(ramp) {
        var dark = new Uint8ClampedArray(new Uint32Array([ramp[0]]).buffer);
        var bytes = new Uint8ClampedArray(SHADE_SIZE * RGBA_FIELDS);
        var i;
        var k;
        for (i = 0; i < SHADE_SIZE; i++) {
            for (k = 0; k < RGBA_FIELDS; k++) {
                bytes[i * RGBA_FIELDS + k] = k === ALPHA_FIELD ?
                    dark[k] + (BYTE_MAX - dark[k]) * i / SHADE_MAX : dark[k];
            }
        }
        return new Uint32Array(bytes.buffer);
    }

    // Glow of the disk at the radius s (M), before the beaming
    function diskGlow(s, falloff) {
        return smoothstep(clamp((s - DISK_IN) / DISK_RISE, 0, 1)) * Math.pow(DISK_IN / s, falloff) *
            smoothstep(clamp((DISK_OUT - s) / DISK_FADE, 0, 1));
    }

    // Follows the ray of the sky point (bx, by) (M from the centre, right and up) back from the camera through the
    // curved space round the hole: x'' = -BEND h^2 x / r^5 gives the exact shape of light paths in Schwarzschild
    // space (h = |x * x'| stays the impact parameter); leapfrog steps. Returns LANDED (and fills `hit` with the disk
    // point), FELL_IN or ESCAPED
    function trace(bx, by) {
        var cosE = camera.cos;
        var sinE = camera.sin;
        var x = bx;
        var y = CAMERA_R * sinE + by * cosE;
        var z = CAMERA_R * cosE - by * sinE;
        var vx = 0;
        var vy = -sinE;
        var vz = -cosE;
        var pull = -BEND * (bx * bx + by * by);
        var r2 = x * x + y * y + z * z;
        var force = pull / (r2 * r2 * Math.sqrt(r2));
        var step;
        var i;
        var px;
        var py;
        var pz;
        var share;
        var s;
        var speed;
        var beta;
        for (i = 0; i < STEPS_MAX; i++) {
            step = STEP_SHARE * Math.sqrt(r2);
            vx += force * x * step * HALF;
            vy += force * y * step * HALF;
            vz += force * z * step * HALF;
            px = x;
            py = y;
            pz = z;
            x += vx * step;
            y += vy * step;
            z += vz * step;
            r2 = x * x + y * y + z * z;
            force = pull / (r2 * r2 * Math.sqrt(r2));
            vx += force * x * step * HALF;
            vy += force * y * step * HALF;
            vz += force * z * step * HALF;
            if ((py > 0) !== (y > 0)) {
                share = py / (py - y);
                hit.x = px + (x - px) * share;
                hit.z = pz + (z - pz) * share;
                s = Math.sqrt(hit.x * hit.x + hit.z * hit.z);
                if (s >= DISK_IN && s <= DISK_OUT) {
                    // Doppler factor 1 / (gamma (1 - beta cos)): the orbit runs along SPIN (z, -x), the light
                    // leaves towards the camera, against the traced direction
                    speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
                    beta = BEAM_SHARE / Math.sqrt(s - HORIZON_R);   // orbital speed: 1 / sqrt(r - 2)
                    hit.s = s;
                    hit.beam = Math.sqrt(1 - beta * beta) /
                        (1 + beta * SPIN * (hit.z * vx - hit.x * vz) / (s * speed));
                    // bent far from the starting direction (0, -sinE, -cosE): over, under or round the hole
                    hit.lensed = -(vy * sinE + vz * cosE) < LENSED_COS * speed;
                    return LANDED;
                }
            }
            if (r2 < CAPTURE_R * CAPTURE_R) {
                return FELL_IN;
            }
            // past its closest point and outside the disk: it cannot meet the disk any more
            if (r2 > DISK_OUT * DISK_OUT && x * vx + y * vy + z * vz > 0) {
                return ESCAPED;
            }
        }
        return FELL_IN;
    }

    // ---- The scene (see Scenes in hex-bg.js; all lengths in layer px)

    function BlackHole(field) {
        if (!starNoise) {
            buildTables();
        }
        this.field = field;
        this.shade = shadeRamp(field.ramp);
        this.seen = { star: 0, glow: 0 };   // stars and ripples seen at the hole being drawn (see lookHole)
        // centre (layer px, and the hole it is on: grid row and pixel column), shadow radius (px), turn and
        // elevation of the camera
        this.hole = { cx: 0, cy: 0, row: 0, pixel: 0, radius: 0, roll: 0, elevation: 0 };
        // the traced picture round the centre, per hole: `rows` rows above and below, `width` holes per row from
        // `half` pixels left (see traceStamp), and the holes the lens shows there (see lensTaps)
        this.stamp = { rows: 0, half: 0, width: 0, shade: null, ring: null, ringAround: null, lensRow: null,
            lensPixel: null, gain: null, images: [], tapRow: null, tapHole: null, tapWeight: null };
    }

    BlackHole.prototype.ambientCount = AMBIENT_COUNT;
    BlackHole.prototype.ambientGain = AMBIENT_GAIN;

    // The hole hangs right of the title above the posts (in the corner right of the title on phones), its centre on
    // the nearest hole of the grille; a new size or view is traced anew, the lens taps follow the centre hole
    BlackHole.prototype.place = function (width, height) {
        var field = this.field;
        var hole = this.hole;
        var narrow = width < height;
        var radius = Math.round((narrow ? width * HOLE_SIZE_NARROW : height * HOLE_SIZE) / RADIUS_STEP) * RADIUS_STEP;
        var roll = narrow ? ROLL_NARROW : ROLL;
        var elevation = narrow ? ELEVATION_NARROW : ELEVATION;
        var odd;
        radius = clamp(radius, field.cellW * HOLE_RADIUS_MIN, HOLE_RADIUS_MAX);
        hole.row = Math.round(radius * (narrow ? HOLE_DROP_NARROW : HOLE_DROP) / field.rowH);
        odd = hole.row & ROW_PARITY;
        hole.pixel = PIXELS_PER_HOLE * Math.round(((narrow ? width - radius * HOLE_INSET_NARROW : width * HOLE_X) /
            field.pixelW + odd) / PIXELS_PER_HOLE) - odd;
        hole.cx = hole.pixel * field.pixelW;
        hole.cy = hole.row * field.rowH;
        if (radius !== hole.radius || roll !== hole.roll || elevation !== hole.elevation) {
            hole.radius = radius;
            hole.roll = roll;
            hole.elevation = elevation;
            this.traceStamp();
        }
        this.lensTaps();
    };

    // Traces the picture of the hole for the holes round the centre (the same for every centre hole: the grid
    // repeats), SUB_SAMPLES^2 rays per hole: the shadow share, the photon ring, the images of the disk (see
    // IMAGE_NEAR) - their glow and the mean place on the disk that their streaks are taken from - and where the
    // lens takes the stars and the ripples from
    BlackHole.prototype.traceStamp = function () {
        var stamp = this.stamp;
        var radius = this.hole.radius;
        var cellW = this.field.cellW;
        var rowH = this.field.rowH;
        var pixelW = this.field.pixelW;
        var scale = SHADOW_B / radius;      // M per px
        var cosR = Math.cos(this.hole.roll);
        var sinR = Math.sin(this.hole.roll);
        var samples = SUB_SAMPLES * SUB_SAMPLES;
        var einsteinSq = EINSTEIN_RADIUS * EINSTEIN_RADIUS * radius * radius;
        var reach = LENS_REACH * radius;
        var halfW = STAMP_HALF_W * radius;
        var halfH = STAMP_HALF_H * radius;
        // per image, summed over the rays of a hole: glow, glow * cos and glow * sin of the azimuth, glow * radius
        var glows = [];
        var cosines = [];
        var sines = [];
        var radii = [];
        var holes;                          // on each side of the centre hole
        var size;
        var dr;
        var k;
        var i;
        var odd;
        var x0;
        var y0;
        var a;
        var b;
        var x;
        var y;
        var bx;
        var by;
        var rho;
        var off;
        var fate;
        var glow;
        var image;
        var s;
        var shade;
        var ring;
        var lens;
        var near;
        camera.cos = Math.cos(this.hole.elevation);
        camera.sin = Math.sin(this.hole.elevation);
        stamp.rows = Math.ceil(halfH / rowH);
        holes = Math.ceil(halfW / cellW);
        stamp.half = PIXELS_PER_HOLE * holes;
        stamp.width = holes * SIDES + CENTRE;
        size = (stamp.rows * SIDES + CENTRE) * stamp.width;
        stamp.shade = new Float32Array(size);
        stamp.ring = new Float32Array(size);
        stamp.ringAround = new Float32Array(size);
        stamp.lensRow = new Float32Array(size);
        stamp.lensPixel = new Float32Array(size);
        stamp.gain = new Float32Array(size);
        stamp.tapRow = new Int32Array(size * LENS_TAPS);
        stamp.tapHole = new Int32Array(size * LENS_TAPS);
        stamp.tapWeight = new Float64Array(size * LENS_TAPS);
        // per image: brightness (before the exposure); azimuth, turn rate and radius of the streaks in texels (and
        // texels per s)
        stamp.images = [];
        for (image = 0; image < IMAGES; image++) {
            stamp.images.push({ glow: new Float32Array(size), around: new Float32Array(size),
                spin: new Float32Array(size), radial: new Float32Array(size) });
        }
        for (dr = -stamp.rows; dr <= stamp.rows; dr++) {
            odd = dr & ROW_PARITY;
            for (k = 0; k < stamp.width; k++) {
                i = (dr + stamp.rows) * stamp.width + k;
                x0 = (PIXELS_PER_HOLE * k - stamp.half + odd) * pixelW;
                y0 = dr * rowH;
                shade = 0;
                ring = 0;
                for (image = 0; image < IMAGES; image++) {
                    glows[image] = cosines[image] = sines[image] = radii[image] = 0;
                }
                for (a = 0; a < SUB_SAMPLES; a++) {
                    for (b = 0; b < SUB_SAMPLES; b++) {
                        x = x0 + ((a + HALF) / SUB_SAMPLES - HALF) * cellW;
                        y = y0 + ((b + HALF) / SUB_SAMPLES - HALF) * rowH;
                        // turned back by the roll; sky up is screen up
                        bx = (x * cosR - y * sinR) * scale;
                        by = (-x * sinR - y * cosR) * scale;
                        rho = Math.sqrt(bx * bx + by * by) / SHADOW_B;
                        off = (rho - RING_RADIUS) / RING_WIDTH;
                        ring += Math.exp(-off * off) * (1 - RING_BEAM * SPIN * (rho && bx / (rho * SHADOW_B)));
                        fate = trace(bx, by);
                        if (fate === FELL_IN) {
                            shade++;
                        } else if (fate === LANDED) {
                            image = hit.lensed ? IMAGE_LENSED : hit.z > 0 ? IMAGE_NEAR : IMAGE_FAR;
                            glow = Math.pow(hit.beam, BEAM_POWER) * (hit.lensed ?
                                LENSED_GAIN * diskGlow(hit.s, HALO_FALLOFF) : diskGlow(hit.s, DISK_FALLOFF));
                            glows[image] += glow;
                            cosines[image] += glow * hit.x / hit.s;
                            sines[image] += glow * hit.z / hit.s;
                            radii[image] += glow * hit.s;
                        }
                    }
                }
                stamp.shade[i] = shade / samples;
                // the ring stays out of the holes mostly in shadow: a clean dark disc
                stamp.ring[i] = RING_GAIN * ring / samples * (1 - stamp.shade[i]);
                stamp.ringAround[i] = Math.atan2(y0, x0) / TAU * TEX_AROUND;
                for (image = 0; image < IMAGES; image++) {
                    if (glows[image]) {
                        s = radii[image] / glows[image];
                        stamp.images[image].glow[i] = glows[image] / samples;
                        stamp.images[image].around[i] = Math.atan2(sines[image], cosines[image]) / TAU * TEX_AROUND;
                        stamp.images[image].spin[i] = SPIN * SPIN_RATE * Math.pow(s / DISK_IN, KEPLER_POWER) /
                            TAU * TEX_AROUND;
                        stamp.images[image].radial[i] = Math.log(s) * TEX_RADIAL;
                    }
                }
                // point lens: the stars and ripples seen here come from (x0, y0) (1 - E^2 / r^2), less so towards
                // LENS_REACH (in rows and pixel columns from the centre); r is at least a row (the centre hole).
                // The ripples are brighter near the hole, as far as the lens reaches
                lens = x0 * x0 + y0 * y0;
                near = smoothstep(clamp(1 - Math.sqrt(lens) / reach, 0, 1));
                lens = 1 - einsteinSq / Math.max(lens, rowH * rowH) * near;
                stamp.lensRow[i] = y0 * lens / rowH;
                stamp.lensPixel[i] = x0 * lens / pixelW;
                stamp.gain[i] = RIPPLE_GAIN_FAR + (RIPPLE_GAIN - RIPPLE_GAIN_FAR) * near;
            }
        }
    };

    // The hole is fixed to the grille: nothing to restore after a pause
    BlackHole.prototype.resume = function () {};

    // The rings of the mouse path fall towards the hole, faster as they age, less from further out
    BlackHole.prototype.mouseSpot = function (x, y, life) {
        var hole = this.hole;
        var spot = this.field.spot;
        var reachSq = FALL_REACH * FALL_REACH * hole.radius * hole.radius;
        var dx = hole.cx - x;
        var dy = hole.cy - y;
        var fall = RIPPLE_FALL * life * life * reachSq / (dx * dx + dy * dy + reachSq);
        spot.x = x + dx * fall;
        spot.y = y + dy * fall;
    };

    // Ambient rings rise round the hole, in random directions and at random distances
    BlackHole.prototype.ambientSpot = function (n) {
        var hole = this.hole;
        var spot = this.field.spot;
        var angle = TAU * starNoise[n];
        var distance = hole.radius * (AMBIENT_NEAR + (AMBIENT_FAR - AMBIENT_NEAR) * phaseNoise[n]);
        spot.x = hole.cx + distance * Math.cos(angle);
        spot.y = hole.cy + distance * Math.sin(angle);
    };

    // Adds the stars and the ripples of a hole (grid row r, hole h of the row), weighted
    BlackHole.prototype.lookHole = function (r, h, weight, t) {
        var field = this.field;
        var seen = this.seen;
        var n = noiseIndex(h, r);
        var star = starNoise[n] - STAR_LIMIT;
        var j = r - field.firstRow;
        if (star > 0) {
            seen.star += weight * STAR_GAIN * star / STAR_SHARE *
                (HALF + HALF * Math.sin(TAU * phaseNoise[n] + t * TWINKLE_SPEED));
        }
        if (j >= 0 && j < field.rows && h >= 0 && h < field.holesPerRow) {
            seen.glow += weight * field.ripple[j * field.holesPerRow + h];
        }
    };

    // The holes whose stars and ripples the lens shows in each hole of the traced area, for the hole the centre is
    // on: the place the lens takes them from (grid row and pixel column, fractional) blended from the NEAREST holes
    // of the NEAREST rows - LENS_TAPS grid rows, holes of the row and weights per hole, so the frames only add them up
    BlackHole.prototype.lensTaps = function () {
        var hole = this.hole;
        var stamp = this.stamp;
        var q = 0;
        var i;
        var a;
        var b;
        var row;
        var r;
        var down;
        var weight;
        var place;
        var h;
        var right;
        for (i = 0; i < stamp.lensRow.length; i++) {
            row = hole.row + stamp.lensRow[i];
            r = Math.floor(row);
            down = row - r;
            for (a = 0; a < NEAREST; a++) {
                weight = a ? down : 1 - down;
                place = (hole.pixel + stamp.lensPixel[i] + ((r + a) & ROW_PARITY)) / PIXELS_PER_HOLE;
                h = Math.floor(place);
                right = place - h;
                for (b = 0; b < NEAREST; b++) {
                    stamp.tapRow[q] = r + a;
                    stamp.tapHole[q] = h + b;
                    stamp.tapWeight[q] = weight * (b ? right : 1 - right);
                    q++;
                }
            }
        }
    };

    // Light of every hole: in the traced area the disk images with their streaks, the photon ring and the shadow;
    // stars and ripples everywhere, seen through the lens in the traced area; faded in below the top edge
    BlackHole.prototype.render = function (t) {
        var field = this.field;
        var hole = this.hole;
        var stamp = this.stamp;
        var images = stamp.images;
        var seen = this.seen;
        var cols = field.cols;
        var pixels = field.pixels;
        var ramp = field.ramp;
        var shades = this.shade;
        var dark = ramp[0];
        var inflow = INFLOW * t;
        var ringSpin = SPIN * SPIN_RATE / TAU * TEX_AROUND * t;
        var j;
        var r;
        var p;
        var odd;
        var row;
        var dr;
        var stampRow;
        var i;
        var k;
        var q;
        var n;
        var image;
        var shade;
        var around;
        var radial;
        var clump;
        var glow;
        var bright;
        var lanes;
        var light;
        var gain;
        var fade;
        var color;
        field.ripples();
        for (j = 0; j < field.rows; j++) {
            r = field.firstRow + j;
            odd = r & ROW_PARITY;
            dr = r - hole.row;
            stampRow = dr >= -stamp.rows && dr <= stamp.rows ? (dr + stamp.rows) * stamp.width : -1;
            fade = smoothstep(clamp(r / TOP_FADE_ROWS, 0, 1));
            row = j * cols;
            for (p = -odd; p < cols; p += PIXELS_PER_HOLE) {
                k = (p - hole.pixel + stamp.half) >> HOLE_SHIFT;
                seen.star = 0;
                seen.glow = 0;
                if (stampRow >= 0 && k >= 0 && k < stamp.width) {
                    i = stampRow + k;
                    shade = stamp.shade[i];
                    light = stamp.ring[i];
                    if (light) {
                        light *= 1 - RING_STREAKS * smoothNoise(diskNoise, stamp.ringAround[i] + ringSpin,
                            RING_STREAK_ROW);
                    }
                    // the disk images exposed together, their streaks and clumps blended by their brightness
                    glow = 0;
                    bright = 0;
                    lanes = 0;
                    for (n = 0; n < IMAGES; n++) {
                        image = images[n];
                        if (image.glow[i]) {
                            around = image.around[i] + image.spin[i] * t;
                            radial = image.radial[i] + inflow;
                            clump = smoothNoise(clumpNoise, around, radial);
                            glow += image.glow[i];
                            bright += image.glow[i] * (1 + CLUMP_GAIN * clump);
                            lanes += image.glow[i] * (1 - CLUMP_CLEAR * clump) *
                                smoothNoise(diskNoise, around, radial);
                        }
                    }
                    if (glow) {
                        lanes = smoothstep(clamp((lanes / glow - LANE_FROM) / LANE_SPAN, 0, 1));
                        light += exposed[Math.min(Math.round(bright * EXPOSED_SCALE), EXPOSED_SIZE - 1)] *
                            (1 - TEX_DEPTH * lanes);
                    }
                    // stars and ripples through the lens, swallowed by the shadow
                    if (shade < 1) {
                        for (q = i * LENS_TAPS; q < (i + 1) * LENS_TAPS; q++) {
                            this.lookHole(stamp.tapRow[q], stamp.tapHole[q], stamp.tapWeight[q], t);
                        }
                        light += (1 - shade) * seen.star;
                        seen.glow *= 1 - shade;
                    }
                    gain = stamp.gain[i];
                } else {
                    shade = 0;
                    this.lookHole(r, (p + odd) >> HOLE_SHIFT, 1, t);
                    light = seen.star;
                    gain = RIPPLE_GAIN_FAR;
                }
                if (seen.glow) {
                    light += Math.min(1, seen.glow) * gain * (RIPPLE_PEAK - Math.min(1, light));
                }
                n = Math.round(clamp(light * fade, 0, 1) * LUT_MAX);
                if (n) {
                    color = ramp[n];
                } else if (shade) {
                    color = shades[Math.round(shade * SHADE_MAX)];
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

    hexBg.consoleScene = BlackHole;
})();
