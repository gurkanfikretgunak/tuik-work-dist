"use client";
import clsx from "clsx";
import { ArrowLeft, ArrowRight, Check, Trash2 } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { useConfirm } from "@/components/confirm";
import { DataTable, type Col, type TRow } from "@/components/DataTable";
import { Badge, Button, Card, Collapsible, Field, InfoCard, ScreenTitle, Stat, inputCls } from "@/components/ui";
import { monthName, useT } from "@/i18n";
import LeaveSection from "./LeaveSection";
import { calcMath, calcTargets, specialWarnings } from "./math";
import { absenceOf, specialOf } from "./params";
import { useRot } from "./store";

type Status = "ok" | "warn" | "error";
const STEPS = [
  { key: "donem", optional: false },
  { key: "kural", optional: false },
  { key: "varlik", optional: false },
  { key: "izin", optional: true },
  { key: "ozel", optional: true },
  { key: "ozet", optional: false },
] as const;
const stepTitle = (t: (k: string) => string, k: (typeof STEPS)[number]["key"]) =>
  ({ donem: t("v2core.r1.st.donem.title"), kural: t("v2core.r1.st.kural.title"), varlik: t("v2core.r1.st.varlik.title"), izin: t("v2core.r1.st.izin.title"), ozel: t("v2core.r1.st.ozel.title"), ozet: t("v2core.r1.st.ozet.title") })[k];
const stepHint = (t: (k: string) => string, k: (typeof STEPS)[number]["key"]) =>
  ({ donem: t("v2core.r1.st.donem.hint"), kural: t("v2core.r1.st.kural.hint"), varlik: t("v2core.r1.st.varlik.hint"), izin: t("v2core.r1.st.izin.hint"), ozel: t("v2core.r1.st.ozel.hint"), ozet: t("v2core.r1.st.ozet.hint") })[k];

