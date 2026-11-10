"use client";
import { create } from "zustand";
import { parseJsonStat, type JsData } from "@/lib/jsonstat";
import { buildFromLive, type CatalogData, type CatalogItem } from "@/lib/tuikCatalog";

export type View = "table" | "pivot" | "chart";
export type Filters = Record<string, string[] | null>;

type Struct = { dims: { id: string; label: string }[]; defaults: Filters; titleTr?: string; timeDim?: string };

type S = {
  step: number;
  maxStep: number;
  catalog: CatalogData | null;
  catalogStatus: "idle" | "loading" | "ready" | "error";
  query: string;
  top: string | null;
  page: number;
  selected: CatalogItem | null;
  status: "idle" | "loading" | "ready" | "error";
  error: string;
  struct: Struct | null;
  filters: Filters;
  js: JsData | null;
  raw: string;
  view: View;
  token: number;

  go: (n: number) => void;
  setQuery: (q: string) => void;
  setTop: (t: string | null) => void;
  setPage: (p: number) => void;
  setView: (v: View) => void;
  loadCatalog: (live?: boolean) => Promise<void>;
  openDataset: (item: CatalogItem) => Promise<void>;
  applyFilters: (f: Filters) => Promise<void>;
  reset: () => void;
};

async function getJson(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  if (!res.ok) {
    let code = `http_${res.status}`;
    try { code = (await res.json()).error ?? code; } catch {}
    throw new Error(code);
  }
  return res;
}

const criteriaOf = (f: Filters) => Object.entries(f).filter(([, v]) => v && v.length).map(([id, filterValues]) => ({ id, filterValues, type: "CodeValues" }));

export const useOpen = create<S>((set, get) => ({
  step: 0, maxStep: 0, catalog: null, catalogStatus: "idle", query: "", top: null, page: 0,
  selected: null, status: "idle", error: "", struct: null, filters: {}, js: null, raw: "", view: "table", token: 0,

  go: (n) => set((s) => ({ step: n, maxStep: Math.max(s.maxStep, n) })),
  setQuery: (query) => set({ query, page: 0 }),
  setTop: (top) => set({ top, page: 0 }),
  setPage: (page) => set({ page }),
  setView: (view) => set({ view }),

  loadCatalog: async (live = false) => {
    set({ catalogStatus: "loading" });
    try {
      if (live) {
        const raw = await (await getJson("/api/tuik/catalog")).json();
        set({ catalog: buildFromLive(raw), catalogStatus: "ready" });
      } else {
        const data = (await (await getJson("/tuik/catalog.json")).json()) as CatalogData;
        set({ catalog: data, catalogStatus: "ready" });
      }
    } catch {
      set({ catalogStatus: get().catalog ? "ready" : "error" });
      if (live) throw new Error("live_failed");
    }
  },

  openDataset: async (item) => {
    const token = get().token + 1;
    set({ selected: item, status: "loading", error: "", js: null, raw: "", struct: null, filters: {}, view: "table", token, step: 1, maxStep: Math.max(get().maxStep, 1) });
    try {
      const sres = await (await getJson(`/api/tuik/structure?id=${encodeURIComponent(item.id)}`)).json();
      const defaults: Filters = {};
      for (const c of sres?.template?.criteria ?? []) if (c?.type === "CodeValues" && Array.isArray(c.filterValues) && c.filterValues.length) defaults[c.id] = c.filterValues;
      const struct: Struct = {
        dims: (sres?.criteria ?? []).map((c: { id: string; label: string }) => ({ id: c.id, label: c.label })),
        defaults, titleTr: sres?.template?.title?.tr, timeDim: sres?.timeDimension,
      };
      if (get().token !== token) return;
      set({ struct });
      await fetchData(token, item.id, defaults, true);
    } catch (e) {
      if (get().token === token) set({ status: "error", error: (e as Error).message });
    }
  },

  applyFilters: async (f) => {
    const { selected, token } = get();
    if (!selected) return;
    set({ status: "loading", error: "" });
    try { await fetchData(token, selected.id, f, false); } catch (e) { if (get().token === token) set({ status: "error", error: (e as Error).message }); }
  },

  reset: () => set({ step: 0, maxStep: 0, selected: null, status: "idle", js: null, raw: "", struct: null, filters: {}, token: get().token + 1 }),
}));

async function fetchData(token: number, id: string, filters: Filters, allowFallback: boolean) {
  const res = await getJson(`/api/tuik/data?id=${encodeURIComponent(id)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(criteriaOf(filters)) });
  const text = await res.text();
  const js = parseJsonStat(JSON.parse(text));
  if (useOpen.getState().token !== token) return;
  if (js.total === 0 && allowFallback && criteriaOf(filters).length) return fetchData(token, id, {}, false); // varsayılan filtre boş döndüyse hepsini getir
  useOpen.setState({ js, raw: text, filters, status: "ready", error: "" });
}
