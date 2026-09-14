import { useEffect, useRef } from "react";
import { cn } from "../shared/cn";
import {
  CATALOG,
  WALL_THICK,
  along,
  clampDoor,
  formatDim,
  hitHandle,
  hitRoom,
  hitTopPiece,
  hitWall,
  isAlongWall,
  isCustomItem,
  lengthIn,
  overlappingIds,
  pieceFromBuiltin,
  pieceFromCatalog,
  pieceHandles,
  projectT,
  resizeFromHandle,
  sideOf,
  snap,
  snapToJoints,
  uid,
  type EdgeHandle,
  type Opening,
  type Piece,
  type RoomLabel,
  type Unit,
  type WallKeep,
  type WallSeg,
} from "./plan";
import { useFloor } from "./store";

const PPI = 1.7;

function worldFromEvent(
  e: PointerEvent,
  el: HTMLCanvasElement,
  pan: { x: number; y: number },
  zoom: number,
) {
  const r = el.getBoundingClientRect();
  return {
    x: (e.clientX - r.left - pan.x) / (PPI * zoom),
    y: (e.clientY - r.top - pan.y) / (PPI * zoom),
  };
}

type Drag =
  | { kind: "pan"; x: number; y: number; sx: number; sy: number }
  | { kind: "wall"; x: number; y: number; sx: number; sy: number }
  | { kind: "custom"; x: number; y: number; sx: number; sy: number }
  | { kind: "builtin"; wallId: string; t0: number; t1: number; side: 1 | -1 }
  | { kind: "move"; id: string; dx: number; dy: number }
  | { kind: "move-room"; id: string; dx: number; dy: number }
  | { kind: "resize"; id: string; handle: EdgeHandle };

