import { calcMath } from "./math";
import type { RotParams } from "./engine";
import type { RotRules } from "./validator";
import { useRot } from "./store";

type St = ReturnType<typeof useRot.getState>;
export const pairLimitOf = (s: St) => s.pairOverride ?? calcMath(s.n, s.m, s.g).pairLower;

export const specialOf = (s: St) => s.notebooks.flatMap((d, i) => (d.special ? [i] : []));

export function buildParams(s: St): RotParams {
  return {
    n: s.n, m: s.m, g: s.g, pairLimit: pairLimitOf(s),
    groups: s.useGroups ? s.notebooks.map((d) => d.group) : undefined,
    special: specialOf(s), specialGap: s.specialGap,
    forbidden: s.forbidden, fixed: s.fixed, seed: s.seed,
  };
}

export function rulesOf(s: St, pairLimit?: number): RotRules {
  return {
    n: s.n, m: s.m, g: s.g,
    pairLimit: pairLimit ?? s.result?.usedPairLimit ?? pairLimitOf(s),
    groups: s.useGroups ? s.notebooks.map((d) => d.group) : undefined,
    forbidden: s.forbidden,
    special: specialOf(s), specialGap: s.specialGap,
  };
}
