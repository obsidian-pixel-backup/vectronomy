/**
 * VECTRONOMY — Interactive SVG Editor (v2)
 *
 * Handles: selection, move, resize, draw (rect/circle/line/pen),
 * fill/stroke editing, opacity, rotation, z-order, align, undo/redo.
 */

import type { ConvertedLayer } from './types';
import { parseSvgPath, absolutizePath, stringifySvgPath, extractNodes, PathCommand, PathNodeRef } from './pathUtils';

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
  private dragMode: 'move' | 'resize' | null = null;
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
  activeTool: 'select' | 'pan' | 'rect' | 'circle' | 'line' | 'pen' | 'node' = 'select';
  private isDrawing = false;
  private drawingEl: SVGElement | null = null;
  private drawStartX = 0;
  private drawStartY = 0;
  private penPoints: { x: number; y: number }[] = [];

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
      if (e.key === 'Escape') this.clearSelection(); 
    });
  }

  setLayer(layer: ConvertedLayer) { this.currentLayer = layer; this.clearSelection(); }

  setTool(tool: typeof this.activeTool) {
    this.activeTool = tool;
    this.clearSelection();
    this.penPoints = [];
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

  // ── Mouse Handlers ────────────────────────────────────────────

  private onMouseDown(e: MouseEvent) {
    if (e.button === 1 || this.activeTool === 'pan') return;
    const target = e.target as SVGElement;
    if (this.activeTool !== 'select' && this.activeTool !== 'node') {
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
      e.stopPropagation(); e.preventDefault();
      this.isDragging = true;
      this.dragMode = 'resize';
      this.activeHandle = handle.getAttribute('data-handle-id');
      this.dragStartX = e.clientX; this.dragStartY = e.clientY;
      const el = this.getSelectedEl();
      if (el) this.origBBox = el.getBoundingClientRect();
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
      // Start Marquee Selection
      if (!e.shiftKey) this.selectedIds.clear();
      this.selectedId = null;
      this.renderSelectionUI();
      this.notifyChange(null as any);
      
      this.isMarquee = true;
      this.marqueeStart = this.getSvgPoint(e);
      this.onInteractionStart();
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
      d = `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy + r} A ${r} ${r} 0 1 1 ${cx} ${cy - r} Z`;
    } else if (tag === 'ellipse') {
      const cx = parseFloat(el.getAttribute('cx') || '0');
      const cy = parseFloat(el.getAttribute('cy') || '0');
      const rx = parseFloat(el.getAttribute('rx') || '0');
      const ry = parseFloat(el.getAttribute('ry') || '0');
      d = `M ${cx} ${cy - ry} A ${rx} ${ry} 0 1 1 ${cx} ${cy + ry} A ${rx} ${ry} 0 1 1 ${cx} ${cy - ry} Z`;
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
      this.resizeSelection(dx, dy, this.activeHandle!, e.shiftKey);
    }

    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    this.renderSelectionUI();
    this.notifyChange(els[0] || null);
  }

  private onMouseUp() {
    if (this.isDrawing) { this.finalizeDraw(); return; }
    
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
    // using the full accumulated CTM (handles nested groups)
    const mainSvg = this.container.querySelector('svg') as SVGSVGElement | null;
    const viewport = mainSvg?.querySelector('#viewport') as SVGGraphicsElement || mainSvg;
    let localPt = pt;
    if (viewport && el) {
      const pathCTM = el.getCTM();
      const vpCTM = (viewport as SVGGraphicsElement).getCTM();
      if (pathCTM && vpCTM) {
        // pt is in viewport space, transform to path-local space
        const vpToPath = pathCTM.inverse().multiply(vpCTM);
        const lx = vpToPath.a * pt.x + vpToPath.c * pt.y + vpToPath.e;
        const ly = vpToPath.b * pt.x + vpToPath.d * pt.y + vpToPath.f;
        localPt = new DOMPoint(lx, ly);
      }
    }
    
    // Find closest segment
    let closestIndex = -1;
    let minDistance = Infinity;
    let insertX = 0;
    let insertY = 0;
    
    // Simple point-to-line distance for finding where to insert the new L command
    for (let i = 1; i < this.parsedCommands.length; i++) {
      const prev = this.editingNodes.find(n => n.cmdIndex === i - 1);
      const curr = this.editingNodes.find(n => n.cmdIndex === i);
      if (!prev || !curr) continue;
      
      // Distance from localPt to line segment (prev -> curr)
      const l2 = Math.pow(curr.x - prev.x, 2) + Math.pow(curr.y - prev.y, 2);
      let t = 0;
      if (l2 !== 0) {
        t = Math.max(0, Math.min(1, ((localPt.x - prev.x) * (curr.x - prev.x) + (localPt.y - prev.y) * (curr.y - prev.y)) / l2));
      }
      const projX = prev.x + t * (curr.x - prev.x);
      const projY = prev.y + t * (curr.y - prev.y);
      
      const dist = Math.hypot(localPt.x - projX, localPt.y - projY);
      if (dist < minDistance) {
        minDistance = dist;
        closestIndex = i;
        insertX = projX;
        insertY = projY;
      }
    }
    
    // Only insert if clicked reasonably close to the stroke (e.g. 10 units local space)
    if (closestIndex !== -1 && minDistance < 10) {
      this.parsedCommands.splice(closestIndex, 0, { type: 'L', args: [insertX, insertY] });
      el.setAttribute('d', stringifySvgPath(this.parsedCommands));
      
      // Update UI and set the new node as active
      this.draggingNode = false;
      this.renderSelectionUI();
      
      // Find the new node index
      const newNodes = extractNodes(this.parsedCommands);
      this.activeNodeIndex = newNodes.findIndex(n => n.cmdIndex === closestIndex);
      
      this.renderSelectionUI();
      this.commit();
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
      const d = this.drawingEl.getAttribute('d') || '';
      this.drawingEl.setAttribute('d', d + 'Z');
      this.isDrawing = false;
      this.penPoints = [];
      this.drawingEl = null;
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
        this.penPoints = [{ x: pt.x, y: pt.y }];
        this.drawingEl.setAttribute('d', `M${pt.x},${pt.y}`);
        viewport.appendChild(this.drawingEl);
      } else {
        // Add point
        this.penPoints.push({ x: pt.x, y: pt.y });
        const d = this.penPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
        this.drawingEl!.setAttribute('d', d);
      }
      return;
    }

    this.isDrawing = true;
    this.drawStartX = pt.x;
    this.drawStartY = pt.y;

    switch (this.activeTool) {
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
    }

    if (this.drawingEl) {
      this.drawingEl.setAttribute('data-xcs-id', id);
      this.drawingEl.setAttribute('stroke', '#00ffc2');
      this.drawingEl.setAttribute('stroke-width', '1.5');
      this.drawingEl.setAttribute('fill', 'none');
      viewport.appendChild(this.drawingEl);
    }
  }

  private updateDraw(e: MouseEvent) {
    if (!this.drawingEl) return;
    if (this.activeTool === 'pen') return; // pen handled in onMouseDown

    const pt = this.getSvgPoint(e);
    if (!pt) return;
    let dx = pt.x - this.drawStartX;
    let dy = pt.y - this.drawStartY;

    if (e.shiftKey) {
      if (this.activeTool === 'rect' || this.activeTool === 'circle') {
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
    }
  }

  private finalizeDraw() {
    if (this.activeTool === 'pen') return; // pen ends on dblclick
    this.isDrawing = false;
    this.drawingEl = null;
    this.commit();
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

  private getSvgPoint(e: MouseEvent | Touch): DOMPoint | null {
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
    return pt.matrixTransform((viewport as SVGGraphicsElement).getScreenCTM()!.inverse());
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

  private renderSelectionUI() {
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
    this.selectionGroup.innerHTML = '';
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.selectionGroup.appendChild(g);

    const d = el.getAttribute('d');
    if (!d) return;

    // Only parse if not actively dragging to avoid losing floating point precision or state
    if (!this.draggingNode) {
      const rawCmds = parseSvgPath(d);
      this.parsedCommands = absolutizePath(rawCmds);
      this.editingNodes = extractNodes(this.parsedCommands);
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

  private resizeSelection(dx: number, dy: number, handle: string, shiftKey: boolean = false) {
    const els = this.getSelectedEls();
    if (els.length === 0) return;
    const tBox = this.getUnionBBox(els);

    let sx = 1;
    let sy = 1;

    if (handle.includes('r')) sx = Math.max(0.001, tBox.width + dx) / Math.max(tBox.width, 0.001);
    if (handle.includes('l')) sx = Math.max(0.001, tBox.width - dx) / Math.max(tBox.width, 0.001);
    if (handle.includes('b')) sy = Math.max(0.001, tBox.height + dy) / Math.max(tBox.height, 0.001);
    if (handle.includes('t')) sy = Math.max(0.001, tBox.height - dy) / Math.max(tBox.height, 0.001);

    if (shiftKey && handle.length === 2) {
      const maxScale = Math.max(Math.abs(sx), Math.abs(sy));
      sx = sx < 0 ? -maxScale : maxScale;
      sy = sy < 0 ? -maxScale : maxScale;
    }

    let pivotX = tBox.x;
    let pivotY = tBox.y;
    
    if (handle.includes('l')) pivotX = tBox.x + tBox.width;
    if (handle.includes('t')) pivotY = tBox.y + tBox.height;

    if (handle === 'tc' || handle === 'bc') pivotX = tBox.x + tBox.width / 2;
    if (handle === 'ml' || handle === 'mr') pivotY = tBox.y + tBox.height / 2;

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
