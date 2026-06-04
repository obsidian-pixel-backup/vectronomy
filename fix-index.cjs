const fs = require('fs');
const lines = fs.readFileSync('e:/DEVELOPER PROJECTS/vectronomy/index.html', 'utf8').split(/\r?\n/);
const newBlock = `              <h4>The Node Editor (<kbd>N</kbd>)</h4>
              <p>The Node tool is your most powerful asset for fine-tuning geometry. Select it and click any path or shape to reveal its anchor nodes.</p>
              <ul>
                <li><strong>Move Nodes:</strong> Drag the white square nodes to physically reshape the geometry.</li>
                <li><strong>Bezier Handles:</strong> When you select a smooth node, control handles (antennas) appear. Drag the circular ends to adjust the trajectory and steepness of the curve.</li>
                <li><strong>Curve Segments:</strong> You can click and drag directly on the path stroke between two nodes to dynamically bend the segment without needing to grab the handles.</li>
                <li><strong>Add/Delete Nodes:</strong> Double-click anywhere on the path stroke to inject a new node. Click an existing node and press <kbd>Delete</kbd> to remove it while preserving the surrounding path continuity as much as possible.</li>
                <li><strong>Multi-Select:</strong> Hold <kbd>Shift</kbd> while clicking multiple nodes to move them together.</li>
              </ul>

              <h4>Drawing Pens & Brushes</h4>
              <p>Found under the pen dropdown menu in the toolbar, these tools let you create custom freeform or precise paths.</p>
              <ul>
                <li><strong>Bezier Pen (<kbd>P</kbd>):</strong> The industry standard for precision drawing and manual image tracing. Click to create sharp corner nodes. Click and drag to create smooth, continuous bezier curves. Hold <kbd>Shift</kbd> to constrain line angles to 45-degree increments. Press <kbd>Esc</kbd> to finish an open path, or click your starting node to create a closed shape.</li>
                <li><strong>Freehand Pencil (<kbd>K</kbd>):</strong> Great for rapid sketching. Click and drag to freely draw natural lines. The software automatically applies a smoothing algorithm to simplify your raw mouse movements into clean, mathematically optimized vector paths with minimal nodes.</li>
                <li><strong>Vector Brush (<kbd>B</kbd>):</strong> Simulates a physical brush. Instead of a single stroked line, the brush instantly expands your stroke into a filled vector shape with variable thickness. Excellent for expressive typography, organic art, and tablet stylus workflows. Adjust the brush size and style in the right properties panel.</li>
              </ul>

              <h4>Geometric Shapes</h4>
              <p>The shapes dropdown gives you access to a library of parametric geometry. For all shapes, holding <kbd>Shift</kbd> while dragging constrains proportions (creating perfect circles, perfect squares, or straight lines).</p>
              <ul>
                <li><strong>Line Segment (<kbd>L</kbd>):</strong> Draws a simple two-point straight line. Hold <kbd>Shift</kbd> to snap horizontally, vertically, or at perfect 45-degree angles.</li>
                <li><strong>Polyline (<kbd>Y</kbd>):</strong> Draws continuous straight line segments without curving. Click to drop each corner node, and press <kbd>Esc</kbd> or double-click to finish the shape.</li>
                <li><strong>Rectangle (<kbd>R</kbd>) & Ellipse (<kbd>E</kbd>):</strong> The foundational building blocks. Drag from corner to corner to define the bounding box.</li>
                <li><strong>Polygon (<kbd>O</kbd>) & Star (<kbd>S</kbd>):</strong> Highly parametric shapes. After drawing, use the right properties panel to dynamically adjust the number of sides or points, the inner radius ratio for stars, and even apply non-destructive corner rounding.</li>
                <li><strong>Logarithmic Spiral (<kbd>I</kbd>):</strong> Generates perfect mathematical spirals that expand outward. Highly useful for organic design layouts or calculating mechanical cam profiles.</li>
              </ul>

              <h4>Advanced Raster-Style Tools</h4>
              <p>Vectronomy blurs the line between raster painting and vector mathematics with these advanced, intuitive tools.</p>
              <ul>
                <li><strong>Eraser Tool (<kbd>E</kbd>):</strong> Acts like a physical eraser but operates on pure vector math. Click and drag over existing vector paths to physically slice them apart. The engine intelligently calculates boolean intersections and will automatically close the resulting shapes or cleanly sever open paths.</li>
                <li><strong>Magic Wand (<kbd>W</kbd>):</strong> Click on any shape to instantly select all other shapes in the document that share similar fill colors, stroke colors, or stroke weights. Extremely useful for organizing, isolating, or deleting specific colored layers within complex imported SVGs or traced images.</li>
              </ul>`.split('\n');

const targetIndex = lines.findIndex(l => l.includes("The Node Editor"));
console.log("Found at index: " + targetIndex);

if (targetIndex !== -1) {
  lines.splice(targetIndex, 4, ...newBlock);
  fs.writeFileSync('e:/DEVELOPER PROJECTS/vectronomy/index.html', lines.join('\n'));
  console.log("Successfully replaced lines.");
}
