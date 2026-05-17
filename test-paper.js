const paper = require('paper');
const canvas = require('canvas').createCanvas(1, 1);
paper.setup(canvas);

const svg = '<svg viewBox="100 100 500 500" width="100mm" height="100mm"><g><rect x="200" y="200" width="100" height="100"/></g></svg>';
paper.project.importSVG(svg);
console.log(paper.project.exportSVG({ asString: true }));
