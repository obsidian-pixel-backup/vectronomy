/**
 * VECTRONOMY — Scene Graph Builder
 *
 * Constructs a hierarchical dependency tree from the flat XCS display array.
 * Handles groupData → <g> nesting, layerData → layer containers,
 * and world transform calculation via recursive parent chain.
 */
import { Transform } from './transform';
import type { XcsCanvas, XcsDisplay, BBox } from './types';
/** Resolved element with computed world transform and styling */
export interface ResolvedElement {
    display: XcsDisplay;
    worldTransform: Transform;
    localTransform: Transform;
    rootId: string;
    layerTag: string;
    groupChain: string[];
}
/** A layer grouping resolved elements */
export interface ResolvedLayer {
    id: string;
    name: string;
    order: number;
    visible: boolean;
    color: string;
    elements: ResolvedElement[];
}
export declare class SceneGraph {
    private elementMap;
    private groupDataMap;
    private layerDataMap;
    private worldTransforms;
    private parentMap;
    readonly canvas: XcsCanvas;
    constructor(canvas: XcsCanvas);
    /**
     * Phase 1: Index all elements and groups into lookup maps.
     */
    private buildMaps;
    /**
     * Phase 2: Build parent-child relationships.
     * An element's parent is determined by its groupTag.
     * A group's parent is determined by looking for a groupData entry
     * whose children include this group.
     */
    private buildParentRelationships;
    /**
     * Get the parent ID for a given element/group ID.
     */
    private getParentId;
    /**
     * Get the root ancestor ID for a given element.
     */
    getRootId(id: string): string;
    /**
     * Phase 3: Compute world transforms for all display elements.
     *
     * World Transform = Parent World Transform × Local Transform
     *
     * Local transform is constructed from the element's own:
     *   x/offsetX, y/offsetY, angle, scale, skew
     */
    private computeAllWorldTransforms;
    /**
     * Recursively compute and cache the world transform for an element.
     */
    getWorldTransform(id: string): Transform;
    /**
     * Get the local transform for an element (without parent chain).
     */
    getLocalTransform(el: XcsDisplay): Transform;
    /**
     * Resolve all display elements into their final positioned state,
     * grouped by layer.
     */
    resolveAll(): ResolvedLayer[];
    /**
     * Calculate the total bounding box of all elements in their world positions.
     * Used for computing the SVG viewBox.
     */
    calculateBoundingBox(): BBox;
}
//# sourceMappingURL=sceneGraph.d.ts.map