const fs = require('fs');
let ts = fs.readFileSync('src/main.ts', 'utf8');

// 1. Add 't' to shortcuts
ts = ts.replace("if (!inInput && e.key === 'n') switchTool('node');", "if (!inInput && e.key === 'n') switchTool('node');\\n    if (!inInput && e.key === 't') switchTool('text');");

// 2. Toggle typography visibility in initEditor
ts = ts.replace(`        propsEmpty.hidden = true;
        propsSelection.hidden = false;
        populateProps(props);`, `        propsEmpty.hidden = true;
        propsSelection.hidden = false;
        populateProps(props);
        
        const typoSection = document.getElementById('prop-section-typography');
        if (typoSection) {
          typoSection.hidden = (props.elementType.toLowerCase() !== 'text');
        }`);

// 3. populateProps
const popTarget = `  propFillHex.value = fc;
  propFillOp.value = \`\${p.fillOpacity}\`;
  propFillRule.value = p.fillRule;
}`;
const popInjection = `  propFillHex.value = fc;
  propFillOp.value = \`\${p.fillOpacity}\`;
  propFillRule.value = p.fillRule;

  if (p.elementType.toLowerCase() === 'text') {
    const propFontFamily = document.getElementById('prop-font-family');
    const propFontSize = document.getElementById('prop-font-size');
    const propLetterSpacing = document.getElementById('prop-letter-spacing');
    const propWordSpacing = document.getElementById('prop-word-spacing');
    const btnFontWeight = document.getElementById('btn-font-weight');
    const btnFontStyle = document.getElementById('btn-font-style');
    
    if (propFontFamily) propFontFamily.value = p.fontFamily || 'sans-serif';
    if (propFontSize) propFontSize.value = (p.fontSize || 16).toString();
    if (propLetterSpacing) propLetterSpacing.value = (p.letterSpacing || 0).toString();
    if (propWordSpacing) propWordSpacing.value = (p.wordSpacing || 0).toString();
    
    if (btnFontWeight) btnFontWeight.classList.toggle('active', p.fontWeight === 'bold');
    if (btnFontStyle) btnFontStyle.classList.toggle('active', p.fontStyle === 'italic');
    
    const alignStart = document.getElementById('btn-text-align-start');
    const alignMiddle = document.getElementById('btn-text-align-middle');
    const alignEnd = document.getElementById('btn-text-align-end');
    
    if (alignStart) alignStart.classList.toggle('active', p.textAnchor === 'start');
    if (alignMiddle) alignMiddle.classList.toggle('active', p.textAnchor === 'middle');
    if (alignEnd) alignEnd.classList.toggle('active', p.textAnchor === 'end');
  }
}`;
ts = ts.replace(popTarget, popInjection);

// 4. bindPropInputs for Typography
const bindTarget = `  // Keep hex text fields in sync with color pickers and vice-versa`;
const bindInjection = `  // Typography bindings
  const propFontFamily = document.getElementById('prop-font-family');
  const propFontSize = document.getElementById('prop-font-size');
  const propLetterSpacing = document.getElementById('prop-letter-spacing');
  const propWordSpacing = document.getElementById('prop-word-spacing');
  const btnFontWeight = document.getElementById('btn-font-weight');
  const btnFontStyle = document.getElementById('btn-font-style');
  const btnTextAlignStart = document.getElementById('btn-text-align-start');
  const btnTextAlignMiddle = document.getElementById('btn-text-align-middle');
  const btnTextAlignEnd = document.getElementById('btn-text-align-end');

  const pushTypo = () => {
    if (suppressPropUpdates || !editor) return;
    editor.updateProperties({
      fontFamily: propFontFamily?.value,
      fontSize: parseFloat(propFontSize?.value) || 16,
      letterSpacing: parseFloat(propLetterSpacing?.value) || 0,
      wordSpacing: parseFloat(propWordSpacing?.value) || 0,
      fontWeight: btnFontWeight?.classList.contains('active') ? 'bold' : 'normal',
      fontStyle: btnFontStyle?.classList.contains('active') ? 'italic' : 'normal',
      textAnchor: btnTextAlignStart?.classList.contains('active') ? 'start' :
                  btnTextAlignMiddle?.classList.contains('active') ? 'middle' :
                  btnTextAlignEnd?.classList.contains('active') ? 'end' : 'start'
    });
  };

  [propFontFamily, propFontSize, propLetterSpacing, propWordSpacing].forEach(el => {
    if (el) {
      el.addEventListener('input', pushTypo);
      el.addEventListener('change', pushTypo);
    }
  });

  btnFontWeight?.addEventListener('click', () => {
    btnFontWeight.classList.toggle('active');
    pushTypo();
  });

  btnFontStyle?.addEventListener('click', () => {
    btnFontStyle.classList.toggle('active');
    pushTypo();
  });

  [btnTextAlignStart, btnTextAlignMiddle, btnTextAlignEnd].forEach((btn) => {
    btn?.addEventListener('click', () => {
      [btnTextAlignStart, btnTextAlignMiddle, btnTextAlignEnd].forEach(b => b?.classList.remove('active'));
      btn.classList.add('active');
      pushTypo();
    });
  });

  // Feature 76/77 Warp
  document.getElementById('btn-warp-path')?.addEventListener('click', () => {
    if (editor) (editor as any).warpTextToPath?.();
  });

  // Feature 79 Stencil
  document.getElementById('btn-stencil-bridge')?.addEventListener('click', () => {
    if (editor) {
      const w = parseFloat((document.getElementById('prop-bridge-width') as HTMLInputElement)?.value) || 2.0;
      (editor as any).injectStencilBridges?.(w);
    }
  });

  // Keep hex text fields in sync with color pickers and vice-versa`;
ts = ts.replace(bindTarget, bindInjection);

fs.writeFileSync('src/main.ts', ts);
console.log('Fixed src/main.ts!');
