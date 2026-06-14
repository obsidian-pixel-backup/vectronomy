export interface NestingOptions {
    sheetWidth: number;
    sheetHeight: number;
    margin: number;
    allowRotation: boolean;
    exactShape: boolean;
    resolution: number;
}
export declare class NestingEngine {
    static init(): void;
    static nestPaths(svgs: string[], options: NestingOptions): string[];
    private static findPath;
}
//# sourceMappingURL=nesting.d.ts.map