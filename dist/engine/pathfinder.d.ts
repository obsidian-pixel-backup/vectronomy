export type BooleanOp = 'unite' | 'subtract' | 'intersect' | 'exclude' | 'divide';
export declare class Pathfinder {
    static init(): void;
    static injectStencilBridges(svgs: string[], bridgeWidth: number): string | null;
    static divideAll(svgs: string[]): Promise<string | null>;
    static outlineStroke(svg: string, width: number, cap?: string, join?: string): string | null;
    static flattenPath(svg: string, tolerance: number): string | null;
    static reversePath(svg: string): string | null;
    static offsetPath(svg: string, offset: number, join?: string): string | null;
    private static outlineItemStroke;
    private static outlineSinglePathStroke;
    /**
     * Performs a boolean operation between two or more SVG paths.
     * Takes SVG strings of the elements, and returns the SVG string of the result.
     */
    static performOperation(svg1: string, svg2: string, operation: BooleanOp, isStrokeOnly?: boolean): string | null;
    private static eraseStroke;
    private static eraseSingleStroke;
    private static findPath;
}
//# sourceMappingURL=pathfinder.d.ts.map