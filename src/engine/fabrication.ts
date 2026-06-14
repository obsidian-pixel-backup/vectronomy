import paper from 'paper';
import { Pathfinder } from './pathfinder';

export class FabricationEngine {
  static init() {
    if (!paper.project) {
      const canvas = document.createElement('canvas');
      paper.setup(canvas);
    }
  }

  // ── Feature 31: Friction-Fit Kerf Compensator ──────────────────
  static applyKerfCompensation(svgs: string[], kerfWidth: number, direction: 'auto' | 'inward' | 'outward' = 'auto'): string[] {
    this.init();
    paper.project.clear();

    const resultSvgs: string[] = [];
    const items = svgs.map(svg => paper.project.importSVG(svg, { expandShapes: true }) as paper.Item);
    const paths = items.map(item => this.findPath(item)).filter(p => p !== null) as paper.PathItem[];

    // Build containment tree to determine depth (outer vs inner cuts)
    const depths = new Map<paper.PathItem, number>();
    for (const p of paths) {
      let depth = 0;
      for (const other of paths) {
        if (p !== other && other.contains(p.bounds.center) && p.bounds.area < other.bounds.area) {
          depth++;
        }
      }
      depths.set(p, depth);
    }

    for (let i = 0; i < svgs.length; i++) {
      const p = paths[i];
      if (!p || !(p as any).closed) {
        resultSvgs.push(svgs[i]);
        continue;
      }
      
      const depth = depths.get(p) || 0;
      // Even depth = outer cut (expand), Odd depth = inner cut/hole (shrink)
      let offset = 0;
      if (direction === 'auto') {
        offset = depth % 2 === 0 ? kerfWidth / 2 : -kerfWidth / 2;
      } else if (direction === 'outward') {
        offset = kerfWidth / 2;
      } else if (direction === 'inward') {
        offset = -kerfWidth / 2;
      }
      
      const resultSvg = Pathfinder.offsetPath(svgs[i], offset);
      if (resultSvg) {
        resultSvgs.push(resultSvg);
      } else {
        resultSvgs.push(svgs[i]);
      }
    }
    
    return resultSvgs;
  }

  // ── Feature 32: Lead-in / Lead-out ──────────────────────────────
  static addLeadInOut(svg: string, length: number, type: 'in' | 'out' | 'both' = 'in'): string | null {
    this.init();
    paper.project.clear();
    const item = paper.project.importSVG(svg, { expandShapes: true }) as paper.Item;
    const path = this.findPath(item);
    if (!path || !(path instanceof paper.Path)) return null;

    // Must be a Path (not CompoundPath) for simple lead-in geometry
    const startPoint = path.getPointAt(0);
    const endPoint = path.getPointAt(path.length);
    const startNormal = path.getNormalAt(0).normalize(length);
    const endNormal = path.getNormalAt(path.length).normalize(length);

    // If it's closed, we need to open it at some point to add leads.
    // Assuming it's already an open path or we open it at 0.
    if (path.closed) {
        path.closed = false;
    }

    const leadInPoint = startPoint.add(startNormal);
    const leadOutPoint = endPoint.add(endNormal); // Or subtract if needed

    if (type === 'in' || type === 'both') {
        path.insert(0, leadInPoint);
    }
    if (type === 'out' || type === 'both') {
        path.add(leadOutPoint);
    }

    const resultSvg = path.exportSVG({ asString: true }) as string;
    return `<svg xmlns="http://www.w3.org/2000/svg">${resultSvg}</svg>`;
  }

  // ── Feature 33: Micro-Joint Tab Placer ──────────────────────────
  static addTabs(svg: string, tabCount: number, tabWidth: number): string | null {
    this.init();
    paper.project.clear();
    const item = paper.project.importSVG(svg, { expandShapes: true }) as paper.Item;
    const path = this.findPath(item);
    if (!path || !(path instanceof paper.Path)) return null;

    if (path.length < tabCount * tabWidth * 2) return null;

    const spacing = path.length / tabCount;
    const group = new paper.Group();

    // Work backwards to avoid shifting offsets
    for (let i = tabCount - 1; i >= 0; i--) {
        const centerOffset = (i + 0.5) * spacing;
        let startCut = centerOffset - tabWidth / 2;
        let endCut = centerOffset + tabWidth / 2;
        
        if (startCut < 0) startCut = 0;
        if (endCut > path.length) endCut = path.length;

        const rightPart = path.splitAt(endCut);
        const middlePart = path.splitAt(startCut);
        
        if (rightPart) group.addChild(rightPart);
        if (middlePart) middlePart.remove(); // This is the tab (the gap we leave uncut)
    }
    group.insertChild(0, path); // The remaining start part

    if (group.children.length === 0) return null;

    const resultSvg = group.exportSVG({ asString: true }) as string;
    return `<svg xmlns="http://www.w3.org/2000/svg">${resultSvg}</svg>`;
  }

