/**
 * VECTRONOMY — 2D Affine Transform Matrix Engine
 *
 * Handles all spatial mathematics for XCS → SVG coordinate transformation.
 * Implements a full 6-component affine matrix (a, b, c, d, e, f) with
 * pivot-aware rotation and scaling operations.
 *
 * Matrix layout:
 *   | a  c  e |
 *   | b  d  f |
 *   | 0  0  1 |
 */
export declare class Transform {
    a: number;
    b: number;
    c: number;
    d: number;
    e: number;
    f: number;
    /**
     * Multiply this matrix by another: this = this × t
     * Used for composing parent → child transform chains.
     */
    multiply(t: Transform): this;
    /** Apply translation offset */
    translate(x: number, y: number): this;
    /**
     * Rotate by degrees around an optional pivot point.
     * If no pivot is specified, rotates around the current origin.
     */
    rotate(deg: number, pivotX?: number, pivotY?: number): this;
    /** Apply non-uniform scale */
    scale(sx: number, sy: number): this;
    /** Apply skew in degrees */
    skew(degX: number, degY: number): this;
    /** Transform a 2D point through this matrix */
    apply(x: number, y: number): {
        x: number;
        y: number;
    };
    /** Deep clone this transform */
    clone(): Transform;
    /** Serialize to SVG matrix() attribute */
    toSVG(): string;
    /** Check if this is an identity matrix (no transformation) */
    isIdentity(): boolean;
    /**
     * Build the correct local transform for an XCS display element.
     *
     * XCS Transform Order (Critical for accuracy):
     * 1. Translate to position (x, y)
     * 2. Translate local offsets (offsetX, offsetY)
     * 3. Rotate around element center (angle, w/2, h/2)
     * 4. Scale (scale.x, scale.y)
     * 5. Skew (skew.x, skew.y)
     */
    static fromXcsElement(el: {
        x?: number;
        y?: number;
        offsetX?: number;
        offsetY?: number;
        graphicX?: number;
        graphicY?: number;
        angle?: number;
        scale?: {
            x: number;
            y: number;
        };
        skew?: {
            x: number;
            y: number;
        };
        width?: number;
        height?: number;
        pivot?: {
            x: number;
            y: number;
        };
    }): Transform;
}
//# sourceMappingURL=transform.d.ts.map