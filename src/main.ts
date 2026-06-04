/**
 * VECTRONOMY — Application Entry Point v2
 *
 * Wires UI → engine for XCS conversion, SVG import, layer navigation,
 * preview rendering, full property editing, z-order, align, undo/redo,
 * download and source viewing.
 */

import { XcsConverter, ConversionOptions } from './engine';
import type { ConvertedLayer } from './engine/types';
import Panzoom, { PanzoomObject } from '@panzoom/panzoom';
import { VectorEditor } from './engine/editor';
import type { ElementProperties } from './engine/editor';
import { runLandingTour, runEditorTour } from './onboarding';

// Import roadmap asset and parser
import roadmapMd from '../VECTRONOMY_ROADMAP_AND_DOCUMENTATION.md?raw';
import { parseRoadmap, Division, Phase, Feature } from './roadmapParser';
import { COMPLETED_FEATURES, IN_PROGRESS_FEATURES, FEATURE_DOCS } from './featureDocs';

// Import Phase 1 Managers
import { UIManager } from './managers/UIManager';
import { StorageManager } from './managers/StorageManager';
import { ProjectManager } from './managers/ProjectManager';
import { GridManager } from './managers/GridManager';
import { ToolbarManager } from './managers/ToolbarManager';
import { LayerManager } from './engine/layerManager';
import { PrecisionEngine } from './engine/precision';

const toolbarManager = new ToolbarManager();

// ── DOM ─────────────────────────────────────────────────────────

const landingPage     = document.getElementById('landing-page') as HTMLElement;
const dropZone        = document.getElementById('drop-zone') as HTMLElement;
const dropContent     = dropZone.querySelector('.drop-zone-content') as HTMLElement;
const dropProcessing  = dropZone.querySelector('.drop-zone-processing') as HTMLElement;
const processingStatus= document.getElementById('processing-status') as HTMLElement;

const studio          = document.getElementById('studio') as HTMLElement;
const layerTabs       = document.getElementById('layer-tabs') as HTMLElement;
const previewContainer= document.getElementById('preview-container') as HTMLElement;
const statsEl         = document.getElementById('conversion-stats') as HTMLElement;
const zoomDisplay     = document.getElementById('zoom-level-display') as HTMLElement;

// Header containers
// headerFileActions removed
const headerStudioActions  = document.getElementById('header-studio-actions') as HTMLElement;
const headerLayerTabs      = document.getElementById('header-layer-tabs-container') as HTMLElement;

// Header nav file inputs
const fileInputXcs    = document.getElementById('file-input-xcs') as HTMLInputElement;
const fileInputSvg    = document.getElementById('file-input-svg') as HTMLInputElement;

// Properties
const propsEmpty      = document.getElementById('props-empty') as HTMLElement;
const propsSelection  = document.getElementById('props-selection') as HTMLElement;
const propElType      = document.getElementById('prop-el-type') as HTMLElement;
const propX           = document.getElementById('prop-x') as HTMLInputElement;
const propY           = document.getElementById('prop-y') as HTMLInputElement;
const propW           = document.getElementById('prop-w') as HTMLInputElement;
const propH           = document.getElementById('prop-h') as HTMLInputElement;
const propRotation    = document.getElementById('prop-rotation') as HTMLInputElement;
const propOpacity     = document.getElementById('prop-opacity') as HTMLInputElement;
const propStrokeColor = document.getElementById('prop-stroke-color') as HTMLInputElement;
const propStrokeHex   = document.getElementById('prop-stroke-color-hex') as HTMLInputElement;
const propStrokeW     = document.getElementById('prop-stroke-w') as HTMLInputElement;
const propStrokeOp    = document.getElementById('prop-stroke-opacity') as HTMLInputElement;
const propStrokeCap   = document.getElementById('prop-stroke-cap') as HTMLSelectElement;
const propStrokeJoin  = document.getElementById('prop-stroke-join') as HTMLSelectElement;
const propFillEnabled = document.getElementById('prop-fill-enabled') as HTMLInputElement;
const propFillColor   = document.getElementById('prop-fill-color') as HTMLInputElement;
const propFillHex     = document.getElementById('prop-fill-color-hex') as HTMLInputElement;
const propFillOp      = document.getElementById('prop-fill-opacity') as HTMLInputElement;
const propFillRule    = document.getElementById('prop-fill-rule') as HTMLSelectElement;

// Help Route
const helpRoute       = document.getElementById('help-route') as HTMLElement;
const btnCloseHelp    = document.getElementById('btn-close-help') as HTMLButtonElement;
const helpNavItems    = document.querySelectorAll('.help-nav-item');
const helpArticles    = document.querySelectorAll('.help-article');
const btnTourLanding  = document.getElementById('help-run-tour-landing') as HTMLButtonElement;
const btnTourEditor   = document.getElementById('help-run-tour-editor') as HTMLButtonElement;

// ── State ────────────────────────────────────────────────────────

let convertedLayers: ConvertedLayer[] = [];
let activeLayerIndex = 0;
let panzoom: PanzoomObject | null = null;
let editor: VectorEditor | null = null;
let currentProjectId: string | null = null;
let undoHistory: string[] = [];
let redoHistory: string[] = [];

// Managers
let uiManager: UIManager;
let storageManager: StorageManager;
let projectManager: ProjectManager;
let gridManager: GridManager;
let layerManager: LayerManager;
let precisionEngine: PrecisionEngine;
const MAX_HISTORY = 30;
let suppressPropUpdates = false;

// ── File Import ──────────────────────────────────────────────────

// Header buttons removed
document.getElementById('btn-help')!.addEventListener('click', () => navigateTo('/help'));

// Help Route Bindings
btnCloseHelp?.addEventListener('click', () => {
  navigateTo('/');
});

helpNavItems.forEach(btn => {
  btn.addEventListener('click', () => {
    helpNavItems.forEach(b => b.classList.remove('active'));
    helpArticles.forEach(a => a.classList.remove('active'));
    setTimeout(() => helpArticles.forEach(a => {
      if (a.id !== btn.getAttribute('data-target')) a.setAttribute('hidden', '');
    }), 300); // Wait for fade out
    
    btn.classList.add('active');
    const target = document.getElementById(btn.getAttribute('data-target') || '');
    if (target) {
      target.removeAttribute('hidden');
      requestAnimationFrame(() => target.classList.add('active'));
    }
  });
});

btnTourLanding?.addEventListener('click', () => {
  btnCloseHelp.click();
  setTimeout(() => runLandingTour(true), 300);
});

btnTourEditor?.addEventListener('click', () => {
  btnCloseHelp.click();
  setTimeout(() => runEditorTour(true), 300);
});

function showHelpRoute() {
  navigateTo('/help');
}

// Drop zone buttons
document.getElementById('btn-browse-xcs')!.addEventListener('click', (e) => { e.stopPropagation(); fileInputXcs.click(); });
document.getElementById('btn-browse-svg')!.addEventListener('click', (e) => { e.stopPropagation(); fileInputSvg.click(); });
document.getElementById('btn-new-canvas-drop')!.addEventListener('click', (e) => { e.stopPropagation(); openBlankCanvas(); });

fileInputXcs.addEventListener('change', () => {
  if (fileInputXcs.files?.length) {
    const file = fileInputXcs.files[0];
    const nameLower = file.name.toLowerCase();
    if (nameLower.endsWith('.vectronomy')) {
      processVectronomyProject(file);
    } else {
      processXcsFile(file);
    }
  }
});
fileInputSvg.addEventListener('change', () => {
  if (fileInputSvg.files?.length) {
    const file = fileInputSvg.files[0];
    const nameLower = file.name.toLowerCase();
    if (nameLower.endsWith('.png') || nameLower.endsWith('.jpg') || nameLower.endsWith('.jpeg')) {
      processImageFile(file);
    } else {
      processSvgFile(file);
    }
  }
});

// Drag & Drop (Landing Page)
dropZone.addEventListener('click', (e) => {
  if ((e.target as HTMLElement).closest('button')) return;
  fileInputXcs.click();
});
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault(); dropZone.classList.remove('drag-over');
  const file = e.dataTransfer?.files[0];
  if (!file) return;
  const nameLower = file.name.toLowerCase();
  if (nameLower.endsWith('.svg')) {
    processSvgFile(file);
  } else if (nameLower.endsWith('.vectronomy')) {
    processVectronomyProject(file);
  } else if (nameLower.endsWith('.png') || nameLower.endsWith('.jpg') || nameLower.endsWith('.jpeg')) {
    processImageFile(file);
  } else {
    processXcsFile(file);
  }
});

// Drag & Drop (Editor Canvas - Figma style)
previewContainer.addEventListener('dragover', (e) => {
  e.preventDefault();
  if (e.dataTransfer?.types.includes('Files')) {
    previewContainer.classList.add('drag-over');
  }
});
previewContainer.addEventListener('dragleave', () => {
  previewContainer.classList.remove('drag-over');
});
previewContainer.addEventListener('drop', (e) => {
  e.preventDefault();
  previewContainer.classList.remove('drag-over');
  
  const files = e.dataTransfer?.files;
  if (!files || !files.length) return;
  
  // Calculate dropping canvas coordinate
  const canvasPt = editor?.getSvgPoint(e);
  if (!canvasPt) return;
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const nameLower = file.name.toLowerCase();
    
    if (nameLower.endsWith('.svg')) {
      processSvgImport(file, canvasPt);
    } else if (nameLower.endsWith('.png') || nameLower.endsWith('.jpg') || nameLower.endsWith('.jpeg')) {
      processImageFile(file, canvasPt);
    } else {
      if (confirm(`Do you want to open ${file.name} as a new design project? This will discard your current unsaved edits.`)) {
        if (nameLower.endsWith('.vectronomy')) {
          processVectronomyProject(file);
        } else if (nameLower.endsWith('.xcs') || nameLower.endsWith('.zip') || nameLower.endsWith('.json')) {
          processXcsFile(file);
        } else {
          processSvgFile(file);
        }
      }
    }
  }
});

// ── Conversion ────────────────────────────────────────────────────

async function processVectronomyProject(file: File) {
  showProcessing(true, 'Loading project…');
  try {
    const t0 = performance.now();
    const layers = await projectManager.importProject(file);
    if (!layers || layers.length === 0) throw new Error('No valid vector layers found in project.');
    
    convertedLayers = layers;
    currentProjectId = null;
    
    // Telemetry
    (window as any).va?.('event', { name: 'import_vectronomy', data: { fileName: file.name } });

    showStudio(performance.now() - t0, file.name);
  } catch (err: any) {
    showProcessing(false);
    showToast(`Error: ${err.message || 'Project load failed'}`, true);
    console.error(err);
  }
}

async function processXcsFile(file: File) {
  showProcessing(true, 'Parsing XCS structure…');
  try {
    const t0 = performance.now();
    const options: ConversionOptions = {
      heal: true, includeMetadata: true,
      usePhysicalUnits: true, viewBoxPadding: 10,
    };
    setStatus('Building scene graph…');
    convertedLayers = await XcsConverter.convertFile(file, options);
    if (!convertedLayers.length) throw new Error('No vector layers found in the file.');
    setStatus('Rendering SVG…');
    currentProjectId = null;
    
    // Telemetry
    (window as any).va?.('event', { name: 'import_xcs', data: { fileName: file.name } });

    showStudio(performance.now() - t0, file.name);
  } catch (err: any) {
    showProcessing(false);
    showToast(`Error: ${err.message || 'Conversion failed'}`, true);
    console.error(err);
  }
}

