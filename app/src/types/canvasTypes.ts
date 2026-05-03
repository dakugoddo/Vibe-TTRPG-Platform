/**
 * canvasTypes.ts — Types for canvas drawing elements (Excalidraw-like)
 *
 * DrawElements are NOT entities. They belong to a specific canvas
 * and are stored in Entity.properties.drawElements for the canvas entity.
 */

// ─── Drawing element types ───

export type DrawElementType = 'line' | 'arrow' | 'rectangle' | 'ellipse' | 'image' | 'text' | 'frame';

export type StrokeStyle = 'solid' | 'dashed' | 'dotted';

export type LineCap = 'none' | 'arrow' | 'circle' | 'diamond' | 'square';

export type TextFontFamily = 'sans' | 'serif' | 'mono' | 'handwritten';
export type TextAlign = 'left' | 'center' | 'right';

export interface DrawElement {
  id: string;
  type: DrawElementType;

  // For lines/arrows: flat array [x1,y1, x2,y2, ...]
  points?: number[];

  // For rectangles/ellipses/images
  x?: number;
  y?: number;
  width?: number;
  height?: number;

  // Visual styles
  stroke: string;
  strokeWidth: number;
  strokeStyle: StrokeStyle;
  fill?: string;
  opacity: number;

  // Separate opacity for fill and stroke (0-1, default 1)
  fillOpacity?: number;
  strokeOpacity?: number;

  // Line caps (start/end decorations)
  startCap: LineCap;
  endCap: LineCap;

  // For type='image'
  imageUrl?: string;

  // For type='text'
  text?: string;
  fontSize?: number;
  fontFamily?: TextFontFamily;
  textAlign?: TextAlign;
  textColor?: string;
  textOpacity?: number;

  // Rotation in degrees
  rotation?: number;

  // Rendering order
  zIndex: number;

  // Locked elements can't be moved accidentally
  locked?: boolean;

  // For type='frame': display label at the top
  frameLabel?: string;

  // User-assigned object name (shown above shapes, on lines, in Active Elements)
  objectName?: string;

  // Whether to display the objectName above the element
  showName?: boolean;

  // Description / inner text for shapes (double-click to edit)
  description?: string;

  // For type='frame': editing mode for label
  _editingLabel?: boolean;
}

// ─── Tool types ───

export type CanvasTool = 'select' | 'pen' | 'line' | 'rect' | 'ellipse' | 'image' | 'text' | 'frame' | 'lasso';

// ─── Default style preset ───

export const DEFAULT_DRAW_STYLE = {
  stroke: '#a78bfa',       // soft purple
  strokeWidth: 2,
  strokeStyle: 'solid' as StrokeStyle,
  fill: '',
  opacity: 1,
  startCap: 'none' as LineCap,
  endCap: 'none' as LineCap,
};

// ─── Konva dash patterns mapped from StrokeStyle ───

export function getKonvaDash(style: StrokeStyle, strokeWidth: number): number[] | undefined {
  switch (style) {
    case 'dashed': return [strokeWidth * 5, strokeWidth * 3];
    case 'dotted': return [strokeWidth, strokeWidth * 3];
    case 'solid':
    default: return undefined;
  }
}

// ─── Arrowhead geometry ───

/**
 * Calculate arrowhead points for a given line segment endpoint.
 * Returns flat array [x1,y1, tipX,tipY, x2,y2] forming a triangle.
 */
export function getArrowPoints(
  fromX: number, fromY: number,
  toX: number, toY: number,
  size: number
): number[] {
  const angle = Math.atan2(toY - fromY, toX - fromX);
  const headLen = size;
  const headAngle = Math.PI / 6; // 30 degrees

  return [
    toX - headLen * Math.cos(angle - headAngle),
    toY - headLen * Math.sin(angle - headAngle),
    toX,
    toY,
    toX - headLen * Math.cos(angle + headAngle),
    toY - headLen * Math.sin(angle + headAngle),
  ];
}

/**
 * Get bounding box of a draw element.
 */
export function getElementBounds(el: DrawElement): { x: number; y: number; w: number; h: number } {
  if (el.type === 'rectangle' || el.type === 'ellipse' || el.type === 'image' || el.type === 'frame') {
    return {
      x: el.x || 0,
      y: el.y || 0,
      w: el.width || 0,
      h: el.height || 0,
    };
  }
  if ((el.type === 'line' || el.type === 'arrow') && el.points && el.points.length >= 4) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < el.points.length; i += 2) {
      minX = Math.min(minX, el.points[i]);
      minY = Math.min(minY, el.points[i + 1]);
      maxX = Math.max(maxX, el.points[i]);
      maxY = Math.max(maxY, el.points[i + 1]);
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }
  if (el.type === 'text') {
    return {
      x: el.x || 0,
      y: el.y || 0,
      w: el.width || 120,
      h: el.height || 30,
    };
  }
  return { x: 0, y: 0, w: 0, h: 0 };
}

/**
 * Translate all coordinates of a draw element by (dx, dy).
 */
export function translateElement(el: DrawElement, dx: number, dy: number): DrawElement {
  const updated = { ...el };
  if ((el.type === 'line' || el.type === 'arrow') && el.points) {
    updated.points = el.points.map((v, i) => i % 2 === 0 ? v + dx : v + dy);
  } else {
    updated.x = (el.x || 0) + dx;
    updated.y = (el.y || 0) + dy;
  }
  return updated;
}

/**
 * Get IDs of elements whose center is inside a frame's bounds.
 */
