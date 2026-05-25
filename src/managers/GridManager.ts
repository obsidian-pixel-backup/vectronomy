import paper from 'paper';

export class GridManager {
  private showGrid = true;
  public snapEnabled = false;
  private unit: 'mm' | 'in' = 'mm';
  
  // 1 inch = 25.4 mm. We'll treat 1 mm = 1 SVG user unit (px) for simplicity, or 1 mm = 3.7795 px.
  // Assuming 1 unit = 1mm for engineering vectors.
  private pixelsPerMm = 1; 
  private pixelsPerInch = 25.4;

  constructor() {
    this.initSettings();
  }

  public get gridSize(): number {
    return this.unit === 'mm' ? 10 * this.pixelsPerMm : 0.5 * this.pixelsPerInch; // 10mm or 0.5 inch
  }

  public snapPoint(pt: {x: number, y: number}): {x: number, y: number} {
    if (!this.snapEnabled) return pt;
    const gs = this.gridSize;
    return {
      x: Math.round(pt.x / gs) * gs,
      y: Math.round(pt.y / gs) * gs
    };
  }

  private initSettings() {
    const savedUnit = localStorage.getItem('vectronomy_unit');
    if (savedUnit === 'mm' || savedUnit === 'in') {
      this.unit = savedUnit;
    }

    const savedGrid = localStorage.getItem('vectronomy_show_grid');
    if (savedGrid !== null) {
      this.showGrid = savedGrid === 'true';
    }

    const savedSnap = localStorage.getItem('vectronomy_snap_grid');
    if (savedSnap !== null) {
      this.snapEnabled = savedSnap === 'true';
    }

    // Bind UI
    const unitSelect = document.getElementById('setting-units') as HTMLSelectElement;
    if (unitSelect) {
      unitSelect.value = this.unit;
      unitSelect.addEventListener('change', (e) => {
        this.unit = (e.target as HTMLSelectElement).value as 'mm' | 'in';
        localStorage.setItem('vectronomy_unit', this.unit);
        this.renderGrid();
      });
    }

    const gridCheck = document.getElementById('setting-show-grid') as HTMLInputElement;
    if (gridCheck) {
      gridCheck.checked = this.showGrid;
      gridCheck.addEventListener('change', (e) => {
        this.toggleGrid((e.target as HTMLInputElement).checked);
      });
    }
    
    const snapCheck = document.getElementById('setting-snap-grid') as HTMLInputElement;
    if (snapCheck) {
      snapCheck.checked = this.snapEnabled;
      snapCheck.addEventListener('change', (e) => {
        this.toggleSnap((e.target as HTMLInputElement).checked);
      });
    }

    const toggleGridBtn = document.getElementById('btn-toggle-grid');
    if (toggleGridBtn) {
      toggleGridBtn.classList.toggle('active', this.showGrid);
      toggleGridBtn.addEventListener('click', () => {
        this.toggleGrid(!this.showGrid); 
      });
    }

    const toggleSnapBtn = document.getElementById('btn-toggle-snap');
    if (toggleSnapBtn) {
      toggleSnapBtn.classList.toggle('active', this.snapEnabled);
      toggleSnapBtn.addEventListener('click', () => {
        this.toggleSnap(!this.snapEnabled);
      });
    }
  }

  public toggleSnap(force?: boolean) {
    this.snapEnabled = force !== undefined ? force : !this.snapEnabled;
    localStorage.setItem('vectronomy_snap_grid', this.snapEnabled.toString());
    
    const snapCheck = document.getElementById('setting-snap-grid') as HTMLInputElement;
    if (snapCheck) snapCheck.checked = this.snapEnabled;

    const toggleSnapBtn = document.getElementById('btn-toggle-snap');
    if (toggleSnapBtn) {
      toggleSnapBtn.classList.toggle('active', this.snapEnabled);
    }
  }

  public toggleGrid(force?: boolean) {
    this.showGrid = force !== undefined ? force : !this.showGrid;
    localStorage.setItem('vectronomy_show_grid', this.showGrid.toString());
    
    const gridCheck = document.getElementById('setting-show-grid') as HTMLInputElement;
    if (gridCheck) gridCheck.checked = this.showGrid;
    
    const toggleBtn = document.getElementById('btn-toggle-grid');
    if (toggleBtn) {
      toggleBtn.classList.toggle('active', this.showGrid);
    }
    
    this.renderGrid();
  }

  public renderGrid() {
    const container = document.getElementById('preview-container');
    if (!container) return;

    if (!this.showGrid) {
      container.style.backgroundSize = '14px 14px'; // Reset to default transparent pattern
      container.style.backgroundImage = ''; 
      container.classList.remove('has-grid');
      return;
    }

    container.classList.add('has-grid');
    
    // Create CSS background based on units
    let gridSize = this.unit === 'mm' ? 10 * this.pixelsPerMm : 0.5 * this.pixelsPerInch; // 10mm or 0.5 inch
    
    // Subdivisions
    let subSize = gridSize / 5;
    
    // We'll use CSS radial gradients to create a dot grid for a cleaner, modern look
    const dotColor = 'rgba(0, 255, 194, 0.4)';
    const subDotColor = 'rgba(255, 255, 255, 0.1)';
    
    container.style.backgroundSize = `${gridSize}px ${gridSize}px, ${subSize}px ${subSize}px`;
    container.style.backgroundImage = `
      radial-gradient(circle at 1px 1px, ${dotColor} 1px, transparent 0),
      radial-gradient(circle at 1px 1px, ${subDotColor} 1px, transparent 0)
    `;
    container.style.backgroundPosition = '0 0, 0 0';
  }
}