export function FloorCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pan = useRef({ x: 36, y: 36 });
  const zoom = useRef(1);
  const drag = useRef<Drag | null>(null);
  const walls = useFloor((s) => s.walls);
  const openings = useFloor((s) => s.openings);
  const pieces = useFloor((s) => s.pieces);
  const rooms = useFloor((s) => s.rooms);
  const tool = useFloor((s) => s.tool);
  const catalogId = useFloor((s) => s.catalogId);
  const roomName = useFloor((s) => s.roomName);
  const selected = useFloor((s) => s.selected);
  const unit = useFloor((s) => s.unit);
  const wallKeep = useFloor((s) => s.wallKeep);
  const addWall = useFloor((s) => s.addWall);
  const addOpening = useFloor((s) => s.addOpening);
  const addPiece = useFloor((s) => s.addPiece);
  const addRoom = useFloor((s) => s.addRoom);
  const movePiece = useFloor((s) => s.movePiece);
  const moveRoom = useFloor((s) => s.moveRoom);
  const resizePiece = useFloor((s) => s.resizePiece);
  const remove = useFloor((s) => s.remove);
  const select = useFloor((s) => s.select);
  const checkpoint = useFloor((s) => s.checkpoint);
  const setTool = useFloor((s) => s.setTool);

  const live = useRef({
    walls,
    openings,
    pieces,
    rooms,
    tool,
    catalogId,
    roomName,
    selected,
    addWall,
    addOpening,
    addPiece,
    addRoom,
    movePiece,
    moveRoom,
    resizePiece,
    remove,
    select,
    checkpoint,
    setTool,
  });
  live.current = {
    walls,
    openings,
    pieces,
    rooms,
    tool,
    catalogId,
    roomName,
    selected,
    addWall,
    addOpening,
    addPiece,
    addRoom,
    movePiece,
    moveRoom,
    resizePiece,
    remove,
    select,
    checkpoint,
    setTool,
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    const loop = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(ctx, w, h, {
        walls,
        openings,
        pieces,
        rooms,
        selected,
        catalogId,
        unit,
        wallKeep,
        pan: pan.current,
        zoom: zoom.current,
        drag: drag.current,
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [walls, openings, pieces, rooms, selected, catalogId, unit, wallKeep]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const selectExisting = (p: { x: number; y: number }) => {
      const s = live.current;
      const sel = s.pieces.find((x) => x.id === s.selected);
      if (sel) {
        const handle = hitHandle(sel, p.x, p.y, 12);
        if (handle) {
          s.select(sel.id);
          s.checkpoint();
          drag.current = { kind: "resize", id: sel.id, handle };
          return true;
        }
      }
      const piece = hitTopPiece(s.pieces, p.x, p.y);
      if (piece) {
        s.select(piece.id);
        s.checkpoint();
        drag.current = { kind: "move", id: piece.id, dx: p.x - piece.x, dy: p.y - piece.y };
        return true;
      }
      const opening = hitOpening(s.openings, s.walls, p.x, p.y);
      if (opening) {
        s.select(opening.id);
        return true;
      }
      const room = hitRoom(s.rooms, p.x, p.y);
      if (room) {
        s.select(room.id);
        s.checkpoint();
        drag.current = { kind: "move-room", id: room.id, dx: p.x - room.x, dy: p.y - room.y };
        return true;
      }
      const wall = hitWall(s.walls, p.x, p.y, 14);
      if (wall) {
        s.select(wall.id);
        return true;
      }
      return false;
    };

    const onDown = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      const s = live.current;
      const p = worldFromEvent(e, canvas, pan.current, zoom.current);
      if (e.button === 1 || e.shiftKey || e.button === 2) {
        drag.current = { kind: "pan", x: e.clientX, y: e.clientY, sx: pan.current.x, sy: pan.current.y };
        return;
      }
      if (s.tool === "wall") {
        const j = snapToJoints(p.x, p.y, s.walls);
        drag.current = { kind: "wall", x: j.x, y: j.y, sx: j.x, sy: j.y };
        return;
      }
      if (s.tool === "furniture") {
        if (selectExisting(p)) {
          s.setTool("select");
          return;
        }
        const item = CATALOG.find((c) => c.id === s.catalogId) ?? CATALOG[0];
        if (isCustomItem(item.id)) {
          const x = snap(p.x);
          const y = snap(p.y);
          drag.current = { kind: "custom", x, y, sx: x, sy: y };
          return;
        }
        if (isAlongWall(item.id)) {
          const wall = hitWall(s.walls, p.x, p.y, 18);
          if (!wall) return;
          const t = projectT(wall, p.x, p.y);
          drag.current = {
            kind: "builtin",
            wallId: wall.id,
            t0: t,
            t1: t,
            side: sideOf(wall, p.x, p.y),
          };
          return;
        }
        s.addPiece(pieceFromCatalog(item, p.x, p.y));
        return;
      }
      if (s.tool === "room") {
        if (selectExisting(p)) {
          s.setTool("select");
          return;
        }
        s.addRoom({ id: uid(), label: s.roomName || "Room", x: snap(p.x), y: snap(p.y) });
        return;
      }
      if (s.tool === "erase") {
        const piece = hitTopPiece(s.pieces, p.x, p.y);
        if (piece) {
          s.remove(piece.id);
          return;
        }
        const opening = hitOpening(s.openings, s.walls, p.x, p.y);
        if (opening) {
          s.remove(opening.id);
          return;
        }
        const room = hitRoom(s.rooms, p.x, p.y);
        if (room) {
          s.remove(room.id);
          return;
        }
        const wall = hitWall(s.walls, p.x, p.y, 14);
        if (wall) s.remove(wall.id);
        return;
      }
      if (s.tool === "door" || s.tool === "window") {
        const piece = hitTopPiece(s.pieces, p.x, p.y);
        if (piece) {
          s.select(piece.id);
          s.setTool("select");
          s.checkpoint();
          drag.current = { kind: "move", id: piece.id, dx: p.x - piece.x, dy: p.y - piece.y };
          return;
        }
        const wall = hitWall(s.walls, p.x, p.y, 14);
        if (!wall) return;
        const width = s.tool === "door" ? 32 : 48;
        const placed = clampDoor(wall, projectT(wall, p.x, p.y), width);
        s.addOpening({
          id: uid(),
          wallId: wall.id,
          kind: s.tool,
          offset: placed.offset,
          width: placed.width,
          hinge: "start",
          side: 1,
        });
        return;
      }
      if (selectExisting(p)) return;
      s.select(null);
      drag.current = { kind: "pan", x: e.clientX, y: e.clientY, sx: pan.current.x, sy: pan.current.y };
    };

    const onMove = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const s = live.current;
      if (d.kind === "pan") {
        pan.current = { x: d.sx + (e.clientX - d.x), y: d.sy + (e.clientY - d.y) };
        return;
      }
      const p = worldFromEvent(e, canvas, pan.current, zoom.current);
      if (d.kind === "wall") {
        const j = snapToJoints(p.x, p.y, s.walls);
        const dx = j.x - d.sx;
        const dy = j.y - d.sy;
        if (Math.abs(dx) >= Math.abs(dy)) {
          d.x = j.x;
          d.y = d.sy;
        } else {
          d.x = d.sx;
          d.y = j.y;
        }
        return;
      }
      if (d.kind === "custom") {
        d.x = snap(p.x);
        d.y = snap(p.y);
        return;
      }
      if (d.kind === "builtin") {
        const wall = s.walls.find((w) => w.id === d.wallId);
        if (!wall) return;
        d.t1 = projectT(wall, p.x, p.y);
        d.side = sideOf(wall, p.x, p.y);
        return;
      }
      if (d.kind === "move") {
        s.movePiece(d.id, snap(p.x - d.dx), snap(p.y - d.dy));
        return;
      }
      if (d.kind === "move-room") {
        s.moveRoom(d.id, snap(p.x - d.dx), snap(p.y - d.dy));
        return;
      }
      if (d.kind === "resize") {
        const piece = s.pieces.find((x) => x.id === d.id);
        if (!piece) return;
        s.resizePiece(d.id, resizeFromHandle(piece, d.handle, p.x, p.y));
      }
    };

    const onUp = () => {
      const d = drag.current;
      const s = live.current;
      if (d?.kind === "wall") {
        const len = Math.hypot(d.x - d.sx, d.y - d.sy);
        if (len >= 12) {
          s.addWall({ id: uid(), x1: d.sx, y1: d.sy, x2: d.x, y2: d.y });
        } else {
          const wall = hitWall(s.walls, d.sx, d.sy, 14);
          if (wall) {
            s.select(wall.id);
            s.setTool("select");
          }
        }
      }
      if (d?.kind === "custom") {
        const w = Math.abs(d.x - d.sx);
        const h = Math.abs(d.y - d.sy);
        if (w >= 12 && h >= 12) {
          const item = CATALOG.find((c) => c.id === s.catalogId) ?? CATALOG[0];
          s.addPiece({
            id: uid(),
            kind: "furniture",
            shape: item.shape,
            label: "Piece",
            x: snap((d.sx + d.x) / 2),
            y: snap((d.sy + d.y) / 2),
            w: snap(w) || 12,
            h: snap(h) || 12,
            rot: 0,
          });
        }
      }
      if (d?.kind === "builtin") {
        const wall = s.walls.find((w) => w.id === d.wallId);
        const item = CATALOG.find((c) => c.id === s.catalogId) ?? CATALOG[0];
        if (wall) s.addPiece(pieceFromBuiltin(wall, d.t0, d.t1, d.side, item));
      }
      drag.current = null;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const old = zoom.current;
      const next = Math.min(2.6, Math.max(0.35, old * (e.deltaY > 0 ? 0.92 : 1.08)));
      const r = canvas.getBoundingClientRect();
      const cx = e.clientX - r.left;
      const cy = e.clientY - r.top;
      const wx = (cx - pan.current.x) / (PPI * old);
      const wy = (cy - pan.current.y) / (PPI * old);
      pan.current = { x: cx - wx * PPI * next, y: cy - wy * PPI * next };
      zoom.current = next;
    };

    const onContext = (e: Event) => e.preventDefault();

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("contextmenu", onContext);
    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("contextmenu", onContext);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={cn(
        "h-[min(72vh,640px)] w-full touch-none bg-ink",
        tool === "select" || tool === "erase" ? "cursor-pointer" : "cursor-crosshair",
      )}
      aria-label="Floor plan"
    />
  );
}

