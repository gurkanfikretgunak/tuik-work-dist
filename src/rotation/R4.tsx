"use client";
import { CheckCircle2, Download } from "lucide-react";
import { useState } from "react";
import { useConfirm } from "@/components/confirm";
import { Button, Card, Collapsible, InfoCard, ScreenTitle, Stat } from "@/components/ui";
import { download, zipBlob } from "@/lib/share";
import { calcMath } from "./math";
import { rulesOf } from "./params";
import { monthLabel, useRot } from "./store";
import { validatePlan } from "./validator";
import Papa from "papaparse";

const csv = (fields: string[], data: (string | number)[][]) => "﻿" + Papa.unparse({ fields, data });

export default function R4() {
  const confirm = useConfirm();
  const s = useRot();
  const { plan, people, notebooks, result } = s;
  const [pick, setPick] = useState({ plan: true, dogrulama: true, param: true, matris: true });
  if (!plan || !result) return (<div><ScreenTitle no={4} title="Onay ve Çıktı (R4)" /><InfoCard tone="warn">Önce plan üretin.</InfoCard></div>);

  const rules = rulesOf(s);
  const v = validatePlan(plan, rules);
  const x = calcMath(s.n, s.m, s.g);

  const files = () => {
    const f: Record<string, string> = {};
    if (pick.plan)
      f["defter_plani.csv"] = csv(["yil", "ay", "calisan_id", "defter_no"], plan.flatMap((row, t) => row.map((d, p) => { const ml = monthLabel(s.startMonth, t, s.year); return [ml.yil, ml.no, people[p].id, notebooks[d].no]; })));
    if (pick.dogrulama)
      f["dogrulama_raporu.json"] = JSON.stringify({
        zorunluKurallarGecti: v.ok, aylikEslestirme: v.monthlyOk, aylikHatalar: v.monthlyErrors,
        K1: { g: s.g, ihlal: v.k1.map((k) => ({ calisan: people[k.person].id, defter: notebooks[k.notebook].no, aylar: k.months.map((a) => a + 1) })) },
        K2: { sinir: rules.pairLimit, enCokTekrar: v.maxPair, asan: v.pairOver.map((o) => ({ kimden: people[o.from].id, kime: people[o.to].id, adet: o.count })) },
        K3: { alt: x.lo, ust: x.hi, sapma: v.k3.map((k) => ({ calisan: people[k.person].id, defter: notebooks[k.notebook].no, adet: k.count })) },
        K6: { ozelDefterler: notebooks.filter((d) => d.special).map((d) => d.no), enAzAyAraligi: s.specialGap, pesPeseIhlal: v.k6.map((k) => ({ calisan: people[k.person].id, aylar: k.months.map((a) => a + 1), defterler: k.notebooks.map((d) => notebooks[d].no) })), kisiBasinaOzelDefter: v.specialCounts },
        K5: s.useGroups ? v.k5 : "kapalı", yasakCiftIhlali: v.forbiddenHits.length,
        gevsetilenKurallar: result.relaxed, elleTakaslar: s.swaps, olaylar: s.log,
      }, null, 2);
    if (pick.param)
      f["parametreler.json"] = JSON.stringify({ n: s.n, m: s.m, yil: s.year, baslangicAyi: s.startMonth, g: s.g, istenenCiftSiniri: rules.pairLimit === result.usedPairLimit ? rules.pairLimit : s.pairOverride ?? x.pairLower, kullanilanCiftSiniri: result.usedPairLimit, tohum: result.candidates[s.picked]?.seed ?? s.seed, ilkTohum: s.seed, personel: people, defterler: notebooks, yasakCiftler: s.forbidden, sabitAtamalar: s.fixed, k5: s.useGroups }, null, 2);
    if (pick.matris) {
      f["sayim_matrisi.csv"] = csv(["calisan_id", ...notebooks.map((d) => `D${d.no}`)], v.counts.map((r, i) => [people[i].id, ...r]));
      f["devir_matrisi.csv"] = csv(["kimden\\kime", ...people.map((p) => p.id)], v.pairCounts.map((r, i) => [people[i].id, ...r]));
    }
    return f;
  };

  const approve = async () => {
    const ok = await confirm({
      title: "Plan onaylansın mı?",
      body: <>{v.ok ? "Zorunlu kuralların tümü sağlanıyor." : <b className="text-[#C92830]">Dikkat: plan zorunlu kuralları tam sağlamıyor (elle takaslar nedeniyle olabilir).</b>} {s.swaps.length} elle takas yapıldı. Onaydan sonra dosyalar indirilebilir.</>,
      confirmLabel: "Onayla", tone: v.ok ? "primary" : "danger",
    });
    if (!ok) return;
    useRot.setState({ approved: true });
    s.addLog(`Plan onaylandı (zorunlu kurallar ${v.ok ? "geçti" : "kaldı"}, ${s.swaps.length} takas)`);
  };

  const dl = async (zip: boolean) => {
    const f = files();
    const names = Object.keys(f);
    if (!names.length) return;
    const ok = await confirm({ title: zip ? "Tüm çıktılar ZIP olarak indirilsin mi?" : "Dosyalar indirilsin mi?", body: <><ul className="list-inside list-disc">{names.map((n) => <li key={n} className="font-mono">{n}</li>)}</ul><p className="mt-1 text-slate-600">Dosyalar personel kimlik ve adlarını içerebilir; yalnızca yetkili kişilerle paylaşın.</p></>, confirmLabel: "İndir" });
    if (!ok) return;
    if (zip) download(`defter_plani_${s.year}.zip`, await zipBlob(f), "application/zip");
    else for (const [n, c] of Object.entries(f)) download(n, c, n.endsWith(".json") ? "application/json" : "text/csv;charset=utf-8");
    s.addLog(`Çıktılar indirildi: ${names.join(", ")}`);
  };

  const chk = (k: keyof typeof pick, l: string) => (
    <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" disabled={!s.approved} checked={pick[k]} onChange={(e) => setPick({ ...pick, [k]: e.target.checked })} /><span className="font-mono">{l}</span></label>
  );

  return (
    <div>
      <ScreenTitle no={4} title="Onay ve Çıktı (R4)" />
      <div className="mb-3"><Collapsible title="Çıktılar">defter_plani.csv (yil, ay, calisan_id, defter_no), doğrulama raporu, parametre dosyası (aynı tohumla yeniden üretim için), sayım ve devir matrisleri. Ana araca aktarma bir sonraki aşamadadır.</Collapsible></div>
      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-5">
        <Stat label="Personel / defter" value={s.n} />
        <Stat label="Ay" value={s.m} />
        <Stat label="Zorunlu kurallar" value={v.ok ? "Geçti" : "Kaldı"} tone={v.ok ? "green" : "red"} />
        <Stat label="Çift sınırı" value={`${v.maxPair} / ${rules.pairLimit}`} />
        <Stat label="Elle takas" value={s.swaps.length} />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="Onay">
          {s.approved ? <InfoCard tone="ok"><span className="flex items-center gap-1 font-medium"><CheckCircle2 className="h-4 w-4" /> Plan onaylandı.</span></InfoCard> : <Button variant="primary" onClick={approve} data-testid="r4-approve"><CheckCircle2 className="h-3.5 w-3.5" /> Planı onayla</Button>}
        </Card>
        <Card title="Çıktı dosyaları">
          <div className="space-y-1.5">{chk("plan", "defter_plani.csv")}{chk("dogrulama", "dogrulama_raporu.json")}{chk("param", "parametreler.json")}{chk("matris", "sayim_matrisi.csv, devir_matrisi.csv")}</div>
          <div className="mt-3 flex gap-2">
            <Button variant="primary" disabled={!s.approved} onClick={() => dl(false)} data-testid="r4-download"><Download className="h-3.5 w-3.5" /> Seçilenleri indir</Button>
            <Button disabled={!s.approved} onClick={() => dl(true)} data-testid="r4-zip"><Download className="h-3.5 w-3.5" /> ZIP</Button>
          </div>
        </Card>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <Button onClick={() => s.go(3)}>← İnceleme</Button>
        <Button onClick={async () => { if (await confirm({ title: "Yeni plan başlatılsın mı?", body: "Bu oturumdaki plan ve ayarlar silinir.", confirmLabel: "Yeni plan", tone: "danger" })) s.reset(); }}>Yeni plan</Button>
      </div>
    </div>
  );
}
