const paper = require('paper');
paper.setup(new paper.Size(800, 600));

const svgStr = '<svg><rect x="10" y="10" width="100" height="100" fill="none" stroke="black" stroke-width="2" /></svg>';
const eraserSvg = '<svg><circle cx="60" cy="10" r="20" fill="black" /></svg>';

const item1 = paper.project.importSVG(svgStr);
const item2 = paper.project.importSVG(eraserSvg);

const findPath = (item) => {
    if (item instanceof paper.PathItem) return item;
    if (item instanceof paper.Shape) return item.toPath(false);
    if (item.children) {
        for (let child of item.children) {
            let found = findPath(child);
            if (found) return found;
        }
    }
    return null;
}

const path1 = findPath(item1);
const path2 = findPath(item2);

console.log("Path 1:", path1.toString(), "fill:", path1.fillColor);
console.log("Path 2:", path2.toString(), "fill:", path2.fillColor);

const result = path1.subtract(path2);
console.log("Result:", result.exportSVG({asString: true}));
