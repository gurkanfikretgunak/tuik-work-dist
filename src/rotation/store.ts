"use client";
import { create } from "zustand";
import { LANGS, monthName, tx, useLangStore } from "@/i18n";
import type { Candidate, GenResult } from "./engine";
import type { Plan } from "./validator";
import type { Leave } from "./leave";
import type { Strategy } from "./math";

export type Person = { id: string; name: string };
export type Notebook = { no: number; name: string; weight: number; group: number; special: boolean }; // group -1 = yok
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
  specialGap: number; // K6: özel defterler arası en az ay farkı (1 = peş peşe yasak)
  leaves: Leave[];
  leaveThreshold: number; // ay içi izin oranı bu eşiğe ulaşırsa kişi o ay "yok" sayılır
  strategy: Strategy; // açıkta kalan defter: ek atama | boş bırak
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
  people: Array.from({ length: n }, (_, i) => old[i] ?? { id: `P-${String(i + 1).padStart(2, "0")}`, name: tx("def.person", { n: i + 1 }) }),
  notebooks: Array.from({ length: n }, (_, i) => oldNb[i] ?? { no: i + 1, name: tx("def.notebook", { n: i + 1 }), weight: 1, group: -1, special: [1, 3, 6].includes(i + 1) }),
});

const init = () => ({
  step: 0, maxStep: 0, n: 9, ...mk(9),
  year: new Date().getFullYear() + 1, startMonth: 1, m: 12, g: 2, specialGap: 1, leaves: [] as Leave[], leaveThreshold: 0.5, strategy: "ek" as Strategy, pairOverride: null as number | null,
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

export const monthLabel = (startMonth: number, t: number, year: number) => {
  const idx = startMonth - 1 + t;
  return { ay: monthName(idx % 12), yil: year + Math.floor(idx / 12), no: (idx % 12) + 1 };
};
export type { Candidate };

// Dil değişince hâlâ varsayılan adı taşıyan personel/defter adlarını yeni dile çevir (kullanıcının düzenlediği adlara dokunma).
useLangStore.subscribe((st, prev) => {
  if (st.lang === prev.lang) return;
  const isDef = (name: string, key: string, n: number) => LANGS.some((l) => tx(key, { n }, l) === name);
  useRot.setState((s) => ({
    people: s.people.map((p, i) => (isDef(p.name, "def.person", i + 1) ? { ...p, name: tx("def.person", { n: i + 1 }, st.lang) } : p)),
    notebooks: s.notebooks.map((d, i) => (isDef(d.name, "def.notebook", i + 1) ? { ...d, name: tx("def.notebook", { n: i + 1 }, st.lang) } : d)),
  }));
});
