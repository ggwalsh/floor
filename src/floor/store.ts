import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  SAMPLE_OPENINGS,
  SAMPLE_PIECES,
  SAMPLE_ROOMS,
  SAMPLE_WALLS,
  snap,
  uid,
  type Opening,
  type Piece,
  type PlanData,
  type RoomLabel,
  type Tool,
  type WallSeg,
} from "./plan";

type Snapshot = {
  walls: WallSeg[];
  openings: Opening[];
  pieces: Piece[];
  rooms: RoomLabel[];
};

type Store = {
  walls: WallSeg[];
  openings: Opening[];
  pieces: Piece[];
  rooms: RoomLabel[];
  tool: Tool;
  catalogId: string;
  roomName: string;
  selected: string | null;
  past: Snapshot[];
  future: Snapshot[];
  setTool: (t: Tool) => void;
  setCatalogId: (id: string) => void;
  setRoomName: (name: string) => void;
  select: (id: string | null) => void;
  addWall: (w: WallSeg) => void;
  addOpening: (o: Opening) => void;
  addPiece: (p: Piece) => void;
  addRoom: (r: RoomLabel) => void;
  movePiece: (id: string, x: number, y: number) => void;
  moveRoom: (id: string, x: number, y: number) => void;
  updatePiece: (id: string, patch: Partial<Piece>) => void;
  updateOpening: (id: string, patch: Partial<Opening>) => void;
  updateRoom: (id: string, patch: Partial<RoomLabel>) => void;
  nudge: (id: string, dx: number, dy: number) => void;
  duplicate: (id: string) => void;
  remove: (id: string) => void;
  loadSample: () => void;
  loadPlan: (plan: PlanData) => void;
  clear: () => void;
  checkpoint: () => void;
  undo: () => void;
  redo: () => void;
};

function cloneSnap(s: Snapshot): Snapshot {
  return structuredClone(s);
}

function snapOf(s: Pick<Store, "walls" | "openings" | "pieces" | "rooms">): Snapshot {
  return cloneSnap({ walls: s.walls, openings: s.openings, pieces: s.pieces, rooms: s.rooms });
}

const empty: Snapshot = { walls: [], openings: [], pieces: [], rooms: [] };

