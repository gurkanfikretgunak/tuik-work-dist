"use client";
import { ArrowRight, CheckCircle2, Download } from "lucide-react";
import { useState } from "react";
import { useT } from "@/i18n";
import { useConfirm } from "@/components/confirm";
import { Badge, Button, Card, Collapsible, InfoCard, ScreenTitle, Stat } from "@/components/ui";
import { EMP_COLS, toCsv, yesNo } from "@/lib/csv";
import { round1, sumEffCap } from "@/lib/engine";
import { ruleJson } from "@/lib/outputs";
import { JOB_ALL_COLS, RESULT_COLS_EXTRA, download, resultRows, unassignedRows } from "@/lib/share";
import { activeEmployees, activeJobs, useStore } from "@/lib/store";
import { RULE_META } from "@/lib/types";

export default function Screen6() {
  const confirm = useConfirm();
  const { t, rt } = useT();
  const { employees, jobs, rules, result, approved, setApproved, log, go } = useStore();
  const emps = activeEmployees(employees);
  const js = activeJobs(jobs);
  const [pick, setPick] = useState({ sonuc: true, atanamayan: true, kural: true, calisan: false });

  if (!result) {
    return (
      <div>
        <ScreenTitle no={6} title={t("v1core.s6.title")} />
        <InfoCard tone="warn">{t("v1core.s6.noResult")}</InfoCard>
        <Button className="mt-3" variant="primary" onClick={() => go(4)}>
          {t("v1core.s5.goRun")}
        </Button>
      </div>
    );
  }
  const A = result.assignments;
  const okN = A.filter((a) => a.empId).length;
  const un = A.length - okN;
  const manual = A.filter((a) => a.manuel).length;
  const open = rules.rules.filter((r) => r.enabled);

  const approve = async () => {
    const ok = await confirm({
      title: t("v1core.s6.approveTitle"),
      body: (
        <>
          <p>{rt("v1core.s6.approveBody", { ok: okN, un, manual })}</p>
          <p className="mt-1">{t("v1core.s6.approveNote")}</p>
        </>
      ),
      confirmLabel: t("c.confirm"),
    });
    if (!ok) return;
    setApproved(true);
    log("onay", t("v1core.s6.approveLog", { ok: okN, un, manual }), { atanan: okN, atanamayan: un, manuel: manual });
  };

  const downloadAll = async () => {
    const files: string[] = [];
    if (pick.sonuc) files.push("atama_sonucu.csv");
    if (pick.atanamayan && un > 0) files.push("atanamayan_isler.csv");
    if (pick.kural) files.push("kural_ozeti.json");
    if (pick.calisan) files.push("calisanlar.csv");
    const ok = await confirm({
      title: t("v1core.s6.dlTitle"),
      body: (
        <>
          <ul className="list-inside list-disc">
            {files.map((f) => (
              <li key={f} className="font-mono">{f}</li>
            ))}
          </ul>
          <p className="mt-1 text-slate-600">{t("v1core.s6.dlNote")}</p>
        </>
      ),
      confirmLabel: t("c.download"),
    });
    if (!ok) return;
    if (pick.sonuc) download("atama_sonucu.csv", toCsv(resultRows(js, A, emps), [...JOB_ALL_COLS, ...RESULT_COLS_EXTRA]), "text/csv;charset=utf-8");
    if (pick.atanamayan && un > 0) download("atanamayan_isler.csv", toCsv(unassignedRows(js, A), [...JOB_ALL_COLS, "sebep"]), "text/csv;charset=utf-8");
    if (pick.kural) download("kural_ozeti.json", ruleJson(employees, rules), "application/json");
    if (pick.calisan)
      download("calisanlar.csv", toCsv(employees.filter((r) => r.included).map((r) => ({ ...r.data, kir_gorevi_yapabilir: yesNo(r.data.kir_gorevi_yapabilir), aktif: yesNo(r.data.aktif) })), EMP_COLS), "text/csv;charset=utf-8");
    log("indirme", t("v1core.s6.dlLog", { files: files.join(", ") }), { dosyalar: files });
  };

  const chk = (k: keyof typeof pick, label: string, disabled = false) => (
    <label className={`flex items-center gap-2 text-[13px] ${disabled ? "opacity-50" : ""}`}>
      <input type="checkbox" disabled={disabled} checked={pick[k] && !disabled} onChange={(e) => setPick({ ...pick, [k]: e.target.checked })} />
      <span className="font-mono">{label}</span>
    </label>
  );

  return (
    <div>
      <ScreenTitle no={6} title={t("v1core.s6.title")} />
      <div className="mb-3">
        <Collapsible title={t("v1core.s6.whatTitle")}>
          <ul className="list-inside list-disc space-y-0.5">
            <li>
              {rt("v1core.s6.what1", { code: <code>manuel_degisti</code> })}
            </li>
            <li>
              {rt("v1core.s6.what2")}
            </li>
            <li>
              {rt("v1core.s6.what3")}
            </li>
            <li>
              {rt("v1core.s6.what4")}
            </li>
          </ul>
        </Collapsible>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-5">
        <Stat label={t("v1core.l.assigned")} value={okN} tone="green" />
        <Stat label={t("v1core.l.unassigned")} value={un} tone={un ? "red" : "green"} />
        <Stat label={t("v1core.l.manualChanges")} value={manual} />
        <Stat label={t("v1core.l.effCap")} value={round1(sumEffCap(emps))} />
        <Stat label={t("v1core.s6.openRules")} value={open.length} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card title={t("v1core.s6.finalSummary")}>
          <ul className="space-y-1 text-[12.5px]">
            {open.map((r) => (
              <li key={r.id} className="flex items-center gap-2">
                <Badge tone={r.mandatory ? "red" : "blue"}>{t(r.mandatory ? "v1core.mand" : "v1core.pref")}</Badge>
                {RULE_META[r.id].label}
              </li>
            ))}
            <li className="pt-1 text-slate-600">
              {t("v1core.s6.capLine", { mode: t(rules.kapasiteModu === "sert" ? "v1core.mode.sert" : "v1core.mode.orantili"), unit: t(rules.kapasiteBirimi === "puan" ? "v1core.unitLong.puan" : "v1core.unitLong.is") })}
            </li>
          </ul>
        </Card>
        <Card title={t("v1core.s6.approval")}>
          {approved ? (
            <InfoCard tone="ok">
              <span className="flex items-center gap-1 font-medium">
                <CheckCircle2 className="h-4 w-4" /> {t("v1core.s6.approved")}
              </span>
            </InfoCard>
          ) : (
            <>
              <p className="mb-2 text-[12.5px] text-slate-700">{t("v1core.s6.approvePrompt")}</p>
              <Button variant="primary" onClick={approve} data-testid="approve">
                <CheckCircle2 className="h-3.5 w-3.5" /> {t("v1core.s6.approveBtn")}
              </Button>
            </>
          )}
        </Card>
      </div>

      <Card title={t("v1core.s6.files")} className="mt-3">
        <div className="space-y-1.5">
          {chk("sonuc", "atama_sonucu.csv", !approved)}
          {chk("atanamayan", "atanamayan_isler.csv", !approved || un === 0)}
          {chk("kural", "kural_ozeti.json", !approved)}
          {chk("calisan", t("v1core.s6.empFileLabel"), !approved)}
        </div>
        <Button className="mt-3" variant="primary" disabled={!approved} onClick={downloadAll} data-testid="download-all">
          <Download className="h-3.5 w-3.5" /> {t("v1core.s6.dlSelected")}
        </Button>
      </Card>

      <div className="mt-3 flex items-center justify-between">
        <Button onClick={() => go(5)}>{t("v1core.s6.backReview")}</Button>
        <Button variant="primary" disabled={!approved} onClick={() => go(7)} data-testid="to-report">
          {t("v1core.s6.toReport")} <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
