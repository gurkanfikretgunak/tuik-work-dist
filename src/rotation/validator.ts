import { calcTargets, type Strategy, type Targets } from "./math";

/** Plan[ay][defter] = o ay o defteri alan kişi indeksi; -1 = defter açıkta (boş bırakma). */
export type Plan = number[][];

export type RotRules = {
  n: number;
  m: number;
  g: number;
  pairLimit: number;
  groups?: number[]; // defter -> grup (K5)
  forbidden?: [number, number][]; // [kişi, defter]
  special?: number[]; // K6: haftalık özel defterler
  specialGap?: number; // en az ay farkı (1 = peş peşe yasak)
  absent?: boolean[][]; // [ay][kişi] izinli ("yok")
  strategy?: Strategy;
  maxPer?: number; // ek atamada kişi başı aylık en fazla defter
};

export type Validation = {
  monthlyOk: boolean;
  monthlyErrors: string[];
  k1: { person: number; notebook: number; months: [number, number] }[];
  pairCounts: number[][];
  maxPair: number;
  pairOver: { from: number; to: number; count: number }[];
  counts: number[][]; // kişi × defter
  targets: Targets;
  k3: { person: number; notebook: number; count: number }[]; // hedef sınırı dışı
  k5: { person: number; quarter: number; group: number; count: number }[];
  forbiddenHits: { person: number; notebook: number; month: number }[];
  k6: { person: number; months: [number, number]; notebooks: [number, number] }[];
  specialCounts: number[];
  loads: number[][]; // [ay][kişi] o ay aldığı defter sayısı
  openCount: number; // açıkta kalan defter-ay sayısı
  actualD: number; // gerçekleşen toplam dağıtım
  ok: boolean;
};

export function validatePlan(plan: Plan, rules: RotRules): Validation {
  const { n, m, g, pairLimit } = rules;
  const strategy = rules.strategy ?? "ek";
  const maxPer = rules.maxPer ?? 2;
  const absent = rules.absent ?? Array.from({ length: m }, () => Array(n).fill(false));
  const targets = calcTargets(n, m, absent, strategy, maxPer);
  const monthlyErrors: string[] = [];
  const counts = Array.from({ length: n }, () => Array(n).fill(0));
  const pairCounts = Array.from({ length: n }, () => Array(n).fill(0));
  const loads = Array.from({ length: m }, () => Array(n).fill(0));
  const k1: Validation["k1"] = [];
  const k6: Validation["k6"] = [];
  const last = Array.from({ length: n }, () => Array(n).fill(-999));
  const lastSp: { t: number; d: number }[] = Array.from({ length: n }, () => ({ t: -999, d: -1 }));
  const specialCounts: number[] = Array(n).fill(0);
  const forbiddenHits: Validation["forbiddenHits"] = [];
  const fset = new Set((rules.forbidden ?? []).map(([p, d]) => `${p}|${d}`));
  const spSet = new Set(rules.special ?? []);
  const spGap = rules.specialGap ?? 1;
  let openCount = 0;
  let actualD = 0;

  if (plan.length !== m) monthlyErrors.push(`Plan ${plan.length} ay içeriyor, ${m} bekleniyordu.`);
  for (let t = 0; t < plan.length; t++) {
    const row = plan[t] ?? [];
    const k = targets.k[t] ?? n;
    const cap = strategy === "ek" ? Math.ceil(n / Math.max(1, k)) : 1;
    let open = 0;
    for (let d = 0; d < n; d++) {
      const p = row[d];
      if (p === undefined || p < -1 || p >= n) { monthlyErrors.push(`Ay ${t + 1}, defter ${d + 1}: geçersiz kişi.`); continue; }
      if (p === -1) {
        open++;
        openCount++;
        if (strategy === "ek" && k > 0) monthlyErrors.push(`Ay ${t + 1}: defter ${d + 1} sahipsiz.`);
        continue;
      }
      if (absent[t]?.[p]) monthlyErrors.push(`Ay ${t + 1}: izinli kişiye (${p + 1}) defter ${d + 1} verilmiş.`);
      loads[t][p]++;
      actualD++;
      counts[p][d]++;
      if (t - last[p][d] <= g) k1.push({ person: p, notebook: d, months: [last[p][d], t] });
      last[p][d] = t;
      if (fset.has(`${p}|${d}`)) forbiddenHits.push({ person: p, notebook: d, month: t });
      if (spSet.has(d)) {
        specialCounts[p]++;
        if (t - lastSp[p].t <= spGap) k6.push({ person: p, months: [lastSp[p].t, t], notebooks: [lastSp[p].d, d] });
        lastSp[p] = { t, d };
      }
      if (t > 0) {
        const a = plan[t - 1]?.[d];
        if (a !== undefined && a >= 0 && a !== p) pairCounts[a][p]++;
      }
    }
    if (strategy === "bos" && k > 0 && open !== n - Math.min(k, n)) monthlyErrors.push(`Ay ${t + 1}: ${open} defter açıkta, ${n - Math.min(k, n)} bekleniyordu.`);
    for (let p = 0; p < n; p++) {
      if (absent[t]?.[p]) continue;
      if (loads[t][p] > cap) monthlyErrors.push(`Ay ${t + 1}: kişi ${p + 1} ${loads[t][p]} defter almış (en fazla ${cap}).`);
      if (k > 0 && loads[t][p] === 0) monthlyErrors.push(`Ay ${t + 1}: müsait kişi ${p + 1} defter almamış.`);
    }
  }

  const k3: Validation["k3"] = [];
  for (let p = 0; p < n; p++)
    for (let d = 0; d < n; d++) {
      if (fset.has(`${p}|${d}`)) continue;
      if (counts[p][d] < targets.lo[p][d] || counts[p][d] > targets.hi[p][d]) k3.push({ person: p, notebook: d, count: counts[p][d] });
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
        for (let t = q * 3; t < Math.min(plan.length, q * 3 + 3); t++)
          for (let d = 0; d < n; d++) if (plan[t][d] === p) { const gr = rules.groups[d]; if (gr >= 0) c.set(gr, (c.get(gr) ?? 0) + 1); }
        for (const [gr, cnt] of c) if (cnt > 1) k5.push({ person: p, quarter: q + 1, group: gr, count: cnt });
      }
  }

  return {
    monthlyOk: monthlyErrors.length === 0, monthlyErrors, k1, k6, specialCounts, pairCounts, maxPair, pairOver,
    counts, targets, k3, k5, forbiddenHits, loads, openCount, actualD,
    ok: monthlyErrors.length === 0 && k1.length === 0 && pairOver.length === 0 && k3.length === 0 && forbiddenHits.length === 0 && k6.length === 0,
  };
}
