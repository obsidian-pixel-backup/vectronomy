/**
 * VECTRONOMY — Path Healing Engine
 * 
 * Implements geometric proximity healing for fragmented vector paths.
 * Laser cutters frequently export shapes as hundreds of tiny line segments;
 * this engine knits them back into continuous paths.
 * 
 * Uses Paper.js for geometric operations (boolean union, path joining).
 * 
 * Algorithm:
 * 1. Group paths by stroke/fill color (color-safe grouping)
 * 2. Iterate over unclosed paths, comparing endpoints
 * 3. Join paths within proximity tolerance (0.1mm at 96 DPI)
 * 4. Reverse paths for Head-to-Head / Tail-to-Tail matches
 * 5. Simplify joined geometry to remove co-linear redundant nodes
 * 6. Unite overlapping closed paths of same color (boolean union)
 */

import paper from 'paper';

/** Helper: Paper.js items have a `removed` property at runtime not in type defs */
function isRemoved(item: paper.Item): boolean {
  return (item as any).removed === true;
}

/** Proximity tolerance: 0.1mm converted to 96DPI coordinate system */
const PROXIMITY_TOLERANCE_MM = 0.1;
const DPI = 96;
const MM_TO_PX = DPI / 25.4;
const DEFAULT_TOLERANCE = PROXIMITY_TOLERANCE_MM * MM_TO_PX; // ~0.378 px

/** Simplification tolerance for co-linear node cleanup */
const SIMPLIFY_TOLERANCE = 0.1;

export interface HealingOptions {
  /** Proximity tolerance in mm (default: 0.1) */
  toleranceMm?: number;
  /** Run boolean union on overlapping closed paths (default: true) */
  enableUnion?: boolean;
  /** Simplify paths after joining (default: true) */
  enableSimplification?: boolean;
  /** Simplification tolerance (default: 0.1) */
  simplifyTolerance?: number;
}

export class PathHealer {
  /**
   * Heal an SVG string by joining fragmented path segments.
   * Returns a new SVG string with healed paths.
   */
  static async heal(
    svgContent: string,
    options: HealingOptions = {}
  ): Promise<string> {
    const {
      toleranceMm = PROXIMITY_TOLERANCE_MM,
      enableUnion = false, // Disabled by default: prevents merging separate components
      enableSimplification = false, // Disabled by default: prevents curving precise gear teeth
      simplifyTolerance = SIMPLIFY_TOLERANCE,
    } = options;

    const tolerance = toleranceMm * MM_TO_PX;

    // Initialize Paper.js with an offscreen canvas
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    paper.setup(canvas);

    try {
      // Import SVG into Paper.js scene
      const item = paper.project.importSVG(svgContent);

      // Flatten hierarchy to find all path objects
      const allPaths: paper.PathItem[] = [];
      PathHealer.collectPaths(item, allPaths);

      if (allPaths.length === 0) {
        return svgContent; // Nothing to heal
      }

      // Step 1: Group by stroke/fill color (color-safe)
      const colorGroups = PathHealer.groupByColor(allPaths);

      // Step 2: Proximity join within each color group
      for (const [, paths] of Object.entries(colorGroups)) {
        PathHealer.joinProximityPaths(paths, tolerance);

        // Step 3: Simplify joined paths
        if (enableSimplification) {
          for (const p of paths) {
            if (p instanceof paper.Path && !isRemoved(p)) {
              p.simplify(simplifyTolerance);
            }
          }
        }

        // Step 4: Boolean union on overlapping closed paths
        if (enableUnion) {
          PathHealer.uniteOverlapping(paths);
        }
      }

      // Export the healed SVG
      let result = paper.project.exportSVG({
        asString: true,
        precision: 5,
      }) as string;

      // Restore the original SVG tag attributes (viewBox, width, height, etc.)
      // Paper.js defaults to exporting with viewBox="0,0,1,1" based on its offscreen canvas
      const originalSvgTagMatch = svgContent.match(/<svg[^>]*>/);
      const exportedSvgTagMatch = result.match(/<svg[^>]*>/);

      if (originalSvgTagMatch && exportedSvgTagMatch) {
        result = result.replace(exportedSvgTagMatch[0], originalSvgTagMatch[0]);
      }

      // result = result.replace(/<(path|circle|rect|ellipse|polygon|line|polyline)\s/g, '<$1 vector-effect="non-scaling-stroke" ');

      return result;
    } finally {
      paper.project.clear();
    }
  }

  /**
   * Recursively collect all Path and CompoundPath items from the scene.
   */
  private static collectPaths(
    node: paper.Item,
    out: paper.PathItem[]
  ): void {
    if (node instanceof paper.Path || node instanceof paper.CompoundPath) {
      out.push(node);
    } else if (node.children) {
      for (const child of node.children) {
        PathHealer.collectPaths(child, out);
      }
    }
  }

