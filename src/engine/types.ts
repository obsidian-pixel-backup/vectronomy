/**
 * VECTRONOMY — Core Type Definitions
 * 
 * All interfaces and types used across the conversion engine modules.
 */

// ─── XCS Source Types ────────────────────────────────────────────

/** Raw XCS display element from the JSON */
export interface XcsDisplay {
  id: string;
  name?: string | null;
  type: string; // PATH | CIRCLE | ELLIPSE | RECT | TEXT | LINE | PEN | GROUP
  x?: number;
  y?: number;
  offsetX?: number;
  offsetY?: number;
  angle?: number;
  scale?: { x: number; y: number };
  skew?: { x: number; y: number };
  pivot?: { x: number; y: number };
  localSkew?: { x: number; y: number };
  width?: number;
  height?: number;
  lockRatio?: boolean;
  isClosePath?: boolean;
  zOrder: number;
  sourceId?: string;
  groupTag?: string;
  groupTags?: string[];
  layerTag?: string;
  layerColor?: string;
  visible?: boolean;
  originColor?: string;
  enableTransform?: boolean;

  // Stroke properties
  stroke?: {
    paintType?: string;
    visible?: boolean;
    color?: number;
    alpha?: number;
    width?: number;
    cap?: string;
    join?: string;
    miterLimit?: number;
    alignment?: number;
  };

  // Fill properties
  fill?: {
    paintType?: string;
    visible?: boolean;
    color?: number;
    alpha?: number;
  };

  // Color overrides (can be string hex or integer)
  lineColor?: string | number;
  fillColor?: string | number;
  isFill?: boolean;

  // Path data
  dPath?: string;
  fillRule?: string;
  isCompoundPath?: boolean;
  mask?: XcsDisplay;
  graphicX?: number;
  graphicY?: number;

  // Points for PEN type
  points?: XcsPoint[];
  controlPoints?: XcsControlPoint[];

  // Text data
  text?: string;
  resolution?: number;
  style?: XcsTextStyle;
  fontData?: {
    fontInfo?: any;
    glyphData?: Record<string, XcsGlyphData>;
    glyphDataByGid?: Record<string, XcsGlyphData>;
    layout?: any;
  };
  charJSONs?: XcsCharJSON[];

  // Processing metadata
  processingType?: string;

  // Bitmap / Texture data
  base64?: string;
  originWidth?: number;
  originHeight?: number;
  dpi?: { dpiX: number; dpiY: number };
}

export interface XcsPoint {
  x: number;
  y: number;
}

export interface XcsControlPoint {
  x: number;
  y: number;
}

export interface XcsTextStyle {
  fontSize?: number;
  fontFamily?: string;
  fontSubfamily?: string;
  fontSource?: string;
  letterSpacing?: number;
  leading?: number;
  align?: string;
  curveX?: number;
  curveY?: number;
  isUppercase?: boolean;
  isWeld?: boolean;
  direction?: string;
  writingMode?: string;
  textOrientation?: string;
}

export interface XcsGlyphData {
  dPath?: string;
  advanceWidth?: number;
  advanceHeight?: number;
  leftBearing?: number;
  topBearing?: number;
  bbox?: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
}

export interface XcsCharJSON extends Partial<XcsDisplay> {
  chars?: string;
  glyphs?: any[];
  advanceWidth?: number;
  advanceHeight?: number;
  stroke?: {
    visible?: boolean;
    width?: number;
    color?: number;
    alpha?: number;
  };
  fill?: {
    visible?: boolean;
    color?: number;
    alpha?: number;
  };
}

/** Group metadata from groupData{} */
export interface XcsGroupData {
  groupName?: string;
  groupTag: string;
  visible?: boolean;
  enableTransform?: boolean;
  zOrder?: number;
  // Groups can nest — parent group tag
  parentGroupTag?: string;
}

/** Layer metadata from layerData{} */
export interface XcsLayerData {
  name: string;
  order: number;
  visible: boolean;
  color?: string;
}

/** A single canvas/panel from the XCS file */
export interface XcsCanvas {
  id: string;
  title?: string;
  layerData?: Record<string, XcsLayerData>;
  groupData?: Record<string, XcsGroupData>;
  displays?: XcsDisplay[];
  extendInfo?: {
    version?: string;
    type?: string;
  };
}

/** Top-level XCS file structure */
export interface XcsFile {
  canvasId?: string;
  canvas?: XcsCanvas[];
  project?: {
    canvas?: XcsCanvas[];
  };
}

// ─── Output Types ────────────────────────────────────────────────

/** Processing intent for laser operations */
export enum ProcessingType {
  VECTOR_CUTTING = 'VECTOR_CUTTING',
  VECTOR_ENGRAVING = 'VECTOR_ENGRAVING',
  FILL_VECTOR_ENGRAVE = 'FILL_VECTOR_ENGRAVE',
}

/** A converted SVG layer ready for output */
export interface ConvertedLayer {
  id: string;
  name: string;
  color: string;
  svg: string;
  elementCount: number;
}

/** Style properties for an SVG element */
export interface ElementStyle {
  stroke: string;
  strokeWidth: number;
  fill: string;
  fillRule: string;
  opacity: number;
  vectorEffect: string;
  strokeLinejoin: string;
  strokeLinecap: string;
  strokeMiterlimit?: number;
  fillUrl?: string; // For pattern fills (hatching)
  image?: string;   // For embedded bitmaps
}

/** Bounding box */
export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

// ─── Scene Graph Types ───────────────────────────────────────────

/** A node in the scene graph hierarchy */
export interface SceneNode {
  id: string;
  type: 'GROUP' | 'ELEMENT' | 'LAYER';
  display?: XcsDisplay;
  groupData?: XcsGroupData;
  children: SceneNode[];
  parentId?: string;
  zOrder: number;
  layerTag?: string;
}
