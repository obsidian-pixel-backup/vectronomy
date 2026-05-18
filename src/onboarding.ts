/**
 * VECTRONOMY — Onboarding & Help System
 * 
 * Provides guided tours, tooltips, and help overlays.
 * Persists completion state in localStorage.
 */

const STORAGE_KEY = 'vectronomy_onboarding_complete';
const STORAGE_KEY_EDITOR = 'vectronomy_editor_onboarding_complete';

// ── Tour Step Definition ─────────────────────────────────────────

interface TourStep {
  target: string;       // CSS selector for the element to highlight
  title: string;
  content: string;
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
  action?: () => void;  // Optional action to perform when step is shown
}

// ── Landing Page Tour Steps ──────────────────────────────────────

const landingTourSteps: TourStep[] = [
  {
    target: '.header-brand',
    title: 'Welcome to Vectronomy!',
    content: 'Your professional-grade SVG vector editor & XCS conversion studio. This guided tour will walk you through every feature. Let\'s get started!',
    position: 'bottom',
  },
  {
    target: '#btn-import-xcs',
    title: 'Import XCS Files',
    content: 'Click here to import XCS, JSON, or ZIP files. The studio will automatically parse and convert them into editable SVG layers with full vector fidelity.',
    position: 'bottom',
  },
  {
    target: '#btn-import-svg',
    title: 'Open SVG Files',
    content: 'Already have an SVG? Open it directly for editing. All paths, shapes, groups, and transforms are fully preserved for manipulation.',
    position: 'bottom',
  },
  {
    target: '#btn-new-canvas',
    title: 'Start From Scratch',
    content: 'Create a blank canvas to build your vector artwork from the ground up using the built-in drawing tools.',
    position: 'bottom',
  },
  {
    target: '.drop-zone-content',
    title: 'Drag & Drop Support',
    content: 'You can also simply drag and drop any supported file directly onto this area. The studio will handle the rest automatically!',
    position: 'top',
  },
  {
    target: '.drop-actions',
    title: 'Quick Actions',
    content: 'These buttons give you quick access to all import methods. Choose the one that fits your workflow.',
    position: 'top',
  },
];

// ── Editor Tour Steps ────────────────────────────────────────────

const editorTourSteps: TourStep[] = [
  {
    target: '.studio-topbar',
    title: 'Studio Top Bar',
    content: 'This is your control center. Navigate layers, view conversion stats, export your work, and manage your project from here.',
    position: 'bottom',
  },
  {
    target: '#layer-tabs',
    title: 'Layer Navigation',
    content: 'Switch between converted layers using these tabs. Each XCS layer becomes an independent, editable SVG layer.',
    position: 'bottom',
  },
  {
    target: '#tool-select',
    title: 'Select Tool (V)',
    content: 'The primary selection tool. Click elements to select them, or click and drag on empty space to create a marquee selection box. Hold Shift to add to your selection.',
    position: 'right',
  },
  {
    target: '#tool-pan',
    title: 'Pan Tool (H)',
    content: 'Click and drag to pan the canvas. Pro tip: You can also pan with middle mouse button or scroll wheel from any tool!',
    position: 'right',
  },
  {
    target: '#tool-node',
    title: 'Node Editor (N)',
    content: 'The most powerful tool! Click any path or shape to reveal its anchor nodes. Drag nodes to reshape geometry. Double-click a path to add new nodes. Select a node and press Delete to remove it.',
    position: 'right',
  },
  {
    target: '#tool-rect',
    title: 'Rectangle Tool (R)',
    content: 'Click and drag to draw rectangles. Hold Shift for perfect squares. Switch to Node tool afterwards to edit individual corners.',
    position: 'right',
  },
  {
    target: '#tool-circle',
    title: 'Ellipse Tool (E)',
    content: 'Click and drag to draw ellipses. Hold Shift for perfect circles.',
    position: 'right',
  },
  {
    target: '#tool-line',
    title: 'Line Tool (L)',
    content: 'Click and drag to draw straight lines between two points.',
    position: 'right',
  },
  {
    target: '#tool-pen',
    title: 'Pen Tool (P)',
    content: 'Click to place anchor points and build custom paths. Double-click to close the path and finish drawing.',
    position: 'right',
  },
  {
    target: '#preview-container',
    title: 'Canvas & Preview',
    content: 'This is your main workspace. Use scroll wheel to zoom in/out. All drawing, selection, and manipulation happens here. The canvas supports infinite zoom levels.',
    position: 'center',
  },
  {
    target: '.props-panel',
    title: 'Properties Panel',
    content: 'When you select an element, this panel shows its properties: position, size, rotation, stroke settings, fill colors, and opacity. All values are live-editable!',
    position: 'left',
  },
  {
    target: '#btn-download',
    title: 'Export SVG',
    content: 'Download your work as a production-ready SVG file. Studio colors are automatically normalized to standard black (#000000) for laser-cutting and manufacturing compatibility.',
    position: 'bottom',
  },
  {
    target: '#zoom-level-display',
    title: 'Zoom Controls',
    content: 'Monitor your current zoom level here. Use Ctrl + scroll wheel for precision zooming, or the zoom buttons for stepped zoom control.',
    position: 'bottom',
  },
];

