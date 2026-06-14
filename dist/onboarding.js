/**
 * VECTRONOMY — Onboarding & Help System
 *
 * Provides guided tours, tooltips, and help overlays.
 * Persists completion state in localStorage.
 */
const STORAGE_KEY = 'vectronomy_onboarding_complete';
const STORAGE_KEY_EDITOR = 'vectronomy_editor_onboarding_complete';
// ── Landing Page Tour Steps ──────────────────────────────────────
const landingTourSteps = [
    {
        target: '#btn-hamburger',
        title: 'App Menu & Settings',
        content: 'Click the hamburger menu to access the Feature Roadmap, Settings, Hotkeys, and Documentation. Your central hub for application settings!',
        position: 'bottom',
    },
    {
        target: '.header-brand',
        title: 'Welcome to Vectronomy!',
        content: 'Your professional-grade SVG vector editor & XCS conversion studio. Please note: This application is currently in active ALPHA stage and under heavy development. This guided tour will walk you through every feature. Let\'s get started!',
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
const editorTourSteps = [
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
        target: '#btn-undo',
        title: 'Undo & Redo (Ctrl+Z / Ctrl+Y)',
        content: 'Made a mistake? No problem! Use these buttons or keyboard shortcuts to step backward or forward through your modification history infinitely.',
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
        target: '#tool-curves-toggle',
        title: 'Drawing Pens & Brushes (P/B)',
        content: 'Click this button to open the Drawing Pens menu popover. Choose the Bezier Pen to build precise curves node-by-node, the Freehand Pencil to sketch natural lines, or the Vector Brush (B) to paint pressure-sensitive vector strokes.',
        position: 'right',
    },
    {
        target: '#tool-shapes-toggle',
        title: 'Geometric Shapes (S)',
        content: 'Click this button to open the Geometric Shapes menu popover. Instantly draw Line Segments, Polylines, Rectangles, Ellipses, Regular Polygons, Star Generators, or Logarithmic Spirals. Hold Shift while drawing to lock perfect aspect ratios!',
        position: 'right',
    },
    {
        target: '#tool-eraser',
        title: 'Eraser & Magic Wand',
        content: 'Advanced editing tools: Use the Eraser (E) to slice through and delete segments of paths, or the Magic Wand (W) to automatically select related geometric structures based on similarity.',
        position: 'right',
    },
    {
        target: '#preview-container',
        title: 'Canvas & Preview',
        content: 'This is your main workspace. Use scroll wheel to zoom in/out. All drawing, selection, and manipulation happens here. The canvas supports infinite zoom levels.',
        position: 'center',
    },
    {
        target: '.properties-panel',
        title: 'Properties Panel',
        content: 'When you select an element, this panel shows its properties: position, size, rotation, stroke settings, fill colors, and opacity. All values are live-editable!',
        position: 'left',
    },
    {
        target: '#btn-export-toggle',
        title: 'Multi-Format Export',
        content: 'Download your work as a vector SVG, raster PNG, JPEG, or raw source text. You can also copy the SVG code directly to your clipboard. Layout colors are auto-normalized to cutting black (#000000) on export!',
        position: 'bottom',
    },
    {
        target: '.preview-controls',
        title: 'Canvas & Grid Controls',
        content: 'Control your workspace view here. Toggle the Grid, enable Grid Snapping (magnet icon), adjust grid sizes in settings, or use the zoom buttons to perfectly frame your design.',
        position: 'left',
    },
];
// ── Tour Engine ──────────────────────────────────────────────────
class TourEngine {
    constructor() {
        this.steps = [];
        this.currentStep = 0;
        this.overlay = null;
        this.tooltip = null;
        this.spotlight = null;
        this.onComplete = null;
    }
    start(steps, onComplete) {
        this.steps = steps;
        this.currentStep = 0;
        this.onComplete = onComplete || null;
        this.createOverlay();
        this.showStep(0);
    }
    createOverlay() {
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
        this.spotlight = document.getElementById('tour-spotlight');
        this.tooltip = document.getElementById('tour-tooltip');
        document.getElementById('tour-close-btn').addEventListener('click', () => this.end());
        document.getElementById('tour-next-btn').addEventListener('click', () => this.next());
        document.getElementById('tour-prev-btn').addEventListener('click', () => this.prev());
    }
    showStep(index) {
        if (index < 0 || index >= this.steps.length)
            return;
        this.currentStep = index;
        const step = this.steps[index];
        // Update step indicator
        document.getElementById('tour-step-indicator').textContent = `${index + 1} / ${this.steps.length}`;
        document.getElementById('tour-title').textContent = step.title;
        document.getElementById('tour-content').textContent = step.content;
        // Update button states
        const prevBtn = document.getElementById('tour-prev-btn');
        const nextBtn = document.getElementById('tour-next-btn');
        prevBtn.style.visibility = index === 0 ? 'hidden' : 'visible';
        nextBtn.textContent = index === this.steps.length - 1 ? 'Finish ✓' : 'Next →';
        // Position spotlight and tooltip
        const target = document.querySelector(step.target);
        if (target) {
            const rect = target.getBoundingClientRect();
            const pad = 8;
            this.spotlight.style.display = 'block';
            this.spotlight.style.left = `${rect.left - pad}px`;
            this.spotlight.style.top = `${rect.top - pad}px`;
            this.spotlight.style.width = `${rect.width + pad * 2}px`;
            this.spotlight.style.height = `${rect.height + pad * 2}px`;
            if (step.position === 'center') {
                // Center the tooltip
                this.tooltip.style.left = '50%';
                this.tooltip.style.top = '50%';
                this.tooltip.style.transform = 'translate(-50%, -50%)';
            }
            else {
                // Position tooltip relative to target
                this.positionTooltip(rect, step.position);
            }
        }
        else {
            // Center the tooltip (no spotlight)
            this.spotlight.style.display = 'none';
            this.tooltip.style.left = '50%';
            this.tooltip.style.top = '50%';
            this.tooltip.style.transform = 'translate(-50%, -50%)';
        }
        // Run action if specified
        if (step.action)
            step.action();
    }
    positionTooltip(targetRect, position) {
        const tt = this.tooltip;
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
    next() {
        if (this.currentStep < this.steps.length - 1) {
            this.showStep(this.currentStep + 1);
        }
        else {
            this.end();
        }
    }
    prev() {
        if (this.currentStep > 0) {
            this.showStep(this.currentStep - 1);
        }
    }
    end() {
        this.overlay?.remove();
        this.overlay = null;
        if (this.onComplete)
            this.onComplete();
    }
}
// ── Prompt Dialog ────────────────────────────────────────────────
function showTourPrompt(title, message) {
    return new Promise(resolve => {
        const existing = document.getElementById('tour-prompt');
        if (existing)
            existing.remove();
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
        document.getElementById('tour-prompt-skip').addEventListener('click', () => {
            dialog.classList.remove('visible');
            setTimeout(() => dialog.remove(), 300);
            resolve(false);
        });
        document.getElementById('tour-prompt-start').addEventListener('click', () => {
            dialog.classList.remove('visible');
            setTimeout(() => dialog.remove(), 300);
            resolve(true);
        });
    });
}
// ── Public API ───────────────────────────────────────────────────
const engine = new TourEngine();
let landingTourPrompted = false;
let editorTourPrompted = false;
export async function runLandingTour(force = false) {
    if (force) {
        landingTourPrompted = false;
    }
    if (!force && (landingTourPrompted || localStorage.getItem(STORAGE_KEY) === 'true'))
        return;
    landingTourPrompted = true;
    const shouldTour = await showTourPrompt('Welcome to Vectronomy!', 'Would you like a quick guided tour of the studio? We\'ll show you everything you need to get started.');
    if (shouldTour) {
        engine.start(landingTourSteps, () => {
            localStorage.setItem(STORAGE_KEY, 'true');
        });
    }
    else {
        localStorage.setItem(STORAGE_KEY, 'true');
    }
}
export async function runEditorTour(force = false) {
    if (force) {
        editorTourPrompted = false;
    }
    if (!force && (editorTourPrompted || localStorage.getItem(STORAGE_KEY_EDITOR) === 'true'))
        return;
    editorTourPrompted = true;
    const shouldTour = await showTourPrompt('Your workspace is ready!', 'Would you like a tour of the editor tools and features? We\'ll show you how to edit, transform, and export your vectors.');
    if (shouldTour) {
        engine.start(editorTourSteps, () => {
            localStorage.setItem(STORAGE_KEY_EDITOR, 'true');
        });
    }
    else {
        localStorage.setItem(STORAGE_KEY_EDITOR, 'true');
    }
}
//# sourceMappingURL=onboarding.js.map