import { tx } from "@/i18n";
import type { Assignment, Employee, Job, RuleId, RuleSet } from "./types";

const EPS = 1e-9;

export const effCap = (e: Employee) => (e.donemlik_kapasite * e.musait_oran) / 100;

export function weightOf(j: Job, rs: RuleSet): number {
  if (rs.kapasiteBirimi === "is") return 1;
  return j.gorusme_sayisi * (j.yerlesim_tipi === "Kır" && ruleOn(rs, "kir") ? rs.kirCarpan : 1);
}

export const ruleOn = (rs: RuleSet, id: RuleId) => rs.rules.find((r) => r.id === id)?.enabled ?? false;
export const ruleMandatory = (rs: RuleSet, id: RuleId) => {
  const r = rs.rules.find((x) => x.id === id);
  return !!r && r.enabled && r.mandatory;
};
/** Yüksek öncelik = büyük çarpan */
const prioW = (rs: RuleSet, id: RuleId) => {
  const i = rs.rules.findIndex((r) => r.id === id);
  return i < 0 ? 0 : rs.rules.length - i;
};

const PRIO: Record<Job["oncelik"], number> = { Yüksek: 0, Normal: 1, Düşük: 2 };
const mKey = (j: Job) => `${j.il}|${j.ilce}|${j.mahalle}`;

export function sumEffCap(emps: Employee[]) {
  return emps.filter((e) => e.aktif).reduce((s, e) => s + effCap(e), 0);
}

type Ctx = {
  emps: Employee[];
  empIds: Set<string>;
  jobs: Job[];
  rs: RuleSet;
  load: Map<string, number>;
  mCount: Map<string, Map<string, number>>; // mahalle -> emp -> adet
  target: Map<string, number>;
};

function prevOk(rs: RuleSet, ctx: Ctx, j: Job, e: Employee): boolean {
  const prev = j.onceki_ay_gorusen_calisan_id;
  if (!prev || !ctx.empIds.has(prev)) return true;
  return rs.gecenAyYon === "rotasyon" ? e.calisan_id !== prev : e.calisan_id === prev;
}

/** Zorunlu kurallarla eleme. capacity=false ise kapasite kontrolü atlanır. */
function filterCands(ctx: Ctx, j: Job, withCapacity: boolean): { cands: Employee[]; reason: string } {
  const { rs } = ctx;
  let c = ctx.emps.filter((e) => e.aktif && effCap(e) > 0);
  if (!c.length) return { cands: [], reason: "noActive" };
  if (ruleMandatory(rs, "il")) {
    c = c.filter((e) => e.il === j.il);
    if (!c.length) return { cands: [], reason: "noProvince" };
  }
  if (ruleMandatory(rs, "kir") && j.yerlesim_tipi === "Kır") {
    c = c.filter((e) => e.kir_gorevi_yapabilir);
    if (!c.length) return { cands: [], reason: "noRural" };
  }
  if (ruleMandatory(rs, "gecenAy")) {
    c = c.filter((e) => prevOk(rs, ctx, j, e));
    if (!c.length) return { cands: [], reason: "prevRule" };
  }
  if (withCapacity) {
    const w = weightOf(j, rs);
    const ok = c.filter((e) => (ctx.load.get(e.calisan_id) ?? 0) + w <= effCap(e) + EPS);
    if (!ok.length) return { cands: [], reason: "capacity" };
    c = ok;
  }
  return { cands: c, reason: "" };
}

const fill = (ctx: Ctx, e: Employee, extra = 0) => ((ctx.load.get(e.calisan_id) ?? 0) + extra) / effCap(e);

