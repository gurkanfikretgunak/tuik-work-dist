import { tx } from "@/i18n";

export type RotMath = {
  n: number;
  m: number;
  g: number;
  lo: number;
  hi: number;
  r: number; // M mod N
  perPersonLo: number; // kişi başına alt kez alınan defter sayısı
  perPersonHi: number; // kişi başına üst kez alınan defter sayısı
  totalTransfers: number;
  orderedPairs: number;
  pairLower: number;
  warnings: { tone: "warn" | "error" | "info"; text: string }[];
  feasible: boolean;
};

/** K6 uygulanabilirliği: özel defter sayısı s için, peş peşe yasağında s ≤ N − s gerekir (özel olmayan defter sayısı en az özel kadar). */
export function specialWarnings(n: number, special: number, gap: number): { tone: "warn" | "error"; text: string }[] {
  if (special <= 0) return [];
  const out: { tone: "warn" | "error"; text: string }[] = [];
  if (gap >= 1 && special > n - special)
    out.push({ tone: "error", text: tx("v2core.math.k6impossible", { s: special, ns: n - special }) });
  else if (gap >= 1 && special * (gap + 1) > n) out.push({ tone: "warn", text: tx("v2core.math.k6tight", { s: special, g: gap, n }) });
  return out;
}

export function calcMath(n: number, m: number, g: number): RotMath {
  const warnings: RotMath["warnings"] = [];
  let feasible = true;
  const lo = n > 0 ? Math.floor(m / n) : 0;
  const hi = n > 0 ? Math.ceil(m / n) : 0;
  const r = n > 0 ? m % n : 0;
  const pairLower = n > 1 ? Math.ceil((m - 1) / (n - 1)) : 0;
  if (n < 2) {
    feasible = false;
    warnings.push({ tone: "error", text: tx("v2core.math.min2") });
  }
  if (n >= 2 && n < g + 1) {
    feasible = false;
    warnings.push({ tone: "error", text: tx("v2core.math.k1fit", { w: g + 1 }) });
  }
  if (n === 3 && g >= 2) warnings.push({ tone: "warn", text: tx("v2core.math.n3g2") });
  if (n > 0 && n < 4) warnings.push({ tone: "warn", text: tx("v2core.math.nLt4") });
  if (n > 30) warnings.push({ tone: "warn", text: tx("v2core.math.nGt30") });
  if (n > m) warnings.push({ tone: "info", text: tx("v2core.math.nGtM", { m, x: n - m }) });
  if (r === 0 && n > 0 && n <= m) warnings.push({ tone: "info", text: tx("v2core.math.divisible") });
  if (n >= 2 && n <= 5 && n <= m) warnings.push({ tone: "warn", text: tx("v2core.math.fewPeople", { p: pairLower }) });
  return {
    n, m, g, lo, hi, r,
    perPersonLo: n - r, perPersonHi: r,
    totalTransfers: (m - 1) * n,
    orderedPairs: n * (n - 1),
    pairLower, warnings, feasible,
  };
}

export type Strategy = "ek" | "bos"; // açıkta kalan defter: başkasına ek atama | boş bırak

export type Targets = {
  D: number; // esas dağıtım sayısı: planda fiilen yapılacak toplam defter–kişi ataması
  a: number[]; // kişi başına müsait ay
  A: number; // toplam müsait kişi-ay
  k: number[]; // ay başına müsait kişi
  Dp: number[]; // kişi başına hedef pay
  e: number[][]; // kişi × defter beklenen sayı
  lo: number[][];
  hi: number[][];
  badMonths: number[]; // ek atama kişi başı üst sınırı aşan aylar
  maxPer: number;
};

/**
 * Eşitlik hedefleri esas dağıtım sayısı D'den türetilir:
 *   D = Σ_ay (dağıtılan defter sayısı)
 *   D_p = D · a_p / Σa,   e_pd = D_p / N   (defterler eşit paylaşılır)
 * İzin yokken D = N·M ve e = M/N (mevcut K3 ile aynı).
 */
export function calcTargets(n: number, m: number, absent?: boolean[][], strategy: Strategy = "ek", maxPer = 2): Targets {
  const ab = absent ?? Array.from({ length: m }, () => Array(n).fill(false));
  const k = ab.map((row) => row.filter((x) => !x).length);
  const a = Array.from({ length: n }, (_, p) => ab.reduce((s, row) => s + (row[p] ? 0 : 1), 0));
  const A = a.reduce((x, y) => x + y, 0);
  let D = 0;
  const badMonths: number[] = [];
  k.forEach((kt, t) => {
    if (kt === 0) return;
    D += strategy === "ek" ? n : Math.min(kt, n);
    if (strategy === "ek" && Math.ceil(n / kt) > maxPer) badMonths.push(t);
  });
  const Dp = a.map((x) => (A ? (D * x) / A : 0));
  const e = Dp.map((d) => Array(n).fill(d / n));
  const eps = 1e-9;
  const lo = e.map((r) => r.map((v) => Math.floor(v + eps)));
  const hi = e.map((r) => r.map((v) => Math.ceil(v - eps)));
  return { D, a, A, k, Dp, e, lo, hi, badMonths, maxPer };
}
