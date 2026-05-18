import re

with open('src/engine/editor.ts', 'r') as f:
    content = f.read()

# 1. Remove old getSvgPoint (lines 274-281 approx)
# It looks like:
#   private getSvgPoint(e: MouseEvent): { x: number; y: number } | null {
#     const mainSvg = this.container.querySelector('svg') as SVGSVGElement | null;
#     if (!mainSvg) return null;
#     const pt = mainSvg.createSVGPoint();
#     pt.x = e.clientX; pt.y = e.clientY;
#     return pt.matrixTransform(mainSvg.getScreenCTM()!.inverse());
#   }
old_get_svg = """  private getSvgPoint(e: MouseEvent): { x: number; y: number } | null {
    const mainSvg = this.container.querySelector('svg') as SVGSVGElement | null;
    if (!mainSvg) return null;
    const pt = mainSvg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    return pt.matrixTransform(mainSvg.getScreenCTM()!.inverse());
  }"""

content = content.replace(old_get_svg, "")

# 2. Fix touches in the new getSvgPoint
content = content.replace("e.touches[0]", "(e as TouchEvent).touches[0]")

# 3. Fix alignTo to use `els[0]`
# In alignTo, we currently have:
#     if (!this.selectedId) return;
#     const el = this.getSelectedEl() as SVGGraphicsElement | null;
#     if (!el) return;
# But actually it's using `el` without defining it properly, maybe it was modified by patch2.py?
# Let's just regex replace alignTo method definition.

align_to_pattern = r"alignTo\(mode: 'left'\|'center-h'\|'right'\|'top'\|'center-v'\|'bottom'\) \{.*?this\.commit\(\);\n  \}"
new_align_to = """alignTo(mode: 'left'|'center-h'|'right'|'top'|'center-v'|'bottom') {
    const els = this.getSelectedEls();
    if (els.length === 0) return;
    const mainSvg = this.container.querySelector('svg') as SVGSVGElement | null;
    if (!mainSvg) return;

    const vb = mainSvg.viewBox.baseVal;
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
  }"""

content = re.sub(align_to_pattern, new_align_to, content, flags=re.DOTALL)

with open('src/engine/editor.ts', 'w') as f:
    f.write(content)
