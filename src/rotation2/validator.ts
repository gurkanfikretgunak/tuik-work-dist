import { validatePlan, type Plan, type Validation } from "../rotation/validator";
import { weeklyOf, type Notebook, type Region, type Tier } from "./model";

/** Bölge dengesi toleransı: bir kişinin bölge sayısı beklenen (orantılı) değerden en çok bu kadar sapabilir. Yumuşak kuraldır. */
export const REGION_TOL = 1.5;

export type RegionStats = {
  counts: number[][]; // [kişi][bölge]
  expected: number[][]; // [kişi][bölge] defter sayısıyla orantılı hedef
  total: number[]; // kişi başına şehir dışı toplam görev
  maxDev: number;
  sumSq: number;
};

/**
 * Bölge dengesi: kişinin toplam şehir dışı görevi, bölgelerin defter sayısıyla orantılı paylaşılır
 * (ör. 4/3/3 defter → %40/%30/%30). Kesin eşitlik beklenmez; en yakın dağılım ölçülür.
 */
export function regionStats(plan: Plan, outside: Notebook[], regions: Region[], n: number): RegionStats {
  const counts = Array.from({ length: n }, () => Array(regions.length).fill(0));
  for (const row of plan) row.forEach((p, d) => { const r = outside[d]?.region ?? -1; if (p >= 0 && r >= 0) counts[p][r]++; });
  const total = counts.map((r) => r.reduce((a, b) => a + b, 0));
  const all = regions.reduce((s, r) => s + r.size, 0) || 1;
  const expected = total.map((t) => regions.map((r) => (t * r.size) / all));
  let maxDev = 0, sumSq = 0;
  for (let p = 0; p < n; p++)
    for (let r = 0; r < regions.length; r++) {
      const d = Math.abs(counts[p][r] - expected[p][r]);
      maxDev = Math.max(maxDev, d);
      sumSq += d * d;
    }
  return { counts, expected, total, maxDev, sumSq };
}

export type Plans2 = { inside: Plan; outside: Plan };
export type Rules2 = {
  n: number; m: number; g: number; specialGap: number;
  inside: Notebook[]; outside: Notebook[]; regions: Region[];
  pairLimit: { inside: number; outside: number };
  absent?: boolean[][];
};

export type Validation2 = {
  inside: Validation;
  outside: Validation;
  region: RegionStats;
  regionOk: boolean;
  ok: boolean; // zorunlu kurallar (K1, K2, K3, K6, aylık düzen) iki katmanda da sağlanıyor mu
};

export function validate2(plans: Plans2, r: Rules2): Validation2 {
  const one = (tier: Tier) =>
    validatePlan(plans[tier], { n: r.n, m: r.m, g: r.g, pairLimit: r.pairLimit[tier], special: weeklyOf(r[tier]), specialGap: r.specialGap, absent: r.absent, strategy: "ek", forbidden: [] });
  const inside = one("inside"), outside = one("outside");
  const region = regionStats(plans.outside, r.outside, r.regions, r.n);
  return { inside, outside, region, regionOk: region.maxDev <= REGION_TOL, ok: inside.ok && outside.ok };
}
