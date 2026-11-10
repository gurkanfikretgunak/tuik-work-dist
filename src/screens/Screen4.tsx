"use client";
import { ArrowRight, Play, RotateCw } from "lucide-react";
import { useState } from "react";
import { useT } from "@/i18n";
import { useConfirm } from "@/components/confirm";
import { Badge, Button, Card, Collapsible, InfoCard, ScreenTitle, Stat } from "@/components/ui";
import { round1, sumEffCap, weightOf } from "@/lib/engine";
import { executeDistribution } from "@/lib/run";
import { activeEmployees, activeJobs, useStore } from "@/lib/store";
import { RULE_META } from "@/lib/types";

export default function Screen4() {
  const confirm = useConfirm();
  const { t, rt } = useT();
  const { employees, jobs, rules, result, go } = useStore();
  const [busy, setBusy] = useState(false);
  const [p, setP] = useState(0);
  const emps = activeEmployees(employees);
  const act = activeJobs(jobs);
  const load = act.reduce((s, j) => s + weightOf(j, rules), 0);
  const cap = sumEffCap(emps);
  const open = rules.rules.filter((r) => r.enabled);
  const unit = t(rules.kapasiteBirimi === "puan" ? "v1core.unit.puan" : "v1core.unit.is");

  const run = async () => {
    const again = !!result;
    const ok = await confirm({
      title: t(again ? "v1core.s4.confirmAgainTitle" : "v1core.s4.confirmTitle"),
      body: (
        <>
          <p>{rt("v1core.s4.confirmBody", { jobs: act.length, emps: emps.filter((e) => e.aktif).length, rules: open.length })}</p>
          {again && <p className="mt-1 font-medium text-[#C92830]">{t("v1core.s4.willDelete")}</p>}
        </>
      ),
      confirmLabel: t(again ? "v1core.s4.redo" : "v1core.s4.runShort"),
      tone: again ? "danger" : "primary",
    });
    if (!ok) return;
    setBusy(true);
    setP(0);
    await executeDistribution(setP);
    setBusy(false);
  };

  const done = result?.assignments ?? [];
  const okN = done.filter((a) => a.empId).length;

  return (
    <div>
      <ScreenTitle no={4} title={t("v1core.s4.title")} />
      <div className="mb-3">
        <Collapsible title={t("v1core.s4.howTitle")}>
          <ol className="list-inside list-decimal space-y-0.5">
            <li>{t("v1core.s4.how1")}</li>
            <li>{t("v1core.s4.how2")}</li>
            <li>{t("v1core.s4.how3")}</li>
            <li>{t("v1core.s4.how4")}</li>
            <li>{t("v1core.s4.how5")}</li>
          </ol>
        </Collapsible>
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label={t("v1core.s4.jobs")} value={act.length} />
        <Stat label={t("v1core.s4.activeEmps")} value={emps.filter((e) => e.aktif).length} />
        <Stat label={t("v1core.s4.totalLoad", { unit })} value={round1(load)} />
        <Stat label={t("v1core.l.effCap")} value={round1(cap)} tone={load > cap ? "red" : "green"} />
      </div>
      <Card title={t("v1core.s4.ruleSet")} className="mb-3">
        <div className="flex flex-wrap gap-1.5">
          {open.map((r) => (
            <Badge key={r.id} tone={r.mandatory ? "red" : "blue"}>
              {RULE_META[r.id].label} · {t(r.mandatory ? "v1core.mand" : "v1core.pref")}
            </Badge>
          ))}
          <Badge>{t(rules.kapasiteModu === "sert" ? "v1core.mode.sertCap" : "v1core.mode.orantiliCap")}</Badge>
        </div>
      </Card>

      <Card title={t("v1core.s4.runCard")}>
        {busy ? (
          <div>
            <div className="mb-1 text-[12.5px] text-slate-700">{t("v1core.s4.running", { p: Math.round(p * 100) })}</div>
            <div className="h-2.5 w-full rounded bg-slate-200">
              <div className="h-2.5 rounded bg-[#1F2A44] transition-all" style={{ width: `${p * 100}%` }} />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button variant="primary" onClick={run} data-testid="run-dist">
              {result ? <RotateCw className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />} {t(result ? "v1core.s4.redo" : "v1core.s4.run")}
            </Button>
            {!result && <span className="text-xs text-slate-500">{t("v1core.s4.willAsk")}</span>}
          </div>
        )}
        {result && !busy && (
          <div className="mt-3 space-y-2" data-testid="dist-result">
            <div className="grid grid-cols-3 gap-2">
              <Stat label={t("v1core.l.assigned")} value={okN} tone="green" />
              <Stat label={t("v1core.l.unassigned")} value={done.length - okN} tone={done.length - okN ? "red" : "green"} />
              <Stat label={t("v1core.s4.duration")} value={`${result.durationMs} ms`} sub={t("v1core.s4.runNo", { n: result.runCount })} />
            </div>
            {done.length - okN > 0 ? (
              <InfoCard tone="warn">{t("v1core.s4.unassignedInfo")}</InfoCard>
            ) : (
              <InfoCard tone="ok">{t("v1core.s4.allAssigned")}</InfoCard>
            )}
          </div>
        )}
      </Card>

      <div className="mt-3 flex items-center justify-between">
        <Button onClick={() => go(3)}>{t("v1core.s4.backJobs")}</Button>
        <Button variant="primary" disabled={!result || busy} onClick={() => go(5)} data-testid="to-review">
          {t("v1core.s4.toReview")} <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
