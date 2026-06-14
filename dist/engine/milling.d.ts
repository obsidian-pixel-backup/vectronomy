export declare class MillingEngine {
    static init(): void;
    private static findPath;
    static applyBitOffset(svgs: string[], bitRadius: number): string[];
    static generatePocketHatch(svg: string, stepover: number, angleDeg: number): string | null;
    static generateChamfer(svg: string, totalDepth: number, bitAngle: number, passes: number): string[];
    static convertToDrill(svgs: string[], maxDiameter: number): {
        svgs: string[];
        changed: boolean[];
    };
    static applyVCarve(svg: string, bitAngle: number): string | null;
    static addHoldingTabs(svg: string, tabCount: number, tabWidth: number, tabThickness: number): string | null;
    static generateConcentricHatch(svg: string, stepover: number): string[];
}
//# sourceMappingURL=milling.d.ts.map