  /**
   * Group paths by their stroke/fill color combination.
   * This ensures we never accidentally fuse a cut-line with an engraving plane.
   */
  private static groupByColor(
    paths: paper.PathItem[]
  ): Record<string, paper.PathItem[]> {
    const groups: Record<string, paper.PathItem[]> = {};

    for (const p of paths) {
      const stroke = p.strokeColor?.toCSS(true) || 'none';
      const fill = p.fillColor?.toCSS(true) || 'none';
      const key = `${stroke}|${fill}`;

      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    }

    return groups;
  }

  /**
   * Join fragmented paths within proximity tolerance.
   * 
   * Checks 4 endpoint permutations:
   * - Tail-to-Head (normal join)
   * - Head-to-Tail (prepend)
   * - Head-to-Head (reverse p1 then join)
   * - Tail-to-Tail (reverse p2 then join)
   */
  private static joinProximityPaths(
    paths: paper.PathItem[],
    tolerance: number
  ): void {
    let i = 0;

    while (i < paths.length) {
      const p1 = paths[i];

      // Skip non-Path items, closed paths, removed items, empty paths
      if (
        !p1 ||
        isRemoved(p1) ||
        !(p1 instanceof paper.Path) ||
        p1.closed ||
        p1.segments.length === 0
      ) {
        i++;
        continue;
      }

      let joinedAny = false;

      for (let j = i + 1; j < paths.length; j++) {
        const p2 = paths[j];
        if (
          !p2 ||
          isRemoved(p2) ||
          !(p2 instanceof paper.Path) ||
          p2.closed ||
          p2.segments.length === 0
        ) {
          continue;
        }

        const p1First = p1.firstSegment.point;
        const p1Last = p1.lastSegment.point;
        const p2First = p2.firstSegment.point;
        const p2Last = p2.lastSegment.point;

        // Calculate all 4 distances
        const dTailHead = p1Last.getDistance(p2First);
        const dHeadTail = p1First.getDistance(p2Last);
        const dHeadHead = p1First.getDistance(p2First);
        const dTailTail = p1Last.getDistance(p2Last);

        if (dTailHead < tolerance) {
          // Normal: P1-Tail → P2-Head
          p1.join(p2);
          paths.splice(j, 1);
          joinedAny = true;
          break;
        } else if (dHeadTail < tolerance) {
          // Reverse normal: P2-Tail → P1-Head
          p2.join(p1);
          paths[i] = p2;
          paths.splice(j, 1);
          joinedAny = true;
          break;
        } else if (dHeadHead < tolerance) {
          // Head-to-Head: reverse p1, then join
          p1.reverse();
          p1.join(p2);
          paths.splice(j, 1);
          joinedAny = true;
          break;
        } else if (dTailTail < tolerance) {
          // Tail-to-Tail: reverse p2, then join
          p2.reverse();
          p1.join(p2);
          paths.splice(j, 1);
          joinedAny = true;
          break;
        }
      }

      if (!joinedAny) {
        // No join found — check if path can be self-closed
        if (
          p1 instanceof paper.Path &&
          p1.segments.length > 1 &&
          p1.firstSegment.point.getDistance(p1.lastSegment.point) < tolerance
        ) {
          p1.closed = true;
        }
        i++;
      }
      // If joined, stay at same index to try joining more
    }
  }

  /**
   * Unite overlapping closed paths of the same color.
   * Implements boolean union to merge shapes that physically overlap.
   */
  private static uniteOverlapping(paths: paper.PathItem[]): void {
    let j = 0;

    while (j < paths.length) {
      const p1 = paths[j];
      if (!p1 || isRemoved(p1)) {
        j++;
        continue;
      }

      const isP1Closed =
        (p1 instanceof paper.Path && p1.closed) ||
        p1 instanceof paper.CompoundPath;

      if (!isP1Closed) {
        j++;
        continue;
      }

      let united = false;

      for (let k = j + 1; k < paths.length; k++) {
        const p2 = paths[k];
        if (!p2 || isRemoved(p2)) continue;

        const isP2Closed =
          (p2 instanceof paper.Path && p2.closed) ||
          p2 instanceof paper.CompoundPath;

        if (!isP2Closed) continue;

        // Check bounding box overlap first (fast rejection)
        if (p1.bounds.intersects(p2.bounds)) {
          // Verify actual geometric intersection
          const intersection = p1.intersect(p2);
          if (!intersection.isEmpty()) {
            // Perform union
            const joined = p1.unite(p2);
            if (
              joined instanceof paper.Path ||
              joined instanceof paper.CompoundPath
            ) {
              p1.remove();
              p2.remove();
              paths[j] = joined;
              paths.splice(k, 1);
              united = true;
              break;
            }
          }
          intersection.remove();
        }
      }

      if (!united) j++;
    }
  }

  /**
   * Utility: Normalize DPI from 72 (browser default) to 96 (XCS standard).
   */
  static normalizeDPI(value: number, fromDpi = 72, toDpi = 96): number {
    return (value * toDpi) / fromDpi;
  }
}
