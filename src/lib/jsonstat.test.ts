import { describe, expect, it } from "vitest";
import { parseJsonStat, pivot, series, toCsv, toRows, valueAt, varyingDims } from "./jsonstat";
import { sanitizeCriteria, validDatasetId } from "./tuikProxy";

// TÜİK yanıtından kısaltılmış gerçek biçim: [REF_AREA=1, FREQ=1, BUYUKLUK=2, ZAMAN=3]
const raw = {
  id: ["REF_AREA", "FREQ", "BUYUKLUK", "TIME"], size: [1, 1, 2, 3], role: { time: ["TIME"], geo: ["REF_AREA"] },
  value: { "0": "10.5", "1": "13,8", "2": "13", "3": "", "4": "11.6", "5": "13.7" },
  dimension: {
    REF_AREA: { label: "Reference area", category: { index: ["TR"], label: { TR: "Türkiye" } } },
    FREQ: { label: "Frequency", category: { index: ["A"], label: { A: "Annual" } } },
    BUYUKLUK: { label: "Size", category: { index: ["_T", "10T49"], label: { _T: "Total", "10T49": "10-49" } } },
    TIME: { label: "Time", category: { index: ["2020", "2022", "2024"], label: { "2020": "2020", "2022": "2022", "2024": "2024" } } },
  },
  label: "Örnek",
};

describe("JSON-stat", () => {
  const js = parseJsonStat(raw);
  it("boyutlar, değerler ve sayı dönüşümü", () => {
    expect(js.total).toBe(6);
    expect(js.timeDim).toBe("TIME");
    expect(varyingDims(js).map((d) => d.id)).toEqual(["BUYUKLUK", "TIME"]);
    expect(valueAt(js, [0, 0, 0, 1])).toBe(13.8); // virgüllü ondalık
    expect(valueAt(js, [0, 0, 1, 0])).toBeNull(); // boş gözlem
    expect(valueAt(js, [0, 0, 1, 2])).toBe(13.7);
  });
  it("uzun biçim etiketlerle, boşlar atlanır", () => {
    const rows = toRows(js);
    expect(rows).toHaveLength(5);
    expect(rows[0].labels).toEqual(["Türkiye", "Annual", "Total", "2020"]);
    expect(toRows(js, { skipEmpty: false })).toHaveLength(6);
  });
  it("çapraz tablo ve seri", () => {
    const p = pivot(js, "BUYUKLUK", "TIME", {});
    expect(p.rows).toEqual(["_T", "10T49"]);
    expect(p.cells[0]).toEqual([10.5, 13.8, 13]);
    expect(p.cells[1]).toEqual([null, 11.6, 13.7]);
    const s = series(js, "TIME", "BUYUKLUK", {});
    expect(s.keys.map((k) => k.label)).toEqual(["Total", "10-49"]);
    expect(s.data[2]).toEqual({ x: "2024", _T: 13, "10T49": 13.7 });
  });
  it("CSV başlığı ve satırları", () => {
    const lines = toCsv(js).replace("﻿", "").trim().split(/\r?\n/);
    expect(lines[0]).toBe("REF_AREA,REF_AREA_label,FREQ,FREQ_label,BUYUKLUK,BUYUKLUK_label,TIME,TIME_label,VALUE");
    expect(lines).toHaveLength(6);
  });
  it("geçersiz girdi", () => {
    expect(() => parseJsonStat({})).toThrow();
  });
});

describe("proxy doğrulama", () => {
  it("veri seti kimliği allowlist", () => {
    expect(validDatasetId("TR,DF_BILISIM_UZMAN,1.0")).toBe(true);
    expect(validDatasetId("../../etc/passwd")).toBe(false);
    expect(validDatasetId("a/b")).toBe(false);
    expect(validDatasetId("")).toBe(false);
    expect(validDatasetId("x".repeat(200))).toBe(false);
  });
  it("filtre doğrulama", () => {
    expect(sanitizeCriteria([{ id: "REF_AREA", filterValues: ["TR"], type: "X" }])).toEqual([{ id: "REF_AREA", filterValues: ["TR"], type: "CodeValues" }]);
    expect(sanitizeCriteria([])).toEqual([]);
    expect(sanitizeCriteria({})).toBeNull();
    expect(sanitizeCriteria([{ id: "a b", filterValues: ["TR"] }])).toBeNull();
    expect(sanitizeCriteria([{ id: "A", filterValues: ["<script>"] }])).toBeNull();
    expect(sanitizeCriteria([{ id: "A", filterValues: [] }])).toBeNull();
  });
});

import { buildFromLive, searchCatalog, topCategories } from "./tuikCatalog";
describe("katalog", () => {
  const live = {
    categoryGroups: [{ categories: [{ label: "Education", datasetIdentifiers: ["A"], childrenCategories: [{ label: "Spend", datasetIdentifiers: ["B"], childrenCategories: [] }] }, { label: "Energy", datasetIdentifiers: ["C"] }] }],
    datasetMap: { A: { title: "Students" }, B: { title: "Education expenditure", description: "per student" }, C: { title: "Energy use" } },
  };
  it("canlı katalogdan düz liste ve kategori yolu", () => {
    const c = buildFromLive(live, new Date("2026-01-01"));
    expect(c.count).toBe(3);
    expect(c.datasets.find((d) => d.id === "B")?.path).toEqual(["Education", "Spend"]);
    expect(topCategories(c.datasets)).toEqual([["Education", 2], ["Energy", 1]]);
  });
  it("arama ve kategori süzgeci", () => {
    const { datasets } = buildFromLive(live);
    expect(searchCatalog(datasets, "student", null, "en").map((d) => d.id).sort()).toEqual(["A", "B"]);
    expect(searchCatalog(datasets, "education spend", "Education", "en").map((d) => d.id)).toEqual(["B"]);
    expect(searchCatalog(datasets, "", "Energy", "en")).toHaveLength(1);
    expect(() => buildFromLive({})).toThrow();
  });
});
