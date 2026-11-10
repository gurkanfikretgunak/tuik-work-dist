import { describe, expect, it } from "vitest";
import { calcMath } from "./math";
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
    expect(r.candidates[0].plan[0][1]).toBe(4);
    expect(r.candidates[0].plan.every((row) => row[0] !== 0)).toBe(true);
  }, 15000);
});
