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
export interface Guideline {
    id: string;
    axis: 'h' | 'v';
    position: number;
    el: SVGLineElement | null;
    labelEl: SVGTextElement | null;
}
export interface PrecisionOptions {
    /** Size of one major grid cell in SVG user units (default: 50) */
    majorGridSize?: number;
    /** Number of minor subdivisions per major cell (default: 5) */
    minorDivisions?: number;
    /** Show minor grid lines (default: true) */
    showMinorGrid?: boolean;
    /** Pixel threshold for path snap detection (default: 12) */
    pathSnapThreshold?: number;
    /** Unit label shown on rulers ('mm' | 'in' | 'px', default: 'mm') */
    unit?: 'mm' | 'in' | 'px';
}
export declare class PrecisionEngine {
    private majorGridSize;
    private minorDivisions;
    private showMinorGrid;
    private pathSnapThreshold;
    private unit;
    private rulerCanvasH;
    private rulerCanvasV;
    private rulerCanvasWrap;
    private rulersVisible;
    private crosshairH;
    private crosshairV;
    private guidelines;
    private guideLayer;
    private draggingGuide;
    private guideGhostEl;
    private guideGhostAxis;
    private nextGuideId;
    private gridCanvas;
    private gridVisible;
    private snapToGridEnabled;
    private snapToPathEnabled;
    private snapIndicator;
    private snapIndicatorTimeout;
    private getPanzoomState;
    private container;
    private _boundMouseMove;
    private _boundMouseUp;
    private _boundRulerHDown;
    private _boundRulerVDown;
    constructor(container: HTMLElement, opts?: PrecisionOptions);
    /** Register the panzoom accessor so the engine knows the current viewport state. */
    setPanzoomAccessor(fn: () => {
        scale: number;
        x: number;
        y: number;
    }): void;
    /**
     * Must be called from the `panzoomchange` event and the wheel handler in main.ts.
     * Re-draws rulers, redraws the grid, and repositions all guidelines.
     */
    onViewportChange(): void;
    /** Toggle ruler visibility. If force is omitted, flips current state. */
    toggleRulers(force?: boolean): void;
    /** Toggle the canvas grid overlay. */
    toggleGrid(force?: boolean): void;
    /** Enable / disable snap-to-grid. */
    setSnapToGrid(enabled: boolean): void;
    /** Enable / disable snap-to-paths & tangents. */
    setSnapToPath(enabled: boolean): void;
    /**
     * Unified snap function to pass to VectorEditor.setSnapFunction().
     * Grid snap is applied first; path snap is applied afterward and wins
     * only when the nearest path point is strictly closer than the grid intersection.
     */
    snapPoint(pt: {
        x: number;
        y: number;
    }): {
        x: number;
        y: number;
    };
    /**
     * Reconfigure grid sizes (in SVG user units).
     * Called when the user changes #grid-major-spacing or #grid-minor-spacing inputs.
     */
    setGridConfig(majorSize: number, minorDivs: number, showMinor?: boolean): void;
    /** Remove all guidelines. */
    clearGuidelines(): void;
    /** Remove a single guideline by id. */
    removeGuideline(id: string): void;
    /** Programmatically add a guideline. */
    addGuideline(axis: 'h' | 'v', position: number): Guideline;
    /** Serialise all guidelines for project persistence. */
    serializeGuidelines(): {
        axis: 'h' | 'v';
        position: number;
    }[];
    /** Restore serialised guidelines (e.g. on project load). */
    restoreGuidelines(data: {
        axis: 'h' | 'v';
        position: number;
    }[]): void;
    /** Clean up all DOM additions and event listeners. */
    destroy(): void;
    private _initRulers;
    private _drawRulerH;
    private _drawRulerV;
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
    private _paintRulerAxis;
    /**
     * Compute major and minor tick world-unit intervals that produce
     * a readable ruler at the current zoom level.
     * Target: ~60 px between major ticks on screen.
     */
    private _niceTickInterval;
    private _formatRulerValue;
    private _initGuideLayer;
    private _buildGuideline;
    private _layoutGuideline;
    private _repositionGuidelines;
    private _initGridCanvas;
    private _renderGrid;
    /** Quantise a viewport-space point to the nearest grid intersection. */
    private _snapToGrid;
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
    private _snapToNearestPath;
    /**
     * Extract the endpoint coordinates of each path command from a `d` attribute
     * and return them transformed into viewport space.
     */
    private _extractPathEndpoints;
    private _initSnapIndicator;
    private _flashSnapIndicator;
    private _bindUIControls;
    private _bindGlobalEvents;
    private _onRulerMouseDown;
    private _onGlobalMouseMove;
    private _onGlobalMouseUp;
    private _updateCrosshairs;
    /**
     * Read current panzoom state (or fall back to CTM parsing).
     * Returns { scale, tx, ty } where:
     *   screenPos = worldPos * scale + t{x|y}
     */
    private _getViewportState;
    /** Convert a screen coordinate to SVG viewport (scene) world position. */
    private _screenToWorld;
    private _restoreSettings;
}
//# sourceMappingURL=precision.d.ts.map