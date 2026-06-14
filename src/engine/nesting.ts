import paper from 'paper';

export interface NestingOptions {
  sheetWidth: number;
  sheetHeight: number;
  margin: number;
  allowRotation: boolean;
  exactShape: boolean; // if false, uses bounding boxes
  resolution: number; // grid step size in mm
}

export class NestingEngine {
  static init() {
    if (!paper.project) {
      const canvas = document.createElement('canvas');
      paper.setup(canvas);
    }
  }

  static nestPaths(svgs: string[], options: NestingOptions): string[] {
    this.init();
    paper.project.clear();

    const items = svgs.map(svg => paper.project.importSVG(svg, { expandShapes: true }) as paper.Item);
    
    // Extract paths and bake transforms
    const paths = items.map(item => this.findPath(item)).filter(p => p !== null) as paper.PathItem[];
    
    // Sort by area descending (largest first)
    paths.sort((a, b) => b.bounds.area - a.bounds.area);

    const placed: paper.PathItem[] = [];
    const step = options.resolution > 0 ? options.resolution : 5;

    for (const path of paths) {
      // Temporarily center to 0,0 for easier rotation and bound calculations
      path.position = new paper.Point(0, 0); 
      
      let bestPos: paper.Point | null = null;
      let bestRot = 0;
      let minScore = Infinity;

      const rotations = options.allowRotation ? [0, 90, 180, 270] : [0];

      for (const rot of rotations) {
        if (rot !== 0) path.rotate(rot);

        const bounds = path.bounds;
        const w = bounds.width;
        const h = bounds.height;

        for (let y = options.margin; y <= options.sheetHeight - h - options.margin; y += step) {
          for (let x = options.margin; x <= options.sheetWidth - w - options.margin; x += step) {
            
            // Candidate position center
            const center = new paper.Point(x + w / 2, y + h / 2);
            path.position = center;
            
            let collision = false;
            for (const p of placed) {
               // Quick bounding box check (inflated by margin)
               const inflatedBounds = p.bounds.expand(options.margin * 2);
               if (path.bounds.intersects(inflatedBounds)) {
                   if (!options.exactShape) {
                       collision = true;
                       break;
                   } else {
                       // Exact check: check if the actual paths intersect
                       if (path.intersects(p)) {
                           collision = true;
                           break;
                       }
                       // Also need to check if one is fully inside another
                       // Pick a point on the path and check containment
                       if (p.contains(path.bounds.center) || path.contains(p.bounds.center)) {
                           collision = true;
                           break;
                       }
                   }
               }
            }

            if (!collision) {
              const score = y * options.sheetWidth + x; // Bottom-Left Fill priority
              if (score < minScore) {
                minScore = score;
                bestPos = center.clone();
                bestRot = rot;
              }
              break; // Found the best X for this Y, no need to keep scanning X
            }
          }
          if (bestPos) break; // Found the absolute best position for this rotation
        }
        
        if (rot !== 0) path.rotate(-rot); // Reset rotation for the next loop
      }

      if (bestPos) {
        if (bestRot !== 0) path.rotate(bestRot);
        path.position = bestPos;
        placed.push(path);
      } else {
        console.warn('Warning: Could not fit part into the sheet dimensions.');
      }
    }

    return paths.map(p => {
       if (!p.fillColor) p.fillColor = new paper.Color(0,0,0,1);
       return `<svg xmlns="http://www.w3.org/2000/svg">${p.exportSVG({ asString: true })}</svg>`;
    });
  }

  private static findPath(item: paper.Item): paper.PathItem | null {
    if (item instanceof paper.PathItem) {
      const cloned = item.clone({ insert: false }) as paper.PathItem;
      cloned.applyMatrix = false;
      cloned.matrix.reset();
      cloned.applyMatrix = true;
      cloned.transform(item.globalMatrix);
      return cloned;
    }
    if (item.children) {
      let combined: paper.PathItem | null = null;
      for (const child of item.children) {
        const found = this.findPath(child);
        if (found) {
          if (!combined) combined = found;
          else combined = combined.unite(found) as paper.PathItem;
        }
      }
      return combined;
    }
    return null;
  }
}
