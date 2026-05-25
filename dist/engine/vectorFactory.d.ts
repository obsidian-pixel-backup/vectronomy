/**
 * VECTRONOMY — Vector Factory Module
 *
 * Translates proprietary XCS display elements into raw SVG element strings.
 * Handles all element types: PATH, CIRCLE, ELLIPSE, RECT, TEXT, LINE, PEN.
 *
 * Key responsibilities:
 * - Integer color → hex string conversion
 * - Processing type → stroke/fill color mapping
 * - charJSONs text flattening into <path> elements
 * - PEN points/controlPoints → SVG d-string construction
 */
import { Transform } from './transform';
import type { XcsDisplay, ElementStyle } from './types';
/**
 * Convert an XCS color value (integer or hex string) to CSS hex.
 * XCS stores colors as integers (e.g. 16711680 = #FF0000)
 * or as hex strings (e.g. "#ff0000").
 */
export declare function parseColor(value: string | number | undefined | null): string;
/**
 * Resolve the complete style for an XCS display element.
 * Follows the processing type color mapping for laser operations.
 */
export declare function resolveStyle(el: XcsDisplay): ElementStyle;
export declare class VectorFactory {
    /**
     * Generate the SVG string for any display element.
     * Routes to the appropriate type-specific generator.
     */
    static generateElement(el: XcsDisplay, transform: Transform): string;
    static generatePath(el: XcsDisplay, transform: Transform): string;
    /**
     * Internal helper to extract raw path data and style attributes for compounding.
     */
    static getPathData(el: XcsDisplay, transform: Transform): {
        d: string;
        attrs: string;
        transform: string;
    } | null;
    /**
     * CIRCLE/ELLIPSE: Convert width/height to rx/ry.
     * XCS circles use width = height = diameter.
     */
    static generateEllipse(el: XcsDisplay, transform: Transform): string;
    /**
     * RECT: Use width/height centered at origin.
     * XCS rectangles are center-origin, not top-left.
     */
    static generateRect(el: XcsDisplay, transform: Transform): string;
    /**
     * LINE: Simple two-point line element.
     */
    static generateLine(el: XcsDisplay, transform: Transform): string;
    /**
     * TEXT: Flatten charJSONs into individual <path> elements.
     *
     * CRITICAL: XCS text MUST be converted to geometric paths, not <text> tags.
     * This preserves exact physical shapes for laser fabrication.
     * Each glyph in charJSONs[] has its own dPath and local transform.
     */
    static generateText(el: XcsDisplay, transform: Transform): string;
    /**
     * Generate a single character/glyph path from charJSON data.
     * Each charJSON element has its own position, scale, and path.
     */
    private static generateCharPath;
    /**
     * PEN: Construct SVG d-string from points[] and controlPoints[].
     *
     * Algorithm:
     * - M for initial move-to
     * - L for straight line segments (no control points)
     * - Q for quadratic bezier (1 control point)
     * - C for cubic bezier (2 control points)
     */
    static generatePen(el: XcsDisplay, transform: Transform): string;
    /**
     * CLIP-PATH: Generate a <clipPath> definition for an element's mask.
     */
    static generateClipPath(el: XcsDisplay, id: string): string;
    static generateImage(el: XcsDisplay, transform: Transform): string;
}
//# sourceMappingURL=vectorFactory.d.ts.map