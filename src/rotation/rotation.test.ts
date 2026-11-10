import { describe, expect, it } from "vitest";
import { calcMath, specialWarnings } from "./math";
import { generatePlans, type RotParams } from "./engine";
import { validatePlan } from "./validator";

const P = (n: number, o: Partial<RotParams> = {}): RotParams => ({
  n, m: 12, g: 2, pairLimit: calcMath(n, 12, 2).pairLower, forbidden: [], fixed: [], seed: 7, ...o,
});

describe("matematik", () => {
  it("N=9, M=12", () => {
    const x = calcMath(9, 12, 2);
    expect([x.lo, x.hi, x.r, x.perPersonLo, x.perPersonHi, x.totalTransfers, x.orderedPairs, x.pairLower]).toEqual([1, 2, 3, 6, 3, 99, 72, 2]);
  });
  it("çift sınırı tablosu", () => {
    expect([4, 6, 8, 12, 13].map((n) => calcMath(n, 12, 2).pairLower)).toEqual([4, 3, 2, 1, 1]);
  });
  it("N=13: alt 0 üst 1, N=3 uyarısı, N<G+1 imkânsız", () => {
    const a = calcMath(13, 12, 2);
    expect([a.lo, a.hi]).toEqual([0, 1]);
    expect(calcMath(3, 12, 2).warnings.length).toBeGreaterThan(0);
    expect(calcMath(2, 12, 2).feasible).toBe(false);
  });
});

describe("doğrulayıcı", () => {
  it("bozulmuş planı yakalar", async () => {
    const r = await generatePlans(P(8), { timeMs: 3000, want: 1 });
    expect(r.candidates.length).toBe(1);
    const plan = r.candidates[0].plan.map((x) => [...x]);
    const rules = { n: 8, m: 12, g: 2, pairLimit: r.usedPairLimit };
    expect(validatePlan(plan, rules).ok).toBe(true);
    [plan[5][0], plan[5][1]] = [plan[5][1], plan[5][0]]; // takas
    const bad = validatePlan(plan, rules);
    expect(bad.ok).toBe(false);
    const dup = plan.map((x) => [...x]); dup[3][2] = dup[3][3];
    expect(validatePlan(dup, rules).monthlyOk).toBe(false);
  });
});

describe("motor: N için zorunlu kurallar", () => {
  for (const n of [5, 6, 7, 8, 9, 10, 12, 13, 15]) {
    it(`N=${n}: K1, K2, K3 sağlanır (gerekirse gevşetilmiş sınırla)`, async () => {
      const r = await generatePlans(P(n), { timeMs: 6000, want: 1 });
      expect(r.candidates.length, r.error).toBe(1);
      const v = validatePlan(r.candidates[0].plan, { n, m: 12, g: 2, pairLimit: r.usedPairLimit });
      expect(v.monthlyErrors).toEqual([]);
      expect(v.k1).toEqual([]);
      expect(v.k3).toEqual([]);
      expect(v.pairOver).toEqual([]);
    }, 15000);
  }
  it("aynı tohum aynı planı verir", async () => {
    const a = await generatePlans(P(9, { seed: 3 }), { timeMs: 3000, want: 1 });
    const b = await generatePlans(P(9, { seed: 3 }), { timeMs: 3000, want: 1 });
    expect(a.candidates[0].plan).toEqual(b.candidates[0].plan);
  }, 15000);
  it("yasak çift ve sabit atama uygulanır", async () => {
    const r = await generatePlans(P(9, { forbidden: [[0, 0]], fixed: [{ month: 0, person: 1, notebook: 4 }] }), { timeMs: 4000, want: 1 });
    expect(r.candidates[0].plan[0][4]).toBe(1); // ay 1, defter 5 → kişi 2
    expect(r.candidates[0].plan.every((row) => row[0] !== 0)).toBe(true); // defter 1 hiçbir ayda kişi 1'de değil
  }, 15000);
});

describe("K6: haftalık özel defterler (1, 3, 6)", () => {
  const SP = { special: [0, 2, 5], specialGap: 1 };
  it("N=9: özel defterler aynı kişide peş peşe gelmez", async () => {
    const r = await generatePlans(P(9, SP), { timeMs: 6000, want: 1 });
    expect(r.candidates.length, r.error).toBe(1);
    const v = validatePlan(r.candidates[0].plan, { n: 9, m: 12, g: 2, pairLimit: r.usedPairLimit, ...SP });
    expect(v.k6).toEqual([]);
    expect(v.ok).toBe(true);
    expect(v.specialCounts.reduce((a, b) => a + b, 0)).toBe(36);
  }, 15000);
  it("doğrulayıcı peş peşe özel defteri yakalar", () => {
    // plan[ay][defter] = kişi. Kişi 0: ay1 defter1 (özel), ay2 defter3 (özel)
    const plan = [[0, 1, 2, 3], [1, 2, 0, 3]];
    const v = validatePlan(plan, { n: 4, m: 2, g: 0, pairLimit: 9, special: [0, 2], specialGap: 1 });
    expect(v.k6).toHaveLength(1);
    expect(v.k6[0].person).toBe(0);
  });
  it("özel defter sayısı N/2'yi aşarsa uyarı (imkânsız)", () => {
    expect(specialWarnings(4, 3, 1)[0].tone).toBe("error");
    expect(specialWarnings(9, 3, 1)).toEqual([]);
  });
  it("N=6, 3 özel defter: bulunur ve K6 sağlanır", async () => {
    const r = await generatePlans(P(6, SP), { timeMs: 6000, want: 1 });
    expect(r.candidates.length, r.error).toBe(1);
    expect(validatePlan(r.candidates[0].plan, { n: 6, m: 12, g: 2, pairLimit: r.usedPairLimit, ...SP }).k6).toEqual([]);
  }, 15000);
});

