import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LANGS, TABLES } from "./index";

const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
const tags = (s: string) => [...s.matchAll(/<\/?b>/g)].length;

describe("sözlük tutarlılığı", () => {
  it("her dilde tüm anahtarlar var, boş değil, yer tutucular aynı", () => {
    const missing: string[] = [];
    for (const key of Object.keys(TABLES.tr)) {
      for (const l of LANGS) {
        const v = TABLES[l][key];
        if (!v || !v.trim()) { missing.push(`${l}:${key}`); continue; }
        if (ph(v) !== ph(TABLES.tr[key])) missing.push(`${l}:${key} yer tutucu uyuşmuyor (${ph(v)} ≠ ${ph(TABLES.tr[key])})`);
        if (tags(v) !== tags(TABLES.tr[key])) missing.push(`${l}:${key} <b> etiketi uyuşmuyor`);
      }
    }
    expect(missing).toEqual([]);
  });
  it("hiçbir dilde Türkçe'de olmayan fazla anahtar yok", () => {
    const extra: string[] = [];
    for (const l of LANGS) for (const k of Object.keys(TABLES[l])) if (!(k in TABLES.tr)) extra.push(`${l}:${k}`);
    expect(extra).toEqual([]);
  });
  it("kodda kullanılan her sabit anahtar sözlükte var", () => {
    const used = new Map<string, string>();
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (statSync(p).isDirectory()) { if (!p.includes("/i18n/dict")) walk(p); continue; }
        if (!/\.(ts|tsx)$/.test(f) || /\.test\.ts$/.test(f)) continue;
        const src = readFileSync(p, "utf8");
        for (const m of src.matchAll(/\b(?:t|tx|rt|rtx)\(\s*["']([a-zA-Z0-9_.]+)["']/g)) used.set(m[1], p);
      }
    };
    walk(join(process.cwd(), "src"));
    const unknown = [...used].filter(([k]) => !(k in TABLES.tr)).map(([k, f]) => `${k} (${f.replace(process.cwd(), "")})`);
    expect(unknown).toEqual([]);
  });
});
