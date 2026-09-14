import assert from "node:assert/strict";
import test from "node:test";
import {
  CATALOG,
  SAMPLE_PIECES,
  SAMPLE_WALLS,
  aabb,
  aabbsOverlap,
  clampDoor,
  formatDim,
  fmtIn,
  hitPiece,
  isAlongWall,
  isCustomItem,
  lengthIn,
  localPoint,
  overlappingIds,
  parseDim,
  parsePlan,
  pieceFromBuiltin,
  rotate90,
  serializePlan,
  setWallLength,
  sideOf,
  slideJoint,
  snap,
  wallCaption,
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
  assert.equal(fmtIn(62), "5' 2\"");
});

test("parseDim imperial phrases", () => {
  assert.equal(parseDim("192", "imperial"), 192);
  assert.equal(parseDim("192in", "imperial"), 192);
  assert.equal(parseDim("192 inches", "imperial"), 192);
  assert.equal(parseDim("16'", "imperial"), 192);
  assert.equal(parseDim("16 ft", "imperial"), 192);
  assert.equal(parseDim("5 ft, 2 inches", "imperial"), 62);
  assert.equal(parseDim("5ft 2in", "imperial"), 62);
  assert.equal(parseDim(`5' 2"`, "imperial"), 62);
  assert.equal(parseDim(`5'2"`, "imperial"), 62);
  assert.equal(parseDim("5.5 ft", "imperial"), 66);
  assert.equal(parseDim("5 feet, 2 inches", "imperial"), 62);
  assert.equal(parseDim(`192"`, "imperial"), 192);
});

test("parseDim metric and mixed", () => {
  assert.ok(Math.abs((parseDim("152 cm", "imperial") ?? 0) - 152 / 2.54) < 0.01);
  assert.ok(Math.abs((parseDim("1.5 m", "imperial") ?? 0) - 1.5 * 39.37007874015748) < 0.01);
  assert.ok(Math.abs((parseDim("100", "metric") ?? 0) - 100 / 2.54) < 0.01);
  assert.equal(parseDim("nope", "imperial"), null);
});

test("formatDim metric", () => {
  assert.equal(formatDim(192, "imperial"), "16' 0\"");
  assert.equal(formatDim(192, "metric"), "4.88 m");
  assert.equal(formatDim(18, "metric"), "46 cm");
});

test("lengthIn", () => {
  const w: WallSeg = { id: "a", x1: 0, y1: 0, x2: 120, y2: 0 };
  assert.equal(lengthIn(w), 120);
});

test("setWallLength keeps start and slides the facade", () => {
  const wall: WallSeg = { id: "n", x1: 0, y1: 0, x2: 240, y2: 0 };
  const next = setWallLength(wall, 180, "start");
  assert.equal(next.wall.x1, 0);
  assert.equal(next.wall.x2, 180);
  const walls = slideJoint(
    [
      { id: "n", x1: 0, y1: 0, x2: 240, y2: 0 },
      { id: "e", x1: 240, y1: 0, x2: 240, y2: 168 },
      { id: "s", x1: 240, y1: 168, x2: 0, y2: 168 },
    ],
    next.from,
    next.to,
  );
  assert.equal(walls[0].x2, 180);
  assert.equal(walls[1].x1, 180);
  assert.equal(walls[1].x2, 180);
  assert.equal(walls[2].x1, 180);
  assert.equal(walls[2].x2, 0);
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

test("sample pieces stay inside the outer walls", () => {
  const outer = { x1: 1, y1: 1, x2: 239, y2: 167 };
  for (const p of SAMPLE_PIECES) {
    const box = aabb(p);
    assert.ok(box.x1 >= outer.x1 - 0.5, `${p.label} x1 ${box.x1}`);
    assert.ok(box.y1 >= outer.y1 - 0.5, `${p.label} y1 ${box.y1}`);
    assert.ok(box.x2 <= outer.x2 + 0.5, `${p.label} x2 ${box.x2}`);
    assert.ok(box.y2 <= outer.y2 + 0.5, `${p.label} y2 ${box.y2}`);
  }
  const ids = overlappingIds(SAMPLE_PIECES);
  assert.equal(ids.size, 0, `overlaps: ${[...ids].join(",")}`);
  const west = SAMPLE_WALLS.find((w) => w.id === "w")!;
  assert.equal(lengthIn(west), 168);
});

test("sample pieces sit on a wall", () => {
  const inner = 2;
  for (const p of SAMPLE_PIECES) {
    const box = aabb(p);
    const on =
      Math.abs(box.y1 - inner) < 2.6 ||
      Math.abs(box.y2 - (168 - inner)) < 2.6 ||
      Math.abs(box.x1 - inner) < 2.6 ||
      Math.abs(box.x2 - (240 - inner)) < 2.6 ||
      Math.abs(box.x2 - (192 - inner)) < 2.6 ||
      Math.abs(box.x1 - (192 + inner)) < 2.6 ||
      Math.abs(box.y1 - (96 + inner)) < 2.6;
    assert.ok(on, `${p.label} not on a wall ${JSON.stringify(box)}`);
  }
});

test("wallCaption names the envelope", () => {
  assert.equal(wallCaption(SAMPLE_WALLS[0], SAMPLE_WALLS), "North wall");
  assert.equal(wallCaption(SAMPLE_WALLS[1], SAMPLE_WALLS), "East wall");
  assert.equal(wallCaption(SAMPLE_WALLS[2], SAMPLE_WALLS), "South wall");
  assert.equal(wallCaption(SAMPLE_WALLS[3], SAMPLE_WALLS), "West wall");
  assert.equal(wallCaption(SAMPLE_WALLS[4], SAMPLE_WALLS), "Partition");
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