describe("özel defter dengesi", () => {
  it("N=9: kişi başına özel defter sayısı birbirine yakın", async () => {
    const SP = { special: [0, 2, 5], specialGap: 1 };
    let best = 99;
    for (const seed of [1, 2, 3]) {
      const r = await generatePlans(P(9, { ...SP, seed }), { timeMs: 4000, want: 3 });
      const v = validatePlan(r.candidates[0].plan, { n: 9, m: 12, g: 2, pairLimit: r.usedPairLimit, ...SP });
      expect(v.ok).toBe(true);
      best = Math.min(best, Math.max(...v.specialCounts) - Math.min(...v.specialCounts));
    }
    expect(best).toBeLessThanOrEqual(2);
  }, 30000);
});


describe("izinli personel + esas dağıtım sayısı", () => {
  const leaveAbsent = (n: number, m: number, cells: [number, number][]) =>
    Array.from({ length: m }, (_, t) => Array.from({ length: n }, (_, p) => cells.some(([a, b]) => a === t && b === p)));

  it("N=9: bir kişi 2 ay izinli, ek atama: izinli aya defter verilmez, her müsait kişi ≥1, hedefler tutar", async () => {
    const absent = leaveAbsent(9, 12, [[2, 0], [3, 0]]);
    const r = await generatePlans(P(9, { absent, strategy: "ek" }), { timeMs: 8000, want: 1 });
    expect(r.candidates.length, r.error).toBe(1);
    const plan = r.candidates[0].plan;
    for (const t of [2, 3]) expect(plan[t].includes(0)).toBe(false);
    const v = validatePlan(plan, { n: 9, m: 12, g: 2, pairLimit: r.usedPairLimit, absent, strategy: "ek" });
    expect(v.monthlyErrors).toEqual([]);
    expect(v.k3).toEqual([]);
    expect(v.k1).toEqual([]);
    expect(v.actualD).toBe(108);
    expect(v.targets.D).toBe(108);
    expect(v.counts[0].reduce((a, b) => a + b, 0)).toBeLessThan(v.counts[1].reduce((a, b) => a + b, 0)); // izinli kişi daha az defter
  }, 20000);

  it("boş bırak stratejisi: D = müsait kişi-ay toplamı, açıkta kalan defter sayısı doğru", async () => {
    const absent = leaveAbsent(9, 12, [[2, 0], [3, 0], [3, 1], [7, 4]]);
    const r = await generatePlans(P(9, { absent, strategy: "bos" }), { timeMs: 8000, want: 1 });
    expect(r.candidates.length, r.error).toBe(1);
    const v = validatePlan(r.candidates[0].plan, { n: 9, m: 12, g: 2, pairLimit: r.usedPairLimit, absent, strategy: "bos" });
    expect(v.monthlyErrors).toEqual([]);
    expect(v.k3).toEqual([]);
    expect(v.targets.D).toBe(108 - 4);
    expect(v.actualD).toBe(104);
    expect(v.openCount).toBe(4);
  }, 20000);

  it("yetersiz müsaitlikte (ek atama üst sınırı) açıklayıcı hata verir", async () => {
    const absent = leaveAbsent(9, 12, [[1, 0], [1, 1], [1, 2], [1, 3], [1, 4]]);
    const r = await generatePlans(P(9, { absent }), { timeMs: 1000, want: 1 });
    expect(r.candidates.length).toBe(0);
    expect(r.error).toMatch(/Ay 2/);
  });

  it("doğrulayıcı izinli kişiye verilen defteri yakalar", async () => {
    const absent = leaveAbsent(9, 12, [[2, 0]]);
    const r = await generatePlans(P(9), { timeMs: 3000, want: 1 }); // izin bilinmeden üretildi
    const v = validatePlan(r.candidates[0].plan, { n: 9, m: 12, g: 2, pairLimit: r.usedPairLimit, absent });
    expect(v.monthlyOk).toBe(false);
    expect(v.monthlyErrors.join(" ")).toMatch(/izinli/);
  }, 15000);
});
