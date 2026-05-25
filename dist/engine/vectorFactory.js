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
// ─── Color Utilities ─────────────────────────────────────────────
/**
 * Convert an XCS color value (integer or hex string) to CSS hex.
 * XCS stores colors as integers (e.g. 16711680 = #FF0000)
 * or as hex strings (e.g. "#ff0000").
 */
export function parseColor(value) {
    if (value === undefined || value === null)
        return 'none';
    if (typeof value === 'string') {
        if (value === '' || value === 'none')
            return 'none';
        if (value.startsWith('#') || value.startsWith('rgb'))
            return value;
        // Try parsing as integer string
        const parsed = parseInt(value, 10);
        if (!isNaN(parsed)) {
            return `#${(parsed & 0xFFFFFF).toString(16).padStart(6, '0')}`;
        }
        return value;
    }
    // Integer color → hex
    return `#${(value & 0xFFFFFF).toString(16).padStart(6, '0')}`;
}
/**
 * Resolve the complete style for an XCS display element.
 * Follows the processing type color mapping for laser operations.
 */
export function resolveStyle(el) {
    const processingType = el.processingType;
    // Manufacturing intent color overrides
    if (processingType) {
        switch (processingType) {
            case 'VECTOR_CUTTING':
            case 'VECTOR_ENGRAVING':
                return {
                    stroke: '#00ffc2',
                    strokeWidth: 1.5,
                    fill: 'none',
                    fillRule: el.fillRule || 'nonzero',
                    opacity: el.stroke?.alpha ?? 1,
                    vectorEffect: 'non-scaling-stroke',
                    strokeLinejoin: el.stroke?.join || 'round',
                    strokeLinecap: el.stroke?.cap || 'round',
                    strokeMiterlimit: el.stroke?.miterLimit || 4,
                };
            case 'FILL_VECTOR_ENGRAVE':
                return {
                    stroke: '#00ffc2',
                    strokeWidth: 1.5,
                    fill: 'rgba(0,255,194,0.1)',
                    fillRule: el.fillRule || 'nonzero',
                    opacity: el.fill?.alpha ?? 1,
                    vectorEffect: 'non-scaling-stroke',
                    strokeLinejoin: el.stroke?.join || 'round',
                    strokeLinecap: el.stroke?.cap || 'round',
                    strokeMiterlimit: el.stroke?.miterLimit || 4,
                };
        }
    }
    // Standard extraction - force unified cyan color for visibility
    const hasStroke = el.stroke?.visible ?? true;
    const hasFill = el.isFill === true || el.fill?.visible === true;
    const strokeColor = hasStroke ? '#00ffc2' : 'none';
    let fillColor = hasFill ? 'rgba(0,255,194,0.1)' : 'none';
    const strokeWidth = hasStroke ? 1.5 : 0;
    // Hatching support
    let fillUrl;
    if (el.fill?.paintType === 'hatch') {
        fillUrl = `#hatch-${el.id || Math.random().toString(36).substr(2, 9)}`;
    }
    return {
        stroke: strokeColor,
        strokeWidth,
        fill: fillColor,
        fillRule: el.fillRule || 'nonzero',
        opacity: el.stroke?.alpha ?? 1,
        vectorEffect: 'none',
        strokeLinejoin: el.stroke?.join || 'miter',
        strokeLinecap: el.stroke?.cap || 'butt',
        strokeMiterlimit: el.stroke?.miterLimit || 4,
        fillUrl,
        image: el.base64,
    };
}
/**
 * Serialize an ElementStyle into SVG attributes string.
 */
