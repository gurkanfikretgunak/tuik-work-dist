"use client";
import { ArrowRight, Plus, Trash2 } from "lucide-react";
import { useConfirm } from "@/components/confirm";
import { Badge, Button, Card, Collapsible, Field, InfoCard, ScreenTitle, inputCls } from "@/components/ui";
import { monthName, useT } from "@/i18n";
import { calcMath, specialWarnings } from "../rotation/math";
import { layoutError, weeklyOf, type Notebook } from "./model";
import L from "./L";
import { useRot2 } from "./store";

const num = (v: string, min: number, max: number) => Math.max(min, Math.min(max, Math.floor(Number(v) || min)));

export default function P() {
  const confirm = useConfirm();
  const { t, rt } = useT();
  const s = useRot2();
  const err = layoutError(s.n, s.regions);
  const sum = s.regions.reduce((a, r) => a + r.size, 0);
  const mathx = calcMath(s.n, s.m, s.g);
  const warns = [...specialWarnings(s.n, weeklyOf(s.inside).length, s.specialGap), ...specialWarnings(s.n, weeklyOf(s.outside).length, s.specialGap)];
  const regionName = (i: number) => s.regions[i]?.name || t("v4.def.region", { n: i + 1 });

  const preset = async () => {
    if (!(await confirm({ title: t("v4.p.preset"), body: t("v4.p.preset.body"), confirmLabel: t("c.confirm") }))) return;
    s.loadReference();
  };
  const next = async () => {
    if (!(await confirm({ title: t("v4.p.next.title"), body: rt("v4.p.next.body", { n: s.n, m: s.m }), confirmLabel: t("v4.p.next") }))) return;
    s.addLog(t("v4.p.log", { n: s.n, m: s.m }));
    s.go(1);
  };

  const nbTable = (tier: "inside" | "outside") => (
    <div className="overflow-auto">
      <table className="w-full text-[12.5px]">
        <thead className="text-left text-slate-500">
          <tr><th className="w-8">#</th><th>{t("v4.p.nb.code")}</th>{tier === "outside" && <th>{t("v4.p.nb.region")}</th>}<th>{t("v4.p.nb.weekly")}</th></tr>
        </thead>
        <tbody>
          {s[tier].map((d: Notebook, i: number) => (
            <tr key={i} className="border-t border-slate-100">
              <td className="text-slate-500">{i + 1}</td>
              <td><input className={`${inputCls} !h-7 w-28`} value={d.code} onChange={(e) => s.setNotebook(tier, i, { code: e.target.value })} aria-label={t("v4.p.nb.code")} /></td>
              {tier === "outside" && <td>{d.region >= 0 ? regionName(d.region) : ""}</td>}
              <td><input type="checkbox" checked={d.weekly} onChange={(e) => s.setNotebook(tier, i, { weekly: e.target.checked })} aria-label={t("v4.p.nb.weekly")} data-testid={`weekly-${tier}-${i}`} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl">
      <ScreenTitle no={0} title={t("v4.p.title")} />
      <div className="mb-3"><Collapsible title={t("v4.p.intro.title")} defaultOpen>{rt("v4.p.intro.body")}</Collapsible></div>

      <Card title={t("v4.p.general")} right={<Button size="sm" onClick={preset} data-testid="v4-preset">{t("v4.p.preset")}</Button>}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Field label={t("v4.p.n")} hint={t("v4.p.n.hint")}><input type="number" min={4} max={60} className={inputCls} value={s.n} onChange={(e) => s.setN(num(e.target.value, 4, 60))} data-testid="v4-n" /></Field>
          <Field label={t("v4.p.m")}><input type="number" min={2} max={36} className={inputCls} value={s.m} onChange={(e) => s.patch({ m: num(e.target.value, 2, 36) })} /></Field>
          <Field label={t("v4.p.year")}><input type="number" className={inputCls} value={s.year} onChange={(e) => s.patch({ year: num(e.target.value, 2000, 2200) })} /></Field>
          <Field label={t("v4.p.start")}>
            <select className={inputCls} value={s.startMonth} onChange={(e) => s.patch({ startMonth: Number(e.target.value) })}>
              {Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{monthName(i)}</option>)}
            </select>
          </Field>
          <Field label={t("v4.p.g")}><input type="number" min={0} max={6} className={inputCls} value={s.g} onChange={(e) => s.patch({ g: num(e.target.value, 0, 6) })} /></Field>
          <Field label={t("v4.p.gap")}><input type="number" min={0} max={6} className={inputCls} value={s.specialGap} onChange={(e) => s.patch({ specialGap: num(e.target.value, 0, 6) })} /></Field>
          <Field label={t("v4.p.seed")}><input type="number" className={inputCls} value={s.seed} onChange={(e) => s.patch({ seed: num(e.target.value, 0, 999999) })} /></Field>
        </div>
        <div className="mt-2 text-[12px] text-slate-600">{t("v4.p.pair", { p: mathx.pairLower })}</div>
        <div className="mt-2 space-y-1.5">{warns.map((w) => <InfoCard key={w.text} tone={w.tone}>{w.text}</InfoCard>)}</div>
      </Card>

      <Card title={t("v4.p.regions")} className="mt-3" right={<Button size="sm" onClick={() => s.addRegion()}><Plus className="h-3 w-3" /> {t("v4.p.region.add")}</Button>}>
        <div className="space-y-1.5">
          {s.regions.map((r, i) => (
            <div key={i} className="flex flex-wrap items-end gap-2">
              <Field label={t("v4.p.region.name")}><input className={`${inputCls} w-44`} placeholder={t("v4.def.region", { n: i + 1 })} value={r.name} onChange={(e) => s.setRegion(i, { name: e.target.value })} /></Field>
              <Field label={t("v4.p.region.code")}><input className={`${inputCls} w-20`} value={r.code} onChange={(e) => s.setRegion(i, { code: e.target.value.slice(0, 4) })} /></Field>
              <Field label={t("v4.p.region.size")}><input type="number" min={1} max={s.n} className={`${inputCls} w-20`} value={r.size} onChange={(e) => s.setRegion(i, { size: num(e.target.value, 1, s.n) })} data-testid={`region-size-${i}`} /></Field>
              <Button size="sm" variant="ghost" disabled={s.regions.length <= 1} onClick={() => s.removeRegion(i)} aria-label={t("v4.p.region.remove")}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2 text-[12.5px]">
          <Badge tone={err ? "red" : "green"}>{t("v4.p.regions.sum", { a: sum, n: s.n })}</Badge>
          {err && <span className="text-[#C92830]">{t("v4.p.regions.bad", { n: s.n })}</span>}
        </div>
      </Card>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Card title={t("v4.p.nb.inside")}>{nbTable("inside")}</Card>
        <Card title={t("v4.p.nb.outside")}>{err ? <InfoCard tone="warn">{t("v4.p.regions.bad", { n: s.n })}</InfoCard> : nbTable("outside")}</Card>
      </div>

      <Card title={t("v4.p.people")} className="mt-3">
        <div className="grid gap-1.5 md:grid-cols-2">
          {s.people.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <input className={`${inputCls} w-24`} value={p.id} onChange={(e) => s.setPerson(i, { id: e.target.value })} aria-label={t("v4.p.person.id")} />
              <input className={inputCls} placeholder={t("v4.def.person", { n: i + 1 })} value={p.name} onChange={(e) => s.setPerson(i, { name: e.target.value })} aria-label={t("v4.p.person.name")} />
            </div>
          ))}
        </div>
      </Card>

      <L />

      <div className="mt-3 flex justify-end">
        <Button variant="primary" disabled={!!err || !mathx.feasible} onClick={next} data-testid="v4-next0">{t("v4.p.next")} <ArrowRight className="h-3.5 w-3.5" /></Button>
      </div>
    </div>
  );
}
