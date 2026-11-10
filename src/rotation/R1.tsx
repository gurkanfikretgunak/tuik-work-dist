"use client";
import clsx from "clsx";
import { ArrowLeft, ArrowRight, Check, Trash2 } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { useConfirm } from "@/components/confirm";
import { DataTable, type Col, type TRow } from "@/components/DataTable";
import { Badge, Button, Card, Collapsible, Field, InfoCard, ScreenTitle, Stat, inputCls } from "@/components/ui";
import LeaveSection from "./LeaveSection";
import { calcMath, calcTargets, specialWarnings } from "./math";
import { absenceOf, specialOf } from "./params";
import { MONTHS, useRot } from "./store";

type Status = "ok" | "warn" | "error";
const STEPS = [
  { key: "donem", title: "Dönem", hint: "Yıl, başlangıç ayı, ay sayısı", optional: false },
  { key: "kural", title: "Kurallar", hint: "Tekrar aralığı, çift sınırı, özel defter", optional: false },
  { key: "varlik", title: "Personel ve defterler", hint: "Adlar, özel defter, grup", optional: false },
  { key: "izin", title: "İzinler", hint: "Tek gün veya tarih aralığı", optional: true },
  { key: "ozel", title: "Özel koşullar", hint: "Yasak çift, sabit atama", optional: true },
  { key: "ozet", title: "Özet ve onay", hint: "Kontrol et, plan üretimine geç", optional: false },
] as const;

