/**
 * VECTRONOMY — Layout Engine
 *
 * Implements Figma-style Frames (Artboards) and Constraints.
 * A Frame is represented as an SVG <g> element that contains:
 * 1. A <rect> for background and bounds
 * 2. A <clipPath> referencing the rect to clip contents
 * 3. A sub-<g> for children
 */
export declare class LayoutEngine {
    /**
     * Wraps selected elements into a Frame by calculating their bounding box.
     */
    static createFrame(elements: SVGGraphicsElement[]): SVGGElement | null;
    /**
     * Creates a Frame at explicit bounds, encapsulating the provided elements.
     */
    static createFrameFromBounds(x: number, y: number, width: number, height: number, elements: SVGGraphicsElement[]): SVGGElement;
}
//# sourceMappingURL=layoutEngine.d.ts.map