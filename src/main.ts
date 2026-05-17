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
import { runLandingTour, runEditorTour, toggleHelpPanel } from './onboarding';

// ── DOM ─────────────────────────────────────────────────────────

const dropZone        = document.getElementById('drop-zone') as HTMLElement;
const dropContent     = dropZone.querySelector('.drop-zone-content') as HTMLElement;
const dropProcessing  = dropZone.querySelector('.drop-zone-processing') as HTMLElement;
const processingStatus= document.getElementById('processing-status') as HTMLElement;

const studio          = document.getElementById('studio') as HTMLElement;
const layerTabs       = document.getElementById('layer-tabs') as HTMLElement;
const previewContainer= document.getElementById('preview-container') as HTMLElement;
const svgSourceEl     = document.getElementById('svg-source') as HTMLElement;
const statsEl         = document.getElementById('conversion-stats') as HTMLElement;
const zoomDisplay     = document.getElementById('zoom-level-display') as HTMLElement;

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

// ── State ────────────────────────────────────────────────────────

let convertedLayers: ConvertedLayer[] = [];
let activeLayerIndex = 0;
let panzoom: PanzoomObject | null = null;
let editor: VectorEditor | null = null;
let undoHistory: string[] = [];
let redoHistory: string[] = [];
const MAX_HISTORY = 30;
let suppressPropUpdates = false;

// ── File Import ──────────────────────────────────────────────────

// Header buttons
document.getElementById('btn-import-xcs')!.addEventListener('click', () => fileInputXcs.click());
document.getElementById('btn-import-svg')!.addEventListener('click', () => fileInputSvg.click());
document.getElementById('btn-new-canvas')!.addEventListener('click', () => openBlankCanvas());
document.getElementById('btn-help')!.addEventListener('click', () => toggleHelpPanel());

// Drop zone buttons
document.getElementById('btn-browse-xcs')!.addEventListener('click', (e) => { e.stopPropagation(); fileInputXcs.click(); });
document.getElementById('btn-browse-svg')!.addEventListener('click', (e) => { e.stopPropagation(); fileInputSvg.click(); });
document.getElementById('btn-new-canvas-drop')!.addEventListener('click', (e) => { e.stopPropagation(); openBlankCanvas(); });

fileInputXcs.addEventListener('change', () => {
  if (fileInputXcs.files?.length) processXcsFile(fileInputXcs.files[0]);
});
fileInputSvg.addEventListener('change', () => {
  if (fileInputSvg.files?.length) processSvgFile(fileInputSvg.files[0]);
});

// Drag & Drop
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
  if (file.name.toLowerCase().endsWith('.svg')) processSvgFile(file);
  else processXcsFile(file);
});

// ── Conversion ────────────────────────────────────────────────────

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
    convertedLayers = [{
      id: 'svg-import',
      name: file.name.replace(/\.svg$/i, ''),
      color: '#00ffc2',
      svg: text,
      elementCount: (text.match(/<(path|rect|ellipse|circle|line|polyline|polygon|text|g)/g) || []).length,
    }];
    showStudio(0, file.name);
  } catch (err: any) {
    showProcessing(false);
    showToast(`Error: ${err.message}`, true);
  }
}

