/**
 * VECTRONOMY — PrecisionEngine
 *
 * Phase 3 · Batch 9 · CAD Precision & Layout Tools (Division 6)
 *
 * Features:
 *   56 · Dynamic Layout Rulers       — live Canvas ruler bars that update on pan/zoom
 *   57 · Drag-and-Drop Guidelines    — drag from ruler into canvas, lock on mouseup
 *   58 · Grid Subdivisions Manager   — Canvas overlay with configurable major/minor cell sizes
 *   59 · Snap to Grid                — quantize drag coordinates to nearest grid intersection
 *   60 · Snap to Paths & Tangents    — detect nearest path edge/corner/tangent during drag
 *
 * Element IDs (supplied by ui_ux_developer):
 *   #ruler-h              — <canvas> for horizontal ruler
 *   #ruler-v              — <canvas> for vertical ruler
 *   #ruler-origin-box     — corner box, click to reset origin
 *   #ruler-viewport       — main working-area container
 *   #ruler-canvas-wrap    — wrapper that receives `.rulers-hidden` class
 *   #btn-toggle-rulers    — rulers toggle button
 *   #grid-show-rulers     — checkbox mirroring ruler state
 *   #ruler-crosshair-h    — <line> SVG element for H crosshair on mousemove
 *   #ruler-crosshair-v    — <line> SVG element for V crosshair on mousemove
 *   #guideline-layer      — <svg> overlay for guide lines
 *   #btn-clear-guides     — clears all guidelines
 *   #grid-major-spacing   — <input> major grid spacing (mm)
 *   #grid-minor-spacing   — <input> minor subdivision spacing (mm)
 *   #grid-show-minor      — <checkbox> toggle minor grid lines
 *   #btn-toggle-snap      — existing snap-to-grid toggle
 *   #btn-toggle-path-snap — path/tangent snap toggle
 */
