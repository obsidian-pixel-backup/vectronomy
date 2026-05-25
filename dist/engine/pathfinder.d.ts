export type BooleanOp = 'unite' | 'subtract' | 'intersect' | 'exclude';
export declare class Pathfinder {
    static init(): void;
    /**
     * Performs a boolean operation between two or more SVG paths.
     * Takes SVG strings of the elements, and returns the SVG string of the result.
     */
    static performOperation(svg1: string, svg2: string, operation: BooleanOp): string | null;
    private static findPath;
}
//# sourceMappingURL=pathfinder.d.ts.map