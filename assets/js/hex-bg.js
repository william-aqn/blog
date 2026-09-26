/*
 * hex-bg.js - animated layer of the vector hex grille background (see hex-bg.scss).
 * Adds glowing cells, a "data packet" running along a row of holes and a scan beam to every .hex-bg.
 * All motion is CSS (opacity/transform); JS only re-places elements at the end of their loops,
 * while they are invisible, and pauses layers that are offscreen or in a hidden tab.
 * Reduced motion is handled by CSS (the whole animated layer is hidden).
 */
(function () {
    'use strict';

    var LAYER_SELECTOR = '.hex-bg';
    var FX_CLASS = 'hex-bg__fx';
    var CELL_CLASS = 'hex-bg__cell';
    var PACKET_CLASS = 'hex-bg__packet';
    var DOT_CLASS = 'hex-bg__dot';
    var BEAM_CLASS = 'hex-bg__beam';
    var PAUSED_CLASS = 'hex-bg--paused';
    var CELL_W_VAR = '--hex-bg-cell-w';     // grid pitch, set by hex-bg.scss
    var ROW_H_VAR = '--hex-bg-row-h';
    var TRAVEL_VAR = '--hex-bg-travel';     // read by the hex-bg-scan keyframes
    var TAG = 'div';
    var ANIMATION_OFF = 'none';
    var EVENT_ITERATION = 'animationiteration';
    var EVENT_VISIBILITY = 'visibilitychange';
    var EVENT_RESIZE = 'resize';
    var EVENT_LOAD = 'load';
    var PX = 'px';
    var SEC = 's';
    var FLIP = ' scaleX(-1)';

    var VIEWPORT_AREA_PER_CELL = 250000;    // px2 of viewport per glowing cell
    var CELL_COUNT_MIN = 2;
    var CELL_COUNT_MAX = 6;
    var CELL_TIME_MIN = 4;                  // s, flicker cycle
    var CELL_TIME_SPREAD = 3;
    var PACKET_TIME_MIN = 8;                // s, one run per cycle
    var PACKET_TIME_SPREAD = 7;
    var PACKET_CELLS_MIN = 4;               // holes a packet runs across
    var PACKET_CELLS_SPREAD = 5;
    var EDGE_CELLS = 1;                     // keep effects off the layer edges
    var ROW_PARITY = 2;
    var ODD_ROW_SHIFT = 0.5;                // odd rows of the pointy-top grid are shifted by half a cell
    var SCAN_SPEED = 150;                   // px/s
    var SCAN_PAUSE = 1400;                  // px travelled below the layer = pause between sweeps
    var RESIZE_DELAY = 250;                 // ms

    var fields = [];
    var resizeTimer = null;

    function add(parent, className) {
        var el = document.createElement(TAG);
        el.className = className;
        return parent.appendChild(el);
    }

    function randomInt(min, spread) {
        return min + Math.floor(Math.random() * (spread + 1));
    }

    // Random duration and phase keep the effects out of sync
    function desync(el, min, spread) {
        var time = min + Math.random() * spread;
        el.style.animationDuration = time + SEC;
        el.style.animationDelay = -Math.random() * time + SEC;
    }

    function translate(x, y) {
        return 'translate(' + x + PX + ',' + y + PX + ')';
    }

    function Field(layer, cellW, rowH) {
        var cellCount = Math.round(window.innerWidth * window.innerHeight / VIEWPORT_AREA_PER_CELL);
        var cell;
        var i;
        this.layer = layer;
        this.cellW = cellW;
        this.rowH = rowH;
        // with an observer the first callback reports the real state (and places the effects on screen)
        this.visible = !window.IntersectionObserver;
        this.fx = add(layer, FX_CLASS);
        // cells go first: the orange ones are picked with :nth-child in hex-bg.scss
        this.cells = [];
        cellCount = Math.max(CELL_COUNT_MIN, Math.min(CELL_COUNT_MAX, cellCount));
        for (i = 0; i < cellCount; i++) {
            cell = add(this.fx, CELL_CLASS);
            desync(cell, CELL_TIME_MIN, CELL_TIME_SPREAD);
            this.cells.push(cell);
        }
        this.packet = add(this.fx, PACKET_CLASS);
        this.dot = add(this.packet, DOT_CLASS);
        desync(this.dot, PACKET_TIME_MIN, PACKET_TIME_SPREAD);
        this.beam = add(this.fx, BEAM_CLASS);
        this.measureBeam();
        this.applyBeam();
        this.placeAll();
        this.fx.addEventListener(EVENT_ITERATION, this.onIteration.bind(this));
    }

    // Random hole within one viewport height of the layer, at the edge it enters the screen from:
    // the visible part itself may be just a few px tall when the observer fires
    Field.prototype.slot = function () {
        var rect = this.layer.getBoundingClientRect();
        var top = Math.min(Math.max(0, -rect.top), Math.max(0, rect.height - window.innerHeight));
        var bottom = Math.min(rect.height, top + window.innerHeight);
        var rowMin = Math.ceil(top / this.rowH) + EDGE_CELLS;
        var rowMax = Math.floor(bottom / this.rowH) - EDGE_CELLS;
        var colMax = Math.floor(rect.width / this.cellW) - EDGE_CELLS;
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
        cell.style.transform = translate(slot.x, slot.y);
    };

    // The packet runs from its hole towards the side with more room
    Field.prototype.placePacket = function () {
        var slot = this.slot();
        var flip = slot.roomLeft > slot.roomRight;
        var cells = Math.min(randomInt(PACKET_CELLS_MIN, PACKET_CELLS_SPREAD), Math.max(slot.roomLeft, slot.roomRight));
        this.packet.style.width = cells * this.cellW + PX;
        this.packet.style.transform = translate(slot.x, slot.y) + (flip ? FLIP : '');
    };

    Field.prototype.placeAll = function () {
        this.cells.forEach(this.placeCell, this);
        this.placePacket();
    };

    // At a loop boundary cells, the packet and the beam are invisible: safe to move or refit them
    Field.prototype.onIteration = function (event) {
        if (event.target === this.beam) {
            this.refitBeam();
        } else if (event.target === this.dot) {
            this.placePacket();
        } else {
            this.placeCell(event.target);
        }
    };

    // Sweep distance for a constant beam speed whatever the section height
    Field.prototype.measureBeam = function () {
        this.travel = this.layer.clientHeight + SCAN_PAUSE;
    };

    Field.prototype.applyBeam = function () {
        this.appliedTravel = this.travel;
        this.beam.style.setProperty(TRAVEL_VAR, this.travel + PX);
        this.beam.style.animationDuration = this.travel / SCAN_SPEED + SEC;
    };

    // A new duration on a running animation would jump the beam: apply it at the loop start and restart
    Field.prototype.refitBeam = function () {
        if (this.travel === this.appliedTravel) {
            return;
        }
        this.applyBeam();
        this.beam.style.animationName = ANIMATION_OFF;
        this.beam.getBoundingClientRect();
        this.beam.style.animationName = '';
    };

    Field.prototype.setVisible = function (visible) {
        // re-place everything when the layer scrolls into view, so the effects start on screen
        if (visible && !this.visible) {
            this.placeAll();
        }
        this.visible = visible;
    };

    function refresh() {
        fields.forEach(function (field) {
            field.layer.classList.toggle(PAUSED_CLASS, document.hidden || !field.visible);
        });
    }

    function measureBeams() {
        fields.forEach(function (field) {
            field.measureBeam();
        });
    }

    function onResize() {
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(measureBeams, RESIZE_DELAY);
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
            refresh();
        });
        fields.forEach(function (field) {
            observer.observe(field.layer);
        });
    }

    function init() {
        var layers = document.querySelectorAll(LAYER_SELECTOR);
        var style;
        var cellW;
        var rowH;
        var i;
        for (i = 0; i < layers.length; i++) {
            style = window.getComputedStyle(layers[i]);
            cellW = parseFloat(style.getPropertyValue(CELL_W_VAR));
            rowH = parseFloat(style.getPropertyValue(ROW_H_VAR));
            // no CSS custom properties support: keep the static background only
            if (cellW && rowH) {
                fields.push(new Field(layers[i], cellW, rowH));
            }
        }
        if (!fields.length) {
            return;
        }
        if (window.IntersectionObserver) {
            observe();
        }
        document.addEventListener(EVENT_VISIBILITY, refresh);
        window.addEventListener(EVENT_RESIZE, onResize);
        window.addEventListener(EVENT_LOAD, measureBeams);
    }

    init();
})();
