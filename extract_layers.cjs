const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const layersPanelHtml = `
          <!-- ── Right Layers Panel ────────────────────────── -->
          <aside id="layers-panel" class="properties-panel glass">
            <div class="properties-header panel-header layers-header">
              <h2 class="panel-title" id="layers-title">Layers</h2>
              <button id="btn-layers-collapse" class="btn-icon" title="Toggle Layers Panel">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><polyline points="13 17 18 12 13 7"></polyline><line x1="6" y1="17" x2="11" y2="12"></line><line x1="6" y1="7" x2="11" y2="12"></line></svg>
              </button>
            </div>
            <div class="panel-content" id="layers-content">
              <!-- Layer Tree -->
              <div id="props-layers" class="prop-section" style="padding-bottom: 15px; margin-bottom: 15px;">
                <div class="prop-section-title" style="display:flex; justify-content:space-between; align-items:center;">
                  <div style="display:flex; gap:8px; align-items:center;">
                    <button id="btn-group" class="btn-icon" title="Group (Ctrl+G)"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="14" height="14" rx="2"/><rect x="7" y="7" width="14" height="14" rx="2"/></svg></button>
                    <button id="btn-ungroup" class="btn-icon" title="Ungroup (Ctrl+Shift+G)"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/></svg></button>
                  </div>
                </div>
                <div id="layer-tree-container" class="layer-tree-container"></div>
              </div>
            </div>
          </aside>`;

// Extract existing layers logic
const propsLayersRegex = /<!-- Layer Tree -->[\s\S]*?<div id="layer-tree-container" class="layer-tree-container"><\/div>[\s\S]*?<\/div>\s*<\/div>/;
const match = html.match(propsLayersRegex);

if (match) {
    html = html.replace(propsLayersRegex, '');
    html = html.replace('<!-- ── Right Properties Panel ────────────────────────── -->', layersPanelHtml + '\n\n          <!-- ── Right Properties Panel ────────────────────────── -->');
    fs.writeFileSync('index.html', html);
    console.log('Modified index.html successfully');
} else {
    console.log('Could not find layer tree section to extract');
}