function score(ctx: Ctx, j: Job, e: Employee): { s: number; why: string[] } {
  const { rs } = ctx;
  const w = weightOf(j, rs);
  let s = 0;
  const why: string[] = [];
  if (ruleOn(rs, "il") && e.il === j.il) {
    s += 60 * prioW(rs, "il");
    why.push("province");
  }
  if (ruleOn(rs, "mahalle") && (ctx.mCount.get(mKey(j))?.get(e.calisan_id) ?? 0) > 0) {
    s += 50 * prioW(rs, "mahalle");
    why.push("neighbourhood");
  }
  if (ruleOn(rs, "denge")) {
    const tgt = ctx.target.get(e.calisan_id) ?? effCap(e);
    const f = tgt > 0 ? ((ctx.load.get(e.calisan_id) ?? 0) + w) / tgt : 2;
    s += (1 - Math.min(f, 1.5)) * 40 * prioW(rs, "denge");
    why.push("balance");
  }
  if (ruleOn(rs, "kir") && j.yerlesim_tipi === "Kır" && !e.kir_gorevi_yapabilir) s -= 80 * prioW(rs, "kir");
  if (ruleOn(rs, "gecenAy") && j.onceki_ay_gorusen_calisan_id && ctx.empIds.has(j.onceki_ay_gorusen_calisan_id)) {
    const same = e.calisan_id === j.onceki_ay_gorusen_calisan_id;
    const good = rs.gecenAyYon === "rotasyon" ? !same : same;
    if (good) {
      s += 30 * prioW(rs, "gecenAy");
      why.push(rs.gecenAyYon === "rotasyon" ? "prevDiff" : "prevSame");
    }
  }
  return { s, why };
}

function commit(ctx: Ctx, j: Job, e: Employee, sign: 1 | -1) {
  const w = weightOf(j, ctx.rs);
  ctx.load.set(e.calisan_id, (ctx.load.get(e.calisan_id) ?? 0) + sign * w);
  const k = mKey(j);
  const m = ctx.mCount.get(k) ?? new Map<string, number>();
  m.set(e.calisan_id, (m.get(e.calisan_id) ?? 0) + sign);
  ctx.mCount.set(k, m);
}

