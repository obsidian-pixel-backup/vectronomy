/**
 * VECTRONOMY — Interactive SVG Editor (v2)
 *
 * Handles: selection, move, resize, draw (rect/circle/line/pen),
 * fill/stroke editing, opacity, rotation, z-order, align, undo/redo.
 */

import type { ConvertedLayer } from './types';
import { parseSvgPath, absolutizePath, stringifySvgPath, extractNodes, PathCommand, PathNodeRef } from './pathUtils';
import { RasterEngine } from './rasterEngine';
import { Pathfinder, BooleanOp } from './pathfinder';
import { LayoutEngine } from './layoutEngine';

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

export class VectorEditor {
  private container: HTMLElement;
  private currentLayer: ConvertedLayer | null = null;
  selectedId: string | null = null;
  selectedIds: Set<string> = new Set();
  isMarquee: boolean = false;
  marqueeStart: DOMPoint | null = null;
  marqueeEl: SVGRectElement | null = null;
  private selectionGroup: SVGGElement | null = null;

  private onUpdate: (svg: string) => void;
  private onSelectionChange: (props: ElementProperties | null) => void;
  private onInteractionStart: () => void;
  private onInteractionEnd: () => void;

  // Drag state
  private isDragging = false;
  private dragMode: 'move' | 'resize' | 'rotate' | null = null;
  private dragPivotX: number = 0;
  private dragPivotY: number = 0;
  private accumulatedRotation: number = 0;
  private lastAppliedRotation: number = 0;
  private activeHandle: string | null = null;
  private dragStartX = 0;
  private dragStartY = 0;
  private origBBox: DOMRect | null = null;
  private activeNodeIndex: number | null = null;
  private parsedCommands: PathCommand[] = [];
  private editingNodes: PathNodeRef[] = [];
  private draggingNode: boolean = false;
  private nodeEditTarget: SVGPathElement | null = null;

  // Drawing state
  activeTool: 'select' | 'pan' | 'rect' | 'circle' | 'line' | 'pen' | 'node' | 'polygon' | 'star' | 'spiral' | 'pencil' | 'polyline' | 'brush' | 'eraser' | 'magic-wand' | 'frame' = 'select';
  private isDrawing = false;
  private drawingEl: SVGElement | null = null;
  private drawStartX = 0;
  private drawStartY = 0;
  private penPoints: PenPoint[] = [];
  private penDraggingPoint: PenPoint | null = null;
  public rasterEngine: RasterEngine = new RasterEngine();

  // Custom Shapes state
  polygonSides = 5;
  starPoints = 5;
  private pencilPoints: { x: number; y: number }[] = [];
  private polylinePoints: { x: number; y: number }[] = [];

  // Brush/Eraser state
  brushSize = 12;
  brushStyle: 'round' | 'calligraphic' | 'flat' = 'round';
  currentStrokeColor: string = '#00ffc2';
  private magicWandThreshold: number = 20;
  private brushPoints: { x: number; y: number }[] = [];
  private eraserPoints: { x: number; y: number }[] = [];
  
  private snapFn: ((pt: {x: number, y: number}) => {x: number, y: number}) | null = null;
  public setSnapFunction(fn: ((pt: {x: number, y: number}) => {x: number, y: number}) | null) {
    this.snapFn = fn;
  }

  constructor(
    container: HTMLElement,
    onUpdate: (svg: string) => void,
    onSelectionChange: (props: ElementProperties | null) => void,
    onInteractionStart: () => void,
    onInteractionEnd: () => void
  ) {
    this.container = container;
    this.onUpdate = onUpdate;
    this.onSelectionChange = onSelectionChange;
    this.onInteractionStart = onInteractionStart;
    this.onInteractionEnd = onInteractionEnd;
    this.init();
  }

  private init() {
    this.container.addEventListener('mousedown', this.onMouseDown.bind(this));
    window.addEventListener('mousemove', this.onMouseMove.bind(this));
    window.addEventListener('mouseup', this.onMouseUp.bind(this));
    this.container.addEventListener('dblclick', this.onDblClick.bind(this));
    window.addEventListener('keydown', (e) => { 
      if (e.key === 'Escape' || e.key === 'Enter') {
        if (this.activeTool === 'pen' && this.isDrawing) {
          e.preventDefault();
          e.stopPropagation();
          if (e.key === 'Escape') this.cancelDrawing(); else this.finalizePenPath();
        } else if (this.activeTool === 'polyline' && this.isDrawing) {
          e.preventDefault();
          e.stopPropagation();
          if (e.key === 'Escape') this.cancelDrawing(); else this.finalizePolyline();
        } else if (e.key === 'Escape') {
          this.clearSelection();
        }
      }
    });
  }

  setLayer(layer: ConvertedLayer) { this.currentLayer = layer; this.clearSelection(); }

  setTool(tool: typeof this.activeTool) {
    if (this.activeTool === 'pen' && this.isDrawing) {
      this.finalizePenPath();
    } else if (this.activeTool === 'polyline' && this.isDrawing) {
      this.finalizePolyline();
    }
    this.activeTool = tool;
    this.clearSelection();
    this.penPoints = [];
    this.penDraggingPoint = null;
    this.renderPenOverlay(); // Clear overlay
    if (tool !== 'select' && tool !== 'pan') this.onInteractionStart();
    else this.onInteractionEnd();

    const container = this.container;
    if (tool === 'pan') {
      container.style.cursor = 'grab';
    } else if (tool === 'select') {
      container.style.cursor = '';
    } else if (tool === 'node') {
      container.style.cursor = 'crosshair';
    } else {
      container.style.cursor = 'crosshair';
    }
  }

  // ── Universal Studio Features ─────────────────────────────────────
  
  public async pathfinderOperation(operation: BooleanOp) {
    const els = this.getSelectedEls();
    if (els.length < 2) return; // Need at least two shapes
    
    // Process from bottom to top or based on selection order.
    // Here we'll just iteratively apply the operation.
    let baseEl = els[0];
    for (let i = 1; i < els.length; i++) {
      const targetEl = els[i];
      const resultSvgString = Pathfinder.performOperation(baseEl.outerHTML, targetEl.outerHTML, operation);
      
      if (resultSvgString) {
        // Parse the result back into DOM
        const parser = new DOMParser();
        const doc = parser.parseFromString(resultSvgString, 'image/svg+xml');
        const newEl = doc.querySelector('path, rect, circle, ellipse, polygon');
        if (newEl) {
           newEl.setAttribute('data-xcs-id', `pf-${Date.now()}-${Math.random().toString(36).substr(2,6)}`);
           // Replace the two old elements with the new one
           const parent = baseEl.parentNode;
           if (parent) {
             parent.insertBefore(newEl, baseEl);
             parent.removeChild(baseEl);
             parent.removeChild(targetEl);
           }
           baseEl = newEl as SVGGraphicsElement;
        }
      }
    }
    this.clearSelection();
    this.selectedIds.add(baseEl.getAttribute('data-xcs-id')!);
    this.selectedId = baseEl.getAttribute('data-xcs-id')!;
    this.renderSelectionUI();
    this.commit();
  }
  
  public applyImageFilters(brightness: number, contrast: number, blur: number) {
    const els = this.getSelectedEls();
    if (els.length !== 1) return;
    const imgEl = els[0] as unknown as SVGImageElement;
    if (imgEl.tagName.toLowerCase() !== 'image') return;
    
    this.rasterEngine.editImage(imgEl).then(() => {
      this.rasterEngine.applyFilters(brightness, contrast, blur);
      this.commit();
    });
  }
  
  public createFrameFromSelection() {
    const els = this.getSelectedEls();
    if (els.length === 0) return;
    const frame = LayoutEngine.createFrame(els);
    if (frame) {
      this.clearSelection();
      this.selectedIds.add(frame.getAttribute('data-xcs-id')!);
      this.selectedId = frame.getAttribute('data-xcs-id')!;
      this.renderSelectionUI();
      this.commit();
    }
  }

  // ── Mouse Handlers ────────────────────────────────────────────

  private onMouseDown(e: MouseEvent) {
    if (e.button === 1 || this.activeTool === 'pan') return;
    const target = e.target as SVGElement;
    if (this.activeTool === 'magic-wand') {
      const targetEl = target.closest('[data-xcs-id]') as SVGElement | null;
      if (targetEl && targetEl.parentElement?.id === 'viewport') {
        const targetFill = targetEl.getAttribute('fill') || 'none';
        const targetStroke = targetEl.getAttribute('stroke') || 'none';
        
        if (!e.shiftKey) this.clearSelection();
        
        const allElements = document.getElementById('viewport')?.querySelectorAll('[data-xcs-id]');
        if (allElements) {
          allElements.forEach(el => {
            const fill = el.getAttribute('fill') || 'none';
            const stroke = el.getAttribute('stroke') || 'none';
            // Select elements that share the same dominant color
            if (targetFill !== 'none') {
              if (fill === targetFill) this.selectedIds.add(el.getAttribute('data-xcs-id')!);
            } else if (targetStroke !== 'none') {
              if (stroke === targetStroke) this.selectedIds.add(el.getAttribute('data-xcs-id')!);
            }
          });
        }
        
        if (this.selectedIds.size === 0) {
          this.selectedIds.add(targetEl.getAttribute('data-xcs-id')!);
        }
        
        if (this.selectedIds.size === 1) {
          this.selectedId = Array.from(this.selectedIds)[0];
          this.onSelectionChange(this.getElementProperties(this.selectedId));
        } else {
          this.selectedId = null;
          this.onSelectionChange(this.getMultiSelectionProperties());
        }
        
        this.renderSelectionUI();
      } else if (!e.shiftKey) {
        this.clearSelection();
      }
      return;
    }

    if (this.activeTool !== 'select' && this.activeTool !== 'node') {
      // Vector brush and eraser do not intercept raster edits anymore
      this.startDraw(e); return;
    }
    if (this.activeTool === 'node') {
      // 1. If clicking on an existing node handle, start dragging it
      const nodeHandle = target.closest('[data-node-index]') as SVGElement | null;
      if (nodeHandle) {
        e.stopPropagation(); e.preventDefault();
        this.activeNodeIndex = parseInt(nodeHandle.getAttribute('data-node-index')!);
        this.draggingNode = true;
        this.dragStartX = e.clientX; this.dragStartY = e.clientY;
        this.renderSelectionUI();
        this.onInteractionStart();
        return;
      }
      
      // 2. Find the clicked element — could be a path, a primitive, or something inside a group
      let clickedPath: SVGPathElement | null = null;
      
      // First try: direct path hit
      const directPath = target.closest('path') as SVGPathElement | null;
      if (directPath && !directPath.closest('.selection-overlay')) {
        clickedPath = directPath;
      }
      
      // Second try: primitive shape hit — convert to path
      if (!clickedPath) {
        const primitive = target.closest('rect, circle, ellipse, line, polygon, polyline') as SVGElement | null;
        if (primitive && !primitive.closest('.selection-overlay')) {
          clickedPath = this.convertToPath(primitive);
        }
      }
      
      if (clickedPath) {
        e.stopPropagation(); e.preventDefault();
        
        // Ensure the path has an ID for selection tracking
        if (!clickedPath.hasAttribute('data-xcs-id')) {
          clickedPath.setAttribute('data-xcs-id', `node-path-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`);
        }
        const id = clickedPath.getAttribute('data-xcs-id')!;
        
        // If clicking a different path, reset node state
        if (this.nodeEditTarget !== clickedPath) {
          this.activeNodeIndex = null;
          this.parsedCommands = [];
          this.editingNodes = [];
        }
        
        this.nodeEditTarget = clickedPath;
        this.selectedIds.clear();
        this.selectedIds.add(id);
        this.selectedId = id;
        
        this.renderSelectionUI();
        this.onInteractionStart();
        return;
      }
      
      this.clearSelection();
      return;
    }


    const handle = target.closest('[data-handle-id]') as SVGElement | null;

    if (handle) {
      const id = handle.getAttribute('data-handle-id')!;
      e.stopPropagation(); e.preventDefault();
      this.isDragging = true;
      this.dragMode = id.endsWith('-rot') ? 'rotate' : 'resize';
      this.activeHandle = id;
      this.dragStartX = e.clientX; this.dragStartY = e.clientY;
      const els = this.getSelectedEls();
      if (els.length > 0) {
        const tBox = this.getUnionBBox(els);
        this.dragPivotX = tBox.x + tBox.width / 2;
        this.dragPivotY = tBox.y + tBox.height / 2;
        this.origBBox = els[0].getBoundingClientRect();
      }
      this.accumulatedRotation = 0;
      this.lastAppliedRotation = 0;
      this.onInteractionStart();
      return;
    }

    // Prioritize grouped elements (clusters) over individual paths
    const selectable = target.closest('g[data-xcs-id]') || target.closest('[data-xcs-id]') as SVGElement | null;
    if (selectable) {
      const id = selectable.getAttribute('data-xcs-id')!;
      e.stopPropagation(); e.preventDefault();
      
      if (e.shiftKey) {
        if (this.selectedIds.has(id)) this.selectedIds.delete(id);
        else this.selectedIds.add(id);
      } else {
        if (!this.selectedIds.has(id)) {
          this.selectedIds.clear();
          this.selectedIds.add(id);
        }
      }
      
      if (this.selectedIds.size > 0) this.selectedId = Array.from(this.selectedIds)[0];
      else this.selectedId = null;
      
      this.isDragging = true;
      this.dragMode = 'move';
      this.dragStartX = e.clientX; this.dragStartY = e.clientY;
      this.renderSelectionUI();
      this.notifyChange(this.getSelectedEls()[0] || null);
      this.onInteractionStart();
    } else {
      // Start Marquee Selection - Restricted to Shift Key held down
      if (e.shiftKey) {
        this.selectedId = null;
        this.renderSelectionUI();
        this.notifyChange(null as any);
        
        this.isMarquee = true;
        this.marqueeStart = this.getSvgPoint(e);
        this.onInteractionStart();
      } else {
        this.clearSelection();
      }
    }
  }

