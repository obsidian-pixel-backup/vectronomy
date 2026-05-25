/**
 * VECTRONOMY — Layout Engine
 *
 * Implements Figma-style Frames (Artboards) and Constraints.
 * A Frame is represented as an SVG <g> element that contains:
 * 1. A <rect> for background and bounds
 * 2. A <clipPath> referencing the rect to clip contents
 * 3. A sub-<g> for children
 */
export class LayoutEngine {
    /**
     * Wraps selected elements into a Frame by calculating their bounding box.
     */
    static createFrame(elements) {
        if (elements.length === 0)
            return null;
        // Calculate bounding box of all selected elements
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        elements.forEach(el => {
            const bbox = el.getBBox();
            if (bbox.x < minX)
                minX = bbox.x;
            if (bbox.y < minY)
                minY = bbox.y;
            if (bbox.x + bbox.width > maxX)
                maxX = bbox.x + bbox.width;
            if (bbox.y + bbox.height > maxY)
                maxY = bbox.y + bbox.height;
        });
        // Add padding
        const pad = 20;
        minX -= pad;
        minY -= pad;
        const width = (maxX - minX) + pad * 2;
        const height = (maxY - minY) + pad * 2;
        return this.createFrameFromBounds(minX, minY, width, height, elements);
    }
    /**
     * Creates a Frame at explicit bounds, encapsulating the provided elements.
     */
    static createFrameFromBounds(x, y, width, height, elements) {
        const frameId = `frame-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        const clipId = `clip-${frameId}`;
        // Create Frame group
        const frame = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        frame.setAttribute('data-xcs-id', frameId);
        frame.setAttribute('class', 'vectronomy-frame');
        // Create Clip Path
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
        clipPath.setAttribute('id', clipId);
        const clipRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        clipRect.setAttribute('x', x.toString());
        clipRect.setAttribute('y', y.toString());
        clipRect.setAttribute('width', width.toString());
        clipRect.setAttribute('height', height.toString());
        clipPath.appendChild(clipRect);
        defs.appendChild(clipPath);
        // Create Background Rect
        const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        bgRect.setAttribute('x', x.toString());
        bgRect.setAttribute('y', y.toString());
        bgRect.setAttribute('width', width.toString());
        bgRect.setAttribute('height', height.toString());
        bgRect.setAttribute('fill', '#ffffff');
        bgRect.setAttribute('class', 'frame-background');
        // Content group
        const contentGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        contentGroup.setAttribute('clip-path', `url(#${clipId})`);
        // Move elements into the frame
        if (elements.length > 0) {
            const parent = elements[0].parentNode;
            if (parent) {
                parent.insertBefore(frame, elements[0]);
            }
        }
        frame.appendChild(defs);
        frame.appendChild(bgRect);
        frame.appendChild(contentGroup);
        elements.forEach(el => {
            contentGroup.appendChild(el);
        });
        return frame;
    }
}
//# sourceMappingURL=layoutEngine.js.map