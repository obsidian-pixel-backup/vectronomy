/**
 * VECTRONOMY — Scene Graph Builder
 *
 * Constructs a hierarchical dependency tree from the flat XCS display array.
 * Handles groupData → <g> nesting, layerData → layer containers,
 * and world transform calculation via recursive parent chain.
 */
import { Transform } from './transform';
export class SceneGraph {
    constructor(canvas) {
        this.elementMap = new Map();
        this.groupDataMap = new Map();
        this.layerDataMap = new Map();
        this.worldTransforms = new Map();
        this.parentMap = new Map(); // childId → parentId
        this.canvas = canvas;
        this.buildMaps();
        this.buildParentRelationships();
        this.computeAllWorldTransforms();
    }
    /**
     * Phase 1: Index all elements and groups into lookup maps.
     */
    buildMaps() {
        const { groupData = {}, layerData = {}, displays = [] } = this.canvas;
        // Index group metadata
        for (const [tag, data] of Object.entries(groupData)) {
            this.groupDataMap.set(tag, { ...data, groupTag: tag });
        }
        // Index layer metadata
        for (const [tag, data] of Object.entries(layerData)) {
            this.layerDataMap.set(tag, data);
        }
        // Index display elements
        for (let i = 0; i < displays.length; i++) {
            const el = displays[i];
            if (!el.id) {
                el.id = `auto-gen-${i}`;
            }
            this.elementMap.set(el.id, el);
        }
    }
    /**
     * Phase 2: Build parent-child relationships.
     * An element's parent is determined by its groupTag.
     * A group's parent is determined by looking for a groupData entry
     * whose children include this group.
     */
    buildParentRelationships() {
        const { groupData = {}, displays = [] } = this.canvas;
        // 1. Relationships from display elements to their parent groups
        for (const el of displays) {
            if (!el.id || !el.groupTag)
                continue;
            const parentId = el.groupTag;
            if (parentId !== el.id) {
                if (this.groupDataMap.has(parentId) || this.elementMap.has(parentId)) {
                    this.parentMap.set(el.id, parentId);
                }
            }
        }
        // 2. Relationships between nested groups
        for (const [tag, data] of Object.entries(groupData)) {
            const parentId = data.parentGroupTag;
            if (parentId && parentId !== tag) {
                if (this.groupDataMap.has(parentId)) {
                    this.parentMap.set(tag, parentId);
                }
            }
        }
    }
    /**
     * Get the parent ID for a given element/group ID.
     */
    getParentId(id) {
        return this.parentMap.get(id);
    }
    /**
     * Get the root ancestor ID for a given element.
     */
    getRootId(id) {
        let currentId = id;
        const visited = new Set();
        while (true) {
            const parentId = this.getParentId(currentId);
            if (!parentId || visited.has(parentId))
                break;
            visited.add(parentId);
            currentId = parentId;
        }
        return currentId;
    }
    /**
     * Phase 3: Compute world transforms for all display elements.
     *
     * World Transform = Parent World Transform × Local Transform
     *
     * Local transform is constructed from the element's own:
     *   x/offsetX, y/offsetY, angle, scale, skew
     */
    computeAllWorldTransforms() {
        const displays = this.canvas.displays || [];
        for (const el of displays) {
            if (el.id) {
                this.getWorldTransform(el.id);
            }
        }
    }
    /**
     * Recursively compute and cache the world transform for an element.
     */
    getWorldTransform(id) {
        if (this.worldTransforms.has(id)) {
            return this.worldTransforms.get(id);
        }
        // Get the element (from displays or groupData)
        const el = this.elementMap.get(id);
        const groupData = this.groupDataMap.get(id);
        // Build local transform
        let local;
        if (el) {
            local = Transform.fromXcsElement(el);
        }
        else if (groupData) {
            local = Transform.fromXcsElement(groupData);
        }
        else {
            local = new Transform();
        }
        // Check for parent
        const parentId = this.getParentId(id);
        if (parentId) {
            const parentWorld = this.getWorldTransform(parentId);
            const world = parentWorld.clone().multiply(local);
            this.worldTransforms.set(id, world);
            return world;
        }
        // No parent — local IS world
        this.worldTransforms.set(id, local);
        return local;
    }
    /**
     * Get the local transform for an element (without parent chain).
     */
    getLocalTransform(el) {
        return Transform.fromXcsElement(el);
    }
    /**
     * Resolve all display elements into their final positioned state,
     * grouped by layer.
     */
    resolveAll() {
        const displays = this.canvas.displays || [];
        const layerMap = new Map();
        // Sort by zOrder for proper stacking
        const sorted = [...displays]
            .filter((el) => {
            const hasGeometry = el.dPath || (el.width && el.height) || el.points || el.text || el.base64 || (el.charJSONs && el.charJSONs.length > 0);
            return hasGeometry;
        })
            .sort((a, b) => (a.zOrder ?? 0) - (b.zOrder ?? 0));
        for (const el of sorted) {
            if (!el.visible)
                continue;
            const layerTag = el.layerTag || '_default';
            const worldTransform = this.getWorldTransform(el.id);
            const localTransform = this.getLocalTransform(el);
            const rootId = this.getRootId(el.id);
            // Build group chain
            const groupChain = [];
            let current = el.id;
            const visited = new Set();
            while (true) {
                const parent = this.getParentId(current);
                if (!parent || visited.has(parent))
                    break;
                groupChain.unshift(parent);
                visited.add(parent);
                current = parent;
            }
            const resolved = {
                display: el,
                worldTransform,
                localTransform,
                rootId,
                layerTag,
                groupChain,
            };
            if (!layerMap.has(layerTag)) {
                layerMap.set(layerTag, []);
            }
            layerMap.get(layerTag).push(resolved);
        }
        // Build layer output sorted by layerData order
        const layers = [];
        for (const [tag, elements] of layerMap.entries()) {
            const layerInfo = this.layerDataMap.get(tag);
            layers.push({
                id: tag,
                name: layerInfo?.name || tag,
                order: layerInfo?.order ?? 999,
                visible: layerInfo?.visible ?? true,
                color: tag,
                elements,
            });
        }
        layers.sort((a, b) => a.order - b.order);
        return layers;
    }
    /**
     * Calculate the total bounding box of all elements in their world positions.
     * Used for computing the SVG viewBox.
     */
    calculateBoundingBox() {
        const displays = this.canvas.displays || [];
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        const expandBounds = (p) => {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
        };
        for (const el of displays) {
            // Use the same inclusivity logic as resolveAll
            const hasGeometry = el.dPath || (el.width && el.height) || el.points || el.text || (el.charJSONs && el.charJSONs.length > 0);
            if (!hasGeometry || !el.visible)
                continue;
            const wt = this.getWorldTransform(el.id);
            const w = el.width || el.originWidth || 0;
            const h = el.height || el.originHeight || 0;
            if (el.charJSONs && Array.isArray(el.charJSONs) && el.charJSONs.length > 0) {
                // Expand bounds based on individual character glyphs
                for (const char of el.charJSONs) {
                    const cw = char.width || 0;
                    const ch = char.height || 0;
                    // Note: we'd ideally use char.graphicX/Y here too if we were being perfectly precise
                    // but el.width/height is usually a safe box.
                    const charWt = wt.clone().multiply(Transform.fromXcsElement(char));
                    const chw = cw / 2, chh = ch / 2;
                    expandBounds(charWt.apply(-chw, -chh));
                    expandBounds(charWt.apply(chw, -chh));
                    expandBounds(charWt.apply(chw, chh));
                    expandBounds(charWt.apply(-chw, chh));
                }
            }
            else if (el.dPath) {
                const nums = el.dPath.match(/-?\d+(\.\d+)?/g);
                if (nums && nums.length >= 2) {
                    let pMinX = Infinity, pMinY = Infinity, pMaxX = -Infinity, pMaxY = -Infinity;
                    for (let i = 0; i < nums.length; i += 2) {
                        const x = parseFloat(nums[i]);
                        const y = parseFloat(nums[i + 1] || nums[i]);
                        if (!isNaN(x)) {
                            if (x < pMinX)
                                pMinX = x;
                            if (x > pMaxX)
                                pMaxX = x;
                        }
                        if (!isNaN(y)) {
                            if (y < pMinY)
                                pMinY = y;
                            if (y > pMaxY)
                                pMaxY = y;
                        }
                    }
                    if (pMinX !== Infinity) {
                        expandBounds(wt.apply(pMinX, pMinY));
                        expandBounds(wt.apply(pMaxX, pMinY));
                        expandBounds(wt.apply(pMaxX, pMaxY));
                        expandBounds(wt.apply(pMinX, pMaxY));
                    }
                    else {
                        expandBounds(wt.apply(0, 0));
                    }
                }
                else {
                    expandBounds(wt.apply(0, 0));
                }
            }
            else if (w > 0 || h > 0) {
                // Transform all 4 corners of the element's bounding rect
                const hw = w / 2, hh = h / 2;
                expandBounds(wt.apply(-hw, -hh));
                expandBounds(wt.apply(hw, -hh));
                expandBounds(wt.apply(hw, hh));
                expandBounds(wt.apply(-hw, hh));
            }
            else {
                // Fallback for elements with position but no size
                expandBounds(wt.apply(0, 0));
            }
        }
        if (minX === Infinity) {
            return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
        }
        return {
            minX,
            minY,
            maxX,
            maxY,
            width: maxX - minX,
            height: maxY - minY,
        };
    }
}
//# sourceMappingURL=sceneGraph.js.map