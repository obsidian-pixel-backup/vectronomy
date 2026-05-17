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
export type * from './types';

import { FileParser } from './fileParser';
import { OutputCompiler, CompilerOptions } from './outputCompiler';
import { PathHealer, HealingOptions } from './pathHealer';
import type { ConvertedLayer } from './types';

export interface ConversionOptions extends CompilerOptions {
  /** Enable path healing (default: false — requires Paper.js / DOM) */
  heal?: boolean;
  /** Path healing options */
  healingOptions?: HealingOptions;
}

export class XcsConverter {
  /**
   * Convert an XCS File object to SVG layers.
   */
  static async convertFile(
    file: File,
    options: ConversionOptions = {}
  ): Promise<ConvertedLayer[]> {
    const canvases = await FileParser.parseFile(file);
    const layers = OutputCompiler.compileAll(canvases, options);

    if (options.heal) {
      return XcsConverter.healLayers(layers, options.healingOptions);
    }

    return layers;
  }

  /**
   * Convert a raw JSON string to SVG layers.
   */
  static convertJSON(
    jsonString: string,
    options: ConversionOptions = {}
  ): ConvertedLayer[] {
    const canvases = FileParser.parseJSON(jsonString);
    return OutputCompiler.compileAll(canvases, options);
  }

  /**
   * Convert a JSON string and optionally heal paths.
   */
  static async convertJSONAsync(
    jsonString: string,
    options: ConversionOptions = {}
  ): Promise<ConvertedLayer[]> {
    const layers = XcsConverter.convertJSON(jsonString, options);

    if (options.heal) {
      return XcsConverter.healLayers(layers, options.healingOptions);
    }

    return layers;
  }

  /**
   * Convert an ArrayBuffer to SVG layers.
   */
  static async convertBuffer(
    buffer: ArrayBuffer,
    options: ConversionOptions = {}
  ): Promise<ConvertedLayer[]> {
    const canvases = await FileParser.parseBuffer(buffer);
    const layers = OutputCompiler.compileAll(canvases, options);

    if (options.heal) {
      return XcsConverter.healLayers(layers, options.healingOptions);
    }

    return layers;
  }

  /**
   * Apply path healing to all layers.
   */
  private static async healLayers(
    layers: ConvertedLayer[],
    options?: HealingOptions
  ): Promise<ConvertedLayer[]> {
    const healed: ConvertedLayer[] = [];

    for (const layer of layers) {
      try {
        const healedSvg = await PathHealer.heal(layer.svg, options);
        healed.push({ ...layer, svg: healedSvg });
      } catch (err) {
        // If healing fails, return original
        console.warn(`Path healing failed for layer ${layer.id}:`, err);
        healed.push(layer);
      }
    }

    return healed;
  }
}
