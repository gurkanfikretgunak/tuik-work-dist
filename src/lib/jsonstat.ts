// JSON-stat 2.0 (TÜİK Veri Portalı yanıtı) ayrıştırıcı ve dönüştürücüler. Saf fonksiyonlar, tarayıcı ve sunucuda çalışır.
import Papa from "papaparse";

export type JsDim = { id: string; label: string; codes: string[]; labels: Record<string, string> };
export type JsData = {
  label: string;
  dims: JsDim[];
  size: number[];
  values: Map<number, number | null>; // düz indeks → değer (seyrek)
  total: number; // hücre sayısı
  timeDim?: string;
  geoDim?: string;
};

type Raw = {
  id?: string[];
  size?: number[];
  value?: Record<string, unknown> | unknown[];
  dimension?: Record<string, { label?: string; category?: { index?: string[] | Record<string, number>; label?: Record<string, string> } }>;
  role?: { time?: string[]; geo?: string[] };
  label?: string;
};

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

export function parseJsonStat(raw: unknown): JsData {
  const r = raw as Raw;
  if (!r || !Array.isArray(r.id) || !Array.isArray(r.size) || r.id.length !== r.size.length || !r.dimension) throw new Error("not_jsonstat");
  const dims: JsDim[] = r.id.map((id) => {
    const d = r.dimension![id];
    const idx = d?.category?.index;
    const codes = Array.isArray(idx) ? idx : idx ? Object.entries(idx).sort((a, b) => a[1] - b[1]).map(([k]) => k) : [];
    return { id, label: d?.label ?? id, codes, labels: d?.category?.label ?? {} };
  });
  const total = r.size.reduce((a, b) => a * b, 1);
  const values = new Map<number, number | null>();
  const v = r.value;
  if (Array.isArray(v)) v.forEach((x, i) => values.set(i, num(x)));
  else if (v) for (const [k, x] of Object.entries(v)) values.set(Number(k), num(x));
  return { label: r.label ?? "", dims, size: r.size, values, total, timeDim: r.role?.time?.[0], geoDim: r.role?.geo?.[0] };
}

const strides = (size: number[]) => size.map((_, i) => size.slice(i + 1).reduce((a, b) => a * b, 1));
export const labelOf = (d: JsDim, code: string) => d.labels[code] ?? code;

/** Birden fazla kategorisi olan boyutlar */
export const varyingDims = (js: JsData) => js.dims.filter((d) => d.codes.length > 1);

export function valueAt(js: JsData, idx: number[]): number | null {
  const st = strides(js.size);
  let flat = 0;
  for (let i = 0; i < idx.length; i++) flat += idx[i] * st[i];
  return js.values.get(flat) ?? null;
}

export type Row = { codes: string[]; labels: string[]; value: number | null };

/** Uzun biçim: her gözlem bir satır. Boş (null) gözlemler isteğe bağlı atlanır. */
export function toRows(js: JsData, opts: { skipEmpty?: boolean; limit?: number } = {}): Row[] {
  const out: Row[] = [];
  const st = strides(js.size);
  const keys = [...js.values.keys()].sort((a, b) => a - b);
  const iter = opts.skipEmpty === false ? Array.from({ length: js.total }, (_, i) => i) : keys;
  for (const flat of iter) {
    const v = js.values.get(flat) ?? null;
    if (opts.skipEmpty !== false && v === null) continue;
    const codes: string[] = [], labels: string[] = [];
    let rest = flat;
    for (let i = 0; i < js.dims.length; i++) {
      const k = Math.floor(rest / st[i]);
      rest -= k * st[i];
      const code = js.dims[i].codes[k];
      codes.push(code);
      labels.push(labelOf(js.dims[i], code));
    }
    out.push({ codes, labels, value: v });
    if (opts.limit && out.length >= opts.limit) break;
  }
  return out;
}

/** Çapraz tablo: satır ve sütun boyutları seçilir; diğer çok değerli boyutlar `slice` ile tek değere sabitlenir. */
export function pivot(js: JsData, rowDim: string, colDim: string, slice: Record<string, string>) {
  const ri = js.dims.findIndex((d) => d.id === rowDim), ci = js.dims.findIndex((d) => d.id === colDim);
  if (ri < 0 || ci < 0 || ri === ci) throw new Error("bad_dims");
  const fixed = js.dims.map((d, i) => (i === ri || i === ci ? -1 : Math.max(0, d.codes.indexOf(slice[d.id] ?? d.codes[0]))));
  const rows = js.dims[ri].codes, cols = js.dims[ci].codes;
  const cells = rows.map((_, r) => cols.map((_, c) => {
    const idx = fixed.slice();
    idx[ri] = r; idx[ci] = c;
    return valueAt(js, idx);
  }));
  return { rows, cols, cells };
}

/** Grafik verisi: x ekseni boyutu, isteğe bağlı seri boyutu; kalanlar `slice` ile sabit. */
export function series(js: JsData, xDim: string, seriesDim: string | null, slice: Record<string, string>, maxSeries = 12) {
  const xi = js.dims.findIndex((d) => d.id === xDim);
  const si = seriesDim ? js.dims.findIndex((d) => d.id === seriesDim) : -1;
  if (xi < 0) throw new Error("bad_dims");
  const fixed = js.dims.map((d, i) => (i === xi || i === si ? -1 : Math.max(0, d.codes.indexOf(slice[d.id] ?? d.codes[0]))));
  const sCodes = si >= 0 ? js.dims[si].codes.slice(0, maxSeries) : ["__v"];
  const data = js.dims[xi].codes.map((xc, x) => {
    const row: Record<string, string | number | null> = { x: labelOf(js.dims[xi], xc) };
    sCodes.forEach((sc, s) => {
      const idx = fixed.slice();
      idx[xi] = x;
      if (si >= 0) idx[si] = s;
      row[sc] = valueAt(js, idx);
    });
    return row;
  });
  return { data, keys: sCodes.map((c) => ({ key: c, label: si >= 0 ? labelOf(js.dims[si], c) : js.label })) };
}

/** CSV (UTF-8 BOM): her boyut için kod ve etiket sütunu + değer. */
export function toCsv(js: JsData): string {
  const fields = [...js.dims.flatMap((d) => [d.id, `${d.id}_label`]), "VALUE"];
  const data = toRows(js).map((r) => [...r.codes.flatMap((c, i) => [c, r.labels[i]]), r.value ?? ""]);
  return "﻿" + Papa.unparse({ fields, data });
}
