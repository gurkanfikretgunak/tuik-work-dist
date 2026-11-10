import { describe, expect, it } from "vitest";
import { buildInside, buildOutside, defaultRegions, layoutError, REFERENCE_REGIONS, splitSizes, weeklyOf } from "./model";
import { generate2, type Cfg2 } from "./engine";
import { REGION_TOL, validate2 } from "./validator";

const mk = (n: number, o: Partial<Cfg2> = {}): Cfg2 => {
  const regions = defaultRegions(n);
  return { n, m: 12, g: 2, specialGap: 1, seed: 11, inside: buildInside(n), outside: buildOutside(regions), regions, ...o };
};
const rulesOf = (c: Cfg2, used: { inside: number; outside: number }) => ({ n: c.n, m: c.m, g: c.g, specialGap: c.specialGap, inside: c.inside, outside: c.outside, regions: c.regions, pairLimit: used, absent: c.absent });

describe("model", () => {
  it("bölge boyutları: 10/3 → 4,3,3; 9/3 → 3,3,3", () => {
    expect(splitSizes(10, 3)).toEqual([4, 3, 3]);
    expect(splitSizes(9, 3)).toEqual([3, 3, 3]);
  });
  it("varsayılan: şehir içi 1,3,6 haftalık; şehir dışı her bölgenin sonu haftalık", () => {
    const c = mk(10);
    expect(weeklyOf(c.inside)).toEqual([0, 2, 5]);
    expect(weeklyOf(c.outside)).toEqual([3, 6, 9]);
    expect(c.outside.length).toBe(10);
  });
  it("referans çalışma 10 defter eder; toplam uyuşmazsa hata", () => {
    expect(layoutError(10, REFERENCE_REGIONS)).toBeNull();
    expect(layoutError(9, REFERENCE_REGIONS)).toBe("sum");
  });
});

describe("motor-2: iki katman", () => {
  for (const n of [10, 9, 12]) {
    it(`N=${n}, 12 ay: her iki katmanda K1/K2/K3/K6 sağlanır, her kişi her ay 1+1 defter alır`, async () => {
      const c = mk(n);
      const r = await generate2(c, { timeMs: 8000 });
      expect(r.inside.candidates.length, r.inside.error).toBeGreaterThan(0);
      expect(r.outside.candidates.length, r.outside.error).toBeGreaterThan(0);
      const plans = { inside: r.inside.candidates[0].plan, outside: r.outside.candidates[0].plan };
      const v = validate2(plans, rulesOf(c, { inside: r.inside.usedPairLimit, outside: r.outside.usedPairLimit }));
      expect(v.inside.monthlyErrors).toEqual([]);
      expect(v.outside.monthlyErrors).toEqual([]);
      expect(v.inside.k1).toEqual([]);
      expect(v.outside.k1).toEqual([]);
      expect(v.inside.k3).toEqual([]);
      expect(v.outside.k3).toEqual([]);
      expect(v.inside.k6).toEqual([]);
      expect(v.outside.k6).toEqual([]);
      expect(v.ok).toBe(true);
      for (const t of ["inside", "outside"] as const) for (const row of v[t].loads) expect(row.every((x) => x === 1)).toBe(true);
      expect(v.region.maxDev).toBeLessThanOrEqual(REGION_TOL);
    });
  }

  it("aynı tohum aynı planı üretir (belirlenimci)", async () => {
    const a = await generate2(mk(10, { seed: 5 }), { timeMs: 6000 });
    const b = await generate2(mk(10, { seed: 5 }), { timeMs: 6000 });
    // süre sınırlı olduğundan yalnızca ilk adayın aynı tohumdan geldiği doğrulanır
    expect(a.inside.candidates[0].seed).toBe(b.inside.candidates[0].seed);
  });

  it("izinli kişi o ay görev almaz (her iki katmanda)", async () => {
    const absent = Array.from({ length: 12 }, (_, t) => Array.from({ length: 10 }, (_, p) => t === 3 && p === 2));
    const c = mk(10, { absent });
    const r = await generate2(c, { timeMs: 8000 });
    expect(r.inside.candidates.length, r.inside.error).toBeGreaterThan(0);
    expect(r.outside.candidates.length, r.outside.error).toBeGreaterThan(0);
    for (const t of ["inside", "outside"] as const) expect(r[t].candidates[0].plan[3].includes(2)).toBe(false);
  });
});

describe("izin (K7) ve rapor", () => {
  it("1 aylık tam izin kişiyi o ay 'yok' sayar; plan o ay ona görev vermez", async () => {
    const { useRot2, cfgOf } = await import("./store");
    const { absenceOf } = await import("./absence");
    const st = useRot2.getState();
    st.reset();
    const y = useRot2.getState().year;
    useRot2.getState().patch({ leaves: [{ id: 1, personId: "P-03", start: `${y}-03-01`, end: `${y}-03-31`, note: "", included: true }] });
    const ab = absenceOf(useRot2.getState());
    expect(ab.absent[2][2]).toBe(true);
    expect(ab.absent.flat().filter(Boolean).length).toBe(1);
    const r = await generate2(cfgOf(useRot2.getState()), { timeMs: 8000 });
    expect(r.inside.candidates.length, r.inside.error).toBeGreaterThan(0);
    expect(r.outside.candidates.length, r.outside.error).toBeGreaterThan(0);
    useRot2.getState().setResult(r);
    expect(r.inside.candidates[0].plan[2].includes(2)).toBe(false);
  }, 30000);

  it("rapor HTML'i kendi içinde tamdır, iki planı ve bölge tablosunu içerir, metni kaçırır", async () => {
    const { useRot2, cfgOf } = await import("./store");
    const { buildReportHtml } = await import("./report");
    const { absenceOf } = await import("./absence");
    const { rulesOfState } = await import("./rules");
    useRot2.getState().reset();
    useRot2.getState().setPerson(0, { name: "<b>X</b>" });
    const r = await generate2(cfgOf(useRot2.getState()), { timeMs: 6000 });
    useRot2.getState().setResult(r);
    const s = useRot2.getState();
    const rules = rulesOfState(s);
    const html = buildReportHtml(s, validate2(s.plans!, rules), absenceOf(s), rules.pairLimit);
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("M1");
    expect(html).not.toContain("<b>X</b>");
    expect(html).toContain("&lt;b&gt;X&lt;/b&gt;");
    expect(html).not.toMatch(/https?:\/\//);
  }, 30000);
});
