"use client";
import { useMemo, useState } from "react";
import { useConfirm } from "@/components/confirm";
import { DataTable, type Col, type TRow } from "@/components/DataTable";
import { FileDrop } from "@/components/FileDrop";
import { monthName, useT } from "@/i18n";
import { Badge, Button, Card, Collapsible, Field, InfoCard, Stat, inputCls } from "@/components/ui";
import { parseLeaveCsv, planWindow, validateLeave } from "./leave";
import { calcTargets } from "./math";
import { absenceOf } from "./params";
import { useRot } from "./store";

const r1 = (x: number) => Math.round(x * 10) / 10;

export default function LeaveSection() {
  const confirm = useConfirm();
  const { t, rt } = useT();
  const s = useRot();
  const { people, leaves, m, startMonth, year } = s;
  const [form, setForm] = useState({ p: people[0]?.id ?? "", a: "", b: "", note: "" });
  const [fatal, setFatal] = useState("");
  const ids = people.map((p) => p.id);
  const [w0, w1] = planWindow(startMonth, year, m);
  const ab = useMemo(() => absenceOf(s), [s.leaves, s.people, s.startMonth, s.year, s.m, s.leaveThreshold]); // eslint-disable-line react-hooks/exhaustive-deps
  const T = useMemo(() => calcTargets(s.n, m, ab.absent, s.strategy), [s.n, m, ab, s.strategy]);

  const nextId = () => Math.max(0, ...leaves.map((l) => l.id)) + 1;
  const add = () => {
    const l = { id: nextId(), personId: form.p, start: form.a, end: form.b || form.a, note: form.note, included: true };
    if (validateLeave(l, ids, w0, w1).length) return;
    s.patch({ leaves: [...leaves, l] });
    setForm({ ...form, a: "", b: "", note: "" });
  };
  const formErr = form.a ? validateLeave({ id: 0, personId: form.p, start: form.a, end: form.b || form.a, note: "", included: true }, ids, w0, w1) : [];

  const onCsv = async (text: string, name: string) => {
    const r = parseLeaveCsv(text);
    if (r.fatal) return setFatal(r.fatal);
    setFatal("");
    if (leaves.length && !(await confirm({ title: t("v2core.lv.rep.title"), body: t("v2core.lv.rep.body", { name, n: r.rows.length }), confirmLabel: t("v2core.lv.rep.ok"), tone: "danger" }))) return;
    s.patch({ leaves: r.rows.map((x, i) => ({ ...x, id: i + 1 })) });
    s.addLog(t("v2core.lv.log", { name, n: r.rows.length }));
  };

  const cols: Col[] = [
    { key: "personId", label: "calisan_id", editable: true, width: 100 },
    { key: "start", label: "baslangic", editable: true, width: 110 },
    { key: "end", label: "bitis", editable: true, width: 110 },
    { key: "gun", label: t("v2core.lv.col.days"), type: "num", width: 50 },
    { key: "note", label: "not", editable: true, width: 160 },
  ];
  const rows: TRow[] = leaves.map((l) => {
    const errors = validateLeave(l, ids, w0, w1);
    const a = Date.parse(l.start), b = Date.parse(l.end);
    return { id: l.id, cells: { ...l, gun: Number.isFinite(a) && Number.isFinite(b) ? Math.round((b - a) / 86400000) + 1 : "" }, errors, checked: l.included && errors.length === 0, dim: !l.included };
  });

  const absentCells = ab.absent.flat().filter(Boolean).length;
  const partialCells = ab.partial.flat().filter(Boolean).length;
  const lows = T.Dp.map((d) => d);
  const person = (i: number) => people[i]?.name ?? "";

  return (
    <Card title={t("v2core.lv.title")} className="mt-3">
      <div className="mb-3">
        <Collapsible title={t("v2core.lv.help.title")}>
          <ul className="list-inside list-disc space-y-0.5">
            <li>{t("v2core.lv.help.1")}</li>
            <li>{rt("v2core.lv.help.2")}</li>
            <li>{rt("v2core.lv.help.3")}</li>
            <li>{rt("v2core.lv.help.4")}</li>
          </ul>
        </Collapsible>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="space-y-2.5">
          <Field label={t("v2core.lv.th.label")} hint={t("v2core.lv.th.hint")}>
            <select className={inputCls} value={s.leaveThreshold} onChange={(e) => s.patch({ leaveThreshold: Number(e.target.value) })} aria-label={t("v2core.lv.th.aria")}>
              {[0.25, 0.5, 0.75, 1].map((x) => <option key={x} value={x}>%{x * 100}{x === 0.5 ? ` ${t("v2core.lv.recommended")}` : ""}</option>)}
            </select>
          </Field>
          <Field label={t("v2core.lv.strat.label")}>
            <select className={inputCls} value={s.strategy} onChange={(e) => s.patch({ strategy: e.target.value as "ek" | "bos" })} aria-label={t("v2core.lv.strat.aria")}>
              <option value="ek">{t("v2core.lv.strat.ek")}</option>
              <option value="bos">{t("v2core.lv.strat.bos")}</option>
            </select>
          </Field>
          <div className="rounded border border-slate-200 p-2">
            <div className="mb-1 text-xs font-semibold text-slate-600">{t("v2core.lv.add.title")}</div>
            <div className="space-y-1.5">
              <select className={inputCls} value={form.p} onChange={(e) => setForm({ ...form, p: e.target.value })} aria-label={t("v2core.lv.add.person")}>{people.map((p) => <option key={p.id} value={p.id}>{p.id} · {p.name}</option>)}</select>
              <div className="flex gap-1.5">
                <input type="date" className={inputCls} value={form.a} onChange={(e) => setForm({ ...form, a: e.target.value })} aria-label={t("v2core.lv.add.start")} data-testid="leave-start" />
                <input type="date" className={inputCls} value={form.b} onChange={(e) => setForm({ ...form, b: e.target.value })} aria-label={t("v2core.lv.add.end")} data-testid="leave-end" />
              </div>
              <input className={inputCls} placeholder={t("v2core.lv.add.notePh")} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} aria-label={t("v2core.lv.add.noteAria")} />
              {formErr.length > 0 && <div className="text-[11.5px] text-[#C92830]">{formErr.map((e) => e.msg).join("; ")}</div>}
              <Button size="sm" disabled={!form.a || formErr.length > 0} onClick={add} data-testid="leave-add">{t("c.add")}</Button>
              <div className="text-[11px] text-slate-500">{t("v2core.lv.add.hint")}</div>
            </div>
          </div>
          <FileDrop onText={onCsv} label="izinler.csv (calisan_id, baslangic, bitis, not)" />
          {fatal && <InfoCard tone="error">{fatal}</InfoCard>}
        </div>

        <div className="lg:col-span-2">
          <DataTable
            sheetName={t("sheet.leave")}
            columns={cols}
            rows={rows}
            height={230}
            onToggle={(id) => s.patch({ leaves: leaves.map((l) => (l.id === id ? { ...l, included: !l.included } : l)) })}
            onToggleAll={(c, idl) => s.patch({ leaves: leaves.map((l) => (idl.includes(l.id) ? { ...l, included: c } : l)) })}
            onEdit={(id, k, v) => s.patch({ leaves: leaves.map((l) => (l.id === id ? { ...l, [k]: String(v) } : l)) })}
            toolbar={leaves.length > 0 && <Button size="sm" onClick={async () => { if (await confirm({ title: t("v2core.lv.delAll.title"), body: t("v2core.lv.delAll.body", { n: leaves.length }), confirmLabel: t("v2core.lv.delAll.ok"), tone: "danger" })) s.patch({ leaves: [] }); }}>{t("v2core.lv.delAll")}</Button>}
          />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-5" data-testid="d-card">
        <Stat label={t("v2core.lv.st.D")} value={T.D} sub={s.leaves.length ? t("v2core.lv.st.D.noLeave", { n: s.n * m }) : t("v2core.lv.st.D.none")} />
        <Stat label={t("v2core.lv.st.absent")} value={absentCells} sub={t("v2core.lv.st.absent.sub", { n: partialCells })} />
        <Stat label={t("v2core.lv.st.pp")} value={`${r1(Math.min(...lows))}–${r1(Math.max(...lows))}`} />
        <Stat label={t("v2core.lv.st.nb")} value={r1(T.D / s.n)} sub="D / N" />
        <Stat label={t("v2core.lv.st.tgt")} value={`${Math.min(...T.lo.flat())}–${Math.max(...T.hi.flat())}`} sub={t("v2core.lv.st.tgt.sub")} />
      </div>
      {T.badMonths.length > 0 && (
        <div className="mt-2"><InfoCard tone="error" title={t("v2core.lv.bad.title")}>{t("v2core.lv.bad.body", { months: T.badMonths.map((k) => `${k + 1} (${monthName((startMonth - 1 + k) % 12)})`).join(", "), max: T.maxPer })}</InfoCard></div>
      )}
      {absentCells > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5 text-[12px]">
          {ab.absent.flatMap((row, tt) => row.map((x, p) => (x ? <Badge key={`${tt}-${p}`} tone="amber">{t("v2core.lv.absentBadge", { month: monthName((startMonth - 1 + tt) % 12), name: person(p) })}</Badge> : null)))}
        </div>
      )}
    </Card>
  );
}
