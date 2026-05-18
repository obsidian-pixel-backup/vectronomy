import sys

def patch():
    with open('src/engine/editor.ts', 'r') as f:
        content = f.read()

    # 1. Class vars
    content = content.replace(
        '  private selectedId: string | null = null;',
        '  selectedId: string | null = null;\n  selectedIds: Set<string> = new Set();\n  isMarquee: boolean = false;\n  marqueeStart: DOMPoint | null = null;\n  marqueeEl: SVGRectElement | null = null;'
    )

    # 2. getScale and getSvgPoint
    content = content.replace(
"""  private getScale(): number {
    const mainSvg = this.container.querySelector('svg');
    if (!mainSvg) return 1;
    const ctm = mainSvg.getScreenCTM();
    return ctm ? ctm.a : 1;
  }

  private getSvgPoint(e: MouseEvent | Touch): DOMPoint | null {
    const mainSvg = this.container.querySelector('svg') as SVGSVGElement | null;
    if (!mainSvg) return null;
    const pt = mainSvg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    return pt.matrixTransform(mainSvg.getScreenCTM()!.inverse());
  }""",
"""  private getScale(): number {
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
    pt.x = e.clientX;
    pt.y = e.clientY;
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
    els.forEach(el => {
      const box = this.getTransformedBBox(el);
      if (box.x < minX) minX = box.x;
      if (box.y < minY) minY = box.y;
      if (box.x + box.width > maxX) maxX = box.x + box.width;
      if (box.y + box.height > maxY) maxY = box.y + box.height;
    });
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }"""
    )

    # 3. onMouseDown
    content = content.replace(
"""    // Prioritize grouped elements (clusters) over individual paths
    const selectable = target.closest('g[data-xcs-id]') || target.closest('[data-xcs-id]') as SVGElement | null;
    if (selectable) {
      const id = selectable.getAttribute('data-xcs-id')!;
      e.stopPropagation(); e.preventDefault();
      this.selectElement(id);
      this.isDragging = true;
      this.dragMode = 'move';
      this.dragStartX = e.clientX; this.dragStartY = e.clientY;
      this.onInteractionStart();
    } else {
      this.clearSelection();
    }""",
"""    // Prioritize grouped elements (clusters) over individual paths
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
    }"""
    )

    # 4. onMouseMove
    content = content.replace(
"""  private onMouseMove(e: MouseEvent) {
    if (this.isDrawing && this.drawingEl) { this.updateDraw(e); return; }
    if (!this.isDragging || !this.selectedId) return;

    const el = this.getSelectedEl();
    if (!el) return;

    const ctm = (el as SVGGraphicsElement).getScreenCTM();
    if (!ctm) return;
    const scale = ctm.a || 1;

    const dx = (e.clientX - this.dragStartX) / scale;
    const dy = (e.clientY - this.dragStartY) / scale;

    if (this.dragMode === 'move') this.translateEl(el as SVGGraphicsElement, dx, dy);
    else if (this.dragMode === 'resize') this.resizeEl(el as SVGGraphicsElement, dx, dy, this.activeHandle!);

    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    this.renderSelectionUI();
    this.notifyChange(el as SVGGraphicsElement);
  }""",
"""  private onMouseMove(e: MouseEvent) {
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

    if (!this.isDragging || this.selectedIds.size === 0) return;

    const scale = this.getScale();
    const dx = (e.clientX - this.dragStartX) / scale;
    const dy = (e.clientY - this.dragStartY) / scale;

    const els = this.getSelectedEls();
    if (this.dragMode === 'move') {
      els.forEach(el => this.translateEl(el, dx, dy));
    } else if (this.dragMode === 'resize') {
      this.resizeSelection(dx, dy, this.activeHandle!);
    }

    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    this.renderSelectionUI();
    this.notifyChange(els[0] || null);
  }"""
    )

    # 5. onMouseUp
    content = content.replace(
"""  private onMouseUp() {
    if (this.isDrawing) { this.finalizeDraw(); return; }
    if (this.isDragging) {
      this.isDragging = false;
      this.dragMode = null;
      this.activeHandle = null;
      this.origBBox = null;
      this.commit();
      if (this.activeTool === 'select') this.onInteractionEnd();
    }
  }""",
"""  private onMouseUp() {
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

    if (this.isDragging) {
      this.isDragging = false;
      this.dragMode = null;
      this.activeHandle = null;
      this.origBBox = null;
      this.commit();
      if (this.activeTool === 'select') this.onInteractionEnd();
    }
  }"""
    )

    # 6. clearSelection, deleteSelected, etc.
    content = content.replace(
"""  clearSelection() {
    this.selectedId = null;
    if (this.selectionGroup) { this.selectionGroup.remove(); this.selectionGroup = null; }
    this.onSelectionChange(null);
  }

  deleteSelected() {
    if (!this.selectedId) return;
    const el = this.container.querySelector(`[data-xcs-id="${this.selectedId}"]`);
    if (el) { el.remove(); this.clearSelection(); this.commit(); }
  }""",
"""  clearSelection() {
    this.selectedId = null;
    this.selectedIds.clear();
    if (this.selectionGroup) { this.selectionGroup.remove(); this.selectionGroup = null; }
    this.onSelectionChange(null);
  }

  deleteSelected() {
    if (this.selectedIds.size === 0) return;
    const els = this.getSelectedEls();
    els.forEach(el => el.remove());
    this.clearSelection();
    this.commit();
  }"""
    )

    # 7. renderSelectionUI
    content = content.replace(
"""  private renderSelectionUI() {
    if (!this.selectedId) return;
    const el = this.getSelectedEl() as SVGGraphicsElement | null;
    if (!el) return;
    const mainSvg = this.container.querySelector('svg') as SVGSVGElement | null;
    const viewport = mainSvg?.querySelector('#viewport') || mainSvg;
    if (!mainSvg || !viewport) return;

    const tBox = this.getTransformedBBox(el);""",
"""  private renderSelectionUI() {
    const els = this.getSelectedEls();
    if (els.length === 0) {
      if (this.selectionGroup) { this.selectionGroup.remove(); this.selectionGroup = null; }
      return;
    }
    const mainSvg = this.container.querySelector('svg') as SVGSVGElement | null;
    const viewport = mainSvg?.querySelector('#viewport') || mainSvg;
    if (!mainSvg || !viewport) return;

    const tBox = this.getUnionBBox(els);"""
    )

    # 8. resizeSelection
    content = content.replace(
"""  private resizeEl(el: SVGGraphicsElement, dx: number, dy: number, handle: string) {""",
"""  private resizeSelection(dx: number, dy: number, handle: string) {
    const els = this.getSelectedEls();
    if (els.length === 0) return;
    const tBox = this.getUnionBBox(els);

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

    const mainSvg = this.container.querySelector('svg')!;
    const sMat = mainSvg.createSVGMatrix()
      .translate(pivotX, pivotY)
      .scaleNonUniform(sx, sy)
      .translate(-pivotX, -pivotY);

    els.forEach(el => {
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

  private resizeEl(el: SVGGraphicsElement, dx: number, dy: number, handle: string) {"""
    )

    # 9. notifyChange updates
    content = content.replace(
"""  private notifyChange(el: SVGGraphicsElement) {
    const tBox = this.getTransformedBBox(el);
    const tag = el.tagName.toLowerCase();""",
"""  private notifyChange(el: SVGGraphicsElement) {
    if (!el && this.selectedIds.size === 0) {
      this.onSelectionChange(null);
      return;
    }
    const els = this.getSelectedEls();
    const tBox = this.getUnionBBox(els);
    const tag = el ? el.tagName.toLowerCase() : 'group';"""
    )
    
    # 10. updateProperties to handle multiple
    content = content.replace(
"""  updateProperties(props: Partial<ElementProperties>) {
    if (!this.selectedId) return;
    const el = this.getSelectedEl() as SVGGraphicsElement | null;
    if (!el) return;

    const tBox = this.getTransformedBBox(el);""",
"""  updateProperties(props: Partial<ElementProperties>) {
    const els = this.getSelectedEls();
    if (els.length === 0) return;

    const uBox = this.getUnionBBox(els);
    const firstEl = els[0];

    const setAttr = (name: string, value: string) => {
      els.forEach(el => {
        el.setAttribute(name, value);
        if (el.tagName.toLowerCase() === 'g') {
          el.querySelectorAll('*').forEach(child => child.setAttribute(name, value));
        }
      });
    };"""
    )
    
    # Fix properties geometry math
    content = content.replace(
"""    if (props.x !== undefined || props.y !== undefined) {
      const tx = (props.x ?? tBox.x) - tBox.x;
      const ty = (props.y ?? tBox.y) - tBox.y;
      this.translateEl(el, tx, ty);
    }

    if (props.w !== undefined || props.h !== undefined) {
      const w = props.w ?? tBox.width;
      const h = props.h ?? tBox.height;
      const tag = el.tagName.toLowerCase();
      if (tag === 'rect') {
        if (w > 0) el.setAttribute('width', `${w}`);
        if (h > 0) el.setAttribute('height', `${h}`);
      } else if (tag === 'ellipse') {
        if (w > 0) el.setAttribute('rx', `${w / 2}`);
        if (h > 0) el.setAttribute('ry', `${h / 2}`);
      } else if (tag === 'circle') {
        if (w > 0) el.setAttribute('r', `${w / 2}`);
      } else if (tag === 'line') {
        el.setAttribute('x2', `${parseFloat(el.getAttribute('x1')||'0') + w}`);
        el.setAttribute('y2', `${parseFloat(el.getAttribute('y1')||'0') + h}`);
      } else {
        // Fallback for paths and groups: apply a proportional scale transform around the top-left
        const scaleX = Math.max(0.001, w) / Math.max(tBox.width, 0.001);
        const scaleY = Math.max(0.001, h) / Math.max(tBox.height, 0.001);
        
        const transformList = el.transform.baseVal;
        let matrixTransform = transformList.consolidate();
        if (!matrixTransform) {
          const mainSvg = this.container.querySelector('svg')!;
          matrixTransform = mainSvg.createSVGTransform();
          matrixTransform.setMatrix(mainSvg.createSVGMatrix());
          transformList.appendItem(matrixTransform);
        }

        const mainSvg = this.container.querySelector('svg')!;
        const sMat = mainSvg.createSVGMatrix()
          .translate(tBox.x, tBox.y)
          .scaleNonUniform(scaleX, scaleY)
          .translate(-tBox.x, -tBox.y);

        matrixTransform.setMatrix(sMat.multiply(matrixTransform.matrix));
      }
    }

    if (props.rotation !== undefined) {
      const cx = tBox.x + tBox.width / 2;
      const cy = tBox.y + tBox.height / 2;
      
      const transformList = el.transform.baseVal;
      let matrixTransform = transformList.consolidate();
      if (!matrixTransform) {
        const mainSvg = this.container.querySelector('svg')!;
        matrixTransform = mainSvg.createSVGTransform();
        matrixTransform.setMatrix(mainSvg.createSVGMatrix());
        transformList.appendItem(matrixTransform);
      }
      
      const m = matrixTransform.matrix;
      const currAngle = Math.atan2(m.b, m.a) * 180 / Math.PI;
      const diffAngle = props.rotation - currAngle;
      
      const mainSvg = this.container.querySelector('svg')!;
      const rMat = mainSvg.createSVGMatrix()
        .translate(cx, cy)
        .rotate(diffAngle)
        .translate(-cx, -cy);
        
      matrixTransform.setMatrix(rMat.multiply(m));
    }""",
"""    if (props.x !== undefined || props.y !== undefined) {
      const tx = (props.x ?? uBox.x) - uBox.x;
      const ty = (props.y ?? uBox.y) - uBox.y;
      els.forEach(el => this.translateEl(el, tx, ty));
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

      els.forEach(el => {
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
      
      els.forEach(el => {
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
    }"""
    )
    
    # 11. remove the old setAttr definition and uses from before
    content = content.replace(
"""    const setAttr = (name: string, value: string) => {
      el.setAttribute(name, value);
      if (el.tagName.toLowerCase() === 'g') {
        el.querySelectorAll('*').forEach(child => child.setAttribute(name, value));
      }
    };""",
"""// setAttr defined above"""
    )

    content = content.replace(
"""    this.notifyChange(el);""",
"""    this.notifyChange(els[0]);"""
    )
    
    with open('src/engine/editor.ts', 'w') as f:
        f.write(content)

if __name__ == '__main__':
    patch()
