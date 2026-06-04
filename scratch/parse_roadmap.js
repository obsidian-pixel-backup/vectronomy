const fs = require('fs');

const content = fs.readFileSync('VECTRONOMY_ROADMAP_AND_DOCUMENTATION.md', 'utf-8');
const lines = content.split('\n');

let currentSection = '';
const unshippedFeatures = [];

for (const line of lines) {
  if (line.startsWith('### ')) {
    currentSection = line.substring(4).trim();
  } else if (/^[0-9]+\.\s/.test(line.trim())) {
    if (!line.includes('[SHIPPED]')) {
      unshippedFeatures.push({ section: currentSection, feature: line.trim() });
    }
  }
}

console.log(JSON.stringify(unshippedFeatures, null, 2));
