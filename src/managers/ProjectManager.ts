import type { ConvertedLayer } from '../engine/types';

export class ProjectManager {
  /**
   * Serializes the current workspace state (layers) into a JSON string
   * and triggers a download of a .vectronomy file.
   */
  public exportProject(layers: ConvertedLayer[]): void {
    if (!layers || layers.length === 0) return;
    
    const bundledData = {
      version: '1.0',
      timestamp: Date.now(),
      layers: layers
    };

    const blob = new Blob([JSON.stringify(bundledData)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `project_${Date.now()}.vectronomy`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Imports a .vectronomy file (JSON) and returns the layers.
   */
  public importProject(file: File): Promise<ConvertedLayer[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const parsed = JSON.parse(content);
          
          if (parsed.layers) {
            resolve(parsed.layers);
          } else {
            reject('Invalid .vectronomy file format');
          }
        } catch (err) {
          console.error("Failed to parse .vectronomy project file:", err);
          reject(err);
        }
      };
      reader.onerror = () => reject('File read error');
      reader.readAsText(file);
    });
  }
}
