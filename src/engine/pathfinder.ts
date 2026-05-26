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
  static performOperation(svg1: string, svg2: string, operation: BooleanOp): string | null {
    this.init();
    paper.project.clear();

    const item1 = paper.project.importSVG(svg1) as paper.Item;
    const item2 = paper.project.importSVG(svg2) as paper.Item;

    const path1 = this.findPath(item1);
    const path2 = this.findPath(item2);

    if (!path1 || !path2) return null;

    let result: paper.Item | null = null;

    switch (operation) {
      case 'unite':
        result = path1.unite(path2);
        break;
      case 'subtract':
        // If the path has no fill, perform stroke erasure (curve splitting)
        if (!path1.fillColor || path1.fillColor.alpha === 0) {
          result = this.eraseStroke(path1, path2);
          if (!result) return `<svg></svg>`; // Return empty if completely erased
        } else {
          // Only subtract if they intersect or one is inside the other
          if (path1.intersects(path2) || path1.contains(path2.bounds.center) || path2.contains(path1.bounds.center)) {
            result = path1.subtract(path2);
          } else {
            return null; // Return null if no modification is needed
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

    if (!result) return null;

    // Export back to SVG string
    const resultSvg = result.exportSVG({ asString: true }) as string;
    return resultSvg;
  }

  private static eraseStroke(target: paper.PathItem, eraser: paper.PathItem): paper.Item | null {
    if (target instanceof paper.CompoundPath) {
      const group = new paper.Group({ insert: false });
      for (const child of target.children) {
        if (child instanceof paper.Path) {
          const res = this.eraseSingleStroke(child, eraser);
          if (res) group.addChild(res);
        }
      }
      return group.children.length > 0 ? group : null;
    } else if (target instanceof paper.Path) {
      return this.eraseSingleStroke(target, eraser);
    }
    return target;
  }

  private static eraseSingleStroke(path: paper.Path, eraser: paper.PathItem): paper.Item | null {
    const intersections = path.getIntersections(eraser);
    if (intersections.length === 0) {
      // No intersections, check if entirely inside eraser
      if (path.segments.length > 0 && eraser.contains(path.segments[0].point)) {
        return null;
      }
      return path.clone({ insert: false });
    }

    // Sort by offset descending to split from end to start safely
    intersections.sort((a, b) => b.offset - a.offset);

    const workingPath = path.clone({ insert: false }) as paper.Path;
    const pieces: paper.Path[] = [];

    for (const inter of intersections) {
      const splitResult = workingPath.splitAt(inter.offset);
      if (splitResult) {
        pieces.unshift(splitResult);
      }
    }
    pieces.unshift(workingPath);

    const keepGroup = new paper.Group({ insert: false });
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
      cloned.transform(item.globalMatrix);
      return cloned;
    }
    if (item instanceof paper.Shape) {
      const path = item.toPath(false);
      path.transform(item.globalMatrix);
      return path;
    }
    if (item.children) {
      let combined: paper.PathItem | null = null;
      for (const child of item.children) {
        const found = this.findPath(child);
        if (found) {
          if (!combined) {
            combined = found;
          } else {
            combined = combined.unite(found, { insert: false }) as paper.PathItem;
          }
        }
      }
      return combined;
    }
    return null;
  }
}
