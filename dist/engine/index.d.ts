/**
 * VECTRONOMY — XCS to SVG Conversion Engine
 *
 * Main entry point that orchestrates the full conversion pipeline:
 *
 *   XCS File → Parse → Scene Graph → Vector Factory → Output Compiler → [Path Healer] → SVG
 *
 * Usage:
 *   import { XcsConverter } from './engine';
 *
 *   // From file input
 *   const layers = await XcsConverter.convertFile(file);
 *
 *   // From raw JSON string
 *   const layers = XcsConverter.convertJSON(jsonString);
 *
 *   // With path healing
 *   const healedLayers = await XcsConverter.convertFile(file, { heal: true });
 */
export { Transform } from './transform';
export { FileParser } from './fileParser';
export { SceneGraph } from './sceneGraph';
export { VectorFactory, parseColor, resolveStyle } from './vectorFactory';
export { OutputCompiler } from './outputCompiler';
export { PathHealer } from './pathHealer';
export { PrecisionEngine } from './precision';
export { SimulationEngine } from './simulation';
export type { Guideline, PrecisionOptions } from './precision';
export type * from './types';
import { CompilerOptions } from './outputCompiler';
import { HealingOptions } from './pathHealer';
import type { ConvertedLayer } from './types';
export interface ConversionOptions extends CompilerOptions {
    /** Enable path healing (default: false — requires Paper.js / DOM) */
    heal?: boolean;
    /** Path healing options */
    healingOptions?: HealingOptions;
}
export declare class XcsConverter {
    /**
     * Convert an XCS File object to SVG layers.
     */
    static convertFile(file: File, options?: ConversionOptions): Promise<ConvertedLayer[]>;
    /**
     * Convert a raw JSON string to SVG layers.
     */
    static convertJSON(jsonString: string, options?: ConversionOptions): ConvertedLayer[];
    /**
     * Convert a JSON string and optionally heal paths.
     */
    static convertJSONAsync(jsonString: string, options?: ConversionOptions): Promise<ConvertedLayer[]>;
    /**
     * Convert an ArrayBuffer to SVG layers.
     */
    static convertBuffer(buffer: ArrayBuffer, options?: ConversionOptions): Promise<ConvertedLayer[]>;
    /**
     * Apply path healing to all layers.
     */
    private static healLayers;
}
//# sourceMappingURL=index.d.ts.map