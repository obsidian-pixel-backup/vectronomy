import re

with open('src/engine/editor.ts', 'r') as f:
    content = f.read()

# We need to add the missing helper methods at the end of the class, or somewhere appropriate.
helpers = """
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
      pt.x = e.touches[0].clientX;
      pt.y = e.touches[0].clientY;
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
    els.forEach(el => {
      const box = this.getTransformedBBox(el);
      if (box.x < minX) minX = box.x;
      if (box.y < minY) minY = box.y;
      if (box.x + box.width > maxX) maxX = box.x + box.width;
      if (box.y + box.height > maxY) maxY = box.y + box.height;
    });
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }
"""

# Let's insert them right after `clearSelection` or before `notifyChange`.
content = content.replace('  clearSelection() {', helpers + '\n  clearSelection() {')

# Also fix the implicit any types in els.forEach(el => ...)
content = re.sub(r'els\.forEach\(el =>', r'els.forEach((el: SVGGraphicsElement) =>', content)
content = re.sub(r'els\.forEach\(\(el: SVGGraphicsElement\): SVGGraphicsElement\)', r'els.forEach((el: SVGGraphicsElement)', content)

# Fix `el` being any in `notifyChange(el: SVGGraphicsElement)`
content = re.sub(r'this\.notifyChange\(els\[0\]\)', r'this.notifyChange(els[0] || null)', content)

# Fix `props.fillEnabled ?? (el.getAttribute('fill')` undefined `el` issue in updateProperties
# updateProperties now uses els array. The setAttr loop is what we need to fix.
# It seems `el` was still used there.
content = content.replace("props.fillEnabled ?? (el.getAttribute('fill') !== 'none');", "props.fillEnabled ?? (firstEl.getAttribute('fill') !== 'none');")
content = content.replace("enabled ? (props.fillColor ?? el.getAttribute('fill') ?? '#000000') : 'none'", "enabled ? (props.fillColor ?? firstEl.getAttribute('fill') ?? '#000000') : 'none'")

with open('src/engine/editor.ts', 'w') as f:
    f.write(content)