async function processSvgFile(file: File) {
  showProcessing(true, 'Loading SVG file…');
  try {
    const text = await file.text();
    
    // Parse raw text into a mutable DOM tree
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'image/svg+xml');
    const svgEl = doc.querySelector('svg');
    if (!svgEl) throw new Error('Invalid SVG format.');

    // Find viewBox to understand original bounds
    const viewBox = svgEl.getAttribute('viewBox');
    let origWidth = parseFloat(svgEl.getAttribute('width') || '0');
    let origHeight = parseFloat(svgEl.getAttribute('height') || '0');
    
    if (viewBox) {
      const parts = viewBox.split(/[ ,]+/);
      if (parts.length === 4) {
        if (!origWidth) origWidth = parseFloat(parts[2]);
        if (!origHeight) origHeight = parseFloat(parts[3]);
      }
    }

    // Force the SVG to fill the editor wrapper and let Panzoom handle the scaling/viewBox
    svgEl.setAttribute('width', '100%');
    svgEl.setAttribute('height', '100%');
    svgEl.removeAttribute('viewBox');
    svgEl.removeAttribute('x');
    svgEl.removeAttribute('y');
    svgEl.removeAttribute('style');

    // Remove Figma/Illustrator artboard clip paths (clipPaths containing exactly one rect that matches canvas size)
    const clipPaths = Array.from(doc.querySelectorAll('clipPath'));
    const artboardClips = new Set<string>();
    clipPaths.forEach(clip => {
      const rect = clip.querySelector('rect');
      if (rect && clip.children.length === 1) {
        artboardClips.add(clip.id);
        clip.remove();
      }
    });

    if (artboardClips.size > 0) {
      const elementsWithClip = Array.from(doc.querySelectorAll('[clip-path]'));
      elementsWithClip.forEach(el => {
        const clipAttr = el.getAttribute('clip-path');
        if (clipAttr) {
          for (const id of artboardClips) {
            if (clipAttr.includes(`#${id}`)) {
              el.removeAttribute('clip-path');
            }
          }
        }
      });
    }

    // Remove white/solid background rects that exactly match the artboard size (Figma exports these)
    if (origWidth > 0 && origHeight > 0) {
      const rects = Array.from(doc.querySelectorAll('rect'));
      for (const rect of rects) {
        const w = parseFloat(rect.getAttribute('width') || '0');
        const h = parseFloat(rect.getAttribute('height') || '0');
        // If it's effectively the exact size of the document, assume it's a background artboard
        if (Math.abs(w - origWidth) < 2 && Math.abs(h - origHeight) < 2) {
          rect.remove();
          // Usually only one background rect, but we can safely remove any that are exactly document size
        }
      }
    }

    // Establish Viewport Layer if missing
    let viewport = svgEl.querySelector('#viewport') as SVGElement | null;
    if (!viewport) {
      viewport = doc.createElementNS('http://www.w3.org/2000/svg', 'g');
      viewport.setAttribute('id', 'viewport');
      
      // Move all direct children of <svg> into the viewport <g>
      while (svgEl.firstChild) {
        viewport.appendChild(svgEl.firstChild);
      }
      svgEl.appendChild(viewport);
    }

    // Inject data-xcs-ids to all standard shapes that lack them
    const targetSelectors = 'path, rect, ellipse, circle, line, polyline, polygon, text, use, image';
    const shapes = viewport.querySelectorAll(targetSelectors);
    shapes.forEach((shape, index) => {
      if (!shape.hasAttribute('data-xcs-id')) {
        const uniqueId = `svg-import-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 6)}`;
        shape.setAttribute('data-xcs-id', uniqueId);
      }
    });

    // Serialize enriched SVG back to a clean string
    const enrichedSvg = new XMLSerializer().serializeToString(doc);

    currentProjectId = null;

    // Telemetry
    (window as any).va?.('event', { name: 'import_svg', data: { fileName: file.name } });

    convertedLayers = [{
      id: 'svg-import',
      name: file.name.replace(/\.svg$/i, ''),
      color: '#00ffc2',
      svg: enrichedSvg,
      elementCount: shapes.length,
    }];
    showStudio(0, file.name);
  } catch (err: any) {
    showProcessing(false);
    showToast(`Error: ${err.message}`, true);
  }
}

async function processImageFile(file: File, dropCoords?: DOMPoint) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target?.result as string;
    const img = new Image();
    img.onload = () => {
      // Scale down large images to fit a maximum dimension of 500px
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      const maxDim = 500;
      if (w > maxDim || h > maxDim) {
        const scale = maxDim / Math.max(w, h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }
      
      let x = 0;
      let y = 0;
      
      const studio = document.getElementById('studio') as HTMLElement;
      if (studio && !studio.hidden && editor) {
        if (dropCoords) {
          x = dropCoords.x - w / 2;
          y = dropCoords.y - h / 2;
        } else {
          // Center in current workspace viewport
          const rect = previewContainer.getBoundingClientRect();
          const screenPt = { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 };
          const canvasPt = editor.getSvgPoint(screenPt as any);
          if (canvasPt) {
            x = canvasPt.x - w / 2;
            y = canvasPt.y - h / 2;
          }
        }
      } else {
        // Not in studio yet: open a blank canvas first!
        openBlankCanvas();
        x = 100;
        y = 100;
      }
      
      if (editor) {
        editor.insertImage(dataUrl, x, y, w, h);
      }
        
      showToast(`${file.name} imported successfully!`);
    };
    img.src = dataUrl;
  };
  reader.readAsDataURL(file);
}

async function processSvgImport(file: File, dropCoords: DOMPoint) {
  try {
    const text = await file.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'image/svg+xml');
    const svgEl = doc.querySelector('svg');
    if (!svgEl) throw new Error('Invalid SVG');
    
    const mainSvg = previewContainer.querySelector('svg');
    if (mainSvg) {
      const viewport = mainSvg.querySelector('#viewport') || mainSvg;
      
      const tempGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      tempGroup.setAttribute('id', `imported-svg-${Date.now()}`);
      
      const srcViewport = svgEl.querySelector('#viewport') || svgEl;
      const importedNodes: Element[] = [];
      while (srcViewport.firstChild) {
        const child = srcViewport.firstChild;
        if (child.nodeType === Node.ELEMENT_NODE) {
          const el = child as Element;
          if (!el.hasAttribute('data-xcs-id')) {
            el.setAttribute('data-xcs-id', `el-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`);
          }
          tempGroup.appendChild(child);
          importedNodes.push(el);
        } else {
          srcViewport.removeChild(child);
        }
      }
      
      viewport.appendChild(tempGroup);
      
      let bbox = { x: 0, y: 0, width: 200, height: 200 };
      try {
        const measured = (tempGroup as any).getBBox();
        if (measured.width > 0 && measured.height > 0) {
          bbox = measured;
        }
      } catch (e) {}
      
      const dx = dropCoords.x - (bbox.x + bbox.width / 2);
      const dy = dropCoords.y - (bbox.y + bbox.height / 2);
      
      const finalElements: Element[] = [];
      while (tempGroup.firstChild) {
        const child = tempGroup.firstChild as SVGGraphicsElement;
        if (child.nodeType === Node.ELEMENT_NODE) {
          const origTransform = child.getAttribute('transform') || '';
          child.setAttribute('transform', `translate(${dx}, ${dy}) ${origTransform}`.trim());
          viewport.appendChild(child);
          finalElements.push(child);
        } else {
          tempGroup.removeChild(child);
        }
      }
      tempGroup.remove();
      
      const newSvg = mainSvg.outerHTML;
      const layer = convertedLayers[activeLayerIndex];
      if (layer) {
        layer.svg = newSvg;
        layer.elementCount += finalElements.length;
      }
      pushUndo(newSvg);
      
      if (editor) {
        editor.setLayer(layer);
        editor.selectedIds = new Set(finalElements.map(el => el.getAttribute('data-xcs-id')!));
        if (finalElements.length === 1) {
          editor.selectedId = finalElements[0].getAttribute('data-xcs-id');
        }
        editor.renderSelectionUI();
      }
      
      showToast(`Imported vector elements from ${file.name}!`);
    }
  } catch (e) {
    showToast('Failed to import vector elements from SVG.', true);
  }
}