  private convertToPath(el: SVGElement): SVGPathElement {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const tag = el.tagName.toLowerCase();
    let d = '';
    
    if (tag === 'rect') {
      const x = parseFloat(el.getAttribute('x') || '0');
      const y = parseFloat(el.getAttribute('y') || '0');
      const w = parseFloat(el.getAttribute('width') || '0');
      const h = parseFloat(el.getAttribute('height') || '0');
      const rx = el.hasAttribute('rx') ? parseFloat(el.getAttribute('rx')!) : 0;
      const ry = el.hasAttribute('ry') ? parseFloat(el.getAttribute('ry')!) : 0;
      if (rx === 0 && ry === 0) {
        d = `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`;
      } else {
        d = `M ${x + rx} ${y} L ${x + w - rx} ${y} A ${rx} ${ry} 0 0 1 ${x + w} ${y + ry} L ${x + w} ${y + h - ry} A ${rx} ${ry} 0 0 1 ${x + w - rx} ${y + h} L ${x + rx} ${y + h} A ${rx} ${ry} 0 0 1 ${x} ${y + h - ry} L ${x} ${y + ry} A ${rx} ${ry} 0 0 1 ${x + rx} ${y} Z`;
      }
    } else if (tag === 'circle') {
      const cx = parseFloat(el.getAttribute('cx') || '0');
      const cy = parseFloat(el.getAttribute('cy') || '0');
      const r = parseFloat(el.getAttribute('r') || '0');
      const kappa = 0.5522847498;
      const o = r * kappa;
      d = `M ${cx} ${cy - r} ` +
          `C ${cx + o} ${cy - r} ${cx + r} ${cy - o} ${cx + r} ${cy} ` +
          `C ${cx + r} ${cy + o} ${cx + o} ${cy + r} ${cx} ${cy + r} ` +
          `C ${cx - o} ${cy + r} ${cx - r} ${cy + o} ${cx - r} ${cy} ` +
          `C ${cx - r} ${cy - o} ${cx - o} ${cy - r} ${cx} ${cy - r} Z`;
    } else if (tag === 'ellipse') {
      const cx = parseFloat(el.getAttribute('cx') || '0');
      const cy = parseFloat(el.getAttribute('cy') || '0');
      const rx = parseFloat(el.getAttribute('rx') || '0');
      const ry = parseFloat(el.getAttribute('ry') || '0');
      const kappa = 0.5522847498;
      const ox = rx * kappa;
      const oy = ry * kappa;
      d = `M ${cx} ${cy - ry} ` +
          `C ${cx + ox} ${cy - ry} ${cx + rx} ${cy - oy} ${cx + rx} ${cy} ` +
          `C ${cx + rx} ${cy + oy} ${cx + ox} ${cy + ry} ${cx} ${cy + ry} ` +
          `C ${cx - ox} ${cy + ry} ${cx - rx} ${cy + oy} ${cx - rx} ${cy} ` +
          `C ${cx - rx} ${cy - oy} ${cx - ox} ${cy - ry} ${cx} ${cy - ry} Z`;
    } else if (tag === 'line') {
      const x1 = parseFloat(el.getAttribute('x1') || '0');
      const y1 = parseFloat(el.getAttribute('y1') || '0');
      const x2 = parseFloat(el.getAttribute('x2') || '0');
      const y2 = parseFloat(el.getAttribute('y2') || '0');
      d = `M ${x1} ${y1} L ${x2} ${y2}`;
    } else if (tag === 'polygon' || tag === 'polyline') {
      const points = el.getAttribute('points') || '';
      const pairs = points.trim().split(/[\s,]+/).reduce((result: number[][], value, index, array) => {
        if (index % 2 === 0) result.push([parseFloat(value), parseFloat(array[index + 1] || '0')]);
        return result;
      }, []);
      if (pairs.length > 0) {
        d = `M ${pairs[0][0]} ${pairs[0][1]} ` + pairs.slice(1).map(p => `L ${p[0]} ${p[1]}`).join(' ');
        if (tag === 'polygon') d += ' Z';
      }
    }
    
    path.setAttribute('d', d);
    Array.from(el.attributes).forEach(attr => {
      if (!['x', 'y', 'width', 'height', 'cx', 'cy', 'r', 'rx', 'ry', 'x1', 'y1', 'x2', 'y2', 'points'].includes(attr.name)) {
        path.setAttribute(attr.name, attr.value);
      }
    });
    
    el.parentNode?.replaceChild(path, el);
    return path;
  }

  private onMouseMove(e: MouseEvent) {
    if (this.isDrawing && this.drawingEl) { this.updateDraw(e); return; }
    
    if (this.isDrawing && (this.activeTool === 'brush' || this.activeTool === 'eraser')) {
      // Handled by updateDraw
    }
    
    if (this.isMarquee && this.marqueeStart) {
      const pt = this.getSvgPoint(e);
      if (!pt) return;
      
      const mainSvg = this.container.querySelector('svg');
      const viewport = mainSvg?.querySelector('#viewport') || mainSvg;
      
      if (!this.marqueeEl) {
        this.marqueeEl = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        this.marqueeEl.setAttribute('fill', 'rgba(0, 255, 194, 0.1)');
        this.marqueeEl.setAttribute('stroke', '#00ffc2');
        this.marqueeEl.setAttribute('stroke-width', '1');
        viewport?.appendChild(this.marqueeEl);
      }
      
      const x = Math.min(this.marqueeStart.x, pt.x);
      const y = Math.min(this.marqueeStart.y, pt.y);
      const w = Math.abs(pt.x - this.marqueeStart.x);
      const h = Math.abs(pt.y - this.marqueeStart.y);
      
      this.marqueeEl.setAttribute('x', `${x}`);
      this.marqueeEl.setAttribute('y', `${y}`);
      this.marqueeEl.setAttribute('width', `${w}`);
      this.marqueeEl.setAttribute('height', `${h}`);
      return;
    }

    if (!this.isDragging && !this.draggingNode) return;
    if (this.draggingNode && this.activeNodeIndex !== null && this.nodeEditTarget) {
      const scale = this.getScale();
      const dx = (e.clientX - this.dragStartX) / scale;
      const dy = (e.clientY - this.dragStartY) / scale;
      
      const el = this.nodeEditTarget;
      
      // Compute accumulated CTM from the path through all parent groups
      // This handles paths nested inside transformed <g> elements
      const mainSvg = this.container.querySelector('svg') as SVGSVGElement | null;
      const viewport = mainSvg?.querySelector('#viewport') as SVGGraphicsElement | null;
      let localDx = dx;
      let localDy = dy;
      
      if (viewport && el) {
        // Get the path's CTM relative to the viewport
        const pathCTM = el.getCTM();
        const vpCTM = viewport.getCTM();
        if (pathCTM && vpCTM) {
          // Compute the transform from viewport space to path-local space
          const vpToPath = pathCTM.inverse().multiply(vpCTM);
          localDx = vpToPath.a * dx + vpToPath.c * dy;
          localDy = vpToPath.b * dx + vpToPath.d * dy;
        }
      }

      const node = this.editingNodes[this.activeNodeIndex];
      node.x += localDx;
      node.y += localDy;
      
      const cmd = this.parsedCommands[node.cmdIndex];
      cmd.args[node.argIndexX] = node.x;
      cmd.args[node.argIndexY] = node.y;
      
      el.setAttribute('d', stringifySvgPath(this.parsedCommands));
      
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      this.renderSelectionUI();
      return;
    }


    const scale = this.getScale();
    const dx = (e.clientX - this.dragStartX) / scale;
    const dy = (e.clientY - this.dragStartY) / scale;

    const els = this.getSelectedEls();
    if (this.dragMode === 'move') {
      els.forEach((el: SVGGraphicsElement) => this.translateEl(el, dx, dy));
    } else if (this.dragMode === 'resize') {
      this.resizeSelection(dx, dy, this.activeHandle!, e.shiftKey, e.altKey);
    } else if (this.dragMode === 'rotate') {
      this.rotateSelection(e, e.shiftKey);
    }

    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    this.renderSelectionUI();
    this.notifyChange(els[0] || null);
  }

  private onMouseUp() {

    if (this.isDrawing) {
      if (this.activeTool === 'pen') {
        this.penDraggingPoint = null;
        this.renderPenOverlay();
      }
      this.finalizeDraw();
      return;
    }
    
    if (this.isMarquee && this.marqueeEl) {
      const mainSvg = this.container.querySelector('svg');
      if (mainSvg) {
        const mx = parseFloat(this.marqueeEl.getAttribute('x')!);
        const my = parseFloat(this.marqueeEl.getAttribute('y')!);
        const mw = parseFloat(this.marqueeEl.getAttribute('width')!);
        const mh = parseFloat(this.marqueeEl.getAttribute('height')!);
        
        const allEls = mainSvg.querySelectorAll('[data-xcs-id]');
        allEls.forEach(el => {
          if (el.tagName.toLowerCase() === 'path' && el.parentElement?.hasAttribute('data-xcs-id')) return;
          const box = this.getTransformedBBox(el as SVGGraphicsElement);
          if (box.x < mx + mw && box.x + box.width > mx && box.y < my + mh && box.y + box.height > my) {
            this.selectedIds.add(el.getAttribute('data-xcs-id')!);
          }
        });
      }
      this.marqueeEl.remove();
      this.marqueeEl = null;
      this.isMarquee = false;
      if (this.selectedIds.size > 0) this.selectedId = Array.from(this.selectedIds)[0];
      this.renderSelectionUI();
      this.notifyChange(this.getSelectedEls()[0] || null);
      this.onInteractionEnd();
      return;
    }

    if (this.isMarquee) {
      this.isMarquee = false;
      this.onInteractionEnd();
      return;
    }

    if (this.draggingNode) {
      this.draggingNode = false;
      this.commit();
      this.onInteractionEnd();
      return;
    }
    
    if (this.isDragging) {
      this.isDragging = false;
      this.dragMode = null;
      this.activeHandle = null;
      this.origBBox = null;
      this.commit();
      if (this.activeTool === 'select') this.onInteractionEnd();
    }
  }