function hitOpening(openings: Opening[], walls: WallSeg[], x: number, y: number) {
  for (const o of openings) {
    const wall = walls.find((w) => w.id === o.wallId);
    if (!wall) continue;
    const a = along(wall, o.offset + o.width / 2);
    if (Math.hypot(a.x - x, a.y - y) < 14) return o;
  }
  return null;
}

function draw(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  state: {
    walls: WallSeg[];
    openings: Opening[];
    pieces: Piece[];
    rooms: RoomLabel[];
    selected: string | null;
    catalogId: string;
    unit: Unit;
    wallKeep: WallKeep;
    pan: { x: number; y: number };
    zoom: number;
    drag: Drag | null;
  },
) {
  const { walls, openings, pieces, rooms, selected, catalogId, unit, wallKeep, pan, zoom, drag } = state;
  const s = PPI * zoom;
  const overlap = overlappingIds(pieces);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#0c0b0b";
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.translate(pan.x, pan.y);

  const originX = -pan.x / s;
  const originY = -pan.y / s;
  const maxX = originX + w / s;
  const maxY = originY + h / s;
  const startX = Math.floor(originX / 12) * 12;
  const startY = Math.floor(originY / 12) * 12;
  for (let x = startX; x < maxX; x += 12) {
    ctx.beginPath();
    ctx.strokeStyle = x % 48 === 0 ? "rgba(42,36,38,0.9)" : "rgba(42,36,38,0.45)";
    ctx.lineWidth = x % 48 === 0 ? 1 : 0.5;
    ctx.moveTo(x * s, startY * s);
    ctx.lineTo(x * s, maxY * s);
    ctx.stroke();
  }
  for (let y = startY; y < maxY; y += 12) {
    ctx.beginPath();
    ctx.strokeStyle = y % 48 === 0 ? "rgba(42,36,38,0.9)" : "rgba(42,36,38,0.45)";
    ctx.lineWidth = y % 48 === 0 ? 1 : 0.5;
    ctx.moveTo(startX * s, y * s);
    ctx.lineTo(maxX * s, y * s);
    ctx.stroke();
  }

  for (const room of rooms) drawRoom(ctx, room, s, room.id === selected);

  for (const piece of pieces) {
    drawPiece(ctx, piece, s, piece.id === selected, overlap.has(piece.id), unit);
  }
  const selectedPiece = pieces.find((p) => p.id === selected);
  if (selectedPiece) drawHandles(ctx, selectedPiece, s);

  if (drag?.kind === "custom") {
    const x = Math.min(drag.sx, drag.x) * s;
    const y = Math.min(drag.sy, drag.y) * s;
    const ww = Math.abs(drag.x - drag.sx) * s;
    const hh = Math.abs(drag.y - drag.sy) * s;
    ctx.strokeStyle = "rgba(179,36,64,0.85)";
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, ww, hh);
    ctx.setLineDash([]);
    ctx.fillStyle = "#8c8888";
    ctx.font = '10px "IBM Plex Mono", monospace';
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(
      `${formatDim(Math.abs(drag.x - drag.sx), unit)} × ${formatDim(Math.abs(drag.y - drag.sy), unit)}`,
      x + ww / 2,
      y + hh + 6,
    );
  }
  if (drag?.kind === "builtin") {
    const wall = walls.find((wl) => wl.id === drag.wallId);
    const item = CATALOG.find((c) => c.id === catalogId);
    if (wall && item) {
      const preview = pieceFromBuiltin(wall, drag.t0, drag.t1, drag.side, item);
      drawPiece(ctx, preview, s, true, false, unit);
    }
  }

  for (const wall of walls) {
    drawWall(ctx, wall, openings.filter((o) => o.wallId === wall.id), s, wall.id === selected, unit);
  }
  const selectedWall = walls.find((w) => w.id === selected);
  if (selectedWall) drawWallEnds(ctx, selectedWall, s, wallKeep);
  if (drag?.kind === "wall") {
    const len = Math.hypot(drag.x - drag.sx, drag.y - drag.sy);
    ctx.strokeStyle = "rgba(175,175,175,0.7)";
    ctx.lineWidth = Math.max(2, WALL_THICK * s);
    ctx.beginPath();
    ctx.moveTo(drag.sx * s, drag.sy * s);
    ctx.lineTo(drag.x * s, drag.y * s);
    ctx.stroke();
    ctx.fillStyle = "#eceaea";
    ctx.font = '11px "IBM Plex Mono", monospace';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(formatDim(len, unit), ((drag.sx + drag.x) / 2) * s, ((drag.sy + drag.y) / 2) * s - 12);
  }

  ctx.restore();

  drawScale(ctx, zoom, unit);
}

