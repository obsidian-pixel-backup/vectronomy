const paper = require('./node_modules/paper/dist/paper-core.js');
paper.setup(new paper.Size(1000, 1000));

const svg1 = `<svg xmlns="http://www.w3.org/2000/svg"><rect x="100" y="100" width="100" height="100" fill="red" /></svg>`;
const svg2 = `<svg xmlns="http://www.w3.org/2000/svg"><g transform="matrix(1 0 0 1 0 0)">
  <path d="M 140 150 A 10 10 0 1 0 160 150 A 10 10 0 1 0 140 150 Z" fill="black" fill-rule="nonzero" />
</g></svg>`;

const item1 = paper.project.importSVG(svg1);
const item2 = paper.project.importSVG(svg2);

function findPath(item) {
  if (item instanceof paper.PathItem) {
    const cloned = item.clone({ insert: false });
    cloned.transform(item.globalMatrix);
    return cloned;
  }
  if (item instanceof paper.Shape) {
    const path = item.toPath(false);
    path.transform(item.globalMatrix);
    return path;
  }
  if (item.children) {
    let combined = null;
    for (const child of item.children) {
      const found = findPath(child);
      if (found) {
        if (!combined) {
          combined = found;
        } else {
          combined = combined.unite(found, { insert: false });
        }
      }
    }
    return combined;
  }
  return null;
}

const path1 = findPath(item1);
const path2 = findPath(item2);

console.log("path1.bounds:", path1.bounds);
console.log("path2.bounds:", path2.bounds);
console.log("intersects:", path1.intersects(path2));
console.log("contains 1 in 2:", path2.contains(path1.bounds.center));
console.log("contains 2 in 1:", path1.contains(path2.bounds.center));

const result = path1.subtract(path2);
console.log("Result type:", result.className);
console.log("Result bounds:", result.bounds);
console.log("Result SVG:", result.exportSVG({ asString: true }));
