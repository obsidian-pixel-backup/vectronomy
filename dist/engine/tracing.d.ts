export declare class TracingEngine {
    static init(): void;
    static getImageData(url: string): Promise<ImageData>;
    private static traceBinary;
    private static traceContour;
    static traceSilhouette(imageData: ImageData, threshold?: number, cornerThreshold?: number): Promise<string>;
    static traceEdges(imageData: ImageData, threshold?: number, cornerThreshold?: number): Promise<string>;
    static despeckle(svg: string, minArea: number): string;
    static traceCenterline(imageData: ImageData, cornerThreshold?: number): Promise<string>;
    static tracePosterized(imageData: ImageData, colors?: number, cornerThreshold?: number): Promise<string>;
    static traceColorIsolation(imageData: ImageData, targetColorHex: string, tolerance?: number, cornerThreshold?: number): Promise<string>;
    static traceHalftone(imageData: ImageData, dotSpacing?: number, angle?: number): Promise<string>;
}
//# sourceMappingURL=tracing.d.ts.map