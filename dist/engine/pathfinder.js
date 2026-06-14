import paper from 'paper';
export class Pathfinder {
    static init() {
        if (!paper.project) {
            const canvas = document.createElement('canvas');
            paper.setup(canvas);
        }
    }
    static injectStencilBridges(svgs, bridgeWidth) {
        this.init();
        paper.project.clear();
        const paths = [];
        for (const svg of svgs) {
            const item = paper.project.importSVG(svg, { expandShapes: true });
            const path = this.findPath(item);
            if (path)
                paths.push(path);
        }
        if (paths.length === 0)
            return null;
        let united = paths[0];
        for (let i = 1; i < paths.length; i++) {
            united = united.unite(paths[i]);
        }
        if (!(united instanceof paper.CompoundPath)) {
            return `<svg xmlns="http://www.w3.org/2000/svg">${united.exportSVG({ asString: true })}</svg>`;
        }
        const holes = [];
        let largestArea = 0;
        for (const child of united.children) {
            if (child instanceof paper.Path) {
                const area = Math.abs(child.area);
                if (area > largestArea)
                    largestArea = area;
            }
        }
        const outerAreaSign = Math.sign(united.children[0].area || 1);
        for (const child of united.children) {
            if (child instanceof paper.Path) {
                if (Math.sign(child.area) !== outerAreaSign && Math.abs(child.area) < largestArea) {
                    holes.push(child);
                }
            }
        }
        let rectsToSubtract = null;
        for (const hole of holes) {
            let minDistance = Infinity;
            let bestHolePt = hole.bounds.center;
            let bestOuterPt = hole.bounds.center;
            // Sample hole boundary
            for (let i = 0; i < hole.length; i += 2) {
                const pt = hole.getPointAt(i);
                if (!pt)
                    continue;
                for (const other of united.children) {
                    if (other === hole)
                        continue;
                    if (other instanceof paper.Path) {
                        const opt = other.getNearestPoint(pt);
                        if (!opt)
                            continue;
                        const dist = pt.getDistance(opt);
                        if (dist < minDistance) {
                            minDistance = dist;
                            bestHolePt = pt;
                            bestOuterPt = opt;
                        }
                    }
                }
            }
            if (minDistance === Infinity)
                continue;
            const vec = bestOuterPt.subtract(bestHolePt);
            const angle = vec.angle;
            const length = vec.length;
            const mid = bestHolePt.add(vec.divide(2));
            const bridgeRect = new paper.Path.Rectangle({
                center: mid,
                size: [length + bridgeWidth * 2, bridgeWidth]
            });
            bridgeRect.rotate(angle);
            if (!rectsToSubtract)
                rectsToSubtract = bridgeRect;
            else
                rectsToSubtract = rectsToSubtract.unite(bridgeRect);
        }
        if (rectsToSubtract) {
            united = united.subtract(rectsToSubtract);
        }
        if (!united || (typeof united.isEmpty === 'function' && united.isEmpty()))
            return `<svg></svg>`;
        united.fillColor = new paper.Color(0, 0, 0, 1);
        united.strokeColor = null;
        const resultSvg = united.exportSVG({ asString: true });
        return `<svg xmlns="http://www.w3.org/2000/svg">${resultSvg}</svg>`;
    }
    static async divideAll(svgs) {
        this.init();
        paper.project.clear();
        const paths = [];
        for (const svg of svgs) {
            const item = paper.project.importSVG(svg, { expandShapes: true });
            const path = this.findPath(item);
            if (path) {
                if (!path.fillColor)
                    path.fillColor = new paper.Color(0, 0, 0, 1);
                if (path instanceof paper.CompoundPath) {
                    for (const child of path.children) {
                        if (child instanceof paper.Path)
                            child.closed = true;
                    }
                }
                else if (path instanceof paper.Path) {
                    path.closed = true;
                }
                paths.push(path);
            }
        }
        if (paths.length < 2)
            return null;
        let result = paths[0];
        let lastYield = performance.now();
        for (let i = 1; i < paths.length; i++) {
            // Chunked processing: yield to event loop every 16ms
            if (performance.now() - lastYield > 16) {
                await new Promise(resolve => setTimeout(resolve, 0));
                lastYield = performance.now();
            }
            result = result.divide(paths[i]);
        }
        if (!result || (typeof result.isEmpty === 'function' && result.isEmpty())) {
            return `<svg></svg>`;
        }
        const resultSvg = result.exportSVG({ asString: true });
        return `<svg xmlns="http://www.w3.org/2000/svg">${resultSvg}</svg>`;
    }
    static outlineStroke(svg, width, cap = 'round', join = 'round') {
        this.init();
        paper.project.clear();
        const item = paper.project.importSVG(svg, { expandShapes: true });
        const path = this.findPath(item);
        if (!path)
            return null;
        let result = this.outlineItemStroke(path, width, cap, join);
        if (!result)
            return null;
        result.fillColor = new paper.Color(0, 0, 0, 1);
        result.strokeColor = null;
        result.strokeWidth = 0;
        const resultSvg = result.exportSVG({ asString: true });
        return `<svg xmlns="http://www.w3.org/2000/svg">${resultSvg}</svg>`;
    }
    static flattenPath(svg, tolerance) {
        this.init();
        paper.project.clear();
        const item = paper.project.importSVG(svg, { expandShapes: true });
        let path = this.findPath(item);
        if (!path)
            return null;
        const clone = path.clone({ insert: false });
        clone.flatten(tolerance);
        const resultSvg = clone.exportSVG({ asString: true });
        return `<svg xmlns="http://www.w3.org/2000/svg">${resultSvg}</svg>`;
    }
    static reversePath(svg) {
        this.init();
        paper.project.clear();
        const item = paper.project.importSVG(svg, { expandShapes: true });
        let path = this.findPath(item);
        if (!path)
            return null;
        if (path instanceof paper.CompoundPath) {
            for (const child of path.children) {
                if (child instanceof paper.Path)
                    child.reverse();
            }
        }
        else if (path instanceof paper.Path) {
            path.reverse();
        }
        const resultSvg = path.exportSVG({ asString: true });
        return `<svg xmlns="http://www.w3.org/2000/svg">${resultSvg}</svg>`;
    }
    static offsetPath(svg, offset, join = 'round') {
        this.init();
        paper.project.clear();
        const item = paper.project.importSVG(svg, { expandShapes: true });
        let path = this.findPath(item);
        if (!path)
            return null;
        // Ensure the original path is closed for offsetting
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
        const width = Math.abs(offset) * 2;
        const outline = this.outlineItemStroke(path, width, 'round', join);
        if (!outline)
            return null;
        let result;
        if (offset > 0) {
            result = path.unite(outline);
        }
        else {
            result = path.subtract(outline);
        }
        if (!result || (typeof result.isEmpty === 'function' && result.isEmpty())) {
            return `<svg></svg>`;
        }
        result.fillColor = new paper.Color(0, 0, 0, 1);
        result.strokeColor = null;
        const resultSvg = result.exportSVG({ asString: true });
        return `<svg xmlns="http://www.w3.org/2000/svg">${resultSvg}</svg>`;
    }
    static outlineItemStroke(item, width, cap, join) {
        if (item instanceof paper.CompoundPath) {
            let result = null;
            for (const child of item.children) {
                if (child instanceof paper.PathItem) {
                    const outline = this.outlineSinglePathStroke(child, width, cap, join);
                    if (outline) {
                        if (!result)
                            result = outline;
                        else
                            result = result.unite(outline);
                    }
                }
            }
            return result;
        }
        else if (item instanceof paper.Path) {
            return this.outlineSinglePathStroke(item, width, cap, join);
        }
        return null;
    }
    static outlineSinglePathStroke(path, width, cap, join) {
        const flat = path.clone({ insert: false });
        flat.flatten(0.25);
        const segments = flat.segments;
        if (!segments || segments.length < 2)
            return null;
        let outline = null;
        const r = width / 2;
        for (let i = 0; i < segments.length; i++) {
            const p1 = segments[i].point;
            const nextIdx = i + 1;
            if (nextIdx >= segments.length) {
                if (!path.closed)
                    break;
            }
            const p2 = segments[nextIdx % segments.length].point;
            const vec = p2.subtract(p1);
            const length = vec.length;
            if (length === 0)
                continue;
            const normal = new paper.Point(-vec.y, vec.x).normalize(r);
            const rect = new paper.Path({
                segments: [
                    p1.add(normal),
                    p2.add(normal),
                    p2.subtract(normal),
                    p1.subtract(normal)
                ],
                closed: true,
                insert: false
            });
            if (!outline)
                outline = rect;
            else
                outline = outline.unite(rect);
            if (join === 'round') {
                const circle = new paper.Path.Circle({
                    center: p2,
                    radius: r,
                    insert: false
                });
                outline = outline.unite(circle);
            }
            else if (join === 'bevel') {
                // Bevel is implicitly created by not adding a joint shape 
                // and letting the union handle the inner corner. 
                // For the outer corner, union truncates it.
            }
            else {
                // Miter is complex, default to round for now
                const circle = new paper.Path.Circle({
                    center: p2,
                    radius: r,
                    insert: false
                });
                outline = outline.unite(circle);
            }
        }
        if (!path.closed && cap === 'round') {
            const c1 = new paper.Path.Circle({ center: segments[0].point, radius: r, insert: false });
            const c2 = new paper.Path.Circle({ center: segments[segments.length - 1].point, radius: r, insert: false });
            if (outline) {
                outline = outline.unite(c1);
                outline = outline.unite(c2);
            }
        }
        return outline;
    }
    /**
     * Performs a boolean operation between two or more SVG paths.
     * Takes SVG strings of the elements, and returns the SVG string of the result.
     */
    static performOperation(svg1, svg2, operation, isStrokeOnly = false) {
        this.init();
        paper.project.clear();
        const item1 = paper.project.importSVG(svg1, { expandShapes: true });
        const item2 = paper.project.importSVG(svg2, { expandShapes: true });
        const path1 = this.findPath(item1);
        const path2 = this.findPath(item2);
        if (!path1 || !path2)
            return null;
        if (!isStrokeOnly) {
            [path1, path2].forEach(p => {
                if (!p.fillColor)
                    p.fillColor = new paper.Color(0, 0, 0, 1);
                if (p instanceof paper.CompoundPath) {
                    for (const child of p.children) {
                        if (child instanceof paper.Path)
                            child.closed = true;
                    }
                }
                else if (p instanceof paper.Path) {
                    p.closed = true;
                }
            });
        }
        let result = null;
        let noChange = false;
        switch (operation) {
            case 'unite':
                result = path1.unite(path2);
                break;
            case 'subtract':
                // Use the explicit flag to determine if it's stroke-only
                if (isStrokeOnly) {
                    result = this.eraseStroke(path1, path2);
                    if (result === path1)
                        noChange = true;
                }
                else {
                    // Only subtract if they intersect or one is inside the other
                    if (path1.intersects(path2) || path1.contains(path2.bounds.center) || path2.contains(path1.bounds.center)) {
                        result = path1.subtract(path2);
                    }
                    else {
                        noChange = true;
                    }
                }
                break;
            case 'intersect':
                result = path1.intersect(path2);
                break;
            case 'exclude':
                result = path1.exclude(path2);
                break;
            case 'divide':
                result = path1.divide(path2);
                break;
        }
        if (noChange)
            return null;
        // If the boolean operation resulted in an empty shape (e.g. disjoint intersect)
        if (!result || (typeof result.isEmpty === 'function' && result.isEmpty())) {
            return `<svg></svg>`;
        }
        // Export back to SVG string
        const resultSvg = result.exportSVG({ asString: true });
        return `<svg xmlns="http://www.w3.org/2000/svg">${resultSvg}</svg>`;
    }
    static eraseStroke(target, eraser) {
        if (target instanceof paper.CompoundPath) {
            const group = new paper.Group();
            let anyChanged = false;
            const children = [...target.children];
            for (const child of children) {
                if (child instanceof paper.Path) {
                    const res = this.eraseSingleStroke(child, eraser);
                    if (res === null)
                        anyChanged = true;
                    else if (res !== child)
                        anyChanged = true;
                    if (res) {
                        // We must clone it if it's the original child, because we can't move it directly from the CompoundPath without messing up iteration
                        const finalRes = res === child ? child.clone({ insert: false }) : res;
                        group.addChild(finalRes);
                    }
                }
            }
            if (!anyChanged)
                return target;
            return group.children.length > 0 ? group : null;
        }
        else if (target instanceof paper.Path) {
            return this.eraseSingleStroke(target, eraser);
        }
        return target;
    }
    static eraseSingleStroke(path, eraser) {
        let intersections = path.getIntersections(eraser);
        if (intersections.length === 0) {
            let isInside = false;
            if (path.segments.length > 0) {
                isInside = eraser.contains(path.segments[0].point);
            }
            if (!isInside && path.length > 0) {
                const midPt = path.getPointAt(path.length / 2);
                if (midPt)
                    isInside = eraser.contains(midPt);
            }
            if (isInside) {
                return null; // Entire stroke is inside the eraser
            }
            return path; // Return original reference indicating unchanged
        }
        let workingPath = path.clone({ insert: false });
        paper.project.activeLayer.addChild(workingPath);
        // If the path is closed, opening it shifts the offsets.
        // So we open it at the first intersection, then re-calculate intersections on the now-open path.
        if (workingPath.closed) {
            workingPath.splitAt(intersections[0].offset);
            intersections = workingPath.getIntersections(eraser);
        }
        intersections.sort((a, b) => b.offset - a.offset);
        const pieces = [];
        for (const inter of intersections) {
            // Skip splitting if offset is very close to ends
            if (inter.offset < 1 || inter.offset > workingPath.length - 1)
                continue;
            const splitResult = workingPath.splitAt(inter.offset);
            if (splitResult && splitResult !== workingPath) {
                pieces.unshift(splitResult);
            }
        }
        pieces.unshift(workingPath);
        const keepGroup = new paper.Group();
        for (const piece of pieces) {
            if (piece.length === 0)
                continue;
            const midpoint = piece.getPointAt(piece.length / 2);
            if (midpoint && !eraser.contains(midpoint)) {
                keepGroup.addChild(piece);
            }
        }
        if (keepGroup.children.length === 0)
            return null;
        if (keepGroup.children.length === 1)
            return keepGroup.children[0].clone({ insert: false });
        return keepGroup;
    }
    static findPath(item) {
        if (item instanceof paper.PathItem) {
            const cloned = item.clone({ insert: false });
            paper.project.activeLayer.addChild(cloned);
            // Prevent double transformation. SVG imports apply transforms to the matrix.
            // We want to bake the global transform completely into the Path coordinates.
            cloned.applyMatrix = false;
            cloned.matrix.reset();
            cloned.applyMatrix = true;
            cloned.transform(item.globalMatrix);
            return cloned;
        }
        if (item.children) {
            let combined = null;
            const children = [...item.children];
            for (const child of children) {
                const found = this.findPath(child);
                if (found) {
                    if (!combined) {
                        combined = found;
                    }
                    else {
                        combined = combined.unite(found);
                    }
                }
            }
            return combined;
        }
        return null;
    }
}
//# sourceMappingURL=pathfinder.js.map