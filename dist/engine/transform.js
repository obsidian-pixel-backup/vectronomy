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
export class Transform {
    constructor() {
        this.a = 1;
        this.b = 0;
        this.c = 0;
        this.d = 1;
        this.e = 0;
        this.f = 0;
    }
    /**
     * Multiply this matrix by another: this = this × t
     * Used for composing parent → child transform chains.
     */
    multiply(t) {
        const a = this.a * t.a + this.c * t.b;
        const b = this.b * t.a + this.d * t.b;
        const c = this.a * t.c + this.c * t.d;
        const d = this.b * t.c + this.d * t.d;
        const e = this.a * t.e + this.c * t.f + this.e;
        const f = this.b * t.e + this.d * t.f + this.f;
        this.a = a;
        this.b = b;
        this.c = c;
        this.d = d;
        this.e = e;
        this.f = f;
        return this;
    }
    /** Apply translation offset */
    translate(x, y) {
        const t = new Transform();
        t.e = x;
        t.f = y;
        return this.multiply(t);
    }
    /**
     * Rotate by degrees around an optional pivot point.
     * If no pivot is specified, rotates around the current origin.
     */
    rotate(deg, pivotX = 0, pivotY = 0) {
        if (deg === 0)
            return this;
        if (pivotX !== 0 || pivotY !== 0) {
            this.translate(pivotX, pivotY);
        }
        const rad = (deg * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const t = new Transform();
        t.a = cos;
        t.b = sin;
        t.c = -sin;
        t.d = cos;
        this.multiply(t);
        if (pivotX !== 0 || pivotY !== 0) {
            this.translate(-pivotX, -pivotY);
        }
        return this;
    }
    /** Apply non-uniform scale */
    scale(sx, sy) {
        const t = new Transform();
        t.a = sx;
        t.d = sy;
        return this.multiply(t);
    }
    /** Apply skew in degrees */
    skew(degX, degY) {
        if (degX === 0 && degY === 0)
            return this;
        const t = new Transform();
        t.c = Math.tan((degX * Math.PI) / 180);
        t.b = Math.tan((degY * Math.PI) / 180);
        return this.multiply(t);
    }
    /** Transform a 2D point through this matrix */
    apply(x, y) {
        return {
            x: this.a * x + this.c * y + this.e,
            y: this.b * x + this.d * y + this.f,
        };
    }
    /** Deep clone this transform */
    clone() {
        const t = new Transform();
        t.a = this.a;
        t.b = this.b;
        t.c = this.c;
        t.d = this.d;
        t.e = this.e;
        t.f = this.f;
        return t;
    }
    /** Serialize to SVG matrix() attribute */
    toSVG() {
        return `matrix(${this.a},${this.b},${this.c},${this.d},${this.e},${this.f})`;
    }
    /** Check if this is an identity matrix (no transformation) */
    isIdentity() {
        return (Math.abs(this.a - 1) < 1e-10 &&
            Math.abs(this.b) < 1e-10 &&
            Math.abs(this.c) < 1e-10 &&
            Math.abs(this.d - 1) < 1e-10 &&
            Math.abs(this.e) < 1e-10 &&
            Math.abs(this.f) < 1e-10);
    }
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
    static fromXcsElement(el) {
        const t = new Transform();
        // 1. Translate to element position (prioritize raw offsets for complex paths)
        const posX = el.offsetX ?? el.graphicX ?? el.x ?? 0;
        const posY = el.offsetY ?? el.graphicY ?? el.y ?? 0;
        t.translate(posX, posY);
        // 2. Rotation around pivot (default: visual center)
        const angle = el.angle ?? 0;
        if (angle !== 0) {
            const pivotX = el.pivot?.x ?? 0;
            const pivotY = el.pivot?.y ?? 0;
            t.rotate(angle, pivotX, pivotY);
        }
        // 3. Scale
        const sx = el.scale?.x ?? 1;
        const sy = el.scale?.y ?? 1;
        if (sx !== 1 || sy !== 1) {
            t.scale(sx, sy);
        }
        // 4. Skew
        const skewX = el.skew?.x ?? 0;
        const skewY = el.skew?.y ?? 0;
        if (skewX !== 0 || skewY !== 0) {
            t.skew(skewX, skewY);
        }
        return t;
    }
}
//# sourceMappingURL=transform.js.map