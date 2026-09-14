import assert from "node:assert/strict";
import test from "node:test";
import {
  CATALOG,
  aabb,
  aabbsOverlap,
  clampDoor,
  fmtIn,
  hitPiece,
  isAlongWall,
  isCustomItem,
  lengthIn,
  localPoint,
  overlappingIds,
  parsePlan,
  pieceFromBuiltin,
  rotate90,
  serializePlan,
  sideOf,
  snap,
  type Piece,
  type WallSeg,
} from "./plan.ts";

test("snap to 6 inches", () => {
  assert.equal(snap(0), 0);
  assert.equal(snap(4), 6);
  assert.equal(snap(2), 0);
  assert.equal(snap(9), 12);
});

test("fmtIn", () => {
  assert.equal(fmtIn(0), "0' 0\"");
  assert.equal(fmtIn(12), "1' 0\"");
  assert.equal(fmtIn(80), "6' 8\"");
  assert.equal(fmtIn(192), "16' 0\"");
});

test("lengthIn", () => {
  const w: WallSeg = { id: "a", x1: 0, y1: 0, x2: 120, y2: 0 };
  assert.equal(lengthIn(w), 120);
});

test("clampDoor stays on the wall", () => {
  const w: WallSeg = { id: "a", x1: 0, y1: 0, x2: 120, y2: 0 };
  const a = clampDoor(w, 10, 36);
  assert.ok(a.offset >= 3);
  assert.ok(a.offset + a.width <= 117);
  const b = clampDoor(w, 200, 36);
  assert.ok(b.offset + b.width <= 117);
});

test("hitPiece respects rotation", () => {
  const p: Piece = {
    id: "d",
    kind: "furniture",
    shape: "rect",
    label: "Desk",
    x: 100,
    y: 100,
    w: 60,
    h: 30,
    rot: 90,
  };
  assert.equal(hitPiece(p, 100, 100), true);
  assert.equal(hitPiece(p, 100, 100 + 28), true);
  assert.equal(hitPiece(p, 100, 100 + 40), false);
  assert.equal(hitPiece(p, 100 + 28, 100), false);
});

test("localPoint origin", () => {
  const p: Piece = {
    id: "d",
    kind: "furniture",
    shape: "rect",
    label: "x",
    x: 10,
    y: 20,
    w: 12,
    h: 12,
    rot: 0,
  };
  const l = localPoint(p, 10, 20);
  assert.equal(l.x, 0);
  assert.equal(l.y, 0);
});

test("rotate90 wraps", () => {
  assert.equal(rotate90(0), 90);
  assert.equal(rotate90(270), 0);
});

test("sideOf", () => {
  const w: WallSeg = { id: "a", x1: 0, y1: 0, x2: 120, y2: 0 };
  assert.equal(sideOf(w, 60, 10), 1);
  assert.equal(sideOf(w, 60, -10), -1);
});

test("pieceFromBuiltin sits against a horizontal wall", () => {
  const wall: WallSeg = { id: "n", x1: 0, y1: 0, x2: 240, y2: 0 };
  const item = CATALOG.find((c) => c.id === "builtin")!;
  const p = pieceFromBuiltin(wall, 12, 84, 1, item);
  assert.equal(p.kind, "wardrobe");
  assert.equal(p.w, 72);
  assert.equal(p.h, 24);
  assert.equal(p.y, 12);
  assert.equal(p.x, 48);
});

test("catalog flags", () => {
  assert.equal(isCustomItem("custom"), true);
  assert.equal(isAlongWall("builtin"), true);
  assert.equal(isAlongWall("queen"), false);
});

test("aabb overlap", () => {
  const a: Piece = {
    id: "a",
    kind: "furniture",
    shape: "rect",
    label: "A",
    x: 0,
    y: 0,
    w: 40,
    h: 40,
    rot: 0,
  };
  const b: Piece = { ...a, id: "b", x: 10, y: 0 };
  const c: Piece = { ...a, id: "c", x: 80, y: 0 };
  assert.equal(aabbsOverlap(aabb(a), aabb(b)), true);
  assert.equal(aabbsOverlap(aabb(a), aabb(c)), false);
  const ids = overlappingIds([a, b, c]);
  assert.equal(ids.has("a"), true);
  assert.equal(ids.has("b"), true);
  assert.equal(ids.has("c"), false);
});

test("plan json roundtrip", () => {
  const plan = serializePlan({
    walls: [{ id: "w", x1: 0, y1: 0, x2: 12, y2: 0 }],
    openings: [],
    pieces: [],
    rooms: [{ id: "r", label: "Office", x: 6, y: 6 }],
  });
  const back = parsePlan(JSON.stringify(plan));
  assert.ok(back);
  assert.equal(back.rooms[0].label, "Office");
  assert.equal(parsePlan("not json"), null);
});
