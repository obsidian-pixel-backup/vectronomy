const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

// 1. Replace the header
const oldHeader = `<div class="properties-header panel-header">
              <h2 class="panel-title" id="properties-title">Properties</h2>
              <button id="btn-prop-collapse" class="btn-icon" title="Toggle Properties Panel">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><polyline points="13 17 18 12 13 7"></polyline><line x1="6" y1="17" x2="11" y2="12"></line><line x1="6" y1="7" x2="11" y2="12"></line></svg>
              </button>
            </div>`;

const newHeader = `<div class="properties-header panel-header" style="padding: 0; display: flex;">
              <div class="panel-tabs" style="display: flex; width: 100%; align-items: center; border-bottom: 1px solid var(--glass-border);">
                <button class="tab-btn active" data-target="properties-content">Properties</button>
                <button class="tab-btn" data-target="layers-content">Layer Tree</button>
                <button id="btn-prop-collapse" class="btn-icon" title="Toggle Properties Panel" style="margin-left: auto; margin-right: 8px;">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><polyline points="13 17 18 12 13 7"></polyline><line x1="6" y1="17" x2="11" y2="12"></line><line x1="6" y1="7" x2="11" y2="12"></line></svg>
                </button>
              </div>
            </div>`;

html = html.replace(oldHeader, newHeader);

// 2. Extract Layer Tree
const layerTreeRegex = /<!-- Layer Tree -->[\s\S]*?<div id="layer-tree-container" class="layer-tree-container"><\/div>\s*<\/div>/;
const match = html.match(layerTreeRegex);
if (match) {
  let layerTreeHtml = match[0];
  html = html.replace(match[0], ''); // Remove from original place
  
  // Clean up layer tree styles to fit the new tab
  layerTreeHtml = layerTreeHtml.replace('style="border-bottom: 1px solid var(--glass-border); padding-bottom: 15px; margin-bottom: 15px;"', 'style="border-bottom: none; height: 100%; display: flex; flex-direction: column;"');
  layerTreeHtml = layerTreeHtml.replace('<div id="layer-tree-container" class="layer-tree-container"></div>', '<div id="layer-tree-container" class="layer-tree-container" style="flex: 1; overflow-y: auto;"></div>');
  layerTreeHtml = layerTreeHtml.replace('justify-content:space-between;', 'justify-content:flex-end; margin-bottom: 8px;');
  
  // Wrap in layers-content and append before </aside>
  const targetTag = '            </div>\n          </aside>';
  const replacementTag = `            </div>\n\n            <div class="panel-content" id="layers-content" style="display: none;">\n              ${layerTreeHtml}\n            </div>\n          </aside>`;
  
  html = html.replace(targetTag, replacementTag);
  console.log("Replaced successfully!");
} else {
  console.log("Could not find layer tree.");
}

fs.writeFileSync(indexPath, html);
