const paper = require('paper');
paper.setup(new paper.Size(800, 600));

const svgStr = '<svg><rect x="100" y="100" width="50" height="50"/></svg>';
const item = paper.project.importSVG(svgStr);
let shape = item.children[0];

const p = shape.toPath(false);
console.log("Segments:", p.segments.length);
console.log("Bounds:", p.bounds.toString());

const eraser = new paper.Path.Circle({
    center: [100, 125], // Exactly on the left edge
    radius: 10
});

console.log("Eraser bounds:", eraser.bounds.toString());

const intersections = p.getIntersections(eraser);
console.log("Intersections:", intersections.length);
if (intersections.length > 0) {
    console.log("Intersection 0 offset:", intersections[0].offset);
}