// ── Tour Engine ──────────────────────────────────────────────────

class TourEngine {
  private steps: TourStep[] = [];
  private currentStep = 0;
  private overlay: HTMLElement | null = null;
  private tooltip: HTMLElement | null = null;
  private spotlight: HTMLElement | null = null;
  private onComplete: (() => void) | null = null;

  start(steps: TourStep[], onComplete?: () => void) {
    this.steps = steps;
    this.currentStep = 0;
    this.onComplete = onComplete || null;
    this.createOverlay();
    this.showStep(0);
  }

  private createOverlay() {
    // Remove any existing overlay
    document.getElementById('tour-overlay')?.remove();

    this.overlay = document.createElement('div');
    this.overlay.id = 'tour-overlay';
    this.overlay.innerHTML = `
      <div class="tour-backdrop"></div>
      <div class="tour-spotlight" id="tour-spotlight"></div>
      <div class="tour-tooltip" id="tour-tooltip">
        <div class="tour-tooltip-header">
          <span class="tour-step-indicator" id="tour-step-indicator"></span>
          <button class="tour-close-btn" id="tour-close-btn">&times;</button>
        </div>
        <h3 class="tour-title" id="tour-title"></h3>
        <p class="tour-content" id="tour-content"></p>
        <div class="tour-actions">
          <button class="btn btn-ghost btn-sm" id="tour-prev-btn">← Back</button>
          <button class="btn btn-primary btn-sm" id="tour-next-btn">Next →</button>
        </div>
      </div>
    `;
    document.body.appendChild(this.overlay);

    this.spotlight = document.getElementById('tour-spotlight') as HTMLElement;
    this.tooltip = document.getElementById('tour-tooltip') as HTMLElement;

    document.getElementById('tour-close-btn')!.addEventListener('click', () => this.end());
    document.getElementById('tour-next-btn')!.addEventListener('click', () => this.next());
    document.getElementById('tour-prev-btn')!.addEventListener('click', () => this.prev());
  }

  private showStep(index: number) {
    if (index < 0 || index >= this.steps.length) return;
    this.currentStep = index;
    const step = this.steps[index];

    // Update step indicator
    document.getElementById('tour-step-indicator')!.textContent = `${index + 1} / ${this.steps.length}`;
    document.getElementById('tour-title')!.textContent = step.title;
    document.getElementById('tour-content')!.textContent = step.content;

    // Update button states
    const prevBtn = document.getElementById('tour-prev-btn') as HTMLButtonElement;
    const nextBtn = document.getElementById('tour-next-btn') as HTMLButtonElement;
    prevBtn.style.visibility = index === 0 ? 'hidden' : 'visible';
    nextBtn.textContent = index === this.steps.length - 1 ? 'Finish ✓' : 'Next →';

    // Position spotlight and tooltip
    const target = document.querySelector(step.target) as HTMLElement;
    if (target && step.position !== 'center') {
      const rect = target.getBoundingClientRect();
      const pad = 8;

      this.spotlight!.style.display = 'block';
      this.spotlight!.style.left = `${rect.left - pad}px`;
      this.spotlight!.style.top = `${rect.top - pad}px`;
      this.spotlight!.style.width = `${rect.width + pad * 2}px`;
      this.spotlight!.style.height = `${rect.height + pad * 2}px`;

      // Position tooltip
      this.positionTooltip(rect, step.position);
    } else {
      // Center the tooltip (no spotlight)
      this.spotlight!.style.display = 'none';
      this.tooltip!.style.left = '50%';
      this.tooltip!.style.top = '50%';
      this.tooltip!.style.transform = 'translate(-50%, -50%)';
    }

    // Run action if specified
    if (step.action) step.action();
  }

