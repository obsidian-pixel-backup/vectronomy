import re

with open('src/engine/editor.ts', 'r') as f:
    content = f.read()

# 1. Imports
content = content.replace("import type { ConvertedLayer } from './types';", 
                          "import type { ConvertedLayer } from './types';\nimport { parseSvgPath, absolutizePath, stringifySvgPath, extractNodes, PathCommand, PathNodeRef } from './pathUtils';")

# 2. State vars
content = content.replace("private origBBox: DOMRect | null = null;",
                          "private origBBox: DOMRect | null = null;\n  private activeNodeIndex: number | null = null;\n  private parsedCommands: PathCommand[] = [];\n  private editingNodes: PathNodeRef[] = [];\n  private draggingNode: boolean = false;")

# 3. renderSelectionUI intercept
content = content.replace("""    const els = this.getSelectedEls();
    if (els.length === 0) {
      if (this.selectionGroup) { this.selectionGroup.remove(); this.selectionGroup = null; }
      return;
    }""",
                          """    const els = this.getSelectedEls();
    if (els.length === 0) {
      if (this.selectionGroup) { this.selectionGroup.remove(); this.selectionGroup = null; }
      return;
    }
    if (this.activeTool === 'node' && els.length === 1 && els[0].tagName.toLowerCase() === 'path') {
      this.renderNodeUI(els[0]);
      return;
    }
    if (this.activeTool === 'node') {
      // Node tool selected, but multiple items or non-path selected. Hide selection UI.
      if (this.selectionGroup) { this.selectionGroup.remove(); this.selectionGroup = null; }
      return;
    }""")

# 4. Add renderNodeUI
renderNodeUI = """
  private renderNodeUI(el: SVGGraphicsElement) {
    const mainSvg = this.container.querySelector('svg') as SVGSVGElement | null;
    const viewport = mainSvg?.querySelector('#viewport') || mainSvg;
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

    const screenCTM = (viewport as SVGGraphicsElement).getScreenCTM()!;
    const invScale = 1 / (screenCTM.a || 1);
    const hs = 4 * invScale;
    
    // Check if the path itself is transformed
    const elMatrix = el.transform.baseVal.consolidate()?.matrix;

    this.editingNodes.forEach((node, idx) => {
      let nx = node.x;
      let ny = node.y;
      if (elMatrix) {
        nx = elMatrix.a * node.x + elMatrix.c * node.y + elMatrix.e;
        ny = elMatrix.b * node.x + elMatrix.d * node.y + elMatrix.f;
      }

      const c = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      c.setAttribute('x', `${nx - hs}`);
      c.setAttribute('y', `${ny - hs}`);
      c.setAttribute('width', `${hs * 2}`);
      c.setAttribute('height', `${hs * 2}`);
      c.setAttribute('rx', `${hs * 0.2}`);
      c.setAttribute('fill', this.activeNodeIndex === idx ? '#ff0055' : '#fff');
      c.setAttribute('stroke', this.activeNodeIndex === idx ? '#fff' : '#00ffc2');
      c.setAttribute('stroke-width', `${1.2 * invScale}`);
      c.setAttribute('data-node-index', `${idx}`);
      c.style.pointerEvents = 'all';
      c.style.cursor = 'move';
      g.appendChild(c);
    });
  }
"""
content = content.replace("private getCursorForHandle(id: string): string {", renderNodeUI + "\n  private getCursorForHandle(id: string): string {")

# 5. onMouseDown for nodes
on_mouse_down_node = """
    if (this.activeTool === 'node') {
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
      
      const selectable = target.closest('path[data-xcs-id]') as SVGElement | null;
      if (selectable) {
        const id = selectable.getAttribute('data-xcs-id')!;
        e.stopPropagation(); e.preventDefault();
        if (!this.selectedIds.has(id)) {
          this.selectedIds.clear();
          this.selectedIds.add(id);
          this.selectedId = id;
        }
        this.renderSelectionUI();
        this.onInteractionStart();
        return;
      }
      
      this.clearSelection();
      return;
    }
"""

content = content.replace("""    if (this.activeTool !== 'select' && this.activeTool !== 'node') {
      this.startDraw(e); return;
    }""", """    if (this.activeTool !== 'select' && this.activeTool !== 'node') {
      this.startDraw(e); return;
    }""" + on_mouse_down_node)