function openBlankCanvas() {
  const blankSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
  <g id="viewport">
  </g>
</svg>`;
  convertedLayers = [{
    id: 'blank', name: 'Canvas', color: '#00ffc2', svg: blankSvg, elementCount: 0,
  }];
  currentProjectId = null;

  // Telemetry
  (window as any).va?.('event', { name: 'open_blank_canvas' });

  showStudio(0, 'New Canvas');
}

// ── UI State ──────────────────────────────────────────────────────

function showProcessing(show: boolean, msg = '') {
  dropContent.hidden = show;
  dropProcessing.hidden = !show;
  if (msg) processingStatus.textContent = msg;
}
function setStatus(msg: string) { processingStatus.textContent = msg; }

function showStudio(durationMs: number, fileName: string) {
  showProcessing(false);
  landingPage.hidden = true;
  dropZone.hidden = true;
  studio.hidden = false;
  headerStudioActions.style.display = 'flex';
  headerLayerTabs.style.display = 'flex';
  activeLayerIndex = 0;

  buildLayerTabs();
  showLayer(0);
  
  if (gridManager) gridManager.renderGrid();

  const total = convertedLayers.reduce((s, l) => s + l.elementCount, 0);
  statsEl.innerHTML = `
    <span class="stat-item">File: <span class="stat-value">${esc(fileName)}</span></span>
    <span class="stat-item">Layers: <span class="stat-value">${convertedLayers.length}</span></span>
    <span class="stat-item">Elements: <span class="stat-value">${total}</span></span>
    ${durationMs > 0 ? `<span class="stat-item">Time: <span class="stat-value">${durationMs.toFixed(0)}ms</span></span>` : ''}
  `;
}

// ── Layer Tabs ────────────────────────────────────────────────────

function buildLayerTabs() {
  layerTabs.innerHTML = '';
  convertedLayers.forEach((layer, i) => {
    const btn = document.createElement('button');
    btn.className = `layer-tab${i === 0 ? ' active' : ''}`;
    btn.innerHTML = `
      <span class="tab-dot" style="background:${layer.color}"></span>
      ${esc(layer.name)}
      <span class="tab-count">${layer.elementCount}</span>
    `;
    btn.addEventListener('click', () => showLayer(i));
    layerTabs.appendChild(btn);
  });
}

function getExportableSvg(svg: string): string {
  // Convert studio cyan working colors to black for final export
  return svg
    .replace(/#00ffc2/ig, '#000000')
    .replace(/rgba\(0,\s*255,\s*194,\s*0\.1\)/ig, '#000000');
}

function showLayer(index: number) {
  activeLayerIndex = index;
  const layer = convertedLayers[index];
  if (!layer) return;

  // Update tabs
  layerTabs.querySelectorAll('.layer-tab').forEach((t, i) => t.classList.toggle('active', i === index));

  // Render SVG
  previewContainer.innerHTML = layer.svg;

  // Init editor (once)
  if (!editor) initEditor();
  editor!.setLayer(layer);

  // Init Panzoom – auto-fit to view
  initPanzoom(true);

  // Reset history
  undoHistory = [layer.svg];
  redoHistory = [];
  updateHistoryBtns();
}

// ── Editor Init ───────────────────────────────────────────────────

function initEditor() {
  editor = new VectorEditor(
    previewContainer,
    (newSvg) => {
      const layer = convertedLayers[activeLayerIndex];
      if (layer) layer.svg = newSvg;
      pushUndo(newSvg);
      if (layerManager) layerManager.updateTree();
    },
    (props) => {
      suppressPropUpdates = true;
      if (props) {
        propsEmpty.hidden = true;
        propsSelection.hidden = false;
        populateProps(props);
      } else {
        propsEmpty.hidden = false;
        propsSelection.hidden = true;
      }
      suppressPropUpdates = false;
      if (layerManager) layerManager.updateTree();
    },
    () => { currentDisablePan = true; if (panzoom) panzoom.setOptions({ disablePan: true }); },
    () => { currentDisablePan = false; if (panzoom) panzoom.setOptions({ disablePan: false }); },
    () => { updateHistoryBtns(); }
  );

  editor.setSnapFunction((pt) => gridManager.snapPoint(pt));

  // Initialize Toolbar Manager
  toolbarManager.init(editor, updateToolOptionsUI);
  // Initialize Layer and Precision
  layerManager = new LayerManager(editor);
  precisionEngine = new PrecisionEngine(document.getElementById('ruler-canvas-wrap') as HTMLElement);
  precisionEngine.setPanzoomAccessor(() => {
    if (!panzoom) return { scale: 1, x: 0, y: 0 };
    const st = panzoom.getPan();
    return { scale: panzoom.getScale(), x: st.x, y: st.y };
  });
  setTimeout(() => layerManager.updateTree(), 100);


  // ── Array Grid Generator Button Click ─────────────────────────
  const btnCreateArray = document.getElementById('btn-create-array');
  if (btnCreateArray) {
    btnCreateArray.addEventListener('click', () => {
      const rows = parseInt((document.getElementById('prop-array-rows') as HTMLInputElement).value) || 2;
      const cols = parseInt((document.getElementById('prop-array-cols') as HTMLInputElement).value) || 2;
      const spacingX = parseFloat((document.getElementById('prop-array-spacing-x') as HTMLInputElement).value) || 50;
      const spacingY = parseFloat((document.getElementById('prop-array-spacing-y') as HTMLInputElement).value) || 50;
      
      editor?.createGridArray(rows, cols, spacingX, spacingY);
    });
  }

  // ── Undo / Redo / Delete ─────────────────────────────────────
  document.getElementById('btn-undo')!.addEventListener('click', undo);
  document.getElementById('btn-redo')!.addEventListener('click', redo);
  document.getElementById('btn-delete')!.addEventListener('click', () => editor?.deleteSelected());

  // ── Align buttons ────────────────────────────────────────────
  (['left','center-h','right','top','center-v','bottom'] as const).forEach(mode => {
    document.getElementById(`align-${mode}`)?.addEventListener('click', () => editor?.alignTo(mode));
  });

  // ── Pathfinder buttons ────────────────────────────────────────
  (['unite','subtract','intersect','exclude'] as const).forEach(mode => {
    document.getElementById(`path-${mode}`)?.addEventListener('click', () => editor?.pathfinderOperation(mode));
  });

  // ── Order buttons ────────────────────────────────────────────
  document.getElementById('order-front')!.addEventListener('click', () => editor?.bringToFront());
  document.getElementById('order-forward')!.addEventListener('click', () => editor?.bringForward());
  document.getElementById('order-backward')!.addEventListener('click', () => editor?.sendBackward());
  document.getElementById('order-back')!.addEventListener('click', () => editor?.sendToBack());

  // ── Keyboard shortcuts ────────────────────────────────────────
  window.addEventListener('keydown', (e) => {
    const tag = (document.activeElement as HTMLElement)?.tagName;
    const inInput = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';

    if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); redo(); }
    if (!inInput && (e.key === 'Delete' || e.key === 'Backspace')) editor?.deleteSelected();
    if (!inInput && e.key === 'v') switchTool('select');
    if (!inInput && e.key === 'h') switchTool('pan');
    if (!inInput && e.key === 'r') switchTool('rect');
    if (!inInput && e.key === 'e') switchTool('circle');
    if (!inInput && e.key === 'o') switchTool('polygon');
    if (!inInput && e.key === 's') switchTool('star');
    if (!inInput && e.key === 'i') switchTool('spiral');
    if (!inInput && e.key === 'k') switchTool('pencil');
    if (!inInput && e.key === 'l') switchTool('line');
    if (!inInput && e.key === 'y') switchTool('polyline');
    if (!inInput && e.key === 'p') switchTool('pen');
    if (!inInput && e.key === 'n') switchTool('node');
    if (!inInput && (e.key === 'f' || e.key === 'F')) switchTool('frame');
    if (!inInput && e.key === '!' && e.shiftKey) { // Shift + 1
      const svgEl = previewContainer.querySelector('svg') as SVGSVGElement | null;
      if (svgEl) fitSvgToView(svgEl);
    }
    if (!inInput && e.key === '+') { if (panzoom) panzoom.zoomIn(); }
    if (!inInput && e.key === '-') { if (panzoom) panzoom.zoomOut(); }
    if (!inInput && e.key === '0') { if (panzoom) panzoom.reset(); }
    if (!inInput && (e.ctrlKey || e.metaKey) && e.key === "'") {
      e.preventDefault();
      if (gridManager) gridManager.toggleGrid();
    }
    if (!inInput && (e.ctrlKey || e.metaKey) && e.key === 'g') {
      e.preventDefault();
      if (e.shiftKey) {
        if (layerManager) layerManager.ungroupSelected();
      } else {
        if (layerManager) layerManager.groupSelected();
      }
    }
    if (!inInput && e.shiftKey && (e.key === "'" || e.key === '"')) {
      e.preventDefault();
      if (gridManager) gridManager.toggleSnap();
    }

    // Arrow key micro-adjustments / nudging
    if (!inInput && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      const nudgeAmount = e.shiftKey ? 10 : 1;
      let dx = 0;
      let dy = 0;
      if (e.key === 'ArrowLeft') dx = -nudgeAmount;
      if (e.key === 'ArrowRight') dx = nudgeAmount;
      if (e.key === 'ArrowUp') dy = -nudgeAmount;
      if (e.key === 'ArrowDown') dy = nudgeAmount;
      
      editor?.nudgeSelected(dx, dy);
    }
  });

  // Global handler for mid-mouse pan across any tool
  window.addEventListener('pointerdown', (e) => {
    if (e.button === 1 && panzoom) {
      panzoom.setOptions({ disablePan: false });
    }
  });
  window.addEventListener('pointerup', (e) => {
    if (e.button === 1 && panzoom) {
      panzoom.setOptions({ disablePan: currentDisablePan });
    }
  });

  // ── Property inputs ───────────────────────────────────────────
  
  // ── Popover Toggles ───────────────────────────────────────────
  const curvesToggle = document.getElementById('tool-curves-toggle');
  const curvesPopover = document.getElementById('curves-popover');
  if (curvesToggle && curvesPopover) {
    curvesToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      curvesPopover.classList.toggle('show');
      document.getElementById('shapes-popover')?.classList.remove('show');
    });
  }

  const shapesToggle = document.getElementById('tool-shapes-toggle');
  const shapesPopover = document.getElementById('shapes-popover');
  if (shapesToggle && shapesPopover) {
    shapesToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      shapesPopover.classList.toggle('show');
      document.getElementById('curves-popover')?.classList.remove('show');
    });
  }

  document.addEventListener('click', () => {
    curvesPopover?.classList.remove('show');
    shapesPopover?.classList.remove('show');
  });

  document.querySelectorAll('.shape-menu-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const tool = (e.currentTarget as HTMLElement).dataset.tool;
      if (tool) switchTool(tool);
      curvesPopover?.classList.remove('show');
      shapesPopover?.classList.remove('show');
    });
  });

  // ── Top Level Toolbar Buttons ─────────────────────────────────
  document.querySelectorAll('.tool-btn').forEach(btn => {
    if (btn.id && btn.id.startsWith('tool-') && btn.id !== 'tool-curves-toggle' && btn.id !== 'tool-shapes-toggle') {
      btn.addEventListener('click', () => {
        const tool = btn.id.replace('tool-', '');
        switchTool(tool);
      });
    }
  });

  // ── Text to Path & CNC ────────────────────────────────────────
  
  // ── Text to Path & CNC ────────────────────────────────────────
  const btnConvertToPath = document.getElementById('btn-convert-to-path');
  if (btnConvertToPath) {
    btnConvertToPath.addEventListener('click', async () => {
      await editor?.convertSelectedToPath();
      if (typeof showToast !== 'undefined') showToast('Converted to path!');
    });
  }
  
  
  // CNC & Pathfinder Bindings
  document.getElementById('btn-path-divide')?.addEventListener('click', async () => {
    if (typeof showToast !== 'undefined') showToast('Dividing Overlaps...');
    await editor?.pathfinderOperation('divide');
  });
  
  document.getElementById('btn-path-flatten')?.addEventListener('click', () => {
    const tol = parseFloat((document.getElementById('prop-flatten-tol') as HTMLInputElement)?.value || '0.25');
    editor?.flattenSelectedPaths(tol);
    if (typeof showToast !== 'undefined') showToast('Paths flattened');
  });

  document.getElementById('btn-path-reverse')?.addEventListener('click', () => {
    editor?.reverseSelectedPaths();
    if (typeof showToast !== 'undefined') showToast('Path direction reversed');
  });

  document.getElementById('btn-mill-pocket')?.addEventListener('click', () => {
    const step = parseFloat((document.getElementById('prop-mill-stepover') as HTMLInputElement)?.value || '40');
    const angle = parseFloat((document.getElementById('prop-mill-angle') as HTMLInputElement)?.value || '45');
    editor?.applyPocketHatch(step, angle);
    if (typeof showToast !== 'undefined') showToast('Pocket hatch applied');
  });

  document.getElementById('btn-mill-chamfer')?.addEventListener('click', () => {
    const depth = parseFloat((document.getElementById('prop-mill-depth') as HTMLInputElement)?.value || '5');
    const angle = parseFloat((document.getElementById('prop-mill-vangle') as HTMLInputElement)?.value || '90');
    editor?.applyChamfer(depth, angle, 1);
    if (typeof showToast !== 'undefined') showToast('Chamfer applied');
  });

  document.getElementById('btn-mill-drill')?.addEventListener('click', () => {
    const dia = parseFloat((document.getElementById('prop-mill-drilldia') as HTMLInputElement)?.value || '6');
    editor?.convertToDrill(dia);
    if (typeof showToast !== 'undefined') showToast('Converted to drills');
  });

  document.getElementById('btn-mill-tabs')?.addEventListener('click', () => {
    const count = parseFloat((document.getElementById('prop-mill-tabcount') as HTMLInputElement)?.value || '4');
    const width = parseFloat((document.getElementById('prop-mill-tabwidth') as HTMLInputElement)?.value || '3');
    editor?.applyMillingHoldingTabs(count, width, 1.5);
    if (typeof showToast !== 'undefined') showToast('Holding tabs generated');
  });

  document.getElementById('btn-mill-concentric')?.addEventListener('click', () => {
    const step = parseFloat((document.getElementById('prop-mill-stepover') as HTMLInputElement)?.value || '40');
    editor?.applyConcentricHatch(step);
    if (typeof showToast !== 'undefined') showToast('Concentric hatch applied');
  });

  
  // Pathfinder Boolean Bindings
  document.getElementById('path-unite')?.addEventListener('click', async () => {
    if (typeof showToast !== 'undefined') showToast('Uniting paths...');
    await editor?.pathfinderOperation('unite');
  });
  document.getElementById('path-subtract')?.addEventListener('click', async () => {
    if (typeof showToast !== 'undefined') showToast('Subtracting front path...');
    await editor?.pathfinderOperation('subtract');
  });
  document.getElementById('path-intersect')?.addEventListener('click', async () => {
    if (typeof showToast !== 'undefined') showToast('Intersecting paths...');
    await editor?.pathfinderOperation('intersect');
  });
  document.getElementById('path-exclude')?.addEventListener('click', async () => {
    if (typeof showToast !== 'undefined') showToast('Excluding overlap...');
    await editor?.pathfinderOperation('exclude');
  });

  const btnGenerateToolpath = document.getElementById('btn-generate-toolpath');
  if (btnGenerateToolpath) {
    btnGenerateToolpath.addEventListener('click', () => {
      const kerfInput = document.getElementById('prop-kerf-width') as HTMLInputElement;
      const kerf = kerfInput ? parseFloat(kerfInput.value) : 0;
      if (kerf !== 0) {
         editor?.applyKerf(kerf);
         if (typeof showToast !== 'undefined') showToast('Kerf offset applied!');
      } else {
         if (typeof showToast !== 'undefined') showToast('Please set a kerf width > 0.');
      }
    });
  }

  // ── Auto-Tracing UI ───────────────────────────────────────────
  const btnTraceSilhouette = document.getElementById('btn-trace-silhouette');
  if (btnTraceSilhouette) {
     btnTraceSilhouette.addEventListener('click', async () => {
        if (typeof showToast !== 'undefined') showToast('Tracing Silhouette...');
        const contrastInput = document.getElementById('prop-contrast') as HTMLInputElement;
        const val = contrastInput ? parseFloat(contrastInput.value) : 0;
        await editor?.traceSilhouette(128 + val);
     });
  }

  const btnTraceCenterline = document.getElementById('btn-trace-centerline');
  if (btnTraceCenterline) {
     btnTraceCenterline.addEventListener('click', async () => {
        if (typeof showToast !== 'undefined') showToast('Extracting Centerlines...');
        await editor?.traceCenterline();
     });
  }

  const btnTraceEdges = document.getElementById('btn-trace-edges');
  if (btnTraceEdges) {
     btnTraceEdges.addEventListener('click', async () => {
        if (typeof showToast !== 'undefined') showToast('Running High-Pass Edge Detection...');
        await editor?.traceEdges(100);
     });
  }

  const btnTracePosterize = document.getElementById('btn-trace-posterize');
  if (btnTracePosterize) {
     btnTracePosterize.addEventListener('click', async () => {
        if (typeof showToast !== 'undefined') showToast('Multi-color Posterizing...');
        await editor?.tracePosterized(4);
     });
  }

  // ── Property inputs ───────────────────────────────────────────
  bindPropInputs();
}

function switchTool(tool: string) {
  const btn = document.getElementById(`tool-${tool}`);
  const curvesToggle = document.getElementById('tool-curves-toggle');
  const shapesToggle = document.getElementById('tool-shapes-toggle');
  
  document.querySelectorAll('.tool-btn[id^="tool-"]').forEach(b => b.classList.remove('active'));
  
  if (btn) {
    btn.classList.add('active');
    editor?.setTool(tool as any);
    updateToolOptionsUI(tool);
  } else {
    const shapeItem = document.querySelector(`.shape-menu-item[data-tool="${tool}"]`);
    if (shapeItem) {
      const popover = shapeItem.closest('.shapes-popover-menu');
      let targetToggle: HTMLElement | null = null;
      if (popover) {
        if (popover.id === 'curves-popover') {
          targetToggle = curvesToggle;
        } else if (popover.id === 'shapes-popover') {
          targetToggle = shapesToggle;
        }
      }

      const shapeItems = document.querySelectorAll('.shape-menu-item');
      shapeItems.forEach(i => {
        if (i.closest('.shapes-popover-menu') === popover) {
          i.classList.remove('active');
        }
      });
      shapeItem.classList.add('active');

      if (targetToggle) {
        targetToggle.classList.add('active');
        const itemSvg = shapeItem.querySelector('svg')!.cloneNode(true);
        targetToggle.innerHTML = '';
        targetToggle.appendChild(itemSvg);
      }
      editor?.setTool(tool as any);
      updateToolOptionsUI(tool);
    }
  }
}

function updateToolOptionsUI(tool: string) {
  const optSection = document.getElementById('props-tool-options');
  const optPoly = document.getElementById('tool-opt-polygon-sides');
  const optStar = document.getElementById('tool-opt-star-points');
  const optBrushSize = document.getElementById('tool-opt-brush-size');
  const optBrushStyle = document.getElementById('tool-opt-brush-style');
  
  if (optSection && optPoly && optStar && optBrushSize && optBrushStyle) {
    if (tool === 'polygon' || tool === 'star' || tool === 'brush' || tool === 'eraser') {
      optSection.style.display = 'block';
      optPoly.style.display = tool === 'polygon' ? 'block' : 'none';
      optStar.style.display = tool === 'star' ? 'block' : 'none';
      optBrushSize.style.display = (tool === 'brush' || tool === 'eraser') ? 'block' : 'none';
      optBrushStyle.style.display = tool === 'brush' ? 'block' : 'none';
    } else {
      optSection.style.display = 'none';
    }
  }
}

// ── Panzoom ────────────────────────────────────────────────────────

let currentDisablePan = false;

function initPanzoom(fitToView = false, startScale = 1, startX = 0, startY = 0) {
  panzoom?.destroy();
  panzoom = null;

  const svgEl = previewContainer.querySelector('svg') as SVGSVGElement | null;
  const viewport = svgEl?.querySelector('#viewport') as SVGGElement | null;
  if (!svgEl || !viewport) return;

  if (!fitToView && startX === 0 && startY === 0) {
    const W = previewContainer.clientWidth || 0;
    const H = previewContainer.clientHeight || 0;
    startX = (W / 2) / startScale;
    startY = (H / 2) / startScale;
  }

  panzoom = Panzoom(svgEl, {
    maxScale: 10000, minScale: 0.0001, step: 0.1,
    startScale, startX, startY,
    disablePan: currentDisablePan,
    setTransform: (elem, { scale, x, y }) => {
      if (viewport) {
        const W = previewContainer.clientWidth || 0;
        const H = previewContainer.clientHeight || 0;
        viewport.setAttribute('transform', `matrix(${scale}, 0, 0, ${scale}, ${x * scale + W / 2}, ${y * scale + H / 2})`);
        if (typeof precisionEngine !== 'undefined' && precisionEngine) {
          precisionEngine.onViewportChange();
        }
      }
    },
    handleStartEvent: (e: any) => {
      const t = e.target as SVGElement;
      // Don't interfere with selection/transform handles
      if (t.closest('[data-handle-id]')) return;
      // For pan tool: fully hand off to Panzoom
      if (editor?.activeTool === 'pan' || e.button === 1) {
        e.preventDefault();
        return;
      }
      // For all other tools: do NOT call preventDefault().
      // Panzoom uses pointerdown; calling preventDefault() here
      // would suppress the subsequent mousedown event that the
      // VectorEditor listens on.  The editor's onInteractionStart
      // callback already sets disablePan = true, so Panzoom won't
      // actually pan even though its internal isPanning flag is set.
    },
  });

  const wrapper = svgEl.parentElement!;
  wrapper.addEventListener('wheel', (e: WheelEvent) => {
    e.preventDefault();
    if (!panzoom) return;

    const rect = svgEl.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const oldScale = panzoom.getScale();
    const pan = panzoom.getPan();
    const oldTx = pan.x * oldScale;
    const oldTy = pan.y * oldScale;

    // Zoom speed step and boundaries
    const zoomFactor = 1.05;
    let newScale = oldScale;
    if (e.deltaY < 0) {
      newScale = Math.min(10000, oldScale * zoomFactor);
    } else {
      newScale = Math.max(0.0001, oldScale / zoomFactor);
    }

    if (newScale === oldScale) return;

    // Compute mathematically perfect, visual-anchored translation
    const newTx = px - (px - oldTx) * (newScale / oldScale);
    const newTy = py - (py - oldTy) * (newScale / oldScale);

    // Convert back to unscaled coordinate inputs expected by Panzoom
    const newX = newTx / newScale;
    const newY = newTy / newScale;

    // Set scale and pan in a single layout frame to prevent jitter
    requestAnimationFrame(() => {
      panzoom?.zoom(newScale, { animate: false });
      panzoom?.pan(newX, newY, { animate: false });
      updateZoomDisplay();
    });
  }, { passive: false });
}

export function fitSvgToView(svgEl: SVGSVGElement) {
  if (!panzoom) return;
  const viewport = svgEl.querySelector('#viewport') as SVGGElement | null;
  if (!viewport) return;

  const rect = previewContainer.getBoundingClientRect();
  const cW = rect.width;
  const cH = rect.height;

  if (cW === 0 || cH === 0) {
    // Layout hasn't occurred yet, retry next frame
    requestAnimationFrame(() => fitSvgToView(svgEl));
    return;
  }

  let bbox;
  try {
    bbox = viewport.getBBox();
  } catch (e) {
    bbox = { x: 0, y: 0, width: 0, height: 0 };
  }
  
  let svgW = bbox.width || 0;
  let svgH = bbox.height || 0;
  let svgX = bbox.x || 0;
  let svgY = bbox.y || 0;

  if (svgW === 0 || svgH === 0 || isNaN(svgW) || isNaN(svgH)) { 
    svgW = cW; 
    svgH = cH; 
  }
  if (isNaN(svgX)) svgX = 0;
  if (isNaN(svgY)) svgY = 0;

  const padding = 40;
  const scaleX = (cW - padding * 2) / svgW;
  const scaleY = (cH - padding * 2) / svgH;
  let scale = Math.min(scaleX, scaleY, 4); // cap at 4x
  
  if (isNaN(scale) || !isFinite(scale)) scale = 1;

  panzoom.zoom(scale, { animate: false });
  
  let visualPanX = (cW - svgW * scale) / 2 - svgX * scale;
  let visualPanY = (cH - svgH * scale) / 2 - svgY * scale;
  
  let panX = visualPanX / scale;
  let panY = visualPanY / scale;
  
  if (isNaN(panX)) panX = 0;
  if (isNaN(panY)) panY = 0;
  
  panzoom.pan(panX, panY, { animate: false });
  updateZoomDisplay();
  
  // Wait a brief moment for the UI to settle before offering the editor tour
  setTimeout(() => runEditorTour(), 500);
}

function updateZoomDisplay() {
  if (!panzoom) return;
  const scale = panzoom.getScale();
  zoomDisplay.textContent = `${Math.round(scale * 100)}%`;
}

// ── Zoom Controls ─────────────────────────────────────────────────

document.getElementById('btn-zoom-in')!.addEventListener('click', () => { panzoom?.zoomIn(); updateZoomDisplay(); });

document.getElementById('btn-collapse-controls')?.addEventListener('click', () => {
  document.getElementById('preview-controls')?.classList.toggle('collapsed');
});

document.getElementById('btn-toggle-rulers')?.addEventListener('click', () => {
  setTimeout(() => {
    if (panzoom) {
      const pan = panzoom.getPan();
      panzoom.pan(pan.x, pan.y, { animate: false });
    }
  }, 10);
});
document.getElementById('btn-zoom-out')!.addEventListener('click', () => { panzoom?.zoomOut(); updateZoomDisplay(); });
document.getElementById('btn-zoom-fit')!.addEventListener('click', () => {
  const svgEl = previewContainer.querySelector('svg') as SVGSVGElement | null;
  if (svgEl) fitSvgToView(svgEl);
});
document.getElementById('btn-zoom-reset')!.addEventListener('click', () => {
  panzoom?.zoom(1, { animate: true });
  panzoom?.pan(0, 0, { animate: true });
  updateZoomDisplay();
});

// ── Undo / Redo ───────────────────────────────────────────────────

function pushUndo(svg: string) {
  if (undoHistory.length && undoHistory[undoHistory.length - 1] === svg) return;
  undoHistory.push(svg);
  if (undoHistory.length > MAX_HISTORY) undoHistory.shift();
  redoHistory = [];
  updateHistoryBtns();
  if (storageManager) storageManager.saveWorkspace(JSON.stringify(convertedLayers));
}

function undo() {
  if (editor && editor.canUndoDrawing()) {
    editor.undoDrawing();
    return;
  }
  if (undoHistory.length <= 1) return;
  const cur = undoHistory.pop()!;
  redoHistory.push(cur);
  applySvgState(undoHistory[undoHistory.length - 1]);
  updateHistoryBtns();
}

function redo() {
  if (!redoHistory.length) return;
  const next = redoHistory.pop()!;
  undoHistory.push(next);
  applySvgState(next);
  updateHistoryBtns();
}

function applySvgState(svg: string) {
  const layer = convertedLayers[activeLayerIndex];
  if (!layer) return;
  
  // Capture current zoom and pan state
  let currentScale = 1;
  let currentPan = { x: 0, y: 0 };
  if (panzoom) {
    currentScale = panzoom.getScale();
    currentPan = panzoom.getPan();
  }

  layer.svg = svg;
  if (storageManager) storageManager.saveWorkspace(JSON.stringify(convertedLayers));
  previewContainer.innerHTML = svg;
  editor?.setLayer(layer);
  
  // Re-initialize panzoom without auto-fitting to view, but preserving state
  initPanzoom(false, currentScale, currentPan.x, currentPan.y);
  updateZoomDisplay();
}

function updateHistoryBtns() {
  const undoBtn = document.getElementById('btn-undo') as HTMLButtonElement;
  const redoBtn = document.getElementById('btn-redo') as HTMLButtonElement;
  undoBtn.disabled = !(undoHistory.length > 1 || (editor && editor.canUndoDrawing()));
  redoBtn.disabled = redoHistory.length === 0;
}

// ── Actions ───────────────────────────────────────────────────────

function exportAsFormat(format: string) {
  const layer = convertedLayers[activeLayerIndex];
  if (!layer) return;
  
  const svgText = getExportableSvg(layer.svg);
  const filename = sanitize(layer.name);
  
  if (format === 'svg') {
    (window as any).va?.('event', { name: 'export_svg', data: { layerName: layer.name, type: 'single' } });
    dlSvg(svgText, `${filename}.svg`);
    showToast('Vector SVG exported successfully!');
  } else if (format === 'source') {
    const blob = new Blob([svgText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_source.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Source text file exported!');
  } else if (format === 'copy') {
    navigator.clipboard.writeText(svgText).then(() => {
      showToast('SVG source copied to clipboard');
    }).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = svgText;
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast('SVG source copied to clipboard');
    });
  } else if (format === 'all-layers') {
    (window as any).va?.('event', { name: 'export_svg', data: { count: convertedLayers.length, type: 'all' } });
    convertedLayers.forEach(l => dlSvg(getExportableSvg(l.svg), `${sanitize(l.name)}.svg`));
    showToast(`Downloaded ${convertedLayers.length} SVG files`);
  } else if (format === 'png' || format === 'jpeg') {
    const img = new Image();
    const svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgText, 'image/svg+xml');
      const svgEl = doc.documentElement;
      
      let width = parseFloat(svgEl.getAttribute('width') || '800');
      let height = parseFloat(svgEl.getAttribute('height') || '600');
      
      if (svgEl.hasAttribute('viewBox')) {
        const vb = svgEl.getAttribute('viewBox')!.split(/\s+/).map(Number);
        if (vb.length === 4) {
          if (!width) width = vb[2];
          if (!height) height = vb[3];
        }
      }
      
      const scale = 2; // High-DPI crisp scale
      canvas.width = width * scale;
      canvas.height = height * scale;
      
      if (ctx) {
        ctx.scale(scale, scale);
        
        if (format === 'jpeg') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        
        const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
        const fileExt = format === 'png' ? 'png' : 'jpg';
        const dataUrl = canvas.toDataURL(mimeType, 0.95);
        
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `${filename}.${fileExt}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast(`Raster ${format.toUpperCase()} image exported!`);
      }
      URL.revokeObjectURL(url);
    };
    
    img.onerror = () => {
      showToast('Raster export failed. Falling back to SVG.');
      dlSvg(svgText, `${filename}.svg`);
      URL.revokeObjectURL(url);
    };
    
    img.src = url;
  }
}

