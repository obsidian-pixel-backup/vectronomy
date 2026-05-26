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

    let result: paper.PathItem | null = null;

    switch (operation) {
      case 'unite':
        result = path1.unite(path2);
        break;
      case 'subtract':
        result = path1.subtract(path2);
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