# 6. onMouseMove for nodes
on_mouse_move_node = """
    if (this.draggingNode && this.activeNodeIndex !== null) {
      const scale = this.getScale();
      const dx = (e.clientX - this.dragStartX) / scale;
      const dy = (e.clientY - this.dragStartY) / scale;
      
      const el = this.getSelectedEls()[0];
      if (!el) return;
      
      const elMatrix = el.transform.baseVal.consolidate()?.matrix;
      let localDx = dx;
      let localDy = dy;
      
      if (elMatrix) {
        // Inverse transform the mouse delta into the path's local coordinate space
        // This is complex for rotation, but for simple translation it's fine.
        // For rigorous local dragging, we use the inverse matrix:
        const inv = elMatrix.inverse();
        // apply vector transformation (ignore translation e,f)
        localDx = inv.a * dx + inv.c * dy;
        localDy = inv.b * dx + inv.d * dy;
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
"""

content = content.replace("    if (!this.isDragging || this.selectedIds.size === 0) return;",
                          "    if (!this.isDragging && !this.draggingNode || this.selectedIds.size === 0) return;" + on_mouse_move_node)

# 7. onMouseUp for nodes
content = content.replace("""    if (this.isDragging) {
      this.isDragging = false;
      this.dragMode = null;
      this.activeHandle = null;
      this.origBBox = null;
      this.commit();
      if (this.activeTool === 'select') this.onInteractionEnd();
    }""", """    if (this.draggingNode) {
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
    }""")

# 8. Keyboard deletion for nodes
content = content.replace("""    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.clearSelection(); });""",
                          """    window.addEventListener('keydown', (e) => { 
      if (e.key === 'Escape') this.clearSelection(); 
      if ((e.key === 'Delete' || e.key === 'Backspace') && this.activeTool === 'node' && this.activeNodeIndex !== null) {
        this.deleteActiveNode();
      }
    });""")

# 9. deleteActiveNode method
delete_node_method = """
  private deleteActiveNode() {
    if (this.activeNodeIndex === null) return;
    const el = this.getSelectedEls()[0];
    if (!el || el.tagName.toLowerCase() !== 'path') return;
    
    const node = this.editingNodes[this.activeNodeIndex];
    if (this.parsedCommands.length > 2) {
      this.parsedCommands.splice(node.cmdIndex, 1);
      
      // If we deleted the first M command, the new first command should become an M
      if (this.parsedCommands[0].type !== 'M') {
        this.parsedCommands[0].type = 'M';
      }
      
      el.setAttribute('d', stringifySvgPath(this.parsedCommands));
      this.activeNodeIndex = null;
      // Re-parse
      this.renderSelectionUI();
      this.commit();
    }
  }
"""
content = content.replace("  deleteSelected() {", delete_node_method + "\n  deleteSelected() {")

# 10. Add a node via double click on stroke
content = content.replace("""    // Double-click on pen path point to close it
    if (this.activeTool === 'pen' && this.penPoints.length > 2) {""",
                              """    if (this.activeTool === 'node') {
      const target = e.target as SVGElement;
      if (target.tagName.toLowerCase() === 'path') {
        const id = target.getAttribute('data-xcs-id');
        if (id && this.selectedIds.has(id)) {
          // Add a node
          this.addNodeAtCursor(e, target as SVGPathElement);
        }
      }
      return;
    }

    // Double-click on pen path point to close it
    if (this.activeTool === 'pen' && this.penPoints.length > 2) {""")

add_node_method = """
  private addNodeAtCursor(e: MouseEvent, el: SVGPathElement) {
    const pt = this.getSvgPoint(e);
    if (!pt) return;
    
    const elMatrix = el.transform.baseVal.consolidate()?.matrix;
    let localPt = pt;
    if (elMatrix) {
      localPt = pt.matrixTransform(elMatrix.inverse());
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
"""
content = content.replace("  private onDblClick(e: MouseEvent) {", add_node_method + "\n  private onDblClick(e: MouseEvent) {")

with open('src/engine/editor.ts', 'w') as f:
    f.write(content)
