export type Plan = number[][]; // [ay][kişi] = defter indeksi (0 tabanlı)

export type RotRules = {
  n: number;
  m: number;
  g: number;
  pairLimit: number;
  groups?: number[]; // defter -> grup (K5)
  forbidden?: [number, number][]; // [kişi, defter]
  special?: number[]; // K6: haftalık özel defterler
  specialGap?: number; // en az ay farkı (1 = peş peşe yasak)
};

export type Validation = {
  monthlyOk: boolean;
  monthlyErrors: string[];
  k1: { person: number; notebook: number; months: [number, number] }[];
  pairCounts: number[][];
  maxPair: number;
  pairOver: { from: number; to: number; count: number }[];
  counts: number[][]; // kişi × defter
  k3: { person: number; notebook: number; count: number }[]; // alt/üst sınır dışı
  k5: { person: number; quarter: number; group: number; count: number }[];
  forbiddenHits: { person: number; notebook: number; month: number }[];
  k6: { person: number; months: [number, number]; notebooks: [number, number] }[]; // peş peşe özel defter
  specialCounts: number[]; // kişi başına özel defter sayısı
  ok: boolean; // zorunlu kurallar: aylık + K1 + K2 + K3 (+yasak)
};

export function validatePlan(plan: Plan, rules: RotRules): Validation {
  const { n, m, g, pairLimit } = rules;
  const monthlyErrors: string[] = [];
  const counts = Array.from({ length: n }, () => Array(n).fill(0));
  const pairCounts = Array.from({ length: n }, () => Array(n).fill(0));
  const k1: Validation["k1"] = [];
  const last = Array.from({ length: n }, () => Array(n).fill(-999));
  const forbiddenHits: Validation["forbiddenHits"] = [];
  const fset = new Set((rules.forbidden ?? []).map(([p, d]) => `${p}|${d}`));
  const spSet = new Set(rules.special ?? []);
  const spGap = rules.specialGap ?? 1;
  const k6: Validation["k6"] = [];
  const specialCounts: number[] = Array(n).fill(0);
  const lastSp: { t: number; d: number }[] = Array.from({ length: n }, () => ({ t: -999, d: -1 }));

  if (plan.length !== m) monthlyErrors.push(`Plan ${plan.length} ay içeriyor, ${m} bekleniyordu.`);
  for (let t = 0; t < plan.length; t++) {
    const row = plan[t];
    const seen = new Set<number>();
    for (let p = 0; p < n; p++) {
      const d = row?.[p];
      if (d === undefined || d < 0 || d >= n) {
        monthlyErrors.push(`Ay ${t + 1}, kişi ${p + 1}: geçersiz defter.`);
        continue;
      }
      if (seen.has(d)) monthlyErrors.push(`Ay ${t + 1}: defter ${d + 1} birden fazla kişide.`);
      seen.add(d);
      counts[p][d]++;
      if (t - last[p][d] <= g) k1.push({ person: p, notebook: d, months: [last[p][d], t] });
      last[p][d] = t;
      if (spSet.has(d)) {
        specialCounts[p]++;
        if (t - lastSp[p].t <= spGap) k6.push({ person: p, months: [lastSp[p].t, t], notebooks: [lastSp[p].d, d] });
        lastSp[p] = { t, d };
      }
      if (fset.has(`${p}|${d}`)) forbiddenHits.push({ person: p, notebook: d, month: t });
      if (t > 0) {
        const a = plan[t - 1].findIndex((x) => x === d);
        if (a >= 0 && a !== p) pairCounts[a][p]++;
      }
    }
    if (seen.size !== n && !monthlyErrors.some((e) => e.startsWith(`Ay ${t + 1}`))) monthlyErrors.push(`Ay ${t + 1}: eşleştirme tam değil.`);
  }

  const lo = Math.floor(m / n);
  const hi = Math.ceil(m / n);
  const k3: Validation["k3"] = [];
  for (let p = 0; p < n; p++)
    for (let d = 0; d < n; d++) {
      if (fset.has(`${p}|${d}`)) continue;
      if (counts[p][d] < lo || counts[p][d] > hi) k3.push({ person: p, notebook: d, count: counts[p][d] });
    }
  const pairOver: Validation["pairOver"] = [];
  let maxPair = 0;
  for (let a = 0; a < n; a++)
    for (let b = 0; b < n; b++) {
      maxPair = Math.max(maxPair, pairCounts[a][b]);
      if (pairCounts[a][b] > pairLimit) pairOver.push({ from: a, to: b, count: pairCounts[a][b] });
    }

  const k5: Validation["k5"] = [];
  if (rules.groups && rules.groups.some((x) => x >= 0)) {
    for (let p = 0; p < n; p++)
      for (let q = 0; q * 3 < plan.length; q++) {
        const c = new Map<number, number>();
        for (let t = q * 3; t < Math.min(plan.length, q * 3 + 3); t++) {
          const gr = rules.groups[plan[t][p]];
          if (gr >= 0) c.set(gr, (c.get(gr) ?? 0) + 1);
        }
        for (const [gr, cnt] of c) if (cnt > 1) k5.push({ person: p, quarter: q + 1, group: gr, count: cnt });
      }
  }

  return {
    monthlyOk: monthlyErrors.length === 0,
    monthlyErrors, k1, k6, specialCounts, pairCounts, maxPair, pairOver, counts, k3, k5, forbiddenHits,
    ok: monthlyErrors.length === 0 && k1.length === 0 && pairOver.length === 0 && k3.length === 0 && forbiddenHits.length === 0 && k6.length === 0,
  };
}
