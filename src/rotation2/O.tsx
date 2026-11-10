"use client";
import { CheckCircle2, Download, Eye, EyeOff, Printer } from "lucide-react";
import Papa from "papaparse";
import { useRef, useState } from "react";
import { useConfirm } from "@/components/confirm";
import { Button, Card, InfoCard, ScreenTitle, Stat } from "@/components/ui";
import { absenceOf } from "./absence";
import { buildReportHtml } from "./report";
import { useT } from "@/i18n";
import { download, zipBlob } from "@/lib/share";
import { weeklyOf, type Tier } from "./model";
import { useRot2 } from "./store";
import { rulesOfState } from "./rules";
import { REGION_TOL, validate2 } from "./validator";

const csv = (fields: string[], data: (string | number)[][]) => "﻿" + Papa.unparse({ fields, data });

export default function O() {
  const confirm = useConfirm();
  const { t } = useT();
  const s = useRot2();
  const { plans, result, people } = s;
  const [pick, setPick] = useState({ plan: true, dogrulama: true, param: true, bolge: true, rapor: true });
  const [showRep, setShowRep] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  if (!plans || !result) return (<div><ScreenTitle no={3} title={t("v4.o.title")} /><InfoCard tone="warn">{t("v2ui.needPlan")}</InfoCard></div>);

  const rules = rulesOfState(s);
  const v = validate2(plans, rules);
  const label = (mi: number) => { const i = s.startMonth - 1 + mi; return { yil: s.year + Math.floor(i / 12), ay: (i % 12) + 1 }; };

  const reportHtml = () => buildReportHtml(useRot2.getState(), v, absenceOf(s), rules.pairLimit);
  const printReport = () => { setShowRep(true); setTimeout(() => { frame.current?.contentWindow?.focus(); frame.current?.contentWindow?.print(); }, 350); };

  const files = () => {
    const f: Record<string, string> = {};
    if (pick.plan)
      f["defter_plani_2.csv"] = csv(["yil", "ay", "calisan_id", "katman", "defter_kodu", "bolge_kodu", "haftalik"],
        (["inside", "outside"] as Tier[]).flatMap((tier) => plans[tier].flatMap((row, mi) => row.map((p, d) => {
          const nb = s[tier][d]; const l = label(mi);
          return [l.yil, l.ay, p >= 0 ? people[p].id : "", tier === "inside" ? "sehir_ici" : "sehir_disi", nb.code, nb.region >= 0 ? s.regions[nb.region].code : "", nb.weekly ? "evet" : "hayir"];
        }))));
    if (pick.bolge)
      f["bolge_dengesi.csv"] = csv(["calisan_id", ...s.regions.map((r) => r.code), "toplam", ...s.regions.map((r) => `hedef_${r.code}`)],
        people.map((p, i) => [p.id, ...v.region.counts[i], v.region.total[i], ...v.region.expected[i].map((x) => Math.round(x * 100) / 100)]));
    if (pick.dogrulama)
      f["dogrulama_raporu_2.json"] = JSON.stringify({
        zorunluKurallarGecti: v.ok,
        sehirIci: { aylikHatalar: v.inside.monthlyErrors, K1ihlal: v.inside.k1.length, K2enCok: v.inside.maxPair, K2sinir: rules.pairLimit.inside, K3sapma: v.inside.k3.length, K6ihlal: v.inside.k6.length },
        sehirDisi: { aylikHatalar: v.outside.monthlyErrors, K1ihlal: v.outside.k1.length, K2enCok: v.outside.maxPair, K2sinir: rules.pairLimit.outside, K3sapma: v.outside.k3.length, K6ihlal: v.outside.k6.length },
        bolgeDengesi: { enBuyukSapma: Math.round(v.region.maxDev * 100) / 100, tolerans: REGION_TOL, tolerandaMi: v.regionOk },
        elleTakasSayisi: s.swaps.length,
        gevsetilenKurallar: { sehirIci: result.inside.relaxed, sehirDisi: result.outside.relaxed }, olaylar: s.log,
      }, null, 2);
    if (pick.rapor) f["rapor_2.html"] = reportHtml();
    if (pick.param)
      f["parametreler_2.json"] = JSON.stringify({
        n: s.n, m: s.m, yil: s.year, baslangicAyi: s.startMonth, g: s.g, haftalikArasiAy: s.specialGap, tohum: s.seed,
        secilenAday: s.picked, izinler: s.leaves.filter((l) => l.included), izinEsigi: s.leaveThreshold, elleTakaslar: s.swaps, personel: people, bolgeler: s.regions,
        sehirIciDefterler: s.inside, sehirDisiDefterler: s.outside,
        haftalikSehirIci: weeklyOf(s.inside).map((i) => s.inside[i].code), haftalikSehirDisi: weeklyOf(s.outside).map((i) => s.outside[i].code),
      }, null, 2);
    return f;
  };

  const approve = async () => {
    const ok = await confirm({
      title: t("v2ui.r4.approve.title"),
      body: v.ok ? t("v2ui.r4.approve.ok") : <b className="text-[#C92830]">{t("v2ui.r4.approve.warn")}</b>,
      confirmLabel: t("c.confirm"), tone: v.ok ? "primary" : "danger",
    });
    if (!ok) return;
    useRot2.setState({ approved: true });
    s.addLog(t("v2ui.r4.approve.log", { r: v.ok ? t("v2ui.badge.pass") : t("v2ui.badge.fail"), n: s.swaps.length }));
  };

  const dl = async (zip: boolean) => {
    const f = files();
    const names = Object.keys(f);
    if (!names.length) return;
    const ok = await confirm({ title: zip ? t("v2ui.r4.dl.zip") : t("v2ui.r4.dl.files"), body: <><ul className="list-inside list-disc">{names.map((n) => <li key={n} className="font-mono">{n}</li>)}</ul><p className="mt-1 text-slate-600">{t("v2ui.r4.dl.note")}</p></>, confirmLabel: t("c.download") });
    if (!ok) return;
    if (zip) download(`defter_plani_2_${s.year}.zip`, await zipBlob(f), "application/zip");
    else for (const [n, c] of Object.entries(f)) download(n, c, n.endsWith(".json") ? "application/json" : "text/csv;charset=utf-8");
    s.addLog(t("v2ui.r4.dl.log", { names: names.join(", ") }));
  };

  const chk = (k: keyof typeof pick, l: string) => (
    <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" disabled={!s.approved} checked={pick[k]} onChange={(e) => setPick({ ...pick, [k]: e.target.checked })} /><span className="font-mono">{l}</span></label>
  );

  return (
    <div>
      <ScreenTitle no={3} title={t("v4.o.title")} />
      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label={t("v2ui.r4.stat.people")} value={s.n} />
        <Stat label={t("v2ui.r4.stat.months")} value={s.m} />
        <Stat label={t("v2ui.rules")} value={v.ok ? t("v2ui.pass") : t("v2ui.fail")} tone={v.ok ? "green" : "red"} />
        <Stat label={t("v4.r.stat.region")} value={v.region.maxDev.toFixed(2)} tone={v.regionOk ? "green" : "amber"} />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Card title={t("v2ui.r4.card.approve")}>
          {s.approved ? <InfoCard tone="ok"><span className="flex items-center gap-1 font-medium"><CheckCircle2 className="h-4 w-4" /> {t("v2ui.r4.approved")}</span></InfoCard> : <Button variant="primary" onClick={approve} data-testid="v4-approve"><CheckCircle2 className="h-3.5 w-3.5" /> {t("v2ui.r4.approve.btn")}</Button>}
        </Card>
        <Card title={t("v2ui.r4.card.files")}>
          <div className="space-y-1.5">{chk("plan", "defter_plani_2.csv")}{chk("bolge", "bolge_dengesi.csv")}{chk("dogrulama", "dogrulama_raporu_2.json")}{chk("param", "parametreler_2.json")}{chk("rapor", "rapor_2.html")}</div>
          <div className="mt-3 flex gap-2">
            <Button variant="primary" disabled={!s.approved} onClick={() => dl(false)} data-testid="v4-download"><Download className="h-3.5 w-3.5" /> {t("v2ui.r4.dl.selected")}</Button>
            <Button disabled={!s.approved} onClick={() => dl(true)} data-testid="v4-zip"><Download className="h-3.5 w-3.5" /> ZIP</Button>
          </div>
        </Card>
      </div>
      <Card title={t("v4.rep.card")} className="mt-3" right={
        <div className="flex gap-1.5">
          <Button size="sm" onClick={() => setShowRep(!showRep)} data-testid="v4-rep-view">{showRep ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />} {showRep ? t("v4.rep.hide") : t("v4.rep.view")}</Button>
          <Button size="sm" onClick={printReport} data-testid="v4-rep-print"><Printer className="h-3.5 w-3.5" /> {t("v4.rep.print")}</Button>
          <Button size="sm" variant="primary" disabled={!s.approved} onClick={async () => { const html = reportHtml(); if (await confirm({ title: t("v4.rep.html"), body: <><span className="font-mono">rapor_2.html</span><p className="mt-1 text-slate-600">{t("v2ui.r4.dl.note")}</p></>, confirmLabel: t("c.download") })) { download("rapor_2.html", html, "text/html;charset=utf-8"); s.addLog(t("v2ui.r4.dl.log", { names: "rapor_2.html" })); } }} data-testid="v4-rep-html"><Download className="h-3.5 w-3.5" /> {t("v4.rep.html")}</Button>
        </div>}>
        <div className="text-[12px] text-slate-600">{t("v4.rep.hint")}</div>
        {showRep && <iframe ref={frame} title={t("v4.rep.card")} srcDoc={reportHtml()} className="mt-2 h-[560px] w-full rounded border border-slate-300 bg-white" data-testid="v4-rep-frame" />}
      </Card>
      <div className="mt-3 flex items-center justify-between">
        <Button onClick={() => s.go(2)}>{t("v2ui.r4.back")}</Button>
        <Button onClick={async () => { if (await confirm({ title: t("v2ui.r4.new.title"), body: t("v2ui.r4.new.body"), confirmLabel: t("v2ui.r4.new.btn"), tone: "danger" })) s.reset(); }}>{t("v2ui.r4.new.btn")}</Button>
      </div>
    </div>
  );
}
