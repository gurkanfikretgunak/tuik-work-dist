import { absenceOf } from "./absence";
import type { useRot2 } from "./store";
import type { Rules2 } from "./validator";

type St = ReturnType<typeof useRot2.getState>;

export function rulesOfState(s: St): Rules2 {
  return {
    n: s.n, m: s.m, g: s.g, specialGap: s.specialGap, inside: s.inside, outside: s.outside, regions: s.regions,
    pairLimit: { inside: s.result?.inside.usedPairLimit ?? 0, outside: s.result?.outside.usedPairLimit ?? 0 },
    absent: absenceOf(s).absent,
  };
}
