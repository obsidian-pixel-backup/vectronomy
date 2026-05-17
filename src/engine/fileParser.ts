/**
 * VECTRONOMY — File Parser Module
 * 
 * Handles the extraction and normalization of XCS file data.
 * XCS files are ZIP archives containing canvas.json or project.json.
 * Falls back to raw JSON parsing for pasted/raw content.
 */

import JSZip from 'jszip';
import type { XcsFile, XcsCanvas } from './types';

export class FileParser {
  /**
   * Parse an XCS file (File object from browser input).
   * Attempts ZIP extraction first, then falls back to raw JSON.
   */
  static async parseFile(file: File): Promise<XcsCanvas[]> {
    let jsonData: XcsFile | null = null;

    // Attempt 1: ZIP extraction
    try {
      const zip = await JSZip.loadAsync(file);
      const canvasFile = zip.file('canvas.json') || zip.file('project.json');
      if (canvasFile) {
        const content = await canvasFile.async('text');
        jsonData = JSON.parse(content);
      }
    } catch (_) {
      // Not a valid ZIP — try raw JSON
    }

    // Attempt 2: Raw JSON parsing
    if (!jsonData) {
      try {
        const text = await file.text();
        jsonData = JSON.parse(text);
      } catch (_) {
        throw new Error(
          'Invalid file format: could not parse as ZIP archive or JSON.'
        );
      }
    }

    return FileParser.extractCanvases(jsonData!);
  }

  /**
   * Parse raw JSON string directly (for clipboard/paste input).
   */
  static parseJSON(jsonString: string): XcsCanvas[] {
    let jsonData: XcsFile;
    try {
      jsonData = JSON.parse(jsonString);
    } catch (_) {
      throw new Error('Invalid JSON: could not parse input string.');
    }
    return FileParser.extractCanvases(jsonData);
  }

  /**
   * Parse an ArrayBuffer (for programmatic input).
   */
  static async parseBuffer(buffer: ArrayBuffer): Promise<XcsCanvas[]> {
    let jsonData: XcsFile | null = null;

    // Attempt ZIP extraction
    try {
      const zip = await JSZip.loadAsync(buffer);
      const canvasFile = zip.file('canvas.json') || zip.file('project.json');
      if (canvasFile) {
        const content = await canvasFile.async('text');
        jsonData = JSON.parse(content);
      }
    } catch (_) {
      // Not a valid ZIP
    }

    // Fallback to raw JSON
    if (!jsonData) {
      try {
        const decoder = new TextDecoder('utf-8');
        const text = decoder.decode(buffer);
        jsonData = JSON.parse(text);
      } catch (_) {
        throw new Error('Invalid buffer: could not parse as ZIP or JSON.');
      }
    }

    return FileParser.extractCanvases(jsonData!);
  }

  /**
   * Extract and normalize canvas array from parsed XCS data.
   * Handles multiple JSON structures:
   *   { canvas: [...] }
   *   { project: { canvas: [...] } }
   */
  private static extractCanvases(data: XcsFile): XcsCanvas[] {
    const canvases: XcsCanvas[] =
      data.canvas ||
      data.project?.canvas ||
      [];

    if (!Array.isArray(canvases) || canvases.length === 0) {
      throw new Error(
        'No canvas data found in XCS file. Expected canvas[] array.'
      );
    }

    // Filter out empty canvases
    return canvases.filter(
      (c) => c.displays && Array.isArray(c.displays) && c.displays.length > 0
    );
  }
}
