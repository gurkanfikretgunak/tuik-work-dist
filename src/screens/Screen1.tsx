"use client";
import { useMemo, useState } from "react";
import { Download, Save, Settings2, FileUp, ArrowRight } from "lucide-react";
import { useConfirm, Modal } from "@/components/confirm";
import { DataTable, type Col, type TRow } from "@/components/DataTable";
import { FileDrop } from "@/components/FileDrop";
import { Badge, Button, Card, Collapsible, Field, InfoCard, ScreenTitle, Stat, inputCls } from "@/components/ui";
import { useT } from "@/i18n";
import { parseEmployees, revalidateEmployee, toCsv, yesNo, EMP_COLS } from "@/lib/csv";
import { effCap, round1 } from "@/lib/engine";
import { activeEmployees, saveSet, useStore } from "@/lib/store";
import { download } from "@/lib/share";
import type { EmpRow, Employee } from "@/lib/types";

export default function Screen1() {
  const confirm = useConfirm();
  const { t, rt, locale } = useT();
  const { employees, empFile, empConfirmed, rules, setEmployees, patchEmployees, setEmpConfirmed, go, log } = useStore();
  const [bulk, setBulk] = useState(false);
  const [miss, setMiss] = useState<string[]>([]);

  const onText = async (text: string, name: string) => {
    const r = parseEmployees(text);
    if (r.fatal) {
      setMiss(r.missingColumns);
      return;
    }
    setMiss([]);
    const bad = r.rows.filter((x) => x.errors.length).length;
    if (employees.length) {
      const ok = await confirm({ title: t("v1ui.s1.replace.title"), body: t("v1ui.s1.replace.body"), confirmLabel: t("v1ui.replace"), tone: "danger" });
      if (!ok) return;
    }
    setEmployees(r.rows, { name, total: r.rows.length, errorRows: bad, at: new Date().toISOString() });
    log("personel_yuklendi", t("v1ui.s1.log.loaded", { name, rows: r.rows.length, bad }), { dosya: name, satir: r.rows.length, hatali: bad });
  };

  const loadSample = async () => {
    const csv = await (await fetch("/ornek/calisanlar.csv")).text();
    onText(csv, `calisanlar.csv (${t("v1ui.exampleWord")})`);
  };

  const toggle = (id: number) => patchEmployees((rs) => rs.map((r) => (r.rowNo === id ? (r.errors.length && !r.included ? r : { ...r, included: !r.included }) : r)));
  const toggleAll = (c: boolean, ids: number[]) => {
    const s = new Set(ids);
    patchEmployees((rs) => rs.map((r) => (s.has(r.rowNo) && (!c || r.errors.length === 0) ? { ...r, included: c } : r)));
  };

  const edit = (id: number, key: string, value: string | boolean) => {
    const row = employees.find((r) => r.rowNo === id);
    if (!row) return;
    const d: Employee = { ...row.data };
    if (key === "donemlik_kapasite" || key === "musait_oran") (d as Record<string, unknown>)[key] = Number(String(value).replace(",", ".")) || 0;
    else (d as Record<string, unknown>)[key] = value;
    const errors = revalidateEmployee(d);
    patchEmployees((rs) => rs.map((r) => (r.rowNo === id ? { ...r, data: d, errors, included: r.included && errors.length === 0 } : r)));
    if (key === "donemlik_kapasite" || key === "musait_oran" || key === "aktif" || key === "kir_gorevi_yapabilir")
      log("kapasite_degisti", t("v1ui.s1.log.edit", { id: d.calisan_id, key, val: typeof value === "boolean" ? (value ? t("c.yes") : t("c.no")) : value }), { calisan: d.calisan_id, alan: key });
  };

  const rows: TRow[] = employees.map((r) => ({
    id: r.rowNo,
    cells: { ...r.data, efektif: round1(effCap(r.data)) },
    errors: r.errors,
    checked: r.included,
    dim: !r.included,
  }));

  const cols: Col[] = [
    { key: "calisan_id", label: "calisan_id", width: 90 },
    { key: "ad_soyad", label: "ad_soyad", width: 140 },
    { key: "rol", label: "rol", width: 80 },
    { key: "il", label: "il", width: 90 },
    { key: "ilce", label: "ilce", width: 90 },
    { key: "donemlik_kapasite", label: "donemlik_kapasite", type: "num", editable: true, width: 120 },
    { key: "musait_oran", label: "musait_oran %", type: "num", editable: true, width: 100 },
    { key: "efektif", label: t("v1ui.s1.col.eff"), type: "num", width: 100 },
    { key: "kir_gorevi_yapabilir", label: t("v1ui.s1.col.kir"), type: "bool", editable: true, width: 80 },
    { key: "aktif", label: "aktif", type: "bool", editable: true, width: 60 },
    { key: "kapasite_notu", label: "kapasite_notu", editable: true, width: 200 },
  ];

  const act = useMemo(() => activeEmployees(employees), [employees]);
  const activeOnes = useMemo(() => act.filter((e) => e.aktif), [act]);
  const total = activeOnes.reduce((s, e) => s + effCap(e), 0);
  const byIl = useMemo(() => {
    const m = new Map<string, { n: number; cap: number }>();
    for (const e of activeOnes) {
      const x = m.get(e.il) ?? { n: 0, cap: 0 };
      x.n++;
      x.cap += effCap(e);
      m.set(e.il, x);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], locale));
  }, [activeOnes, locale]);

  const warnings: string[] = [];
  for (const e of act) {
    if (e.aktif && effCap(e) === 0) warnings.push(t("v1ui.s1.w.zero", { id: e.calisan_id, name: e.ad_soyad }));
    else if (e.donemlik_kapasite > 100) warnings.push(t("v1ui.s1.w.high", { id: e.calisan_id, cap: e.donemlik_kapasite }));
  }
  const caps = act.map((e) => e.donemlik_kapasite).filter((x) => x > 0);
  if (caps.length > 3) {
    const mean = caps.reduce((a, b) => a + b, 0) / caps.length;
    for (const e of act) if (e.donemlik_kapasite > mean * 2.5) warnings.push(t("v1ui.s1.w.mean", { id: e.calisan_id, mean: Math.round(mean) }));
  }

  const exportCsv = async () => {
    const ok = await confirm({ title: t("v1ui.s1.exp.title"), body: t("v1ui.s1.exp.body"), confirmLabel: t("c.download") });
    if (!ok) return;
    download("calisanlar.csv", toCsv(employees.filter((r) => r.included).map((r) => ({ ...r.data, kir_gorevi_yapabilir: yesNo(r.data.kir_gorevi_yapabilir), aktif: yesNo(r.data.aktif) })), EMP_COLS), "text/csv;charset=utf-8");
    log("indirme", t("v1ui.s1.exp.log"));
  };

  const save = async () => {
    const ok = await confirm({ title: t("v1ui.s1.save.title"), body: t("v1ui.s1.save.body"), confirmLabel: t("v1ui.save") });
    if (!ok) return;
    saveSet({ employees, rules, savedAt: new Date().toISOString() });
    log("oturum", t("v1ui.s1.save.log"));
  };

  const next = async () => {
    const noIl = act.length === 0;
    if (noIl) return;
    const ok = await confirm({
      title: t("v1ui.s1.next.title"),
      body: rt("v1ui.s1.next.body", { rows: act.length, active: activeOnes.length, cap: round1(total) }),
      confirmLabel: t("v1ui.confirmContinue"),
    });
    if (!ok) return;
    setEmpConfirmed(true);
    log("personel_onaylandi", t("v1ui.s1.next.log", { rows: act.length, cap: round1(total) }), { aktif: activeOnes.length, kapasite: round1(total) });
    go(2);
  };

  return (
    <div>
      <ScreenTitle no={1} title={t("v1ui.s1.title")}>
        <Button onClick={loadSample} data-testid="load-sample-emp">
          <FileUp className="h-3.5 w-3.5" /> {t("v1ui.sample")}
        </Button>
      </ScreenTitle>

      <div className="mb-3 space-y-2">
        <Collapsible title={t("v1ui.s1.help.title")}>
          <ul className="list-inside list-disc space-y-0.5">
            <li>{rt("v1ui.s1.help.1")}</li>
            <li>{t("v1ui.s1.help.2")}</li>
            <li>{rt("v1ui.s1.help.3")}</li>
            <li>{t("v1ui.s1.help.4")}</li>
          </ul>
        </Collapsible>
      </div>

      {miss.length > 0 && (
        <div className="mb-3">
          <InfoCard tone="error" title={t("v1ui.fileErr")}>
            {t("v1ui.fatal.missing", { cols: miss.join(", ") })}
          </InfoCard>
        </div>
      )}

      {employees.length === 0 ? (
        <FileDrop onText={onText} label={t("v1ui.s1.drop")} />
      ) : (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-5">
            <Stat label={t("v1ui.s1.stat.rows")} value={act.length} sub={t("v1ui.stat.rowsTotal", { n: employees.length })} />
            <Stat label={t("v1ui.s1.stat.active")} value={activeOnes.length} />
            <Stat label={t("v1ui.s1.stat.cap")} value={round1(total)} />
            <Stat label={t("v1ui.stat.ilCount")} value={byIl.length} />
            <Stat label={t("v1ui.stat.badRows")} value={employees.filter((r) => r.errors.length).length} tone={employees.some((r) => r.errors.length) ? "red" : "green"} />
          </div>

          <div className="mb-3 grid gap-3 lg:grid-cols-3">
            <Card title={t("v1ui.s1.byIl.title")} className="lg:col-span-2">
              <div className="flex flex-wrap gap-2">
                {byIl.map(([il, x]) => (
                  <div key={il} className="rounded border border-slate-200 px-2.5 py-1.5">
                    <div className="text-xs font-semibold text-[#1F2A44]">{il}</div>
                    <div className="text-[11.5px] text-slate-600">
                      {t("v1ui.s1.byIl.item", { n: x.n, cap: round1(x.cap) })}
                    </div>
                  </div>
                ))}
                {byIl.length === 0 && <span className="text-slate-500">{t("v1ui.s1.byIl.none")}</span>}
              </div>
            </Card>
            <Card title={t("v1ui.s1.warn.title")}>
              {warnings.length === 0 && !employees.some((r) => r.errors.length) ? (
                <Badge tone="green">{t("v1ui.s1.warn.none")}</Badge>
              ) : (
                <ul className="max-h-24 list-inside list-disc space-y-0.5 overflow-auto text-[12px] text-amber-900">
                  {employees.filter((r) => r.errors.length).map((r) => (
                    <li key={r.rowNo} className="text-red-800">
                      {t("v1ui.s1.warn.row", { row: r.rowNo, errs: r.errors.map((e) => `${e.col} ${e.msg}`).join("; ") })}
                    </li>
                  ))}
                  {warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <DataTable
            sheetName={empFile?.name ?? "calisanlar.csv"}
            columns={cols}
            rows={rows}
            onToggle={toggle}
            onToggleAll={toggleAll}
            onEdit={edit}
            height={380}
            toolbar={
              <>
                <Button size="sm" onClick={() => setBulk(true)} data-testid="bulk-open">
                  <Settings2 className="h-3.5 w-3.5" /> {t("v1ui.s1.bulkOpen")}
                </Button>
                <Button size="sm" onClick={exportCsv}>
                  <Download className="h-3.5 w-3.5" /> {t("v1ui.s1.exportBtn")}
                </Button>
                <Button size="sm" onClick={save}>
                  <Save className="h-3.5 w-3.5" /> {t("v1ui.s1.saveBtn")}
                </Button>
              </>
            }
          />
        </>
      )}

      {employees.length > 0 && (
        <div className="mt-3 flex items-center justify-between">
          <Button onClick={() => go(0)}>{t("v1ui.s1.toWelcome")}</Button>
          <div className="flex items-center gap-2">
            {empConfirmed && <Badge tone="green">{t("v1ui.confirmed")}</Badge>}
            <Button variant="primary" onClick={next} disabled={act.length === 0} data-testid="emp-next">
              {t("v1ui.s1.nextBtn")} <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      <BulkModal open={bulk} onClose={() => setBulk(false)} rows={employees} />
    </div>
  );
}

function BulkModal({ open, onClose, rows }: { open: boolean; onClose: () => void; rows: EmpRow[] }) {
  const confirm = useConfirm();
  const { t, locale } = useT();
  const { patchEmployees, log } = useStore();
  const [scope, setScope] = useState("secili");
  const [value, setValue] = useState("");
  const [field, setField] = useState<"donemlik_kapasite" | "musait_oran">("donemlik_kapasite");
  const [op, setOp] = useState<"set" | "inc" | "dec">("set");
  const iller = [...new Set(rows.map((r) => r.data.il))].sort((a, b) => a.localeCompare(b, locale));
  const roller = [...new Set(rows.map((r) => r.data.rol).filter(Boolean))];

  const match = (r: EmpRow) => {
    if (scope === "secili") return r.included;
    if (scope === "tumu") return true;
    if (scope.startsWith("il:")) return r.data.il === scope.slice(3) && r.included;
    if (scope.startsWith("rol:")) return r.data.rol === scope.slice(4) && r.included;
    return false;
  };
  const n = rows.filter(match).length;
  const num = Number(value.replace(",", "."));
  const valid = value !== "" && Number.isFinite(num) && num >= 0;

  const apply = async () => {
    const lbl = field === "donemlik_kapasite" ? t("v1ui.bulk.l.cap") : t("v1ui.bulk.l.avail");
    const opLbl = op === "set" ? t("v1ui.bulk.d.set", { v: num }) : op === "inc" ? t("v1ui.bulk.d.inc", { v: num }) : t("v1ui.bulk.d.dec", { v: num });
    const ok = await confirm({ title: t("v1ui.bulk.confirm.title"), body: t("v1ui.bulk.confirm.body", { n, field: lbl, op: opLbl }), confirmLabel: t("v1ui.apply") });
    if (!ok) return;
    patchEmployees((rs) =>
      rs.map((r) => {
        if (!match(r)) return r;
        const cur = r.data[field];
        let v = op === "set" ? num : op === "inc" ? cur * (1 + num / 100) : cur * (1 - num / 100);
        v = Math.max(0, Math.round(v * 10) / 10);
        if (field === "musait_oran") v = Math.min(100, v);
        const d = { ...r.data, [field]: v };
        const errors = revalidateEmployee(d);
        return { ...r, data: d, errors };
      }),
    );
    log("kapasite_degisti", t("v1ui.bulk.log", { n, field: lbl, op: opLbl, scope }), { kisi: n, alan: field, islem: op, deger: num, kapsam: scope });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("v1ui.bulk.title")}
      footer={
        <>
          <Button onClick={onClose}>{t("c.cancel")}</Button>
          <Button variant="primary" disabled={!valid || n === 0} onClick={apply} data-testid="bulk-apply">
            {t("v1ui.bulk.applyN", { n })}
          </Button>
        </>
      }
    >
      <div className="space-y-2.5">
        <Field label={t("v1ui.bulk.scope")}>
          <select className={inputCls} value={scope} onChange={(e) => setScope(e.target.value)} aria-label={t("v1ui.bulk.scope")}>
            <option value="secili">{t("v1ui.bulk.scope.sel")}</option>
            <option value="tumu">{t("v1ui.bulk.scope.all")}</option>
            {iller.map((i) => (
              <option key={i} value={`il:${i}`}>
                {t("v1ui.bulk.scope.il", { v: i })}
              </option>
            ))}
            {roller.map((i) => (
              <option key={i} value={`rol:${i}`}>
                {t("v1ui.bulk.scope.rol", { v: i })}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("v1ui.bulk.field")}>
          <select className={inputCls} value={field} onChange={(e) => setField(e.target.value as typeof field)} aria-label={t("v1ui.bulk.field")}>
            <option value="donemlik_kapasite">{t("v1ui.bulk.f.cap")}</option>
            <option value="musait_oran">{t("v1ui.bulk.f.avail")}</option>
          </select>
        </Field>
        <Field label={t("v1ui.bulk.op")}>
          <select className={inputCls} value={op} onChange={(e) => setOp(e.target.value as typeof op)} aria-label={t("v1ui.bulk.op")}>
            <option value="set">{t("v1ui.bulk.op.set")}</option>
            <option value="inc">{t("v1ui.bulk.op.inc")}</option>
            <option value="dec">{t("v1ui.bulk.op.dec")}</option>
          </select>
        </Field>
        <Field label={op === "set" ? t("v1ui.bulk.value") : t("v1ui.bulk.percent")} hint={t("v1ui.bulk.hint")}>
          <input className={inputCls} value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" aria-label={t("v1ui.bulk.value")} data-testid="bulk-value" />
        </Field>
        <InfoCard>{t("v1ui.bulk.info", { n })}</InfoCard>
      </div>
    </Modal>
  );
}
