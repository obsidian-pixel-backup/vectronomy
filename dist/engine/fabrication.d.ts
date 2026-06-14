export declare class FabricationEngine {
    static init(): void;
    static applyKerfCompensation(svgs: string[], kerfWidth: number, direction?: 'auto' | 'inward' | 'outward'): string[];
    static addLeadInOut(svg: string, length: number, type?: 'in' | 'out' | 'both'): string | null;
    static addTabs(svg: string, tabCount: number, tabWidth: number): string | null;
    static sortAndRouteCuts(svgs: string[]): Promise<{
        sortedSvgs: string[];
        originalIndices: number[];
    }>;
    private static findPath;
    static addOvercut(svg: string, overcutLength: number): string | null;
    static applyPowerRamping(svg: string, cornerThresholdDeg?: number, rampDist?: number): string[];
    static addPerforations(svg: string, dashLen: number, gapLen: number): string | null;
}
//# sourceMappingURL=fabrication.d.ts.map