  // ── Feature 34 & 35: Inner-First & TSP Routing ──────────────────
  static async sortAndRouteCuts(svgs: string[]): Promise<{ sortedSvgs: string[], originalIndices: number[] }> {
    this.init();
    paper.project.clear();

    const items = svgs.map(svg => paper.project.importSVG(svg, { expandShapes: true }) as paper.Item);
    const paths = items.map(item => this.findPath(item));
    
    // 1. Determine nesting depth (Inner-First)
    const nodes = paths.map((p, i) => {
        if (!p) return { depth: 0, index: i, startX: 0, startY: 0, endX: 0, endY: 0 };
        let d = 0;
        for (let j = 0; j < paths.length; j++) {
            if (i !== j && paths[j] && paths[j]!.contains(p.bounds.center) && p.bounds.area < paths[j]!.bounds.area) {
                d++;
            }
        }
        const anyP = p as any;
        const start = anyP.firstSegment ? anyP.firstSegment.point : p.bounds.center;
        const end = anyP.lastSegment ? anyP.lastSegment.point : p.bounds.center;
        return { 
          depth: d, 
          index: i, 
          startX: start.x, startY: start.y, 
          endX: end.x, endY: end.y 
        };
    });

    // 2. Offload TSP routing to Web Worker
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    const id = Date.now().toString();
    
    return new Promise((resolve, reject) => {
      worker.onmessage = (e) => {
        if (e.data.type === 'TSP_RESULT' && e.data.id === id) {
          const finalOrder = e.data.order;
          worker.terminate();
          const sortedSvgs = finalOrder.map((idx: number) => svgs[idx]);
          resolve({ sortedSvgs, originalIndices: finalOrder });
        } else if (e.data.type === 'ERROR' && e.data.id === id) {
          worker.terminate();
          reject(new Error(e.data.error));
        }
      };
      
      worker.postMessage({ type: 'TSP_ROUTE', id, nodes });
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

  // ── Feature 36: Acrylic Overcut Compensator ──────────────────────
  static addOvercut(svg: string, overcutLength: number): string | null {
    this.init();
    paper.project.clear();
    const item = paper.project.importSVG(svg, { expandShapes: true }) as paper.Item;
    const path = this.findPath(item);
    if (!path || !(path instanceof paper.Path)) return null;

    if (path.closed && path.length > overcutLength) {
        path.closed = false;
        const clone = path.clone({ insert: false }) as paper.Path;
        const remainder = clone.splitAt(overcutLength);
        if (remainder) {
            path.join(clone);
        }
    } else if (!path.closed) {
        // For open paths, extend straight along the end tangent
        const endNormal = path.getNormalAt(path.length).rotate(90, new paper.Point(0, 0)).normalize(overcutLength);
        path.add(path.lastSegment.point.add(endNormal));
    }

    const resultSvg = path.exportSVG({ asString: true }) as string;
    return `<svg xmlns="http://www.w3.org/2000/svg">${resultSvg}</svg>`;
  }

  // ── Feature 38: Thermal Power Ramping ───────────────────────────
  static applyPowerRamping(svg: string, cornerThresholdDeg: number = 60, rampDist: number = 5): string[] {
    this.init();
    paper.project.clear();
    const item = paper.project.importSVG(svg, { expandShapes: true }) as paper.Item;
    const path = this.findPath(item);
    if (!path || !(path instanceof paper.Path)) return [svg];

    const resultPaths: string[] = [];
    
    // Find sharp corners
    const splitOffsets: number[] = [];
    for (let i = 0; i < path.segments.length; i++) {
        const loc = path.segments[i].location;
        const offset = loc.offset;
        
        // Exclude start and end
        if (offset < 0.1 || offset > path.length - 0.1) continue;
        
        const tangentIn = path.getTangentAt(Math.max(0, offset - 0.01));
        const tangentOut = path.getTangentAt(Math.min(path.length, offset + 0.01));
        
        if (tangentIn && tangentOut) {
            const angle = tangentIn.getDirectedAngle(tangentOut);
            if (Math.abs(angle) > cornerThresholdDeg) {
                // Sharp corner!
                splitOffsets.push(offset);
            }
        }
    }

    // Split backwards to preserve offsets
    const fragments: paper.Path[] = [];
    let workingPath = path;
    for (let i = splitOffsets.length - 1; i >= 0; i--) {
        const offset = splitOffsets[i];
        const right = workingPath.splitAt(offset);
        if (right) fragments.unshift(right);
    }
    fragments.unshift(workingPath);

    // Tag fragments based on length (if a fragment is very short, it's all ramp)
    // Actually we just return them split so the exporter can assign varying stroke-opacity
    for (const frag of fragments) {
        const length = frag.length;
        if (length < 0.1) continue;
        
        frag.strokeColor = new paper.Color('#ffaa00'); // Mark as deceleration/ramp
        const fragSvg = frag.exportSVG({ asString: true }) as string;
        resultPaths.push(`<svg xmlns="http://www.w3.org/2000/svg">${fragSvg}</svg>`);
    }

    return resultPaths.length > 0 ? resultPaths : [svg];
  }

  // ── Feature 39: Dashed Perforation Generator ────────────────────
  static addPerforations(svg: string, dashLen: number, gapLen: number): string | null {
    this.init();
    paper.project.clear();
    const item = paper.project.importSVG(svg, { expandShapes: true }) as paper.Item;
    const path = this.findPath(item);
    if (!path || !(path instanceof paper.Path)) return null;

    const group = new paper.Group();
    let currentOffset = 0;
    const totalLength = path.length;
    
    // To preserve offsets, we must gather split points and split backwards
    const splits: number[] = [];
    while (currentOffset + dashLen < totalLength) {
        currentOffset += dashLen;
        splits.push(currentOffset);
        
        currentOffset += gapLen;
        if (currentOffset < totalLength) {
            splits.push(currentOffset);
        }
    }

    let p = path;
    const segments: paper.Path[] = [];
    for (let i = splits.length - 1; i >= 0; i--) {
        const right = p.splitAt(splits[i]);
        if (right) segments.unshift(right);
    }
    segments.unshift(p);
    
    // Keep every other segment (the dash)
    for (let i = 0; i < segments.length; i++) {
        if (i % 2 === 0) {
            group.addChild(segments[i]);
        }
    }

    if (group.children.length === 0) return null;
    const resultSvg = group.exportSVG({ asString: true }) as string;
    return `<svg xmlns="http://www.w3.org/2000/svg">${resultSvg}</svg>`;
  }
}
