"use client";
import { ArrowRight, Trash2 } from "lucide-react";
import { useState } from "react";
import { useConfirm } from "@/components/confirm";
import { DataTable, type Col, type TRow } from "@/components/DataTable";
import { Badge, Button, Card, Collapsible, Field, InfoCard, ScreenTitle, inputCls } from "@/components/ui";
import { calcMath, specialWarnings } from "./math";
import { specialOf, absenceOf } from "./params";
import LeaveSection from "./LeaveSection";
import { calcTargets } from "./math";
import { MONTHS, useRot } from "./store";

export default function R1() {
  const confirm = useConfirm();
  const s = useRot();
  const { n, people, notebooks, m, g, go, addLog } = s;
  const x = calcMath(n, m, g);
  const limit = s.pairOverride ?? x.pairLower;
  const spN = specialOf(s).length;
  const spW = specialWarnings(n, spN, s.specialGap);
  const spBlock = spW.some((w) => w.tone === "error") || calcTargets(n, m, absenceOf(s).absent, s.strategy).badMonths.length > 0;
  const [fp, setFp] = useState({ p: 0, d: 0 });
  const [fx, setFx] = useState({ t: 0, p: 0, d: 0 });

  const pCols: Col[] = [
    { key: "idx", label: "#", width: 40 },
    { key: "id", label: "calisan_id", editable: true, width: 110 },
    { key: "name", label: "ad", editable: true, width: 200 },
  ];
  const pRows: TRow[] = people.map((p, i) => ({ id: i + 2, cells: { idx: i + 1, ...p } }));
  const nCols: Col[] = [
    { key: "no", label: "defter_no", width: 80 },
    { key: "name", label: "ad", editable: true, width: 160 },
    { key: "weight", label: "ağırlık", type: "num", editable: true, width: 70 },
    { key: "group", label: "grup (K5)", type: "num", editable: true, width: 80 },
    { key: "special", label: "haftalık özel (K6)", type: "bool", editable: true, width: 120 },
  ];
  const nRows: TRow[] = notebooks.map((d, i) => ({ id: i + 2, cells: { ...d, group: d.group < 0 ? "" : d.group } }));

  const sameLabel = (list: { id?: string; name?: string }[], i: number) => `${i + 1} · ${list[i]?.name ?? ""}`;

  const next = async () => {
    const ok = await confirm({
      title: "Plan üretilsin mi?",
      body: (
        <ul className="list-inside list-disc">
          <li>{n} personel, {n} defter, {m} ay ({MONTHS[s.startMonth - 1]} {s.year} başlangıçlı)</li>
          <li>K1: aynı defter aynı kişiye sonraki {g} ayda tekrar düşmez</li>
          <li>K2: çift tekrar sınırı {limit}{s.pairOverride === null ? " (otomatik)" : ""}</li>
          <li>K6: haftalık özel defterler ({spN} adet) aynı kişiye {s.specialGap === 0 ? "serbest" : s.specialGap === 1 ? "peş peşe aylarda düşmez" : `${s.specialGap} ay arayla düşer`}</li>
          <li>İzinler: {s.leaves.filter((l) => l.included).length} kayıt, eşik %{s.leaveThreshold * 100}, açıkta kalan defter: {s.strategy === "ek" ? "ek atama" : "boş bırak"}</li>
          <li>K5 grup dengesi: {s.useGroups ? "açık" : "kapalı"} · yasak çift {s.forbidden.length} · sabit atama {s.fixed.length}</li>
          <li>Tohum {s.seed}</li>
        </ul>
      ),
      confirmLabel: "Onayla ve üretime geç",
    });
    if (!ok) return;
    addLog(`Parametreler onaylandı: N=${n}, M=${m}, G=${g}, çift sınırı=${limit}, tohum=${s.seed}`);
    go(2);
  };

  return (
    <div>
      <ScreenTitle no={1} title="Parametreler (R1)" />
      <div className="mb-3">
        <Collapsible title="Parametreler ne anlama gelir?">
          <ul className="list-inside list-disc space-y-0.5">
            <li><b>G</b>: bir defter aynı kişiye sonraki G ayda tekrar denk gelmez (K1). Varsayılan 2.</li>
            <li><b>Çift sınırı</b>: defteri A bıraktıktan sonra B alıyorsa (A→B), bu çift yılda en fazla bu kadar tekrar eder (K2). Otomatik değer teorik alt sınırdır; bulunamazsa motor +1 gevşetir ve raporlar.</li>
            <li><b>K6 haftalık özel defterler</b>: işaretli defterler (varsayılan 1, 3 ve 6) aynı çalışanda peş peşe aylarda üst üste gelmez; gelirse plan yeniden kurulur. Her kişinin toplam özel defter payı K3 ile zaten eşitlenir.</li>
            <li><b>Tohum</b>: aynı girdi ve tohum aynı planı verir.</li>
            <li><b>Yasak çift</b> bir kişinin hiç alamayacağı defteri, <b>sabit atama</b> belirli ay–kişi–defter eşleşmesini zorlar. İkisi de eşitliği bozabilir.</li>
          </ul>
        </Collapsible>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <Card title="Genel parametreler">
          <div className="space-y-2.5">
            <Field label="Yıl"><input className={inputCls} type="number" value={s.year} onChange={(e) => s.patch({ year: Number(e.target.value) || s.year })} aria-label="Yıl" /></Field>
            <Field label="Başlangıç ayı">
              <select className={inputCls} value={s.startMonth} onChange={(e) => s.patch({ startMonth: Number(e.target.value) })} aria-label="Başlangıç ayı">
                {MONTHS.map((a, i) => <option key={a} value={i + 1}>{a}</option>)}
              </select>
            </Field>
            <Field label="Ay sayısı (M)"><input className={inputCls} type="number" min={2} max={36} value={m} onChange={(e) => s.patch({ m: Math.max(2, Math.min(36, Number(e.target.value) || 12)) })} aria-label="Ay sayısı" /></Field>
            <Field label="Tekrar aralığı (G)" hint={n < g + 1 ? "N ≥ G+1 olmalı." : undefined}><input className={inputCls} type="number" min={0} max={6} value={g} onChange={(e) => s.patch({ g: Math.max(0, Math.min(6, Number(e.target.value) || 0)) })} aria-label="G" /></Field>
            <Field label={`Çift tekrar sınırı (otomatik: ${x.pairLower})`}>
              <div className="flex gap-2">
                <select className={inputCls} value={s.pairOverride === null ? "auto" : "man"} onChange={(e) => s.patch({ pairOverride: e.target.value === "auto" ? null : x.pairLower })} aria-label="Çift sınırı modu">
                  <option value="auto">Otomatik</option>
                  <option value="man">Elle</option>
                </select>
                {s.pairOverride !== null && <input className={inputCls} type="number" min={1} value={s.pairOverride} onChange={(e) => s.patch({ pairOverride: Math.max(1, Number(e.target.value) || 1) })} aria-label="Çift sınırı" />}
              </div>
            </Field>
            <Field label="Tohum"><input className={inputCls} type="number" value={s.seed} onChange={(e) => s.patch({ seed: Number(e.target.value) || 1 })} aria-label="Tohum" /></Field>
            <Field label="Arama süresi (sn)"><input className={inputCls} type="number" min={1} max={60} value={s.timeMs / 1000} onChange={(e) => s.patch({ timeMs: Math.max(1, Math.min(60, Number(e.target.value) || 4)) * 1000 })} aria-label="Süre" /></Field>
            <Field label="K6: özel defterler arası en az ay" hint="Tabloda 'haftalık özel' işaretli defterler. 1 = aynı kişiye peş peşe aylarda özel defter düşmez; 0 = kural kapalı.">
              <select className={inputCls} value={s.specialGap} onChange={(e) => s.patch({ specialGap: Number(e.target.value) })} aria-label="Özel defter aralığı">
                <option value={0}>Kapalı</option><option value={1}>1 — peş peşe yasak</option><option value={2}>2 — en az 2 ay ara</option>
              </select>
            </Field>
            <label className="flex cursor-pointer items-center gap-2 text-[12.5px]"><input type="checkbox" checked={s.useGroups} onChange={(e) => s.patch({ useGroups: e.target.checked })} /> K5: defter grubu dengesini kullan (tercih)</label>
          </div>
        </Card>
        <div className="space-y-3 lg:col-span-2">
          <DataTable sheetName="personel" columns={pCols} rows={pRows} height={200}
            onEdit={(id, k, v) => s.setPerson(id - 2, { [k]: String(v) })} />
          <DataTable sheetName="defterler" columns={nCols} rows={nRows} height={200}
            onEdit={(id, k, v) => s.setNotebook(id - 2, k === "no" ? {} : k === "special" ? { special: Boolean(v) } : k === "name" ? { name: String(v) } : k === "weight" ? { weight: Number(v) || 1 } : { group: v === "" ? -1 : Math.max(-1, Math.floor(Number(v)) || 0) })} />
        </div>
      </div>

      <LeaveSection />

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Card title={`Yasak çiftler (${s.forbidden.length})`}>
          <div className="flex flex-wrap items-end gap-2">
            <select className={`${inputCls} w-44`} value={fp.p} onChange={(e) => setFp({ ...fp, p: Number(e.target.value) })} aria-label="Yasak kişi">{people.map((_, i) => <option key={i} value={i}>{sameLabel(people, i)}</option>)}</select>
            <select className={`${inputCls} w-44`} value={fp.d} onChange={(e) => setFp({ ...fp, d: Number(e.target.value) })} aria-label="Yasak defter">{notebooks.map((_, i) => <option key={i} value={i}>{sameLabel(notebooks, i)}</option>)}</select>
            <Button size="sm" onClick={() => !s.forbidden.some(([p, d]) => p === fp.p && d === fp.d) && s.patch({ forbidden: [...s.forbidden, [fp.p, fp.d]] })}>Ekle</Button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {s.forbidden.map(([p, d], i) => (
              <Badge key={i} tone="red">{people[p]?.name} ✕ {notebooks[d]?.name} <button aria-label="Kaldır" onClick={() => s.patch({ forbidden: s.forbidden.filter((_, k) => k !== i) })}><Trash2 className="inline h-3 w-3" /></button></Badge>
            ))}
          </div>
          {s.forbidden.length > 0 && <div className="mt-2"><InfoCard tone="warn">Yasak çift eşitliği (K3) bozabilir; ilgili çiftler eşitlik denetiminden hariç tutulur.</InfoCard></div>}
        </Card>
        <Card title={`Sabit atamalar (${s.fixed.length})`}>
          <div className="flex flex-wrap items-end gap-2">
            <select className={`${inputCls} w-28`} value={fx.t} onChange={(e) => setFx({ ...fx, t: Number(e.target.value) })} aria-label="Sabit ay">{Array.from({ length: m }, (_, i) => <option key={i} value={i}>{i + 1}. ay</option>)}</select>
            <select className={`${inputCls} w-40`} value={fx.p} onChange={(e) => setFx({ ...fx, p: Number(e.target.value) })} aria-label="Sabit kişi">{people.map((_, i) => <option key={i} value={i}>{sameLabel(people, i)}</option>)}</select>
            <select className={`${inputCls} w-40`} value={fx.d} onChange={(e) => setFx({ ...fx, d: Number(e.target.value) })} aria-label="Sabit defter">{notebooks.map((_, i) => <option key={i} value={i}>{sameLabel(notebooks, i)}</option>)}</select>
            <Button size="sm" onClick={() => !s.fixed.some((f) => f.month === fx.t && (f.person === fx.p || f.notebook === fx.d)) && s.patch({ fixed: [...s.fixed, { month: fx.t, person: fx.p, notebook: fx.d }] })}>Ekle</Button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {s.fixed.map((f, i) => (
              <Badge key={i} tone="blue">{f.month + 1}. ay: {people[f.person]?.name} = {notebooks[f.notebook]?.name} <button aria-label="Kaldır" onClick={() => s.patch({ fixed: s.fixed.filter((_, k) => k !== i) })}><Trash2 className="inline h-3 w-3" /></button></Badge>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-3 space-y-1.5">{[...x.warnings, ...spW].filter((w) => w.tone !== "info").map((w) => <InfoCard key={w.text} tone={w.tone}>{w.text}</InfoCard>)}</div>
      <div className="mt-3 flex items-center justify-between">
        <Button onClick={() => go(0)}>← Başlangıç</Button>
        <Button variant="primary" disabled={!x.feasible || spBlock} onClick={next} data-testid="r1-next">Onayla ve üretime geç <ArrowRight className="h-3.5 w-3.5" /></Button>
      </div>
    </div>
  );
}
