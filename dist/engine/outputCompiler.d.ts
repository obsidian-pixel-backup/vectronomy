/**
 * VECTRONOMY — Output Compiler Module
 *
 * Assembles all resolved elements into finalized SVG documents.
 * Handles layer grouping, viewBox calculation, DPI normalization,
 * and proper SVG namespace output.
 */
import type { XcsCanvas, ConvertedLayer } from './types';
export interface CompilerOptions {
    /** Target DPI for output dimensions (default: 96) */
    targetDpi?: number;
    /** Add padding around the viewBox in user units (default: 5) */
    viewBoxPadding?: number;
    /** Include layer visibility attribute (default: true) */
    respectLayerVisibility?: boolean;
    /** Include metadata comments in output (default: false) */
    includeMetadata?: boolean;
    /** Output physical dimensions in mm (default: true) */
    usePhysicalUnits?: boolean;
}
export declare class OutputCompiler {
    /**
     * Compile a single XCS canvas into an array of converted SVG layers.
     * Each layer contains its own complete SVG document.
     */
    static compileCanvas(canvas: XcsCanvas, options?: CompilerOptions): ConvertedLayer[];
    /**
     * Compile all canvases from an XCS file.
     */
    static compileAll(canvases: XcsCanvas[], options?: CompilerOptions): ConvertedLayer[];
    /**
     * Generate a combined SVG with all layers as <g> groups.
     */
    private static generateCombinedSvg;
    /**
     * Generate an individual layer SVG document.
     */
    private static generateLayerSvg;
    /**
     * Render all elements in a layer, grouped by their root clusters.
     * Elements sharing the same root ancestor are wrapped in a single <g>.
     */
    private static renderLayerElements;
    /**
     * Generate <defs> containing <pattern> elements for any hatching fills used.
     */
    private static generateDefs;
    /**
     * Compute SVG width/height attributes with DPI normalization.
     */
    private static computeDimensions;
    /**
     * Format canvas title, replacing {panel} placeholder.
     */
    private static formatCanvasTitle;
    /**
     * Sanitize an ID for use in SVG attributes.
     */
    private static sanitizeId;
    /**
     * Escape XML special characters.
     */
    private static escapeXml;
}
//# sourceMappingURL=outputCompiler.d.ts.map