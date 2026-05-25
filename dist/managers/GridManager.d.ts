export declare class GridManager {
    private showGrid;
    snapEnabled: boolean;
    private unit;
    private pixelsPerMm;
    private pixelsPerInch;
    constructor();
    get gridSize(): number;
    snapPoint(pt: paper.Point): paper.Point;
    private initSettings;
    toggleSnap(force?: boolean): void;
    toggleGrid(force?: boolean): void;
    renderGrid(): void;
}
//# sourceMappingURL=GridManager.d.ts.map