const paper = require('paper');
paper.setup(new paper.Size(100, 100));

const svg1 = '<g transform="scale(2)"><rect x="10" y="10" width="10" height="10" transform="translate(10, 10)" /></g>';
const item1 = paper.project.importSVG(svg1);

function findPath(item) {
    if (item instanceof paper.PathItem) {
      const cloned = item.clone({ insert: false });
      paper.project.activeLayer.addChild(cloned);
      
      cloned.applyMatrix = false;
      cloned.matrix.reset();
      cloned.applyMatrix = true;
      cloned.transform(item.globalMatrix);
      return cloned;
    }
    if (item instanceof paper.Shape) {
      const path = item.toPath(false);
      paper.project.activeLayer.addChild(path);
      path.applyMatrix = true;
      path.transform(item.globalMatrix);
      return path;
    }
    if (item.children) {
      let combined = null;
      const children = [...item.children];
      for (const child of children) {
        const found = findPath(child);
        if (found) {
          if (!combined) {
            combined = found;
          } else {
            combined = combined.unite(found);
          }
        }
      }
      return combined;
    }
    return null;
}

const path = findPath(item1);
console.log('Exported:', path.exportSVG({ asString: true }));
