/**
 * VECTRONOMY — Interactive SVG Editor (v2)
 *
 * Handles: selection, move, resize, draw (rect/circle/line/pen),
 * fill/stroke editing, opacity, rotation, z-order, align, undo/redo.
 */
import type { ConvertedLayer } from './types';
import { RasterEngine } from './rasterEngine';
import { BooleanOp } from './pathfinder';
export interface ElementProperties {
    x: number;
    y: number;
    w: number;
    h: number;
    rotation: number;
    opacity: number;
    strokeW: number;
    strokeColor: string;
    strokeCap: string;
    strokeJoin: string;
    strokeOpacity: number;
    fillEnabled: boolean;
    fillColor: string;
    fillOpacity: number;
    fillRule: string;
    elementType: string;
}
export interface PenPoint {
    x: number;
    y: number;
    cp1x?: number;
    cp1y?: number;
    cp2x?: number;
    cp2y?: number;
}
export declare class VectorEditor {
    private container;
    private currentLayer;
    selectedId: string | null;
    selectedIds: Set<string>;
    isMarquee: boolean;
    marqueeStart: DOMPoint | null;
    marqueeEl: SVGRectElement | null;
    private selectionGroup;
    private onUpdate;
    private onSelectionChange;
    private onInteractionStart;
    private onInteractionEnd;
    private isDragging;
    private dragMode;
    private activeHandle;
    private dragStartX;
    private dragStartY;
    private origBBox;
    private activeNodeIndex;
    private parsedCommands;
    private editingNodes;
    private draggingNode;
    private nodeEditTarget;
    activeTool: 'select' | 'pan' | 'rect' | 'circle' | 'line' | 'pen' | 'node' | 'polygon' | 'star' | 'spiral' | 'pencil' | 'polyline' | 'brush' | 'eraser' | 'magic-wand' | 'frame';
    private isDrawing;
    private drawingEl;
    private drawStartX;
    private drawStartY;
    private penPoints;
    private penDraggingPoint;
    rasterEngine: RasterEngine;
    polygonSides: number;
    starPoints: number;
    private pencilPoints;
    private polylinePoints;
    brushSize: number;
    brushStyle: 'round' | 'calligraphic' | 'flat';
    private magicWandThreshold;
    private brushPoints;
    private eraserPoints;
    private snapFn;
    setSnapFunction(fn: ((pt: {
        x: number;
        y: number;
    }) => {
        x: number;
        y: number;
    }) | null): void;
    constructor(container: HTMLElement, onUpdate: (svg: string) => void, onSelectionChange: (props: ElementProperties | null) => void, onInteractionStart: () => void, onInteractionEnd: () => void);
    private init;
    setLayer(layer: ConvertedLayer): void;
    setTool(tool: typeof this.activeTool): void;
    pathfinderOperation(operation: BooleanOp): Promise<void>;
    applyImageFilters(brightness: number, contrast: number, blur: number): void;
    createFrameFromSelection(): void;
    private onMouseDown;
    private convertToPath;
    private onMouseMove;
    private onMouseUp;
    private addNodeAtCursor;
    private onDblClick;
    private startDraw;
    private updateDraw;
    private finalizeDraw;
    private performVectorEraser;
    private getPointsFromD;
    private getCalligraphicD;
    finalizePolyline(): void;
    private getSmoothedPencilD;
    private simplifyPoints;
    private getSqSegDist;
    createGridArray(rows: number, cols: number, spacingX: number, spacingY: number): void;
    private finalizePenPath;
    private renderPenOverlay;
    private getPathD;
    private selectElement;
    private getScale;
    getSvgPoint(e: MouseEvent | Touch): DOMPoint | null;
    private getSelectedEls;
    private getUnionBBox;
    clearSelection(): void;
    private deleteActiveNode;
    deleteSelected(): void;
    private getSelectedEl;
    renderSelectionUI(): void;
    private renderNodeUI;
    private getCursorForHandle;
    private getTransformedBBox;
    private translateEl;
    private resizeSelection;
    private resizeEl;
    private notifyChange;
    updateProperties(props: Partial<ElementProperties>): void;
    bringToFront(): void;
    bringForward(): void;
    sendBackward(): void;
    sendToBack(): void;
    nudgeSelected(dx: number, dy: number): void;
    alignTo(mode: 'left' | 'center-h' | 'right' | 'top' | 'center-v' | 'bottom'): void;
    private commit;
}
//# sourceMappingURL=editor.d.ts.map