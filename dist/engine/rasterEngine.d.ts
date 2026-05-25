/**
 * VECTRONOMY — Raster Engine
 *
 * Handles pixel manipulation, brushes, eraser, and image adjustments
 * (brightness, contrast, blur) directly on raster `<image>` SVG elements.
 */
export declare class RasterEngine {
    private offscreenCanvas;
    private ctx;
    private currentImageEl;
    private isDrawing;
    private lastX;
    private lastY;
    constructor();
    /** Load an SVGImageElement into the raster engine for editing */
    editImage(imgEl: SVGImageElement): Promise<void>;
    /** Apply Photoshop-style filters */
    applyFilters(brightness: number, contrast: number, blur: number): void;
    /** Start a brush or eraser stroke */
    startStroke(x: number, y: number): void;
    /** Continue a brush or eraser stroke */
    continueStroke(x: number, y: number, mode: 'brush' | 'eraser', color: string, size: number): void;
    /** End a brush or eraser stroke */
    endStroke(): void;
    /** Converts SVG coordinate to image-local pixel coordinate */
    private globalToLocal;
    /** Updates the SVG <image> tag with the new canvas data */
    private commitToSvg;
}
//# sourceMappingURL=rasterEngine.d.ts.map