function drawScale(ctx: CanvasRenderingContext2D, zoom: number, unit: Unit) {
  const inches = unit === "metric" ? 200 / 2.54 : 96;
  const label = unit === "metric" ? "2 m" : "8'";
  const px = inches * PPI * zoom;
  const x = 16;
  const y = ctx.canvas.clientHeight - 18;
  ctx.strokeStyle = "#afafaf";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + px, y);
  ctx.moveTo(x, y - 4);
  ctx.lineTo(x, y + 4);
  ctx.moveTo(x + px, y - 4);
  ctx.lineTo(x + px, y + 4);
  ctx.stroke();
  ctx.fillStyle = "#8c8888";
  ctx.font = '10px "IBM Plex Mono", monospace';
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText(label, x + px / 2, y - 4);
}

function drawRoom(ctx: CanvasRenderingContext2D, room: RoomLabel, s: number, on: boolean) {
  ctx.fillStyle = on ? "#b32440" : "rgba(140,136,136,0.85)";
  ctx.font = `600 ${Math.max(13, 15 * Math.min(s / 1.7, 1.4))}px "Instrument Sans", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(room.label, room.x * s, room.y * s);
}

function drawHandles(ctx: CanvasRenderingContext2D, piece: Piece, s: number) {
  const size = Math.max(7, 6 * Math.min(s / 1.7, 1.6));
  ctx.fillStyle = "#eceaea";
  ctx.strokeStyle = "#b32440";
  ctx.lineWidth = 1.5;
  for (const h of pieceHandles(piece)) {
    ctx.beginPath();
    ctx.rect(h.x * s - size / 2, h.y * s - size / 2, size, size);
    ctx.fill();
    ctx.stroke();
  }
}

function drawWallEnds(
  ctx: CanvasRenderingContext2D,
  wall: WallSeg,
  s: number,
  keep: WallKeep,
) {
  const mark = (x: number, y: number, kind: "a" | "b", on: boolean) => {
    ctx.beginPath();
    if (kind === "a") ctx.rect(x * s - 5, y * s - 5, 10, 10);
    else ctx.arc(x * s, y * s, 6, 0, Math.PI * 2);
    ctx.fillStyle = on ? "#b32440" : "#eceaea";
    ctx.fill();
    ctx.strokeStyle = "#0c0b0b";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = on ? "#eceaea" : "#0c0b0b";
    ctx.font = '8px "IBM Plex Mono", monospace';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(kind.toUpperCase(), x * s, y * s);
  };
  mark(wall.x1, wall.y1, "a", keep === "start");
  mark(wall.x2, wall.y2, "b", keep === "end");
}

function drawWall(
  ctx: CanvasRenderingContext2D,
  wall: WallSeg,
  openings: Opening[],
  s: number,
  on: boolean,
  unit: Unit,
) {
  const L = lengthIn(wall) || 1;
  const ux = (wall.x2 - wall.x1) / L;
  const uy = (wall.y2 - wall.y1) / L;
  const cuts = openings
    .map((o) => ({ o, a: o.offset, b: o.offset + o.width }))
    .sort((a, b) => a.a - b.a);
  const wallColor = on ? "#b32440" : "#afafaf";
  const wallWidth = Math.max(2, WALL_THICK * s * (on ? 1.15 : 1));
  let cursor = 0;
  const strokeSeg = (a: number, b: number) => {
    if (b - a < 1) return;
    const p = along(wall, a);
    const q = along(wall, b);
    ctx.strokeStyle = wallColor;
    ctx.lineWidth = wallWidth;
    ctx.lineCap = "butt";
    ctx.beginPath();
    ctx.moveTo(p.x * s, p.y * s);
    ctx.lineTo(q.x * s, q.y * s);
    ctx.stroke();
  };
  for (const c of cuts) {
    strokeSeg(cursor, c.a);
    drawOpening(ctx, wall, c.o, ux, uy, s, on);
    cursor = c.b;
  }
  strokeSeg(cursor, L);

  ctx.fillStyle = on ? "#eceaea" : "#8c8888";
  ctx.font = '10px "IBM Plex Mono", monospace';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const mx = ((wall.x1 + wall.x2) / 2) * s - uy * 12;
  const my = ((wall.y1 + wall.y2) / 2) * s + ux * 12;
  ctx.fillText(formatDim(L, unit), mx, my);
}

function drawOpening(
  ctx: CanvasRenderingContext2D,
  wall: WallSeg,
  o: Opening,
  ux: number,
  uy: number,
  s: number,
  on: boolean,
) {
  ctx.save();
  ctx.lineCap = "butt";
  const a = along(wall, o.offset);
  const b = along(wall, o.offset + o.width);
  const nx = -uy;
  const ny = ux;
  const half = WALL_THICK / 2;
  if (o.kind === "window") {
    ctx.strokeStyle = on ? "#eceaea" : "#afafaf";
    ctx.lineWidth = Math.max(1.2, s * 0.65);
    for (const d of [-half, half]) {
      ctx.beginPath();
      ctx.moveTo((a.x + nx * d) * s, (a.y + ny * d) * s);
      ctx.lineTo((b.x + nx * d) * s, (b.y + ny * d) * s);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }
  const hinge = o.hinge === "start" ? a : b;
  const sx = nx * o.side;
  const sy = ny * o.side;
  const closed = o.hinge === "start" ? { x: ux, y: uy } : { x: -ux, y: -uy };
  const startAng = Math.atan2(closed.y, closed.x);
  const sweep = (Math.PI / 2) * o.side * (o.hinge === "start" ? 1 : -1);
  ctx.strokeStyle = on ? "rgba(179,36,64,0.9)" : "rgba(179,36,64,0.75)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(hinge.x * s, hinge.y * s, o.width * s, startAng, startAng + sweep, sweep < 0);
  ctx.stroke();
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(hinge.x * s, hinge.y * s);
  ctx.lineTo((hinge.x + sx * o.width) * s, (hinge.y + sy * o.width) * s);
  ctx.stroke();
  ctx.restore();
}

function pathL(ctx: CanvasRenderingContext2D, w: number, h: number, s: number) {
  const t = Math.min(w, h) * 0.4;
  const x0 = (-w / 2) * s;
  const y0 = (-h / 2) * s;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x0 + t * s, y0);
  ctx.lineTo(x0 + t * s, y0 + (h - t) * s);
  ctx.lineTo(x0 + w * s, y0 + (h - t) * s);
  ctx.lineTo(x0 + w * s, y0 + h * s);
  ctx.lineTo(x0, y0 + h * s);
  ctx.closePath();
}

function drawPiece(
  ctx: CanvasRenderingContext2D,
  piece: Piece,
  s: number,
  on: boolean,
  clash: boolean,
  unit: Unit,
) {
  ctx.save();
  ctx.translate(piece.x * s, piece.y * s);
  ctx.rotate((piece.rot * Math.PI) / 180);
  const fill = clash
    ? "rgba(138,26,48,0.35)"
    : piece.kind === "wardrobe"
      ? "rgba(28,24,25,0.95)"
      : "rgba(22,20,21,0.92)";
  ctx.fillStyle = fill;
  ctx.strokeStyle = on ? "#b32440" : clash ? "#b32440" : "#afafaf";
  ctx.lineWidth = on ? 2 : 1.2;
  if (piece.shape === "round") {
    const r = (Math.min(piece.w, piece.h) / 2) * s;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (piece.shape === "l") {
    pathL(ctx, piece.w, piece.h, s);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.rect((-piece.w / 2) * s, (-piece.h / 2) * s, piece.w * s, piece.h * s);
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = "#eceaea";
  ctx.font = `${Math.max(9, Math.min(12, piece.w * s * 0.18))}px "Instrument Sans", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(piece.label, 0, -6, piece.w * s - 8);
  ctx.fillStyle = "#8c8888";
  ctx.font = '9px "IBM Plex Mono", monospace';
  ctx.fillText(`${formatDim(piece.w, unit)} × ${formatDim(piece.h, unit)}`, 0, 10);
  ctx.restore();
}
