import { calcMath } from "./math";
import type { RotParams } from "./engine";
import type { RotRules } from "./validator";
import { useRot } from "./store";
import { computeAbsence, planWindow, validateLeave } from "./leave";

type St = ReturnType<typeof useRot.getState>;
export const pairLimitOf = (s: St) => s.pairOverride ?? calcMath(s.n, s.m, s.g).pairLower;

export function usableLeaves(s: St) {
  const [a, b] = planWindow(s.startMonth, s.year, s.m);
  const ids = s.people.map((p) => p.id);
  return s.leaves.filter((l) => l.included && validateLeave(l, ids, a, b).length === 0);
}
export const absenceOf = (s: St) => computeAbsence(usableLeaves(s), s.people.map((p) => p.id), s.startMonth, s.year, s.m, s.leaveThreshold);

export const specialOf = (s: St) => s.notebooks.flatMap((d, i) => (d.special ? [i] : []));

export function buildParams(s: St): RotParams {
  return {
    n: s.n, m: s.m, g: s.g, pairLimit: pairLimitOf(s),
    groups: s.useGroups ? s.notebooks.map((d) => d.group) : undefined,
    special: specialOf(s), specialGap: s.specialGap,
    absent: absenceOf(s).absent, strategy: s.strategy,
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
    absent: absenceOf(s).absent, strategy: s.strategy,
  };
}
