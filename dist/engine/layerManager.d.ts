import { VectorEditor } from './editor';
export declare class LayerManager {
    private editor;
    private container;
    private treeContainer;
    private groupColors;
    constructor(editor: VectorEditor);
    private initButtons;
    updateTree(): void;
    private getIconForTag;
    groupSelected(): void;
    ungroupSelected(): void;
}
//# sourceMappingURL=layerManager.d.ts.map