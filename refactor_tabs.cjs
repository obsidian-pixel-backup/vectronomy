const fs = require('fs');

// 1. Process index.html
let html = fs.readFileSync('index.html', 'utf8');

// Find the boundaries of both panels
const layersStart = html.indexOf('<!-- ── Right Layers Panel ────────────────────────── -->');
let propsStart = html.indexOf('<!-- ── Right Properties Panel ────────────────────────── -->');
let helpStart = html.indexOf('<!-- ── App Help & Settings Overlay ── -->');

if (layersStart !== -1 && propsStart !== -1 && helpStart !== -1) {
  // Extract layers content (the <div id="props-layers">...</div>)
  const layersPanelChunk = html.substring(layersStart, propsStart);
  let layersContent = '';
  const layersContentMatch = layersPanelChunk.match(/<div class="panel-content" id="layers-content">([\s\S]*?)<\/div>\s*<\/aside>/);
  if (layersContentMatch) layersContent = layersContentMatch[1];

  // Extract properties content
  const propsPanelChunk = html.substring(propsStart, helpStart);
  let propsContent = '';
  const propsContentMatch = propsPanelChunk.match(/<div class="panel-content" id="properties-content">([\s\S]*?)<\/aside>/);
  if (propsContentMatch) {
    // Note: the properties content has a trailing </div> for panel-content, so we take care to strip the last </div> from the regex match
    let pc = propsContentMatch[1].trim();
    if (pc.endsWith('</div>')) pc = pc.substring(0, pc.lastIndexOf('</div>')).trim();
    propsContent = pc;
  }

  const combinedPanel = `
          <!-- ── Right Panel ────────────────────────── -->
          <aside id="right-panel" class="properties-panel glass">
            <div class="properties-header panel-header">
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

  html = html.substring(0, layersStart) + combinedPanel + '\n          ' + html.substring(helpStart);
  fs.writeFileSync('index.html', html);
  console.log('index.html processed');
}

// 2. Process style.css
let css = fs.readFileSync('src/style.css', 'utf8');

// Replace .editor-layout block
css = css.replace(/\.editor-layout \{[\s\S]*?\.editor-layout\.layers-collapsed \{[\s\S]*?\}/, `.editor-layout {
  flex:1; display:grid;
  grid-template-columns: 50px 1fr 272px;
  gap:16px; min-height:0;
  transition: grid-template-columns 0.3s cubic-bezier(0.19, 1, 0.22, 1);
}

.editor-layout.right-collapsed {
  grid-template-columns: 50px 1fr 50px;
}`);

// Replace the collapsed header styles
css = css.replace(/\.editor-layout\.layers-collapsed #layers-panel \.properties-header,[\s\S]*?\.editor-layout\.props-collapsed #properties-panel \.panel-content \{[\s\S]*?\}/, `.editor-layout.right-collapsed .properties-header {
  flex-direction: column-reverse;
  padding: 12px 0;
  gap: 12px;
  justify-content: center;
}

.editor-layout.right-collapsed .panel-tabs {
  flex-direction: column;
  gap: 12px;
}

.editor-layout.right-collapsed .tab-btn {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  transform: rotate(180deg);
  letter-spacing: 0.1em;
  white-space: nowrap;
}

.editor-layout.right-collapsed #btn-right-collapse svg {
  transform: rotate(180deg);
}

.editor-layout.right-collapsed .panel-content {
  display: none !important;
}`);

// Add tab styles
if (!css.includes('.panel-tabs')) {
  css += `
/* ── Right Panel Tabs ── */
.panel-tabs {
  display: flex;
  gap: 8px;
  align-items: center;
  flex: 1;
}

.tab-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  transition: background 0.2s, color 0.2s;
}

.tab-btn:hover {
  color: var(--text-primary);
  background: rgba(255,255,255,0.05);
}

.tab-btn.active {
  color: var(--accent);
  background: rgba(255,255,255,0.1);
}
`;
}

fs.writeFileSync('src/style.css', css);
console.log('style.css processed');


// 3. Process main.ts
let ts = fs.readFileSync('src/main.ts', 'utf8');

const collapseLogic = `// ── Right Panel Collapse & Tabs ────────────────────────────────────
const btnRightCollapse = document.getElementById('btn-right-collapse');
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
});`;

// Replace the old collapse logic
ts = ts.replace(/\/\/ ── Properties Panel Collapse ────────────────────────────────────[\s\S]*?if \(btnLayersCollapse\) \{[\s\S]*?\}\s*\}/, collapseLogic);

fs.writeFileSync('src/main.ts', ts);
console.log('main.ts processed');