// ── Export Dropdown Events ───────────────────────────────────────
const exportToggle = document.getElementById('btn-export-toggle');
const exportDropdown = document.getElementById('export-dropdown');

if (exportToggle && exportDropdown) {
  exportToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    exportDropdown.classList.toggle('show');
    
    const chevron = exportToggle.querySelector('.chevron-icon') as HTMLElement | null;
    if (chevron) {
      chevron.style.transform = exportDropdown.classList.contains('show') ? 'rotate(180deg)' : 'rotate(0deg)';
    }
  });

  const exportItems = document.querySelectorAll<HTMLButtonElement>('.export-item');
  exportItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const format = item.getAttribute('data-format')!;
      exportAsFormat(format);
      exportDropdown.classList.remove('show');
      
      const chevron = exportToggle.querySelector('.chevron-icon') as HTMLElement | null;
      if (chevron) chevron.style.transform = 'rotate(0deg)';
    });
  });

  document.addEventListener('click', () => {
    exportDropdown.classList.remove('show');
    const chevron = exportToggle.querySelector('.chevron-icon') as HTMLElement | null;
    if (chevron) chevron.style.transform = 'rotate(0deg)';
  });
}

// ── Sidebar Menu (Hamburger) ──────────────────────────────────
const btnHamburger = document.getElementById('btn-hamburger');
const sidebar = document.getElementById('app-sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const btnSidebarClose = document.getElementById('btn-sidebar-close');

function openSidebar() {
  if (sidebar && sidebarOverlay) {
    sidebar.removeAttribute('hidden');
    sidebarOverlay.removeAttribute('hidden');
  }
}

function closeSidebar() {
  if (sidebar && sidebarOverlay) {
    sidebar.setAttribute('hidden', 'true');
    sidebarOverlay.setAttribute('hidden', 'true');
  }
}

if (btnHamburger) btnHamburger.addEventListener('click', openSidebar);
if (btnSidebarClose) btnSidebarClose.addEventListener('click', closeSidebar);
if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebar);

