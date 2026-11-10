import { collate } from "@/i18n";
import { computeCompliance, computeLoads, effCap, round1, sumEffCap, weightOf } from "./engine";
import { activeEmployees, activeJobs, type DistResult } from "./store";
import type { EmpRow, EventLog, JobRow, RuleSet, RuleId } from "./types";
import { RULE_META } from "./types";

export type EmpStat = {
  id: string; ad: string; il: string; kapasite: number; atanan: number; doluluk: number;
  kir: number; kent: number; mahalle: number; isSayisi: number;
};
export type IlStat = { il: string; toplam: number; atanan: number; calisan: number; kapasite: number; doluluk: number };

export function buildReport(args: {
  employees: EmpRow[]; jobs: JobRow[]; rules: RuleSet; result: DistResult; events: EventLog[];
  empFile: { name: string; total: number; errorRows: number } | null;
  jobFile: { name: string; total: number; errorRows: number } | null;
}) {
  const emps = activeEmployees(args.employees);
  const jobs = activeJobs(args.jobs);
  const rs = args.rules;
  const A = args.result.assignments;
  const jm = new Map(jobs.map((j) => [j.is_id, j]));
  const loads = computeLoads(A, jobs, rs);
  const assigned = A.filter((a) => a.empId);
  const unassigned = A.filter((a) => !a.empId);

  const perEmp: EmpStat[] = emps.map((e) => {
    const mine = A.filter((a) => a.empId === e.calisan_id).map((a) => jm.get(a.jobId)!).filter(Boolean);
    const cap = effCap(e);
    const l = loads.get(e.calisan_id) ?? 0;
    return {
      id: e.calisan_id, ad: e.ad_soyad, il: e.il, kapasite: round1(cap), atanan: round1(l),
      doluluk: cap > 0 ? l / cap : 0, kir: mine.filter((j) => j.yerlesim_tipi === "Kır").length,
      kent: mine.filter((j) => j.yerlesim_tipi === "Kent").length,
      mahalle: new Set(mine.map((j) => `${j.il}|${j.ilce}|${j.mahalle}`)).size, isSayisi: mine.length,
    };
  });
  const active = perEmp.filter((p) => p.kapasite > 0);
  const fills = active.map((p) => p.doluluk);
  const avg = fills.length ? fills.reduce((a, b) => a + b, 0) / fills.length : 0;
  const sd = fills.length ? Math.sqrt(fills.reduce((s, f) => s + (f - avg) ** 2, 0) / fills.length) : 0;

  const iller = [...new Set([...jobs.map((j) => j.il), ...emps.map((e) => e.il)])].sort((a, b) => collate(a, b));
  const perIl: IlStat[] = iller.map((il) => {
    const ej = perEmp.filter((p) => p.il === il);
    const cap = ej.reduce((s, p) => s + p.kapasite, 0);
    const used = ej.reduce((s, p) => s + p.atanan, 0);
    return {
      il, toplam: jobs.filter((j) => j.il === il).length,
      atanan: A.filter((a) => a.empId && jm.get(a.jobId)?.il === il).length,
      calisan: ej.length, kapasite: round1(cap), doluluk: cap > 0 ? used / cap : 0,
    };
  });

  const comp = computeCompliance(A, emps, jobs, rs);
  const uyum = (Object.keys(comp) as RuleId[])
    .filter((k) => rs.rules.find((r) => r.id === k)?.enabled)
    .map((k) => ({ id: k, label: RULE_META[k].label, ok: comp[k].ok, total: comp[k].total }));

  const sebepler = new Map<string, string[]>();
  for (const a of unassigned) (sebepler.get(a.sebep) ?? sebepler.set(a.sebep, []).get(a.sebep)!).push(a.jobId);

  const manual = args.events.filter((e) => e.type === "manuel");
  const withPrev = jobs.filter((j) => j.onceki_ay_gorusen_calisan_id);
  const same = withPrev.filter((j) => A.find((a) => a.jobId === j.is_id)?.empId === j.onceki_ay_gorusen_calisan_id).length;
  const kirJobs = jobs.filter((j) => j.yerlesim_tipi === "Kır").length;

  return {
    totals: {
      toplamIs: jobs.length, atanan: assigned.length, atanamayan: unassigned.length,
      calisan: emps.filter((e) => e.aktif).length, il: iller.length,
      efektifKapasite: round1(sumEffCap(emps)),
      toplamYuk: round1(jobs.reduce((s, j) => s + weightOf(j, rs), 0)),
      manuelSayisi: A.filter((a) => a.manuel).length,
      uyariSayisi: A.filter((a) => a.uyari).length,
    },
    fill: {
      avg, min: fills.length ? Math.min(...fills) : 0, max: fills.length ? Math.max(...fills) : 0, sd,
    },
    perEmp, perIl, uyum,
    sebepler: [...sebepler.entries()].map(([sebep, ids]) => ({ sebep, adet: ids.length, ids })),
    kirKent: { kir: kirJobs, kent: jobs.length - kirJobs },
    gecenAy: { toplam: withPrev.length, ayni: same, degisen: withPrev.length - same },
    manuel: manual,
    rs,
    files: { emp: args.empFile, job: args.jobFile },
    redistCount: Math.max(0, args.result.runCount - 1),
    durationMs: args.result.durationMs,
  };
}
export type Report = ReturnType<typeof buildReport>;
