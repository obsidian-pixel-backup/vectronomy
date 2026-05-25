/**
 * VECTRONOMY — File Parser Module
 *
 * Handles the extraction and normalization of XCS file data.
 * XCS files are ZIP archives containing canvas.json or project.json.
 * Falls back to raw JSON parsing for pasted/raw content.
 */
import type { XcsCanvas } from './types';
export declare class FileParser {
    /**
     * Parse an XCS file (File object from browser input).
     * Attempts ZIP extraction first, then falls back to raw JSON.
     */
    static parseFile(file: File): Promise<XcsCanvas[]>;
    /**
     * Parse raw JSON string directly (for clipboard/paste input).
     */
    static parseJSON(jsonString: string): XcsCanvas[];
    /**
     * Parse an ArrayBuffer (for programmatic input).
     */
    static parseBuffer(buffer: ArrayBuffer): Promise<XcsCanvas[]>;
    /**
     * Extract and normalize canvas array from parsed XCS data.
     * Handles multiple JSON structures:
     *   { canvas: [...] }
     *   { project: { canvas: [...] } }
     */
    private static extractCanvases;
}
//# sourceMappingURL=fileParser.d.ts.map