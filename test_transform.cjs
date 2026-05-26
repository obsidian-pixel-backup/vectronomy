const paper = require('paper');
paper.setup(new paper.Size(100, 100));

const svg1 = '<rect x="0" y="0" width="10" height="10" transform="translate(50, 50)" />';
const item1 = paper.project.importSVG(svg1);

console.log('Item1 bounds:', item1.bounds.toString());

let path = item1;
if(item1.children) path = item1.children[0];
if(path.toPath) path = path.toPath(false);

console.log('Path bounds before transform:', path.bounds.toString());

const cloned = path.clone({ insert: false });
paper.project.activeLayer.addChild(cloned);

console.log('Cloned bounds before globalMatrix:', cloned.bounds.toString());

cloned.transform(item1.globalMatrix);

console.log('Cloned bounds after globalMatrix:', cloned.bounds.toString());
console.log('Exported:', cloned.exportSVG({ asString: true }));
