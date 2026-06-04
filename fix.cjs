const fs = require('fs');
let code = fs.readFileSync('src/main.ts', 'utf8');

const startIdx = code.indexOf("const mainSvg = previewContainer.querySelector('svg');");
if (startIdx !== -1) {
    const endStr = "      }";
    const endIdx = code.indexOf(endStr, code.indexOf("editor.renderSelectionUI();", startIdx));
    if (endIdx !== -1) {
        const toReplace = code.substring(startIdx, endIdx + endStr.length);
        console.log("Found chunk to replace:", toReplace.length, "characters");
        const replacement = `if (editor) {\n        editor.insertImage(dataUrl, x, y, w, h);\n      }`;
        code = code.substring(0, startIdx) + replacement + code.substring(endIdx + endStr.length);
        fs.writeFileSync('src/main.ts', code);
    } else {
        console.log("End index not found!");
    }
} else {
    console.log("Start index not found!");
}
