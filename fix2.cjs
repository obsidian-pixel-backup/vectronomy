const fs = require('fs');
const path = 'E:/DEVELOPER PROJECTS/vectronomy/src/main.ts';
let content = fs.readFileSync(path, 'utf8');

const lines = content.split(/\r?\n/);

// Find the line with `const px = e.clientX - rect.left;`
const pxLineIndex = lines.findIndex(l => l.includes('const px = e.clientX - rect.left;'));
if (pxLineIndex === -1) throw new Error("Could not find px line");

// Find the line with `setTimeout(() => runEditorTour(), 500);`
const endLineIndex = lines.findIndex((l, i) => i > pxLineIndex && l.includes('setTimeout(() => runEditorTour(), 500);'));
if (endLineIndex === -1) throw new Error("Could not find end line");

// The replacement block
const replacement = `    const py = e.clientY - rect.top;

    const oldScale = panzoom.getScale();
    const pan = panzoom.getPan();
    const oldTx = pan.x * oldScale;
    const oldTy = pan.y * oldScale;

    // Zoom speed step and boundaries
    const zoomFactor = 1.15;
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
}`;

const before = lines.slice(0, pxLineIndex + 1).join('\n');
const after = lines.slice(endLineIndex + 2).join('\n'); // skip the closing '}'

fs.writeFileSync(path, before + '\n' + replacement + '\n' + after);
console.log("Fix applied successfully!");
