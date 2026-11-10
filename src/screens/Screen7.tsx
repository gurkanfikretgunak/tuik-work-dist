"use client";
import { ArrowRight, Download, Printer } from "lucide-react";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtTime, useT } from "@/i18n";
import { useConfirm } from "@/components/confirm";
import { Badge, Button, Card, Collapsible, InfoCard, ScreenTitle, Stat } from "@/components/ui";
import { pct, reportCsvs, reportHtml } from "@/lib/outputs";
import { reasonText } from "@/lib/engine";
import { buildReport } from "@/lib/report";
import { download } from "@/lib/share";
import { useStore } from "@/lib/store";
import { RULE_META } from "@/lib/types";

const T = ({ head, rows }: { head: string[]; rows: (string | number)[][] }) => (
  <div className="overflow-auto">
    <table className="w-full text-[12.5px]">
      <thead className="bg-slate-50 text-left text-slate-600">
        <tr>
          {head.map((h) => (
            <th key={h} className="border-b border-slate-200 px-2 py-1 font-semibold">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-slate-100">
            {r.map((c, j) => (
              <td key={j} className="px-2 py-1 tabular-nums">
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default function Screen7() {
  const confirm = useConfirm();
  const { t: tr, rt, lang } = useT();
  const { employees, jobs, rules, result, events, empFile, jobFile, go, log, approved } = useStore();
  const rep = useMemo(
    () => (result ? buildReport({ employees, jobs, rules, result, events, empFile, jobFile }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- lang: çevrilmiş etiketler dile bağlı
    [employees, jobs, rules, result, events, empFile, jobFile, lang],
  );

  if (!rep || !result)
    return (
      <div>
        <ScreenTitle no={7} title={tr("v1core.s7.title")} />
        <InfoCard tone="warn">{tr("v1core.s7.needResult")}</InfoCard>
      </div>
    );

  const exp = async (label: string, fn: () => void) => {
    const ok = await confirm({ title: tr("v1core.s7.dlTitle", { label }), body: tr("v1core.s7.dlBody"), confirmLabel: tr("c.download") });
    if (!ok) return;
    fn();
    log("indirme", tr("v1core.s7.dlLog", { label }));
  };
  const printPdf = async () => {
    const ok = await confirm({ title: tr("v1core.s7.pdfTitle"), body: tr("v1core.s7.pdfBody"), confirmLabel: tr("v1core.s7.pdfConfirm") });
    if (ok) setTimeout(() => window.print(), 100);
  };

  const t = rep.totals;
  const chartEmp = rep.perEmp.filter((p) => p.kapasite > 0).map((p) => ({ ad: p.id, doluluk: Math.round(p.doluluk * 100) }));
  const chartIl = rep.perIl.map((p) => ({ il: p.il, doluluk: Math.round(p.doluluk * 100) }));
  const csvs = reportCsvs(rep);
  const hhmm = (s: string) => fmtTime(s);

  return (
    <div>
      <ScreenTitle no={7} title={tr("v1core.s7.title")}>
        <Button onClick={printPdf} data-testid="print-pdf">
          <Printer className="h-3.5 w-3.5" /> PDF
        </Button>
        <Button onClick={() => exp(tr("v1core.s7.reportHtml"), () => download("surec_raporu.html", reportHtml(rep, events), "text/html;charset=utf-8"))} data-testid="dl-html">
          <Download className="h-3.5 w-3.5" /> HTML
        </Button>
        <Button onClick={() => exp(tr("v1core.s7.reportJson"), () => download("surec_raporu.json", JSON.stringify({ rapor: rep, olaylar: events }, null, 2), "application/json"))}>
          <Download className="h-3.5 w-3.5" /> JSON
        </Button>
        <Button variant="primary" onClick={() => go(8)} data-testid="to-summary">
          {tr("v1core.s7.toSummary")} <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </ScreenTitle>

      <div className="no-print mb-3">
        <Collapsible title={tr("v1core.s7.howTitle")}>
          {rt("v1core.s7.howBody")}
        </Collapsible>
      </div>

      {!approved && (
        <div className="mb-3">
          <InfoCard tone="warn">{tr("v1core.s7.notApproved")}</InfoCard>
        </div>
      )}

      <div className="space-y-3" id="rapor">
        <Card title={tr("v1core.s7.c1")} className="print-page">
          <ol className="space-y-1 text-[12.5px]" data-testid="timeline">
            {events.map((e) => (
              <li key={e.id} className="flex gap-3 border-b border-slate-100 pb-1">
                <span className="w-16 shrink-0 tabular-nums text-slate-500">{hhmm(e.ts)}</span>
                <span>{e.message}</span>
              </li>
            ))}
          </ol>
        </Card>

        <div className="grid gap-3 lg:grid-cols-2">
          <Card title={tr("v1core.s7.c2")} className="print-page">
            <T
              head={[tr("v1core.s7.file"), tr("v1core.s7.rows"), tr("v1core.s7.badSkipped")]}
              rows={[
                [rep.files.emp?.name ?? "—", rep.files.emp?.total ?? 0, tr("v1core.s7.badOut", { bad: rep.files.emp?.errorRows ?? 0, out: employees.filter((r) => !r.included).length })],
                [rep.files.job?.name ?? "—", rep.files.job?.total ?? 0, tr("v1core.s7.badOut", { bad: rep.files.job?.errorRows ?? 0, out: jobs.filter((r) => !r.included).length })],
              ]}
            />
            {jobs.some((r) => r.errors.length) && (
              <ul className="mt-2 max-h-24 list-inside list-disc overflow-auto text-[12px] text-red-800">
                {jobs.filter((r) => r.errors.length).map((r) => (
                  <li key={r.rowNo}>
                    {tr("v1core.s7.rowNo", { n: r.rowNo })}: {r.errors.map((e) => `${e.col} ${e.msg}`).join("; ")}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title={tr("v1core.s7.c3")} className="print-page">
            <ul className="space-y-1 text-[12.5px]">
              {rules.rules.filter((r) => r.enabled).map((r, i) => (
                <li key={r.id} className="flex items-center gap-2">
                  <span className="w-4 text-slate-500">{i + 1}</span>
                  <Badge tone={r.mandatory ? "red" : "blue"}>{tr(r.mandatory ? "v1core.mand" : "v1core.pref")}</Badge> {RULE_META[r.id].label}
                </li>
              ))}
            </ul>
            <div className="mt-2 text-[12.5px] text-slate-700">
              {rt("v1core.s7.modeLine", { mode: tr(rules.kapasiteModu === "sert" ? "v1core.mode.sert" : "v1core.mode.orantili"), unit: tr(`v1core.unit.${rules.kapasiteBirimi}`), mult: rules.kirCarpan, cap: t.efektifKapasite })}
            </div>
          </Card>
        </div>

        <Card title={tr("v1core.s7.c4")} className="print-page">
          <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-6">
            <Stat label={tr("v1core.l.totalJobs")} value={t.toplamIs} />
            <Stat label={tr("v1core.l.assigned")} value={t.atanan} sub={pct(t.toplamIs ? t.atanan / t.toplamIs : 0)} tone="green" />
            <Stat label={tr("v1core.l.unassigned")} value={t.atanamayan} sub={pct(t.toplamIs ? t.atanamayan / t.toplamIs : 0)} tone={t.atanamayan ? "red" : "green"} />
            <Stat label={tr("v1core.s7.avgFillShort")} value={pct(rep.fill.avg)} />
            <Stat label={tr("v1core.s7.minMax")} value={`${pct(rep.fill.min)} / ${pct(rep.fill.max)}`} />
            <Stat label={tr("v1core.s7.stdDev")} value={tr("v1core.s7.pts", { n: (rep.fill.sd * 100).toFixed(1) })} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="mb-1 text-xs font-semibold text-slate-600">{tr("v1core.s7.empFillChart")}</div>
              <div style={{ width: "100%", height: 200 }}>
                <ResponsiveContainer>
                  <BarChart data={chartEmp}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="ad" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} domain={[0, 110]} />
                    <Tooltip />
                    <ReferenceLine y={100} stroke="#C92830" strokeDasharray="4 2" />
                    <Bar dataKey="doluluk" fill="#1F2A44" isAnimationActive={false}>
                      {chartEmp.map((c, i) => (
                        <Cell key={i} fill={c.doluluk > 100 ? "#C92830" : "#1F2A44"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold text-slate-600">{tr("v1core.s7.ilFillChart")}</div>
              <div style={{ width: "100%", height: 200 }}>
                <ResponsiveContainer>
                  <BarChart data={chartIl}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="il" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} domain={[0, 110]} />
                    <Tooltip />
                    <Bar dataKey="doluluk" fill="#C92830" isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div>
              <div className="mb-1 text-xs font-semibold text-slate-600">{tr("v1core.s7.compTitle")}</div>
              <T head={[tr("v1core.rep.rule"), tr("v1core.rep.compliant"), tr("v1core.rep.total"), tr("v1core.rep.ratio")]} rows={rep.uyum.map((u) => [u.label, u.ok, u.total, u.total ? pct(u.ok / u.total) : "—"])} />
            </div>
            <div className="text-[12.5px] text-slate-700">
              <div className="mb-1 text-xs font-semibold text-slate-600">{tr("v1core.s7.ruralPrev")}</div>
              <p>
                {rt("v1core.s7.ruralLine", { rural: rep.kirKent.kir, urban: rep.kirKent.kent })}
              </p>
              <p>
                {rt("v1core.s7.prevLine", { total: rep.gecenAy.toplam, same: rep.gecenAy.ayni, changed: rep.gecenAy.degisen })}
              </p>
              <p>
                {tr("v1core.s7.durLine", { ms: rep.durationMs, n: rep.redistCount })}
              </p>
            </div>
          </div>
        </Card>

        <Card title={tr("v1core.s7.c5")} className="print-page">
          {rep.sebepler.length === 0 ? (
            <Badge tone="green">{tr("v1core.s5.noUnassigned")}</Badge>
          ) : (
            <T head={[tr("v1core.rep.reason"), tr("v1core.rep.count"), tr("v1core.rep.jobs")]} rows={rep.sebepler.map((s) => [reasonText(s.sebep), s.adet, s.ids.slice(0, 15).join(", ") + (s.ids.length > 15 ? " …" : "")])} />
          )}
        </Card>

        <Card title={tr("v1core.s7.c6", { n: rep.manuel.length })} className="print-page">
          {rep.manuel.length === 0 ? (
            <span className="text-[12.5px] text-slate-600">{tr("v1core.rep.noManual")}</span>
          ) : (
            <>
              <T head={[tr("v1core.rep.time"), tr("v1core.rep.change")]} rows={rep.manuel.map((e) => [hhmm(e.ts), e.message])} />
              <div className="mt-1 text-[12px] text-slate-600">{tr("v1core.s7.manualShare", { p: pct(t.atanan ? t.manuelSayisi / t.atanan : 0) })}</div>
            </>
          )}
        </Card>

        <Card
          title={tr("v1core.s7.c7")}
          className="print-page"
          right={<Button size="sm" onClick={() => exp("calisan_bazli.csv", () => download("calisan_bazli.csv", csvs["calisan_bazli.csv"], "text/csv;charset=utf-8"))}>CSV</Button>}
        >
          <T
            head={[tr("v1core.l.employee"), tr("v1core.l.capacity"), tr("v1core.l.assignedShort"), tr("v1core.l.fill"), tr("v1core.l.ruralJobs"), tr("v1core.l.urbanJobs"), tr("v1core.l.distinctNeigh")]}
            rows={rep.perEmp.map((p) => [`${p.id} · ${p.ad}`, p.kapasite, p.atanan, pct(p.doluluk), p.kir, p.kent, p.mahalle])}
          />
        </Card>

        <Card
          title={tr("v1core.s7.c8")}
          className="print-page"
          right={<Button size="sm" onClick={() => exp("il_bazli.csv", () => download("il_bazli.csv", csvs["il_bazli.csv"], "text/csv;charset=utf-8"))}>CSV</Button>}
        >
          <T head={[tr("v1core.l.province"), tr("v1core.l.totalJobs"), tr("v1core.l.assignedShort"), tr("v1core.l.employees"), tr("v1core.l.capacity"), tr("v1core.l.fill")]} rows={rep.perIl.map((p) => [p.il, p.toplam, p.atanan, p.calisan, p.kapasite, pct(p.doluluk)])} />
        </Card>
      </div>

      <div className="no-print mt-3 flex items-center justify-between">
        <Button onClick={() => go(6)}>{tr("v1core.s7.backApprove")}</Button>
        <Button
          onClick={async () => {
            const ok = await confirm({ title: tr("v1core.s7.newTitle"), body: tr("v1core.s7.newBody"), confirmLabel: tr("v1core.new"), tone: "danger" });
            if (ok) {
              useStore.getState().reset();
              go(1);
            }
          }}
        >
          {tr("v1core.new")}
        </Button>
      </div>
    </div>
  );
}
