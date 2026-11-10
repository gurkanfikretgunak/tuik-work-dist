import { tx } from "@/i18n";
import { calcMath } from "../rotation/math";
import { generatePlans, type Candidate, type GenResult, type RotParams } from "../rotation/engine";
import type { Plan } from "../rotation/validator";
import { weeklyOf, type Notebook, type Region, type Tier } from "./model";
import { regionStats } from "./validator";

export type Cfg2 = {
  n: number;
  m: number;
  g: number; // K1: aynı defter için en az ay aralığı
  specialGap: number; // K6: haftalık defterler arası en az ay farkı (1 = peş peşe yasak)
  seed: number;
  inside: Notebook[];
  outside: Notebook[];
  regions: Region[];
  absent?: boolean[][]; // [ay][kişi] izinli (iki katman için ortak)
};

export type Result2 = { inside: GenResult; outside: GenResult };

/** K2 (takip) alt sınırı katman başına ayrı sayılır; her katman n kişi × n defterlik bağımsız bir problemdir. */
export function tierParams(cfg: Cfg2, tier: Tier): RotParams {
  const nbs = cfg[tier];
  return {
    n: cfg.n, m: cfg.m, g: cfg.g,
    pairLimit: calcMath(cfg.n, cfg.m, cfg.g).pairLower,
    special: weeklyOf(nbs), specialGap: cfg.specialGap,
    absent: cfg.absent, strategy: "ek",
    forbidden: [], fixed: [],
    seed: tier === "inside" ? cfg.seed : cfg.seed + 7919,
  };
}

const regionScore = (plan: Plan, cfg: Cfg2) => {
  const r = regionStats(plan, cfg.outside, cfg.regions, cfg.n);
  return r.maxDev * 100 + r.sumSq;
};

/**
 * Şehir içi ve şehir dışı katmanları bağımsız üretir. Şehir dışında çok sayıda aday üretilir ve
 * bölge dengesine (en yakın eşitlik) göre yeniden sıralanır; en iyi 3 aday tutulur.
 */
export async function generate2(
  cfg: Cfg2,
  opts: { timeMs?: number; onProgress?: (p: number, tier: Tier) => void; signal?: { cancelled: boolean } } = {},
): Promise<Result2> {
  const timeMs = opts.timeMs ?? 4000;
  const half = timeMs / 2;
  const inside = await generatePlans(tierParams(cfg, "inside"), { timeMs: half, want: 3, signal: opts.signal, onProgress: (p) => opts.onProgress?.(p / 2, "inside") });
  const outside = await generatePlans(tierParams(cfg, "outside"), { timeMs: half, want: 16, signal: opts.signal, onProgress: (p) => opts.onProgress?.(0.5 + p / 2, "outside") });
  if (outside.candidates.length > 1) {
    const ranked: Candidate[] = outside.candidates
      .map((c) => ({ c, s: regionScore(c.plan, cfg) + c.score * 0.001 }))
      .sort((a, b) => a.s - b.s)
      .map((x) => x.c);
    outside.candidates = ranked.slice(0, 3);
  }
  return { inside, outside };
}

export const errorOf = (r: Result2): string | undefined =>
  r.inside.error ? `${tx("v4.tier.inside")}: ${r.inside.error}` : r.outside.error ? `${tx("v4.tier.outside")}: ${r.outside.error}` : undefined;
