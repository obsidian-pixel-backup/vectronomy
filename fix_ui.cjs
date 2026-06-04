const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');

const typographyPanel = `
                <!-- Typography Properties -->
                <div class="prop-section" id="prop-section-typography" hidden>
                  <div class="prop-section-title">Typography</div>
                  
                  <div class="prop-row">
                    <div class="input-field" style="flex:1;">
                      <span>Family</span>
                      <select id="prop-font-family" class="prop-select" style="width:100%;">
                        <option value="sans-serif">Sans-Serif</option>
                        <option value="serif">Serif</option>
                        <option value="monospace">Monospace</option>
                        <option value="'Inter', sans-serif">Inter</option>
                      </select>
                    </div>
                  </div>
                  
                  <div class="prop-row" style="margin-top:8px;">
                    <div class="input-field">
                      <span>Size</span>
                      <input type="number" id="prop-font-size" min="1" step="1" placeholder="16" />
                    </div>
                    
                    <div class="input-field" style="flex-direction:row; justify-content:space-between; gap:4px; padding:0; background:none;">
                      <button id="btn-font-weight" class="btn btn-secondary btn-sm" style="flex:1; padding: 4px;" title="Bold">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>
                      </button>
                      <button id="btn-font-style" class="btn btn-secondary btn-sm" style="flex:1; padding: 4px;" title="Italic">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>
                      </button>
                    </div>
                  </div>

                  <div class="prop-row" style="margin-top:8px;">
                    <div class="input-field">
                      <span>Letter Spc</span>
                      <input type="number" id="prop-letter-spacing" step="0.1" placeholder="0" />
                    </div>
                    <div class="input-field">
                      <span>Word Spc</span>
                      <input type="number" id="prop-word-spacing" step="0.1" placeholder="0" />
                    </div>
                  </div>
                  
                  <div class="prop-row" style="margin-top:8px;">
                    <div class="align-grid" style="grid-template-columns: repeat(3, 1fr); width:100%;">
                      <button class="align-btn" id="btn-text-align-start" title="Align Left (Start)">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="19" y2="18"/></svg>
                      </button>
                      <button class="align-btn" id="btn-text-align-middle" title="Align Center (Middle)">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><line x1="3" y1="6" x2="21" y2="6"/><line x1="5" y1="12" x2="19" y2="12"/><line x1="7" y1="18" x2="17" y2="18"/></svg>
                      </button>
                      <button class="align-btn" id="btn-text-align-end" title="Align Right (End)">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="5" y1="18" x2="21" y2="18"/></svg>
                      </button>
                    </div>
                  </div>
                  
                  <div class="prop-row" style="margin-top:8px;">
                    <button class="btn btn-secondary btn-sm" id="btn-warp-path" style="width:100%; justify-content:center;" title="Warp Text to Selected Path">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" style="margin-right: 6px;"><path d="M4 12c4-8 12-8 16 0"/><path d="M7 16l3-4 4 4"/></svg>
                      Warp to Path
                    </button>
                  </div>
                </div>
`;

// Insert the typography panel after Pathfinder
html = html.replace('<!-- Node Align -->', typographyPanel + '\\n                <!-- Node Align -->');

const bridgeHtml = `
                  </div>
                  <div class="prop-row" style="margin-top:8px;">
                    <div class="input-field" style="flex:1;">
                      <span>Bridge W</span>
                      <input type="number" id="prop-bridge-width" step="0.1" value="2.0" />
                    </div>
                    <button class="btn btn-secondary btn-sm" id="btn-stencil-bridge" title="Inject Stencil Bridges">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" style="margin-right: 6px;"><path d="M4 12h4m8 0h4M12 4v4m0 8v4" stroke-dasharray="2 2"/></svg>
                      Bridge
                    </button>
                  </div>
                </div>`;

html = html.replace('</button>\\n                  </div>\\n                </div>', '</button>\\n' + bridgeHtml);

const textTool = `
            <div class="tool-group">
              <button class="tool-btn" id="tool-text" title="Typography / Text (T)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/></svg>
              </button>
            </div>

            <div class="tool-divider"></div>
`;

html = html.replace('<div class="tool-group">\\n              <button class="tool-btn" id="tool-node"', textTool + '<div class="tool-group">\\n              <button class="tool-btn" id="tool-node"');


fs.writeFileSync('index.html', html);
console.log('Fixed index.html!');
