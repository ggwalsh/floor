import { type ReactNode, useEffect, useId, useState } from "react";
import type { OnBrand } from "../shared/brand";
import { cn } from "../shared/cn";
import { FloorCanvas } from "./canvas";
import {
  CATALOG,
  ROOM_PRESETS,
  clampDim,
  formatDim,
  formatDimAlt,
  isAlongWall,
  isCustomItem,
  lengthIn,
  parseDim,
  parsePlan,
  rotate90,
  serializePlan,
  wallCaption,
  type Tool,
  type Unit,
} from "./plan";
import { useFloor } from "./store";

const TOOLS: { id: Tool; label: string }[] = [
  { id: "select", label: "Select" },
  { id: "wall", label: "Wall" },
  { id: "door", label: "Door" },
  { id: "window", label: "Window" },
  { id: "room", label: "Room" },
  { id: "furniture", label: "Furniture" },
  { id: "erase", label: "Erase" },
];

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-9 rounded-full px-3 text-xs",
        active ? "bg-amaranth text-fg" : "border border-line text-silver hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

function DimInput({
  inches,
  onCommit,
  unit,
  label,
  min = 1,
  max = 2400,
}: {
  inches: number;
  onCommit: (inches: number) => void;
  unit: Unit;
  label: string;
  min?: number;
  max?: number;
}) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? formatDim(inches, unit);
  const live = draft != null ? parseDim(draft, unit) : null;

  return (
    <label className="flex flex-col gap-1 text-xs text-muted" htmlFor={id}>
      {label}
      <input
        id={id}
        className="min-h-11 rounded-sm border border-line bg-ink px-3 text-sm text-fg tabular-nums"
        value={shown}
        placeholder={unit === "imperial" ? `5' 2"` : "157 cm"}
        aria-label={label}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => {
          setDraft(formatDim(inches, unit));
          e.target.select();
        }}
        onBlur={() => {
          const parsed = parseDim(draft ?? "", unit);
          setDraft(null);
          if (parsed == null) return;
          onCommit(clampDim(parsed, min, max));
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
      <span className="font-mono text-[11px] text-muted">
        {live != null
          ? `${formatDim(live, "imperial")} · ${formatDim(live, "metric")}`
          : draft != null
            ? `Try 5' 2" or 157 cm`
            : formatDimAlt(inches, unit)}
      </span>
    </label>
  );
}