// ── Grid Settings Dropdown ───────────────────────────────────────
const btnGridSettings = document.getElementById('btn-grid-settings');
const gridSettingsMenu = document.getElementById('grid-settings-menu');

if (btnGridSettings && gridSettingsMenu) {
  btnGridSettings.addEventListener('click', (e) => {
    e.stopPropagation();
    gridSettingsMenu.classList.toggle('show');
  });
  
  gridSettingsMenu.addEventListener('click', (e) => e.stopPropagation());

  document.addEventListener('click', () => {
    gridSettingsMenu.classList.remove('show');
  });
}

// ── Right Panel Collapse & Tabs ────────────────────────────────────
const btnRightCollapse = document.getElementById('btn-prop-collapse') || document.getElementById('btn-right-collapse');
const editorLayout = document.querySelector('.editor-layout');

if (btnRightCollapse && editorLayout) {
  btnRightCollapse.addEventListener('click', () => {
    editorLayout.classList.toggle('right-collapsed');
    setTimeout(() => window.dispatchEvent(new Event('resize')), 310);
  });
}

// Tabs logic
const tabBtns = document.querySelectorAll('.tab-btn');
tabBtns.forEach(btn => {
  btn.addEventListener('click', (e) => {
    const targetId = btn.getAttribute('data-target');
    if (!targetId) return;

    // If panel is collapsed, expand it
    if (editorLayout?.classList.contains('right-collapsed')) {
      editorLayout.classList.remove('right-collapsed');
      setTimeout(() => window.dispatchEvent(new Event('resize')), 310);
    }

    // Update active tab
    tabBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Update content visibility
    const rightPanel = document.getElementById('right-panel');
    if (rightPanel) {
      const contents = rightPanel.querySelectorAll('.panel-content');
      contents.forEach(c => {
        if (c.id === targetId) {
          (c as HTMLElement).style.display = '';
        } else {
          (c as HTMLElement).style.display = 'none';
        }
      });
    }
  });
});

// ── Import Dropdown Events ───────────────────────────────────────
const importToggle = document.getElementById('btn-import-toggle');
const importDropdown = document.getElementById('import-dropdown');

if (importToggle && importDropdown) {
  importToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    importDropdown.classList.toggle('show');
    
    const chevron = importToggle.querySelector('.chevron-icon') as HTMLElement | null;
    if (chevron) {
      chevron.style.transform = importDropdown.classList.contains('show') ? 'rotate(180deg)' : 'rotate(0deg)';
    }
  });

  const importItems = document.querySelectorAll<HTMLButtonElement>('.import-item');
  importItems.forEach(item => {
    item.addEventListener('click', () => {
      importDropdown.classList.remove('show');
      const chevron = importToggle.querySelector('.chevron-icon') as HTMLElement | null;
      if (chevron) chevron.style.transform = 'rotate(0deg)';
    });
  });

  document.addEventListener('click', (e) => {
    const target = e.target as Element;


    // Hide dropdowns
    document.getElementById('curves-popover')?.classList.remove('show');
    document.getElementById('shapes-popover')?.classList.remove('show');
    importDropdown.classList.remove('show');
    const chevron = importToggle.querySelector('.chevron-icon') as HTMLElement | null;
    if (chevron) chevron.style.transform = 'rotate(0deg)';
  });
}



