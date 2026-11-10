import type { Plan } from "./validator";
import { validatePlan } from "./validator";

export type RotParams = {
  n: number;
  m: number;
  g: number;
  pairLimit: number;
  groups?: number[];
  special?: number[]; // haftalık özel defterler (0 tabanlı)
  specialGap?: number; // iki özel defter arası en az ay farkı (1 = peş peşe yasak)
  forbidden: [number, number][];
  fixed: { month: number; person: number; notebook: number }[];
  seed: number;
};

export type Candidate = { plan: Plan; seed: number; maxPair: number; score: number; pairLimitUsed: number };

export type GenResult = {
  candidates: Candidate[];
  usedPairLimit: number;
  relaxed: string[];
  attempts: number;
  error?: string;
};

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tek deneme: ay ay kurar, ay içinde en az seçenekli kişiden geri izlemeli arar. */
function attempt(P: RotParams, pairLimit: number, seed: number, deadline: number, nodeBudget = 4000): Plan | null {
  const { n, m, g } = P;
  const rnd = mulberry32(seed);
  const lo0 = Math.floor(m / n);
  const hi0 = Math.ceil(m / n);
  const fset = new Set(P.forbidden.map(([p, d]) => `${p}|${d}`));
  const LO = (p: number, d: number) => (fset.has(`${p}|${d}`) ? 0 : lo0);
  const HI = (p: number, d: number) => (fset.has(`${p}|${d}`) ? 0 : hi0);

  const cnt = Array.from({ length: n }, () => Array(n).fill(0));
  const last = Array.from({ length: n }, () => Array(n).fill(-999));
  const pair = Array.from({ length: n }, () => Array(n).fill(0));
  const needP = Array(n).fill(0), capP = Array(n).fill(0), needD = Array(n).fill(0), capD = Array(n).fill(0);
  for (let p = 0; p < n; p++)
    for (let d = 0; d < n; d++) {
      needP[p] += LO(p, d); capP[p] += HI(p, d); needD[d] += LO(p, d); capD[d] += HI(p, d);
    }
  const spSet = new Set(P.special ?? []);
  const spGap = P.specialGap ?? 1;
  const lastSp: number[] = Array(n).fill(-999);
  const plan: Plan = [];
  const prevOwner: number[] = Array(n).fill(-1);
  const jit = Array.from({ length: n }, () => Array.from({ length: n }, () => rnd()));

  const apply = (t: number, p: number, d: number, sign: 1 | -1, restoreLast = 0) => {
    const c = cnt[p][d];
    if (sign === 1) {
      if (c < LO(p, d)) { needP[p]--; needD[d]--; }
      capP[p]--; capD[d]--;
      cnt[p][d]++;
      last[p][d] = t;
    } else {
      cnt[p][d]--;
      capP[p]++; capD[d]++;
      if (cnt[p][d] < LO(p, d)) { needP[p]++; needD[d]++; }
      last[p][d] = restoreLast;
    }
  };

  const ok = (t: number, p: number, d: number): boolean => {
    if (fset.has(`${p}|${d}`)) return false;
    if (t - last[p][d] <= g) return false;
    if (spSet.has(d) && t - lastSp[p] <= spGap) return false;
    if (cnt[p][d] >= HI(p, d)) return false;
    if (t > 0) {
      const a = prevOwner[d];
      if (a >= 0 && a !== p && pair[a][p] >= pairLimit) return false;
    }
    // erişilebilirlik (bu atamadan sonra kalan ay R)
    const R = m - t - 1;
    const dn = cnt[p][d] < LO(p, d) ? 1 : 0;
    if (needP[p] - dn > R || capP[p] - 1 < R) return false;
    if (needD[d] - dn > R || capD[d] - 1 < R) return false;
    return true;
  };

  const score = (t: number, p: number, d: number) => {
    let s = cnt[p][d] * 10 + jit[p][d] * 4;
    if (cnt[p][d] < LO(p, d)) s -= 8;
    if (spSet.has(d)) { let c = 0; for (const q of spSet) c += cnt[p][q]; s += c * 6; } // özel defterleri kişiler arasında dengele
    if (t > 0) {
      const a = prevOwner[d];
      if (a >= 0 && a !== p) s += pair[a][p] * 7;
    }
    if (P.groups) {
      const q = Math.floor(t / 3);
      const gr = P.groups[d];
      if (gr >= 0)
        for (let u = q * 3; u < t; u++) if (P.groups[plan[u][p]] === gr) s += 5;
    }
    return s;
  };

  for (let t = 0; t < m; t++) {
    if (Date.now() > deadline) return null;
    const row: number[] = Array(n).fill(-1);
    const usedD = Array(n).fill(false);
    let placed = 0;
    // sabit atamalar
    for (const f of P.fixed) {
      if (f.month !== t) continue;
      if (row[f.person] >= 0 || usedD[f.notebook]) return null;
      row[f.person] = f.notebook; usedD[f.notebook] = true; placed++;
    }
    // sabitler geri alınmayacak şekilde uygula
    const undoLast: Record<string, number> = {};
    for (let p = 0; p < n; p++) if (row[p] >= 0) { undoLast[`${p}|${row[p]}`] = last[p][row[p]]; apply(t, p, row[p], 1); if (spSet.has(row[p])) lastSp[p] = t; }
    let nodes = 0;
    const solve = (): boolean => {
      if (placed === n) return true;
      if (++nodes > nodeBudget) return false;
      let bestP = -1, bestC: number[] = [], bestLen = 1e9;
      for (let p = 0; p < n; p++) {
        if (row[p] >= 0) continue;
        const c: number[] = [];
        for (let d = 0; d < n; d++) if (!usedD[d] && ok(t, p, d)) c.push(d);
        if (c.length < bestLen) { bestLen = c.length; bestP = p; bestC = c; if (c.length === 0) return false; }
      }
      bestC.sort((x, y) => score(t, bestP, x) - score(t, bestP, y));
      for (const d of bestC) {
        const prevLast = last[bestP][d];
        const prevSp = lastSp[bestP];
        row[bestP] = d; usedD[d] = true; placed++;
        apply(t, bestP, d, 1);
        if (spSet.has(d)) lastSp[bestP] = t;
        if (solve()) return true;
        apply(t, bestP, d, -1, prevLast);
        lastSp[bestP] = prevSp;
        row[bestP] = -1; usedD[d] = false; placed--;
        if (nodes > nodeBudget) return false;
      }
      return false;
    };
    if (!solve()) return null;
    plan.push(row);
    if (t > 0) for (let p = 0; p < n; p++) { const a = prevOwner[row[p]]; if (a >= 0 && a !== p) pair[a][p]++; }
    for (let p = 0; p < n; p++) prevOwner[row[p]] = p;
  }
  return plan;
}