export const useFloor = create<Store>()(
  persist(
    (set) => ({
      walls: SAMPLE_WALLS,
      openings: SAMPLE_OPENINGS,
      pieces: SAMPLE_PIECES,
      rooms: SAMPLE_ROOMS,
      tool: null,
      catalogId: "queen",
      roomName: "Bedroom",
      selected: null,
      past: [],
      future: [],
      setTool: (tool) => set({ tool }),
      setCatalogId: (catalogId) => set({ catalogId, tool: "furniture" }),
      setRoomName: (roomName) => set({ roomName, tool: "room" }),
      select: (selected) => set({ selected }),
      addWall: (w) =>
        set((s) => ({
          past: [...s.past, snapOf(s)].slice(-50),
          future: [],
          walls: [...s.walls, w],
          selected: w.id,
        })),
      addOpening: (o) =>
        set((s) => ({
          past: [...s.past, snapOf(s)].slice(-50),
          future: [],
          openings: [...s.openings, o],
          selected: o.id,
        })),
      addPiece: (p) =>
        set((s) => ({
          past: [...s.past, snapOf(s)].slice(-50),
          future: [],
          pieces: [...s.pieces, p],
          selected: p.id,
        })),
      addRoom: (r) =>
        set((s) => ({
          past: [...s.past, snapOf(s)].slice(-50),
          future: [],
          rooms: [...s.rooms, r],
          selected: r.id,
        })),
      movePiece: (id, x, y) =>
        set((s) => ({
          pieces: s.pieces.map((p) => (p.id === id ? { ...p, x, y } : p)),
        })),
      moveRoom: (id, x, y) =>
        set((s) => ({
          rooms: s.rooms.map((r) => (r.id === id ? { ...r, x, y } : r)),
        })),
      updatePiece: (id, patch) =>
        set((s) => ({
          past: [...s.past, snapOf(s)].slice(-50),
          future: [],
          pieces: s.pieces.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        })),
      updateOpening: (id, patch) =>
        set((s) => ({
          past: [...s.past, snapOf(s)].slice(-50),
          future: [],
          openings: s.openings.map((o) => (o.id === id ? { ...o, ...patch } : o)),
        })),
      updateRoom: (id, patch) =>
        set((s) => ({
          past: [...s.past, snapOf(s)].slice(-50),
          future: [],
          rooms: s.rooms.map((r) => (r.id === id ? { ...r, ...patch } : r)),
        })),
      nudge: (id, dx, dy) =>
        set((s) => ({
          past: [...s.past, snapOf(s)].slice(-50),
          future: [],
          pieces: s.pieces.map((p) => (p.id === id ? { ...p, x: snap(p.x + dx), y: snap(p.y + dy) } : p)),
          rooms: s.rooms.map((r) => (r.id === id ? { ...r, x: snap(r.x + dx), y: snap(r.y + dy) } : r)),
        })),
      duplicate: (id) =>
        set((s) => {
          const p = s.pieces.find((x) => x.id === id);
          if (!p) return s;
          const copy = { ...p, id: uid(), x: p.x + 12, y: p.y + 12 };
          return {
            past: [...s.past, snapOf(s)].slice(-50),
            future: [],
            pieces: [...s.pieces, copy],
            selected: copy.id,
          };
        }),
      remove: (id) =>
        set((s) => ({
          past: [...s.past, snapOf(s)].slice(-50),
          future: [],
          walls: s.walls.filter((w) => w.id !== id),
          openings: s.openings.filter((o) => o.id !== id && o.wallId !== id),
          pieces: s.pieces.filter((p) => p.id !== id),
          rooms: s.rooms.filter((r) => r.id !== id),
          selected: s.selected === id ? null : s.selected,
        })),
      loadSample: () =>
        set((s) => ({
          past: [...s.past, snapOf(s)].slice(-50),
          future: [],
          walls: structuredClone(SAMPLE_WALLS),
          openings: structuredClone(SAMPLE_OPENINGS),
          pieces: structuredClone(SAMPLE_PIECES),
          rooms: structuredClone(SAMPLE_ROOMS),
          selected: null,
        })),
      loadPlan: (plan) =>
        set((s) => ({
          past: [...s.past, snapOf(s)].slice(-50),
          future: [],
          walls: structuredClone(plan.walls),
          openings: structuredClone(plan.openings),
          pieces: structuredClone(plan.pieces),
          rooms: structuredClone(plan.rooms),
          selected: null,
        })),
      clear: () =>
        set((s) => ({
          past: [...s.past, snapOf(s)].slice(-50),
          future: [],
          ...cloneSnap(empty),
          selected: null,
        })),
      checkpoint: () =>
        set((s) => ({
          past: [...s.past, snapOf(s)].slice(-50),
          future: [],
        })),
      undo: () =>
        set((s) => {
          if (!s.past.length) return s;
          const prev = s.past[s.past.length - 1];
          return {
            past: s.past.slice(0, -1),
            future: [...s.future, snapOf(s)],
            walls: prev.walls,
            openings: prev.openings,
            pieces: prev.pieces,
            rooms: prev.rooms,
            selected: null,
          };
        }),
      redo: () =>
        set((s) => {
          if (!s.future.length) return s;
          const next = s.future[s.future.length - 1];
          return {
            past: [...s.past, snapOf(s)],
            future: s.future.slice(0, -1),
            walls: next.walls,
            openings: next.openings,
            pieces: next.pieces,
            rooms: next.rooms,
            selected: null,
          };
        }),
    }),
    {
      name: "gw-floor",
      version: 2,
      migrate: (persisted) => {
        const p = (persisted ?? {}) as Partial<Store>;
        return { ...p, rooms: p.rooms ?? [] } as Store;
      },
      partialize: (s) => ({
        walls: s.walls,
        openings: s.openings,
        pieces: s.pieces,
        rooms: s.rooms,
      }),
    },
  ),
);
