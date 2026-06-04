export class SimulationEngine {
  private container: HTMLElement;
  private simGroup: SVGGElement | null = null;
  private isSimulating = false;
  private animFrameId: number | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public stop() {
    this.isSimulating = false;
    if (this.animFrameId !== null) {
        cancelAnimationFrame(this.animFrameId);
        this.animFrameId = null;
    }
    if (this.simGroup) {
      this.simGroup.remove();
      this.simGroup = null;
    }
  }

  public start(speed: number = 5) {
    this.stop();
    this.isSimulating = true;

    const mainSvg = this.container.querySelector('svg');
    const viewport = mainSvg?.querySelector('#viewport') || mainSvg;
    if (!mainSvg || !viewport) return;

    // Grab all plottable elements from viewport.
    // They are already in the order optimized by optimizeCutOrder()
    const elements = Array.from(viewport.querySelectorAll('path, rect, circle, ellipse, polygon, polyline, line')) as SVGGeometryElement[];
    if (elements.length === 0) return;

    this.simGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.simGroup.setAttribute('id', 'simulation-layer');
    this.simGroup.style.pointerEvents = 'none';
    viewport.appendChild(this.simGroup);

    // G0 Travel path
    const travelPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    travelPath.setAttribute('fill', 'none');
    travelPath.setAttribute('stroke', '#ff0000');
    travelPath.setAttribute('stroke-width', '1.5');
    travelPath.setAttribute('stroke-dasharray', '4 4');
    travelPath.setAttribute('opacity', '0.7');
    this.simGroup.appendChild(travelPath);

    // G1 Cut path
    const tracePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    tracePath.setAttribute('fill', 'none');
    tracePath.setAttribute('stroke', '#00ffc2');
    tracePath.setAttribute('stroke-width', '2');
    tracePath.setAttribute('stroke-linecap', 'round');
    tracePath.setAttribute('stroke-linejoin', 'round');
    this.simGroup.appendChild(tracePath);
    
    // Head / Bit
    const head = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    head.setAttribute('r', '4');
    head.setAttribute('fill', 'rgba(255, 0, 0, 0.2)');
    head.setAttribute('stroke', '#ff0000');
    head.setAttribute('stroke-width', '2');
    this.simGroup.appendChild(head);

    const crossX = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    crossX.setAttribute('stroke', '#ff0000');
    crossX.setAttribute('stroke-width', '1');
    const crossY = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    crossY.setAttribute('stroke', '#ff0000');
    crossY.setAttribute('stroke-width', '1');
    this.simGroup.appendChild(crossX);
    this.simGroup.appendChild(crossY);

    let currentPathIdx = 0;
    let currentLength = 0;
    let isTraveling = true;
    
        const getPoint = (el: SVGGeometryElement, len: number) => {
        const pt = el.getPointAtLength(len);
        const elCTM = el.getCTM();
        const vpCTM = (viewport as SVGGElement).getCTM();
        if (elCTM && vpCTM) {
             const matrix = vpCTM.inverse().multiply(elCTM);
             if (typeof pt.matrixTransform === 'function') {
                 return pt.matrixTransform(matrix);
             } else {
                 const domPt = new DOMPoint(pt.x, pt.y);
                 return domPt.matrixTransform(matrix);
             }
        }
        return pt;
    };

    let lastPoint = getPoint(elements[0], 0);
    let traceD = '';
    let travelD = '';

    let lastTime = performance.now();

    const animate = (time: number) => {
        if (!this.isSimulating) return;
        const dt = (time - lastTime) / 16.666; // Normalize to 60fps
        lastTime = time;

        const currentEl = elements[currentPathIdx];
        const elLength = currentEl.getTotalLength();

        // Safety: if the element is empty or invalid
        if (elLength === 0) {
             currentPathIdx++;
             if (currentPathIdx >= elements.length) {
                 this.isSimulating = false;
                 return;
             }
             this.animFrameId = requestAnimationFrame(animate);
             return;
        }

        if (isTraveling) {
            const targetPt = getPoint(currentEl, 0);
            const dx = targetPt.x - lastPoint.x;
            const dy = targetPt.y - lastPoint.y;
            const dist = Math.hypot(dx, dy);
            
            // Travel is fast
            const moveAmt = speed * 4 * dt;

            if (moveAmt >= dist || dist === 0) {
                isTraveling = false;
                currentLength = 0;
                lastPoint = targetPt;
                travelD += ` M ${lastPoint.x} ${lastPoint.y}`;
                traceD += ` M ${lastPoint.x} ${lastPoint.y}`;
            } else {
                lastPoint.x += (dx / dist) * moveAmt;
                lastPoint.y += (dy / dist) * moveAmt;
                travelD += ` M ${lastPoint.x - (dx/dist)*moveAmt} ${lastPoint.y - (dy/dist)*moveAmt} L ${lastPoint.x} ${lastPoint.y}`;
                travelPath.setAttribute('d', travelD);
            }
        } else {
            const moveAmt = speed * dt;
            currentLength += moveAmt;

            if (currentLength >= elLength) {
                lastPoint = getPoint(currentEl, elLength);
                traceD += ` L ${lastPoint.x} ${lastPoint.y}`;
                tracePath.setAttribute('d', traceD);
                
                currentPathIdx++;
                isTraveling = true;
                
                if (currentPathIdx >= elements.length) {
                    this.updateHead(head, crossX, crossY, lastPoint);
                    this.isSimulating = false;
                    return;
                }
            } else {
                lastPoint = getPoint(currentEl, currentLength);
                traceD += ` L ${lastPoint.x} ${lastPoint.y}`;
                tracePath.setAttribute('d', traceD);
            }
        }

        this.updateHead(head, crossX, crossY, lastPoint);

        if (this.isSimulating) {
            this.animFrameId = requestAnimationFrame(animate);
        }
    };

    this.animFrameId = requestAnimationFrame(animate);
  }

  private updateHead(head: SVGCircleElement, crossX: SVGLineElement, crossY: SVGLineElement, pt: DOMPoint | SVGPoint) {
      head.setAttribute('cx', pt.x.toString());
      head.setAttribute('cy', pt.y.toString());
      crossX.setAttribute('x1', (pt.x - 6).toString());
      crossX.setAttribute('x2', (pt.x + 6).toString());
      crossX.setAttribute('y1', pt.y.toString());
      crossX.setAttribute('y2', pt.y.toString());
      crossY.setAttribute('x1', pt.x.toString());
      crossY.setAttribute('x2', pt.x.toString());
      crossY.setAttribute('y1', (pt.y - 6).toString());
      crossY.setAttribute('y2', (pt.y + 6).toString());
  }
}
