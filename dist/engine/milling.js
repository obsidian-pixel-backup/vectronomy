import paper from 'paper';
import { Pathfinder } from './pathfinder';
import { FabricationEngine } from './fabrication';
export class MillingEngine {
    static init() {
        if (!paper.project) {
            const canvas = document.createElement('canvas');
            paper.setup(canvas);
        }
    }
    static findPath(item) {
        if (item instanceof paper.PathItem) {
            const cloned = item.clone({ insert: false });
            cloned.applyMatrix = false;
            cloned.matrix.reset();
            cloned.applyMatrix = true;
            cloned.transform(item.globalMatrix);
            return cloned;
        }
        if (item.children) {
            let combined = null;
            for (const child of item.children) {
                const found = this.findPath(child);
                if (found) {
                    if (!combined)
                        combined = found;
                    else
                        combined = combined.unite(found);
                }
            }
            return combined;
        }
        return null;
    }
    // ── Feature 41: CNC Bit Offset Compensator ──────────────────────
    static applyBitOffset(svgs, bitRadius) {
        // We can reuse Kerf Compensation which takes kerf width (diameter).
        return FabricationEngine.applyKerfCompensation(svgs, bitRadius * 2);
    }
    // ── Feature 42: Pocket Hatch Generator ─────────────────────────
    static generatePocketHatch(svg, stepover, angleDeg) {
        this.init();
        paper.project.clear();
        const item = paper.project.importSVG(svg, { expandShapes: true });
        const path = this.findPath(item);
        if (!path)
            return null;
        // We must ensure path is closed and filled for boolean intersect to work properly
        if (path instanceof paper.CompoundPath) {
            for (const child of path.children) {
                if (child instanceof paper.Path)
                    child.closed = true;
            }
        }
        else if (path instanceof paper.Path) {
            path.closed = true;
        }
        path.fillColor = new paper.Color(0, 0, 0, 1);
        const bounds = path.bounds;
        // expand bounds to ensure coverage when rotating
        const expanded = bounds.expand(Math.max(bounds.width, bounds.height));
        const lines = new paper.CompoundPath({});
        const startY = expanded.top;
        const endY = expanded.bottom;
        for (let y = startY; y <= endY; y += stepover) {
            // Use very thin rectangles for intersection, since intersecting paths with lines in Paper.js 
            // can sometimes return empty results if lines don't have thickness. 
            // Wait, path.intersect with lines usually works, but just in case, we stroke it or make rectangles.
            // Actually, paper.js intersect works with lines! But let's use thin rectangles for robust boolean op.
            const rect = new paper.Path.Rectangle(new paper.Point(expanded.left, y - 0.01), new paper.Point(expanded.right, y + 0.01));
            lines.addChild(rect);
        }
        lines.rotate(angleDeg, bounds.center);
        const result = path.intersect(lines);
        if (!result || (typeof result.isEmpty === 'function' && result.isEmpty()))
            return null;
        result.strokeColor = new paper.Color('#0000ff');
        result.strokeWidth = 1;
        result.fillColor = null;
        const resultSvg = result.exportSVG({ asString: true });
        return `<svg xmlns="http://www.w3.org/2000/svg">${resultSvg}</svg>`;
    }
    // ── Feature 43: 3D Chamfering & V-Groove Calculator ─────────────
    static generateChamfer(svg, totalDepth, bitAngle, passes) {
        const resultSvgs = [];
        const rad = (bitAngle / 2) * (Math.PI / 180);
        const depthPerPass = totalDepth / passes;
        for (let i = 1; i <= passes; i++) {
            const currentDepth = depthPerPass * i;
            const currentOffset = currentDepth * Math.tan(rad);
            // Offset inward (shrink)
            const offsetSvg = Pathfinder.offsetPath(svg, -currentOffset);
            if (offsetSvg) {
                const doc = new DOMParser().parseFromString(offsetSvg, 'image/svg+xml');
                const newPaths = Array.from(doc.querySelectorAll('path, rect, circle, ellipse, polygon, polyline, line'));
                for (const newPath of newPaths) {
                    newPath.setAttribute('data-cnc-op', 'chamfer');
                    newPath.setAttribute('data-cnc-z', (-currentDepth).toFixed(4));
                    newPath.setAttribute('stroke', '#ff00ff'); // Visual indicator
                    newPath.setAttribute('fill', 'none');
                    resultSvgs.push(newPath.outerHTML);
                }
            }
        }
        return resultSvgs;
    }
    // ── Feature 44: Drilling / Boring Operations Handler ─────────────
    static convertToDrill(svgs, maxDiameter) {
        this.init();
        const results = [];
        const changed = [];
        for (const svg of svgs) {
            paper.project.clear();
            const item = paper.project.importSVG(svg, { expandShapes: true });
            const path = this.findPath(item);
            if (!path || !(path instanceof paper.Path)) {
                results.push(svg);
                changed.push(false);
                continue;
            }
            const bounds = path.bounds;
            const diameter = Math.max(bounds.width, bounds.height);
            const isCircular = Math.abs(bounds.width - bounds.height) < (diameter * 0.1);
            const areaRatio = Math.abs(path.area) / (Math.PI * Math.pow(diameter / 2, 2));
            const areaValid = Math.abs(areaRatio - 1) < 0.2;
            if (diameter <= maxDiameter && isCircular && areaValid) {
                const center = bounds.center;
                // Replace with a crosshair symbol for drilling
                const crosshair = new paper.Group([
                    new paper.Path.Line(center.subtract(new paper.Point(5, 0)), center.add(new paper.Point(5, 0))),
                    new paper.Path.Line(center.subtract(new paper.Point(0, 5)), center.add(new paper.Point(0, 5))),
                    new paper.Path.Circle({ center: center, radius: 2 })
                ]);
                crosshair.strokeColor = new paper.Color('#ff0000');
                const doc = new DOMParser().parseFromString(crosshair.exportSVG({ asString: true }), 'image/svg+xml');
                const newEl = doc.documentElement.firstElementChild;
                if (newEl) {
                    newEl.setAttribute('data-cnc-op', 'drill');
                    newEl.setAttribute('data-cnc-diameter', diameter.toFixed(4));
                    results.push(newEl.outerHTML);
                    changed.push(true);
                }
                else {
                    results.push(svg);
                    changed.push(false);
                }
            }
            else {
                results.push(svg);
                changed.push(false);
            }
        }
        return { svgs: results, changed };
    }
    // ── Feature 45: V-Carving Path Solver ───────────────────────────
    static applyVCarve(svg, bitAngle) {
        this.init();
        paper.project.clear();
        const item = paper.project.importSVG(svg, { expandShapes: true });
        const path = this.findPath(item);
        if (!path)
            return null;
        // Approximate medial axis distance by grid sampling bounding box
        const bounds = path.bounds;
        let maxDist = 0;
        const resolution = 20;
        const stepX = bounds.width / resolution;
        const stepY = bounds.height / resolution;
        // Sample internal points
        for (let x = bounds.left; x <= bounds.right; x += stepX) {
            for (let y = bounds.top; y <= bounds.bottom; y += stepY) {
                const pt = new paper.Point(x, y);
                if (path.contains(pt)) {
                    const nearest = path.getNearestPoint(pt);
                    const dist = pt.getDistance(nearest);
                    if (dist > maxDist) {
                        maxDist = dist;
                    }
                }
            }
        }
        const rad = (bitAngle / 2) * (Math.PI / 180);
        const maxDepth = maxDist / Math.tan(rad);
        const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
        const el = doc.documentElement.firstElementChild;
        if (el) {
            el.setAttribute('data-cnc-op', 'v-carve');
            el.setAttribute('data-cnc-angle', bitAngle.toString());
            el.setAttribute('data-cnc-max-depth', (-maxDepth).toFixed(4));
            el.setAttribute('fill', 'url(#v-carve-pattern)'); // Placeholder for styling
            return el.outerHTML;
        }
        return svg;
    }
    // ── Feature 46: Milling Holding Tabs ────────────────────────────
    static addHoldingTabs(svg, tabCount, tabWidth, tabThickness) {
        this.init();
        paper.project.clear();
        const item = paper.project.importSVG(svg, { expandShapes: true });
        const path = this.findPath(item);
        if (!path || !(path instanceof paper.Path))
            return null;
        if (path.length < tabCount * tabWidth * 2)
            return null;
        const spacing = path.length / tabCount;
        const group = new paper.Group();
        // Work backwards to avoid shifting offsets
        for (let i = tabCount - 1; i >= 0; i--) {
            const centerOffset = (i + 0.5) * spacing;
            let startCut = centerOffset - tabWidth / 2;
            let endCut = centerOffset + tabWidth / 2;
            if (startCut < 0)
                startCut = 0;
            if (endCut > path.length)
                endCut = path.length;
            const rightPart = path.splitAt(endCut);
            const middlePart = path.splitAt(startCut);
            if (rightPart)
                group.addChild(rightPart);
            if (middlePart) {
                middlePart.strokeColor = new paper.Color('#00ff00');
                middlePart.strokeWidth = 3;
                const doc = new DOMParser().parseFromString(middlePart.exportSVG({ asString: true }), 'image/svg+xml');
                const el = doc.documentElement.firstElementChild;
                if (el) {
                    el.setAttribute('data-cnc-z', tabThickness.toString());
                    el.setAttribute('data-cnc-op', 'tab');
                    // Convert back to paper item to keep it in the group seamlessly
                    const tabItem = paper.project.importSVG(el.outerHTML, { expandShapes: true });
                    group.addChild(tabItem);
                }
            }
        }
        group.insertChild(0, path); // The remaining start part
        if (group.children.length === 0)
            return null;
        const resultSvg = group.exportSVG({ asString: true });
        return `<svg xmlns="http://www.w3.org/2000/svg">${resultSvg}</svg>`;
    }
    // ── Feature 48: Raster Concentric Hatching ──────────────────────
    static generateConcentricHatch(svg, stepover) {
        const resultSvgs = [];
        // Iteratively offset inward until no valid path is returned
        let currentOffset = stepover;
        while (true) {
            const offsetSvg = Pathfinder.offsetPath(svg, -currentOffset);
            if (!offsetSvg)
                break;
            // Ensure it has actual area and isn't a collapsed point
            const doc = new DOMParser().parseFromString(offsetSvg, 'image/svg+xml');
            const newPaths = Array.from(doc.querySelectorAll('path, rect, circle, ellipse, polygon, polyline'));
            if (newPaths.length === 0)
                break;
            let validPaths = false;
            for (const newPath of newPaths) {
                newPath.setAttribute('data-cnc-op', 'pocket-concentric');
                newPath.setAttribute('stroke', '#0000ff');
                newPath.setAttribute('fill', 'none');
                // Check bounding box area to prevent infinite loops of microscopic artifacts
                paper.project.clear();
                const temp = paper.project.importSVG(newPath.outerHTML);
                if (temp.bounds.width > 0.1 && temp.bounds.height > 0.1) {
                    resultSvgs.push(newPath.outerHTML);
                    validPaths = true;
                }
            }
            if (!validPaths)
                break;
            currentOffset += stepover;
            // Failsafe limit
            if (currentOffset > 1000)
                break;
        }
        return resultSvgs;
    }
}
//# sourceMappingURL=milling.js.map