function styleToAttrs(style) {
    const parts = [];
    parts.push(`stroke="${style.stroke}"`);
    if (style.stroke !== 'none') {
        parts.push(`stroke-width="${style.strokeWidth}"`);
        if (style.vectorEffect !== 'none') {
            parts.push(`vector-effect="${style.vectorEffect}"`);
        }
    }
    if (style.fillUrl) {
        parts.push(`fill="url(${style.fillUrl})"`);
    }
    else {
        parts.push(`fill="${style.fill}"`);
    }
    if (style.fillRule !== 'nonzero') {
        parts.push(`fill-rule="${style.fillRule}"`);
    }
    if (style.opacity < 1) {
        parts.push(`opacity="${style.opacity}"`);
    }
    parts.push(`stroke-linejoin="${style.strokeLinejoin}"`);
    parts.push(`stroke-linecap="${style.strokeLinecap}"`);
    if (style.strokeMiterlimit !== undefined) {
        parts.push(`stroke-miterlimit="${style.strokeMiterlimit}"`);
    }
    return parts.join(' ');
}
// ─── Element Generators ──────────────────────────────────────────
export class VectorFactory {
    /**
     * Generate the SVG string for any display element.
     * Routes to the appropriate type-specific generator.
     */
    static generateElement(el, transform) {
        let type = el.type || (el.base64 ? 'BITMAP' : 'UNKNOWN');
        // Handle special XCS "2d" type which is often a bitmap or a complex path
        if (type === '2d') {
            if (el.base64)
                type = 'BITMAP';
            else if (el.dPath || el.points)
                type = 'PATH';
        }
        switch (type) {
            case 'PATH':
                return VectorFactory.generatePath(el, transform);
            case 'CIRCLE':
            case 'ELLIPSE':
                return VectorFactory.generateEllipse(el, transform);
            case 'RECT':
                return VectorFactory.generateRect(el, transform);
            case 'TEXT':
                return VectorFactory.generateText(el, transform);
            case 'LINE':
                return VectorFactory.generateLine(el, transform);
            case 'PEN':
                return VectorFactory.generatePen(el, transform);
            case 'BITMAP':
            case 'IMAGE':
                return VectorFactory.generateImage(el, transform);
            default:
                return `<!-- Unsupported type: ${type} (id: ${el.id}) -->`;
        }
    }
    static generatePath(el, transform) {
        let d = el.dPath || '';
        if (!d.trim())
            return '';
        // Ensure closed paths end with Z
        if (el.isClosePath && !d.trim().toUpperCase().endsWith('Z')) {
            d = d.trim() + 'Z';
        }
        const style = resolveStyle(el);
        const attrs = styleToAttrs(style);
        const transformAttr = transform.isIdentity() ? '' : ` transform="${transform.toSVG()}"`;
        const maskAttr = el.mask ? ` clip-path="url(#mask-${el.mask.id})"` : '';
        const idAttr = el.id ? ` data-xcs-id="${el.id}"` : '';
        return `<path d="${d}"${transformAttr}${maskAttr}${idAttr} ${attrs} />`;
    }
    /**
     * Internal helper to extract raw path data and style attributes for compounding.
     */
    static getPathData(el, transform) {
        let type = el.type || (el.base64 ? 'BITMAP' : 'UNKNOWN');
        if (type === '2d' && !el.base64 && (el.dPath || el.points))
            type = 'PATH';
        if (type !== 'PATH')
            return null;
        let d = el.dPath || '';
        if (!d.trim())
            return null;
        if (el.isClosePath && !d.trim().toUpperCase().endsWith('Z')) {
            d = d.trim() + 'Z';
        }
        const style = resolveStyle(el);
        return {
            d,
            attrs: styleToAttrs(style),
            transform: transform.isIdentity() ? '' : transform.toSVG()
        };
    }
    /**
     * CIRCLE/ELLIPSE: Convert width/height to rx/ry.
     * XCS circles use width = height = diameter.
     */
    static generateEllipse(el, transform) {
        const rx = (el.width || 0) / 2;
        const ry = (el.height || 0) / 2;
        const style = resolveStyle(el);
        const attrs = styleToAttrs(style);
        const transformAttr = transform.isIdentity() ? '' : ` transform="${transform.toSVG()}"`;
        const maskAttr = el.mask ? ` clip-path="url(#mask-${el.mask.id})"` : '';
        const idAttr = el.id ? ` data-xcs-id="${el.id}"` : '';
        return `<ellipse cx="${rx}" cy="${ry}" rx="${rx}" ry="${ry}"${transformAttr}${maskAttr}${idAttr} ${attrs} />`;
    }
    /**
     * RECT: Use width/height centered at origin.
     * XCS rectangles are center-origin, not top-left.
     */
    static generateRect(el, transform) {
        const w = el.width || 0;
        const h = el.height || 0;
        const style = resolveStyle(el);
        const attrs = styleToAttrs(style);
        const transformAttr = transform.isIdentity() ? '' : ` transform="${transform.toSVG()}"`;
        const rx = el.cornerRadius ?? 0;
        const ry = el.cornerRadius ?? 0;
        const rxAttr = rx > 0 ? ` rx="${rx}"` : '';
        const ryAttr = ry > 0 ? ` ry="${ry}"` : '';
        const maskAttr = el.mask ? ` clip-path="url(#mask-${el.mask.id})"` : '';
        const idAttr = el.id ? ` data-xcs-id="${el.id}"` : '';
        return `<rect x="0" y="0" width="${w}" height="${h}"${rxAttr}${ryAttr}${transformAttr}${maskAttr}${idAttr} ${attrs} />`;
    }
    /**
     * LINE: Simple two-point line element.
     */
    static generateLine(el, transform) {
        const w = el.width || 0;
        const transformAttr = transform.isIdentity() ? '' : ` transform="${transform.toSVG()}"`;
        const idAttr = el.id ? ` data-xcs-id="${el.id}"` : '';
        const style = resolveStyle(el);
        const attrs = styleToAttrs(style);
        return `<line x1="0" y1="0" x2="${w}" y2="0"${transformAttr}${idAttr} ${attrs} />`;
    }
    /**
     * TEXT: Flatten charJSONs into individual <path> elements.
     *
     * CRITICAL: XCS text MUST be converted to geometric paths, not <text> tags.
     * This preserves exact physical shapes for laser fabrication.
     * Each glyph in charJSONs[] has its own dPath and local transform.
     */
    static generateText(el, transform) {
        const style = resolveStyle(el);
        const attrs = styleToAttrs(style);
        const transformAttr = ` transform="${transform.toSVG()}"`;
        // Primary: Use charJSONs for per-glyph path data
        if (el.charJSONs && Array.isArray(el.charJSONs) && el.charJSONs.length > 0) {
            const glyphPaths = el.charJSONs
                .map((char) => VectorFactory.generateCharPath(char, el))
                .filter((s) => s.length > 0);
            if (glyphPaths.length > 0) {
                // Use a group for the text block. Note: we don't apply the parent transform 
                // to the group if the characters already have world coordinates.
                // In XCS, charJSON coordinates are typically block-relative OR world-relative.
                // We assume world-relative if they are close to the parent.
                const idAttr = el.id ? ` data-xcs-id="${el.id}"` : '';
                return `<g id="text-${el.id || ''}"${idAttr} ${attrs}>\n${glyphPaths.join('\n')}\n</g>`;
            }
        }
        // Fallback 1: Use fontData.glyphData if charJSONs not available
        if (el.fontData?.glyphData) {
            const glyphs = el.fontData.glyphData;
            const paths = [];
            let cursorX = 0;
            for (const [, glyph] of Object.entries(glyphs)) {
                if (glyph.dPath) {
                    const charTransform = new Transform().translate(cursorX, 0);
                    paths.push(`<path d="${glyph.dPath}" transform="${charTransform.toSVG()}" />`);
                    cursorX += glyph.advanceWidth || 0;
                }
            }
            if (paths.length > 0) {
                return `<g${transformAttr} ${attrs}>\n${paths.join('\n')}\n</g>`;
            }
        }
        // Fallback 2: Standard SVG <text> tag (for software that supports it)
        if (el.text) {
            const fontSize = (el.style?.fontSize || 10) * 0.2818;
            const fontFamily = el.style?.fontFamily || 'Arial';
            return `<text x="0" y="0" font-family="${fontFamily}" font-size="${fontSize}" dominant-baseline="mathematical"${transformAttr} ${attrs}>${el.text}</text>`;
        }
        return '';
    }
    /**
     * Generate a single character/glyph path from charJSON data.
     * Each charJSON element has its own position, scale, and path.
     */
    static generateCharPath(char, parent) {
        const d = char.dPath || char.glyphData || '';
        if (!d.trim())
            return '';
        // Each glyph can have its own style in XCS
        const charStyle = resolveStyle(char);
        const charAttrs = styleToAttrs(charStyle);
        // Build the character's local transform
        // Apply standard XCS -> SVG font scale factor (0.2818)
        const fontScale = 0.2818;
        const scale = char.scale ? { x: char.scale.x * fontScale, y: char.scale.y * fontScale } : { x: fontScale, y: fontScale };
        const charTransform = Transform.fromXcsElement({
            x: char.graphicX ?? char.x ?? char.offsetX ?? char.dx,
            y: char.graphicY ?? char.y ?? char.offsetY ?? char.dy,
            angle: char.angle,
            scale: scale,
            skew: char.skew,
            pivot: char.pivot,
        });
        let pathD = d;
        if (char.isClosePath && !pathD.trim().toUpperCase().endsWith('Z')) {
            pathD = pathD.trim() + 'Z';
        }
        return `<path d="${pathD}" transform="${charTransform.toSVG()}" ${charAttrs} />`;
    }
    /**
     * PEN: Construct SVG d-string from points[] and controlPoints[].
     *
     * Algorithm:
     * - M for initial move-to
     * - L for straight line segments (no control points)
     * - Q for quadratic bezier (1 control point)
     * - C for cubic bezier (2 control points)
     */
    static generatePen(el, transform) {
        const points = el.points || [];
        if (points.length === 0) {
            // Fallback: if dPath exists, treat as PATH
            if (el.dPath)
                return VectorFactory.generatePath(el, transform);
            return '';
        }
        const controlPoints = el.controlPoints || [];
        let d = '';
        for (let i = 0; i < points.length; i++) {
            const pt = points[i];
            if (i === 0) {
                d += `M${pt.x},${pt.y}`;
                continue;
            }
            // Check if there are control points for this segment
            // Control points are indexed per-segment, typically 2 per segment for cubic
            const cpIndex = (i - 1) * 2;
            const cp1 = controlPoints[cpIndex];
            const cp2 = controlPoints[cpIndex + 1];
            if (cp1 && cp2) {
                // Cubic bezier (C)
                d += ` C${cp1.x},${cp1.y} ${cp2.x},${cp2.y} ${pt.x},${pt.y}`;
            }
            else if (cp1) {
                // Quadratic bezier (Q)
                d += ` Q${cp1.x},${cp1.y} ${pt.x},${pt.y}`;
            }
            else {
                // Straight line (L)
                d += ` L${pt.x},${pt.y}`;
            }
        }
        if (el.isClosePath) {
            d += 'Z';
        }
        const style = resolveStyle(el);
        const attrs = styleToAttrs(style);
        const transformAttr = transform.isIdentity() ? '' : ` transform="${transform.toSVG()}"`;
        const maskAttr = el.mask ? ` clip-path="url(#mask-${el.mask.id})"` : '';
        return `<path d="${d}"${transformAttr}${maskAttr} ${attrs} />`;
    }
    /**
     * CLIP-PATH: Generate a <clipPath> definition for an element's mask.
     */
    static generateClipPath(el, id) {
        // For masking, we use the raw geometry without the style/stroke.
        // XCS masks are usually center-origin or top-left depending on type.
        const transform = Transform.fromXcsElement(el);
        const type = el.type || 'PATH';
        let inner = '';
        switch (type) {
            case 'PATH':
                inner = `<path d="${el.dPath || ''}" />`;
                break;
            case 'CIRCLE':
            case 'ELLIPSE':
                const rx = (el.width || 0) / 2;
                const ry = (el.height || 0) / 2;
                inner = `<ellipse cx="${rx}" cy="${ry}" rx="${rx}" ry="${ry}" />`;
                break;
            case 'RECT':
                inner = `<rect x="0" y="0" width="${el.width || 0}" height="${el.height || 0}" />`;
                break;
            default:
                if (el.dPath)
                    inner = `<path d="${el.dPath}" />`;
                break;
        }
        const tAttr = transform.isIdentity() ? '' : ` transform="${transform.toSVG()}"`;
        return `    <clipPath id="${id}">\n      <g${tAttr}>${inner}</g>\n    </clipPath>`;
    }
    static generateImage(el, transform) {
        const w = el.width || el.originWidth || 0;
        const h = el.height || el.originHeight || 0;
        const href = el.base64 || el.image || '';
        if (!href)
            return '';
        // If width/height are still zero, the image won't render. 
        // We try to use graphicX/Y as fallback positioning if transform is simple.
        let finalTransform = transform;
        if (transform.isIdentity() && el.graphicX !== undefined && el.graphicY !== undefined) {
            finalTransform = new Transform().translate(el.graphicX, el.graphicY);
        }
        const transformAttr = transform.isIdentity() ? '' : ` transform="${transform.toSVG()}"`;
        const maskAttr = el.mask ? ` clip-path="url(#mask-${el.mask.id})"` : '';
        const idAttr = el.id ? ` data-xcs-id="${el.id}"` : '';
        const style = resolveStyle(el);
        const opacity = style.opacity ?? 1;
        const opacityAttr = opacity < 1 ? ` opacity="${opacity}"` : '';
        // Standard XCS bitmaps use top-left (0,0) with transform offset.
        const x = 0;
        const y = 0;
        return `<image x="${x}" y="${y}" width="${w}" height="${h}" href="${href}"${transformAttr}${maskAttr}${idAttr}${opacityAttr} />`;
    }
}
//# sourceMappingURL=vectorFactory.js.map