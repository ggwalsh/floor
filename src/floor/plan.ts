export const SNAP = 6;
export const WALL_THICK = 4;

export type Tool = "wall" | "door" | "window" | "room" | "erase" | "furniture" | null;

export type WallSeg = {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type Opening = {
  id: string;
  wallId: string;
  kind: "door" | "window";
  offset: number;
  width: number;
  hinge: "start" | "end";
  side: 1 | -1;
};

export type PieceShape = "rect" | "round" | "l";

export type Piece = {
  id: string;
  kind: "furniture" | "wardrobe";
  shape: PieceShape;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
};

export type RoomLabel = {
  id: string;
  label: string;
  x: number;
  y: number;
};

export type CatalogItem = {
  id: string;
  label: string;
  kind: "furniture" | "wardrobe";
  shape: PieceShape;
  w: number;
  h: number;
  alongWall?: boolean;
};

export type PlanData = {
  v: 1;
  walls: WallSeg[];
  openings: Opening[];
  pieces: Piece[];
  rooms: RoomLabel[];
};

export const ROOM_PRESETS = [
  "Bedroom",
  "Living",
  "Kitchen",
  "Dining",
  "Bath",
  "Office",
  "Hall",
  "Laundry",
  "Closet",
  "Garage",
];

export const CATALOG: CatalogItem[] = [
  { id: "queen", label: "Queen bed", kind: "furniture", shape: "rect", w: 60, h: 80 },
  { id: "king", label: "King bed", kind: "furniture", shape: "rect", w: 76, h: 80 },
  { id: "twin", label: "Twin bed", kind: "furniture", shape: "rect", w: 38, h: 75 },
  { id: "sofa", label: "Sofa", kind: "furniture", shape: "rect", w: 84, h: 36 },
  { id: "loveseat", label: "Loveseat", kind: "furniture", shape: "rect", w: 60, h: 34 },
  { id: "chair", label: "Armchair", kind: "furniture", shape: "rect", w: 32, h: 32 },
  { id: "desk", label: "Desk", kind: "furniture", shape: "rect", w: 60, h: 30 },
  { id: "ldesk", label: "L-desk", kind: "furniture", shape: "l", w: 60, h: 48 },
  { id: "table", label: "Dining table", kind: "furniture", shape: "rect", w: 36, h: 72 },
  { id: "round", label: "Round table", kind: "furniture", shape: "round", w: 48, h: 48 },
  { id: "seat", label: "Chair", kind: "furniture", shape: "rect", w: 18, h: 18 },
  { id: "coffee", label: "Coffee table", kind: "furniture", shape: "rect", w: 48, h: 24 },
  { id: "night", label: "Nightstand", kind: "furniture", shape: "rect", w: 20, h: 18 },
  { id: "dresser", label: "Dresser", kind: "furniture", shape: "rect", w: 36, h: 20 },
  { id: "books", label: "Bookshelf", kind: "furniture", shape: "rect", w: 36, h: 12 },
  { id: "tv", label: "TV stand", kind: "furniture", shape: "rect", w: 60, h: 16 },
  { id: "wardrobe", label: "Wardrobe", kind: "wardrobe", shape: "rect", w: 72, h: 24 },
  { id: "builtin", label: "Built-in", kind: "wardrobe", shape: "rect", w: 72, h: 24, alongWall: true },
  { id: "closet", label: "Closet", kind: "wardrobe", shape: "rect", w: 48, h: 24, alongWall: true },
  { id: "island", label: "Island", kind: "furniture", shape: "rect", w: 72, h: 36 },
  { id: "fridge", label: "Fridge", kind: "furniture", shape: "rect", w: 32, h: 30 },
  { id: "washer", label: "Washer", kind: "furniture", shape: "rect", w: 27, h: 27 },
  { id: "tub", label: "Tub", kind: "furniture", shape: "rect", w: 60, h: 30 },
  { id: "vanity", label: "Vanity", kind: "furniture", shape: "rect", w: 36, h: 21 },
  { id: "toilet", label: "Toilet", kind: "furniture", shape: "rect", w: 28, h: 18 },
  { id: "custom", label: "Custom", kind: "furniture", shape: "rect", w: 36, h: 24 },
  { id: "custom-round", label: "Custom round", kind: "furniture", shape: "round", w: 36, h: 36 },
];

export function isCustomItem(id: string) {
  return id === "custom" || id === "custom-round";
}

export function isAlongWall(id: string) {
  return CATALOG.find((c) => c.id === id)?.alongWall === true;
}

export function uid() {
  return Math.random().toString(36).slice(2, 9);
}

export function snap(n: number) {
  return Math.round(n / SNAP) * SNAP;
}

export function lengthIn(w: WallSeg) {
  return Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
}

export function fmtIn(n: number) {
  const abs = Math.abs(n);
  let ft = Math.floor(abs / 12);
  let inch = Math.round(abs % 12);
  if (inch === 12) {
    ft += 1;
    inch = 0;
  }
  return `${ft}' ${inch}"`;
}

export function along(w: WallSeg, t: number) {
  const L = lengthIn(w) || 1;
  const u = Math.max(0, Math.min(L, t));
  return {
    x: w.x1 + ((w.x2 - w.x1) / L) * u,
    y: w.y1 + ((w.y2 - w.y1) / L) * u,
  };
}

export function projectT(w: WallSeg, x: number, y: number) {
  const dx = w.x2 - w.x1;
  const dy = w.y2 - w.y1;
  const L = Math.hypot(dx, dy) || 1;
  return ((x - w.x1) * dx + (y - w.y1) * dy) / L;
}

export function sideOf(wall: WallSeg, x: number, y: number): 1 | -1 {
  const cross = (wall.x2 - wall.x1) * (y - wall.y1) - (wall.y2 - wall.y1) * (x - wall.x1);
  return cross >= 0 ? 1 : -1;
}

export function wallAngle(wall: WallSeg) {
  return (Math.atan2(wall.y2 - wall.y1, wall.x2 - wall.x1) * 180) / Math.PI;
}

export function hitWall(walls: WallSeg[], x: number, y: number, max = 10) {
  let best: WallSeg | null = null;
  let dmin = max;
  for (const w of walls) {
    const L = lengthIn(w) || 1;
    const t = Math.max(0, Math.min(L, projectT(w, x, y)));
    const p = along(w, t);
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < dmin) {
      dmin = d;
      best = w;
    }
  }
  return best;
}

