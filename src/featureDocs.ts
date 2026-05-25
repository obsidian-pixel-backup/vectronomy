export interface FeatureDoc {
  readme: string;
  usage: string;
  tech: string;
}

export const COMPLETED_FEATURES = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 16, 21, 22, 23, 24, 28, 59, 68, 70, 91, 92, 96, 97, 100, 133, 134]);
export const IN_PROGRESS_FEATURES = new Set([62, 63]);

export const FEATURE_DOCS: Record<number, FeatureDoc> = {
  1: {
    readme: "Provides industry-standard vector plotting capability. Click to drop linear vertex nodes, or click-and-drag to extend symmetrical control handles in real-time. Paths remain fully open and modifiable until closed by re-clicking the origin anchor or finalized by pressing Enter.",
    usage: "Select the Pen tool (shortcut 'P'). Click on the canvas to place structural anchors. Drag your cursor during a click to bend the curve. Press 'Enter' or 'Escape' to finalize an open path, or click back on the green glowing starting anchor to form a closed shape loop.",
    tech: "Paper.js Path construction with Segment instances managing handleIn/handleOut vector sets. Active drawing HUD leverages raw SVG canvas coordinate overlays, drawing a dynamic rubberband stroke and handle lines at 60 FPS."
  },
  2: {
    readme: "Drafts mathematically perfect rectangles and squares. Supports instant mouse dimensions, custom corner radiuses, borders, and fills.",
    usage: "Select the Rectangle tool (shortcut 'R'). Click and drag anywhere on the workspace. Hold the Shift key while dragging to perfectly lock dimensions to a 1:1 aspect ratio (Square). Adjust colors and stroke widths in the inspector.",
    tech: "Instantiates Paper.js Path.Rectangle geometry. Employs transform bounds checking inside the mouse drag handlers to constrain aspect ratio to 1:1 when Shift is active."
  },
  3: {
    readme: "Overhauled from rigid SVG elliptical arcs into 4 connected Cubic Bezier curves using the circular approximation constant 𝜅 ≈ 0.55228475. This allows ellipses to be treated as standard morphable splines, opening them up to custom organic deformations.",
    usage: "Select the Circle/Ellipse tool (shortcut 'E'). Click and drag to define boundaries. Hold Shift to lock to a perfect circle. Once created, select the Node tool ('N') to drag any of the 4 cardinal handles and deform the ellipse into organic forms.",
    tech: "Calculates symmetric control points at rx * 𝜅 offsets from the center coordinate. Constructs 4 contiguous 'C' commands (Cubic Bezier splines) matching standard PDF/PostScript formats. Fully compatible with node insertion algorithms."
  },
  4: {
    readme: "Drafts perfectly equilateral regular polygons. Supports dynamic vertex count configuration directly from the CAD properties inspector.",
    usage: "Select the Polygon tool from the Shapes menu (shortcut 'O'). Click and drag outwards to set the radius and rotation angle.",
    tech: "Instantiates an SVG <polygon> node. Generates N equidistant vertex coordinates at step angles of 2π/N, scaling and rotating based on the active mouse drag vector."
  },
  5: {
    readme: "Renders symmetrical multi-pointed stars. Features dual radius parameters for creating custom artistic elements.",
    usage: "Select the Star tool from the Shapes menu (shortcut 'S'). Click and drag to stretch the outer points. Hold Shift to align symmetrically.",
    tech: "Constructs an SVG <polygon> node. Loops through 2N vertices, alternating coordinates between outer radius Rout and inner proportional radius Rin = 0.4 * Rout."
  },
  6: {
    readme: "Generates logarithmic spirals expanding outwards from a central point. Ideal for architectural spirals, specialized CNC coils, springs, and ornate engraving contours.",
    usage: "Select the Spiral tool from the Shapes menu (shortcut 'I'). Click and drag to define the spiral's outer radius boundary and expansion rate.",
    tech: "Generates a polar coordinate sequence modeled after r = a * e^(b * θ). Translates points to cartesian space and outputs a clean <path> node with 4 complete spiral turns."
  },
  7: {
    readme: "Captures smooth freehand sketches. Passes raw coordinate streams through a premium Douglas-Peucker point simplification and Hermite tangent spline-fitting pipeline to produce organic curves.",
    usage: "Select the Pencil tool from the Shapes menu (shortcut 'K'). Click and drag to draw lines naturally. Releasing the mouse instantly smooths the path.",
    tech: "Tracks active mouse drag coordinates, executes a Ramer-Douglas-Peucker reduction to remove jitter, and interpolates smooth cubic bezier tangents to compile a clean <path> node."
  },
  8: {
    readme: "Draws single linear vectors with absolute precision. Supports angle locking constraints.",
    usage: "Select the Line tool from the Shapes menu (shortcut 'L'). Click and drag to define the line's starting and ending coordinates. Hold Shift to constrain the angle to multiples of 45°.",
    tech: "Creates an SVG <line> node. Snaps coordinates on Shift key down by converting the drag vector to polar space and rounding the angle to the nearest 45° increment."
  },
  9: {
    readme: "Drafts contiguous sequences of connected straight lines. Excellent for rapid layout tracing and drafting geometric blueprints.",
    usage: "Select the Polyline tool from the Shapes menu (shortcut 'Y'). Click to drop successive structural vertices. Re-click the starting anchor to close, or press Enter or Escape to finalize.",
    tech: "Instantiates an SVG <polyline> node. Appends successive vertex coordinates on each click and binds keyboard finalization routines to cleanly seal the element."
  },
  10: {
    readme: "Clones selected elements into a perfect X * Y matrix array. Optimizes sheet usage and automates high-volume laser cutting runs.",
    usage: "Select any element on the canvas. In the properties panel, enter the desired Rows, Columns, and X/Y Spacings, then click 'Create Grid Array'.",
    tech: "Traverses the target shape's child nodes, duplicates them, generates new unique data-xcs-id attributes, and translates the coordinates."
  },
  11: {
    readme: "Interactive Node Selection layer. Displays circular interactive handle overlays at every anchor point of a selected vector path, allowing the user to select and manipulate individual vertices.",
    usage: "Select the Node tool (shortcut 'N'), then click on any path element. Click directly on any node circle to select it (it will render with a glowing blue stroke) and drag to move it.",
    tech: "Queries Paper.js Path segment coordinate matrices. Dynamically compiles and appends interactive <circle> node handles onto an overlay SVG viewport. Coordinates are adjusted by the current panzoom scale to maintain constant physical hover areas."
  },
  12: {
    readme: "Exposes bezier handle vectors (handleIn/handleOut) in Node mode, letting you adjust curve severity, entrance angles, and asymmetric peaks.",
    usage: "Select a node. Symmetrical handle bars will project outward. Click and drag the circular endpoints of a handle to deform the curves surrounding the anchor.",
    tech: "Links handleIn and handleOut vectors using relative coordinate translations. Moving one handle rotates and scales the opposing handle symmetrically, preserving a continuous tangent (smooth joint)."
  },
  13: {
    readme: "Converts smooth curves to sharp corner points, and vice versa, breaking or re-binding the linear alignment constraint between opposing handles.",
    usage: "Double-click on any active anchor node in Node mode. If the anchor is smooth, handles will collapse, forming a sharp linear corner. Double-click a linear corner to restore smooth bezier handles.",
    tech: "Toggles segment.linear properties in the underlying Paper.js engine. If linear, clears handleIn and handleOut vectors. If smooth, re-calculates default tangent vectors relative to adjacent nodes."
  },
  15: {
    readme: "Splits splines and path segments losslessly. Uses coarse-to-fine projection searches along the visual stroke boundaries and executes a perfect de Casteljau cubic subdivision at parameter t.",
    usage: "Select the Node tool ('N'), hover your cursor over any path contour, and double-click. A new anchor node will be inserted at that exact location without warping the visual shape.",
    tech: "Queries clicked screen pixels and projects them to local SVGPathElement length values using getPointAtLength(). Determines local parameter t and performs de Casteljau spline subdivision, mathematically splitting one C segment into two connected C segments."
  },
  59: {
    readme: "Enables precise keyboard nudging for active selections. Avoids human mouse error and ensures CAD layout dimensions line up perfectly.",
    usage: "Select an element or individual nodes in Node mode. Press Arrow Keys to move them by exactly 1px. Hold Shift + Arrow Keys to move them by exactly 10px.",
    tech: "Keydown event listener binding ArrowUp/ArrowDown/ArrowLeft/ArrowRight. Translates the target element's path coordinates or the individual segment points directly inside the Paper.js document tree."
  },
  91: {
    readme: "High-Performance Memoized UI rendering engine that isolates direct coordinate translations from DOM paint overhead. Renders custom HUD overlays at scale-independent crispness.",
    usage: "Active automatically at all times. Delivers smooth drag updates and handle tracing even on extremely complex paths.",
    tech: "Memoizes node selection states. Updates interactive svg overlays during cursor drags via direct node.setAttribute() rather than re-creating DOM structures, bypassing browser layouts."
  },
  92: {
    readme: "Offline-first capability allowing Vectronomy to load and operate with zero internet dependency in remote laser cutter workshops or CNC machine rooms.",
    usage: "Click the 'Install App' icon inside your browser's address bar to run Vectronomy as a standalone desktop application.",
    tech: "Uses a Service Worker caching pipeline to fetch and locally host all stylesheets, scripts, fonts, and assets. Includes a manifest.json file matching PWA design standards."
  },
  96: {
    readme: "Privacy-compliant, non-blocking telemetry integration measuring CAD application startup time, asset ingestion latency, and rendering frame rates.",
    usage: "Silent backend optimizer. Helps improve future versions by pinpointing rendering bottlenecks.",
    tech: "Asynchronously loads lightweight tracking signals via dynamic, promise-wrapped import blocks, ensuring the main drawing loop remains entirely unaffected."
  },
  133: {
    readme: "Premium Light, Dark, and Neon Cyber-Glow UI. Frosted glass panels and customized contrast controls prevent eye strain in dark industrial workspaces.",
    usage: "Toggle active styles by clicking the visual palette button in the top header or selecting a colorway in the sidebar.",
    tech: "Binds dark/light attributes to the root element. Dynamically changes CSS custom properties (variables) representing glassmorphic backdrops, grid gradients, and glowing accents."
  },
  134: {
    readme: "Translates canvas coordinates between physical units (mm, cm, inches) and screen coordinates (px), updating rulers and properties grids.",
    usage: "Adjust the active unit dropdown in the properties inspector to view absolute widths, heights, and coordinates in your preferred standard.",
    tech: "Calculates conversions using standard 96 DPI ratios: 1 inch = 96px, 1mm ≈ 3.779px. Multiplies bounding boxes and coordinate trackers in real-time."
  },
  16: {
    readme: "Cleans up and simplifies over-complicated vector geometries by removing unnecessary anchor points.",
    usage: "Select a node using the Node Tool and press Backspace or Delete. The path will be closed and maintained.",
    tech: "Delete selected segment indices and mathematically recalculate the surrounding curve segments to seal the path."
  },
  21: {
    readme: "Melds overlapping vectors (like script lettering) into a single cohesive cut profile.",
    usage: "Select two or more overlapping shapes and choose Unite from the Pathfinder options.",
    tech: "Calls the native Paper.js path.unite(otherPath) method on selected paths."
  },
  22: {
    readme: "Creates custom holes, cutouts, and slots inside panels.",
    usage: "Select a base shape and an overlapping shape to cut out, then choose Subtract from the Pathfinder options.",
    tech: "Calls Paper.js path.subtract(otherPath) to subtract the top item from the bottom."
  },
  23: {
    readme: "Retains only overlapping areas, perfect for masking patterns into boundaries.",
    usage: "Select two overlapping shapes and choose Intersect from the Pathfinder options.",
    tech: "Calls Paper.js path.intersect(otherPath)."
  },
  24: {
    readme: "Instantly creates hollow frames or transparent stencil layouts.",
    usage: "Select overlapping shapes and choose Exclude from the Pathfinder options.",
    tech: "Calls Paper.js path.exclude(otherPath)."
  },
  28: {
    readme: "Reduces G-code file sizes and prevents machinery jitter by removing redundant curve nodes.",
    usage: "Applied automatically during sketching to smooth out and simplify paths.",
    tech: "Uses a custom Douglas-Peucker simplification algorithm to reduce node weight based on curve delta calculations."
  },
  68: {
    readme: "Quickly removes backgrounds from imported images before tracing.",
    usage: "Select the Eraser tool and draw over the background you want to remove.",
    tech: "Leverages an offscreen canvas in the RasterEngine with destination-out composite operations."
  },
  70: {
    readme: "Adjusts image properties for maximum trace clarity from poor photos.",
    usage: "Select an image and apply Brightness, Contrast, and Blur filters via the properties panel.",
    tech: "Uses CSS filters on a 2D canvas context to permanently bake pixel adjustments into the base64 raster image."
  }
};