  private addNodeAtCursor(e: MouseEvent, el: SVGPathElement) {
    const pt = this.getSvgPoint(e);
    if (!pt) return;
    
    // Transform click point into path-local coordinates
    const mainSvg = this.container.querySelector('svg') as SVGSVGElement | null;
    const viewport = mainSvg?.querySelector('#viewport') as SVGGraphicsElement || mainSvg;
    let localPt = pt;
    if (viewport && el) {
      const pathCTM = el.getCTM();
      const vpCTM = (viewport as SVGGraphicsElement).getCTM();
      if (pathCTM && vpCTM) {
        const vpToPath = pathCTM.inverse().multiply(vpCTM);
        const lx = vpToPath.a * pt.x + vpToPath.c * pt.y + vpToPath.e;
        const ly = vpToPath.b * pt.x + vpToPath.d * pt.y + vpToPath.f;
        localPt = new DOMPoint(lx, ly);
      }
    }
    
    // --- Enterprise Grade Closest-Point Search ---
    const totalLength = el.getTotalLength();
    let minDistance = Infinity;
    let closestLength = 0;
    let closestPt = localPt;

    // Phase 1: Coarse search along visual path stroke
    const samples = 100;
    for (let i = 0; i <= samples; i++) {
      const len = (i / samples) * totalLength;
      const p = el.getPointAtLength(len);
      const dist = Math.hypot(localPt.x - p.x, localPt.y - p.y);
      if (dist < minDistance) {
        minDistance = dist;
        closestLength = len;
        closestPt = p as DOMPoint;
      }
    }

    // Phase 2: Fine-tune search around the closest point
    const fineSamples = 20;
    const searchRange = totalLength / samples;
    const startLen = Math.max(0, closestLength - searchRange / 2);
    const endLen = Math.min(totalLength, closestLength + searchRange / 2);

    for (let i = 0; i <= fineSamples; i++) {
      const len = startLen + (i / fineSamples) * (endLen - startLen);
      const p = el.getPointAtLength(len);
      const dist = Math.hypot(localPt.x - p.x, localPt.y - p.y);
      if (dist < minDistance) {
        minDistance = dist;
        closestLength = len;
        closestPt = p as DOMPoint;
      }
    }

    // Hit-test: check if the click was within 15 screen pixels of the path stroke
    const scale = this.getScale();
    const hitThreshold = 15 / scale;
    if (minDistance > hitThreshold) return; // clicked too far away!

    // Find the path command segment corresponding to closestPt
    let closestIndex = -1;
    let minChordDistance = Infinity;
    for (let i = 1; i < this.parsedCommands.length; i++) {
      const prev = this.editingNodes.find(n => n.cmdIndex === i - 1);
      const curr = this.editingNodes.find(n => n.cmdIndex === i);
      if (!prev || !curr) continue;
      
      const l2 = Math.pow(curr.x - prev.x, 2) + Math.pow(curr.y - prev.y, 2);
      let t = 0;
      if (l2 !== 0) {
        t = Math.max(0, Math.min(1, ((closestPt.x - prev.x) * (curr.x - prev.x) + (closestPt.y - prev.y) * (curr.y - prev.y)) / l2));
      }
      const projX = prev.x + t * (curr.x - prev.x);
      const projY = prev.y + t * (curr.y - prev.y);
      const dist = Math.hypot(closestPt.x - projX, closestPt.y - projY);
      
      if (dist < minChordDistance) {
        minChordDistance = dist;
        closestIndex = i;
      }
    }

    if (closestIndex !== -1) {
      const cmd = this.parsedCommands[closestIndex];
      const prevNode = this.editingNodes.find(n => n.cmdIndex === closestIndex - 1)!;
      
      this.onInteractionStart();

      if (cmd.type === 'C' && cmd.args.length === 6) {
        // --- High-Fidelity Cubic Bezier Curve Splitting (de Casteljau) ---
        const p0 = new DOMPoint(prevNode.x, prevNode.y);
        const p1 = new DOMPoint(cmd.args[0], cmd.args[1]);
        const p2 = new DOMPoint(cmd.args[2], cmd.args[3]);
        const p3 = new DOMPoint(cmd.args[4], cmd.args[5]);
        
        // Find best t parameter along the curve segment
        let bestT = 0.5;
        let minD = Infinity;
        for (let i = 0; i <= 100; i++) {
          const t = i / 100;
          const mt = 1 - t;
          const x = mt*mt*mt*p0.x + 3*mt*mt*t*p1.x + 3*mt*t*t*p2.x + t*t*t*p3.x;
          const y = mt*mt*mt*p0.y + 3*mt*mt*t*p1.y + 3*mt*t*t*p2.y + t*t*t*p3.y;
          const d = Math.hypot(closestPt.x - x, closestPt.y - y);
          if (d < minD) {
            minD = d;
            bestT = t;
          }
        }
        
        const t = bestT;
        // de Casteljau split points
        const q0x = (1-t)*p0.x + t*p1.x;
        const q0y = (1-t)*p0.y + t*p1.y;
        const q1x = (1-t)*p1.x + t*p2.x;
        const q1y = (1-t)*p1.y + t*p2.y;
        const q2x = (1-t)*p2.x + t*p3.x;
        const q2y = (1-t)*p2.y + t*p3.y;
        
        const r0x = (1-t)*q0x + t*q1x;
        const r0y = (1-t)*q0y + t*q1y;
        const r1x = (1-t)*q1x + t*q2x;
        const r1y = (1-t)*q1y + t*q2y;
        
        const s0x = (1-t)*r0x + t*r1x;
        const s0y = (1-t)*r0y + t*r1y;
        
        // Replace single C command with two C commands
        this.parsedCommands[closestIndex] = {
          type: 'C',
          args: [q0x, q0y, r0x, r0y, s0x, s0y]
        };
        this.parsedCommands.splice(closestIndex + 1, 0, {
          type: 'C',
          args: [r1x, r1y, q2x, q2y, p3.x, p3.y]
        });
      } else {
        // Fallback or straight segment split: insert a clean straight L command
        this.parsedCommands.splice(closestIndex, 0, {
          type: 'L',
          args: [closestPt.x, closestPt.y]
        });
      }

      el.setAttribute('d', stringifySvgPath(this.parsedCommands));
      
      // Update UI and set the new node as active
      this.draggingNode = false;
      
      // Find the new node index
      const newNodes = extractNodes(this.parsedCommands);
      this.activeNodeIndex = newNodes.findIndex(n => n.cmdIndex === closestIndex);
      
      this.renderSelectionUI();
      this.commit();
      this.onInteractionEnd();
    }
  }

  private onDblClick(e: MouseEvent) {
    if (this.activeTool === 'node' && this.nodeEditTarget) {
      // Add a node to the currently edited path
      this.addNodeAtCursor(e, this.nodeEditTarget);
      return;
    }

    // Double-click on pen path point to close it
    if (this.activeTool === 'pen' && this.penPoints.length > 2) {
      const mainSvg = this.container.querySelector('svg');
      if (!this.drawingEl || !mainSvg) return;
      const d = this.getPathD(this.penPoints, true);
      this.drawingEl.setAttribute('d', d);
      this.isDrawing = false;
      this.penPoints = [];
      this.drawingEl = null;
      this.penDraggingPoint = null;
      this.renderPenOverlay();
      this.commit();
    }
  }

  // ── Drawing ───────────────────────────────────────────────────



