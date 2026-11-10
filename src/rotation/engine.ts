import { tx } from "@/i18n";
import { calcTargets, type Strategy } from "./math";
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
  absent?: boolean[][]; // [ay][kişi] izinli
  strategy?: Strategy;
  maxPer?: number;
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

/**
 * Tek deneme: ay ay kurar. Her ay, en az seçenekli DEFTERDEN başlayarak sahibini arar (sudoku sezgiseli).
 * İzinli kişiler o ay aday olmaz. Ek atama stratejisinde müsait kişi sayısı defterden azsa
 * kişi başı en fazla maxPer defter verilir; boş bırakmada fazla defter "açıkta" kalır.
 */
function attempt(P: RotParams, pairLimit: number, seed: number, deadline: number, nodeBudget = 4000): Plan | null {
  const { n, m, g } = P;
  const strategy = P.strategy ?? "ek";
  const maxPer = P.maxPer ?? 2;
  const absent = P.absent ?? Array.from({ length: m }, () => Array(n).fill(false));
  const T = calcTargets(n, m, absent, strategy, maxPer);
  if (T.badMonths.length) return null;
  const rnd = mulberry32(seed);
  const fset = new Set(P.forbidden.map(([p, d]) => `${p}|${d}`));
  const LO = (p: number, d: number) => (fset.has(`${p}|${d}`) ? 0 : T.lo[p][d]);
  const HI = (p: number, d: number) => (fset.has(`${p}|${d}`) ? 0 : T.hi[p][d]);

  const cnt = Array.from({ length: n }, () => Array(n).fill(0));
  const last = Array.from({ length: n }, () => Array(n).fill(-999));
  const pair = Array.from({ length: n }, () => Array(n).fill(0));
  const rowSum = Array(n).fill(0);
  const distributed = Array(n).fill(0);
  const needP = Array(n).fill(0), capP = Array(n).fill(0), needD = Array(n).fill(0), capD = Array(n).fill(0);
  for (let p = 0; p < n; p++)
    for (let d = 0; d < n; d++) { needP[p] += LO(p, d); capP[p] += HI(p, d); needD[d] += LO(p, d); capD[d] += HI(p, d); }

  // kalan müsait ay (t'den sonra) ve defterin dağıtılacağı kalan ay sayısı
  const remP = Array.from({ length: n }, (_, p) => Array.from({ length: m }, (_, t) => { let c = 0; for (let u = t + 1; u < m; u++) if (!absent[u][p]) c++; return c; }));
  const remD = Array.from({ length: m }, (_, t) => { let c = 0; for (let u = t + 1; u < m; u++) if (T.k[u] > 0) c++; return c; });

  const spSet = new Set(P.special ?? []);
  const spGap = P.specialGap ?? 1;
  const lastSp: number[] = Array(n).fill(-999);
  const plan: Plan = [];
  let prevOwner: number[] = Array(n).fill(-1);
  const jit = Array.from({ length: n }, () => Array.from({ length: n }, () => rnd()));
  const OPEN = n; // "açıkta" sanal aktörü

  const apply = (t: number, p: number, d: number, sign: 1 | -1, restoreLast = 0) => {
    if (sign === 1) {
      if (cnt[p][d] < LO(p, d)) { needP[p]--; needD[d]--; }
      capP[p]--; capD[d]--; cnt[p][d]++; rowSum[p]++; distributed[d]++; last[p][d] = t;
    } else {
      cnt[p][d]--; rowSum[p]--; distributed[d]--; capP[p]++; capD[d]++;
      if (cnt[p][d] < LO(p, d)) { needP[p]++; needD[d]++; }
      last[p][d] = restoreLast;
    }
  };

  for (let t = 0; t < m; t++) {
    if (Date.now() > deadline) return null;
    const k = T.k[t];
    if (k === 0) { plan.push(Array(n).fill(-1)); prevOwner = Array(n).fill(-1); continue; }
    const present: number[] = [];
    for (let p = 0; p < n; p++) if (!absent[t][p]) present.push(p);
    const capMonth = strategy === "ek" ? Math.ceil(n / k) : 1;
    const openCap = strategy === "bos" ? n - Math.min(k, n) : 0;
    const load = Array(n).fill(0);
    let openUsed = 0;
    const owner: number[] = Array(n).fill(-2); // -2 atanmamış
    let unassigned = n;

    const ok = (p: number, d: number): boolean => {
      if (load[p] >= capMonth) return false;
      if (fset.has(`${p}|${d}`)) return false;
      if (t - last[p][d] <= g) return false;
      if (spSet.has(d) && t - lastSp[p] <= spGap) return false;
      if (cnt[p][d] >= HI(p, d)) return false;
      const a = prevOwner[d];
      if (a >= 0 && a !== p && pair[a][p] >= pairLimit) return false;
      const dn = cnt[p][d] < LO(p, d) ? 1 : 0;
      const slotsLeft = capMonth - (load[p] + 1) + (strategy === "ek" ? maxPer : 1) * remP[p][t];
      if (needP[p] - dn > slotsLeft || capP[p] - 1 < remP[p][t]) return false;
      if (needD[d] - dn > remD[t]) return false;
      if (strategy === "ek" && capD[d] - 1 < remD[t]) return false;
      return true;
    };
    const okOpen = (d: number): boolean => openUsed < openCap && needD[d] <= remD[t];

    const score = (p: number, d: number) => {
      let s = (cnt[p][d] - T.e[p][d]) * 10 + jit[p][d] * 4;
      s += (rowSum[p] / Math.max(1, T.Dp[p])) * 8;
      if (spSet.has(d)) { let c = 0; for (const q of spSet) c += cnt[p][q]; s += c * 6; }
      if (cnt[p][d] < LO(p, d)) s -= 8;
      const a = prevOwner[d];
      if (a >= 0 && a !== p) s += pair[a][p] * 7;
      if (P.groups) {
        const q = Math.floor(t / 3);
        const gr = P.groups[d];
        if (gr >= 0) for (let u = q * 3; u < t; u++) for (let dd = 0; dd < n; dd++) if (plan[u][dd] === p && P.groups[dd] === gr) s += 5;
      }
      return s;
    };

    // sabit atamalar
    for (const f of P.fixed) {
      if (f.month !== t) continue;
      if (absent[t][f.person] || owner[f.notebook] !== -2) return null;
      owner[f.notebook] = f.person; load[f.person]++; unassigned--;
      apply(t, f.person, f.notebook, 1);
      if (spSet.has(f.notebook)) lastSp[f.person] = t;
    }
    let nodes = 0;
    const solve = (): boolean => {
      if (++nodes > nodeBudget) return false;
      if (strategy === "ek") {
        let zero = 0;
        for (const p of present) if (load[p] === 0) zero++;
        if (zero > unassigned) return false; // her müsait kişi en az 1 defter almalı
      }
      if (unassigned === 0) return true;
      let bestD = -1, bestC: number[] = [], bestLen = 1e9;
      for (let d = 0; d < n; d++) {
        if (owner[d] !== -2) continue;
        const c: number[] = [];
        for (const p of present) if (ok(p, d)) c.push(p);
        if (okOpen(d)) c.push(OPEN);
        if (c.length < bestLen) { bestLen = c.length; bestD = d; bestC = c; if (!c.length) return false; }
      }
      bestC.sort((x, y) => {
        const sx = x === OPEN ? -distributed[bestD] * 10 + jit[0][bestD] : score(x, bestD);
        const sy = y === OPEN ? -distributed[bestD] * 10 + jit[0][bestD] : score(y, bestD);
        return sx - sy;
      });
      for (const p of bestC) {
        const d = bestD;
        if (p === OPEN) {
          owner[d] = -1; openUsed++; unassigned--;
          if (solve()) return true;
          owner[d] = -2; openUsed--; unassigned++;
        } else {
          const prevLast = last[p][d];
          const prevSp = lastSp[p];
          owner[d] = p; load[p]++; unassigned--;
          apply(t, p, d, 1);
          if (spSet.has(d)) lastSp[p] = t;
          if (solve()) return true;
          apply(t, p, d, -1, prevLast);
          lastSp[p] = prevSp;
          owner[d] = -2; load[p]--; unassigned++;
        }
        if (nodes > nodeBudget) return false;
      }
      return false;
    };
    if (!solve()) return null;
    plan.push(owner.slice());
    if (t > 0) for (let d = 0; d < n; d++) { const p = owner[d], a = prevOwner[d]; if (p >= 0 && a >= 0 && a !== p) pair[a][p]++; }
    prevOwner = owner.slice();
  }
  // son kontrol: tüm alt hedefler karşılandı mı
  for (let p = 0; p < n; p++) if (needP[p] > 0) return null;
  for (let d = 0; d < n; d++) if (needD[d] > 0) return null;
  return plan;
}

function scorePlan(plan: Plan, P: RotParams) {
  const v = validatePlan(plan, { n: P.n, m: P.m, g: P.g, pairLimit: 999, groups: P.groups, forbidden: P.forbidden, special: P.special, specialGap: P.specialGap, absent: P.absent, strategy: P.strategy, maxPer: P.maxPer });
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
  const T = calcTargets(P.n, P.m, P.absent, P.strategy ?? "ek", P.maxPer ?? 2);
  if (T.badMonths.length)
    return { candidates: [], usedPairLimit: P.pairLimit, relaxed, attempts: 0, error: tx("v2ui.eng.badMonths", { months: T.badMonths.map((x) => x + 1).join(", "), max: P.maxPer ?? 2 }) };
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
      if (extra > 0) relaxed.push(tx("v2ui.eng.relaxPair", { a: P.pairLimit, b: pl }));
      found.sort((a, b) => a.score - b.score);
      opts.onProgress?.(1, found.length);
      return { candidates: found, usedPairLimit: pl, relaxed, attempts };
    }
  }
  opts.onProgress?.(1, 0);
  return { candidates: [], usedPairLimit: P.pairLimit, relaxed, attempts, error: tx("v2ui.eng.timeout") };
}
