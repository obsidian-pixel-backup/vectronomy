import paper from 'paper';

export type BooleanOp = 'unite' | 'subtract' | 'intersect' | 'exclude';

export class Pathfinder {
  static init() {
    if (!paper.project) {
      const canvas = document.createElement('canvas');
      paper.setup(canvas);
    }
  }

  /**
   * Performs a boolean operation between two or more SVG paths.
   * Takes SVG strings of the elements, and returns the SVG string of the result.
   */
  static performOperation(svg1: string, svg2: string, operation: BooleanOp, isStrokeOnly: boolean = false): string | null {
    this.init();
    paper.project.clear();

    const item1 = paper.project.importSVG(svg1, { expandShapes: true }) as paper.Item;
    const item2 = paper.project.importSVG(svg2, { expandShapes: true }) as paper.Item;

    const path1 = this.findPath(item1);
    const path2 = this.findPath(item2);

    if (!path1 || !path2) return null;

    if (!isStrokeOnly) {
      [path1, path2].forEach(p => {
        if (!p.fillColor) p.fillColor = new paper.Color(0, 0, 0, 1);
        if (p instanceof paper.CompoundPath) {
           for (const child of p.children) {
               if (child instanceof paper.Path) child.closed = true;
           }
        } else if (p instanceof paper.Path) {
           p.closed = true;
        }
      });
    }

    let result: paper.Item | null = null;
    let noChange = false;

    switch (operation) {
      case 'unite':
        result = path1.unite(path2);
        break;
      case 'subtract':
        // Use the explicit flag to determine if it's stroke-only
        if (isStrokeOnly) {
          result = this.eraseStroke(path1, path2);
          if (result === path1) noChange = true;
        } else {
          // Only subtract if they intersect or one is inside the other
          if (path1.intersects(path2) || path1.contains(path2.bounds.center) || path2.contains(path1.bounds.center)) {
            result = path1.subtract(path2);
          } else {
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
    }

    if (noChange) return null;
    
    // If the boolean operation resulted in an empty shape (e.g. disjoint intersect)
    if (!result || (typeof result.isEmpty === 'function' && result.isEmpty())) {
      return `<svg></svg>`;
    }

    // Export back to SVG string
    const resultSvg = result.exportSVG({ asString: true }) as string;
    return `<svg xmlns="http://www.w3.org/2000/svg">${resultSvg}</svg>`;
  }

  private static eraseStroke(target: paper.PathItem, eraser: paper.PathItem): paper.Item | null {
    if (target instanceof paper.CompoundPath) {
      const group = new paper.Group();
      let anyChanged = false;
      const children = [...target.children];
      for (const child of children) {
        if (child instanceof paper.Path) {
          const res = this.eraseSingleStroke(child, eraser);
          if (res === null) anyChanged = true;
          else if (res !== child) anyChanged = true;
          
          if (res) {
            // We must clone it if it's the original child, because we can't move it directly from the CompoundPath without messing up iteration
            const finalRes = res === child ? child.clone({ insert: false }) : res;
            group.addChild(finalRes);
          }
        }
      }
      if (!anyChanged) return target;
      return group.children.length > 0 ? group : null;
    } else if (target instanceof paper.Path) {
      return this.eraseSingleStroke(target, eraser);
    }
    return target;
  }

  private static eraseSingleStroke(path: paper.Path, eraser: paper.PathItem): paper.Item | null {
    let intersections = path.getIntersections(eraser);
    if (intersections.length === 0) {
      let isInside = false;
      if (path.segments.length > 0) {
        isInside = eraser.contains(path.segments[0].point);
      }
      if (!isInside && path.length > 0) {
        const midPt = path.getPointAt(path.length / 2);
        if (midPt) isInside = eraser.contains(midPt);
      }
      
      if (isInside) {
        return null; // Entire stroke is inside the eraser
      }
      return path; // Return original reference indicating unchanged
    }

    let workingPath = path.clone({ insert: false }) as paper.Path;
    paper.project.activeLayer.addChild(workingPath);
    
    // If the path is closed, opening it shifts the offsets.
    // So we open it at the first intersection, then re-calculate intersections on the now-open path.
    if (workingPath.closed) {
      workingPath.splitAt(intersections[0].offset);
      intersections = workingPath.getIntersections(eraser);
    }

    intersections.sort((a, b) => b.offset - a.offset);
    const pieces: paper.Path[] = [];

    for (const inter of intersections) {
      // Skip splitting if offset is very close to ends
      if (inter.offset < 1 || inter.offset > workingPath.length - 1) continue;
      
      const splitResult = workingPath.splitAt(inter.offset);
      if (splitResult && splitResult !== workingPath) {
        pieces.unshift(splitResult);
      }
    }
    pieces.unshift(workingPath);

    const keepGroup = new paper.Group();
    for (const piece of pieces) {
      if (piece.length === 0) continue;
      const midpoint = piece.getPointAt(piece.length / 2);
      if (midpoint && !eraser.contains(midpoint)) {
        keepGroup.addChild(piece);
      }
    }

    if (keepGroup.children.length === 0) return null;
    if (keepGroup.children.length === 1) return keepGroup.children[0].clone({ insert: false });
    return keepGroup;
  }

  private static findPath(item: paper.Item): paper.PathItem | null {
    if (item instanceof paper.PathItem) {
      const cloned = item.clone({ insert: false }) as paper.PathItem;
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
      let combined: paper.PathItem | null = null;
      const children = [...item.children];
      for (const child of children) {
        const found = this.findPath(child);
        if (found) {
          if (!combined) {
            combined = found;
          } else {
            combined = combined.unite(found) as paper.PathItem;
          }
        }
      }
      return combined;
    }
    return null;
  }
}