export default function R1() {
  const confirm = useConfirm();
  const { t, rt } = useT();
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
    izin: T.badMonths.length ? { s: "error", note: t("v2core.r1.note.short") } : { s: "ok", note: s.leaves.filter((l) => l.included).length ? t("v2core.r1.note.leaves", { n: s.leaves.filter((l) => l.included).length }) : t("v2core.r1.note.noLeaves") },
    ozel: { s: "ok", note: t("v2core.r1.note.special", { f: s.forbidden.length, x: s.fixed.length }) },
  };
  const blocking = ["kural", "varlik", "izin"].filter((k) => status[k].s === "error");

  const goTo = (k: number) => { setI(k); setSeen((p) => new Set(p).add(k)); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const cur = STEPS[i];
  const canNext = cur.key === "ozet" ? false : status[cur.key]?.s !== "error";

  const finish = async () => {
    const ok = await confirm({
      title: t("v2core.r1.fin.title"),
      body: rt("v2core.r1.fin.body", { n, m, g, limit, d: T.D }),
      confirmLabel: t("v2core.r1.fin.ok"),
    });
    if (!ok) return;
    addLog(t("v2core.r1.fin.log", { n, m, g, limit, d: T.D, seed: s.seed }));
    go(2);
  };

  return (
    <div>
      <ScreenTitle no={1} title={t("v2core.r1.title")}>
        <span className="text-xs text-slate-500">{t("v2core.r1.stepOf", { i: i + 1, n: STEPS.length })}</span>
      </ScreenTitle>
      <div className="mb-3 h-1.5 w-full rounded bg-slate-200" aria-hidden><div className="h-1.5 rounded bg-[#C92830] transition-all" style={{ width: `${((i + 1) / STEPS.length) * 100}%` }} /></div>

      <div className="grid gap-4 md:grid-cols-[230px_1fr]">
        {/* Adım listesi */}
        <ol className="no-print flex gap-1 overflow-x-auto md:flex-col md:overflow-visible" aria-label={t("v2core.r1.stepsAria")}>
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
                    <span className="flex items-center gap-1 text-[12.5px] font-semibold text-slate-900">{stepTitle(t, st.key)}{st.optional && <span className="rounded bg-slate-100 px-1 text-[9.5px] font-medium text-slate-500">{t("c.optional")}</span>}</span>
                    <span className="block truncate text-[11px] text-slate-500">{stt?.note ?? stepHint(t, st.key)}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        {/* İçerik */}
        <div className="min-w-0">
          <div className="mb-2">
            <h2 className="text-[15px] font-semibold text-[#1F2A44]">{i + 1}. {stepTitle(t, cur.key)}</h2>
            <p className="text-[12.5px] text-slate-600">{stepHint(t, cur.key)}</p>
          </div>
          <div data-testid={`r1pane-${cur.key}`}>
            {cur.key === "donem" && <StepDonem />}
            {cur.key === "kural" && <StepKural limit={limit} lower={x.pairLower} />}
            {cur.key === "varlik" && <StepVarlik spW={spW} />}
            {cur.key === "izin" && <LeaveSection />}
            {cur.key === "ozel" && <StepOzel />}
            {cur.key === "ozet" && <StepOzet T={T} limit={limit} statuses={status} jump={goTo} />}
          </div>

          {status[cur.key]?.s === "error" && <div className="mt-3"><InfoCard tone="error" title={t("v2core.r1.fixFirst")}>{status[cur.key].note}</InfoCard></div>}

          {/* Alt gezinme çubuğu */}
          <div className="sticky bottom-0 -mx-1 mt-4 flex items-center justify-between gap-2 border-t border-slate-200 bg-white/95 px-1 py-2.5 backdrop-blur">
            <Button onClick={() => (i === 0 ? go(0) : goTo(i - 1))} data-testid="r1-back"><ArrowLeft className="h-3.5 w-3.5" /> {i === 0 ? t("v2core.r1.back0") : t("c.back")}</Button>
            <div className="flex items-center gap-2">
              {cur.optional && <Button variant="ghost" onClick={() => goTo(i + 1)} data-testid="r1-skip">{t("c.skip")}</Button>}
              {cur.key === "ozet" ? (
                <Button variant="primary" disabled={blocking.length > 0} onClick={finish} data-testid="r1-next">{t("v2core.r1.finish")} <ArrowRight className="h-3.5 w-3.5" /></Button>
              ) : (
                <Button variant="primary" disabled={!canNext} onClick={() => goTo(i + 1)} data-testid="r1-forward">{t("c.next")} <ArrowRight className="h-3.5 w-3.5" /></Button>
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
  const { t } = useT();
  const s = useRot();
  const endIdx = s.startMonth - 1 + s.m - 1;
  return (
    <div className="space-y-3">
      <Card>
        <div className="grid gap-3 md:grid-cols-3">
          <Field label={t("v2core.r1.d.year")}><input className={inputCls} type="number" value={s.year} onChange={(e) => s.patch({ year: Number(e.target.value) || s.year })} aria-label={t("v2core.r1.d.year")} /></Field>
          <Field label={t("v2core.r1.d.start")}>
            <select className={inputCls} value={s.startMonth} onChange={(e) => s.patch({ startMonth: Number(e.target.value) })} aria-label={t("v2core.r1.d.start")}>
              {Array.from({ length: 12 }, (_, k) => <option key={k} value={k + 1}>{monthName(k)}</option>)}
            </select>
          </Field>
          <Field label={t("v2core.r1.d.m")} hint={t("v2core.r1.d.mHint")}>
            <input className={inputCls} type="number" min={2} max={36} value={s.m} onChange={(e) => s.patch({ m: Math.max(2, Math.min(36, Number(e.target.value) || 12)) })} aria-label={t("v2core.r1.d.mAria")} />
          </Field>
        </div>
      </Card>
      <InfoCard tone="ok" title={t("v2core.r1.d.period")}>{t("v2core.r1.d.range", { a: monthName(s.startMonth - 1), y1: s.year, b: monthName(endIdx % 12), y2: s.year + Math.floor(endIdx / 12), m: s.m })}</InfoCard>
      <Collapsible title={t("v2core.r1.d.helpTitle")}>{t("v2core.r1.d.help")}</Collapsible>
    </div>
  );
}

/* ---------- 2. Kurallar ---------- */
function Rule({ code, title, children, tone }: { code: string; title: string; children: ReactNode; tone?: "red" | "blue" }) {
  return <Card title={<span className="flex items-center gap-2"><Badge tone={tone ?? "red"}>{code}</Badge>{title}</span>}>{children}</Card>;
}
function StepKural({ limit, lower }: { limit: number; lower: number }) {
  const { t, rt } = useT();
  const s = useRot();
  const x = calcMath(s.n, s.m, s.g);
  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-2">
        <Rule code="K1" title={t("v2core.r1.k1.title")}>
          <Field label={t("v2core.r1.k1.label")} hint={`${t("v2core.r1.k1.hint")} ${s.n < s.g + 1 ? t("v2core.r1.k1.hintN") : ""}`}>
            <input className={inputCls} type="number" min={0} max={6} value={s.g} onChange={(e) => s.patch({ g: Math.max(0, Math.min(6, Number(e.target.value) || 0)) })} aria-label="G" />
          </Field>
        </Rule>
        <Rule code="K2" title={t("v2core.r1.k2.title")}>
          <Field label={t("v2core.r1.k2.label", { n: lower })} hint={t("v2core.r1.k2.hint")}>
            <div className="flex gap-2">
              <select className={inputCls} value={s.pairOverride === null ? "auto" : "man"} onChange={(e) => s.patch({ pairOverride: e.target.value === "auto" ? null : lower })} aria-label={t("v2core.r1.k2.modeAria")}><option value="auto">{t("v2core.r1.k2.auto")}</option><option value="man">{t("v2core.r1.k2.man")}</option></select>
              {s.pairOverride !== null && <input className={inputCls} type="number" min={1} value={s.pairOverride} onChange={(e) => s.patch({ pairOverride: Math.max(1, Number(e.target.value) || 1) })} aria-label={t("v2core.r1.k2.aria")} />}
            </div>
          </Field>
          <div className="mt-1 text-[11.5px] text-slate-500">{rt("v2core.r1.k2.cur", { n: limit })}</div>
        </Rule>
        <Rule code="K6" title={t("v2core.r1.k6.title")}>
          <Field label={t("v2core.r1.k6.label")} hint={t("v2core.r1.k6.hint")}>
            <select className={inputCls} value={s.specialGap} onChange={(e) => s.patch({ specialGap: Number(e.target.value) })} aria-label={t("v2core.r1.k6.aria")}>
              <option value={0}>{t("v2core.r1.k6.off")}</option><option value={1}>{t("v2core.r1.k6.o1")}</option><option value={2}>{t("v2core.r1.k6.o2")}</option>
            </select>
          </Field>
        </Rule>
        <Rule code="K5" title={t("v2core.r1.k5.title")} tone="blue">
          <label className="flex cursor-pointer items-start gap-2 text-[12.5px]"><input className="mt-0.5" type="checkbox" checked={s.useGroups} onChange={(e) => s.patch({ useGroups: e.target.checked })} /><span>{t("v2core.r1.k5.text")}</span></label>
        </Rule>
      </div>
      <Card title={t("v2core.r1.k3.title")}>
        <div className="text-[12.5px] text-slate-700">{rt("v2core.r1.k3.body", { k: x.lo === x.hi ? `${x.lo}` : `${x.lo}–${x.hi}` })}</div>
      </Card>
      <Collapsible title={t("v2core.r1.adv.title")}>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label={t("v2core.r1.adv.seed")} hint={t("v2core.r1.adv.seedHint")}><input className={inputCls} type="number" value={s.seed} onChange={(e) => s.patch({ seed: Number(e.target.value) || 1 })} aria-label={t("v2core.r1.adv.seed")} /></Field>
          <Field label={t("v2core.r1.adv.time")}><input className={inputCls} type="number" min={1} max={60} value={s.timeMs / 1000} onChange={(e) => s.patch({ timeMs: Math.max(1, Math.min(60, Number(e.target.value) || 4)) * 1000 })} aria-label={t("v2core.r1.adv.timeAria")} /></Field>
        </div>
      </Collapsible>
    </div>
  );
}

/* ---------- 3. Personel ve defterler ---------- */
function StepVarlik({ spW }: { spW: { tone: "warn" | "error"; text: string }[] }) {
  const { t, rt } = useT();
  const s = useRot();
  const [tab, setTab] = useState<"p" | "d">("p");
  const pCols: Col[] = [{ key: "idx", label: "#", width: 40 }, { key: "id", label: "calisan_id", editable: true, width: 110 }, { key: "name", label: "ad", editable: true, width: 220 }];
  const pRows: TRow[] = s.people.map((p, k) => ({ id: k + 2, cells: { idx: k + 1, ...p } }));
  const nCols: Col[] = [
    { key: "no", label: "defter_no", width: 80 }, { key: "name", label: "ad", editable: true, width: 160 },
    { key: "weight", label: t("v2core.r1.v.weight"), type: "num", editable: true, width: 70 }, { key: "group", label: t("v2core.r1.v.group"), type: "num", editable: true, width: 80 },
    { key: "special", label: t("v2core.r1.v.special"), type: "bool", editable: true, width: 120 },
  ];
  const nRows: TRow[] = s.notebooks.map((d, k) => ({ id: k + 2, cells: { ...d, group: d.group < 0 ? "" : d.group } }));
  return (
    <div className="space-y-3">
      <div className="inline-flex rounded-md border border-slate-300 p-0.5" role="tablist">
        {([["p", t("v2core.r1.v.people", { n: s.n })], ["d", t("v2core.r1.v.nbs", { n: s.n })]] as const).map(([k, l]) => (
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
      <Collapsible title={t("v2core.r1.v.fieldsTitle")}>{rt("v2core.r1.v.fields")}</Collapsible>
    </div>
  );
}

/* ---------- 5. Özel koşullar ---------- */
function StepOzel() {
  const { t } = useT();
  const s = useRot();
  const { people, notebooks, m } = s;
  const [fp, setFp] = useState({ p: 0, d: 0 });
  const [fx, setFx] = useState({ t: 0, p: 0, d: 0 });
  const lab = (list: { name?: string }[], k: number) => `${k + 1} · ${list[k]?.name ?? ""}`;
  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-2">
        <Card title={t("v2core.r1.o.forbTitle", { n: s.forbidden.length })}>
          <p className="mb-2 text-[12px] text-slate-600">{t("v2core.r1.o.forbDesc")}</p>
          <div className="flex flex-wrap items-end gap-2">
            <select className={`${inputCls} w-44`} value={fp.p} onChange={(e) => setFp({ ...fp, p: Number(e.target.value) })} aria-label={t("v2core.r1.o.forbPerson")}>{people.map((_, k) => <option key={k} value={k}>{lab(people, k)}</option>)}</select>
            <select className={`${inputCls} w-44`} value={fp.d} onChange={(e) => setFp({ ...fp, d: Number(e.target.value) })} aria-label={t("v2core.r1.o.forbNb")}>{notebooks.map((_, k) => <option key={k} value={k}>{lab(notebooks, k)}</option>)}</select>
            <Button size="sm" onClick={() => !s.forbidden.some(([p, d]) => p === fp.p && d === fp.d) && s.patch({ forbidden: [...s.forbidden, [fp.p, fp.d]] })}>{t("c.add")}</Button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {s.forbidden.map(([p, d], k) => <Badge key={k} tone="red">{people[p]?.name} ✕ {notebooks[d]?.name} <button aria-label={t("c.remove")} onClick={() => s.patch({ forbidden: s.forbidden.filter((_, q) => q !== k) })}><Trash2 className="inline h-3 w-3" /></button></Badge>)}
            {s.forbidden.length === 0 && <span className="text-[12px] text-slate-500">{t("v2core.r1.o.forbNone")}</span>}
          </div>
          {s.forbidden.length > 0 && <div className="mt-2"><InfoCard tone="warn">{t("v2core.r1.o.forbWarn")}</InfoCard></div>}
        </Card>
        <Card title={t("v2core.r1.o.fixTitle", { n: s.fixed.length })}>
          <p className="mb-2 text-[12px] text-slate-600">{t("v2core.r1.o.fixDesc")}</p>
          <div className="flex flex-wrap items-end gap-2">
            <select className={`${inputCls} w-28`} value={fx.t} onChange={(e) => setFx({ ...fx, t: Number(e.target.value) })} aria-label={t("v2core.r1.o.fixMonth")}>{Array.from({ length: m }, (_, k) => <option key={k} value={k}>{t("v2core.r1.o.monthN", { n: k + 1 })}</option>)}</select>
            <select className={`${inputCls} w-40`} value={fx.p} onChange={(e) => setFx({ ...fx, p: Number(e.target.value) })} aria-label={t("v2core.r1.o.fixPerson")}>{people.map((_, k) => <option key={k} value={k}>{lab(people, k)}</option>)}</select>
            <select className={`${inputCls} w-40`} value={fx.d} onChange={(e) => setFx({ ...fx, d: Number(e.target.value) })} aria-label={t("v2core.r1.o.fixNb")}>{notebooks.map((_, k) => <option key={k} value={k}>{lab(notebooks, k)}</option>)}</select>
            <Button size="sm" onClick={() => !s.fixed.some((f) => f.month === fx.t && (f.person === fx.p || f.notebook === fx.d)) && s.patch({ fixed: [...s.fixed, { month: fx.t, person: fx.p, notebook: fx.d }] })}>{t("c.add")}</Button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {s.fixed.map((f, k) => <Badge key={k} tone="blue">{t("v2core.r1.o.monthN", { n: f.month + 1 })}: {people[f.person]?.name} = {notebooks[f.notebook]?.name} <button aria-label={t("c.remove")} onClick={() => s.patch({ fixed: s.fixed.filter((_, q) => q !== k) })}><Trash2 className="inline h-3 w-3" /></button></Badge>)}
            {s.fixed.length === 0 && <span className="text-[12px] text-slate-500">{t("v2core.r1.o.fixNone")}</span>}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ---------- 6. Özet ---------- */
function StepOzet({ T, limit, statuses, jump }: { T: ReturnType<typeof calcTargets>; limit: number; statuses: Record<string, { s: Status; note?: string }>; jump: (k: number) => void }) {
  const { t } = useT();
  const s = useRot();
  const sp = specialOf(s).map((k) => s.notebooks[k]?.no);
  const probs = Object.entries(statuses).filter(([, v]) => v.s !== "ok" && v.note);
  const rows: [string, string, number][] = [
    [t("v2core.r1.s.period"), t("v2core.r1.s.periodVal", { a: monthName(s.startMonth - 1), y: s.year, m: s.m }), 0],
    [t("v2core.r1.s.k1"), s.g === 0 ? t("v2core.r1.s.off") : `G = ${s.g}`, 1],
    [t("v2core.r1.s.k2"), s.pairOverride === null ? t("v2core.r1.s.k2auto", { n: limit }) : t("v2core.r1.s.k2val", { n: limit }), 1],
    [t("v2core.r1.s.k6"), s.specialGap === 0 || !sp.length ? t("v2core.r1.s.off") : t("v2core.r1.s.k6val", { list: sp.join(", "), gap: s.specialGap === 1 ? t("v2core.r1.s.consec") : t("v2core.r1.s.gapN", { n: s.specialGap }) }), 1],
    [t("v2core.r1.s.k5"), s.useGroups ? t("v2core.r1.s.on") : t("v2core.r1.s.off"), 1],
    [t("v2core.r1.s.pnb"), `${s.n} / ${s.n}`, 2],
    [t("v2core.r1.s.leaves"), t("v2core.r1.s.leavesVal", { n: s.leaves.filter((l) => l.included).length, p: s.leaveThreshold * 100, strat: s.strategy === "ek" ? t("v2core.r1.s.stratEk") : t("v2core.r1.s.stratBos") }), 3],
    [t("v2core.r1.s.spec"), t("v2core.r1.s.specVal", { f: s.forbidden.length, x: s.fixed.length }), 4],
    [t("v2core.r1.s.seed"), t("v2core.r1.s.seedVal", { seed: s.seed, s: s.timeMs / 1000 }), 1],
  ];
  return (
    <div className="space-y-3" data-testid="r1-summary">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label={t("v2core.r1.st.n")} value={s.n} />
        <Stat label={t("v2core.r1.st.D")} value={T.D} />
        <Stat label={t("v2core.r1.st.t")} value={`${Math.min(...T.lo.flat())}–${Math.max(...T.hi.flat())}`} />
        <Stat label={t("v2core.r1.st.pair")} value={limit} />
      </div>
      {probs.map(([k, v]) => <InfoCard key={k} tone={v.s === "error" ? "error" : "warn"} title={stepTitle(t, k as (typeof STEPS)[number]["key"])}>{v.note}</InfoCard>)}
      <Card title={t("v2core.r1.s.card")}>
        <ul className="divide-y divide-slate-100">
          {rows.map(([a, b, k]) => (
            <li key={a} className="flex items-center justify-between gap-3 py-1.5 text-[12.5px]">
              <span className="font-medium text-slate-800">{a}</span>
              <span className="flex items-center gap-2 text-slate-600">{b}<button onClick={() => jump(k)} className="text-xs text-sky-700 underline">{t("c.edit")}</button></span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