  private positionTooltip(targetRect: DOMRect, position: string) {
    const tt = this.tooltip!;
    tt.style.transform = '';

    const margin = 16;
    const ttW = 360;

    switch (position) {
      case 'bottom':
        tt.style.left = `${Math.max(margin, Math.min(window.innerWidth - ttW - margin, targetRect.left + targetRect.width / 2 - ttW / 2))}px`;
        tt.style.top = `${targetRect.bottom + margin}px`;
        break;
      case 'top':
        tt.style.left = `${Math.max(margin, Math.min(window.innerWidth - ttW - margin, targetRect.left + targetRect.width / 2 - ttW / 2))}px`;
        tt.style.top = `${targetRect.top - margin}px`;
        tt.style.transform = 'translateY(-100%)';
        break;
      case 'right':
        tt.style.left = `${targetRect.right + margin}px`;
        tt.style.top = `${targetRect.top + targetRect.height / 2}px`;
        tt.style.transform = 'translateY(-50%)';
        break;
      case 'left':
        tt.style.left = `${targetRect.left - margin - ttW}px`;
        tt.style.top = `${targetRect.top + targetRect.height / 2}px`;
        tt.style.transform = 'translateY(-50%)';
        break;
    }
  }

  private next() {
    if (this.currentStep < this.steps.length - 1) {
      this.showStep(this.currentStep + 1);
    } else {
      this.end();
    }
  }

  private prev() {
    if (this.currentStep > 0) {
      this.showStep(this.currentStep - 1);
    }
  }

  end() {
    this.overlay?.remove();
    this.overlay = null;
    if (this.onComplete) this.onComplete();
  }
}

// ── Prompt Dialog ────────────────────────────────────────────────

function showTourPrompt(title: string, message: string): Promise<boolean> {
  return new Promise(resolve => {
    const existing = document.getElementById('tour-prompt');
    if (existing) existing.remove();

    const dialog = document.createElement('div');
    dialog.id = 'tour-prompt';
    dialog.innerHTML = `
      <div class="tour-prompt-backdrop"></div>
      <div class="tour-prompt-dialog glass">
        <div class="tour-prompt-icon">
          <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="24" cy="24" r="22" stroke="#00ffc2" stroke-width="2" fill="rgba(0,255,194,0.08)"/>
            <path d="M24 14v14" stroke="#00ffc2" stroke-width="3" stroke-linecap="round"/>
            <circle cx="24" cy="35" r="2" fill="#00ffc2"/>
          </svg>
        </div>
        <h2>${title}</h2>
        <p>${message}</p>
        <div class="tour-prompt-actions">
          <button class="btn btn-ghost" id="tour-prompt-skip">Skip Tour</button>
          <button class="btn btn-primary" id="tour-prompt-start">Take the Tour ✦</button>
        </div>
      </div>
    `;
    document.body.appendChild(dialog);

    // Animate in
    requestAnimationFrame(() => dialog.classList.add('visible'));

    document.getElementById('tour-prompt-skip')!.addEventListener('click', () => {
      dialog.classList.remove('visible');
      setTimeout(() => dialog.remove(), 300);
      resolve(false);
    });
    document.getElementById('tour-prompt-start')!.addEventListener('click', () => {
      dialog.classList.remove('visible');
      setTimeout(() => dialog.remove(), 300);
      resolve(true);
    });
  });
}

// ── Help Panel ───────────────────────────────────────────────────

