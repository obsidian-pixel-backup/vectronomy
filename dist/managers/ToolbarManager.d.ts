import { VectorEditor } from '../engine/editor';
export declare class ToolbarManager {
    private editor;
    private updateToolOptionsUI;
    private clickHandler;
    constructor();
    init(editor: VectorEditor, updateToolOptionsUI: (tool: string) => void): void;
    destroy(): void;
    private showToast;
    private handleDocumentClick;
}
//# sourceMappingURL=ToolbarManager.d.ts.map