export default function R1() {
  const confirm = useConfirm();
  const s = useRot();
  const { n, m, g, go, addLog } = s;
  const [i, setI] = useState(0);
  const [seen, setSeen] = useState<Set<number>>(new Set([0]));
  const x = calcMath(n, m, g);
  const limit = s.pairOverride ?? x.pairLower;
  const spN = specialOf(s).length;
  const spW = specialWarnings(n, spN, s.specialGap);
  const T = useMemo(() => calcTargets(n, m, absenceOf(s).absent, s.strategy), [s.n, s.m, s.leaves, s.people, s.startMonth, s.year, s.leaveThreshold, s.strategy]); // eslint-disable-line react-hooks/exhaustive-deps

  const status: Record<string, { s: Status; note?: string }> = {
    donem: { s: "ok" },
    kural: !x.feasible ? { s: "error", note: x.warnings.find((w) => w.tone === "error")?.text } : { s: "ok" },
    varlik: spW.some((w) => w.tone === "error") ? { s: "error", note: spW[0].text } : spW.length ? { s: "warn", note: spW[0].text } : { s: "ok" },
    izin: T.badMonths.length ? { s: "error", note: "Ek atama bazı aylarda yetersiz" } : { s: "ok", note: s.leaves.filter((l) => l.included).length ? `${s.leaves.filter((l) => l.included).length} izin kaydı` : "izin yok" },
    ozel: { s: "ok", note: `${s.forbidden.length} yasak, ${s.fixed.length} sabit` },
  };
  const blocking = ["kural", "varlik", "izin"].filter((k) => status[k].s === "error");

  const goTo = (k: number) => { setI(k); setSeen((p) => new Set(p).add(k)); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const cur = STEPS[i];
  const canNext = cur.key === "ozet" ? false : status[cur.key]?.s !== "error";

  const finish = async () => {
    const ok = await confirm({
      title: "Plan üretimine geçilsin mi?",
      body: <>Parametreler kaydedilir ve plan üretim ekranına geçilir. N=<b>{n}</b>, M=<b>{m}</b>, G=<b>{g}</b>, çift sınırı <b>{limit}</b>, esas dağıtım sayısı D=<b>{T.D}</b>.</>,
      confirmLabel: "Onayla ve üretime geç",
    });
    if (!ok) return;
    addLog(`Parametreler onaylandı: N=${n}, M=${m}, G=${g}, çift sınırı=${limit}, D=${T.D}, tohum=${s.seed}`);
    go(2);
  };

  return (
    <div>
      <ScreenTitle no={1} title="Parametreler (R1)">
        <span className="text-xs text-slate-500">Adım {i + 1} / {STEPS.length}</span>
      </ScreenTitle>
      <div className="mb-3 h-1.5 w-full rounded bg-slate-200" aria-hidden><div className="h-1.5 rounded bg-[#C92830] transition-all" style={{ width: `${((i + 1) / STEPS.length) * 100}%` }} /></div>

      <div className="grid gap-4 md:grid-cols-[230px_1fr]">
        {/* Adım listesi */}
        <ol className="no-print flex gap-1 overflow-x-auto md:flex-col md:overflow-visible" aria-label="Parametre adımları">
          {STEPS.map((st, k) => {
            const stt = status[st.key];
            const done = seen.has(k) && k !== i && stt?.s !== "error";
            return (
              <li key={st.key}>
                <button onClick={() => goTo(k)} data-testid={`r1sub-${k}`} aria-current={k === i ? "step" : undefined}
                  className={clsx("flex w-full min-w-[150px] items-start gap-2 rounded-md border px-2.5 py-2 text-left", k === i ? "border-[#1F2A44] bg-slate-50" : "border-transparent hover:bg-slate-50")}>
                  <span className={clsx("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                    stt?.s === "error" ? "bg-[#C92830] text-white" : done ? "bg-emerald-600 text-white" : k === i ? "bg-[#1F2A44] text-white" : "bg-slate-200 text-slate-600")}>
                    {stt?.s === "error" ? "!" : done ? <Check className="h-3 w-3" /> : k + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1 text-[12.5px] font-semibold text-slate-900">{st.title}{st.optional && <span className="rounded bg-slate-100 px-1 text-[9.5px] font-medium text-slate-500">isteğe bağlı</span>}</span>
                    <span className="block truncate text-[11px] text-slate-500">{stt?.note ?? st.hint}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        {/* İçerik */}
        <div className="min-w-0">
          <div className="mb-2">
            <h2 className="text-[15px] font-semibold text-[#1F2A44]">{i + 1}. {cur.title}</h2>
            <p className="text-[12.5px] text-slate-600">{cur.hint}</p>
          </div>
          <div data-testid={`r1pane-${cur.key}`}>
            {cur.key === "donem" && <StepDonem />}
            {cur.key === "kural" && <StepKural limit={limit} lower={x.pairLower} />}
            {cur.key === "varlik" && <StepVarlik spW={spW} />}
            {cur.key === "izin" && <LeaveSection />}
            {cur.key === "ozel" && <StepOzel />}
            {cur.key === "ozet" && <StepOzet T={T} limit={limit} statuses={status} jump={goTo} />}
          </div>

          {status[cur.key]?.s === "error" && <div className="mt-3"><InfoCard tone="error" title="Devam etmeden önce düzeltin">{status[cur.key].note}</InfoCard></div>}

          {/* Alt gezinme çubuğu */}
          <div className="sticky bottom-0 -mx-1 mt-4 flex items-center justify-between gap-2 border-t border-slate-200 bg-white/95 px-1 py-2.5 backdrop-blur">
            <Button onClick={() => (i === 0 ? go(0) : goTo(i - 1))} data-testid="r1-back"><ArrowLeft className="h-3.5 w-3.5" /> {i === 0 ? "Başlangıç" : "Geri"}</Button>
            <div className="flex items-center gap-2">
              {cur.optional && <Button variant="ghost" onClick={() => goTo(i + 1)} data-testid="r1-skip">Atla</Button>}
              {cur.key === "ozet" ? (
                <Button variant="primary" disabled={blocking.length > 0} onClick={finish} data-testid="r1-next">Onayla ve plan üretimine geç <ArrowRight className="h-3.5 w-3.5" /></Button>
              ) : (
                <Button variant="primary" disabled={!canNext} onClick={() => goTo(i + 1)} data-testid="r1-forward">İleri <ArrowRight className="h-3.5 w-3.5" /></Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- 1. Dönem ---------- */
function StepDonem() {
  const s = useRot();
  const endIdx = s.startMonth - 1 + s.m - 1;
  return (
    <div className="space-y-3">
      <Card>
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Yıl"><input className={inputCls} type="number" value={s.year} onChange={(e) => s.patch({ year: Number(e.target.value) || s.year })} aria-label="Yıl" /></Field>
          <Field label="Başlangıç ayı">
            <select className={inputCls} value={s.startMonth} onChange={(e) => s.patch({ startMonth: Number(e.target.value) })} aria-label="Başlangıç ayı">
              {MONTHS.map((a, k) => <option key={a} value={k + 1}>{a}</option>)}
            </select>
          </Field>
          <Field label="Ay sayısı (M)" hint="Genellikle 12.">
            <input className={inputCls} type="number" min={2} max={36} value={s.m} onChange={(e) => s.patch({ m: Math.max(2, Math.min(36, Number(e.target.value) || 12)) })} aria-label="Ay sayısı" />
          </Field>
        </div>
      </Card>
      <InfoCard tone="ok" title="Plan dönemi">{MONTHS[s.startMonth - 1]} {s.year} – {MONTHS[endIdx % 12]} {s.year + Math.floor(endIdx / 12)} ({s.m} ay)</InfoCard>
      <Collapsible title="Bu adım ne işe yarar?">Planın hangi aylara ait olduğunu belirler. İzin tarihleri bu dönemle karşılaştırılır; dönem dışındaki izinler uyarı verir.</Collapsible>
    </div>
  );
}

/* ---------- 2. Kurallar ---------- */
function Rule({ code, title, children, tone }: { code: string; title: string; children: ReactNode; tone?: "red" | "blue" }) {
  return <Card title={<span className="flex items-center gap-2"><Badge tone={tone ?? "red"}>{code}</Badge>{title}</span>}>{children}</Card>;
}
function StepKural({ limit, lower }: { limit: number; lower: number }) {
  const s = useRot();
  const x = calcMath(s.n, s.m, s.g);
  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-2">
        <Rule code="K1" title="Tekrar yasağı">
          <Field label="Tekrar aralığı (G)" hint={`Bir defter aynı kişiye sonraki G ayda tekrar düşmez. ${s.n < s.g + 1 ? "N ≥ G+1 olmalı!" : ""}`}>
            <input className={inputCls} type="number" min={0} max={6} value={s.g} onChange={(e) => s.patch({ g: Math.max(0, Math.min(6, Number(e.target.value) || 0)) })} aria-label="G" />
          </Field>
        </Rule>
        <Rule code="K2" title="Takip yasağı (çift tekrar sınırı)">
          <Field label={`Çift sınırı — otomatik: ${lower}`} hint="A→B geçişi yılda en fazla bu kadar tekrar eder. Bulunamazsa motor +1 gevşetir.">
            <div className="flex gap-2">
              <select className={inputCls} value={s.pairOverride === null ? "auto" : "man"} onChange={(e) => s.patch({ pairOverride: e.target.value === "auto" ? null : lower })} aria-label="Çift sınırı modu"><option value="auto">Otomatik</option><option value="man">Elle</option></select>
              {s.pairOverride !== null && <input className={inputCls} type="number" min={1} value={s.pairOverride} onChange={(e) => s.patch({ pairOverride: Math.max(1, Number(e.target.value) || 1) })} aria-label="Çift sınırı" />}
            </div>
          </Field>
          <div className="mt-1 text-[11.5px] text-slate-500">Geçerli sınır: <b>{limit}</b></div>
        </Rule>
        <Rule code="K6" title="Haftalık özel defterler">
          <Field label="Özel defterler arası en az ay" hint="Özel defterler sonraki adımda tablodan işaretlenir (varsayılan 1, 3, 6).">
            <select className={inputCls} value={s.specialGap} onChange={(e) => s.patch({ specialGap: Number(e.target.value) })} aria-label="Özel defter aralığı">
              <option value={0}>Kapalı</option><option value={1}>1 — peş peşe yasak (önerilen)</option><option value={2}>2 — en az 2 ay ara</option>
            </select>
          </Field>
        </Rule>
        <Rule code="K5" title="Defter grubu dengesi" tone="blue">
          <label className="flex cursor-pointer items-start gap-2 text-[12.5px]"><input className="mt-0.5" type="checkbox" checked={s.useGroups} onChange={(e) => s.patch({ useGroups: e.target.checked })} /><span>Her kişi her çeyrekte farklı gruplardan defter alsın (tercih). Gruplar &quot;Personel ve defterler&quot; adımında girilir.</span></label>
        </Rule>
      </div>
      <Card title="K3 · Eşitlik (otomatik)">
        <div className="text-[12.5px] text-slate-700">Her kişi her defteri <b>{x.lo === x.hi ? x.lo : `${x.lo}–${x.hi}`}</b> kez alır; hedef esas dağıtım sayısından türetilir. Bu kural her zaman zorunludur.</div>
      </Card>
      <Collapsible title="Gelişmiş: tohum ve arama süresi">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Tohum" hint="Aynı girdi ve tohum aynı planı verir."><input className={inputCls} type="number" value={s.seed} onChange={(e) => s.patch({ seed: Number(e.target.value) || 1 })} aria-label="Tohum" /></Field>
          <Field label="Arama süresi (sn)"><input className={inputCls} type="number" min={1} max={60} value={s.timeMs / 1000} onChange={(e) => s.patch({ timeMs: Math.max(1, Math.min(60, Number(e.target.value) || 4)) * 1000 })} aria-label="Süre" /></Field>
        </div>
      </Collapsible>
    </div>
  );
}

/* ---------- 3. Personel ve defterler ---------- */
function StepVarlik({ spW }: { spW: { tone: "warn" | "error"; text: string }[] }) {
  const s = useRot();
  const [tab, setTab] = useState<"p" | "d">("p");
  const pCols: Col[] = [{ key: "idx", label: "#", width: 40 }, { key: "id", label: "calisan_id", editable: true, width: 110 }, { key: "name", label: "ad", editable: true, width: 220 }];
  const pRows: TRow[] = s.people.map((p, k) => ({ id: k + 2, cells: { idx: k + 1, ...p } }));
  const nCols: Col[] = [
    { key: "no", label: "defter_no", width: 80 }, { key: "name", label: "ad", editable: true, width: 160 },
    { key: "weight", label: "ağırlık", type: "num", editable: true, width: 70 }, { key: "group", label: "grup (K5)", type: "num", editable: true, width: 80 },
    { key: "special", label: "haftalık özel (K6)", type: "bool", editable: true, width: 120 },
  ];
  const nRows: TRow[] = s.notebooks.map((d, k) => ({ id: k + 2, cells: { ...d, group: d.group < 0 ? "" : d.group } }));
  return (
    <div className="space-y-3">
      <div className="inline-flex rounded-md border border-slate-300 p-0.5" role="tablist">
        {([["p", `Personel (${s.n})`], ["d", `Defterler (${s.n})`]] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} data-testid={`tab-${k}`} className={clsx("rounded px-3 py-1 text-xs font-medium", tab === k ? "bg-[#1F2A44] text-white" : "text-slate-700 hover:bg-slate-50")}>{l}</button>
        ))}
      </div>
      {tab === "p" ? (
        <DataTable sheetName="personel" columns={pCols} rows={pRows} height={300} onEdit={(id, k, v) => s.setPerson(id - 2, { [k]: String(v) })} />
      ) : (
        <>
          <DataTable sheetName="defterler" columns={nCols} rows={nRows} height={300}
            onEdit={(id, k, v) => s.setNotebook(id - 2, k === "no" ? {} : k === "special" ? { special: Boolean(v) } : k === "name" ? { name: String(v) } : k === "weight" ? { weight: Number(v) || 1 } : { group: v === "" ? -1 : Math.max(-1, Math.floor(Number(v)) || 0) })} />
          {spW.map((w) => <InfoCard key={w.text} tone={w.tone}>{w.text}</InfoCard>)}
        </>
      )}
      <Collapsible title="Alanlar">Personel adı/ID plan çıktılarında görünür. Defterde <b>haftalık özel</b> işaretliler K6 kuralına tabidir; <b>grup</b> yalnızca K5 açıksa kullanılır; ağırlık bu sürümde eşitliğe katılmaz.</Collapsible>
    </div>
  );
}

/* ---------- 5. Özel koşullar ---------- */
function StepOzel() {
  const s = useRot();
  const { people, notebooks, m } = s;
  const [fp, setFp] = useState({ p: 0, d: 0 });
  const [fx, setFx] = useState({ t: 0, p: 0, d: 0 });
  const lab = (list: { name?: string }[], k: number) => `${k + 1} · ${list[k]?.name ?? ""}`;
  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-2">
        <Card title={`Yasak çiftler (${s.forbidden.length})`}>
          <p className="mb-2 text-[12px] text-slate-600">Bir kişinin hiç alamayacağı defter.</p>
          <div className="flex flex-wrap items-end gap-2">
            <select className={`${inputCls} w-44`} value={fp.p} onChange={(e) => setFp({ ...fp, p: Number(e.target.value) })} aria-label="Yasak kişi">{people.map((_, k) => <option key={k} value={k}>{lab(people, k)}</option>)}</select>
            <select className={`${inputCls} w-44`} value={fp.d} onChange={(e) => setFp({ ...fp, d: Number(e.target.value) })} aria-label="Yasak defter">{notebooks.map((_, k) => <option key={k} value={k}>{lab(notebooks, k)}</option>)}</select>
            <Button size="sm" onClick={() => !s.forbidden.some(([p, d]) => p === fp.p && d === fp.d) && s.patch({ forbidden: [...s.forbidden, [fp.p, fp.d]] })}>Ekle</Button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {s.forbidden.map(([p, d], k) => <Badge key={k} tone="red">{people[p]?.name} ✕ {notebooks[d]?.name} <button aria-label="Kaldır" onClick={() => s.patch({ forbidden: s.forbidden.filter((_, q) => q !== k) })}><Trash2 className="inline h-3 w-3" /></button></Badge>)}
            {s.forbidden.length === 0 && <span className="text-[12px] text-slate-500">Yasak çift yok.</span>}
          </div>
          {s.forbidden.length > 0 && <div className="mt-2"><InfoCard tone="warn">Yasak çift eşitliği (K3) bozabilir; ilgili çiftler eşitlik denetiminden hariç tutulur.</InfoCard></div>}
        </Card>
        <Card title={`Sabit atamalar (${s.fixed.length})`}>
          <p className="mb-2 text-[12px] text-slate-600">Belirli ay–kişi–defter eşleşmesini zorlar.</p>
          <div className="flex flex-wrap items-end gap-2">
            <select className={`${inputCls} w-28`} value={fx.t} onChange={(e) => setFx({ ...fx, t: Number(e.target.value) })} aria-label="Sabit ay">{Array.from({ length: m }, (_, k) => <option key={k} value={k}>{k + 1}. ay</option>)}</select>
            <select className={`${inputCls} w-40`} value={fx.p} onChange={(e) => setFx({ ...fx, p: Number(e.target.value) })} aria-label="Sabit kişi">{people.map((_, k) => <option key={k} value={k}>{lab(people, k)}</option>)}</select>
            <select className={`${inputCls} w-40`} value={fx.d} onChange={(e) => setFx({ ...fx, d: Number(e.target.value) })} aria-label="Sabit defter">{notebooks.map((_, k) => <option key={k} value={k}>{lab(notebooks, k)}</option>)}</select>
            <Button size="sm" onClick={() => !s.fixed.some((f) => f.month === fx.t && (f.person === fx.p || f.notebook === fx.d)) && s.patch({ fixed: [...s.fixed, { month: fx.t, person: fx.p, notebook: fx.d }] })}>Ekle</Button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {s.fixed.map((f, k) => <Badge key={k} tone="blue">{f.month + 1}. ay: {people[f.person]?.name} = {notebooks[f.notebook]?.name} <button aria-label="Kaldır" onClick={() => s.patch({ fixed: s.fixed.filter((_, q) => q !== k) })}><Trash2 className="inline h-3 w-3" /></button></Badge>)}
            {s.fixed.length === 0 && <span className="text-[12px] text-slate-500">Sabit atama yok.</span>}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ---------- 6. Özet ---------- */
function StepOzet({ T, limit, statuses, jump }: { T: ReturnType<typeof calcTargets>; limit: number; statuses: Record<string, { s: Status; note?: string }>; jump: (k: number) => void }) {
  const s = useRot();
  const sp = specialOf(s).map((k) => s.notebooks[k]?.no);
  const probs = Object.entries(statuses).filter(([, v]) => v.s !== "ok" && v.note);
  const rows: [string, string, number][] = [
    ["Dönem", `${MONTHS[s.startMonth - 1]} ${s.year} · ${s.m} ay`, 0],
    ["K1 tekrar yasağı", s.g === 0 ? "kapalı" : `G = ${s.g}`, 1],
    ["K2 takip yasağı", `çift sınırı ${limit}${s.pairOverride === null ? " (otomatik)" : ""}`, 1],
    ["K6 özel defterler", s.specialGap === 0 || !sp.length ? "kapalı" : `defter ${sp.join(", ")} · ${s.specialGap === 1 ? "peş peşe yasak" : `${s.specialGap} ay ara`}`, 1],
    ["K5 grup dengesi", s.useGroups ? "açık" : "kapalı", 1],
    ["Personel / defter", `${s.n} / ${s.n}`, 2],
    ["İzinler", `${s.leaves.filter((l) => l.included).length} kayıt · eşik %${s.leaveThreshold * 100} · ${s.strategy === "ek" ? "ek atama" : "boş bırak"}`, 3],
    ["Özel koşullar", `${s.forbidden.length} yasak çift, ${s.fixed.length} sabit atama`, 4],
    ["Tohum / süre", `${s.seed} / ${s.timeMs / 1000} sn`, 1],
  ];
  return (
    <div className="space-y-3" data-testid="r1-summary">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="Personel = defter" value={s.n} />
        <Stat label="Esas dağıtım D" value={T.D} />
        <Stat label="Kişi–defter hedefi" value={`${Math.min(...T.lo.flat())}–${Math.max(...T.hi.flat())}`} />
        <Stat label="Çift sınırı" value={limit} />
      </div>
      {probs.map(([k, v]) => <InfoCard key={k} tone={v.s === "error" ? "error" : "warn"} title={STEPS.find((x) => x.key === k)?.title}>{v.note}</InfoCard>)}
      <Card title="Seçimleriniz">
        <ul className="divide-y divide-slate-100">
          {rows.map(([a, b, k]) => (
            <li key={a} className="flex items-center justify-between gap-3 py-1.5 text-[12.5px]">
              <span className="font-medium text-slate-800">{a}</span>
              <span className="flex items-center gap-2 text-slate-600">{b}<button onClick={() => jump(k)} className="text-xs text-sky-700 underline">Düzenle</button></span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
