"use client";
import { CheckCircle2, Download } from "lucide-react";
import { useState } from "react";
import { useConfirm } from "@/components/confirm";
import { useT } from "@/i18n";
import { Button, Card, Collapsible, InfoCard, ScreenTitle, Stat } from "@/components/ui";
import { download, zipBlob } from "@/lib/share";
import { calcMath } from "./math";
import { absenceOf, rulesOf } from "./params";
import { monthLabel, useRot } from "./store";
import { validatePlan } from "./validator";
import Papa from "papaparse";

const csv = (fields: string[], data: (string | number)[][]) => "﻿" + Papa.unparse({ fields, data });

export default function R4() {
  const confirm = useConfirm();
  const { t } = useT();
  const s = useRot();
  const { plan, people, notebooks, result } = s;
  const [pick, setPick] = useState({ plan: true, izin: true, dogrulama: true, param: true, matris: true });
  if (!plan || !result) return (<div><ScreenTitle no={4} title={t("v2ui.r4.title")} /><InfoCard tone="warn">{t("v2ui.needPlan")}</InfoCard></div>);

  const rules = rulesOf(s);
  const v = validatePlan(plan, rules);
  const x = calcMath(s.n, s.m, s.g);
  const ab = absenceOf(s);

  const files = () => {
    const f: Record<string, string> = {};
    if (pick.plan)
      f["defter_plani.csv"] = csv(["yil", "ay", "calisan_id", "defter_no", "durum"], plan.flatMap((row, mi) => {
        const ml = monthLabel(s.startMonth, mi, s.year);
        return row.map((p, d) => [ml.yil, ml.no, p >= 0 ? people[p].id : "", notebooks[d].no, p < 0 ? "acik" : v.loads[mi][p] > 1 ? "ek atama" : "normal"]);
      }));
    if (pick.izin)
      f["izin_ozeti.csv"] = csv(["ay", "calisan_id", "izin_gun", "ay_gun", "durum"], ab.days.flatMap((row, mi) => row.flatMap((c, p) => (c > 0 ? [[`${monthLabel(s.startMonth, mi, s.year).yil}-${String(monthLabel(s.startMonth, mi, s.year).no).padStart(2, "0")}`, people[p].id, c, ab.dim[mi], ab.absent[mi][p] ? t("v2ui.r4.leave.absent") : t("v2ui.r4.leave.partial")]] : []))));
    if (pick.dogrulama)
      f["dogrulama_raporu.json"] = JSON.stringify({
        zorunluKurallarGecti: v.ok,
        esasDagitimSayisi: { hedefD: v.targets.D, gerceklesen: v.actualD, acikta: v.openCount, kisiBasinaHedef: people.map((p, i) => ({ calisan: p.id, musaitAy: v.targets.a[i], hedef: Math.round(v.targets.Dp[i] * 100) / 100, gerceklesen: v.counts[i].reduce((a, b) => a + b, 0) })) },
        izinler: { esik: s.leaveThreshold, strateji: s.strategy, kayitlar: s.leaves.filter((l) => l.included).map((l) => ({ calisan: l.personId, baslangic: l.start, bitis: l.end, not: l.note })) }, aylikEslestirme: v.monthlyOk, aylikHatalar: v.monthlyErrors,
        K1: { g: s.g, ihlal: v.k1.map((k) => ({ calisan: people[k.person].id, defter: notebooks[k.notebook].no, aylar: k.months.map((a) => a + 1) })) },
        K2: { sinir: rules.pairLimit, enCokTekrar: v.maxPair, asan: v.pairOver.map((o) => ({ kimden: people[o.from].id, kime: people[o.to].id, adet: o.count })) },
        K3: { alt: x.lo, ust: x.hi, sapma: v.k3.map((k) => ({ calisan: people[k.person].id, defter: notebooks[k.notebook].no, adet: k.count })) },
        K6: { ozelDefterler: notebooks.filter((d) => d.special).map((d) => d.no), enAzAyAraligi: s.specialGap, pesPeseIhlal: v.k6.map((k) => ({ calisan: people[k.person].id, aylar: k.months.map((a) => a + 1), defterler: k.notebooks.map((d) => notebooks[d].no) })), kisiBasinaOzelDefter: v.specialCounts },
        K5: s.useGroups ? v.k5 : "kapalı", yasakCiftIhlali: v.forbiddenHits.length,
        gevsetilenKurallar: result.relaxed, elleTakaslar: s.swaps, olaylar: s.log,
      }, null, 2);
    if (pick.param)
      f["parametreler.json"] = JSON.stringify({ n: s.n, m: s.m, yil: s.year, baslangicAyi: s.startMonth, g: s.g, istenenCiftSiniri: rules.pairLimit === result.usedPairLimit ? rules.pairLimit : s.pairOverride ?? x.pairLower, kullanilanCiftSiniri: result.usedPairLimit, tohum: result.candidates[s.picked]?.seed ?? s.seed, ilkTohum: s.seed, personel: people, defterler: notebooks, izinler: s.leaves.filter((l) => l.included), izinEsigi: s.leaveThreshold, acikDefterStratejisi: s.strategy, yasakCiftler: s.forbidden, sabitAtamalar: s.fixed, k5: s.useGroups }, null, 2);
    if (pick.matris) {
      f["sayim_matrisi.csv"] = csv(["calisan_id", ...notebooks.map((d) => `D${d.no}`)], v.counts.map((r, i) => [people[i].id, ...r]));
      f["devir_matrisi.csv"] = csv(["kimden\\kime", ...people.map((p) => p.id)], v.pairCounts.map((r, i) => [people[i].id, ...r]));
    }
    return f;
  };

  const approve = async () => {
    const ok = await confirm({
      title: t("v2ui.r4.approve.title"),
      body: <>{v.ok ? t("v2ui.r4.approve.ok") : <b className="text-[#C92830]">{t("v2ui.r4.approve.warn")}</b>} {t("v2ui.r4.approve.swaps", { n: s.swaps.length })}</>,
      confirmLabel: t("c.confirm"), tone: v.ok ? "primary" : "danger",
    });
    if (!ok) return;
    useRot.setState({ approved: true });
    s.addLog(t("v2ui.r4.approve.log", { r: v.ok ? t("v2ui.badge.pass") : t("v2ui.badge.fail"), n: s.swaps.length }));
  };

  const dl = async (zip: boolean) => {
    const f = files();
    const names = Object.keys(f);
    if (!names.length) return;
    const ok = await confirm({ title: zip ? t("v2ui.r4.dl.zip") : t("v2ui.r4.dl.files"), body: <><ul className="list-inside list-disc">{names.map((n) => <li key={n} className="font-mono">{n}</li>)}</ul><p className="mt-1 text-slate-600">{t("v2ui.r4.dl.note")}</p></>, confirmLabel: t("c.download") });
    if (!ok) return;
    if (zip) download(`defter_plani_${s.year}.zip`, await zipBlob(f), "application/zip");
    else for (const [n, c] of Object.entries(f)) download(n, c, n.endsWith(".json") ? "application/json" : "text/csv;charset=utf-8");
    s.addLog(t("v2ui.r4.dl.log", { names: names.join(", ") }));
  };

  const chk = (k: keyof typeof pick, l: string) => (
    <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" disabled={!s.approved} checked={pick[k]} onChange={(e) => setPick({ ...pick, [k]: e.target.checked })} /><span className="font-mono">{l}</span></label>
  );

  return (
    <div>
      <ScreenTitle no={4} title={t("v2ui.r4.title")} />
      <div className="mb-3"><Collapsible title={t("v2ui.r4.outputs.title")}>{t("v2ui.r4.outputs.body")}</Collapsible></div>
      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-6">
        <Stat label={t("v2ui.r4.stat.people")} value={s.n} />
        <Stat label={t("v2ui.r4.stat.d")} value={`${v.actualD} / ${v.targets.D}`} />
        <Stat label={t("v2ui.r4.stat.months")} value={s.m} />
        <Stat label={t("v2ui.rules")} value={v.ok ? t("v2ui.pass") : t("v2ui.fail")} tone={v.ok ? "green" : "red"} />
        <Stat label={t("v2ui.r4.stat.pair")} value={`${v.maxPair} / ${rules.pairLimit}`} />
        <Stat label={t("v2ui.r4.stat.swaps")} value={s.swaps.length} />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Card title={t("v2ui.r4.card.approve")}>
          {s.approved ? <InfoCard tone="ok"><span className="flex items-center gap-1 font-medium"><CheckCircle2 className="h-4 w-4" /> {t("v2ui.r4.approved")}</span></InfoCard> : <Button variant="primary" onClick={approve} data-testid="r4-approve"><CheckCircle2 className="h-3.5 w-3.5" /> {t("v2ui.r4.approve.btn")}</Button>}
        </Card>
        <Card title={t("v2ui.r4.card.files")}>
          <div className="space-y-1.5">{chk("plan", "defter_plani.csv")}{chk("izin", "izin_ozeti.csv")}{chk("dogrulama", "dogrulama_raporu.json")}{chk("param", "parametreler.json")}{chk("matris", "sayim_matrisi.csv, devir_matrisi.csv")}</div>
          <div className="mt-3 flex gap-2">
            <Button variant="primary" disabled={!s.approved} onClick={() => dl(false)} data-testid="r4-download"><Download className="h-3.5 w-3.5" /> {t("v2ui.r4.dl.selected")}</Button>
            <Button disabled={!s.approved} onClick={() => dl(true)} data-testid="r4-zip"><Download className="h-3.5 w-3.5" /> ZIP</Button>
          </div>
        </Card>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <Button onClick={() => s.go(3)}>{t("v2ui.r4.back")}</Button>
        <Button onClick={async () => { if (await confirm({ title: t("v2ui.r4.new.title"), body: t("v2ui.r4.new.body"), confirmLabel: t("v2ui.r4.new.btn"), tone: "danger" })) s.reset(); }}>{t("v2ui.r4.new.btn")}</Button>
      </div>
    </div>
  );
}
