import type { ConvertedLayer } from '../engine/types';
export declare class ProjectManager {
    /**
     * Serializes the current workspace state (layers) into a JSON string
     * and triggers a download of a .vectronomy file.
     */
    exportProject(layers: ConvertedLayer[]): void;
    /**
     * Imports a .vectronomy file (JSON) and returns the layers.
     */
    importProject(file: File): Promise<ConvertedLayer[]>;
}
//# sourceMappingURL=ProjectManager.d.ts.map