export function clampDoor(wall: WallSeg, offset: number, width: number) {
  const L = lengthIn(wall);
  const w = Math.min(width, Math.max(18, L - 6));
  const off = Math.max(3, Math.min(L - w - 3, offset - w / 2));
  return { offset: off, width: w };
}

export function localPoint(piece: Piece, x: number, y: number) {
  const rad = (-piece.rot * Math.PI) / 180;
  const dx = x - piece.x;
  const dy = y - piece.y;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return { x: dx * c - dy * s, y: dx * s + dy * c };
}

function inRect(x: number, y: number, w: number, h: number) {
  return Math.abs(x) <= w / 2 && Math.abs(y) <= h / 2;
}

export function hitPiece(piece: Piece, x: number, y: number) {
  const p = localPoint(piece, x, y);
  if (piece.shape === "round") {
    const r = Math.min(piece.w, piece.h) / 2;
    return Math.hypot(p.x, p.y) <= r;
  }
  if (piece.shape === "l") {
    const t = Math.min(piece.w, piece.h) * 0.4;
    const left = p.x >= -piece.w / 2 && p.x <= -piece.w / 2 + t && p.y >= -piece.h / 2 && p.y <= piece.h / 2;
    const bot = p.x >= -piece.w / 2 && p.x <= piece.w / 2 && p.y >= piece.h / 2 - t && p.y <= piece.h / 2;
    return left || bot;
  }
  return inRect(p.x, p.y, piece.w, piece.h);
}

export function hitTopPiece(pieces: Piece[], x: number, y: number) {
  for (let i = pieces.length - 1; i >= 0; i--) {
    if (hitPiece(pieces[i], x, y)) return pieces[i];
  }
  return null;
}

export function hitRoom(rooms: RoomLabel[], x: number, y: number) {
  let best: RoomLabel | null = null;
  let dmin = 18;
  for (const r of rooms) {
    const d = Math.hypot(r.x - x, r.y - y);
    if (d < dmin) {
      dmin = d;
      best = r;
    }
  }
  return best;
}

export function rotate90(rot: number) {
  return (rot + 90) % 360;
}

export function snapToJoints(x: number, y: number, walls: WallSeg[], max = 10) {
  let bx = snap(x);
  let by = snap(y);
  let best = max;
  for (const w of walls) {
    for (const p of [
      { x: w.x1, y: w.y1 },
      { x: w.x2, y: w.y2 },
    ]) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < best) {
        best = d;
        bx = p.x;
        by = p.y;
      }
    }
  }
  return { x: bx, y: by };
}

export function pieceFromCatalog(item: CatalogItem, x: number, y: number): Piece {
  return {
    id: uid(),
    kind: item.kind,
    shape: item.shape,
    label: item.label.startsWith("Custom") ? "Piece" : item.label,
    x: snap(x),
    y: snap(y),
    w: item.w,
    h: item.h,
    rot: 0,
  };
}