function createHelpPanel() {
  const existing = document.getElementById('help-panel');
  if (existing) { existing.remove(); return; } // Toggle off

  const panel = document.createElement('div');
  panel.id = 'help-panel';
  panel.className = 'help-panel glass';
  panel.innerHTML = `
    <div class="help-panel-header">
      <h3>Help & Tutorials</h3>
      <button class="help-close-btn" id="help-close-btn">&times;</button>
    </div>
    <div class="help-panel-content">
      <div class="help-section">
        <h4>⌨ Keyboard Shortcuts</h4>
        <div class="help-shortcuts">
          <div class="shortcut"><kbd>V</kbd><span>Select Tool</span></div>
          <div class="shortcut"><kbd>H</kbd><span>Pan Tool</span></div>
          <div class="shortcut"><kbd>N</kbd><span>Node Editor</span></div>
          <div class="shortcut"><kbd>R</kbd><span>Rectangle</span></div>
          <div class="shortcut"><kbd>E</kbd><span>Ellipse</span></div>
          <div class="shortcut"><kbd>L</kbd><span>Line</span></div>
          <div class="shortcut"><kbd>P</kbd><span>Pen Tool</span></div>
          <div class="shortcut"><kbd>Del</kbd><span>Delete Selection / Node</span></div>
          <div class="shortcut"><kbd>Esc</kbd><span>Deselect All</span></div>
          <div class="shortcut"><kbd>Shift+Click</kbd><span>Multi-Select</span></div>
          <div class="shortcut"><kbd>Middle Mouse</kbd><span>Pan (any tool)</span></div>
          <div class="shortcut"><kbd>Scroll</kbd><span>Zoom In/Out</span></div>
        </div>
      </div>

      <div class="help-section">
        <h4>🖱 Node Editing</h4>
        <ul>
          <li>Switch to <strong>Node tool (N)</strong> and click any path or shape</li>
          <li>Drag white nodes to reshape geometry</li>
          <li><strong>Double-click</strong> on a path stroke to add a new node</li>
          <li>Click a node then press <strong>Delete</strong> to remove it</li>
          <li>Works on XCS imports, drawn shapes, and SVG paths</li>
        </ul>
      </div>

      <div class="help-section">
        <h4>🔲 Multi-Selection</h4>
        <ul>
          <li>Click and drag on empty canvas to create a marquee selection</li>
          <li>Hold <strong>Shift</strong> and click to add/remove from selection</li>
          <li>Selected elements can be moved, resized, and styled together</li>
        </ul>
      </div>

      <div class="help-section">
        <h4>📤 Exporting</h4>
        <ul>
          <li>Studio cyan colors are auto-converted to black on export</li>
          <li>Export single layers or all layers at once</li>
          <li>Production-ready SVG output for laser cutting</li>
        </ul>
      </div>

      <div class="help-section help-tour-section">
        <h4>🎓 Guided Tour</h4>
        <p>Want to see the full walkthrough again?</p>
        <button class="btn btn-primary btn-sm" id="help-restart-tour">Restart Onboarding Tour</button>
      </div>
    </div>
  `;
  document.body.appendChild(panel);
  requestAnimationFrame(() => panel.classList.add('visible'));

  document.getElementById('help-close-btn')!.addEventListener('click', () => {
    panel.classList.remove('visible');
    setTimeout(() => panel.remove(), 300);
  });

  document.getElementById('help-restart-tour')!.addEventListener('click', () => {
    panel.classList.remove('visible');
    setTimeout(() => {
      panel.remove();
      // Reset onboarding states
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_KEY_EDITOR);
      // Determine which tour to run based on current view
      const studio = document.getElementById('studio');
      if (studio && !studio.hidden) {
        runEditorTour(true);
      } else {
        runLandingTour(true);
      }
    }, 300);
  });
}

// ── Public API ───────────────────────────────────────────────────

const engine = new TourEngine();

export async function runLandingTour(force = false) {
  if (!force && localStorage.getItem(STORAGE_KEY) === 'true') return;

  const shouldTour = await showTourPrompt(
    'Welcome to Vectronomy!',
    'Would you like a quick guided tour of the studio? We\'ll show you everything you need to get started.'
  );

  if (shouldTour) {
    engine.start(landingTourSteps, () => {
      localStorage.setItem(STORAGE_KEY, 'true');
    });
  } else {
    localStorage.setItem(STORAGE_KEY, 'true');
  }
}

export async function runEditorTour(force = false) {
  if (!force && localStorage.getItem(STORAGE_KEY_EDITOR) === 'true') return;

  const shouldTour = await showTourPrompt(
    'Your workspace is ready!',
    'Would you like a tour of the editor tools and features? We\'ll show you how to edit, transform, and export your vectors.'
  );

  if (shouldTour) {
    engine.start(editorTourSteps, () => {
      localStorage.setItem(STORAGE_KEY_EDITOR, 'true');
    });
  } else {
    localStorage.setItem(STORAGE_KEY_EDITOR, 'true');
  }
}

export function toggleHelpPanel() {
  createHelpPanel();
}
