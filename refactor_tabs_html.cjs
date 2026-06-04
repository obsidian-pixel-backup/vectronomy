const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');

const layersStart = html.indexOf('<!-- ── Right Layers Panel ────────────────────────── -->');
let propsStart = html.indexOf('<!-- ── Right Properties Panel ────────────────────────── -->');
let helpStart = html.indexOf('<!-- ── Help & Tutorials Route ──────────────────────────────── -->');

if (layersStart !== -1 && propsStart !== -1 && helpStart !== -1) {
  const layersPanelChunk = html.substring(layersStart, propsStart);
  let layersContent = '';
  const layersContentMatch = layersPanelChunk.match(/<div class="panel-content" id="layers-content">([\s\S]*?)<\/div>\s*<\/aside>/);
  if (layersContentMatch) layersContent = layersContentMatch[1];

  const propsPanelChunk = html.substring(propsStart, helpStart);
  let propsContent = '';
  const propsContentMatch = propsPanelChunk.match(/<div class="panel-content" id="properties-content">([\s\S]*?)<\/aside>/);
  if (propsContentMatch) {
    let pc = propsContentMatch[1].trim();
    if (pc.endsWith('</div>')) pc = pc.substring(0, pc.lastIndexOf('</div>')).trim();
    propsContent = pc;
  }

  const combinedPanel = `
          <!-- ── Right Panel ────────────────────────── -->
          <aside id="right-panel" class="properties-panel glass">
            <div class="properties-header panel-header right-panel-header" style="flex-direction: row; justify-content: space-between; align-items: center; padding: 6px 12px; gap: 8px;">
              <div class="panel-tabs">
                <button class="tab-btn active" data-target="layers-content">Layers</button>
                <button class="tab-btn" data-target="properties-content">Properties</button>
              </div>
              <button id="btn-right-collapse" class="btn-icon" title="Toggle Right Panel">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><polyline points="13 17 18 12 13 7"></polyline><line x1="6" y1="17" x2="11" y2="12"></line><line x1="6" y1="7" x2="11" y2="12"></line></svg>
              </button>
            </div>
            
            <div class="panel-content" id="layers-content">
${layersContent}
            </div>
            <div class="panel-content" id="properties-content" style="display: none;">
${propsContent}
            </div>
          </aside>
`;

  const asideEnd = html.lastIndexOf('</aside>', helpStart);
  if (asideEnd !== -1) {
     html = html.substring(0, layersStart) + combinedPanel + '\n          ' + html.substring(asideEnd + '</aside>'.length);
     fs.writeFileSync('index.html', html);
     console.log('index.html processed');
  } else {
     console.log('could not find </aside>');
  }
} else {
  console.log('could not find start boundaries');
}