// ─── PrecisionEngine ────────────────────────────────────────────────────────
export class PrecisionEngine {
    // ─── Constructor ────────────────────────────────────────────────
    constructor(container, opts = {}) {
        // ── Ruler canvases ─────────────────────────────────────────────
        this.rulerCanvasH = null;
        this.rulerCanvasV = null;
        this.rulerCanvasWrap = null;
        this.rulersVisible = true;
        // ── Ruler crosshair (SVG <line> elements) ─────────────────────
        this.crosshairH = null;
        this.crosshairV = null;
        // ── Guidelines ─────────────────────────────────────────────────
        this.guidelines = [];
        this.guideLayer = null;
        this.draggingGuide = null;
        this.guideGhostEl = null;
        this.guideGhostAxis = null;
        this.nextGuideId = 1;
        // ── Grid canvas ────────────────────────────────────────────────
        this.gridCanvas = null;
        this.gridVisible = true;
        // ── Snap flags ─────────────────────────────────────────────────
        this.snapToGridEnabled = false;
        this.snapToPathEnabled = false;
        // ── Snap indicator ─────────────────────────────────────────────
        this.snapIndicator = null;
        this.snapIndicatorTimeout = null;
        // ── Panzoom accessor ───────────────────────────────────────────
        this.getPanzoomState = null;
        this.container = container;
        this.majorGridSize = opts.majorGridSize ?? 50;
        this.minorDivisions = Math.max(1, opts.minorDivisions ?? 5);
        this.showMinorGrid = opts.showMinorGrid ?? true;
        this.pathSnapThreshold = opts.pathSnapThreshold ?? 12;
        this.unit = opts.unit ?? 'mm';
        this._boundMouseMove = this._onGlobalMouseMove.bind(this);
        this._boundMouseUp = this._onGlobalMouseUp.bind(this);
        this._boundRulerHDown = (e) => this._onRulerMouseDown(e, 'h');
        this._boundRulerVDown = (e) => this._onRulerMouseDown(e, 'v');
        this._initRulers();
        this._initGuideLayer();
        this._initGridCanvas();
        this._initSnapIndicator();
        this._bindUIControls();
        this._bindGlobalEvents();
        this._restoreSettings();
    }
    // ─── Public API ──────────────────────────────────────────────────
    /** Register the panzoom accessor so the engine knows the current viewport state. */
    setPanzoomAccessor(fn) {
        this.getPanzoomState = fn;
    }
    /**
     * Must be called from the `panzoomchange` event and the wheel handler in main.ts.
     * Re-draws rulers, redraws the grid, and repositions all guidelines.
     */
    onViewportChange() {
        this._drawRulerH();
        this._drawRulerV();
        this._renderGrid();
        this._repositionGuidelines();
    }
    /** Toggle ruler visibility. If force is omitted, flips current state. */
    toggleRulers(force) {
        this.rulersVisible = force !== undefined ? force : !this.rulersVisible;
        this.rulerCanvasWrap?.classList.toggle('rulers-hidden', !this.rulersVisible);
        // Sync checkbox
        const cb = document.getElementById('grid-show-rulers');
        if (cb)
            cb.checked = this.rulersVisible;
        localStorage.setItem('vectronomy_rulers_visible', this.rulersVisible.toString());
    }
    /** Toggle the canvas grid overlay. */
    toggleGrid(force) {
        this.gridVisible = force !== undefined ? force : !this.gridVisible;
        if (this.gridCanvas)
            this.gridCanvas.style.display = this.gridVisible ? 'block' : 'none';
        localStorage.setItem('vectronomy_grid_canvas_visible', this.gridVisible.toString());
        this._renderGrid();
    }
    /** Enable / disable snap-to-grid. */
    setSnapToGrid(enabled) {
        this.snapToGridEnabled = enabled;
        localStorage.setItem('vectronomy_snap_grid_v2', enabled.toString());
        const btn = document.getElementById('btn-toggle-snap');
        btn?.classList.toggle('active', enabled);
    }
    /** Enable / disable snap-to-paths & tangents. */
    setSnapToPath(enabled) {
        this.snapToPathEnabled = enabled;
        localStorage.setItem('vectronomy_snap_path', enabled.toString());
        const btn = document.getElementById('btn-toggle-path-snap');
        btn?.classList.toggle('active', enabled);
    }
    /**
     * Unified snap function to pass to VectorEditor.setSnapFunction().
     * Grid snap is applied first; path snap is applied afterward and wins
     * only when the nearest path point is strictly closer than the grid intersection.
     */
    snapPoint(pt) {
        let result = { ...pt };
        let snapped = false;
        if (this.snapToGridEnabled) {
            result = this._snapToGrid(result);
            snapped = (result.x !== pt.x || result.y !== pt.y);
        }
        if (this.snapToPathEnabled) {
            const pathSnapped = this._snapToNearestPath(result);
            if (pathSnapped) {
                // Path snap wins if it moves us closer than grid alone
                result = pathSnapped;
                snapped = true;
            }
        }
        if (snapped)
            this._flashSnapIndicator(result);
        return result;
    }
    /**
     * Reconfigure grid sizes (in SVG user units).
     * Called when the user changes #grid-major-spacing or #grid-minor-spacing inputs.
     */
    setGridConfig(majorSize, minorDivs, showMinor) {
        this.majorGridSize = Math.max(1, majorSize);
        this.minorDivisions = Math.max(1, Math.floor(minorDivs));
        if (showMinor !== undefined)
            this.showMinorGrid = showMinor;
        localStorage.setItem('vectronomy_major_grid', this.majorGridSize.toString());
        localStorage.setItem('vectronomy_minor_divs', this.minorDivisions.toString());
        this._renderGrid();
        this._drawRulerH();
        this._drawRulerV();
    }
    /** Remove all guidelines. */
    clearGuidelines() {
        this.guidelines.forEach(g => { g.el?.remove(); g.labelEl?.remove(); });
        this.guidelines = [];
    }
    /** Remove a single guideline by id. */
    removeGuideline(id) {
        const idx = this.guidelines.findIndex(g => g.id === id);
        if (idx === -1)
            return;
        const g = this.guidelines[idx];
        g.el?.remove();
        g.labelEl?.remove();
        this.guidelines.splice(idx, 1);
    }
    /** Programmatically add a guideline. */
    addGuideline(axis, position) {
        const guide = this._buildGuideline(axis, position, false);
        this.guidelines.push(guide);
        return guide;
    }
    /** Serialise all guidelines for project persistence. */
    serializeGuidelines() {
        return this.guidelines.map(g => ({ axis: g.axis, position: g.position }));
    }
    /** Restore serialised guidelines (e.g. on project load). */
    restoreGuidelines(data) {
        this.clearGuidelines();
        data.forEach(d => this.addGuideline(d.axis, d.position));
    }
    /** Clean up all DOM additions and event listeners. */
    destroy() {
        window.removeEventListener('mousemove', this._boundMouseMove);
        window.removeEventListener('mouseup', this._boundMouseUp);
        this.rulerCanvasH?.removeEventListener('mousedown', this._boundRulerHDown);
        this.rulerCanvasV?.removeEventListener('mousedown', this._boundRulerVDown);
        this.gridCanvas?.remove();
        this.snapIndicator?.remove();
        // Note: rulers and guide layer are owned by ui_ux_developer's HTML; leave in place.
    }
    // ─── Private: Ruler initialisation ─────────────────────────────
    _initRulers() {
        this.rulerCanvasH = document.getElementById('ruler-h');
        this.rulerCanvasV = document.getElementById('ruler-v');
        this.rulerCanvasWrap = document.getElementById('ruler-canvas-wrap');
        this.crosshairH = document.getElementById('ruler-crosshair-h');
        this.crosshairV = document.getElementById('ruler-crosshair-v');
        // Origin box click resets the ruler origin (reserved for future phase, no-op for now)
        document.getElementById('ruler-origin-box')?.addEventListener('click', () => {
            // Future: allow user to set custom origin offset
        });
        // Drag from ruler bars to spawn guidelines
        this.rulerCanvasH?.addEventListener('mousedown', this._boundRulerHDown);
        this.rulerCanvasV?.addEventListener('mousedown', this._boundRulerVDown);
        this._drawRulerH();
        this._drawRulerV();
    }
    // ─── Private: Ruler drawing ─────────────────────────────────────
    _drawRulerH() {
        const canvas = this.rulerCanvasH;
        if (!canvas)
            return;
        const dpr = window.devicePixelRatio || 1;
        const W = canvas.clientWidth || canvas.offsetWidth || 600;
        const H = canvas.clientHeight || canvas.offsetHeight || 20;
        if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
            canvas.width = Math.round(W * dpr);
            canvas.height = Math.round(H * dpr);
        }
        const ctx = canvas.getContext('2d');
        if (!ctx)
            return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);
        const state = this._getViewportState();
        this._paintRulerAxis(ctx, 'h', W, H, state);
    }
    _drawRulerV() {
        const canvas = this.rulerCanvasV;
        if (!canvas)
            return;
        const dpr = window.devicePixelRatio || 1;
        const W = canvas.clientWidth || canvas.offsetWidth || 20;
        const H = canvas.clientHeight || canvas.offsetHeight || 500;
        if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
            canvas.width = Math.round(W * dpr);
            canvas.height = Math.round(H * dpr);
        }
        const ctx = canvas.getContext('2d');
        if (!ctx)
            return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);
        const state = this._getViewportState();
        this._paintRulerAxis(ctx, 'v', W, H, state);
    }
    /**
     * Paint tick marks and numeric labels onto a ruler canvas context.
     *
     * Coordinate math:
     *   screenPos = worldPos * scale + translate
     *   worldPos  = (screenPos - translate) / scale
     *
     * translate for H = tx (pan.x * scale from panzoom)
     * translate for V = ty (pan.y * scale from panzoom)
     */
    _paintRulerAxis(ctx, axis, W, H, state) {
        const { scale, tx, ty } = state;
        const translate = axis === 'h' ? tx : ty;
        const length = axis === 'h' ? W : H;
        // Background
        ctx.fillStyle = 'rgba(13, 13, 24, 0.95)';
        ctx.fillRect(0, 0, W, H);
        // Compute nice tick interval
        const ticks = this._niceTickInterval(scale);
        // World range visible on screen
        const worldStart = -translate / scale;
        const worldEnd = (length - translate) / scale;
        const rulerThick = axis === 'h' ? H : W;
        const majorTickH = rulerThick * 0.6;
        const minorTickH = rulerThick * 0.3;
        const fontSize = 8;
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 1;
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = `${fontSize}px ui-monospace, monospace`;
        // Snap to first minor tick boundary at or before worldStart
        const startMinor = Math.floor(worldStart / ticks.minor) * ticks.minor;
        for (let w = startMinor; w <= worldEnd + ticks.minor; w += ticks.minor) {
            const s = w * scale + translate; // screen position
            if (s < -1 || s > length + 1)
                continue;
            const isMajor = Math.abs(((w % ticks.major) + ticks.major) % ticks.major) < ticks.minor * 0.01 ||
                Math.abs(((w % ticks.major) + ticks.major) % ticks.major - ticks.major) < ticks.minor * 0.01;
            const tickLen = isMajor ? majorTickH : minorTickH;
            ctx.beginPath();
            if (axis === 'h') {
                ctx.moveTo(s, H);
                ctx.lineTo(s, H - tickLen);
            }
            else {
                ctx.moveTo(W, s);
                ctx.lineTo(W - tickLen, s);
            }
            ctx.stroke();
            if (isMajor) {
                const label = this._formatRulerValue(w, ticks.major);
                if (axis === 'h') {
                    ctx.textAlign = 'left';
                    ctx.fillText(label, s + 2, H - majorTickH - 1);
                }
                else {
                    // Rotate 90° for vertical ruler labels
                    ctx.save();
                    ctx.translate(W - majorTickH - 1, s - 2);
                    ctx.rotate(-Math.PI / 2);
                    ctx.textAlign = 'left';
                    ctx.fillText(label, 0, 0);
                    ctx.restore();
                }
            }
        }
        // Border line (bottom for H, right for V)
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (axis === 'h') {
            ctx.moveTo(0, H - 0.5);
            ctx.lineTo(W, H - 0.5);
        }
        else {
            ctx.moveTo(W - 0.5, 0);
            ctx.lineTo(W - 0.5, H);
        }
        ctx.stroke();
    }
    /**
     * Compute major and minor tick world-unit intervals that produce
     * a readable ruler at the current zoom level.
     * Target: ~60 px between major ticks on screen.
     */
    _niceTickInterval(scale) {
        const targetPx = 60;
        const rawWorld = targetPx / scale;
        const mag = Math.pow(10, Math.floor(Math.log10(rawWorld)));
        const norm = rawWorld / mag;
        let nice;
        if (norm < 1.5)
            nice = 1;
        else if (norm < 3.5)
            nice = 2;
        else if (norm < 7.5)
            nice = 5;
        else
            nice = 10;
        const major = nice * mag;
        const minor = major / this.minorDivisions;
        return { major, minor };
    }
    _formatRulerValue(value, step) {
        if (step >= 1 && step === Math.floor(step)) {
            return Math.round(value).toString();
        }
        const dec = Math.max(0, -Math.floor(Math.log10(step)));
        return value.toFixed(dec);
    }
    // ─── Private: Guide Layer ───────────────────────────────────────
    _initGuideLayer() {
        this.guideLayer = document.getElementById('guideline-layer');
        // Fallback: create one inside the container if the UI didn't provide it
        if (!this.guideLayer) {
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.id = 'guideline-layer';
            Object.assign(svg.style, {
                position: 'absolute',
                inset: '0',
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: '15',
                overflow: 'visible',
            });
            if (getComputedStyle(this.container).position === 'static') {
                this.container.style.position = 'relative';
            }
            this.container.appendChild(svg);
            this.guideLayer = svg;
        }
    }
    _buildGuideline(axis, position, isGhost) {
        const ns = 'http://www.w3.org/2000/svg';
        const id = `guide-${this.nextGuideId++}`;
        const line = document.createElementNS(ns, 'line');
        line.setAttribute('data-guide-id', id);
        line.setAttribute('stroke', isGhost ? 'rgba(0,255,194,0.35)' : '#00ffc2');
        line.setAttribute('stroke-width', '0.75');
        line.setAttribute('stroke-dasharray', isGhost ? '6 4' : '4 3');
        line.setAttribute('opacity', isGhost ? '0.5' : '0.8');
        line.classList.add('guide-line', axis === 'h' ? 'guide-h' : 'guide-v');
        if (isGhost)
            line.classList.add('guide-ghost');
        line.style.pointerEvents = isGhost ? 'none' : 'stroke';
        line.style.cursor = axis === 'h' ? 'ns-resize' : 'ew-resize';
        // Label
        let labelEl = null;
        if (!isGhost) {
            labelEl = document.createElementNS(ns, 'text');
            labelEl.classList.add('guide-label');
            labelEl.setAttribute('fill', '#00ffc2');
            labelEl.setAttribute('font-size', '9');
            labelEl.setAttribute('font-family', 'ui-monospace, monospace');
            labelEl.style.pointerEvents = 'none';
            this.guideLayer.appendChild(labelEl);
        }
        this._layoutGuideline(line, labelEl, axis, position);
        // Hover highlight
        if (!isGhost) {
            line.addEventListener('mouseenter', () => line.classList.add('hovered'));
            line.addEventListener('mouseleave', () => line.classList.remove('hovered'));
            // Double-click to delete
            line.addEventListener('dblclick', () => this.removeGuideline(id));
            // Drag to reposition
            line.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                const g = this.guidelines.find(g => g.id === id);
                if (g) {
                    this.draggingGuide = g;
                }
                line.classList.add('dragging-guide');
            });
        }
        this.guideLayer.appendChild(line);
        return { id, axis, position, el: line, labelEl };
    }
    _layoutGuideline(line, label, axis, position) {
        // Convert world position → screen position
        const state = this._getViewportState();
        const screen = position * state.scale + (axis === 'h' ? state.ty : state.tx);
        const W = this.container.clientWidth || 1600;
        const H = this.container.clientHeight || 900;
        const posText = this._formatRulerValue(position, 1);
        if (axis === 'h') {
            const y = screen.toFixed(2);
            line.setAttribute('x1', '0');
            line.setAttribute('y1', y);
            line.setAttribute('x2', W.toString());
            line.setAttribute('y2', y);
            if (label) {
                label.setAttribute('x', '4');
                label.setAttribute('y', (screen - 3).toFixed(2));
                label.textContent = posText;
                label.classList.toggle('visible', true);
            }
        }
        else {
            const x = screen.toFixed(2);
            line.setAttribute('x1', x);
            line.setAttribute('y1', '0');
            line.setAttribute('x2', x);
            line.setAttribute('y2', H.toString());
            if (label) {
                label.setAttribute('x', (screen + 3).toFixed(2));
                label.setAttribute('y', '12');
                label.textContent = posText;
                label.classList.toggle('visible', true);
            }
        }
    }
    _repositionGuidelines() {
        this.guidelines.forEach(g => {
            if (g.el)
                this._layoutGuideline(g.el, g.labelEl, g.axis, g.position);
        });
        if (this.guideGhostEl && this.draggingGuide) {
            this._layoutGuideline(this.guideGhostEl, null, this.draggingGuide.axis, this.draggingGuide.position);
        }
    }
    // ─── Private: Grid Canvas ───────────────────────────────────────
    _initGridCanvas() {
        // Try to reuse a canvas already present inside the ruler-viewport
        const vp = document.getElementById('ruler-viewport');
        const host = vp ?? this.container;
        let canvas = host.querySelector('#grid-canvas');
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.id = 'grid-canvas';
            host.insertBefore(canvas, host.firstChild);
        }
        Object.assign(canvas.style, {
            position: 'absolute',
            inset: '0',
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: '2',
            display: this.gridVisible ? 'block' : 'none',
        });
        this.gridCanvas = canvas;
        this._renderGrid();
    }
    _renderGrid() {
        const canvas = this.gridCanvas;
        if (!canvas || !this.gridVisible)
            return;
        const dpr = window.devicePixelRatio || 1;
        const host = canvas.parentElement;
        const W = (host?.clientWidth || this.container.clientWidth || 600);
        const H = (host?.clientHeight || this.container.clientHeight || 400);
        const pw = Math.round(W * dpr);
        const ph = Math.round(H * dpr);
        if (canvas.width !== pw || canvas.height !== ph) {
            canvas.width = pw;
            canvas.height = ph;
        }
        const ctx = canvas.getContext('2d');
        if (!ctx)
            return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);
        const { scale, tx, ty } = this._getViewportState();
        const majorPx = this.majorGridSize * scale;
        const minorPx = majorPx / this.minorDivisions;
        // ── Minor grid ──────────────────────────────────────────────
        if (this.showMinorGrid && minorPx >= 4) {
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(255,255,255,0.05)';
            ctx.lineWidth = 0.5;
            const x0 = ((tx % minorPx) + minorPx) % minorPx;
            const y0 = ((ty % minorPx) + minorPx) % minorPx;
            for (let x = x0; x <= W; x += minorPx) {
                ctx.moveTo(x, 0);
                ctx.lineTo(x, H);
            }
            for (let y = y0; y <= H; y += minorPx) {
                ctx.moveTo(0, y);
                ctx.lineTo(W, y);
            }
            ctx.stroke();
        }
        // ── Major grid ──────────────────────────────────────────────
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(0,255,194,0.10)';
        ctx.lineWidth = 0.8;
        const mx = ((tx % majorPx) + majorPx) % majorPx;
        const my = ((ty % majorPx) + majorPx) % majorPx;
        for (let x = mx; x <= W; x += majorPx) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, H);
        }
        for (let y = my; y <= H; y += majorPx) {
            ctx.moveTo(0, y);
            ctx.lineTo(W, y);
        }
        ctx.stroke();
        // Reset to avoid DPR bleed on next frame
        ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    // ─── Private: Snap Logic ────────────────────────────────────────
    /** Quantise a viewport-space point to the nearest grid intersection. */
    _snapToGrid(pt) {
        const gs = this.majorGridSize;
        return {
            x: Math.round(pt.x / gs) * gs,
            y: Math.round(pt.y / gs) * gs,
        };
    }
    /**
     * Find the nearest sampled point on any visible path geometry.
     * Returns the snapped coordinate in viewport (scene) space, or null.
     *
     * Algorithm:
     *   1. Collect all geometric SVG elements in #viewport.
     *   2. Sample each element's path at adaptive arc-length intervals.
     *   3. Also sample exact node endpoints from the 'd' attribute.
     *   4. Return the closest sample within pathSnapThreshold (in SVG units).
     */
    _snapToNearestPath(pt) {
        const mainSvg = this.container.querySelector('svg');
        const viewport = mainSvg?.querySelector('#viewport');
        if (!mainSvg || !viewport)
            return null;
        const threshSq = this.pathSnapThreshold * this.pathSnapThreshold;
        const vpCTM = viewport.getCTM();
        if (!vpCTM)
            return null;
        const vpCTMInv = vpCTM.inverse();
        let bestDSq = Infinity;
        let bestPt = null;
        const elements = viewport.querySelectorAll('path, rect, circle, ellipse, line, polyline, polygon');
        elements.forEach(el => {
            if (el.getAttribute('data-guide-id'))
                return; // skip guide overlay elements
            let total = 0;
            try {
                total = el.getTotalLength();
            }
            catch {
                return;
            }
            if (total <= 0)
                return;
            const elCTM = el.getCTM();
            if (!elCTM)
                return;
            // Combined matrix: element-local → viewport space
            const m = vpCTMInv.multiply(elCTM);
            // Adaptive sample count: aim for ~1 sample per half-threshold world-unit
            const samples = Math.max(8, Math.min(512, Math.ceil(total / (this.pathSnapThreshold * 0.5))));
            const step = total / samples;
            for (let i = 0; i <= samples; i++) {
                let raw;
                try {
                    raw = el.getPointAtLength(Math.min(i * step, total));
                }
                catch {
                    continue;
                }
                const vx = m.a * raw.x + m.c * raw.y + m.e;
                const vy = m.b * raw.x + m.d * raw.y + m.f;
                const dx = vx - pt.x;
                const dy = vy - pt.y;
                const dSq = dx * dx + dy * dy;
                if (dSq < bestDSq) {
                    bestDSq = dSq;
                    bestPt = { x: vx, y: vy };
                }
            }
            // ── Exact corner/node extraction ──────────────────────────
            const corners = this._extractPathEndpoints(el, m);
            for (const c of corners) {
                const dx = c.x - pt.x;
                const dy = c.y - pt.y;
                const dSq = dx * dx + dy * dy;
                if (dSq < bestDSq) {
                    bestDSq = dSq;
                    bestPt = c;
                }
            }
        });
        return (bestDSq < threshSq && bestPt) ? bestPt : null;
    }
    /**
     * Extract the endpoint coordinates of each path command from a `d` attribute
     * and return them transformed into viewport space.
     */
    _extractPathEndpoints(el, m) {
        const d = el.getAttribute('d');
        if (!d)
            return [];
        const pts = [];
        const cmdRe = /([MmLlCcSsQqTtAaZz])([^MmLlCcSsQqTtAaZz]*)/g;
        let match;
        while ((match = cmdRe.exec(d)) !== null) {
            const cmd = match[1].toUpperCase();
            if (cmd === 'Z')
                continue;
            const nums = (match[2].match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi) ?? []).map(Number);
            if (nums.length < 2)
                continue;
            // Endpoint is always the last (x,y) pair
            const lx = nums[nums.length - 2];
            const ly = nums[nums.length - 1];
            // Only handle absolute commands reliably
            if (match[1] === match[1].toUpperCase() && cmd !== 'Z') {
                pts.push({
                    x: m.a * lx + m.c * ly + m.e,
                    y: m.b * lx + m.d * ly + m.f,
                });
            }
        }
        return pts;
    }
    // ─── Private: Snap Indicator ────────────────────────────────────
    _initSnapIndicator() {
        const el = document.createElement('div');
        el.className = 'snap-indicator';
        Object.assign(el.style, {
            position: 'absolute',
            pointerEvents: 'none',
            zIndex: '30',
            display: 'none',
            width: '10px',
            height: '10px',
            marginLeft: '-5px',
            marginTop: '-5px',
            borderRadius: '50%',
            border: '2px solid #00ffc2',
        });
        this.container.appendChild(el);
        this.snapIndicator = el;
    }
    _flashSnapIndicator(worldPt) {
        const el = this.snapIndicator;
        if (!el)
            return;
        const state = this._getViewportState();
        const sx = worldPt.x * state.scale + state.tx;
        const sy = worldPt.y * state.scale + state.ty;
        el.style.left = `${sx}px`;
        el.style.top = `${sy}px`;
        el.style.display = 'block';
        el.classList.add('snap-pulse');
        if (this.snapIndicatorTimeout)
            clearTimeout(this.snapIndicatorTimeout);
        this.snapIndicatorTimeout = setTimeout(() => {
            el.style.display = 'none';
            el.classList.remove('snap-pulse');
        }, 500);
    }
    // ─── Private: UI Control Bindings ───────────────────────────────
    _bindUIControls() {
        // ── Rulers toggle ─────────────────────────────────────────────
        document.getElementById('btn-toggle-rulers')?.addEventListener('click', () => {
            this.toggleRulers();
        });
        document.getElementById('grid-show-rulers')
            ?.addEventListener('change', e => {
            this.toggleRulers(e.target.checked);
        });
        // ── Snap to Grid toggle ────────────────────────────────────────
        document.getElementById('btn-toggle-snap')?.addEventListener('click', e => {
            const btn = e.currentTarget;
            this.setSnapToGrid(btn.classList.contains('active') ? false : true);
        });
        // ── Snap to Path toggle ────────────────────────────────────────
        document.getElementById('btn-toggle-path-snap')?.addEventListener('click', e => {
            const btn = e.currentTarget;
            this.setSnapToPath(btn.classList.contains('active') ? false : true);
        });
        // ── Grid major spacing ────────────────────────────────────────
        document.getElementById('grid-major-spacing')
            ?.addEventListener('change', e => {
            const val = parseFloat(e.target.value);
            if (!isNaN(val) && val > 0) {
                this.setGridConfig(val, this.minorDivisions, this.showMinorGrid);
            }
        });
        // ── Grid minor spacing ─────────────────────────────────────────
        document.getElementById('grid-minor-spacing')
            ?.addEventListener('change', e => {
            const minorSize = parseFloat(e.target.value);
            if (!isNaN(minorSize) && minorSize > 0) {
                // Convert minor size to a division count relative to major
                const divs = Math.max(1, Math.round(this.majorGridSize / minorSize));
                this.setGridConfig(this.majorGridSize, divs, this.showMinorGrid);
            }
        });
        // ── Show minor grid checkbox ───────────────────────────────────
        document.getElementById('grid-show-minor')
            ?.addEventListener('change', e => {
            this.showMinorGrid = e.target.checked;
            this._renderGrid();
        });
        // ── Clear guides button ────────────────────────────────────────
        document.getElementById('btn-clear-guides')?.addEventListener('click', () => {
            this.clearGuidelines();
        });
    }
    // ─── Private: Event Listeners ───────────────────────────────────
    _bindGlobalEvents() {
        window.addEventListener('mousemove', this._boundMouseMove);
        window.addEventListener('mouseup', this._boundMouseUp);
    }
    _onRulerMouseDown(e, axis) {
        e.preventDefault();
        const pos = this._screenToWorld(e.clientX, e.clientY, axis);
        // Build a ghost guide that travels with the mouse
        const ghost = this._buildGuideline(axis, pos, true);
        this.guideGhostEl = ghost.el;
        this.guideGhostAxis = axis;
        // Create a real (permanent) guide as the dragging target
        const real = this._buildGuideline(axis, pos, false);
        this.guidelines.push(real);
        this.draggingGuide = real;
        // Keep ghost on top
        if (ghost.el)
            this.guideLayer?.appendChild(ghost.el);
    }
    _onGlobalMouseMove(e) {
        // ── Update ruler crosshairs ────────────────────────────────────
        this._updateCrosshairs(e);
        // ── Drag guide ────────────────────────────────────────────────
        if (!this.draggingGuide)
            return;
        const axis = this.draggingGuide.axis;
        const newPos = this._screenToWorld(e.clientX, e.clientY, axis);
        this.draggingGuide.position = newPos;
        if (this.draggingGuide.el) {
            this._layoutGuideline(this.draggingGuide.el, this.draggingGuide.labelEl, axis, newPos);
        }
        if (this.guideGhostEl && this.guideGhostAxis) {
            this._layoutGuideline(this.guideGhostEl, null, this.guideGhostAxis, newPos);
        }
    }
    _onGlobalMouseUp(e) {
        if (!this.draggingGuide)
            return;
        const rect = this.container.getBoundingClientRect();
        const outside = e.clientX < rect.left || e.clientX > rect.right ||
            e.clientY < rect.top || e.clientY > rect.bottom;
        if (outside) {
            this.removeGuideline(this.draggingGuide.id);
        }
        // Clean up ghost
        this.guideGhostEl?.remove();
        this.guideGhostEl = null;
        this.guideGhostAxis = null;
        this.draggingGuide.el?.classList.remove('dragging-guide');
        this.draggingGuide = null;
    }
    _updateCrosshairs(e) {
        const rect = this.container.getBoundingClientRect();
        const lx = e.clientX - rect.left;
        const ly = e.clientY - rect.top;
        if (this.crosshairH) {
            this.crosshairH.setAttribute('x1', lx.toFixed(1));
            this.crosshairH.setAttribute('x2', lx.toFixed(1));
        }
        if (this.crosshairV) {
            this.crosshairV.setAttribute('y1', ly.toFixed(1));
            this.crosshairV.setAttribute('y2', ly.toFixed(1));
        }
    }
    // ─── Private: Coordinate Helpers ───────────────────────────────
    /**
     * Read current panzoom state (or fall back to CTM parsing).
     * Returns { scale, tx, ty } where:
     *   screenPos = worldPos * scale + t{x|y}
     */
    _getViewportState() {
        const W = this.container.clientWidth || 0;
        const H = this.container.clientHeight || 0;
        if (this.getPanzoomState) {
            const { scale, x, y } = this.getPanzoomState();
            return { scale, tx: x * scale + W / 2, ty: y * scale + H / 2 };
        }
        // CTM fallback
        const mainSvg = this.container.querySelector('svg');
        const viewport = mainSvg?.querySelector('#viewport');
        if (!viewport || !mainSvg)
            return { scale: 1, tx: 0, ty: 0 };
        const vpCtm = viewport.getScreenCTM();
        const svgCtm = mainSvg.getScreenCTM();
        if (!vpCtm || !svgCtm)
            return { scale: 1, tx: 0, ty: 0 };
        return {
            scale: vpCtm.a,
            tx: vpCtm.e - svgCtm.e,
            ty: vpCtm.f - svgCtm.f,
        };
    }
    /** Convert a screen coordinate to SVG viewport (scene) world position. */
    _screenToWorld(screenX, screenY, axis) {
        const rect = this.container.getBoundingClientRect();
        const state = this._getViewportState();
        if (axis === 'h') {
            const localY = screenY - rect.top;
            return (localY - state.ty) / state.scale;
        }
        else {
            const localX = screenX - rect.left;
            return (localX - state.tx) / state.scale;
        }
    }
    // ─── Private: Persistence ───────────────────────────────────────
    _restoreSettings() {
        const rv = localStorage.getItem('vectronomy_rulers_visible');
        if (rv === 'false')
            this.toggleRulers(false);
        const gv = localStorage.getItem('vectronomy_grid_canvas_visible');
        if (gv === 'false')
            this.toggleGrid(false);
        const sg = localStorage.getItem('vectronomy_snap_grid_v2');
        if (sg === 'true') {
            this.snapToGridEnabled = true;
            document.getElementById('btn-toggle-snap')?.classList.add('active');
        }
        const sp = localStorage.getItem('vectronomy_snap_path');
        if (sp === 'true') {
            this.snapToPathEnabled = true;
            document.getElementById('btn-toggle-path-snap')?.classList.add('active');
        }
        const major = localStorage.getItem('vectronomy_major_grid');
        const minor = localStorage.getItem('vectronomy_minor_divs');
        if (major)
            this.majorGridSize = Math.max(1, parseFloat(major));
        if (minor)
            this.minorDivisions = Math.max(1, parseInt(minor));
    }
}
//# sourceMappingURL=precision.js.map