  private startDraw(e: MouseEvent) {
    const mainSvg = this.container.querySelector('svg');
    const viewport = mainSvg?.querySelector('#viewport') || mainSvg;
    if (!mainSvg || !viewport) return;
    const pt = this.getSvgPoint(e);
    if (!pt) return;

    const id = `drawn-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

    if (this.activeTool === 'pen') {
      if (!this.isDrawing) {
        // Start a new pen path
        this.isDrawing = true;
        this.drawingEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        this.drawingEl.setAttribute('data-xcs-id', id);
        this.drawingEl.setAttribute('stroke', '#00ffc2');
        this.drawingEl.setAttribute('stroke-width', '1.5');
        this.drawingEl.setAttribute('fill', 'none');
        
        const newPt: PenPoint = { x: pt.x, y: pt.y };
        this.penPoints = [newPt];
        this.penDraggingPoint = newPt; // enable drag-shaping
        
        this.drawingEl.setAttribute('d', `M${pt.x},${pt.y}`);
        viewport.appendChild(this.drawingEl);
        this.renderPenOverlay(pt);
      } else {
        // Check for click on first point to close path
        if (!this.penPoints.length) return;
        const p0 = this.penPoints[0];
        const dist = Math.sqrt((pt.x - p0.x) ** 2 + (pt.y - p0.y) ** 2);
        const scale = this.getScale();
        if (this.penPoints.length > 2 && dist < 10 / scale) {
          // Close path!
          const d = this.getPathD(this.penPoints, true);
          this.drawingEl!.setAttribute('d', d);
          
          this.isDrawing = false;
          this.penPoints = [];
          this.drawingEl = null;
          this.penDraggingPoint = null;
          this.renderPenOverlay(); // Clear overlay
          this.commit();
          return;
        }
        
        // Add new point
        const newPt: PenPoint = { x: pt.x, y: pt.y };
        this.penPoints.push(newPt);
        this.penDraggingPoint = newPt; // enable drag-shaping
        
        const d = this.getPathD(this.penPoints);
        this.drawingEl!.setAttribute('d', d);
        this.renderPenOverlay(pt);
      }
      return;
    }

    if (this.activeTool === 'polyline') {
      if (!this.isDrawing) {
        this.isDrawing = true;
        this.drawingEl = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        this.drawingEl.setAttribute('data-xcs-id', id);
        this.drawingEl.setAttribute('stroke', '#00ffc2');
        this.drawingEl.setAttribute('stroke-width', '1.5');
        this.drawingEl.setAttribute('fill', 'none');
        
        this.polylinePoints = [{ x: pt.x, y: pt.y }];
        this.drawingEl.setAttribute('points', `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`);
        viewport.appendChild(this.drawingEl);
      } else {
        const p0 = this.polylinePoints[0];
        const dist = Math.sqrt((pt.x - p0.x) ** 2 + (pt.y - p0.y) ** 2);
        const scale = this.getScale();
        if (this.polylinePoints.length > 2 && dist < 10 / scale) {
          this.polylinePoints.push({ x: p0.x, y: p0.y });
          const ptsStr = this.polylinePoints.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
          this.drawingEl!.setAttribute('points', ptsStr);
          this.finalizePolyline();
          return;
        }
        this.polylinePoints.push({ x: pt.x, y: pt.y });
        const ptsStr = this.polylinePoints.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
        this.drawingEl!.setAttribute('points', ptsStr);
      }
      return;
    }

    this.isDrawing = true;
    this.drawStartX = pt.x;
    this.drawStartY = pt.y;

    switch (this.activeTool) {
      case 'frame':
        this.drawingEl = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        this.drawingEl.setAttribute('x', `${pt.x}`);
        this.drawingEl.setAttribute('y', `${pt.y}`);
        this.drawingEl.setAttribute('width', '0');
        this.drawingEl.setAttribute('height', '0');
        this.drawingEl.setAttribute('fill', '#ffffff');
        this.drawingEl.setAttribute('stroke', '#dcdcdc');
        this.drawingEl.setAttribute('class', 'vectronomy-frame-preview');
        break;
      case 'rect':
        this.drawingEl = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        this.drawingEl.setAttribute('x', `${pt.x}`);
        this.drawingEl.setAttribute('y', `${pt.y}`);
        this.drawingEl.setAttribute('width', '0');
        this.drawingEl.setAttribute('height', '0');
        break;
      case 'circle':
        this.drawingEl = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
        this.drawingEl.setAttribute('cx', `${pt.x}`);
        this.drawingEl.setAttribute('cy', `${pt.y}`);
        this.drawingEl.setAttribute('rx', '0');
        this.drawingEl.setAttribute('ry', '0');
        break;
      case 'line':
        this.drawingEl = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        this.drawingEl.setAttribute('x1', `${pt.x}`);
        this.drawingEl.setAttribute('y1', `${pt.y}`);
        this.drawingEl.setAttribute('x2', `${pt.x}`);
        this.drawingEl.setAttribute('y2', `${pt.y}`);
        break;
      case 'polygon':
        this.drawingEl = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        this.drawingEl.setAttribute('points', `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`);
        break;
      case 'star':
        this.drawingEl = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        this.drawingEl.setAttribute('points', `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`);
        break;
      case 'spiral':
        this.drawingEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        this.drawingEl.setAttribute('d', `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`);
        break;
      case 'pencil':
        this.drawingEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        this.pencilPoints = [{ x: pt.x, y: pt.y }];
        this.drawingEl.setAttribute('d', `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`);
        break;
      case 'brush':
        this.drawingEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        this.brushPoints = [{ x: pt.x, y: pt.y }];
        this.drawingEl.setAttribute('d', `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`);
        break;
      case 'eraser':
        this.drawingEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        this.eraserPoints = [{ x: pt.x, y: pt.y }];
        this.drawingEl.setAttribute('d', `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`);
        break;
    }

    if (this.drawingEl) {
      this.drawingEl.setAttribute('data-xcs-id', id);
      
      if (this.activeTool === 'brush') {
        this.drawingEl.setAttribute('stroke', this.currentStrokeColor);
        this.drawingEl.setAttribute('stroke-width', this.brushSize.toString());
        this.drawingEl.setAttribute('fill', 'none');
        if (this.brushStyle === 'round') {
          this.drawingEl.setAttribute('stroke-linecap', 'round');
          this.drawingEl.setAttribute('stroke-linejoin', 'round');
        } else if (this.brushStyle === 'flat') {
          this.drawingEl.setAttribute('stroke-linecap', 'butt');
          this.drawingEl.setAttribute('stroke-linejoin', 'miter');
        } else if (this.brushStyle === 'calligraphic') {
          this.drawingEl.setAttribute('stroke-linecap', 'square');
          this.drawingEl.setAttribute('stroke-linejoin', 'bevel');
        }
      } else if (this.activeTool === 'eraser') {
        this.drawingEl.setAttribute('stroke', 'rgba(255, 0, 0, 0.5)');
        this.drawingEl.setAttribute('stroke-width', this.brushSize.toString());
        this.drawingEl.setAttribute('fill', 'none');
        this.drawingEl.setAttribute('stroke-linecap', 'round');
        this.drawingEl.setAttribute('stroke-linejoin', 'round');
      } else {
        this.drawingEl.setAttribute('stroke', '#00ffc2');
        this.drawingEl.setAttribute('stroke-width', '1.5');
        this.drawingEl.setAttribute('fill', 'none');
      }
      
      viewport.appendChild(this.drawingEl);
    }
  }

  private updateDraw(e: MouseEvent) {
    if (!this.drawingEl) return;
    
    if (this.activeTool === 'pen') {
      const pt = this.getSvgPoint(e);
      if (!pt) return;

      if (this.penDraggingPoint) {
        this.penDraggingPoint.cp2x = pt.x;
        this.penDraggingPoint.cp2y = pt.y;

        const dx = pt.x - this.penDraggingPoint.x;
        const dy = pt.y - this.penDraggingPoint.y;
        this.penDraggingPoint.cp1x = this.penDraggingPoint.x - dx;
        this.penDraggingPoint.cp1y = this.penDraggingPoint.y - dy;

        const d = this.getPathD(this.penPoints);
        this.drawingEl.setAttribute('d', d);
      } else {
        const previewPt: PenPoint = { x: pt.x, y: pt.y };
        const d = this.getPathD(this.penPoints, false, previewPt);
        this.drawingEl.setAttribute('d', d);
      }
      
      this.renderPenOverlay(pt);
      return;
    }

    const pt = this.getSvgPoint(e);
    if (!pt) return;
    let dx = pt.x - this.drawStartX;
    let dy = pt.y - this.drawStartY;

    if (e.shiftKey) {
      if (this.activeTool === 'rect' || this.activeTool === 'circle' || this.activeTool === 'polygon' || this.activeTool === 'star') {
        const maxDist = Math.max(Math.abs(dx), Math.abs(dy));
        dx = dx < 0 ? -maxDist : maxDist;
        dy = dy < 0 ? -maxDist : maxDist;
        pt.x = this.drawStartX + dx;
        pt.y = this.drawStartY + dy;
      } else if (this.activeTool === 'line') {
        const angle = Math.atan2(dy, dx);
        const snappedAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
        const length = Math.sqrt(dx * dx + dy * dy);
        dx = length * Math.cos(snappedAngle);
        dy = length * Math.sin(snappedAngle);
        pt.x = this.drawStartX + dx;
        pt.y = this.drawStartY + dy;
      }
    }

    switch (this.activeTool) {
      case 'frame':
      case 'rect': {
        const x = dx < 0 ? pt.x : this.drawStartX;
        const y = dy < 0 ? pt.y : this.drawStartY;
        this.drawingEl.setAttribute('x', `${x}`);
        this.drawingEl.setAttribute('y', `${y}`);
        this.drawingEl.setAttribute('width', `${Math.abs(dx)}`);
        this.drawingEl.setAttribute('height', `${Math.abs(dy)}`);
        break;
      }
      case 'circle':
        this.drawingEl.setAttribute('rx', `${Math.abs(dx)}`);
        this.drawingEl.setAttribute('ry', `${Math.abs(dy)}`);
        break;
      case 'line':
        this.drawingEl.setAttribute('x2', `${pt.x}`);
        this.drawingEl.setAttribute('y2', `${pt.y}`);
        break;
      case 'polyline': {
        const tempPoints = [...this.polylinePoints, { x: pt.x, y: pt.y }];
        const ptsStr = tempPoints.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
        this.drawingEl.setAttribute('points', ptsStr);
        break;
      }
      case 'polygon': {
        const r = Math.sqrt(dx * dx + dy * dy);
        const sides = this.polygonSides;
        const points: string[] = [];
        const baseAngle = e.shiftKey ? -Math.PI / 2 : Math.atan2(dy, dx);
        for (let i = 0; i < sides; i++) {
          const angle = baseAngle + i * (2 * Math.PI / sides);
          const px = this.drawStartX + r * Math.cos(angle);
          const py = this.drawStartY + r * Math.sin(angle);
          points.push(`${px.toFixed(1)},${py.toFixed(1)}`);
        }
        this.drawingEl.setAttribute('points', points.join(' '));
        break;
      }
      case 'star': {
        const rOut = Math.sqrt(dx * dx + dy * dy);
        const rIn = rOut * 0.4;
        const numPoints = this.starPoints;
        const points: string[] = [];
        const baseAngle = e.shiftKey ? -Math.PI / 2 : Math.atan2(dy, dx);
        const totalVertices = numPoints * 2;
        for (let i = 0; i < totalVertices; i++) {
          const angle = baseAngle + i * (Math.PI / numPoints);
          const r = i % 2 === 0 ? rOut : rIn;
          const px = this.drawStartX + r * Math.cos(angle);
          const py = this.drawStartY + r * Math.sin(angle);
          points.push(`${px.toFixed(1)},${py.toFixed(1)}`);
        }
        this.drawingEl.setAttribute('points', points.join(' '));
        break;
      }
      case 'spiral': {
        const rMax = Math.sqrt(dx * dx + dy * dy);
        if (rMax < 2) break;
        const baseAngle = Math.atan2(dy, dx);
        const turns = 4;
        const thetaMax = turns * 2 * Math.PI;
        const b = 0.15;
        const a = rMax / Math.exp(b * thetaMax);
        const pathPoints: string[] = [];
        const steps = 120;
        for (let i = 0; i <= steps; i++) {
          const theta = (i / steps) * thetaMax;
          const r = a * Math.exp(b * theta);
          const px = this.drawStartX + r * Math.cos(theta + baseAngle);
          const py = this.drawStartY + r * Math.sin(theta + baseAngle);
          pathPoints.push(`${i === 0 ? 'M' : 'L'} ${px.toFixed(1)} ${py.toFixed(1)}`);
        }
        this.drawingEl.setAttribute('d', pathPoints.join(' '));
        break;
      }
      case 'pencil': {
        this.pencilPoints.push({ x: pt.x, y: pt.y });
        const d = this.pencilPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
        this.drawingEl.setAttribute('d', d);
        break;
      }
      case 'brush': {
        this.brushPoints.push({ x: pt.x, y: pt.y });
        this.drawingEl.setAttribute('d', this.getSmoothedPencilD(this.brushPoints));
        break;
      }
      case 'eraser': {
        this.eraserPoints.push({ x: pt.x, y: pt.y });
        this.drawingEl.setAttribute('d', this.getSmoothedPencilD(this.eraserPoints));
        break;
      }
    }
  }

  private finalizeDraw() {
    if (this.activeTool === 'pen' || this.activeTool === 'polyline') return;
    
    if (this.activeTool === 'pencil' && this.drawingEl && this.pencilPoints.length > 2) {
      const smoothedD = this.getSmoothedPencilD(this.pencilPoints);
      this.drawingEl.setAttribute('d', smoothedD);
      this.pencilPoints = [];
    }
    
    if (this.activeTool === 'brush' && this.drawingEl && this.brushPoints.length > 1) {
      if (this.brushStyle === 'calligraphic') {
        const calligraphicD = this.getCalligraphicD(this.brushPoints, this.brushSize);
        this.drawingEl.setAttribute('d', calligraphicD);
        this.drawingEl.setAttribute('fill', this.currentStrokeColor);
        this.drawingEl.setAttribute('stroke', 'none');
      } else {
        const smoothedD = this.getSmoothedPencilD(this.brushPoints);
        this.drawingEl.setAttribute('d', smoothedD);
      }
      this.brushPoints = [];
    }
    
    if (this.activeTool === 'eraser' && this.drawingEl && this.eraserPoints.length > 1) {
      const eraserD = this.getSmoothedPencilD(this.eraserPoints);
      const size = this.brushSize;
      this.eraserPoints = [];
      this.drawingEl.remove();
      this.drawingEl = null;
      this.isDrawing = false;
      this.performVectorEraser(eraserD, size);
      return;
    }

    if (this.activeTool === 'frame' && this.drawingEl) {
      const mainSvg = this.container.querySelector('svg');
      const viewport = mainSvg?.querySelector('#viewport') || mainSvg;
      
      const frameRect = this.drawingEl as SVGRectElement;
      const rectX = parseFloat(frameRect.getAttribute('x') || '0');
      const rectY = parseFloat(frameRect.getAttribute('y') || '0');
      const rectW = parseFloat(frameRect.getAttribute('width') || '0');
      const rectH = parseFloat(frameRect.getAttribute('height') || '0');
      
      if (rectW > 5 && rectH > 5) {
        const containedEls: SVGGraphicsElement[] = [];
        if (mainSvg) {
          const allEls = mainSvg.querySelectorAll('[data-xcs-id]');
          allEls.forEach(el => {
            if (el === this.drawingEl) return;
            if (el.tagName.toLowerCase() === 'path' && el.parentElement?.hasAttribute('data-xcs-id')) return;
            if (el.classList.contains('vectronomy-frame')) return; // Avoid nesting frames for now
            const box = this.getTransformedBBox(el as SVGGraphicsElement);
            // Check intersection with drawn frame
            if (box.x < rectX + rectW && box.x + box.width > rectX && box.y < rectY + rectH && box.y + box.height > rectY) {
              containedEls.push(el as SVGGraphicsElement);
            }
          });
        }

        const frame = LayoutEngine.createFrameFromBounds(rectX, rectY, rectW, rectH, containedEls);
        if (frame && viewport) {
          viewport.appendChild(frame);
          this.drawingEl.remove();
          this.selectedIds.add(frame.getAttribute('data-xcs-id')!);
          this.selectedId = frame.getAttribute('data-xcs-id')!;
          this.renderSelectionUI();
          this.notifyChange(frame);
        }
      } else {
        this.drawingEl.remove();
      }
    }
    
    this.isDrawing = false;
    this.drawingEl = null;
    this.commit();
  }

  private performVectorEraser(eraserPathD: string, size: number) {
    const mainSvg = this.container.querySelector('svg');
    const viewport = mainSvg?.querySelector('#viewport') || mainSvg;
    if (!viewport) return;

    // Calculate eraser bounding box to skip non-intersecting elements
    let exMin = Infinity, exMax = -Infinity, eyMin = Infinity, eyMax = -Infinity;
    for (const p of this.eraserPoints) {
      if (p.x < exMin) exMin = p.x;
      if (p.x > exMax) exMax = p.x;
      if (p.y < eyMin) eyMin = p.y;
      if (p.y > eyMax) eyMax = p.y;
    }
    const erPadding = size / 2;
    exMin -= erPadding; exMax += erPadding;
    eyMin -= erPadding; eyMax += erPadding;

    // Generate a single compound path containing circles and polygons for a uniform thickness stroke
    let eraserShapeD = '';
    const radius = size / 2;
    for (let i = 0; i < this.eraserPoints.length; i++) {
      const p = this.eraserPoints[i];
      eraserShapeD += `M ${p.x - radius} ${p.y} A ${radius} ${radius} 0 1 0 ${p.x + radius} ${p.y} A ${radius} ${radius} 0 1 0 ${p.x - radius} ${p.y} Z `;
      if (i > 0) {
        const prev = this.eraserPoints[i - 1];
        const angle = Math.atan2(p.y - prev.y, p.x - prev.x);
        const dx = radius * Math.cos(angle + Math.PI / 2);
        const dy = radius * Math.sin(angle + Math.PI / 2);
        eraserShapeD += `M ${prev.x + dx} ${prev.y + dy} L ${prev.x - dx} ${prev.y - dy} L ${p.x - dx} ${p.y - dy} L ${p.x + dx} ${p.y + dy} Z `;
      }
    }
    const eraserSvgStr = `<svg xmlns="http://www.w3.org/2000/svg"><path d="${eraserShapeD}" fill="black" fill-rule="nonzero" /></svg>`;
    
    const elements = Array.from(viewport.querySelectorAll('[data-xcs-id]'));
    let modified = false;

    elements.forEach(el => {
      if (['path', 'rect', 'circle', 'ellipse', 'polygon', 'polyline'].includes(el.tagName.toLowerCase())) {
        
        // Skip elements that don't intersect the eraser's bounding box
        const elBox = this.getTransformedBBox(el as SVGGraphicsElement);
        if (elBox.x + elBox.width < exMin || elBox.x > exMax || elBox.y + elBox.height < eyMin || elBox.y > eyMax) {
          return;
        }

        const elSvgStr = `<svg xmlns="http://www.w3.org/2000/svg">${el.outerHTML}</svg>`;
        const result = Pathfinder.performOperation(elSvgStr, eraserSvgStr, 'subtract');
        if (result) {
          const parser = new DOMParser();
          const doc = parser.parseFromString(result, 'image/svg+xml');
          const newPaths = Array.from(doc.querySelectorAll('path, rect, circle, ellipse, polygon, polyline')) as SVGElement[];
          if (newPaths.length > 0) {
            const originalId = el.getAttribute('data-xcs-id');
            const originalStroke = el.getAttribute('stroke');
            const originalFill = el.getAttribute('fill');
            const originalStrokeWidth = el.getAttribute('stroke-width');
            
            // If completely erased (Pathfinder may return an empty path `<path d=""/>`)
            if (newPaths.length === 1 && (!newPaths[0].getAttribute('d') || newPaths[0].getAttribute('d')!.length < 2)) {
                el.remove();
            } else {
                const fragment = document.createDocumentFragment();
                newPaths.forEach((np, i) => {
                    if (originalStroke) np.setAttribute('stroke', originalStroke);
                    if (originalFill) np.setAttribute('fill', originalFill);
                    if (originalStrokeWidth) np.setAttribute('stroke-width', originalStrokeWidth);
                    if (i === 0 && originalId) np.setAttribute('data-xcs-id', originalId);
                    else np.setAttribute('data-xcs-id', `el-${Date.now()}-${Math.floor(Math.random() * 1000)}`);
                    fragment.appendChild(np);
                });
                el.replaceWith(fragment);
            }
            modified = true;
          } else {
            el.remove();
            modified = true;
          }
        }
      }
    });

    if (modified) this.commit();
  }

  private getPointsFromD(d: string): {x: number, y: number}[] {
      const parts = d.split(/[A-Za-z]/).filter(p => p.trim() !== '');
      const pts: {x: number, y: number}[] = [];
      parts.forEach(part => {
          const coords = part.trim().split(' ').filter(c => c.trim() !== '');
          for (let i=0; i<coords.length; i+=2) {
              if (coords[i] && coords[i+1]) {
                  pts.push({x: parseFloat(coords[i]), y: parseFloat(coords[i+1])});
              }
          }
      });
      return pts;
  }

  private getCalligraphicD(pts: { x: number; y: number }[], size: number): string {
    if (pts.length < 2) return '';
    const angle = Math.PI / 4; // 45 degrees
    const dx = Math.cos(angle) * (size / 2);
    const dy = Math.sin(angle) * (size / 2);

    const topPts = pts.map(p => ({ x: p.x - dx, y: p.y - dy }));
    const bottomPts = pts.map(p => ({ x: p.x + dx, y: p.y + dy })).reverse();

    const allPts = [...topPts, ...bottomPts];
    let d = `M ${allPts[0].x.toFixed(1)} ${allPts[0].y.toFixed(1)}`;
    for (let i = 1; i < allPts.length; i++) {
      d += ` L ${allPts[i].x.toFixed(1)} ${allPts[i].y.toFixed(1)}`;
    }
    d += ' Z';
    return d;
  }

  finalizePolyline() {
    if (!this.drawingEl) return;
    if (this.polylinePoints.length < 2) {
      this.drawingEl.remove();
    } else {
      const ptsStr = this.polylinePoints.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
      this.drawingEl.setAttribute('points', ptsStr);
      this.commit();
    }
    this.isDrawing = false;
    this.polylinePoints = [];
    this.drawingEl = null;
  }

  private getSmoothedPencilD(pts: { x: number; y: number }[]): string {
    if (pts.length < 2) return '';
    if (pts.length === 2) return `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)} L ${pts[1].x.toFixed(1)} ${pts[1].y.toFixed(1)}`;
    
    const simplified = this.simplifyPoints(pts, 1.5);
    let d = `M ${simplified[0].x.toFixed(1)} ${simplified[0].y.toFixed(1)}`;
    for (let i = 0; i < simplified.length - 1; i++) {
      const p0 = simplified[i];
      const p1 = simplified[i + 1];
      const pNext = simplified[i + 2] || p1;
      const pPrev = simplified[i - 1] || p0;
      
      const cp1x = p0.x + (p1.x - pPrev.x) / 6;
      const cp1y = p0.y + (p1.y - pPrev.y) / 6;
      const cp2x = p1.x - (pNext.x - p0.x) / 6;
      const cp2y = p1.y - (pNext.y - p0.y) / 6;
      
      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)} ${cp2x.toFixed(1)} ${cp2y.toFixed(1)} ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
    }
    return d;
  }

  private simplifyPoints(pts: { x: number; y: number }[], tolerance: number): { x: number; y: number }[] {
    if (pts.length <= 2) return pts;
    let maxSqDist = 0;
    let index = 0;
    const end = pts.length - 1;
    for (let i = 1; i < end; i++) {
      const sqDist = this.getSqSegDist(pts[i], pts[0], pts[end]);
      if (sqDist > maxSqDist) {
        index = i;
        maxSqDist = sqDist;
      }
    }
    if (maxSqDist > tolerance * tolerance) {
      const results1 = this.simplifyPoints(pts.slice(0, index + 1), tolerance);
      const results2 = this.simplifyPoints(pts.slice(index), tolerance);
      return results1.slice(0, results1.length - 1).concat(results2);
    }
    return [pts[0], pts[end]];
  }

  private getSqSegDist(p: { x: number; y: number }, p1: { x: number; y: number }, p2: { x: number; y: number }): number {
    let x = p1.x;
    let y = p1.y;
    let dx = p2.x - x;
    let dy = p2.y - y;
    if (dx !== 0 || dy !== 0) {
      const t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);
      if (t > 1) {
        x = p2.x;
        y = p2.y;
      } else if (t > 0) {
        x += dx * t;
        y += dy * t;
      }
    }
    dx = p.x - x;
    dy = p.y - y;
    return dx * dx + dy * dy;
  }

  createGridArray(rows: number, cols: number, spacingX: number, spacingY: number) {
    const el = this.getSelectedEl();
    if (!el) return;
    const mainSvg = this.container.querySelector('svg');
    const viewport = mainSvg?.querySelector('#viewport') || mainSvg;
    if (!mainSvg || !viewport) return;

    this.onInteractionStart();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (r === 0 && c === 0) continue;
        const clone = el.cloneNode(true) as SVGGraphicsElement;
        const newId = `array-${Date.now()}-${r}-${c}-${Math.random().toString(36).substr(2, 4)}`;
        clone.setAttribute('data-xcs-id', newId);
        
        viewport.appendChild(clone);
        this.translateEl(clone, c * spacingX, r * spacingY);
      }
    }
    this.commit();
    this.clearSelection();
    this.renderSelectionUI();
    this.onInteractionEnd();
  }

  public canUndoDrawing(): boolean {
    if (!this.isDrawing) return false;
    if (this.activeTool === 'pen' && this.penPoints.length > 0) return true;
    if (this.activeTool === 'polyline' && this.polylinePoints.length > 0) return true;
    return false;
  }

  public undoDrawing(): void {
    if (this.activeTool === 'pen' && this.penPoints.length > 0) {
      this.penPoints.pop();
      if (this.penPoints.length === 0) {
        this.cancelDrawing();
      } else {
        const d = this.getPathD(this.penPoints, false, undefined);
        if (this.drawingEl) this.drawingEl.setAttribute('d', d);
        this.renderPenOverlay();
      }
    } else if (this.activeTool === 'polyline' && this.polylinePoints.length > 0) {
      this.polylinePoints.pop();
      if (this.polylinePoints.length === 0) {
        this.cancelDrawing();
      } else {
        const d = `M ${this.polylinePoints[0].x} ${this.polylinePoints[0].y} ` + 
                  this.polylinePoints.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
        if (this.drawingEl) this.drawingEl.setAttribute('d', d);
      }
    }
  }

  public cancelDrawing(): void {
    if (this.drawingEl) {
      this.drawingEl.remove();
      this.drawingEl = null;
    }
    this.isDrawing = false;
    this.penPoints = [];
    this.polylinePoints = [];
    this.renderPenOverlay();
  }

  private finalizePenPath() {
    if (!this.drawingEl) return;
    if (this.penPoints.length < 2) {
      this.drawingEl.remove();
    } else {
      const d = this.getPathD(this.penPoints);
      this.drawingEl.setAttribute('d', d);
      this.commit();
    }
    this.isDrawing = false;
    this.penPoints = [];
    this.drawingEl = null;
    this.penDraggingPoint = null;
    this.renderPenOverlay(); // Clear overlay
  }

  private renderPenOverlay(ptMouse?: { x: number; y: number }) {
    const mainSvg = this.container.querySelector('svg');
    if (!mainSvg) return;
    
    let overlay = mainSvg.querySelector('.pen-overlay') as SVGGElement | null;
    if (!overlay) {
      overlay = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      overlay.setAttribute('class', 'pen-overlay');
      overlay.setAttribute('style', 'pointer-events: none;');
      const viewport = mainSvg.querySelector('#viewport') || mainSvg;
      viewport.appendChild(overlay);
    }
    overlay.innerHTML = '';

    if (!this.isDrawing || this.penPoints.length === 0) {
      overlay.remove();
      return;
    }

    this.penPoints.forEach(p => {
      // Draw anchor point itself
      const anchor = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      anchor.setAttribute('cx', `${p.x}`);
      anchor.setAttribute('cy', `${p.y}`);
      anchor.setAttribute('r', '3.5');
      anchor.setAttribute('fill', '#ffffff');
      anchor.setAttribute('stroke', '#00ffc2');
      anchor.setAttribute('stroke-width', '1.5');
      overlay!.appendChild(anchor);

      // Draw handles
      if (p.cp1x !== undefined && p.cp1y !== undefined) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', `${p.x}`);
        line.setAttribute('y1', `${p.y}`);
        line.setAttribute('x2', `${p.cp1x}`);
        line.setAttribute('y2', `${p.cp1y}`);
        line.setAttribute('stroke', '#00ffc2');
        line.setAttribute('stroke-width', '1');
        line.setAttribute('stroke-dasharray', '2,2');
        overlay!.appendChild(line);

        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', `${p.cp1x}`);
        circle.setAttribute('cy', `${p.cp1y}`);
        circle.setAttribute('r', '3');
        circle.setAttribute('fill', '#00ffc2');
        overlay!.appendChild(circle);
      }

      if (p.cp2x !== undefined && p.cp2y !== undefined) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', `${p.x}`);
        line.setAttribute('y1', `${p.y}`);
        line.setAttribute('x2', `${p.cp2x}`);
        line.setAttribute('y2', `${p.cp2y}`);
        line.setAttribute('stroke', '#00ffc2');
        line.setAttribute('stroke-width', '1');
        line.setAttribute('stroke-dasharray', '2,2');
        overlay!.appendChild(line);

        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', `${p.cp2x}`);
        circle.setAttribute('cy', `${p.cp2y}`);
        circle.setAttribute('r', '3');
        circle.setAttribute('fill', '#00ffc2');
        overlay!.appendChild(circle);
      }
    });

    if (ptMouse && this.penPoints.length > 2) {
      const p0 = this.penPoints[0];
      const dist = Math.sqrt((ptMouse.x - p0.x) ** 2 + (ptMouse.y - p0.y) ** 2);
      const scale = this.getScale();
      if (dist < 10 / scale) {
        const closeIndicator = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        closeIndicator.setAttribute('cx', `${p0.x}`);
        closeIndicator.setAttribute('cy', `${p0.y}`);
        closeIndicator.setAttribute('r', '8');
        closeIndicator.setAttribute('fill', 'rgba(0, 255, 194, 0.2)');
        closeIndicator.setAttribute('stroke', '#00ffc2');
        closeIndicator.setAttribute('stroke-width', '1.5');
        overlay.appendChild(closeIndicator);
      }
    }
  }

  private getPathD(points: PenPoint[], closed: boolean = false, previewPoint?: PenPoint): string {
    if (points.length === 0) return '';
    let d = `M${points[0].x},${points[0].y}`;
    
    const pts = [...points];
    if (previewPoint) pts.push(previewPoint);
    
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const curr = pts[i];
      
      const hasPrevOut = prev.cp2x !== undefined && prev.cp2y !== undefined;
      const hasCurrIn = curr.cp1x !== undefined && curr.cp1y !== undefined;
      
      if (hasPrevOut || hasCurrIn) {
        const cp1x = prev.cp2x !== undefined ? prev.cp2x : prev.x;
        const cp1y = prev.cp2y !== undefined ? prev.cp2y : prev.y;
        const cp2x = curr.cp1x !== undefined ? curr.cp1x : curr.x;
        const cp2y = curr.cp1y !== undefined ? curr.cp1y : curr.y;
        d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${curr.x},${curr.y}`;
      } else {
        d += ` L${curr.x},${curr.y}`;
      }
    }
    
    if (closed && points.length > 2) {
      const prev = points[points.length - 1];
      const curr = points[0];
      const hasPrevOut = prev.cp2x !== undefined && prev.cp2y !== undefined;
      const hasCurrIn = curr.cp1x !== undefined && curr.cp1y !== undefined;
      
      if (hasPrevOut || hasCurrIn) {
        const cp1x = prev.cp2x !== undefined ? prev.cp2x : prev.x;
        const cp1y = prev.cp2y !== undefined ? prev.cp2y : prev.y;
        const cp2x = curr.cp1x !== undefined ? curr.cp1x : curr.x;
        const cp2y = curr.cp1y !== undefined ? curr.cp1y : curr.y;
        d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${curr.x},${curr.y}`;
      } else {
        d += ` L${curr.x},${curr.y}`;
      }
      d += 'Z';
    }
    
    return d;
  }

  // ── Selection ─────────────────────────────────────────────────

  private selectElement(id: string) {
    this.selectedId = id;
    const el = this.getSelectedEl() as SVGGraphicsElement | null;
    if (el) { this.renderSelectionUI(); this.notifyChange(el); }
  }


  private getScale(): number {
    const mainSvg = this.container.querySelector('svg');
    const viewport = mainSvg?.querySelector('#viewport') || mainSvg;
    if (!viewport) return 1;
    const ctm = (viewport as SVGGraphicsElement).getScreenCTM();
    return ctm ? ctm.a : 1;
  }

  public getSvgPoint(e: MouseEvent | Touch): DOMPoint | null {
    const mainSvg = this.container.querySelector('svg') as SVGSVGElement | null;
    const viewport = mainSvg?.querySelector('#viewport') || mainSvg;
    if (!mainSvg || !viewport) return null;
    const pt = mainSvg.createSVGPoint();
    if ('clientX' in e) {
      pt.x = e.clientX;
      pt.y = e.clientY;
    } else {
      pt.x = (e as TouchEvent).touches[0].clientX;
      pt.y = (e as TouchEvent).touches[0].clientY;
    }
    const transformed = pt.matrixTransform((viewport as SVGGraphicsElement).getScreenCTM()!.inverse());
    if (this.snapFn) {
      const snapped = this.snapFn({ x: transformed.x, y: transformed.y });
      transformed.x = snapped.x;
      transformed.y = snapped.y;
    }
    return transformed;
  }

  private getSelectedEls(): SVGGraphicsElement[] {
    const mainSvg = this.container.querySelector('svg');
    if (!mainSvg || this.selectedIds.size === 0) return [];
    const els: SVGGraphicsElement[] = [];
    this.selectedIds.forEach(id => {
      const el = mainSvg.querySelector(`[data-xcs-id="${id}"]`) as SVGGraphicsElement | null;
      if (el) els.push(el);
    });
    return els;
  }

  private getUnionBBox(els: SVGGraphicsElement[]) {
    if (els.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    els.forEach((el: SVGGraphicsElement) => {
      const box = this.getTransformedBBox(el);
      if (box.x < minX) minX = box.x;
      if (box.y < minY) minY = box.y;
      if (box.x + box.width > maxX) maxX = box.x + box.width;
      if (box.y + box.height > maxY) maxY = box.y + box.height;
    });
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  clearSelection() {
    this.selectedId = null;
    this.selectedIds.clear();
    this.nodeEditTarget = null;
    this.activeNodeIndex = null;
    this.parsedCommands = [];
    this.editingNodes = [];
    this.draggingNode = false;
    if (this.selectionGroup) { this.selectionGroup.remove(); this.selectionGroup = null; }
    this.onSelectionChange(null);
  }


  private deleteActiveNode() {
    if (this.activeNodeIndex === null || !this.nodeEditTarget) return;
    
    const node = this.editingNodes[this.activeNodeIndex];
    if (this.parsedCommands.length > 2) {
      this.parsedCommands.splice(node.cmdIndex, 1);
      
      // If we deleted the first M command, the new first command should become an M
      if (this.parsedCommands[0].type !== 'M') {
        this.parsedCommands[0].type = 'M';
      }
      
      this.nodeEditTarget.setAttribute('d', stringifySvgPath(this.parsedCommands));
      this.activeNodeIndex = null;
      // Re-parse
      this.renderSelectionUI();
      this.commit();
    }
  }

  deleteSelected() {
    if (this.activeTool === 'node' && this.activeNodeIndex !== null) {
      this.deleteActiveNode();
      return;
    }
    if (this.selectedIds.size === 0) return;
    const els = this.getSelectedEls();
    els.forEach((el: SVGGraphicsElement) => el.remove());
    this.clearSelection();
    this.commit();
  }

  private getSelectedEl(): Element | null {
    if (!this.selectedId) return null;
    return this.container.querySelector(`[data-xcs-id="${this.selectedId}"]`);
  }

  // ── Selection UI ──────────────────────────────────────────────

  public renderSelectionUI() {
    const els = this.getSelectedEls();
    if (els.length === 0) {
      if (this.selectionGroup) { this.selectionGroup.remove(); this.selectionGroup = null; }
      return;
    }
    if (this.activeTool === 'node' && this.nodeEditTarget) {
      this.renderNodeUI(this.nodeEditTarget);
      return;
    }
    if (this.activeTool === 'node') {
      // Node tool selected, but no path targeted yet. Hide selection UI.
      if (this.selectionGroup) { this.selectionGroup.remove(); this.selectionGroup = null; }
      return;
    }
    const mainSvg = this.container.querySelector('svg') as SVGSVGElement | null;
    const viewport = mainSvg?.querySelector('#viewport') || mainSvg;
    if (!mainSvg || !viewport) return;

    const tBox = this.getUnionBBox(els);
    const screenCTM = (viewport as SVGGraphicsElement).getScreenCTM()!;
    const invScale = 1 / (screenCTM.a || 1);

    if (!this.selectionGroup) {
      this.selectionGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      this.selectionGroup.setAttribute('class', 'selection-overlay');
      viewport.appendChild(this.selectionGroup);
    }
    this.selectionGroup.innerHTML = '';

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.selectionGroup.appendChild(g);

    // Bounding rect
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', `${tBox.x - 1 * invScale}`);
    rect.setAttribute('y', `${tBox.y - 1 * invScale}`);
    rect.setAttribute('width', `${tBox.width + 2 * invScale}`);
    rect.setAttribute('height', `${tBox.height + 2 * invScale}`);
    rect.setAttribute('fill', 'rgba(0,255,194,0.04)');
    rect.setAttribute('stroke', '#00ffc2');
    rect.setAttribute('stroke-width', `${1.5 * invScale}`);
    rect.setAttribute('stroke-dasharray', `${3 * invScale},${2 * invScale}`);
    g.appendChild(rect);

    // Handles
    const hs = 5 * invScale;
    const rs = 13 * invScale; // Rotate hit area size

    // Invisible rotate handles placed behind resize handles
    const rotHandles = [
      { id: 'tl-rot', x: tBox.x, y: tBox.y },
      { id: 'tr-rot', x: tBox.x + tBox.width, y: tBox.y },
      { id: 'bl-rot', x: tBox.x, y: tBox.y + tBox.height },
      { id: 'br-rot', x: tBox.x + tBox.width, y: tBox.y + tBox.height },
    ];
    for (const h of rotHandles) {
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      c.setAttribute('x', `${h.x - rs}`);
      c.setAttribute('y', `${h.y - rs}`);
      c.setAttribute('width', `${rs * 2}`);
      c.setAttribute('height', `${rs * 2}`);
      c.setAttribute('fill', 'transparent');
      c.setAttribute('data-handle-id', h.id);
      c.style.pointerEvents = 'all';
      c.style.cursor = "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\"><path fill=\"none\" stroke=\"%23fff\" stroke-width=\"4\" stroke-linecap=\"round\" d=\"M12 21a9 9 0 1 0-9-9\"/><path fill=\"%23fff\" d=\"M3 12v6h6\"/><path fill=\"none\" stroke=\"%23000\" stroke-width=\"1.5\" stroke-linecap=\"round\" d=\"M12 21a9 9 0 1 0-9-9\"/><path fill=\"%23000\" d=\"M3 12v6h6\"/></svg>') 10 10, crosshair";
      g.appendChild(c);
    }
    const handles = [
      { id: 'tl', x: tBox.x, y: tBox.y },
      { id: 'tc', x: tBox.x + tBox.width / 2, y: tBox.y },
      { id: 'tr', x: tBox.x + tBox.width, y: tBox.y },
      { id: 'ml', x: tBox.x, y: tBox.y + tBox.height / 2 },
      { id: 'mr', x: tBox.x + tBox.width, y: tBox.y + tBox.height / 2 },
      { id: 'bl', x: tBox.x, y: tBox.y + tBox.height },
      { id: 'bc', x: tBox.x + tBox.width / 2, y: tBox.y + tBox.height },
      { id: 'br', x: tBox.x + tBox.width, y: tBox.y + tBox.height },
    ];

    for (const h of handles) {
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      c.setAttribute('x', `${h.x - hs}`);
      c.setAttribute('y', `${h.y - hs}`);
      c.setAttribute('width', `${hs * 2}`);
      c.setAttribute('height', `${hs * 2}`);
      c.setAttribute('rx', `${hs * 0.4}`);
      c.setAttribute('fill', '#fff');
      c.setAttribute('stroke', '#00ffc2');
      c.setAttribute('stroke-width', `${1.2 * invScale}`);
      c.setAttribute('data-handle-id', h.id);
      c.style.pointerEvents = 'all';
      c.style.cursor = this.getCursorForHandle(h.id);
      g.appendChild(c);
    }
  }

  
  private renderNodeUI(el: SVGGraphicsElement) {
    const mainSvg = this.container.querySelector('svg') as SVGSVGElement | null;
    const viewport = mainSvg?.querySelector('#viewport') as SVGGraphicsElement || mainSvg;
    if (!mainSvg || !viewport) return;

    if (!this.selectionGroup) {
      this.selectionGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      this.selectionGroup.setAttribute('class', 'selection-overlay');
      viewport.appendChild(this.selectionGroup);
    }

    const d = el.getAttribute('d');
    if (!d) return;

    // Only parse if not actively dragging to avoid losing floating point precision or state
    if (!this.draggingNode) {
      this.selectionGroup.innerHTML = '';
      const newG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      this.selectionGroup.appendChild(newG);

      const rawCmds = parseSvgPath(d);
      this.parsedCommands = absolutizePath(rawCmds);
      this.editingNodes = extractNodes(this.parsedCommands);
    } else {
      // Fast path for dragging: update existing DOM elements instead of re-creating them
      const vpScreenCTM = (viewport as SVGGraphicsElement).getScreenCTM()!;
      const invScale = 1 / (vpScreenCTM.a || 1);
      const hs = 4 * invScale;
      
      const pathCTM = el.getCTM();
      const vpCTM = (viewport as SVGGraphicsElement).getCTM();
      let pathToViewport: DOMMatrix | null = null;
      if (pathCTM && vpCTM) {
        pathToViewport = vpCTM.inverse().multiply(pathCTM);
      }

      const g = this.selectionGroup.firstChild as SVGGElement | null;
      if (!g) return;

      if (this.editingNodes.length > 1) {
        const linePath = g.querySelector('path');
        if (linePath) {
          let lineD = '';
          this.editingNodes.forEach((node, idx) => {
            let nx = node.x, ny = node.y;
            if (pathToViewport) {
              const tx = pathToViewport.a * node.x + pathToViewport.c * node.y + pathToViewport.e;
              const ty = pathToViewport.b * node.x + pathToViewport.d * node.y + pathToViewport.f;
              nx = tx; ny = ty;
            }
            lineD += `${idx === 0 ? 'M' : 'L'}${nx},${ny} `;
          });
          linePath.setAttribute('d', lineD);
        }
      }

      if (this.activeNodeIndex !== null) {
        const activeRect = g.querySelector(`rect[data-node-index="${this.activeNodeIndex}"]`);
        if (activeRect) {
          const node = this.editingNodes[this.activeNodeIndex];
          let nx = node.x, ny = node.y;
          if (pathToViewport) {
            const tx = pathToViewport.a * node.x + pathToViewport.c * node.y + pathToViewport.e;
            const ty = pathToViewport.b * node.x + pathToViewport.d * node.y + pathToViewport.f;
            nx = tx; ny = ty;
          }
          activeRect.setAttribute('x', `${nx - hs}`);
          activeRect.setAttribute('y', `${ny - hs}`);
        }
      }
      return;
    }

    const vpScreenCTM = (viewport as SVGGraphicsElement).getScreenCTM()!;
    const invScale = 1 / (vpScreenCTM.a || 1);
    const hs = 4 * invScale;
    
    // Compute the full transform from path-local coords to viewport coords
    // This handles paths nested inside transformed <g> elements
    const pathCTM = el.getCTM();
    const vpCTM = (viewport as SVGGraphicsElement).getCTM();
    let pathToViewport: DOMMatrix | null = null;
    if (pathCTM && vpCTM) {
      pathToViewport = vpCTM.inverse().multiply(pathCTM);
    }
    
    const g = this.selectionGroup.firstChild as SVGGElement;

    // Draw connecting lines between anchor nodes
    if (this.editingNodes.length > 1) {
      const linePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      let lineD = '';
      this.editingNodes.forEach((node, idx) => {
        let nx = node.x, ny = node.y;
        if (pathToViewport) {
          const tx = pathToViewport.a * node.x + pathToViewport.c * node.y + pathToViewport.e;
          const ty = pathToViewport.b * node.x + pathToViewport.d * node.y + pathToViewport.f;
          nx = tx; ny = ty;
        }
        lineD += `${idx === 0 ? 'M' : 'L'}${nx},${ny} `;
      });
      linePath.setAttribute('d', lineD);
      linePath.setAttribute('fill', 'none');
      linePath.setAttribute('stroke', 'rgba(0, 255, 194, 0.3)');
      linePath.setAttribute('stroke-width', `${1 * invScale}`);
      linePath.setAttribute('stroke-dasharray', `${3 * invScale},${2 * invScale}`);
      linePath.style.pointerEvents = 'none';
      g.appendChild(linePath);
    }

    // Draw node handles
    this.editingNodes.forEach((node, idx) => {
      let nx = node.x;
      let ny = node.y;
      if (pathToViewport) {
        const tx = pathToViewport.a * node.x + pathToViewport.c * node.y + pathToViewport.e;
        const ty = pathToViewport.b * node.x + pathToViewport.d * node.y + pathToViewport.f;
        nx = tx; ny = ty;
      }

      const isActive = this.activeNodeIndex === idx;
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      c.setAttribute('x', `${nx - hs}`);
      c.setAttribute('y', `${ny - hs}`);
      c.setAttribute('width', `${hs * 2}`);
      c.setAttribute('height', `${hs * 2}`);
      c.setAttribute('rx', `${hs * 0.3}`);
      c.setAttribute('fill', isActive ? '#ff0055' : '#fff');
      c.setAttribute('stroke', isActive ? '#fff' : '#00ffc2');
      c.setAttribute('stroke-width', `${1.2 * invScale}`);
      c.setAttribute('data-node-index', `${idx}`);
      c.style.pointerEvents = 'all';
      c.style.cursor = 'move';
      g.appendChild(c);
    });
  }

  private getCursorForHandle(id: string): string {
    const map: Record<string, string> = {
      tl: 'nw-resize', tc: 'n-resize', tr: 'ne-resize',
      ml: 'w-resize',                  mr: 'e-resize',
      bl: 'sw-resize', bc: 's-resize', br: 'se-resize',
    };
    return map[id] || 'crosshair';
  }

  // ── Transform Helpers ─────────────────────────────────────────

  private getTransformedBBox(el: SVGGraphicsElement) {
    const bbox = el.getBBox();
    const matrix = el.transform.baseVal.consolidate()?.matrix;
    if (!matrix) return bbox;

    const pts = [
      { x: bbox.x, y: bbox.y },
      { x: bbox.x + bbox.width, y: bbox.y },
      { x: bbox.x, y: bbox.y + bbox.height },
      { x: bbox.x + bbox.width, y: bbox.y + bbox.height }
    ];

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of pts) {
      const nx = matrix.a * p.x + matrix.c * p.y + matrix.e;
      const ny = matrix.b * p.x + matrix.d * p.y + matrix.f;
      if (nx < minX) minX = nx;
      if (nx > maxX) maxX = nx;
      if (ny < minY) minY = ny;
      if (ny > maxY) maxY = ny;
    }

    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  private translateEl(el: SVGGraphicsElement, dx: number, dy: number) {
    const transformList = el.transform.baseVal;
    let matrixTransform = transformList.consolidate();
    if (!matrixTransform) {
      const mainSvg = this.container.querySelector('svg');
      if (!mainSvg) return;
      matrixTransform = mainSvg.createSVGTransform();
      matrixTransform.setMatrix(mainSvg.createSVGMatrix());
      transformList.appendItem(matrixTransform);
    }
    const m = matrixTransform.matrix;
    m.e += dx;
    m.f += dy;
    matrixTransform.setMatrix(m);
  }

  private resizeSelection(dx: number, dy: number, handle: string, shiftKey: boolean = false, altKey: boolean = false) {
    const els = this.getSelectedEls();
    if (els.length === 0) return;
    const tBox = this.getUnionBBox(els);

    let sx = 1;
    let sy = 1;

    // Center-based symmetrical sizing doubles the delta movement on each axis
    const factor = altKey ? 2 : 1;
    const adx = dx * factor;
    const ady = dy * factor;

    if (handle.includes('r')) sx = Math.max(0.001, tBox.width + adx) / Math.max(tBox.width, 0.001);
    if (handle.includes('l')) sx = Math.max(0.001, tBox.width - adx) / Math.max(tBox.width, 0.001);
    if (handle.includes('b')) sy = Math.max(0.001, tBox.height + ady) / Math.max(tBox.height, 0.001);
    if (handle.includes('t')) sy = Math.max(0.001, tBox.height - ady) / Math.max(tBox.height, 0.001);

    // Apply Shift key uniform scaling constraint
    if (shiftKey) {
      if (handle === 'ml' || handle === 'mr') {
        sy = sx;
      } else if (handle === 'tc' || handle === 'bc') {
        sx = sy;
      } else {
        // Corners: uniform scale matching the dominant axis change
        const scaleFactor = Math.abs(sx - 1) > Math.abs(sy - 1) ? sx : sy;
        sx = scaleFactor;
        sy = scaleFactor;
      }
    }

    // Determine the pivot point
    let pivotX = tBox.x;
    let pivotY = tBox.y;
    
    if (altKey) {
      // Figma Alt: resize centered around selection midpoint
      pivotX = tBox.x + tBox.width / 2;
      pivotY = tBox.y + tBox.height / 2;
    } else {
      // Standard: opposite corner/side acts as pivot anchor
      if (handle.includes('l')) pivotX = tBox.x + tBox.width;
      if (handle.includes('t')) pivotY = tBox.y + tBox.height;

      if (handle === 'tc' || handle === 'bc') pivotX = tBox.x + tBox.width / 2;
      if (handle === 'ml' || handle === 'mr') pivotY = tBox.y + tBox.height / 2;
    }

    const mainSvg = this.container.querySelector('svg')!;
    const sMat = mainSvg.createSVGMatrix()
      .translate(pivotX, pivotY)
      .scaleNonUniform(sx, sy)
      .translate(-pivotX, -pivotY);

    els.forEach((el: SVGGraphicsElement) => {
      const transformList = el.transform.baseVal;
      let matrixTransform = transformList.consolidate();
      if (!matrixTransform) {
        matrixTransform = mainSvg.createSVGTransform();
        matrixTransform.setMatrix(mainSvg.createSVGMatrix());
        transformList.appendItem(matrixTransform);
      }
      matrixTransform.setMatrix(sMat.multiply(matrixTransform.matrix));
    });
  }

  private rotateSelection(e: MouseEvent | TouchEvent, shiftKey: boolean) {
    const els = this.getSelectedEls();
    if (els.length === 0) return;
    
    let clientX = 0, clientY = 0;
    if ('clientX' in e) { clientX = e.clientX; clientY = e.clientY; }
    else { clientX = (e as TouchEvent).touches[0].clientX; clientY = (e as TouchEvent).touches[0].clientY; }
    
    const pt1 = this.getSvgPoint({ clientX: this.dragStartX, clientY: this.dragStartY } as any);
    const pt2 = this.getSvgPoint({ clientX, clientY } as any);
    if (!pt1 || !pt2) return;
    
    const angle1 = Math.atan2(pt1.y - this.dragPivotY, pt1.x - this.dragPivotX);
    const angle2 = Math.atan2(pt2.y - this.dragPivotY, pt2.x - this.dragPivotX);
    
    let diffAngle = (angle2 - angle1) * 180 / Math.PI;
    
    // Normalize diffAngle to avoid jumping around the -180/180 boundary
    if (diffAngle > 180) diffAngle -= 360;
    if (diffAngle < -180) diffAngle += 360;
    
    this.accumulatedRotation += diffAngle;
    
    let targetRotation = this.accumulatedRotation;
    if (shiftKey) {
      targetRotation = Math.round(this.accumulatedRotation / 15) * 15;
    }
    
    const applyDiff = targetRotation - this.lastAppliedRotation;
    if (applyDiff === 0) return;
    
    this.lastAppliedRotation = targetRotation;
    
    const mainSvg = this.container.querySelector('svg')!;
    const rMat = mainSvg.createSVGMatrix()
      .translate(this.dragPivotX, this.dragPivotY)
      .rotate(applyDiff)
      .translate(-this.dragPivotX, -this.dragPivotY);

    els.forEach((el: SVGGraphicsElement) => {
      const transformList = el.transform.baseVal;
      let matrixTransform = transformList.consolidate();
      if (!matrixTransform) {
        matrixTransform = mainSvg.createSVGTransform();
        matrixTransform.setMatrix(mainSvg.createSVGMatrix());
        transformList.appendItem(matrixTransform);
      }
      matrixTransform.setMatrix(rMat.multiply(matrixTransform.matrix));
    });
  }

  private resizeEl(el: SVGGraphicsElement, dx: number, dy: number, handle: string) {
    const tBox = this.getTransformedBBox(el);
    const tag = el.tagName.toLowerCase();

    if (tag === 'rect') {
      let x = parseFloat(el.getAttribute('x') || '0');
      let y = parseFloat(el.getAttribute('y') || '0');
      let w = parseFloat(el.getAttribute('width') || '0');
      let h = parseFloat(el.getAttribute('height') || '0');

      if (handle.includes('l')) { x += dx; w -= dx; }
      if (handle.includes('r')) { w += dx; }
      if (handle.includes('t')) { y += dy; h -= dy; }
      if (handle.includes('b')) { h += dy; }

      if (w > 0) { el.setAttribute('x', `${x}`); el.setAttribute('width', `${w}`); }
      if (h > 0) { el.setAttribute('y', `${y}`); el.setAttribute('height', `${h}`); }
    } else if (tag === 'ellipse') {
      let rx = parseFloat(el.getAttribute('rx') || '0');
      let ry = parseFloat(el.getAttribute('ry') || '0');
      if (handle.includes('r') || handle.includes('l')) rx = Math.max(0.1, rx + Math.abs(dx) * Math.sign(dx));
      if (handle.includes('b') || handle.includes('t')) ry = Math.max(0.1, ry + Math.abs(dy) * Math.sign(dy));
      el.setAttribute('rx', `${rx}`); el.setAttribute('ry', `${ry}`);
    } else {
      // Generic: apply a scale matrix around the correct pivot
      let sx = 1;
      let sy = 1;

      if (handle.includes('r')) sx = Math.max(0.001, tBox.width + dx) / Math.max(tBox.width, 0.001);
      if (handle.includes('l')) sx = Math.max(0.001, tBox.width - dx) / Math.max(tBox.width, 0.001);
      if (handle.includes('b')) sy = Math.max(0.001, tBox.height + dy) / Math.max(tBox.height, 0.001);
      if (handle.includes('t')) sy = Math.max(0.001, tBox.height - dy) / Math.max(tBox.height, 0.001);

      let pivotX = tBox.x;
      let pivotY = tBox.y;
      
      if (handle.includes('l')) pivotX = tBox.x + tBox.width;
      if (handle.includes('t')) pivotY = tBox.y + tBox.height;

      if (handle === 'tc' || handle === 'bc') pivotX = tBox.x + tBox.width / 2;
      if (handle === 'ml' || handle === 'mr') pivotY = tBox.y + tBox.height / 2;

      const transformList = el.transform.baseVal;
      let matrixTransform = transformList.consolidate();
      if (!matrixTransform) {
        const mainSvg = this.container.querySelector('svg');
        if (!mainSvg) return;
        matrixTransform = mainSvg.createSVGTransform();
        matrixTransform.setMatrix(mainSvg.createSVGMatrix());
        transformList.appendItem(matrixTransform);
      }
      
      const mainSvg = this.container.querySelector('svg')!;
      const sMat = mainSvg.createSVGMatrix()
        .translate(pivotX, pivotY)
        .scaleNonUniform(sx, sy)
        .translate(-pivotX, -pivotY);

      matrixTransform.setMatrix(sMat.multiply(matrixTransform.matrix));
    }
  }

  // ── Notify ────────────────────────────────────────────────────

  private buildElementProperties(el: SVGGraphicsElement): ElementProperties {
    const els = this.getSelectedEls();
    const tBox = this.getUnionBBox(els);
    const tag = el ? el.tagName.toLowerCase() : 'group';
    const matrix = el.transform?.baseVal.consolidate()?.matrix;
    let rotation = 0;
    if (matrix) rotation = Math.round(Math.atan2(matrix.b, matrix.a) * 180 / Math.PI * 100) / 100;
    const opacity = Math.round(parseFloat(el.getAttribute('opacity') || '1') * 100);
    const strokeColor = el.getAttribute('stroke') || '#000000';
    const strokeW = parseFloat(el.getAttribute('stroke-width') || '1');
    const strokeCap = el.getAttribute('stroke-linecap') || 'butt';
    const strokeJoin = el.getAttribute('stroke-linejoin') || 'miter';
    const strokeOpacity = Math.round(parseFloat(el.getAttribute('stroke-opacity') || '1') * 100);
    const fill = el.getAttribute('fill') || 'none';
    const fillEnabled = fill !== 'none' && fill !== '';
    const fillColor = fillEnabled ? fill : '#000000';
    const fillOpacity = Math.round(parseFloat(el.getAttribute('fill-opacity') || '1') * 100);
    const fillRule = el.getAttribute('fill-rule') || 'nonzero';
    return {
      x: tBox.x, y: tBox.y, w: tBox.width, h: tBox.height,
      rotation, opacity, strokeColor, strokeW, strokeCap, strokeJoin, strokeOpacity,
      fillEnabled, fillColor, fillOpacity, fillRule,
      elementType: tag.toUpperCase(),
    };
  }

  getElementProperties(id: string | null): ElementProperties | null {
    if (!id) return null;
    const mainSvg = this.container.querySelector('svg');
    if (!mainSvg) return null;
    const el = mainSvg.querySelector(`[data-xcs-id="${id}"]`) as SVGGraphicsElement | null;
    if (!el) return null;
    return this.buildElementProperties(el);
  }

  getMultiSelectionProperties(): ElementProperties | null {
    const els = this.getSelectedEls();
    if (els.length === 0) return null;
    if (els.length === 1) return this.buildElementProperties(els[0]);
    const tBox = this.getUnionBBox(els);
    // Merge: average numeric props, use first element's string props
    const first = els[0];
    const opacity = Math.round(els.reduce((s, e) => s + parseFloat(e.getAttribute('opacity') || '1'), 0) / els.length * 100);
    const strokeW = els.reduce((s, e) => s + parseFloat(e.getAttribute('stroke-width') || '1'), 0) / els.length;
    const fill = first.getAttribute('fill') || 'none';
    const fillEnabled = fill !== 'none' && fill !== '';
    return {
      x: tBox.x, y: tBox.y, w: tBox.width, h: tBox.height,
      rotation: 0, opacity, strokeColor: first.getAttribute('stroke') || '#000000',
      strokeW, strokeCap: first.getAttribute('stroke-linecap') || 'butt',
      strokeJoin: first.getAttribute('stroke-linejoin') || 'miter', strokeOpacity: 100,
      fillEnabled, fillColor: fillEnabled ? fill : '#000000', fillOpacity: 100,
      fillRule: first.getAttribute('fill-rule') || 'nonzero',
      elementType: 'GROUP',
    };
  }

  private notifyChange(el: SVGGraphicsElement) {
    if (!el && this.selectedIds.size === 0) {
      this.onSelectionChange(null);
      return;
    }
    const els = this.getSelectedEls();
    const tBox = this.getUnionBBox(els);
    const tag = el ? el.tagName.toLowerCase() : 'group';

    let x = tBox.x, y = tBox.y;

    // Rotation from matrix
    const matrix = el.transform.baseVal.consolidate()?.matrix;
    let rotation = 0;
    if (matrix) {
      rotation = Math.atan2(matrix.b, matrix.a) * 180 / Math.PI;
    }
    rotation = Math.round(rotation * 100) / 100;

    // Opacity
    const opStr = el.getAttribute('opacity') || '1';
    const opacity = Math.round(parseFloat(opStr) * 100);

    // Stroke
    const strokeColor = el.getAttribute('stroke') || '#000000';
    const strokeW = parseFloat(el.getAttribute('stroke-width') || '1');
    const strokeCap = el.getAttribute('stroke-linecap') || 'butt';
    const strokeJoin = el.getAttribute('stroke-linejoin') || 'miter';
    const strokeOpStr = el.getAttribute('stroke-opacity') || '1';
    const strokeOpacity = Math.round(parseFloat(strokeOpStr) * 100);

    // Fill
    const fill = el.getAttribute('fill') || 'none';
    const fillEnabled = fill !== 'none' && fill !== '';
    const fillColor = fillEnabled ? fill : '#000000';
    const fillOpStr = el.getAttribute('fill-opacity') || '1';
    const fillOpacity = Math.round(parseFloat(fillOpStr) * 100);
    const fillRule = el.getAttribute('fill-rule') || 'nonzero';

    this.onSelectionChange({
      x, y, w: tBox.width, h: tBox.height, rotation, opacity,
      strokeColor, strokeW, strokeCap, strokeJoin, strokeOpacity,
      fillEnabled, fillColor, fillOpacity, fillRule,
      elementType: tag.toUpperCase(),
    });
  }

  // ── Public: Update Properties ─────────────────────────────────

  updateProperties(props: Partial<ElementProperties>) {
    const els = this.getSelectedEls();
    if (els.length === 0) return;

    const uBox = this.getUnionBBox(els);
    const firstEl = els[0];

    const setAttr = (name: string, value: string) => {
      els.forEach((el: SVGGraphicsElement) => {
        el.setAttribute(name, value);
        if (el.tagName.toLowerCase() === 'g') {
          el.querySelectorAll('*').forEach(child => child.setAttribute(name, value));
        }
      });
    };

    if (props.x !== undefined || props.y !== undefined) {
      const tx = (props.x ?? uBox.x) - uBox.x;
      const ty = (props.y ?? uBox.y) - uBox.y;
      els.forEach((el: SVGGraphicsElement) => this.translateEl(el, tx, ty));
    }

    if (props.w !== undefined || props.h !== undefined) {
      const w = props.w ?? uBox.width;
      const h = props.h ?? uBox.height;
      const scaleX = Math.max(0.001, w) / Math.max(uBox.width, 0.001);
      const scaleY = Math.max(0.001, h) / Math.max(uBox.height, 0.001);
      
      const mainSvg = this.container.querySelector('svg')!;
      const sMat = mainSvg.createSVGMatrix()
        .translate(uBox.x, uBox.y)
        .scaleNonUniform(scaleX, scaleY)
        .translate(-uBox.x, -uBox.y);

      els.forEach((el: SVGGraphicsElement) => {
        const transformList = el.transform.baseVal;
        let matrixTransform = transformList.consolidate();
        if (!matrixTransform) {
          matrixTransform = mainSvg.createSVGTransform();
          matrixTransform.setMatrix(mainSvg.createSVGMatrix());
          transformList.appendItem(matrixTransform);
        }
        matrixTransform.setMatrix(sMat.multiply(matrixTransform.matrix));
      });
    }

    if (props.rotation !== undefined) {
      const cx = uBox.x + uBox.width / 2;
      const cy = uBox.y + uBox.height / 2;
      
      const mainSvg = this.container.querySelector('svg')!;
      
      els.forEach((el: SVGGraphicsElement) => {
        const transformList = el.transform.baseVal;
        let matrixTransform = transformList.consolidate();
        if (!matrixTransform) {
          matrixTransform = mainSvg.createSVGTransform();
          matrixTransform.setMatrix(mainSvg.createSVGMatrix());
          transformList.appendItem(matrixTransform);
        }
        
        const m = matrixTransform.matrix;
        const currAngle = Math.atan2(m.b, m.a) * 180 / Math.PI;
        const diffAngle = props.rotation! - currAngle;
        
        const rMat = mainSvg.createSVGMatrix()
          .translate(cx, cy)
          .rotate(diffAngle)
          .translate(-cx, -cy);
          
        matrixTransform.setMatrix(rMat.multiply(m));
      });
    }

// setAttr defined above

    if (props.opacity !== undefined) setAttr('opacity', `${(props.opacity / 100).toFixed(2)}`);
    if (props.strokeColor !== undefined) setAttr('stroke', props.strokeColor);
    if (props.strokeW !== undefined) setAttr('stroke-width', `${props.strokeW}`);
    if (props.strokeCap !== undefined) setAttr('stroke-linecap', props.strokeCap);
    if (props.strokeJoin !== undefined) setAttr('stroke-linejoin', props.strokeJoin);
    if (props.strokeOpacity !== undefined) setAttr('stroke-opacity', `${(props.strokeOpacity / 100).toFixed(2)}`);

    if (props.fillEnabled !== undefined || props.fillColor !== undefined || props.fillOpacity !== undefined) {
      const enabled = props.fillEnabled ?? (firstEl.getAttribute('fill') !== 'none');
      setAttr('fill', enabled ? (props.fillColor ?? firstEl.getAttribute('fill') ?? '#000000') : 'none');
      if (props.fillOpacity !== undefined) setAttr('fill-opacity', `${(props.fillOpacity / 100).toFixed(2)}`);
      if (props.fillRule !== undefined) setAttr('fill-rule', props.fillRule);
    }

    this.renderSelectionUI();
    this.commit();
    this.notifyChange(els[0] || null);
  }

  // ── Z-Order ───────────────────────────────────────────────────

  bringToFront() {
    const el = this.getSelectedEl();
    if (!el || !el.parentNode) return;
    el.parentNode.appendChild(el);
    this.renderSelectionUI(); this.commit();
  }

  bringForward() {
    const el = this.getSelectedEl();
    if (!el || !el.nextElementSibling || !el.parentNode) return;
    el.parentNode.insertBefore(el.nextElementSibling, el);
    this.renderSelectionUI(); this.commit();
  }

  sendBackward() {
    const el = this.getSelectedEl();
    if (!el || !el.previousElementSibling || !el.parentNode) return;
    el.parentNode.insertBefore(el, el.previousElementSibling);
    this.renderSelectionUI(); this.commit();
  }

  sendToBack() {
    const el = this.getSelectedEl();
    if (!el || !el.parentNode) return;
    el.parentNode.insertBefore(el, el.parentNode.firstChild);
    this.renderSelectionUI(); this.commit();
  }

  nudgeSelected(dx: number, dy: number) {
    if (this.activeTool === 'node' && this.activeNodeIndex !== null && this.nodeEditTarget) {
      this.onInteractionStart();
      const node = this.editingNodes[this.activeNodeIndex];
      node.x += dx;
      node.y += dy;
      
      const cmd = this.parsedCommands[node.cmdIndex];
      cmd.args[node.argIndexX] = node.x;
      cmd.args[node.argIndexY] = node.y;
      
      this.nodeEditTarget.setAttribute('d', stringifySvgPath(this.parsedCommands));
      this.renderSelectionUI();
      this.commit();
      this.onInteractionEnd();
      return;
    }

    const els = this.getSelectedEls();
    if (els.length === 0) return;
    this.onInteractionStart();
    els.forEach(el => this.translateEl(el, dx, dy));
    this.renderSelectionUI();
    this.notifyChange(els[0] || null);
    this.commit();
    this.onInteractionEnd();
  }

  // ── Align ─────────────────────────────────────────────────────

  alignTo(mode: 'left' | 'center-h' | 'right' | 'top' | 'center-v' | 'bottom') {
    const els = this.getSelectedEls();
    if (els.length === 0) return;
    const mainSvg = this.container.querySelector('svg') as SVGSVGElement | null;
    if (!mainSvg) return;

    const vb = mainSvg.viewBox.baseVal;
    // Fallback if no viewBox is present
    const canvasW = vb?.width || mainSvg.clientWidth;
    const canvasH = vb?.height || mainSvg.clientHeight;
    const canvasX = vb?.x || 0;
    const canvasY = vb?.y || 0;

    const tBox = this.getUnionBBox(els);
    let dx = 0, dy = 0;

    switch (mode) {
      case 'left':     dx = canvasX - tBox.x; break;
      case 'center-h': dx = canvasX + canvasW / 2 - tBox.x - tBox.width / 2; break;
      case 'right':    dx = canvasX + canvasW - tBox.x - tBox.width; break;
      case 'top':      dy = canvasY - tBox.y; break;
      case 'center-v': dy = canvasY + canvasH / 2 - tBox.y - tBox.height / 2; break;
      case 'bottom':   dy = canvasY + canvasH - tBox.y - tBox.height; break;
    }

    els.forEach(el => this.translateEl(el, dx, dy));
    this.renderSelectionUI();
    this.notifyChange(els[0] || null);
    this.commit();
  }

  // ── Commit / Snapshot ─────────────────────────────────────────

  private commit() {
    if (!this.currentLayer) return;
    const mainSvg = this.container.querySelector('svg');
    if (!mainSvg) return;
    const clone = mainSvg.cloneNode(true) as SVGSVGElement;
    clone.querySelector('.selection-overlay')?.remove();
    const newSvg = clone.outerHTML;
    this.currentLayer.svg = newSvg;
    this.onUpdate(newSvg);
  }
}
