"use client";
import { create } from "zustand";
import type { Leave } from "../rotation/leave";
import { absenceOf } from "./absence";
import { buildInside, buildOutside, defaultRegions, layoutError, makePeople, REFERENCE_REGIONS, type Notebook, type Person, type Region } from "./model";
import type { Cfg2, Result2 } from "./engine";
import type { Plans2 } from "./validator";

type S = {
  step: number;
  maxStep: number;
  n: number; // değişkendir: varsayılan 10
  m: number;
  year: number;
  startMonth: number;
  g: number;
  specialGap: number;
  seed: number;
  timeMs: number;
  people: Person[];
  regions: Region[];
  inside: Notebook[];
  outside: Notebook[];
  result: Result2 | null;
  picked: { inside: number; outside: number };
  plans: Plans2 | null;
  leaves: Leave[];
  leaveThreshold: number; // ay içi izin oranı bu eşiğe ulaşırsa kişi o ay "yok" sayılır
  swaps: { tier: "inside" | "outside"; month: number; a: number; b: number; ts: string }[];
  approved: boolean;
  log: { ts: string; msg: string }[];

  go: (n: number) => void;
  patch: (p: Partial<S>) => void;
  setN: (n: number) => void;
  setRegion: (i: number, p: Partial<Region>) => void;
  addRegion: () => void;
  removeRegion: (i: number) => void;
  setNotebook: (tier: "inside" | "outside", i: number, p: Partial<Notebook>) => void;
  setPerson: (i: number, p: Partial<Person>) => void;
  loadReference: () => void;
  setResult: (r: Result2 | null) => void;
  setPlans: (p: Plans2) => void;
  addSwap: (w: { tier: "inside" | "outside"; month: number; a: number; b: number }) => void;
  pick: (tier: "inside" | "outside", i: number) => void;
  addLog: (msg: string) => void;
  reset: () => void;
};

const DEFAULT_N = 10;
const stale = { result: null, plans: null, swaps: [] as S["swaps"], approved: false, picked: { inside: 0, outside: 0 } };

const init = () => {
  const regions = defaultRegions(DEFAULT_N);
  return {
    step: 0, maxStep: 0, n: DEFAULT_N, m: 12, year: new Date().getFullYear() + 1, startMonth: 1, g: 2, specialGap: 1, seed: 1, timeMs: 6000,
    people: makePeople(DEFAULT_N), regions, inside: buildInside(DEFAULT_N), outside: buildOutside(regions),
    result: null as Result2 | null, picked: { inside: 0, outside: 0 }, plans: null as Plans2 | null, leaves: [] as Leave[], leaveThreshold: 0.5, swaps: [] as S["swaps"], approved: false, log: [] as S["log"],
  };
};

const rebuildOutside = (regions: Region[], n: number, old: Notebook[]): Notebook[] => {
  if (layoutError(n, regions)) return old;
  const fresh = buildOutside(regions);
  // kullanıcının değiştirdiği kod/haftalık işaretini aynı konumda koru
  return fresh.map((d, i) => (old[i] && old[i].region === d.region ? { ...d, code: old[i].code, weekly: old[i].weekly } : d));
};

export const useRot2 = create<S>((set) => ({
  ...init(),
  go: (n) => set((s) => ({ step: n, maxStep: Math.max(s.maxStep, n) })),
  patch: (p) => set({ ...p, ...stale } as Partial<S>),
  setN: (n) =>
    set((s) => {
      const regions = defaultRegions(n, s.regions.length || 3);
      return { n, people: makePeople(n, s.people), regions, inside: buildInside(n), outside: buildOutside(regions), ...stale };
    }),
  setRegion: (i, p) =>
    set((s) => {
      const regions = s.regions.map((r, k) => (k === i ? { ...r, ...p } : r));
      const outside = layoutError(s.n, regions) ? s.outside : p.code !== undefined ? buildOutside(regions) : rebuildOutside(regions, s.n, s.outside);
      return { regions, outside, ...stale };
    }),
  addRegion: () =>
    set((s) => {
      const regions = [...s.regions, { code: "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[s.regions.length] ?? `R${s.regions.length + 1}`, name: "", size: 1 }];
      return { regions, outside: layoutError(s.n, regions) ? s.outside : buildOutside(regions), ...stale };
    }),
  removeRegion: (i) =>
    set((s) => {
      const regions = s.regions.filter((_, k) => k !== i);
      return { regions, outside: layoutError(s.n, regions) ? s.outside : buildOutside(regions), ...stale };
    }),
  setNotebook: (tier, i, p) => set((s) => ({ [tier]: s[tier].map((d, k) => (k === i ? { ...d, ...p } : d)), ...stale }) as Partial<S>),
  setPerson: (i, p) => set((s) => ({ people: s.people.map((x, k) => (k === i ? { ...x, ...p } : x)) })),
  loadReference: () =>
    set(() => {
      const regions = REFERENCE_REGIONS.map((r) => ({ ...r }));
      return { n: 10, people: makePeople(10), regions, inside: buildInside(10), outside: buildOutside(regions), ...stale };
    }),
  setResult: (r) => set({ result: r, picked: { inside: 0, outside: 0 }, plans: r && r.inside.candidates[0] && r.outside.candidates[0] ? { inside: r.inside.candidates[0].plan.map((x) => [...x]), outside: r.outside.candidates[0].plan.map((x) => [...x]) } : null, swaps: [], approved: false }),
  pick: (tier, i) =>
    set((s) => {
      const c = s.result?.[tier].candidates[i];
      if (!c || !s.plans) return {};
      return { picked: { ...s.picked, [tier]: i }, plans: { ...s.plans, [tier]: c.plan.map((x) => [...x]) }, swaps: s.swaps.filter((w) => w.tier !== tier), approved: false };
    }),
  setPlans: (plans) => set({ plans, approved: false }),
  addSwap: (w) => set((s) => ({ swaps: [...s.swaps, { ...w, ts: new Date().toISOString() }] })),
  addLog: (msg) => set((s) => ({ log: [...s.log, { ts: new Date().toISOString(), msg }] })),
  reset: () => set({ ...init() }),
}));

export const cfgOf = (s: ReturnType<typeof useRot2.getState>): Cfg2 => ({
  n: s.n, m: s.m, g: s.g, specialGap: s.specialGap, seed: s.seed, inside: s.inside, outside: s.outside, regions: s.regions, absent: absenceOf(s).absent,
});