function openBlankCanvas() {
  const w = 800, h = 600;
  const blankSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
  <g id="viewport">
    <rect x="0" y="0" width="${w}" height="${h}" fill="none" stroke="rgba(255,255,255,0.05)" />
  </g>
</svg>`;
  convertedLayers = [{
    id: 'blank', name: 'Canvas', color: '#00ffc2', svg: blankSvg, elementCount: 0,
  }];
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
  dropZone.hidden = true;
  studio.hidden = false;
  activeLayerIndex = 0;

  buildLayerTabs();
  showLayer(0);

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
  svgSourceEl.textContent = getExportableSvg(layer.svg);

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
      svgSourceEl.textContent = getExportableSvg(newSvg);
      pushUndo(newSvg);
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
    },
    () => { if (panzoom) panzoom.setOptions({ disablePan: true }); },
    () => { if (panzoom) panzoom.setOptions({ disablePan: false }); }
  );

  // ── Tool buttons ────────────────────────────────────────────
  const toolBtns = document.querySelectorAll<HTMLButtonElement>('.tool-btn[id^="tool-"]');
  toolBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      toolBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tool = btn.id.replace('tool-', '') as any;
      editor!.setTool(tool);
    });
  });

  // ── Undo / Redo / Delete ─────────────────────────────────────
  document.getElementById('btn-undo')!.addEventListener('click', undo);
  document.getElementById('btn-redo')!.addEventListener('click', redo);
  document.getElementById('btn-delete-el')!.addEventListener('click', () => editor?.deleteSelected());
  document.getElementById('btn-delete')!.addEventListener('click', () => editor?.deleteSelected());

  // ── Align buttons ────────────────────────────────────────────
  (['left','center-h','right','top','center-v','bottom'] as const).forEach(mode => {
    document.getElementById(`align-${mode}`)?.addEventListener('click', () => editor?.alignTo(mode));
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
    if (!inInput && e.key === 'l') switchTool('line');
    if (!inInput && e.key === 'p') switchTool('pen');
    if (!inInput && e.key === 'n') switchTool('node');
    if (!inInput && (e.key === 'f' || e.key === 'F')) {
      const svgEl = previewContainer.querySelector('svg') as SVGSVGElement | null;
      if (svgEl) fitSvgToView(svgEl);
    }
    if (!inInput && e.key === '+') { if (panzoom) panzoom.zoomIn(); }
    if (!inInput && e.key === '-') { if (panzoom) panzoom.zoomOut(); }
    if (!inInput && e.key === '0') { if (panzoom) panzoom.reset(); }
  });

  // ── Property inputs ───────────────────────────────────────────
  bindPropInputs();
}

function switchTool(tool: string) {
  const btn = document.getElementById(`tool-${tool}`);
  if (!btn) return;
  document.querySelectorAll('.tool-btn[id^="tool-"]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  editor?.setTool(tool as any);
}

// ── Panzoom ────────────────────────────────────────────────────────

function initPanzoom(fitToView = false) {
  panzoom?.destroy();
  panzoom = null;

  const svgEl = previewContainer.querySelector('svg') as SVGSVGElement | null;
  const viewport = svgEl?.querySelector('#viewport') as SVGGElement | null;
  if (!svgEl || !viewport) return;

  panzoom = Panzoom(svgEl, {
    maxScale: 200, minScale: 0.02, step: 0.12,
    setTransform: (elem, { scale, x, y }) => {
      // Apply the transform to the viewport group, not the svg itself
      if (viewport) {
        viewport.setAttribute('transform', `matrix(${scale}, 0, 0, ${scale}, ${x}, ${y})`);
      }
    },
    handleStartEvent: (e: any) => {
      const t = e.target as SVGElement;
      // Never intercept handle or element clicks (editor handles those)
      if (t.closest('[data-handle-id]')) return false;
      // Pan tool: allow everything
      if (editor?.activeTool === 'pan') return true;
      // Select tool: allow panning only on empty canvas (not on elements)
      if (editor?.activeTool === 'select') {
        return !t.closest('[data-xcs-id]');
      }
      // Drawing tools: never allow panzoom to intercept
      return false;
    },
  });

  const wrapper = svgEl.parentElement!;
  wrapper.addEventListener('wheel', (e: WheelEvent) => {
    e.preventDefault();
    panzoom!.zoomWithWheel(e);
    updateZoomDisplay();
  }, { passive: false });

  svgEl.addEventListener('panzoomchange', updateZoomDisplay);

  if (fitToView) {
    // Delay to ensure SVG is rendered
    requestAnimationFrame(() => {
      fitSvgToView(svgEl);
    });
  } else {
    updateZoomDisplay();
  }
}

function fitSvgToView(svgEl: SVGSVGElement) {
  if (!panzoom) return;
  const viewport = svgEl.querySelector('#viewport') as SVGGElement | null;
  if (!viewport) return;

  const container = svgEl.parentElement!;
  const cW = container.clientWidth;
  const cH = container.clientHeight;

  const bbox = viewport.getBBox();
  let svgW = bbox.width;
  let svgH = bbox.height;

  if (svgW === 0 || svgH === 0) { svgW = cW; svgH = cH; }

  const padding = 40;
  const scaleX = (cW - padding * 2) / svgW;
  const scaleY = (cH - padding * 2) / svgH;
  const scale = Math.min(scaleX, scaleY, 4); // cap at 4x

  panzoom.zoom(scale, { animate: false });
  panzoom.pan(
    (cW - svgW * scale) / 2 - bbox.x * scale,
    (cH - svgH * scale) / 2 - bbox.y * scale,
    { animate: false }
  );
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
}

function undo() {
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
  layer.svg = svg;
  previewContainer.innerHTML = svg;
  svgSourceEl.textContent = getExportableSvg(svg);
  editor?.setLayer(layer);
  initPanzoom(true);
}

function updateHistoryBtns() {
  const undoBtn = document.getElementById('btn-undo') as HTMLButtonElement;
  const redoBtn = document.getElementById('btn-redo') as HTMLButtonElement;
  undoBtn.disabled = undoHistory.length <= 1;
  redoBtn.disabled = redoHistory.length === 0;
}

// ── Actions ───────────────────────────────────────────────────────

document.getElementById('btn-download')!.addEventListener('click', () => {
  const layer = convertedLayers[activeLayerIndex];
  if (layer) dlSvg(getExportableSvg(layer.svg), `${sanitize(layer.name)}.svg`);
});

document.getElementById('btn-download-all')!.addEventListener('click', () => {
  convertedLayers.forEach(l => dlSvg(getExportableSvg(l.svg), `${sanitize(l.name)}.svg`));
  showToast(`Downloaded ${convertedLayers.length} SVG files`);
});

document.getElementById('btn-copy')!.addEventListener('click', async () => {
  const layer = convertedLayers[activeLayerIndex];
  if (!layer) return;
  const exportable = getExportableSvg(layer.svg);
  try {
    await navigator.clipboard.writeText(exportable);
    showToast('SVG source copied to clipboard');
  } catch {
    const ta = document.createElement('textarea');
    ta.value = exportable;
    document.body.appendChild(ta); ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('SVG source copied to clipboard');
  }
});

document.getElementById('btn-copy-source')!.addEventListener('click', async (e) => {
  e.stopPropagation();
  const layer = convertedLayers[activeLayerIndex];
  if (!layer) return;
  const exportable = getExportableSvg(layer.svg);
  await navigator.clipboard.writeText(exportable).catch(() => {});
  showToast('Copied!');
});

document.getElementById('btn-reset')!.addEventListener('click', () => {
  convertedLayers = []; activeLayerIndex = 0;
  studio.hidden = true; dropZone.hidden = false;
  fileInputXcs.value = ''; fileInputSvg.value = '';
  previewContainer.innerHTML = ''; svgSourceEl.textContent = '';
  statsEl.innerHTML = ''; layerTabs.innerHTML = '';
  editor = null;
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
  propStrokeColor.addEventListener('input', () => { propStrokeHex.value = propStrokeColor.value; });
  propStrokeHex.addEventListener('input', () => {
    if (/^#[0-9a-f]{6}$/i.test(propStrokeHex.value)) propStrokeColor.value = propStrokeHex.value;
  });
  propFillColor.addEventListener('input', () => { propFillHex.value = propFillColor.value; });
  propFillHex.addEventListener('input', () => {
    if (/^#[0-9a-f]{6}$/i.test(propFillHex.value)) propFillColor.value = propFillHex.value;
  });
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

// ── Startup ───────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Wait for initial render, then trigger landing tour
  setTimeout(() => runLandingTour(), 500);
});
