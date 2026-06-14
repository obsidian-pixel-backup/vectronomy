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
export declare class PathHealer {
    /**
     * Heal an SVG string by joining fragmented path segments.
     * Returns a new SVG string with healed paths.
     */
    static heal(svgContent: string, options?: HealingOptions): Promise<string>;
    /**
     * Recursively collect all Path and CompoundPath items from the scene.
     */
    private static collectPaths;
    /**
     * Group paths by their stroke/fill color combination.
     * This ensures we never accidentally fuse a cut-line with an engraving plane.
     */
    private static groupByColor;
    /**
     * Join fragmented paths within proximity tolerance.
     *
     * Checks 4 endpoint permutations:
     * - Tail-to-Head (normal join)
     * - Head-to-Tail (prepend)
     * - Head-to-Head (reverse p1 then join)
     * - Tail-to-Tail (reverse p2 then join)
     */
    private static joinProximityPaths;
    /**
     * Unite overlapping closed paths of the same color.
     * Implements boolean union to merge shapes that physically overlap.
     */
    private static uniteOverlapping;
    /**
     * Utility: Normalize DPI from 72 (browser default) to 96 (XCS standard).
     */
    static normalizeDPI(value: number, fromDpi?: number, toDpi?: number): number;
}
//# sourceMappingURL=pathHealer.d.ts.map