export async function runDistribution(
  employees: Employee[],
  jobs: Job[],
  rs: RuleSet,
  onProgress?: (p: number) => void,
): Promise<Assignment[]> {
  const emps = employees.filter((e) => e.aktif);
  const totalCap = sumEffCap(emps);
  const totalLoad = jobs.reduce((s, j) => s + weightOf(j, rs), 0);
  const ratio = totalCap > 0 ? Math.min(1, totalLoad / totalCap) : 0;
  const ctx: Ctx = {
    emps,
    empIds: new Set(employees.map((e) => e.calisan_id)),
    jobs,
    rs,
    load: new Map(),
    mCount: new Map(),
    target: new Map(),
  };
  for (const e of emps) ctx.target.set(e.calisan_id, rs.kapasiteModu === "orantili" ? effCap(e) * ratio : effCap(e));

  // gruplama + sıralama
  const groups = new Map<string, Job[]>();
  for (const j of jobs) {
    const k = mKey(j);
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(j);
  }
  const gArr = [...groups.values()].map((g) => {
    g.sort((a, b) => PRIO[a.oncelik] - PRIO[b.oncelik] || weightOf(b, rs) - weightOf(a, rs));
    return { g, p: Math.min(...g.map((x) => PRIO[x.oncelik])), w: g.reduce((s, x) => s + weightOf(x, rs), 0) };
  });
  gArr.sort((a, b) => a.p - b.p || b.w - a.w);
  const ordered = gArr.flatMap((x) => x.g);

  const out = new Map<string, Assignment>();
  let n = 0;
  for (const j of ordered) {
    const { cands, reason } = filterCands(ctx, j, true);
    if (cands.length) {
      let best = cands[0];
      let bestS = -Infinity;
      let bestWhy: string[] = [];
      for (const e of cands) {
        const { s, why } = score(ctx, j, e);
        const better =
          s > bestS + EPS ||
          (Math.abs(s - bestS) <= EPS &&
            (fill(ctx, e) < fill(ctx, best) - EPS ||
              (Math.abs(fill(ctx, e) - fill(ctx, best)) <= EPS && e.calisan_id < best.calisan_id)));
        if (better) {
          best = e;
          bestS = s;
          bestWhy = why;
        }
      }
      commit(ctx, j, best, 1);
      out.set(j.is_id, {
        jobId: j.is_id,
        empId: best.calisan_id,
        neden: bestWhy.length ? bestWhy.join(",") : "leastFull",
        uyari: "",
        manuel: false,
        sebep: "",
      });
    } else if (reason === "capacity" && rs.kapasiteAsimi === "uyari") {
      const { cands: pre } = filterCands(ctx, j, false);
      const best = pre.sort((a, b) => fill(ctx, a) - fill(ctx, b))[0];
      commit(ctx, j, best, 1);
      out.set(j.is_id, {
        jobId: j.is_id,
        empId: best.calisan_id,
        neden: "overCapacity",
        uyari: "capacityExceeded",
        manuel: false,
        sebep: "",
      });
    } else {
      out.set(j.is_id, { jobId: j.is_id, empId: null, neden: "", uyari: "", manuel: false, sebep: reason });
    }
    if (++n % 200 === 0) {
      onProgress?.(n / ordered.length);
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  if (rs.iyilestirme && ruleOn(rs, "denge")) improve(ctx, out);
  onProgress?.(1);
  // girdi sırasını koru
  return jobs.map((j) => out.get(j.is_id)!);
}

function improve(ctx: Ctx, out: Map<string, Assignment>) {
  const { rs } = ctx;
  const byEmp = new Map<string, Job[]>();
  const jobById = new Map(ctx.jobs.map((j) => [j.is_id, j]));
  for (const a of out.values()) {
    if (!a.empId) continue;
    (byEmp.get(a.empId) ?? byEmp.set(a.empId, []).get(a.empId)!).push(jobById.get(a.jobId)!);
  }
  const live = ctx.emps.filter((e) => effCap(e) > 0);
  for (let it = 0; it < 3000; it++) {
    const sorted = [...live].sort((a, b) => fill(ctx, b) - fill(ctx, a));
    const A = sorted[0];
    let moved = false;
    for (let bi = sorted.length - 1; bi > 0 && !moved; bi--) {
      const B = sorted[bi];
      const fa = fill(ctx, A);
      if (fa - fill(ctx, B) <= rs.sapma / 100) break;
      let bestJ: Job | null = null;
      let bestMax = fa;
      for (const j of byEmp.get(A.calisan_id) ?? []) {
        if (out.get(j.is_id)!.manuel) continue;
        if (!filterOne(ctx, j, B)) continue;
        const w = weightOf(j, rs);
        const m = Math.max(fill(ctx, A, -w), fill(ctx, B, w));
        if (m < bestMax - EPS) {
          bestMax = m;
          bestJ = j;
        }
      }
      if (bestJ) {
        commit(ctx, bestJ, A, -1);
        commit(ctx, bestJ, B, 1);
        byEmp.set(A.calisan_id, byEmp.get(A.calisan_id)!.filter((x) => x !== bestJ));
        (byEmp.get(B.calisan_id) ?? byEmp.set(B.calisan_id, []).get(B.calisan_id)!).push(bestJ);
        const a = out.get(bestJ.is_id)!;
        a.empId = B.calisan_id;
        a.neden = "improve";
        a.uyari = "";
        moved = true;
      }
    }
    if (!moved) break;
  }
}

function filterOne(ctx: Ctx, j: Job, e: Employee): boolean {
  const { cands } = filterCands({ ...ctx, emps: [e] }, j, true);
  return cands.length > 0;
}

// ---------- yardımcılar: yükler, uyum, manuel taşıma ----------

export function computeLoads(assignments: Assignment[], jobs: Job[], rs: RuleSet): Map<string, number> {
  const jm = new Map(jobs.map((j) => [j.is_id, j]));
  const m = new Map<string, number>();
  for (const a of assignments) {
    if (!a.empId) continue;
    const j = jm.get(a.jobId);
    if (j) m.set(a.empId, (m.get(a.empId) ?? 0) + weightOf(j, rs));
  }
  return m;
}

export function checkMove(
  job: Job,
  to: Employee,
  assignments: Assignment[],
  employees: Employee[],
  jobs: Job[],
  rs: RuleSet,
): string[] {
  const v: string[] = [];
  const loads = computeLoads(assignments, jobs, rs);
  const cur = assignments.find((a) => a.jobId === job.is_id);
  let load = loads.get(to.calisan_id) ?? 0;
  if (cur?.empId === to.calisan_id) load -= weightOf(job, rs);
  if (!to.aktif) v.push("inactive");
  if (ruleMandatory(rs, "il") && to.il !== job.il) v.push(`provinceMismatch|${to.il}|${job.il}`);
  if (ruleMandatory(rs, "kir") && job.yerlesim_tipi === "Kır" && !to.kir_gorevi_yapabilir)
    v.push("noRuralDuty");
  if (ruleMandatory(rs, "gecenAy")) {
    const ctx = { empIds: new Set(employees.map((e) => e.calisan_id)) } as Ctx;
    if (!prevOk(rs, ctx, job, to)) v.push("prevRuleViolated");
  }
  const w = weightOf(job, rs);
  if (load + w > effCap(to) + EPS)
    v.push(`capacityOver|${round1(load + w)}|${round1(effCap(to))}`);
  return v;
}

/** Atanamama sebebi kodunu (noActive, noProvince, ...) geçerli dilde metne çevirir. */
export const reasonText = (code: string) => (code ? tx(`v1core.reason.${code}`) : "");
/** Atama nedeni kod listesini ("province,balance") metne çevirir. */
export const nedenText = (codes: string) =>
  codes ? codes.split(",").filter(Boolean).map((c) => tx(`v1core.why.${c}`)).join(", ") : "";
/** checkMove ihlal kodunu ("kod|a|b") metne çevirir. */
export const violText = (v: string) => {
  const [c, a, b] = v.split("|");
  return tx(`v1core.viol.${c}`, { a: a ?? "", b: b ?? "" });
};
/** Uyarı kodunu ("capacityExceeded" veya "manual:ihlal;ihlal") metne çevirir. */
export const uyariText = (u: string) => {
  if (!u) return "";
  if (u === "capacityExceeded") return tx("v1core.warn.capacityExceeded");
  if (u.startsWith("manual:")) return tx("v1core.warn.manual", { list: u.slice(7).split(";").map(violText).join("; ") });
  return u;
};

export const round1 = (n: number) => Math.round(n * 10) / 10;

export type Compliance = Record<RuleId, { ok: number; total: number }>;

export function computeCompliance(
  assignments: Assignment[],
  employees: Employee[],
  jobs: Job[],
  rs: RuleSet,
): Compliance {
  const em = new Map(employees.map((e) => [e.calisan_id, e]));
  const jm = new Map(jobs.map((j) => [j.is_id, j]));
  const loads = computeLoads(assignments, jobs, rs);
  const fills = employees.filter((e) => e.aktif && effCap(e) > 0).map((e) => (loads.get(e.calisan_id) ?? 0) / effCap(e));
  const avgFill = fills.length ? fills.reduce((a, b) => a + b, 0) / fills.length : 0;
  const mCnt = new Map<string, Map<string, number>>();
  for (const a of assignments) {
    const j = jm.get(a.jobId);
    if (!a.empId || !j) continue;
    const k = mKey(j);
    const m = mCnt.get(k) ?? new Map();
    m.set(a.empId, (m.get(a.empId) ?? 0) + 1);
    mCnt.set(k, m);
  }
  const res: Compliance = {
    il: { ok: 0, total: 0 },
    mahalle: { ok: 0, total: 0 },
    denge: { ok: 0, total: 0 },
    kir: { ok: 0, total: 0 },
    gecenAy: { ok: 0, total: 0 },
  };
  const ctx = { empIds: new Set(employees.map((e) => e.calisan_id)) } as Ctx;
  for (const a of assignments) {
    const j = jm.get(a.jobId);
    const e = a.empId ? em.get(a.empId) : undefined;
    if (!j || !e) continue;
    if (ruleOn(rs, "il")) {
      res.il.total++;
      if (e.il === j.il) res.il.ok++;
    }
    if (ruleOn(rs, "mahalle")) {
      res.mahalle.total++;
      const m = mCnt.get(mKey(j))!;
      if ((m.get(e.calisan_id) ?? 0) >= Math.max(...m.values())) res.mahalle.ok++;
    }
    if (ruleOn(rs, "denge")) {
      res.denge.total++;
      const f = (loads.get(e.calisan_id) ?? 0) / (effCap(e) || 1);
      if (Math.abs(f - avgFill) <= rs.sapma / 100 + EPS) res.denge.ok++;
    }
    if (ruleOn(rs, "kir") && j.yerlesim_tipi === "Kır") {
      res.kir.total++;
      if (e.kir_gorevi_yapabilir) res.kir.ok++;
    }
    if (ruleOn(rs, "gecenAy") && j.onceki_ay_gorusen_calisan_id && ctx.empIds.has(j.onceki_ay_gorusen_calisan_id)) {
      res.gecenAy.total++;
      if (prevOk(rs, ctx, j, e)) res.gecenAy.ok++;
    }
  }
  return res;
}