function scorePlan(plan: Plan, P: RotParams) {
  const v = validatePlan(plan, { n: P.n, m: P.m, g: P.g, pairLimit: 999, groups: P.groups, forbidden: P.forbidden, special: P.special, specialGap: P.specialGap });
  let sq = 0;
  for (const row of v.pairCounts) for (const c of row) sq += c * c;
  return { maxPair: v.maxPair, score: v.maxPair * 1000 + sq + v.k5.length * 5 };
}

export async function generatePlans(
  P: RotParams,
  opts: { timeMs?: number; want?: number; onProgress?: (p: number, found: number) => void; signal?: { cancelled: boolean } } = {},
): Promise<GenResult> {
  const timeMs = opts.timeMs ?? 4000;
  const want = opts.want ?? 3;
  const start = Date.now();
  const relaxed: string[] = [];
  let attempts = 0;
  let seed = P.seed;
  const levels = [0, 1, 2];
  for (const extra of levels) {
    const pl = P.pairLimit + extra;
    const sliceEnd = start + (timeMs * (extra + 1)) / levels.length;
    const found: Candidate[] = [];
    let lastYield = Date.now();
    while (Date.now() < sliceEnd && found.length < want && !opts.signal?.cancelled) {
      attempts++;
      const plan = attempt(P, pl, seed++, sliceEnd);
      if (plan) {
        const s = scorePlan(plan, P);
        found.push({ plan, seed: seed - 1, maxPair: s.maxPair, score: s.score, pairLimitUsed: pl });
      }
      if (Date.now() - lastYield > 40) {
        opts.onProgress?.(Math.min(1, (Date.now() - start) / timeMs), found.length);
        await new Promise((r) => setTimeout(r, 0));
        lastYield = Date.now();
      }
    }
    if (found.length) {
      if (extra > 0) relaxed.push(`Çift tekrar sınırı ${P.pairLimit} → ${pl} gevşetildi`);
      found.sort((a, b) => a.score - b.score);
      opts.onProgress?.(1, found.length);
      return { candidates: found, usedPairLimit: pl, relaxed, attempts };
    }
  }
  opts.onProgress?.(1, 0);
  return { candidates: [], usedPairLimit: P.pairLimit, relaxed, attempts, error: "Süre içinde zorunlu kuralları sağlayan plan bulunamadı. Süreyi artırın, G değerini düşürün veya kısıtları gevşetin." };
}