export function pieceFromBuiltin(
  wall: WallSeg,
  t0: number,
  t1: number,
  side: 1 | -1,
  item: CatalogItem,
): Piece {
  const L = lengthIn(wall) || 1;
  const ux = (wall.x2 - wall.x1) / L;
  const uy = (wall.y2 - wall.y1) / L;
  let a = Math.min(t0, t1);
  let b = Math.max(t0, t1);
  if (b - a < 18) {
    const mid = (a + b) / 2;
    const half = item.w / 2;
    a = mid - half;
    b = mid + half;
  }
  a = Math.max(0, a);
  b = Math.min(L, b);
  const len = Math.max(18, b - a);
  const mid = along(wall, a + len / 2);
  const nx = -uy * side;
  const ny = ux * side;
  const depth = item.h;
  return {
    id: uid(),
    kind: "wardrobe",
    shape: "rect",
    label: item.label,
    x: snap(mid.x + nx * (depth / 2)),
    y: snap(mid.y + ny * (depth / 2)),
    w: snap(len) || 18,
    h: depth,
    rot: wallAngle(wall),
  };
}

export type Aabb = { x1: number; y1: number; x2: number; y2: number };

export function aabb(piece: Piece): Aabb {
  const rad = (piece.rot * Math.PI) / 180;
  const c = Math.abs(Math.cos(rad));
  const s = Math.abs(Math.sin(rad));
  const hw = (piece.w * c + piece.h * s) / 2;
  const hh = (piece.w * s + piece.h * c) / 2;
  return { x1: piece.x - hw, y1: piece.y - hh, x2: piece.x + hw, y2: piece.y + hh };
}

export function aabbsOverlap(a: Aabb, b: Aabb) {
  return a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
}

export function overlappingIds(pieces: Piece[]) {
  const boxes = pieces.map((p) => aabb(p));
  const ids = new Set<string>();
  for (let i = 0; i < pieces.length; i++) {
    for (let j = i + 1; j < pieces.length; j++) {
      if (aabbsOverlap(boxes[i], boxes[j])) {
        ids.add(pieces[i].id);
        ids.add(pieces[j].id);
      }
    }
  }
  return ids;
}

export function serializePlan(data: Omit<PlanData, "v">): PlanData {
  return {
    v: 1,
    walls: data.walls,
    openings: data.openings,
    pieces: data.pieces,
    rooms: data.rooms,
  };
}

function isRec(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

export function parsePlan(text: string): PlanData | null {
  try {
    const j: unknown = JSON.parse(text);
    if (!isRec(j) || !Array.isArray(j.walls) || !Array.isArray(j.pieces)) return null;
    return {
      v: 1,
      walls: j.walls as WallSeg[],
      openings: Array.isArray(j.openings) ? (j.openings as Opening[]) : [],
      pieces: j.pieces as Piece[],
      rooms: Array.isArray(j.rooms) ? (j.rooms as RoomLabel[]) : [],
    };
  } catch {
    return null;
  }
}

function W(id: string, x1: number, y1: number, x2: number, y2: number): WallSeg {
  return { id, x1, y1, x2, y2 };
}

export const SAMPLE_WALLS: WallSeg[] = [
  W("n", 0, 0, 240, 0),
  W("e", 240, 0, 240, 168),
  W("s", 240, 168, 0, 168),
  W("w", 0, 168, 0, 0),
  W("bath", 192, 0, 192, 96),
  W("kit", 192, 96, 240, 96),
];

export const SAMPLE_OPENINGS: Opening[] = [
  { id: "entry", wallId: "s", kind: "door", offset: 156, width: 36, hinge: "end", side: -1 },
  { id: "bathd", wallId: "bath", kind: "door", offset: 52, width: 28, hinge: "start", side: -1 },
  { id: "win1", wallId: "n", kind: "window", offset: 36, width: 48, hinge: "start", side: 1 },
  { id: "win2", wallId: "s", kind: "window", offset: 36, width: 60, hinge: "start", side: 1 },
];

export const SAMPLE_PIECES: Piece[] = [
  { id: "bed", kind: "furniture", shape: "rect", label: "Queen bed", x: 66, y: 48, w: 60, h: 80, rot: 0 },
  { id: "ns", kind: "furniture", shape: "rect", label: "Nightstand", x: 108, y: 18, w: 20, h: 18, rot: 0 },
  { id: "ward", kind: "wardrobe", shape: "rect", label: "Built-in", x: 18, y: 144, w: 24, h: 72, rot: 0 },
  { id: "sofa", kind: "furniture", shape: "rect", label: "Sofa", x: 108, y: 148, w: 84, h: 36, rot: 0 },
  { id: "desk", kind: "furniture", shape: "rect", label: "Desk", x: 168, y: 148, w: 60, h: 30, rot: 90 },
  { id: "fr", kind: "furniture", shape: "rect", label: "Fridge", x: 216, y: 132, w: 32, h: 30, rot: 0 },
];

export const SAMPLE_ROOMS: RoomLabel[] = [
  { id: "r-bed", label: "Bedroom", x: 150, y: 72 },
  { id: "r-liv", label: "Living", x: 70, y: 118 },
  { id: "r-bath", label: "Bath", x: 216, y: 48 },
  { id: "r-kit", label: "Kitchen", x: 216, y: 132 },
];

