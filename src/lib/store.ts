"use client";
import { create } from "zustand";
import { tx } from "@/i18n";
import {
  DEFAULT_RULESET,
  type Assignment,
  type EmpRow,
  type Employee,
  type EventLog,
  type EventType,
  type FileInfo,
  type JobRow,
  type RuleSet,
} from "./types";

export type DistResult = {
  assignments: Assignment[];
  durationMs: number;
  runCount: number;
  at: string;
  unitLabel: string;
};

export type SavedSet = { employees: EmpRow[]; rules: RuleSet; savedAt: string };

type State = {
  step: number;
  maxStep: number;
  employees: EmpRow[];
  empFile: FileInfo | null;
  empConfirmed: boolean;
  rules: RuleSet;
  rulesConfirmed: boolean;
  jobs: JobRow[];
  jobFile: FileInfo | null;
  jobsConfirmed: boolean;
  result: DistResult | null;
  approved: boolean;
  events: EventLog[];
  runCount: number;
  nextId: number;

  go: (n: number) => void;
  log: (type: EventType, message: string, data?: Record<string, unknown>) => void;
  setEmployees: (rows: EmpRow[], file: FileInfo) => void;
  patchEmployees: (fn: (rows: EmpRow[]) => EmpRow[]) => void;
  setEmpConfirmed: (b: boolean) => void;
  setRules: (r: RuleSet) => void;
  setRulesConfirmed: (b: boolean) => void;
  setJobs: (rows: JobRow[], file: FileInfo) => void;
  patchJobs: (fn: (rows: JobRow[]) => JobRow[]) => void;
  setJobsConfirmed: (b: boolean) => void;
  setResult: (r: DistResult | null) => void;
  patchAssignments: (fn: (a: Assignment[]) => Assignment[]) => void;
  setApproved: (b: boolean) => void;
  reset: () => void;
  loadSaved: (s: SavedSet) => void;
};

const fresh = () => ({
  step: 0,
  maxStep: 0,
  employees: [] as EmpRow[],
  empFile: null,
  empConfirmed: false,
  rules: structuredClone(DEFAULT_RULESET),
  rulesConfirmed: false,
  jobs: [] as JobRow[],
  jobFile: null,
  jobsConfirmed: false,
  result: null as DistResult | null,
  approved: false,
  events: [] as EventLog[],
  runCount: 0,
  nextId: 1,
});

export const useStore = create<State>((set, get) => ({
  ...fresh(),
  go: (n) => set((s) => ({ step: n, maxStep: Math.max(s.maxStep, n) })),
  log: (type, message, data) =>
    set((s) => ({
      events: [...s.events, { id: s.nextId, ts: new Date().toISOString(), type, message, data }],
      nextId: s.nextId + 1,
    })),
  setEmployees: (rows, file) => set({ employees: rows, empFile: file, empConfirmed: false, result: null, approved: false }),
  patchEmployees: (fn) => set((s) => ({ employees: fn(s.employees), empConfirmed: false, result: null, approved: false })),
  setEmpConfirmed: (b) => set({ empConfirmed: b }),
  setRules: (r) => set({ rules: r, rulesConfirmed: false, result: null, approved: false }),
  setRulesConfirmed: (b) => set({ rulesConfirmed: b }),
  setJobs: (rows, file) => set({ jobs: rows, jobFile: file, jobsConfirmed: false, result: null, approved: false }),
  patchJobs: (fn) => set((s) => ({ jobs: fn(s.jobs), jobsConfirmed: false, result: null, approved: false })),
  setJobsConfirmed: (b) => set({ jobsConfirmed: b }),
  setResult: (r) => set({ result: r, approved: false }),
  patchAssignments: (fn) =>
    set((s) => (s.result ? { result: { ...s.result, assignments: fn(s.result.assignments) } } : {})),
  setApproved: (b) => set({ approved: b }),
  reset: () => {
    set({ ...fresh() });
    get().log("oturum", tx("v1core.store.reset"));
  },
  loadSaved: (sv) =>
    set({ ...fresh(), employees: sv.employees, rules: sv.rules, empFile: { name: tx("v1core.store.savedSet"), total: sv.employees.length, errorRows: 0, at: new Date().toISOString() } }),
}));

/** Seçili (onay kutusu işaretli) ve geçerli satırlar */
export const activeEmployees = (rows: EmpRow[]): Employee[] =>
  rows.filter((r) => r.included && r.errors.length === 0).map((r) => r.data);
export const activeJobs = (rows: JobRow[]) => rows.filter((r) => r.included && r.errors.length === 0).map((r) => r.data);

const KEY = "tuik-dagitim-seti-v1";
export function saveSet(s: SavedSet) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {}
}
export function readSet(): SavedSet | null {
  try {
    const t = localStorage.getItem(KEY);
    return t ? (JSON.parse(t) as SavedSet) : null;
  } catch {
    return null;
  }
}