export function FloorApp({ onBrand, homeHref = "./" }: { onBrand?: OnBrand; homeHref?: string }) {
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
  const setTool = useFloor((s) => s.setTool);
  const setCatalogId = useFloor((s) => s.setCatalogId);
  const setRoomName = useFloor((s) => s.setRoomName);
  const setUnit = useFloor((s) => s.setUnit);
  const setWallKeep = useFloor((s) => s.setWallKeep);
  const select = useFloor((s) => s.select);
  const updatePiece = useFloor((s) => s.updatePiece);
  const updateOpening = useFloor((s) => s.updateOpening);
  const updateOpeningWidth = useFloor((s) => s.updateOpeningWidth);
  const updateRoom = useFloor((s) => s.updateRoom);
  const updateWallLength = useFloor((s) => s.updateWallLength);
  const remove = useFloor((s) => s.remove);
  const duplicate = useFloor((s) => s.duplicate);
  const nudge = useFloor((s) => s.nudge);
  const loadSample = useFloor((s) => s.loadSample);
  const loadPlan = useFloor((s) => s.loadPlan);
  const clear = useFloor((s) => s.clear);
  const undo = useFloor((s) => s.undo);
  const redo = useFloor((s) => s.redo);
  const canUndo = useFloor((s) => s.past.length > 0);
  const canRedo = useFloor((s) => s.future.length > 0);
  const setBrand = onBrand ?? (() => {});

  const piece = pieces.find((p) => p.id === selected) ?? null;
  const opening = openings.find((o) => o.id === selected) ?? null;
  const room = rooms.find((r) => r.id === selected) ?? null;
  const wall = walls.find((w) => w.id === selected) ?? null;

  useEffect(() => {
    setBrand("think");
    return () => setBrand("idle");
  }, [setBrand]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selected) remove(selected);
      }
      if (e.key === "Escape") {
        setTool("select");
        select(null);
      }
      if (e.key.toLowerCase() === "r" && piece) {
        e.preventDefault();
        updatePiece(piece.id, { rot: rotate90(piece.rot) });
      }
      if (e.key.toLowerCase() === "v") setTool("select");
      if (e.key.toLowerCase() === "w") setTool(tool === "wall" ? "select" : "wall");
      if (e.key.toLowerCase() === "d" && !(e.metaKey || e.ctrlKey)) setTool(tool === "door" ? "select" : "door");
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        if (selected) duplicate(selected);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      }
      const step = e.shiftKey ? 12 : 6;
      if (selected && (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowDown")) {
        e.preventDefault();
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        nudge(selected, dx, dy);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, piece, tool, remove, setTool, select, updatePiece, undo, redo, duplicate, nudge]);

  function pickTool(id: Tool) {
    setTool(id === tool && id !== "select" ? "select" : id);
  }

  function exportPng() {
    const canvas = document.querySelector<HTMLCanvasElement>('canvas[aria-label="Floor plan"]');
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "floor-plan.png";
      a.click();
      URL.revokeObjectURL(a.href);
      setBrand("done");
      window.setTimeout(() => setBrand("think"), 1600);
    });
  }

  function exportJson() {
    const blob = new Blob(
      [JSON.stringify(serializePlan({ walls, openings, pieces, rooms }), null, 2)],
      { type: "application/json" },
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "floor-plan.json";
    a.click();
    URL.revokeObjectURL(a.href);
    setBrand("done");
    window.setTimeout(() => setBrand("think"), 1600);
  }

  function importJson() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const parsed = parsePlan(await file.text());
      if (!parsed) return;
      loadPlan(parsed);
      setBrand("done");
      window.setTimeout(() => setBrand("think"), 1600);
    };
    input.click();
  }

  const run = walls.reduce((n, w) => n + lengthIn(w), 0);
  const item = CATALOG.find((c) => c.id === catalogId);

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 sm:py-14">
      <p className="font-mono text-xs tracking-widest text-accent uppercase">
        <a href={homeHref} className="hover:text-fg">
          My tools
        </a>
        {" · 04 · Floor"}
        <a
          href="https://github.com/ggwalsh/floor"
          className="ml-3 text-silver hover:text-fg"
          target="_blank"
          rel="noreferrer"
        >
          GitHub
        </a>
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">Floor</h1>
      <p className="mt-4 max-w-2xl text-muted">
        Sketch the rooms. Drop a bed, a desk, a built-in. Click it, type the size — 5 ft 2 in or 157
        cm, either works. Click a wall to type its length.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-2">
        {TOOLS.map((t) => (
          <button
            key={t.label}
            type="button"
            onClick={() => pickTool(t.id)}
            className={cn(
              "min-h-11 rounded-full px-4 text-sm",
              tool === t.id ? "bg-amaranth text-fg" : "border border-line text-silver hover:text-fg",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tool === "furniture" ? (
        <div className="mt-4 space-y-2 rounded-lg border border-line bg-surface p-4">
          <p className="font-mono text-xs tracking-widest text-muted uppercase">Place</p>
          <div className="flex flex-wrap gap-2">
            {CATALOG.map((c) => (
              <Chip key={c.id} active={catalogId === c.id} onClick={() => setCatalogId(c.id)}>
                {c.label}
              </Chip>
            ))}
          </div>
          <p className="text-xs text-muted">
            {item && isCustomItem(item.id)
              ? "Drag a rectangle on empty floor. Label it after."
              : item && isAlongWall(item.id)
                ? "Click a wall and drag along it. Click a piece to select it instead."
                : "Click empty floor to stamp. Click an existing piece to select and edit it."}
          </p>
        </div>
      ) : null}

      {tool === "room" ? (
        <div className="mt-4 space-y-2 rounded-lg border border-line bg-surface p-4">
          <p className="font-mono text-xs tracking-widest text-muted uppercase">Room name</p>
          <div className="flex flex-wrap gap-2">
            {ROOM_PRESETS.map((name) => (
              <Chip key={name} active={roomName === name} onClick={() => setRoomName(name)}>
                {name}
              </Chip>
            ))}
          </div>
          <p className="text-xs text-muted">Click empty floor to drop the label. Click a piece to edit it.</p>
        </div>
      ) : null}

      {tool === "door" || tool === "window" ? (
        <p className="mt-3 text-xs text-muted">Click a wall to cut a {tool} into it. Click a piece to select it.</p>
      ) : null}

      {tool === "select" ? (
        <p className="mt-3 text-xs text-muted">
          Click a piece or a wall. Size fields appear under the plan — 192 in, 16 ft, 5' 2", or
          157 cm.
        </p>
      ) : null}

      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="overflow-hidden rounded-lg border border-line">
          <FloorCanvas />
          <div className="border-t border-line bg-surface px-4 py-3">
            {piece ? (
              <div className="flex flex-wrap items-start gap-3">
                <p className="w-full font-mono text-xs tracking-widest text-accent uppercase sm:w-auto sm:pt-6">
                  {piece.label}
                </p>
                <DimInput
                  key={`${piece.id}-w`}
                  label="Width"
                  inches={piece.w}
                  unit={unit}
                  min={6}
                  max={600}
                  onCommit={(n) => updatePiece(piece.id, { w: n })}
                />
                <DimInput
                  key={`${piece.id}-h`}
                  label="Depth"
                  inches={piece.h}
                  unit={unit}
                  min={6}
                  max={600}
                  onCommit={(n) => updatePiece(piece.id, { h: n })}
                />
                <button
                  type="button"
                  onClick={() => updatePiece(piece.id, { rot: rotate90(piece.rot) })}
                  className="min-h-11 self-end rounded-full border border-line px-4 text-sm text-silver hover:text-fg"
                >
                  Rotate 90°
                </button>
              </div>
            ) : wall ? (
              <div className="flex flex-wrap items-start gap-3">
                <p className="w-full font-mono text-xs tracking-widest text-accent uppercase sm:w-auto sm:pt-6">
                  {wallCaption(wall, walls)}
                </p>
                <DimInput
                  key={`${wall.id}-len`}
                  label="Length"
                  inches={lengthIn(wall)}
                  unit={unit}
                  min={12}
                  max={2400}
                  onCommit={(n) => updateWallLength(wall.id, n)}
                />
                <div className="flex flex-wrap gap-2 pt-5">
                  <Chip active={wallKeep === "start"} onClick={() => setWallKeep("start")}>
                    Keep A
                  </Chip>
                  <Chip active={wallKeep === "end"} onClick={() => setWallKeep("end")}>
                    Keep B
                  </Chip>
                </div>
              </div>
            ) : opening ? (
              <div className="flex flex-wrap items-start gap-3">
                <p className="w-full font-mono text-xs tracking-widest text-accent uppercase sm:w-auto sm:pt-6">
                  {opening.kind}
                </p>
                <DimInput
                  key={`${opening.id}-w`}
                  label="Width"
                  inches={opening.width}
                  unit={unit}
                  min={18}
                  max={96}
                  onCommit={(n) => updateOpeningWidth(opening.id, n)}
                />
              </div>
            ) : (
              <p className="text-sm text-muted">
                Click a piece or a wall, then type its size here — 192 in, 16 ft, 5 ft 2 in, or
                157 cm.
              </p>
            )}
            <p className="mt-2 font-mono text-xs text-muted">
              Select, then type a dimension or drag the handles. Wall is click-drag. Empty click
              pans. Scroll zooms. Grid is 1'.
            </p>
          </div>
        </div>

        <aside className="flex flex-col gap-4">
          <div className="rounded-lg border border-line bg-surface p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="font-mono text-xs tracking-widest text-accent uppercase">Plan</p>
              <div className="flex gap-1">
                <Chip active={unit === "imperial"} onClick={() => setUnit("imperial")}>
                  ft in
                </Chip>
                <Chip active={unit === "metric"} onClick={() => setUnit("metric")}>
                  m cm
                </Chip>
              </div>
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{formatDim(run, unit)}</p>
            <p className="mt-1 text-xs text-muted">
              {walls.length} walls · {openings.filter((o) => o.kind === "door").length} doors ·{" "}
              {rooms.length} rooms · {pieces.length} pieces
            </p>
          </div>

          <div className="flex-1 rounded-lg border border-line bg-surface p-4">
            <p className="font-mono text-xs tracking-widest text-accent uppercase">
              {piece
                ? piece.label
                : opening
                  ? opening.kind
                  : room
                    ? room.label
                    : wall
                      ? wallCaption(wall, walls)
                      : "Selected"}
            </p>
            {piece ? (
              <div className="mt-3 space-y-3">
                <label className="flex flex-col gap-1 text-xs text-muted">
                  Label
                  <input
                    className="min-h-11 rounded-sm border border-line bg-ink px-3 text-sm text-fg"
                    value={piece.label}
                    onChange={(e) => updatePiece(piece.id, { label: e.target.value })}
                  />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <DimInput
                    key={`${piece.id}-side-w`}
                    label="Width"
                    inches={piece.w}
                    unit={unit}
                    min={6}
                    max={600}
                    onCommit={(n) => updatePiece(piece.id, { w: n })}
                  />
                  <DimInput
                    key={`${piece.id}-side-h`}
                    label="Depth"
                    inches={piece.h}
                    unit={unit}
                    min={6}
                    max={600}
                    onCommit={(n) => updatePiece(piece.id, { h: n })}
                  />
                </div>
                <p className="text-xs text-muted">
                  Type 192, 16 ft, 5' 2", or 157 cm. Drag the handles on the piece to size it
                  by eye.
                </p>
                <button
                  type="button"
                  onClick={() => updatePiece(piece.id, { rot: rotate90(piece.rot) })}
                  className="min-h-11 w-full rounded-full border border-line text-sm text-silver hover:text-fg"
                >
                  Rotate 90°
                </button>
                <button
                  type="button"
                  onClick={() => duplicate(piece.id)}
                  className="min-h-11 w-full rounded-full border border-line text-sm text-silver hover:text-fg"
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  onClick={() => remove(piece.id)}
                  className="min-h-11 w-full rounded-full border border-line text-sm text-muted hover:text-accent"
                >
                  Remove
                </button>
              </div>
            ) : opening ? (
              <div className="mt-3 space-y-3">
                <DimInput
                  key={`${opening.id}-side-w`}
                  label="Width"
                  inches={opening.width}
                  unit={unit}
                  min={18}
                  max={96}
                  onCommit={(n) => updateOpeningWidth(opening.id, n)}
                />
                {opening.kind === "door" ? (
                  <div className="flex flex-wrap gap-2">
                    <Chip
                      active={opening.hinge === "start"}
                      onClick={() => updateOpening(opening.id, { hinge: "start" })}
                    >
                      Hinge start
                    </Chip>
                    <Chip
                      active={opening.hinge === "end"}
                      onClick={() => updateOpening(opening.id, { hinge: "end" })}
                    >
                      Hinge end
                    </Chip>
                    <Chip
                      active={opening.side === 1}
                      onClick={() => updateOpening(opening.id, { side: 1 })}
                    >
                      Swing A
                    </Chip>
                    <Chip
                      active={opening.side === -1}
                      onClick={() => updateOpening(opening.id, { side: -1 })}
                    >
                      Swing B
                    </Chip>
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() => remove(opening.id)}
                  className="min-h-11 w-full rounded-full border border-line text-sm text-muted hover:text-accent"
                >
                  Remove
                </button>
              </div>
            ) : room ? (
              <div className="mt-3 space-y-3">
                <label className="flex flex-col gap-1 text-xs text-muted">
                  Room
                  <input
                    className="min-h-11 rounded-sm border border-line bg-ink px-3 text-sm text-fg"
                    value={room.label}
                    onChange={(e) => updateRoom(room.id, { label: e.target.value })}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => remove(room.id)}
                  className="min-h-11 w-full rounded-full border border-line text-sm text-muted hover:text-accent"
                >
                  Remove
                </button>
              </div>
            ) : wall ? (
              <div className="mt-3 space-y-3">
                <DimInput
                  key={`${wall.id}-side-len`}
                  label="Length"
                  inches={lengthIn(wall)}
                  unit={unit}
                  min={12}
                  max={2400}
                  onCommit={(n) => updateWallLength(wall.id, n)}
                />
                <p className="text-xs text-muted">
                  A stays put, B moves — or the other way around. Connected corners slide with the
                  free end.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Chip active={wallKeep === "start"} onClick={() => setWallKeep("start")}>
                    Keep A
                  </Chip>
                  <Chip active={wallKeep === "end"} onClick={() => setWallKeep("end")}>
                    Keep B
                  </Chip>
                </div>
                <button
                  type="button"
                  onClick={() => remove(wall.id)}
                  className="min-h-11 w-full rounded-full border border-line text-sm text-muted hover:text-accent"
                >
                  Remove
                </button>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted">
                Click a piece or a wall on the plan, or pick one below, then type the size under
                the plan.
              </p>
            )}

            <div className="mt-4 border-t border-line pt-3">
              <p className="font-mono text-[11px] tracking-widest text-muted uppercase">On the plan</p>
              <ul className="mt-2 max-h-48 space-y-1 overflow-auto">
                {pieces.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setTool("select");
                        select(p.id);
                      }}
                      className={cn(
                        "flex min-h-9 w-full items-center justify-between gap-2 rounded-sm px-2 text-left text-xs",
                        p.id === selected ? "bg-amaranth text-fg" : "text-silver hover:bg-raised hover:text-fg",
                      )}
                    >
                      <span className="truncate">{p.label}</span>
                      <span className="shrink-0 font-mono tabular-nums text-muted">
                        {formatDim(p.w, unit)} × {formatDim(p.h, unit)}
                      </span>
                    </button>
                  </li>
                ))}
                {openings.map((o) => (
                  <li key={o.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setTool("select");
                        select(o.id);
                      }}
                      className={cn(
                        "flex min-h-9 w-full items-center justify-between gap-2 rounded-sm px-2 text-left text-xs",
                        o.id === selected ? "bg-amaranth text-fg" : "text-silver hover:bg-raised hover:text-fg",
                      )}
                    >
                      <span className="truncate capitalize">{o.kind}</span>
                      <span className="shrink-0 font-mono tabular-nums text-muted">
                        {formatDim(o.width, unit)}
                      </span>
                    </button>
                  </li>
                ))}
                {walls.map((w) => (
                  <li key={w.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setTool("select");
                        select(w.id);
                      }}
                      className={cn(
                        "flex min-h-9 w-full items-center justify-between gap-2 rounded-sm px-2 text-left text-xs",
                        w.id === selected ? "bg-amaranth text-fg" : "text-silver hover:bg-raised hover:text-fg",
                      )}
                    >
                      <span className="truncate">{wallCaption(w, walls)}</span>
                      <span className="shrink-0 font-mono tabular-nums text-muted">{formatDim(lengthIn(w), unit)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={undo}
              disabled={!canUndo}
              className="min-h-11 flex-1 rounded-full border border-line text-sm text-silver hover:text-fg disabled:opacity-30"
            >
              Undo
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={!canRedo}
              className="min-h-11 flex-1 rounded-full border border-line text-sm text-silver hover:text-fg disabled:opacity-30"
            >
              Redo
            </button>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={loadSample}
              className="min-h-11 flex-1 rounded-full border border-line text-sm text-silver hover:text-fg"
            >
              Sample
            </button>
            <button
              type="button"
              onClick={exportPng}
              className="min-h-11 flex-1 rounded-full border border-line text-sm text-silver hover:text-fg"
            >
              PNG
            </button>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={exportJson}
              className="min-h-11 flex-1 rounded-full border border-line text-sm text-silver hover:text-fg"
            >
              JSON
            </button>
            <button
              type="button"
              onClick={importJson}
              className="min-h-11 flex-1 rounded-full border border-line text-sm text-silver hover:text-fg"
            >
              Open
            </button>
          </div>
          <button
            type="button"
            onClick={clear}
            className="min-h-11 rounded-full border border-line text-sm text-muted hover:text-accent"
          >
            Reset plan
          </button>
        </aside>
      </div>
    </main>
  );
}
