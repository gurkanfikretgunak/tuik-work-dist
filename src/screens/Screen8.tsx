"use client";
import { Clipboard, Download, Mail, Printer } from "lucide-react";
import { useMemo, useState } from "react";
import { enumLabel, fmtDate, useT } from "@/i18n";
import { useConfirm } from "@/components/confirm";
import { Badge, Button, Card, Collapsible, Field, InfoCard, ScreenTitle, Stat, inputCls } from "@/components/ui";
import { toCsv } from "@/lib/csv";
import { pct, reportCsvs, reportHtml, ruleJson, summaryText } from "@/lib/outputs";
import { uyariText } from "@/lib/engine";
import { buildReport } from "@/lib/report";
import { JOB_ALL_COLS, RESULT_COLS_EXTRA, SHARE_COLS, download, employeeShareCsv, employeeZipFiles, fillTemplate, ilShareCsv, resultRows, unassignedRows, zipBlob } from "@/lib/share";
import { activeEmployees, activeJobs, useStore } from "@/lib/store";

const TPL_KEYS = ["calisan", "il", "yonetici"] as const;
type TplKey = (typeof TPL_KEYS)[number];

export default function Screen8() {
  const confirm = useConfirm();
  const { t: tr, rt, lang } = useT();
  const { employees, jobs, rules, result, events, empFile, jobFile, log, go } = useStore();
  const emps = useMemo(() => activeEmployees(employees), [employees]);
  const js = useMemo(() => activeJobs(jobs), [jobs]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- lang: çevrilmiş etiketler dile bağlı
  const rep = useMemo(() => (result ? buildReport({ employees, jobs, rules, result, events, empFile, jobFile }) : null), [employees, jobs, rules, result, events, empFile, jobFile, lang]);

  const [empSel, setEmpSel] = useState("");
  const [tplKey, setTplKey] = useState<TplKey>("calisan");
  const [subjectEdit, setSubjectEdit] = useState<string | null>(null);
  const [bodyEdit, setBodyEdit] = useState<string | null>(null);
  const subject = subjectEdit ?? tr(`v1core.tpl.${tplKey}.subject`);
  const body = bodyEdit ?? tr(`v1core.tpl.${tplKey}.body`);
  const [recipient, setRecipient] = useState("");
  const [deadline, setDeadline] = useState("");
  const [copied, setCopied] = useState("");

  if (!result || !rep)
    return (
      <div>
        <ScreenTitle no={8} title={tr("v1core.s8.title")} />
        <InfoCard tone="warn">{tr("v1core.s8.needResult")}</InfoCard>
      </div>
    );
  const A = result.assignments;
  const t = rep.totals;
  const working = emps.filter((e) => A.some((a) => a.empId === e.calisan_id));
  const iller = rep.perIl.filter((p) => p.atanan > 0).map((p) => p.il);
  const selEmp = working.find((e) => e.calisan_id === (empSel || working[0]?.calisan_id));
  const selCsv = selEmp ? employeeShareCsv(selEmp.calisan_id, js, A) : "";
  const selJobs = selEmp ? js.filter((j) => A.some((a) => a.jobId === j.is_id && a.empId === selEmp.calisan_id)) : [];

  const warnList: string[] = [];
  if (t.atanamayan) warnList.push(tr("v1core.sum.unassigned", { n: t.atanamayan }));
  rep.perEmp.filter((p) => p.doluluk >= 0.95).forEach((p) => warnList.push(tr("v1core.s8.warnFull", { name: p.ad, p: pct(p.doluluk), kind: tr(p.doluluk > 1 ? "v1core.s8.overCap" : "v1core.s8.veryFull") })));
  rep.perEmp.filter((p) => p.kapasite > 0 && p.doluluk < 0.5).forEach((p) => warnList.push(tr("v1core.s8.warnFull", { name: p.ad, p: pct(p.doluluk), kind: tr("v1core.s8.veryEmpty") })));
  A.filter((a) => a.uyari).forEach((a) => warnList.push(`${a.jobId}: ${uyariText(a.uyari)}`));

  const guard = async (what: string, contents: string[]) =>
    confirm({
      title: tr("v1core.s8.guardTitle"),
      body: (
        <>
          <p className="font-medium">{what}</p>
          <ul className="my-1 list-inside list-disc">
            {contents.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <p className="text-slate-600">{tr("v1core.s8.guardNote")}</p>
        </>
      ),
      confirmLabel: tr("c.download"),
    });

  const dlEmployeeZip = async () => {
    const files = employeeZipFiles(emps, js, A);
    if (!(await guard(tr("v1core.s8.g1", { n: Object.keys(files).length }), [tr("v1core.s8.g1a"), tr("v1core.s8.g1b"), tr("v1core.s8.g1c")]))) return;
    download("calisan_is_listeleri.zip", await zipBlob(files), "application/zip");
    log("indirme", tr("v1core.s8.log1", { n: Object.keys(files).length }));
  };
  const dlOne = async () => {
    if (!selEmp) return;
    if (!(await guard(`${selEmp.calisan_id}_is_listesi.csv`, [tr("v1core.s8.g2a", { n: selJobs.length, name: selEmp.ad_soyad }), tr("v1core.s8.g2b")]))) return;
    download(`${selEmp.calisan_id}_is_listesi.csv`, selCsv, "text/csv;charset=utf-8");
    log("indirme", tr("v1core.s8.log2", { id: selEmp.calisan_id }));
  };
  const dlIlZip = async () => {
    const files: Record<string, string> = {};
    for (const il of iller) {
      files[`${il}_is_listesi.csv`] = ilShareCsv(il, js, A, emps);
      const p = rep.perIl.find((x) => x.il === il)!;
      files[`${il}_ozet.txt`] = tr("v1core.s8.ilSummary", { il, total: p.toplam, assigned: p.atanan, emps: p.calisan, cap: p.kapasite, fill: pct(p.doluluk) });
    }
    if (!(await guard(tr("v1core.s8.g3", { n: iller.length }), [tr("v1core.s8.g3a"), tr("v1core.s8.g3b")]))) return;
    download("il_paketleri.zip", await zipBlob(files), "application/zip");
    log("indirme", tr("v1core.s8.log3", { n: iller.length }));
  };
  const dlAll = async () => {
    const files: Record<string, string> = {
      "atama_sonucu.csv": toCsv(resultRows(js, A, emps), [...JOB_ALL_COLS, ...RESULT_COLS_EXTRA]),
      "kural_ozeti.json": ruleJson(employees, rules),
      "surec_raporu.html": reportHtml(rep, events),
      "surec_raporu.json": JSON.stringify({ rapor: rep, olaylar: events }, null, 2),
      ...reportCsvs(rep),
    };
    if (t.atanamayan) files["atanamayan_isler.csv"] = toCsv(unassignedRows(js, A), [...JOB_ALL_COLS, "sebep"]);
    if (!(await guard(tr("v1core.s8.g4"), [tr("v1core.s8.g4a"), tr("v1core.s8.g4b"), tr("v1core.s8.g4c")]))) return;
    download("tum_ciktilar.zip", await zipBlob(files), "application/zip");
    log("indirme", tr("v1core.s8.log4"));
  };
  const dlRuleSet = async () => {
    if (!(await guard(tr("v1core.s8.g5"), [tr("v1core.s8.g5a"), tr("v1core.s8.g5b")]))) return;
    download("kural_kapasite_seti.json", ruleJson(employees, rules), "application/json");
    log("indirme", tr("v1core.s8.log5"));
  };
  const dlSummaryPdf = async () => {
    if (await confirm({ title: tr("v1core.s8.printTitle"), body: tr("v1core.s8.printBody"), confirmLabel: tr("v1core.s8.open") })) setTimeout(() => window.print(), 100);
  };

  const copy = async (text: string, id: string) => {
    const ok = await confirm({ title: tr("v1core.s8.copyTitle"), body: <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-2 text-xs">{text}</pre>, confirmLabel: tr("c.copy") });
    if (!ok) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      await confirm({ title: tr("v1core.s8.copyFailTitle"), body: tr("v1core.s8.copyFailBody"), infoOnly: true, confirmLabel: tr("c.ok") });
    }
  };

  // şablon değerleri
  const rcpt = tplKey === "calisan" ? working.find((e) => e.calisan_id === (recipient || working[0]?.calisan_id)) : undefined;
  const rcptIl = tplKey === "il" ? recipient || iller[0] : rcpt?.il;
  const vars = {
    ad_soyad: rcpt?.ad_soyad ?? "",
    is_sayisi: tplKey === "calisan" ? A.filter((a) => a.empId === rcpt?.calisan_id).length : A.filter((a) => a.empId && js.find((j) => j.is_id === a.jobId)?.il === rcptIl).length,
    il: rcptIl ?? "",
    son_tarih: deadline ? fmtDate(deadline) : "{son_tarih}",
    ozet: summaryText(rep),
  };
  const filledBody = fillTemplate(body, vars);
  const filledSubject = fillTemplate(subject, vars);
  const mailto = `mailto:?subject=${encodeURIComponent(filledSubject)}&body=${encodeURIComponent(filledBody)}`;

  const pickTpl = (k: TplKey) => {
    setTplKey(k);
    setSubjectEdit(null);
    setBodyEdit(null);
    setRecipient("");
  };

  return (
    <div>
      <ScreenTitle no={8} title={tr("v1core.s8.title")}>
        <Button variant="primary" onClick={dlAll} data-testid="dl-zip-all">
          <Download className="h-3.5 w-3.5" /> {tr("v1core.s8.dlAllZip")}
        </Button>
      </ScreenTitle>

      <div className="no-print mb-3 space-y-2">
        <Collapsible title={tr("v1core.s8.howTitle")}>
          {rt("v1core.s8.howBody", { code: <code>mailto:</code> })}
        </Collapsible>
        <InfoCard tone="warn" title={tr("v1core.s8.kvkkTitle")}>
          {tr("v1core.s8.kvkkBody")}
        </InfoCard>
      </div>

      <Card title={tr("v1core.s8.cardA")} right={<>
        <Button size="sm" onClick={dlSummaryPdf}>
          <Printer className="h-3.5 w-3.5" /> {tr("v1core.s8.printPdf")}
        </Button>
        <Button size="sm" onClick={() => copy(summaryText(rep), "ozet")} data-testid="copy-summary">
          <Clipboard className="h-3.5 w-3.5" /> {tr(copied === "ozet" ? "v1core.s8.copied" : "v1core.s8.copyText")}
        </Button>
      </>} className="print-page mb-3">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
          <Stat label={tr("v1core.l.totalJobs")} value={t.toplamIs} />
          <Stat label={tr("v1core.l.assigned")} value={t.atanan} tone="green" />
          <Stat label={tr("v1core.l.unassigned")} value={t.atanamayan} tone={t.atanamayan ? "red" : "green"} />
          <Stat label={tr("v1core.l.employees")} value={t.calisan} />
          <Stat label={tr("v1core.s7.avgFillShort")} value={pct(rep.fill.avg)} />
          <Stat label={tr("v1core.l.province")} value={t.il} />
        </div>
        <div className="mt-3">
          <div className="mb-1 text-xs font-semibold text-slate-600">{tr("v1core.s8.attention")}</div>
          {warnList.length === 0 ? <Badge tone="green">{tr("v1core.sum.noFlags")}</Badge> : <ul className="list-inside list-disc text-[12.5px] text-amber-900">{warnList.slice(0, 12).map((w, i) => <li key={i}>{w}</li>)}</ul>}
        </div>
      </Card>

      <div className="no-print">
        <h2 className="mb-2 text-sm font-semibold text-[#1F2A44]">{tr("v1core.s8.sectionB")}</h2>
        <div className="grid gap-3 lg:grid-cols-2">
          <Card title={tr("v1core.s8.c1")} right={<Button size="sm" onClick={dlEmployeeZip} data-testid="dl-emp-zip"><Download className="h-3.5 w-3.5" /> ZIP</Button>}>
            <p className="mb-2 text-[12px] text-slate-600">{rt("v1core.s8.c1desc", { code: <code>C-003_is_listesi.csv</code> })}</p>
            <Field label={tr("v1core.l.employee")}>
              <select className={inputCls} value={selEmp?.calisan_id ?? ""} onChange={(e) => setEmpSel(e.target.value)} aria-label={tr("v1core.s8.previewEmp")}>
                {working.map((e) => <option key={e.calisan_id} value={e.calisan_id}>{e.calisan_id} · {e.ad_soyad} ({tr("v1core.s8.nJobs", { n: A.filter((a) => a.empId === e.calisan_id).length })})</option>)}
              </select>
            </Field>
            <div className="mt-2 max-h-44 overflow-auto rounded border border-slate-200">
              <table className="w-full text-[12px]" data-testid="emp-preview">
                <thead className="sticky top-0 bg-slate-50 text-left"><tr>{SHARE_COLS.map((c) => <th key={c} className="px-1.5 py-1">{c}</th>)}</tr></thead>
                <tbody>{selJobs.map((j) => <tr key={j.is_id} className="border-t border-slate-100">{SHARE_COLS.map((c) => <td key={c} className="px-1.5 py-0.5 whitespace-nowrap">{c === "yerlesim_tipi" || c === "oncelik" ? enumLabel(String(j[c])) : String(j[c])}</td>)}</tr>)}</tbody>
              </table>
            </div>
            <div className="mt-2 flex gap-2">
              <Button size="sm" onClick={dlOne}><Download className="h-3.5 w-3.5" /> {tr("v1core.s8.thisCsv")}</Button>
              <Button size="sm" onClick={async () => { if (await confirm({ title: tr("v1core.s8.listPrintTitle"), body: tr("v1core.s8.listPrintBody"), confirmLabel: tr("v1core.s8.print") })) setTimeout(() => window.print(), 100); }}><Printer className="h-3.5 w-3.5" /> {tr("v1core.s8.print")}</Button>
            </div>
          </Card>

          <div className="space-y-3">
            <Card title={tr("v1core.s8.c2")} right={<Button size="sm" onClick={dlIlZip} data-testid="dl-il-zip"><Download className="h-3.5 w-3.5" /> ZIP</Button>}>
              <p className="text-[12px] text-slate-600">{tr("v1core.s8.c2desc", { n: iller.length, list: iller.join(", ") })}</p>
            </Card>
            <Card title={tr("v1core.s8.c4")} right={<Button size="sm" onClick={dlAll}><Download className="h-3.5 w-3.5" /> ZIP</Button>}>
              <p className="text-[12px] text-slate-600">{tr("v1core.s8.c4desc")}</p>
            </Card>
            <Card title={tr("v1core.s8.c5")} right={<Button size="sm" onClick={dlRuleSet}><Download className="h-3.5 w-3.5" /> JSON</Button>}>
              <p className="text-[12px] text-slate-600">{tr("v1core.s8.c5desc")}</p>
            </Card>
          </div>
        </div>

        <Card title={tr("v1core.s8.c3")} className="mt-3">
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="space-y-2">
              <Field label={tr("v1core.s8.template")}>
                <select className={inputCls} value={tplKey} onChange={(e) => pickTpl(e.target.value as TplKey)} aria-label={tr("v1core.s8.template")}>
                  {TPL_KEYS.map((k) => <option key={k} value={k}>{tr(`v1core.tpl.${k}.label`)}</option>)}
                </select>
              </Field>
              {tplKey !== "yonetici" && (
                <Field label={tr(tplKey === "calisan" ? "v1core.s8.rcptEmp" : "v1core.l.province")}>
                  <select className={inputCls} value={recipient} onChange={(e) => setRecipient(e.target.value)} aria-label={tr("v1core.s8.rcpt")}>
                    {tplKey === "calisan" ? working.map((e) => <option key={e.calisan_id} value={e.calisan_id}>{e.ad_soyad}</option>) : iller.map((i) => <option key={i}>{i}</option>)}
                  </select>
                </Field>
              )}
              <Field label={tr("v1core.s8.deadline")}>
                <input type="date" className={inputCls} value={deadline} onChange={(e) => setDeadline(e.target.value)} aria-label={tr("v1core.s8.deadline")} />
              </Field>
              <Field label={tr("v1core.s8.subjectEditable")}><input className={inputCls} value={subject} onChange={(e) => setSubjectEdit(e.target.value)} aria-label={tr("v1core.s8.subject")} /></Field>
              <Field label={tr("v1core.s8.bodyEditable")} hint={tr("v1core.s8.placeholders")}>
                <textarea className={`${inputCls} h-36 py-1`} value={body} onChange={(e) => setBodyEdit(e.target.value)} aria-label={tr("v1core.s8.body")} />
              </Field>
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold text-slate-600">{tr("v1core.s8.preview")}</div>
              <div className="rounded border border-slate-200 bg-slate-50 p-3 text-[12.5px]" data-testid="mail-preview">
                <div className="mb-1 font-semibold">{filledSubject}</div>
                <pre className="whitespace-pre-wrap font-sans">{filledBody}</pre>
              </div>
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={() => copy(`${filledSubject}\n\n${filledBody}`, "mesaj")} data-testid="copy-msg"><Clipboard className="h-3.5 w-3.5" /> {tr(copied === "mesaj" ? "v1core.s8.copied" : "v1core.s8.copyClip")}</Button>
                <Button size="sm" onClick={async () => { if (await confirm({ title: tr("v1core.s8.mailTitle"), body: tr("v1core.s8.mailBody"), confirmLabel: tr("v1core.s8.open") })) window.location.href = mailto; }} data-testid="mailto"><Mail className="h-3.5 w-3.5" /> {tr("v1core.s8.openMail")}</Button>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="no-print mt-3 flex items-center justify-between">
        <Button onClick={() => go(7)}>{tr("v1core.s8.backReport")}</Button>
        <div className="flex gap-2">
          <Button onClick={() => go(0)}>{tr("v1core.s8.toStart")}</Button>
          <Button onClick={async () => { if (await confirm({ title: tr("v1core.s7.newTitle"), body: tr("v1core.s8.newBody"), confirmLabel: tr("v1core.new"), tone: "danger" })) { useStore.getState().reset(); go(1); } }}>{tr("v1core.new")}</Button>
        </div>
      </div>
    </div>
  );
}
