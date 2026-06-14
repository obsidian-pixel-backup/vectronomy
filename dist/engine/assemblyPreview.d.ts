export declare class AssemblyPreviewEngine {
    private container;
    private scene;
    private camera;
    private renderer;
    private assemblyGroup;
    private animationId;
    constructor(containerId: string);
    private onWindowResize;
    private animate;
    destroy(): void;
    clear(): void;
    addSvgExtrusions(svgs: string[], thickness: number, materialType?: 'wood' | 'acrylic'): void;
    private extrudeShape;
    private createThreeShapesFromCompoundPath;
    private createThreeShapeFromPath;
    private createThreePathFromPaperPath;
    private buildThreePath;
    private findPath;
}
//# sourceMappingURL=assemblyPreview.d.ts.map