document.getElementById('btn-reset')!.addEventListener('click', () => {
  convertedLayers = []; activeLayerIndex = 0;
  studio.hidden = true; landingPage.hidden = false; dropZone.hidden = false;

  headerStudioActions.style.display = 'none';
  headerLayerTabs.style.display = 'none';
  fileInputXcs.value = ''; fileInputSvg.value = '';
  previewContainer.innerHTML = '';
  statsEl.innerHTML = ''; layerTabs.innerHTML = '';
  if (editor) {
    editor.destroy();
    editor = null;
    toolbarManager.destroy();
  }
  propsEmpty.hidden = false; propsSelection.hidden = true;
});

// ── Property Panel Binding ────────────────────────────────────────

function populateProps(p: ElementProperties) {
  propElType.textContent = p.elementType;
  propX.value = p.x.toFixed(2);
  propY.value = p.y.toFixed(2);
  propW.value = p.w.toFixed(2);
  propH.value = p.h.toFixed(2);
  propRotation.value = p.rotation.toFixed(1);
  propOpacity.value = `${p.opacity}`;

  const sc = ensureHex(p.strokeColor);
  propStrokeColor.value = sc;
  propStrokeHex.value = sc;
  propStrokeW.value = p.strokeW.toFixed(2);
  propStrokeOp.value = `${p.strokeOpacity}`;
  propStrokeCap.value = p.strokeCap;
  propStrokeJoin.value = p.strokeJoin;

  propFillEnabled.checked = p.fillEnabled;
  const fc = ensureHex(p.fillColor);
  propFillColor.value = fc;
  propFillHex.value = fc;
  propFillOp.value = `${p.fillOpacity}`;
  propFillRule.value = p.fillRule;
}

function bindPropInputs() {
  const push = () => {
    if (suppressPropUpdates) return;
    editor?.updateProperties({
      x: parseFloat(propX.value),
      y: parseFloat(propY.value),
      w: parseFloat(propW.value),
      h: parseFloat(propH.value),
      rotation: parseFloat(propRotation.value || '0'),
      opacity: parseFloat(propOpacity.value || '100'),
      strokeColor: propStrokeColor.value,
      strokeW: parseFloat(propStrokeW.value || '1'),
      strokeOpacity: parseFloat(propStrokeOp.value || '100'),
      strokeCap: propStrokeCap.value as any,
      strokeJoin: propStrokeJoin.value as any,
      fillEnabled: propFillEnabled.checked,
      fillColor: propFillColor.value,
      fillOpacity: parseFloat(propFillOp.value || '100'),
      fillRule: propFillRule.value,
    });
  };

  [propX, propY, propW, propH, propRotation, propOpacity,
   propStrokeColor, propStrokeW, propStrokeOp, propStrokeCap, propStrokeJoin,
   propFillEnabled, propFillColor, propFillOp, propFillRule].forEach(el => {
    el.addEventListener('input', push);
    el.addEventListener('change', push);
  });

  // Keep hex text fields in sync with color pickers and vice-versa
  
  const propTextContent = document.getElementById('prop-text-content') as HTMLTextAreaElement;
  if (propTextContent) {
    propTextContent.addEventListener('input', () => {
      if (suppressPropUpdates) return;
      editor?.updateProperties({ textContent: propTextContent.value });
    });
  }

  propStrokeColor.addEventListener('input', () => { propStrokeHex.value = propStrokeColor.value; });
  propStrokeHex.addEventListener('input', () => {
    if (/^#[0-9a-f]{6}$/i.test(propStrokeHex.value)) propStrokeColor.value = propStrokeHex.value;
  });
  propFillColor.addEventListener('input', () => { propFillHex.value = propFillColor.value; });
  propFillHex.addEventListener('input', () => {
    if (/^#[0-9a-f]{6}$/i.test(propFillHex.value)) propFillColor.value = propFillHex.value;
  });

  // Image adjustments
  const propImgBrightness = document.getElementById('prop-brightness') as HTMLInputElement | null;
  const propImgContrast = document.getElementById('prop-contrast') as HTMLInputElement | null;
  const propImgBlur = document.getElementById('prop-blur') as HTMLInputElement | null;

  if (propImgBrightness && propImgContrast && propImgBlur) {
    const pushImgAdjustments = () => {
      editor?.applyImageFilters(
        parseInt(propImgBrightness.value) || 0,
        parseInt(propImgContrast.value) || 0,
        parseInt(propImgBlur.value) || 0
      );
    };
    [propImgBrightness, propImgContrast, propImgBlur].forEach(el => {
      el.addEventListener('change', pushImgAdjustments);
    });
  }

  // Parametric Tools options
  const propPolygonSides = document.getElementById('prop-polygon-sides') as HTMLInputElement | null;
  const propStarPoints = document.getElementById('prop-star-points') as HTMLInputElement | null;
  const propBrushSize = document.getElementById('prop-brush-size') as HTMLInputElement | null;
  const propBrushStyle = document.getElementById('prop-brush-style') as HTMLSelectElement | null;
  
  if (propPolygonSides) {
    propPolygonSides.addEventListener('input', () => {
      if (editor) editor.polygonSides = parseInt(propPolygonSides.value) || 5;
    });
  }
  if (propStarPoints) {
    propStarPoints.addEventListener('input', () => {
      if (editor) editor.starPoints = parseInt(propStarPoints.value) || 5;
    });
  }
  if (propBrushSize) {
    propBrushSize.addEventListener('input', () => {
      if (editor) editor.brushSize = parseInt(propBrushSize.value) || 12;
    });
  }
  if (propBrushStyle) {
    propBrushStyle.addEventListener('change', () => {
      if (editor) editor.brushStyle = propBrushStyle.value as any;
    });
  }
}

// ── Utilities ─────────────────────────────────────────────────────

function dlSvg(content: string, filename: string) {
  const blob = new Blob([content], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

function sanitize(name: string) { return name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_'); }
function esc(str: string) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }

function ensureHex(color: string): string {
  if (!color || color === 'none') return '#000000';
  if (color.startsWith('#') && color.length === 7) return color;
  if (color.startsWith('#') && color.length === 4) {
    return '#' + color.slice(1).split('').map(c => c + c).join('');
  }
  // Try rgb()
  const m = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (m) return '#' + [m[1], m[2], m[3]].map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
  return '#000000';
}

function showToast(msg: string, isError = false) {
  const t = document.createElement('div');
  t.className = `toast${isError ? ' is-error' : ''}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

// ── Roadmap Page Controller ──────────────────────────────────────────

const { divisions, phases } = parseRoadmap(roadmapMd);

const roadmapPage      = document.getElementById('roadmap-page') as HTMLElement;
const btnRoadmap       = document.getElementById('btn-sidebar-roadmap') as HTMLElement;
const btnRoadmapBack   = document.getElementById('btn-roadmap-back') as HTMLElement;
const tabDivisions     = document.getElementById('tab-roadmap-divisions') as HTMLButtonElement;
const tabPhases        = document.getElementById('tab-roadmap-phases') as HTMLButtonElement;
const viewDivisions    = document.getElementById('view-roadmap-divisions') as HTMLElement;
const viewPhases       = document.getElementById('view-roadmap-phases') as HTMLElement;
const sidebarDivisions = document.getElementById('roadmap-divisions-sidebar') as HTMLElement;
const displayFeatures  = document.getElementById('roadmap-features-display') as HTMLElement;
const timelinePhases   = document.getElementById('roadmap-phases-timeline') as HTMLElement;
const searchRoadmap    = document.getElementById('roadmap-search') as HTMLInputElement;

const roadmapStats      = document.getElementById('roadmap-stats') as HTMLElement;
const featureModal      = document.getElementById('roadmap-feature-modal') as HTMLElement;
const modalCloseBtn     = document.getElementById('modal-close-btn') as HTMLElement;
const modalOverlay      = featureModal.querySelector('.roadmap-modal-overlay') as HTMLElement;
const modalFeatNum      = document.getElementById('modal-feature-num') as HTMLElement;
const modalFeatTitle    = document.getElementById('modal-feature-title') as HTMLElement;
const modalFeatStatus   = document.getElementById('modal-feature-status') as HTMLElement;
const modalFeatDiv      = document.getElementById('modal-feature-div') as HTMLElement;
const modalFeatReadme   = document.getElementById('modal-feature-readme') as HTMLElement;
const modalFeatUsage    = document.getElementById('modal-feature-usage') as HTMLElement;
const modalFeatTech     = document.getElementById('modal-feature-tech') as HTMLElement;
const modalFeatValue    = document.getElementById('modal-feature-value') as HTMLElement;

let activeDivisionId = 1;
let currentSearchQuery = '';
let activeFilter: 'all' | 'complete' | 'in-progress' | 'planned' = 'all';

// Close modal event listeners
modalCloseBtn.addEventListener('click', () => {
  featureModal.style.display = 'none';
});
modalOverlay.addEventListener('click', () => {
  featureModal.style.display = 'none';
});

// Copy Technical Specification
const btnCopySpec = document.getElementById('btn-copy-spec') as HTMLButtonElement;
btnCopySpec.addEventListener('click', async () => {
  const code = modalFeatTech.textContent || '';
  try {
    await navigator.clipboard.writeText(code);
    btnCopySpec.textContent = 'Copied!';
    btnCopySpec.style.borderColor = '#00ff88';
    btnCopySpec.style.color = '#00ff88';
    setTimeout(() => {
      btnCopySpec.textContent = 'Copy Spec';
      btnCopySpec.style.borderColor = '';
      btnCopySpec.style.color = '';
    }, 1500);
  } catch (err) {
    showToast('Failed to copy spec', true);
  }
});

// Shared helper to launch modal from feature grids or timeline clicks
function openFeatureModal(feat: Feature, div: Division) {
  let statusText = 'PLANNED';
  let statusClass = 'planned';
  if (COMPLETED_FEATURES.has(feat.id)) {
    statusText = 'SHIPPED';
    statusClass = 'complete';
  } else if (IN_PROGRESS_FEATURES.has(feat.id)) {
    statusText = 'IN DEV';
    statusClass = 'in-progress';
  }

  // Populate modal
  modalFeatNum.textContent = `#${feat.id}`;
  modalFeatTitle.textContent = feat.title;
  
  // Status Badge
  modalFeatStatus.textContent = statusText;
  modalFeatStatus.className = `status-badge ${statusClass}`;
  
  // Division Badge
  modalFeatDiv.textContent = `Division ${div.id}: ${div.title}`;
  
  // Readme & Usage Documentation
  if (FEATURE_DOCS[feat.id]) {
    modalFeatReadme.textContent = FEATURE_DOCS[feat.id].readme;
    modalFeatUsage.textContent = FEATURE_DOCS[feat.id].usage;
    modalFeatTech.textContent = FEATURE_DOCS[feat.id].tech;
  } else {
    if (COMPLETED_FEATURES.has(feat.id)) {
      modalFeatReadme.textContent = `Documentation for ${feat.title} is currently being finalized.`;
      modalFeatUsage.textContent = `The core functionality for ${feat.title} is fully deployed and active in the engine.`;
    } else {
      modalFeatReadme.textContent = "This feature is currently in the active planning phase. We are designing native integrations to satisfy this target soon!";
      modalFeatUsage.textContent = "Usage guidelines will be made available as soon as this feature moves into the active deployment phase.";
    }
    modalFeatTech.textContent = `Technical Specifications:\n${feat.technicalIntegration}`;
  }
  
  // Value
  modalFeatValue.textContent = feat.marketValue;
  
  // Show Modal
  featureModal.style.display = 'flex';

  // Telemetry
  (window as any).va?.('event', { name: 'view_feature_readme', data: { id: feat.id, title: feat.title } });
}

// Route Navigation Triggers
export function navigateTo(path: string) {
  window.history.pushState({}, '', path);
  handleRouting();
}

btnRoadmap?.addEventListener('click', () => {
  document.getElementById('btn-sidebar-close')?.click();
  navigateTo('/roadmap');
});

btnRoadmapBack?.addEventListener('click', () => {
  navigateTo('/');
});

// Client-Side Router
function handleRouting() {
  const path = window.location.pathname;
  const studioApp = document.getElementById('app') as HTMLElement;
  
  if (path === '/roadmap') {
    studioApp.style.display = 'none';
    helpRoute.setAttribute('hidden', '');
    roadmapPage.style.display = 'flex';
    initRoadmapUI();
    (window as any).va?.('event', { name: 'view_page', data: { page: 'roadmap' } });
  } else if (path === '/help') {
    studioApp.style.display = 'flex';
    dropZone.setAttribute('hidden', '');
    landingPage.setAttribute('hidden', '');
    studio.setAttribute('hidden', '');
    roadmapPage.style.display = 'none';
    helpRoute.removeAttribute('hidden');
    (window as any).va?.('event', { name: 'view_page', data: { page: 'help' } });
  } else {
    studioApp.style.display = 'flex';
    roadmapPage.style.display = 'none';
    helpRoute.setAttribute('hidden', '');
    
    if (convertedLayers.length > 0 || editor) {
      studio.removeAttribute('hidden');
      if (panzoom) requestAnimationFrame(() => panzoom!.pan(panzoom!.getPan().x, panzoom!.getPan().y));
    } else {
      landingPage.removeAttribute('hidden');
      dropZone.removeAttribute('hidden');
    }
    (window as any).va?.('event', { name: 'view_page', data: { page: 'studio' } });
  }
}

window.addEventListener('popstate', handleRouting);
window.addEventListener('load', handleRouting);
handleRouting(); // Immediate routing invocation for initial load

// Tab navigation
tabDivisions.addEventListener('click', () => switchRoadmapTab('divisions'));
tabPhases.addEventListener('click', () => switchRoadmapTab('phases'));

function switchRoadmapTab(tabName: 'divisions' | 'phases') {
  if (tabName === 'divisions') {
    tabDivisions.classList.add('active');
    tabPhases.classList.remove('active');
    viewDivisions.style.display = 'flex';
    viewPhases.style.display = 'none';
  } else {
    tabDivisions.classList.remove('active');
    tabPhases.classList.add('active');
    viewDivisions.style.display = 'none';
    viewPhases.style.display = 'flex';
    renderPhasesTimeline();
  }
}

function initRoadmapUI() {
  updateRoadmapStats();
  renderDivisionsSidebar();
  renderFeaturesList();
}

function updateRoadmapStats() {
  if (!roadmapStats) return;
  const total = 140;
  const completed = COMPLETED_FEATURES.size;
  const pct = ((completed / total) * 100).toFixed(1);
  roadmapStats.innerHTML = `
    <div class="roadmap-stat-box">
      <span class="roadmap-stat-label">Total Shipped</span>
      <span class="roadmap-stat-value">${completed} / ${total} Features</span>
    </div>
    <div class="roadmap-stat-box">
      <span class="roadmap-stat-label">Completion</span>
      <span class="roadmap-stat-value">${pct}%</span>
    </div>
    <div class="roadmap-progress-bar-wrap">
      <div class="roadmap-progress-bar-fill" style="width: ${pct}%;"></div>
    </div>
  `;
}

function renderDivisionsSidebar() {
  sidebarDivisions.innerHTML = '';
  divisions.forEach(div => {
    const btn = document.createElement('button');
    btn.className = `division-sidebar-btn${div.id === activeDivisionId ? ' active' : ''}`;
    btn.innerHTML = `
      <span class="sidebar-div-icon">${div.icon}</span>
      <div class="sidebar-div-info">
        <span class="sidebar-div-num">DIVISION ${div.id}</span>
        <span class="sidebar-div-name">${div.title}</span>
      </div>
    `;
    btn.addEventListener('click', () => {
      activeDivisionId = div.id;
      // Reset search on clicking division to let user browse division directly
      searchRoadmap.value = '';
      currentSearchQuery = '';
      renderDivisionsSidebar();
      renderFeaturesList();
    });
    sidebarDivisions.appendChild(btn);
  });
}

function renderFeaturesList() {
  displayFeatures.innerHTML = '';
  
  let sourceFeatures: { feature: Feature, division: Division }[] = [];
  
  if (currentSearchQuery) {
    const q = currentSearchQuery.toLowerCase();
    divisions.forEach(div => {
      div.features.forEach(feat => {
        const isNumSearch = q.startsWith('#');
        const numToMatch = isNumSearch ? parseInt(q.slice(1)) : -1;
        
        if (isNumSearch) {
          if (feat.id === numToMatch) {
            sourceFeatures.push({ feature: feat, division: div });
          }
        } else if (
          feat.title.toLowerCase().includes(q) ||
          feat.technicalIntegration.toLowerCase().includes(q) ||
          feat.marketValue.toLowerCase().includes(q) ||
          feat.id.toString() === q
        ) {
          sourceFeatures.push({ feature: feat, division: div });
        }
      });
    });
    
    // Title card for search
    const titleCard = document.createElement('div');
    titleCard.className = 'division-intro-card';
    titleCard.innerHTML = `
      <h3>SEARCH RESULTS</h3>
      <p>Found <b>${sourceFeatures.length}</b> features matching "${esc(currentSearchQuery)}" across all CAD divisions.</p>
    `;
    displayFeatures.appendChild(titleCard);
    
  } else {
    // Render standard division list
    const div = divisions.find(d => d.id === activeDivisionId);
    if (!div) return;
    
    sourceFeatures = div.features.map(f => ({ feature: f, division: div }));
    
    const introCard = document.createElement('div');
    introCard.className = 'division-intro-card';
    introCard.innerHTML = `
      <h3>${div.icon} DIVISION ${div.id}: ${esc(div.title)}</h3>
      <p>${esc(div.technicalIntro)}</p>
    `;
    displayFeatures.appendChild(introCard);
  }
  
  // Render interactive Quick Filters Toolbar
  const allFeatures = sourceFeatures.map(item => item.feature);
  renderQuickFilters(displayFeatures, allFeatures);
  
  // Filter features based on activeFilter
  const filteredFeatures = sourceFeatures.filter(item => {
    if (activeFilter === 'complete') {
      return COMPLETED_FEATURES.has(item.feature.id);
    }
    if (activeFilter === 'in-progress') {
      return IN_PROGRESS_FEATURES.has(item.feature.id);
    }
    if (activeFilter === 'planned') {
      return !COMPLETED_FEATURES.has(item.feature.id) && !IN_PROGRESS_FEATURES.has(item.feature.id);
    }
    return true; // 'all'
  });
  
  if (filteredFeatures.length === 0) {
    const emptyGrid = document.createElement('div');
    emptyGrid.className = 'features-grid';
    emptyGrid.innerHTML = `
      <div class="feature-card" style="grid-column: 1 / -1; text-align: center; padding: 32px; color: var(--text-secondary);">
        <span style="font-family: var(--font-mono); font-size: 1.1rem; margin-bottom: 8px; display: block; opacity: 0.5;">[ NO FEATURE MATCHES ]</span>
        No matching features match the selected filter criteria. Try resetting the active filter view.
      </div>
    `;
    displayFeatures.appendChild(emptyGrid);
    return;
  }
  
  const grid = document.createElement('div');
  grid.className = 'features-grid';
  filteredFeatures.forEach(({ feature, division }) => {
    grid.appendChild(createFeatureCardElement(feature, division));
  });
  displayFeatures.appendChild(grid);
}

function renderQuickFilters(parent: HTMLElement, featuresList: Feature[]) {
  const row = document.createElement('div');
  row.className = 'roadmap-quick-filters';
  
  const allCount = featuresList.length;
  const completeCount = featuresList.filter(f => COMPLETED_FEATURES.has(f.id)).length;
  const inProgressCount = featuresList.filter(f => IN_PROGRESS_FEATURES.has(f.id)).length;
  const plannedCount = allCount - completeCount - inProgressCount;
  
  row.innerHTML = `
    <button class="filter-btn${activeFilter === 'all' ? ' active' : ''}" data-filter="all">All (${allCount})</button>
    <button class="filter-btn${activeFilter === 'complete' ? ' active' : ''}" data-filter="complete">Shipped (${completeCount})</button>
    <button class="filter-btn${activeFilter === 'in-progress' ? ' active' : ''}" data-filter="in-progress">In Dev (${inProgressCount})</button>
    <button class="filter-btn${activeFilter === 'planned' ? ' active' : ''}" data-filter="planned">Planned (${plannedCount})</button>
  `;
  
  row.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeFilter = btn.getAttribute('data-filter') as any;
      renderFeaturesList();
    });
  });
  
  parent.appendChild(row);
}

