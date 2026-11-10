import { computeAbsence, planWindow, validateLeave, type Absence, type Leave } from "../rotation/leave";

type Src = { people: { id: string }[]; leaves: Leave[]; startMonth: number; year: number; m: number; leaveThreshold: number };

/** K7: geçerli ve dahil edilen izinleri aylık "yok" matrisine indirger (iki katman için ortak). */
export function absenceOf(s: Src): Absence {
  const ids = s.people.map((p) => p.id);
  const [a, b] = planWindow(s.startMonth, s.year, s.m);
  const usable = s.leaves.filter((l) => l.included && validateLeave(l, ids, a, b).length === 0);
  return computeAbsence(usable, ids, s.startMonth, s.year, s.m, s.leaveThreshold);
}
