"use client";
import { ArrowRight, FileUp } from "lucide-react";
import { useMemo, useState } from "react";
import { useConfirm } from "@/components/confirm";
import { useT } from "@/i18n";
import { DataTable, type Col, type TRow } from "@/components/DataTable";
import { FileDrop } from "@/components/FileDrop";
import { Badge, Button, Card, Collapsible, InfoCard, ScreenTitle, Stat } from "@/components/ui";
import { parseJobs } from "@/lib/csv";
import { effCap, round1, sumEffCap, weightOf } from "@/lib/engine";
import { activeEmployees, activeJobs, useStore } from "@/lib/store";

export default function Screen3() {
  const confirm = useConfirm();
  const { t, rt, locale } = useT();
  const { jobs, jobFile, jobsConfirmed, employees, rules, setJobs, patchJobs, setJobsConfirmed, go, log } = useStore();
  const [miss, setMiss] = useState<string[]>([]);

  const onText = async (text: string, name: string) => {
    const r = parseJobs(text);
    if (r.fatal) return setMiss(r.missingColumns);
    setMiss([]);
    if (jobs.length) {
      const ok = await confirm({ title: t("v1ui.s3.replace.title"), body: t("v1ui.s3.replace.body"), confirmLabel: t("v1ui.replace"), tone: "danger" });
      if (!ok) return;
    }
    const bad = r.rows.filter((x) => x.errors.length).length;
    setJobs(r.rows, { name, total: r.rows.length, errorRows: bad, at: new Date().toISOString() });
    log("is_yuklendi", t("v1ui.s3.log.loaded", { name, rows: r.rows.length, bad }), { dosya: name, satir: r.rows.length, hatali: bad });
  };
  const loadSample = async () => onText(await (await fetch("/ornek/isler.csv")).text(), `isler.csv (${t("v1ui.exampleWord")})`);

  const toggle = (id: number) => patchJobs((rs) => rs.map((r) => (r.rowNo === id ? (r.errors.length && !r.included ? r : { ...r, included: !r.included }) : r)));
  const toggleAll = (c: boolean, ids: number[]) => {
    const s = new Set(ids);
    patchJobs((rs) => rs.map((r) => (s.has(r.rowNo) && (!c || r.errors.length === 0) ? { ...r, included: c } : r)));
  };

  const emps = useMemo(() => activeEmployees(employees), [employees]);
  const act = useMemo(() => activeJobs(jobs), [jobs]);

  const stats = useMemo(() => {
    const cap = sumEffCap(emps);
    const load = act.reduce((s, j) => s + weightOf(j, rules), 0);
    const iller = [...new Set(act.map((j) => j.il))].sort((a, b) => a.localeCompare(b, locale));
    const perIl = iller.map((il) => {
      const c = emps.filter((e) => e.aktif && e.il === il).reduce((s, e) => s + effCap(e), 0);
      const l = act.filter((j) => j.il === il).reduce((s, j) => s + weightOf(j, rules), 0);
      return { il, cap: c, load: l, gap: Math.max(0, l - c), noStaff: !emps.some((e) => e.aktif && e.il === il) };
    });
    const kir = act.filter((j) => j.yerlesim_tipi === "Kır").length;
    const empIds = new Set(employees.map((r) => r.data.calisan_id));
    const badPrev = act.filter((j) => j.onceki_ay_gorusen_calisan_id && !empIds.has(j.onceki_ay_gorusen_calisan_id));
    return { cap, load, perIl, kir, badPrev, gorusme: act.reduce((s, j) => s + j.gorusme_sayisi, 0) };
  }, [act, emps, rules, employees, locale]);

  const unitLbl = rules.kapasiteBirimi === "puan" ? t("v1ui.unit.puan") : t("v1ui.unit.is");
  const gap = stats.load - stats.cap;
  const noStaffIl = stats.perIl.filter((x) => x.noStaff);
  const ilGaps = stats.perIl.filter((x) => x.gap > 0 && !x.noStaff);

  const rows: TRow[] = jobs.map((r) => ({ id: r.rowNo, cells: { ...r.data }, errors: r.errors, checked: r.included, dim: !r.included }));
  const cols: Col[] = [
    { key: "is_id", label: "is_id", width: 80 },
    { key: "il", label: "il", width: 80 },
    { key: "ilce", label: "ilce", width: 90 },
    { key: "mahalle", label: "mahalle", width: 100 },
    { key: "yerlesim_tipi", label: "yerlesim_tipi", width: 90 },
    { key: "birim_no", label: "birim_no", width: 90 },
    { key: "gorusme_sayisi", label: "gorusme_sayisi", type: "num", width: 100 },
    { key: "onceki_ay_gorusen_calisan_id", label: "onceki_ay_gorusen_calisan_id", width: 160 },
    { key: "oncelik", label: "oncelik", width: 70 },
    { key: "anket_turu", label: "anket_turu", width: 140 },
  ];

  const badRows = jobs.filter((r) => r.errors.length);
  const next = async () => {
    const ok = await confirm({
      title: t("v1ui.s3.next.title"),
      body: (
        <>
          <p>{rt("v1ui.s3.next.body", { n: act.length, skip: jobs.length - act.length, load: round1(stats.load), unit: unitLbl, cap: round1(stats.cap) })}</p>
          {gap > 0 && <p className="mt-1 font-medium text-[#C92830]">{t("v1ui.s3.next.gap", { gap: round1(gap), unit: unitLbl })}</p>}
        </>
      ),
      confirmLabel: t("v1ui.confirmContinue"),
    });
    if (!ok) return;
    setJobsConfirmed(true);
    log("is_onaylandi", t("v1ui.s3.next.log", { n: act.length, skip: jobs.length - act.length }), { kullanilan: act.length, atlanan: jobs.length - act.length });
    go(4);
  };

  return (
    <div>
      <ScreenTitle no={3} title={t("v1ui.s3.title")}>
        <Button onClick={loadSample} data-testid="load-sample-job">
          <FileUp className="h-3.5 w-3.5" /> {t("v1ui.sample")}
        </Button>
      </ScreenTitle>
      <div className="mb-3">
        <Collapsible title={t("v1ui.s3.help.title")}>
          <ul className="list-inside list-disc space-y-0.5">
            <li>{rt("v1ui.s3.help.1")}</li>
            <li>{t("v1ui.s3.help.2")}</li>
            <li>{t("v1ui.s3.help.3")}</li>
          </ul>
        </Collapsible>
      </div>

      {miss.length > 0 && (
        <div className="mb-3">
          <InfoCard tone="error" title={t("v1ui.fileErr")}>
            {t("v1ui.fatal.missing", { cols: miss.join(", ") })}
          </InfoCard>
        </div>
      )}

      {jobs.length === 0 ? (
        <FileDrop onText={onText} label={t("v1ui.s3.drop")} />
      ) : (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-6">
            <Stat label={t("v1ui.s3.stat.jobs")} value={act.length} sub={t("v1ui.s3.stat.rowsTotal", { n: jobs.length })} />
            <Stat label={t("v1ui.s3.stat.interviews")} value={stats.gorusme} />
            <Stat label={t("v1ui.stat.ilCount")} value={stats.perIl.length} />
            <Stat label={t("v1ui.s3.stat.ruralUrban")} value={`${stats.kir} / ${act.length - stats.kir}`} sub={act.length ? t("v1ui.s3.stat.ruralPct", { p: Math.round((stats.kir / act.length) * 100) }) : ""} />
            <Stat label={t("v1ui.s3.stat.loadCap", { unit: unitLbl })} value={`${round1(stats.load)} / ${round1(stats.cap)}`} tone={gap > 0 ? "red" : "green"} />
            <Stat label={t("v1ui.s3.stat.fill")} value={stats.cap > 0 ? `%${Math.round((stats.load / stats.cap) * 100)}` : "—"} tone={gap > 0 ? "red" : undefined} />
          </div>

          <div className="mb-3 grid gap-3 lg:grid-cols-2">
            <Card title={t("v1ui.s3.cross.title")}>
              <div className="space-y-1.5">
                {gap > 0 ? (
                  <InfoCard tone="error">
                    {rt("v1ui.s3.cross.over", { gap: round1(gap), unit: unitLbl })}
                  </InfoCard>
                ) : (
                  <InfoCard tone="ok">{t("v1ui.s3.cross.fits")}</InfoCard>
                )}
                {ilGaps.length > 0 && (
                  <InfoCard tone="warn" title={t("v1ui.s3.cross.ilGap")}>
                    {ilGaps.map((x) => `${x.il}: ${round1(x.gap)}`).join(" · ")}
                  </InfoCard>
                )}
                {noStaffIl.length > 0 && (
                  <InfoCard tone="error" title={t("v1ui.s3.cross.noStaff")}>
                    {t("v1ui.s3.cross.noStaffBody", { ils: noStaffIl.map((x) => x.il).join(", ") })}
                  </InfoCard>
                )}
                {stats.badPrev.length > 0 && (
                  <InfoCard tone="warn" title={t("v1ui.s3.cross.badPrev")}>
                    {t("v1ui.s3.cross.badPrevBody", { n: stats.badPrev.length, ids: [...new Set(stats.badPrev.map((j) => j.onceki_ay_gorusen_calisan_id))].join(", ") })}
                  </InfoCard>
                )}
              </div>
            </Card>
            <Card title={t("v1ui.s3.err.title", { n: badRows.length })}>
              {badRows.length === 0 ? (
                <Badge tone="green">{t("v1ui.s3.err.none")}</Badge>
              ) : (
                <div className="max-h-40 overflow-auto">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="text-left text-slate-500">
                        <th className="pr-2">{t("v1ui.s3.err.row")}</th>
                        <th className="pr-2">{t("v1ui.s3.err.col")}</th>
                        <th>{t("v1ui.s3.err.reason")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {badRows.flatMap((r) =>
                        r.errors.map((e, i) => (
                          <tr key={`${r.rowNo}-${i}`} className="border-t border-slate-100" data-testid="error-row">
                            <td className="pr-2 tabular-nums">{r.rowNo}</td>
                            <td className="pr-2 font-mono">{e.col}</td>
                            <td className="text-red-800">{e.msg}</td>
                          </tr>
                        )),
                      )}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={() => patchJobs((rs) => rs.map((r) => (r.errors.length ? { ...r, included: false } : r)))}>
                  {t("v1ui.s3.err.skip")}
                </Button>
                <Button size="sm" onClick={() => setJobs([], { name: "", total: 0, errorRows: 0, at: "" })}>
                  {t("v1ui.s3.err.remove")}
                </Button>
              </div>
            </Card>
          </div>

          <DataTable sheetName={jobFile?.name ?? "isler.csv"} columns={cols} rows={rows} onToggle={toggle} onToggleAll={toggleAll} height={380} />
        </>
      )}

      <div className="mt-3 flex items-center justify-between">
        <Button onClick={() => go(2)}>{t("v1ui.s3.toRules")}</Button>
        <div className="flex items-center gap-2">
          {jobsConfirmed && <Badge tone="green">{t("v1ui.confirmed")}</Badge>}
          <Button variant="primary" disabled={act.length === 0} onClick={next} data-testid="jobs-next">
            {t("v1ui.s3.nextBtn")} <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