function createFeatureCardElement(feat: Feature, div: Division): HTMLElement {
  const card = document.createElement('div');
  card.className = 'feature-card';
  
  let statusText = 'PLANNED';
  let statusClass = 'planned';
  if (COMPLETED_FEATURES.has(feat.id)) {
    statusText = 'SHIPPED';
    statusClass = 'complete';
  } else if (IN_PROGRESS_FEATURES.has(feat.id)) {
    statusText = 'IN DEV';
    statusClass = 'in-progress';
  }
  
  card.innerHTML = `
    <div class="feature-card-header">
      <span class="feature-card-title">${feat.id}. ${esc(feat.title)}</span>
      <span class="status-badge ${statusClass}">${statusText}</span>
    </div>
    <div class="feature-field">
      <span class="feature-field-label">TECHNICAL SPECIFICATION</span>
      <span class="feature-field-value">${esc(feat.technicalIntegration)}</span>
    </div>
    <div class="feature-field">
      <span class="feature-field-label">COMMERCIAL VALUE</span>
      <span class="feature-field-value market">${esc(feat.marketValue)}</span>
    </div>
  `;
  
  card.addEventListener('click', () => {
    openFeatureModal(feat, div);
  });
  
  return card;
}

function renderPhasesTimeline() {
  timelinePhases.innerHTML = '';
  
  phases.forEach(phase => {
    const node = document.createElement('div');
    let phaseClass = `phase-node`;
    if (phase.inProgress) phaseClass += ' active';
    if (phase.completed) phaseClass += ' completed';
    node.className = phaseClass;
    
    const featTags = phase.features.map(fId => {
      return `<span class="phase-feature-tag" data-feature-id="${fId}">#${fId}</span>`;
    }).join(' ');
    
    node.innerHTML = `
      <div class="phase-indicator">${phase.id}</div>
      <div class="phase-details-card">
        <div class="phase-details-header">
          <h3>PHASE ${phase.id}: ${esc(phase.name)}</h3>
          <span class="phase-duration">${esc(phase.duration)}</span>
        </div>
        <div class="phase-focus">${esc(phase.focus)}</div>
        <div class="phase-goal"><b>Phase Target:</b> ${esc(phase.goal)}</div>
        <div class="phase-features-list">
          <span style="font-size: 0.6rem; color: var(--text-muted); font-family: var(--font-mono); margin-right: 4px;">FEATURES INCLUDED:</span>
          ${featTags}
        </div>
      </div>
    `;
    
    // Add click event to features tags
    node.querySelectorAll('.phase-feature-tag').forEach(tag => {
      tag.addEventListener('click', (e) => {
        e.stopPropagation();
        const fId = parseInt(tag.getAttribute('data-feature-id')!);
        const div = divisions.find(d => d.features.some(f => f.id === fId));
        if (div) {
          const feat = div.features.find(f => f.id === fId)!;
          activeDivisionId = div.id;
          switchRoadmapTab('divisions');
          initRoadmapUI();
          searchRoadmap.value = `#${fId}`;
          currentSearchQuery = `#${fId}`;
          renderFeaturesList();
          
          // Auto-open modal documentation on click
          openFeatureModal(feat, div);
        }
      });
    });
    
    timelinePhases.appendChild(node);
  });
}

