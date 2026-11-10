"use client";
import clsx from "clsx";
import { ArrowRight, MoveRight, RotateCw } from "lucide-react";
import { useMemo, useState } from "react";
import { collate, useT } from "@/i18n";
import { Modal, useConfirm } from "@/components/confirm";
import { Badge, Button, Card, Collapsible, FillBar, InfoCard, ScreenTitle, Stat, inputCls } from "@/components/ui";
import { checkMove, computeLoads, effCap, reasonText, round1, uyariText, violText, weightOf } from "@/lib/engine";
import { executeDistribution } from "@/lib/run";
import { activeEmployees, activeJobs, useStore } from "@/lib/store";
import { pct } from "@/lib/outputs";
import type { Job } from "@/lib/types";

const TABS = ["dist", "warn", "unassigned", "balance"] as const;

export default function Screen5() {
  const confirm = useConfirm();
  const { t } = useT();
  const { employees, jobs, rules, result, patchAssignments, log, go } = useStore();
  const emps = useMemo(() => activeEmployees(employees).filter((e) => e.aktif), [employees]);
  const allEmps = useMemo(() => activeEmployees(employees), [employees]);
  const js = useMemo(() => activeJobs(jobs), [jobs]);
  const [selId, setSelId] = useState<string | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>(TABS[0]);
  const [moving, setMoving] = useState<Job | null>(null);
  const [busy, setBusy] = useState(false);

  const A = useMemo(() => result?.assignments ?? [], [result]);
  const jm = useMemo(() => new Map(js.map((j) => [j.is_id, j])), [js]);
  const loads = useMemo(() => computeLoads(A, js, rules), [A, js, rules]);

  if (!result) {
    return (
      <div>
        <ScreenTitle no={5} title={t("v1core.s5.title")} />
        <InfoCard tone="warn" title={t("v1core.s5.noResultTitle")}>
          {t("v1core.s5.noResultBody")}
        </InfoCard>
        <div className="mt-3">
          <Button variant="primary" onClick={() => go(4)}>
            {t("v1core.s5.goRun")}
          </Button>
        </div>
      </div>
    );
  }

  const unit = t(rules.kapasiteBirimi === "puan" ? "v1core.unit.puan" : "v1core.unit.is");
  const assigned = A.filter((a) => a.empId);
  const unassigned = A.filter((a) => !a.empId);
  const fills = emps.map((e) => (effCap(e) > 0 ? (loads.get(e.calisan_id) ?? 0) / effCap(e) : 0));
  const avg = fills.length ? fills.reduce((a, b) => a + b, 0) / fills.length : 0;
  const warnA = A.filter((a) => a.uyari);
  const sel = emps.find((e) => e.calisan_id === selId) ?? emps[0];
  const selJobs = A.filter((a) => a.empId === sel?.calisan_id).map((a) => ({ a, j: jm.get(a.jobId)! })).filter((x) => x.j);

  const redo = async () => {
    const ok = await confirm({
      title: t("v1core.s5.redoTitle"),
      body: <>{t(A.some((a) => a.manuel) ? "v1core.s5.redoBodyManual" : "v1core.s5.redoBody")}</>,
      confirmLabel: t("v1core.s4.redo"),
      tone: "danger",
    });
    if (!ok) return;
    setBusy(true);
    await executeDistribution();
    setBusy(false);
  };

  const toApprove = async () => {
    if (unassigned.length > 0) {
      const ok = await confirm({
        title: t("v1core.s5.unTitle"),
        body: <>{t("v1core.s5.unBody", { n: unassigned.length })}</>,
        confirmLabel: t("v1core.s5.unConfirm"),
      });
      if (!ok) return;
    }
    go(6);
  };

  return (
    <div>
      <ScreenTitle no={5} title={t("v1core.s5.title")}>
        <Button onClick={() => go(1)}>{t("v1core.s5.editCap")}</Button>
        <Button onClick={() => go(2)}>{t("v1core.s5.editRules")}</Button>
        <Button onClick={redo} disabled={busy}>
          <RotateCw className="h-3.5 w-3.5" /> {t("v1core.s4.redo")}
        </Button>
        <Button variant="primary" onClick={toApprove} data-testid="to-approve">
          {t("v1core.s5.toApprove")} <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </ScreenTitle>

      <div className="mb-3">
        <Collapsible title={t("v1core.s5.helpTitle")}>
          {t("v1core.s5.helpBody")}
        </Collapsible>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-6">
        <Stat label={t("v1core.l.totalJobs")} value={A.length} />
        <Stat label={t("v1core.l.assigned")} value={assigned.length} tone="green" />
        <Stat label={t("v1core.l.unassigned")} value={unassigned.length} tone={unassigned.length ? "red" : "green"} />
        <Stat label={t("v1core.s5.warnings")} value={warnA.length} tone={warnA.length ? "amber" : undefined} />
        <Stat label={t("v1core.l.avgFill")} value={pct(avg)} />
        <Stat label={t("v1core.l.manualChanges")} value={A.filter((a) => a.manuel).length} />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <Card title={t("v1core.l.employees")} className="lg:col-span-2">
          <ul className="max-h-[360px] divide-y divide-slate-100 overflow-auto">
            {emps.map((e) => {
              const l = loads.get(e.calisan_id) ?? 0;
              const f = effCap(e) > 0 ? l / effCap(e) : 0;
              return (
                <li key={e.calisan_id}>
                  <button
                    onClick={() => setSelId(e.calisan_id)}
                    data-testid={`emp-${e.calisan_id}`}
                    className={clsx("w-full px-2 py-1.5 text-left hover:bg-slate-50", sel?.calisan_id === e.calisan_id && "bg-sky-50")}
                  >
                    <div className="flex items-center justify-between text-[12.5px]">
                      <span className="font-medium text-slate-900">
                        {e.calisan_id} · {e.ad_soyad}
                      </span>
                      <span className="tabular-nums text-slate-700">
                        {round1(l)}/{round1(effCap(e))}
                      </span>
                    </div>
                    <div className="mb-0.5 text-[11px] text-slate-500">{e.il}</div>
                    <FillBar value={f} />
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card title={sel ? t("v1core.s5.empJobs", { name: sel.ad_soyad, n: selJobs.length }) : t("v1core.s5.jobs")} className="lg:col-span-3">
          <div className="max-h-[360px] overflow-auto">
            <table className="w-full text-[12.5px]">
              <thead className="sticky top-0 bg-white text-left text-slate-500">
                <tr>
                  <th className="pr-2">{t("v1core.s5.job")}</th>
                  <th className="pr-2">{t("v1core.l.province")}</th>
                  <th className="pr-2">{t("v1core.l.neighbourhood")}</th>
                  <th className="pr-2">{t("v1core.s5.ruralUrbanShort")}</th>
                  <th className="pr-2 text-right">{t("v1core.s5.interviews")}</th>
                  <th className="pr-2 text-right">{unit}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {selJobs.map(({ a, j }) => (
                  <tr key={j.is_id} className="border-t border-slate-100">
                    <td className="py-1 pr-2 font-mono">
                      {j.is_id} {a.manuel && <Badge tone="amber">{t("v1core.s5.manualBadge")}</Badge>} {a.uyari && <Badge tone="red">{uyariText(a.uyari)}</Badge>}
                    </td>
                    <td className="pr-2">{j.il}</td>
                    <td className="pr-2">{j.mahalle}</td>
                    <td className="pr-2">{j.yerlesim_tipi}</td>
                    <td className="pr-2 text-right tabular-nums">{j.gorusme_sayisi}</td>
                    <td className="pr-2 text-right tabular-nums">{round1(weightOf(j, rules))}</td>
                    <td className="text-right">
                      <Button size="sm" onClick={() => setMoving(j)} data-testid={`move-${j.is_id}`}>
                        <MoveRight className="h-3 w-3" /> {t("v1core.s5.moveToOther")}
                      </Button>
                    </td>
                  </tr>
                ))}
                {selJobs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-slate-500">
                      {t("v1core.s5.noJobsForEmp")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="mt-3">
        <div className="flex gap-0.5 border-b border-slate-200">
          {TABS.map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={clsx("px-3 py-1.5 text-xs font-medium", tab === k ? "border-b-2 border-[#C92830] text-[#1F2A44]" : "text-slate-600 hover:bg-slate-50")}
            >
              {k === "warn" ? `${t("v1core.s5.tabWarn")} (${warnA.length})` : k === "unassigned" ? `${t("v1core.s5.tabUn")} (${unassigned.length})` : t(k === "dist" ? "v1core.s5.tabDist" : "v1core.s5.tabBalance")}
            </button>
          ))}
        </div>
        <div className="rounded-b-md border border-t-0 border-slate-200 p-3">
          {tab === "dist" && <IlMahalle A={A} jm={jm} />}
          {tab === "warn" &&
            (warnA.length === 0 ? (
              <Badge tone="green">{t("v1core.s5.noWarn")}</Badge>
            ) : (
              <ul className="list-inside list-disc text-[12.5px]">
                {warnA.map((a) => (
                  <li key={a.jobId}>
                    {a.jobId} → {a.empId}: {uyariText(a.uyari)}
                  </li>
                ))}
              </ul>
            ))}
          {tab === "unassigned" &&
            (unassigned.length === 0 ? (
              <Badge tone="green">{t("v1core.s5.noUnassigned")}</Badge>
            ) : (
              <table className="w-full text-[12.5px]">
                <thead className="text-left text-slate-500">
                  <tr>
                    <th>{t("v1core.s5.job")}</th>
                    <th>{t("v1core.s5.provNeigh")}</th>
                    <th>{t("v1core.s5.reason")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {unassigned.map((a) => {
                    const j = jm.get(a.jobId)!;
                    return (
                      <tr key={a.jobId} className="border-t border-slate-100">
                        <td className="py-1 font-mono">{a.jobId}</td>
                        <td>
                          {j.il} / {j.mahalle} ({j.yerlesim_tipi})
                        </td>
                        <td className="text-red-800">{reasonText(a.sebep)}</td>
                        <td className="text-right">
                          <Button size="sm" onClick={() => setMoving(j)}>
                            {t("v1core.s5.assignManually")}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ))}
          {tab === "balance" && (
            <div className="grid gap-x-6 gap-y-1.5 md:grid-cols-2">
              {emps.map((e) => (
                <div key={e.calisan_id} className="flex items-center gap-2 text-[12px]">
                  <span className="w-28 truncate">{e.ad_soyad}</span>
                  <div className="flex-1">
                    <FillBar value={effCap(e) > 0 ? (loads.get(e.calisan_id) ?? 0) / effCap(e) : 0} target={avg} />
                  </div>
                  <span className="w-10 text-right tabular-nums">{pct(effCap(e) > 0 ? (loads.get(e.calisan_id) ?? 0) / effCap(e) : 0)}</span>
                </div>
              ))}
              <div className="text-[11px] text-slate-500 md:col-span-2">{t("v1core.s5.barHint")}</div>
            </div>
          )}
        </div>
      </div>

      <MoveModal
        job={moving}
        onClose={() => setMoving(null)}
        emps={allEmps.filter((e) => e.aktif)}
        loads={loads}
        onMove={async (job, to, violations) => {
          const cur = A.find((a) => a.jobId === job.is_id);
          const from = cur?.empId ?? null;
          const ok = await confirm({
            title: t(violations.length ? "v1core.s5.moveViolTitle" : "v1core.s5.moveTitle"),
            body: (
              <>
                <p>
                  <b>{job.is_id}</b>: {from ? employees.find((r) => r.data.calisan_id === from)?.data.ad_soyad : t("v1core.s5.fromUnassigned")} → <b>{to.ad_soyad}</b>
                </p>
                {violations.length > 0 && (
                  <ul className="mt-1 list-inside list-disc text-[#C92830]">
                    {violations.map((v) => (
                      <li key={v}>{violText(v)}</li>
                    ))}
                  </ul>
                )}
              </>
            ),
            confirmLabel: t(violations.length ? "v1core.s5.moveAnyway" : "v1core.s5.move"),
            tone: violations.length ? "danger" : "primary",
          });
          if (!ok) return false;
          patchAssignments((as) =>
            as.map((a) =>
              a.jobId === job.is_id
                ? { ...a, empId: to.calisan_id, manuel: true, sebep: "", neden: "manual", uyari: violations.length ? `manual:${violations.join(";")}` : "" }
                : a,
            ),
          );
          log("manuel", t(violations.length ? "v1core.s5.logViol" : "v1core.s5.log", { job: job.is_id, from: from ?? t("v1core.s5.fromUnassignedLog"), to: to.calisan_id, viol: violations.map(violText).join("; ") }), {
            is: job.is_id, kimden: from, kime: to.calisan_id, ihlal: violations,
          });
          return true;
        }}
        check={(job, to) => checkMove(job, to, A, allEmps, js, rules)}
      />
    </div>
  );
}

function IlMahalle({ A, jm }: { A: { jobId: string; empId: string | null }[]; jm: Map<string, Job> }) {
  const { t, lang } = useT();
  const rows = useMemo(() => {
    const m = new Map<string, { il: string; mah: string; total: number; assigned: number; emps: Set<string> }>();
    for (const a of A) {
      const j = jm.get(a.jobId);
      if (!j) continue;
      const k = `${j.il}|${j.ilce}|${j.mahalle}`;
      const x = m.get(k) ?? { il: j.il, mah: `${j.ilce} / ${j.mahalle}`, total: 0, assigned: 0, emps: new Set<string>() };
      x.total++;
      if (a.empId) {
        x.assigned++;
        x.emps.add(a.empId);
      }
      m.set(k, x);
    }
    return [...m.values()].sort((a, b) => collate(a.il, b.il) || collate(a.mah, b.mah));
  // eslint-disable-next-line react-hooks/exhaustive-deps -- lang: çevrilmiş etiketler dile bağlı
  }, [A, jm, lang]);
  return (
    <div className="max-h-64 overflow-auto">
      <table className="w-full text-[12.5px]">
        <thead className="sticky top-0 bg-white text-left text-slate-500">
          <tr>
            <th>{t("v1core.l.province")}</th>
            <th>{t("v1core.s5.distNeigh")}</th>
            <th className="text-right">{t("v1core.s5.job")}</th>
            <th className="text-right">{t("v1core.l.assignedShort")}</th>
            <th className="text-right">{t("v1core.s5.distinctEmps")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.il + r.mah} className="border-t border-slate-100">
              <td className="py-0.5">{r.il}</td>
              <td>{r.mah}</td>
              <td className="text-right tabular-nums">{r.total}</td>
              <td className="text-right tabular-nums">{r.assigned}</td>
              <td className="text-right tabular-nums">{r.emps.size}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MoveModal({
  job,
  onClose,
  emps,
  loads,
  onMove,
  check,
}: {
  job: Job | null;
  onClose: () => void;
  emps: ReturnType<typeof activeEmployees>;
  loads: Map<string, number>;
  onMove: (j: Job, to: ReturnType<typeof activeEmployees>[number], v: string[]) => Promise<boolean>;
  check: (j: Job, to: ReturnType<typeof activeEmployees>[number]) => string[];
}) {
  const { t } = useT();
  const [to, setTo] = useState("");
  const target = emps.find((e) => e.calisan_id === to);
  const viol = job && target ? check(job, target) : [];
  return (
    <Modal
      open={!!job}
      onClose={() => {
        setTo("");
        onClose();
      }}
      title={job ? t("v1core.s5.modalTitle", { id: job.is_id }) : ""}
      footer={
        <>
          <Button onClick={onClose}>{t("c.cancel")}</Button>
          <Button
            variant="primary"
            disabled={!target}
            data-testid="move-confirm"
            onClick={async () => {
              if (job && target && (await onMove(job, target, viol))) {
                setTo("");
                onClose();
              }
            }}
          >
            {t("v1core.s5.move")}
          </Button>
        </>
      }
    >
      {job && (
        <div className="space-y-2.5">
          <div className="text-[12.5px] text-slate-700">
            {job.il} / {job.ilce} / {job.mahalle} · {job.yerlesim_tipi} · {t("v1core.s5.nInterviews", { n: job.gorusme_sayisi })}
          </div>
          <select className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} aria-label={t("v1core.s5.targetEmp")} data-testid="move-target">
            <option value="">{t("v1core.s5.pickEmp")}</option>
            {emps.map((e) => (
              <option key={e.calisan_id} value={e.calisan_id}>
                {e.calisan_id} · {e.ad_soyad} ({e.il}) — {round1(loads.get(e.calisan_id) ?? 0)}/{round1(effCap(e))}
              </option>
            ))}
          </select>
          {target && (viol.length ? (
            <InfoCard tone="error" title={t("v1core.s5.violTitle")}>
              <ul className="list-inside list-disc">
                {viol.map((v) => (
                  <li key={v}>{violText(v)}</li>
                ))}
              </ul>
            </InfoCard>
          ) : (
            <InfoCard tone="ok">{t("v1core.s5.ok")}</InfoCard>
          ))}
        </div>
      )}
    </Modal>
  );
}
