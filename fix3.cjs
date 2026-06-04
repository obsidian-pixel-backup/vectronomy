const fs = require('fs');
let code = fs.readFileSync('src/engine/editor.ts', 'utf8');

const regex = /rect\.setAttribute\('fill', 'rgba\(0,255,194,0\.04\)'\);\s*rect\.setAttribute\('stroke', '#00ffc2'\);/;
code = code.replace(regex, `      let highlightColor = '#00ffc2';
      let fillColor = 'rgba(0,255,194,0.04)';
      const groupEl = els.find(e => e.hasAttribute('data-group-color')) || els[0]?.closest('[data-group-color]');
      if (groupEl) {
        highlightColor = groupEl.getAttribute('data-group-color') || '#00ffc2';
        fillColor = 'transparent'; // Remove fill if it's a custom group color
      }
      rect.setAttribute('fill', fillColor);
      rect.setAttribute('stroke', highlightColor);`);

fs.writeFileSync('src/engine/editor.ts', code);