// Search binding
searchRoadmap.addEventListener('input', () => {
  currentSearchQuery = searchRoadmap.value.trim();
  renderFeaturesList();
});

// ── Profiles UI Logic ─────────────────────────────────────────────
function setupProfilesUI() {
  const machineSelect = document.getElementById('setting-machine-select') as HTMLSelectElement;
  const btnAddMachine = document.getElementById('btn-add-machine');
  const machineFields = document.getElementById('machine-profile-fields');
  const btnSaveMachine = document.getElementById('btn-save-machine');

  const materialSelect = document.getElementById('setting-material-select') as HTMLSelectElement;
  const btnAddMaterial = document.getElementById('btn-add-material');
  const materialFields = document.getElementById('material-profile-fields');
  const btnSaveMaterial = document.getElementById('btn-save-material');

  let machineProfiles = storageManager.getMachineProfiles();
  let materialProfiles = storageManager.getMaterialProfiles();

  function renderMachineSelect() {
    machineSelect.innerHTML = '<option value="">-- Select Machine --</option>';
    machineProfiles.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      machineSelect.appendChild(opt);
    });
  }

  function renderMaterialSelect() {
    materialSelect.innerHTML = '<option value="">-- Select Material --</option>';
    materialProfiles.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      materialSelect.appendChild(opt);
    });
  }

  renderMachineSelect();
  renderMaterialSelect();

  btnAddMachine?.addEventListener('click', () => {
    machineFields!.style.display = machineFields!.style.display === 'none' ? 'flex' : 'none';
  });

  btnSaveMachine?.addEventListener('click', () => {
    const name = (document.getElementById('machine-name') as HTMLInputElement).value;
    const w = parseFloat((document.getElementById('machine-bed-w') as HTMLInputElement).value);
    const h = parseFloat((document.getElementById('machine-bed-h') as HTMLInputElement).value);
    const spot = parseFloat((document.getElementById('machine-spot') as HTMLInputElement).value);

    if (name && w && h && spot) {
      machineProfiles.push({ id: Date.now().toString(), name, bedWidth: w, bedHeight: h, laserSpotSize: spot });
      storageManager.saveMachineProfiles(machineProfiles);
      renderMachineSelect();
      machineFields!.style.display = 'none';
      (document.getElementById('machine-name') as HTMLInputElement).value = '';
    }
  });

  btnAddMaterial?.addEventListener('click', () => {
    materialFields!.style.display = materialFields!.style.display === 'none' ? 'flex' : 'none';
  });

  btnSaveMaterial?.addEventListener('click', () => {
    const name = (document.getElementById('material-name') as HTMLInputElement).value;
    const speed = parseFloat((document.getElementById('material-speed') as HTMLInputElement).value);
    const power = parseFloat((document.getElementById('material-power') as HTMLInputElement).value);
    const passes = parseInt((document.getElementById('material-passes') as HTMLInputElement).value);
    const thick = parseFloat((document.getElementById('material-thick') as HTMLInputElement).value);

    if (name && speed && power && passes && thick) {
      materialProfiles.push({ id: Date.now().toString(), name, speed, power, passes, thickness: thick });
      storageManager.saveMaterialProfiles(materialProfiles);
      renderMaterialSelect();
      materialFields!.style.display = 'none';
      (document.getElementById('material-name') as HTMLInputElement).value = '';
    }
  });
}

// ── Projects Manager UI Logic ───────────────────────────────────────
function setupProjectsManagerUI() {
  const btnSaveCurrent = document.getElementById('btn-save-current-project');
  const modalProjectsList = document.getElementById('projects-list');
  const landingProjectsList = document.getElementById('landing-projects-list');

  async function renderProjectsList() {
    const containers: HTMLElement[] = [];
    if (modalProjectsList) containers.push(modalProjectsList);
    if (landingProjectsList) containers.push(landingProjectsList);

    if (containers.length === 0) return;

    containers.forEach(c => c.innerHTML = '<div style="color:var(--text-secondary);font-size:0.9rem;">Loading projects...</div>');
    
    try {
      const projects = await storageManager.listProjects();
      if (projects.length === 0) {
        if (modalProjectsList) {
          modalProjectsList.innerHTML = `
            <div style="color:var(--text-secondary);font-size:0.9rem;padding:20px;text-align:center;background:var(--bg-primary);border-radius:var(--radius-md);">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="32" height="32" style="margin-bottom:10px; opacity:0.5;">
                <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
              <br>No saved projects yet. Open a canvas, create something awesome, and save it here!
            </div>`;
        }
        if (landingProjectsList) {
          landingProjectsList.innerHTML = `
            <div style="color:var(--text-secondary);font-size:0.95rem;padding:20px;text-align:center;line-height:1.5;">
              <p>It looks a bit empty here!</p>
              <p style="margin-top:10px; color:var(--text-muted);">Start a new project by importing a design on the right, or jump straight into a blank canvas to get creating.</p>
            </div>`;
        }
        return;
      }
      
      containers.forEach(c => c.innerHTML = '');
      
      projects.forEach(p => {
        const d = new Date(p.timestamp);
        
        containers.forEach(container => {
          const el = document.createElement('div');
          el.className = 'project-card';
          el.innerHTML = `
            <div class="project-card-info">
              <span class="project-card-title">${p.name}</span>
              <span class="project-card-date">Last modified: ${d.toLocaleString()}</span>
            </div>
            <div class="project-card-actions">
              <button class="btn btn-secondary btn-sm btn-proj-load" data-id="${p.id}">Load</button>
              <button class="btn btn-secondary btn-sm btn-proj-rename" data-id="${p.id}" data-name="${p.name}">Rename</button>
              <button class="btn btn-secondary btn-sm btn-proj-delete" data-id="${p.id}" style="color:var(--danger); border-color:var(--danger-soft);">Delete</button>
            </div>
          `;
          container.appendChild(el);
        });
      });

      // Bind events globally
      document.querySelectorAll('.btn-proj-load').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = (e.currentTarget as HTMLButtonElement).dataset.id;
          if (id) {
            const state = await storageManager.loadProject(id);
            if (state) {
              convertedLayers = JSON.parse(state);
              currentProjectId = id;
              showStudio(0, 'Loaded Project');
              document.getElementById('btn-projects-close')?.click();
              if (typeof showToast !== 'undefined') showToast('Project loaded successfully.');
            }
          }
        });
      });

      document.querySelectorAll('.btn-proj-rename').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const btnEl = e.currentTarget as HTMLButtonElement;
          const id = btnEl.dataset.id;
          const oldName = btnEl.dataset.name;
          if (id && oldName) {
            const newName = prompt('Enter new project name:', oldName);
            if (newName && newName.trim() !== '' && newName !== oldName) {
              await storageManager.renameProject(id, newName.trim());
              renderProjectsList();
            }
          }
        });
      });

      document.querySelectorAll('.btn-proj-delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = (e.currentTarget as HTMLButtonElement).dataset.id;
          if (id && confirm('Are you sure you want to delete this project?')) {
            await storageManager.deleteProject(id);
            if (currentProjectId === id) currentProjectId = null;
            renderProjectsList();
          }
        });
      });

    } catch (e) {
      console.error(e);
      containers.forEach(c => c.innerHTML = '<div style="color:var(--danger);font-size:0.9rem;">Failed to load projects.</div>');
    }
  }

  // Initial load
  renderProjectsList();

  // Re-render when modal opens
  const btnProjects = document.getElementById('btn-sidebar-projects');
  btnProjects?.addEventListener('click', () => {
    renderProjectsList();
  });

  btnSaveCurrent?.addEventListener('click', async () => {
    if (convertedLayers.length === 0) {
      alert('Canvas is empty. Nothing to save.');
      return;
    }

    let name = 'Untitled Project';
    if (!currentProjectId) {
      const input = prompt('Enter a name for this project:', 'My Project');
      if (input === null) return; // Cancelled
      name = input.trim() || 'Untitled Project';
      currentProjectId = 'proj_' + Date.now();
    } else {
      // Find current name if we wanted to prompt, but for now we just overwrite
      const projects = await storageManager.listProjects();
      const p = projects.find(x => x.id === currentProjectId);
      if (p) name = p.name;
    }

    try {
      await storageManager.saveProject(currentProjectId, name, JSON.stringify(convertedLayers));
      renderProjectsList();
      if (typeof showToast !== 'undefined') showToast('Project saved successfully.');
    } catch (e) {
      console.error(e);
      alert('Failed to save project.');
    }
  });
}

// ── Managers ──────────────────────────────────────────────────────
// Declarations moved to state block

// ── Startup ───────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Managers
  uiManager = new UIManager();
  storageManager = new StorageManager();
  projectManager = new ProjectManager();
  gridManager = new GridManager();

  setupProfilesUI();
  setupProjectsManagerUI();

  // Wire sidebar download project button
  const btnDownloadProject = document.getElementById('btn-sidebar-download');
  if (btnDownloadProject) {
    btnDownloadProject.addEventListener('click', () => {
      document.getElementById('btn-sidebar-close')?.click();
      projectManager.exportProject(convertedLayers);
    });
  }
  
  // Auto-recover workspace if exists
  storageManager.loadWorkspace().then(state => {
    if (state) {
      try {
        const layers = JSON.parse(state);
        if (layers && layers.length > 0) {
          convertedLayers = layers;
          showStudio(0, 'Auto-Recovered Workspace');
          // Little toast message hack (if showToast exists, else skip)
          if (typeof showToast !== 'undefined') showToast('Restored previous session workspace.');
        }
      } catch (e) {
        console.error('Failed to parse auto-saved workspace', e);
      }
    }
  });

  // Auto-Save Loop
  setInterval(() => {
    if (convertedLayers.length > 0) {
      storageManager.saveWorkspace(JSON.stringify(convertedLayers));
    }
  }, 30000);

  // Wait for initial render, then trigger landing tour
  setTimeout(() => runLandingTour(), 500);
});