export function getChildrenOfFrame(frame: DrawElement, elements: DrawElement[]): string[] {
  if (frame.type !== 'frame') return [];
  const fx = frame.x || 0;
  const fy = frame.y || 0;
  const fw = frame.width || 0;
  const fh = frame.height || 0;
  
  return elements
    .filter(el => {
      if (el.id === frame.id) return false;
      const b = getElementBounds(el);
      const cx = b.x + b.w / 2;
      const cy = b.y + b.h / 2;
      return cx >= fx && cx <= fx + fw && cy >= fy && cy <= fy + fh;
    })
    .map(el => el.id);
}

/**
 * Z-order manipulation: move element to front/back or forward/backward.
 */
export function reorderElements(
  elements: DrawElement[],
  targetIds: string[],
  action: 'front' | 'back' | 'forward' | 'backward'
): DrawElement[] {
  // Sort by current zIndex
  const sorted = [...elements].sort((a, b) => a.zIndex - b.zIndex);
  const targetSet = new Set(targetIds);
  const targets = sorted.filter(el => targetSet.has(el.id));
  const others = sorted.filter(el => !targetSet.has(el.id));

  let reordered: DrawElement[];
  switch (action) {
    case 'front':
      reordered = [...others, ...targets];
      break;
    case 'back':
      reordered = [...targets, ...others];
      break;
    case 'forward': {
      // Move each target one position forward
      const arr = [...sorted];
      for (let i = arr.length - 2; i >= 0; i--) {
        if (targetSet.has(arr[i].id) && !targetSet.has(arr[i + 1].id)) {
          [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
        }
      }
      reordered = arr;
      break;
    }
    case 'backward': {
      const arr = [...sorted];
      for (let i = 1; i < arr.length; i++) {
        if (targetSet.has(arr[i].id) && !targetSet.has(arr[i - 1].id)) {
          [arr[i], arr[i - 1]] = [arr[i - 1], arr[i]];
        }
      }
      reordered = arr;
      break;
    }
  }

  // Re-assign zIndex based on position
  return reordered.map((el, i) => ({ ...el, zIndex: i }));
}

/**
 * Check if two rectangles overlap (for marquee selection).
 */
export function rectsOverlap(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

/**
 * Check if a line segment intersects a rectangle.
 */
function lineSegmentIntersectsRect(
  x1: number, y1: number, x2: number, y2: number,
  rx: number, ry: number, rw: number, rh: number
): boolean {
  const pointInRect = (x: number, y: number) => x >= rx && x <= rx + rw && y >= ry && y <= ry + rh;
  if (pointInRect(x1, y1) || pointInRect(x2, y2)) return true;

  const linesIntersect = (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number) => {
    const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (den === 0) return false;
    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / den;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
  };

  if (linesIntersect(x1, y1, x2, y2, rx, ry, rx + rw, ry)) return true; // Top
  if (linesIntersect(x1, y1, x2, y2, rx, ry + rh, rx + rw, ry + rh)) return true; // Bottom
  if (linesIntersect(x1, y1, x2, y2, rx, ry, rx, ry + rh)) return true; // Left
  if (linesIntersect(x1, y1, x2, y2, rx + rw, ry, rx + rw, ry + rh)) return true; // Right

  return false;
}

/**
 * Filter elements whose bounding box overlaps the given selection rect.
 */
export function elementsInRect(
  elements: DrawElement[],
  rx: number, ry: number, rw: number, rh: number
): DrawElement[] {
  // Normalize negative width/height
  let nx = rx, ny = ry, nw = rw, nh = rh;
  if (nw < 0) { nx += nw; nw = Math.abs(nw); }
  if (nh < 0) { ny += nh; nh = Math.abs(nh); }

  return elements.filter(el => {
    const b = getElementBounds(el);
    if (!rectsOverlap(nx, ny, nw, nh, b.x, b.y, b.w, b.h)) return false;

    if ((el.type === 'line' || el.type === 'arrow') && el.points && el.points.length >= 4) {
      for (let i = 0; i < el.points.length - 2; i += 2) {
        if (lineSegmentIntersectsRect(
          el.points[i], el.points[i + 1],
          el.points[i + 2], el.points[i + 3],
          nx, ny, nw, nh
        )) {
          return true;
        }
      }
      return false; // Bounds overlapped but no segments intersected
    }

    return true;
  });
}

/**
 * Konva font family string from TextFontFamily type.
 */
export function getKonvaFontFamily(f: TextFontFamily): string {
  switch (f) {
    case 'serif': return 'Georgia, serif';
    case 'mono': return '"JetBrains Mono", "Fira Code", monospace';
    case 'handwritten': return '"Caveat", cursive';
    case 'sans':
    default: return '"Inter", "Segoe UI", sans-serif';
  }
}

// ─── Fog of War types ───

export type FogRevealType = 'circle' | 'rect';

export interface FogReveal {
  id: string;
  type: FogRevealType;
  x: number;       // center-x (circle) or left (rect)
  y: number;       // center-y (circle) or top (rect)
  width: number;   // diameter (circle) or width (rect)
  height: number;  // diameter (circle) or height (rect)
}

/** Get axis-aligned bounding box of a FogReveal in world coords */
export function getFogRevealBounds(r: FogReveal): { x: number; y: number; w: number; h: number } {
  if (r.type === 'circle') {
    const r2 = r.width / 2;
    return { x: r.x - r2, y: r.y - r2, w: r.width, h: r.height };
  }
  return { x: r.x, y: r.y, w: r.width, h: r.height };
}

/** Check if two FogReveal shapes overlap in world coords */
export function fogRevealsOverlap(a: FogReveal, b: FogReveal): boolean {
  const ba = getFogRevealBounds(a);
  const bb = getFogRevealBounds(b);
  return ba.x < bb.x + bb.w && ba.x + ba.w > bb.x && ba.y < bb.y + bb.h && ba.y + ba.h > bb.y;
}
