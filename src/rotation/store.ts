"use client";
import { create } from "zustand";
import type { Candidate, GenResult } from "./engine";
import type { Plan } from "./validator";

export type Person = { id: string; name: string };
export type Notebook = { no: number; name: string; weight: number; group: number }; // group -1 = yok
export type Fixed = { month: number; person: number; notebook: number };

type S = {
  step: number;
  maxStep: number;
  n: number;
  people: Person[];
  notebooks: Notebook[];
  year: number;
  startMonth: number; // 1-12
  m: number;
  g: number;
  pairOverride: number | null; // null = otomatik
  useGroups: boolean;
  forbidden: [number, number][];
  fixed: Fixed[];
  seed: number;
  timeMs: number;
  result: GenResult | null;
  picked: number;
  plan: Plan | null; // seçilen ve elle düzenlenebilen plan
  swaps: { month: number; a: number; b: number; ts: string }[];
  approved: boolean;
  log: { ts: string; msg: string }[];

  go: (n: number) => void;
  setN: (n: number) => void;
  patch: (p: Partial<S>) => void;
  setPerson: (i: number, p: Partial<Person>) => void;
  setNotebook: (i: number, p: Partial<Notebook>) => void;
  setResult: (r: GenResult | null) => void;
  pick: (i: number) => void;
  setPlan: (p: Plan) => void;
  addLog: (msg: string) => void;
  reset: () => void;
};

const mk = (n: number, old: Person[] = [], oldNb: Notebook[] = []) => ({
  people: Array.from({ length: n }, (_, i) => old[i] ?? { id: `P-${String(i + 1).padStart(2, "0")}`, name: `Personel ${i + 1}` }),
  notebooks: Array.from({ length: n }, (_, i) => oldNb[i] ?? { no: i + 1, name: `Defter ${i + 1}`, weight: 1, group: -1 }),
});

const init = () => ({
  step: 0, maxStep: 0, n: 9, ...mk(9),
  year: new Date().getFullYear() + 1, startMonth: 1, m: 12, g: 2, pairOverride: null as number | null,
  useGroups: false, forbidden: [] as [number, number][], fixed: [] as Fixed[],
  seed: 1, timeMs: 4000, result: null as GenResult | null, picked: 0, plan: null as Plan | null,
  swaps: [] as S["swaps"], approved: false, log: [] as S["log"],
});

export const useRot = create<S>((set, get) => ({
  ...init(),
  go: (n) => set((s) => ({ step: n, maxStep: Math.max(s.maxStep, n) })),
  setN: (n) =>
    set((s) => ({
      n, ...mk(n, s.people, s.notebooks),
      forbidden: s.forbidden.filter(([p, d]) => p < n && d < n),
      fixed: s.fixed.filter((f) => f.person < n && f.notebook < n),
      result: null, plan: null, approved: false,
    })),
  patch: (p) => set({ ...p, result: null, plan: null, approved: false } as Partial<S>),
  setPerson: (i, p) => set((s) => ({ people: s.people.map((x, k) => (k === i ? { ...x, ...p } : x)) })),
  setNotebook: (i, p) => set((s) => ({ notebooks: s.notebooks.map((x, k) => (k === i ? { ...x, ...p } : x)), result: null, plan: null, approved: false })),
  setResult: (r) => set({ result: r, picked: 0, plan: r?.candidates[0]?.plan.map((x) => [...x]) ?? null, swaps: [], approved: false }),
  pick: (i) => set((s) => ({ picked: i, plan: s.result?.candidates[i]?.plan.map((x) => [...x]) ?? null, swaps: [], approved: false })),
  setPlan: (plan) => set({ plan, approved: false }),
  addLog: (msg) => set((s) => ({ log: [...s.log, { ts: new Date().toISOString(), msg }] })),
  reset: () => set({ ...init() }),
}));

export const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
export const monthLabel = (startMonth: number, t: number, year: number) => {
  const idx = startMonth - 1 + t;
  return { ay: MONTHS[idx % 12], yil: year + Math.floor(idx / 12), no: (idx % 12) + 1 };
};
export type { Candidate };
