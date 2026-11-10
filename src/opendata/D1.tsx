"use client";
import clsx from "clsx";
import { ArrowLeft, Download, ExternalLink } from "lucide-react";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useConfirm } from "@/components/confirm";
import { DataTable, type Col, type TRow } from "@/components/DataTable";
import { Button, Card, Collapsible, Field, InfoCard, ScreenTitle, Stat, inputCls } from "@/components/ui";
import { useT } from "@/i18n";
import { labelOf, pivot, series, toCsv, toRows, varyingDims, type JsData } from "@/lib/jsonstat";
import { download } from "@/lib/share";
import { useOpen, type Filters } from "./store";

const keys = new WeakMap<object, number>();
let keySeq = 0;
/** Yeni veri geldiğinde panel durumunu sıfırlamak için JsData başına kararlı anahtar. */
const jsKey = (js: JsData) => keys.get(js) ?? (keys.set(js, ++keySeq), keySeq);

const COLORS = ["#1F2A44", "#C92830", "#2E7D9A", "#E0A030", "#5B8E3E", "#7A4FA3", "#B5651D", "#3F8F8B", "#9A3B5C", "#6B7280"];

function errText(t: ReturnType<typeof useT>["t"], code: string) {
  if (code === "too_large") return t("v3.err.too_large");
  if (code.startsWith("upstream") || code === "Failed to fetch") return t("v3.err.upstream");
  return t("v3.err.generic", { code });
}

export default function D1() {
  const confirm = useConfirm();
  const { t, locale, lang } = useT();
  const { selected, status, error, struct, js, raw, filters, view, setView, applyFilters, openDataset, go } = useOpen();

  const title = selected ? (lang === "tr" && struct?.titleTr ? struct.titleTr : selected.title) : "";

  if (!selected)
    return (
      <div>
        <ScreenTitle no={1} title={t("v3.d1.title")} />
        <InfoCard tone="warn">{t("v3.d1.none")}</InfoCard>
        <Button className="mt-3" variant="primary" onClick={() => go(0)}>{t("v3.d1.toCatalog")}</Button>
      </div>
    );

  const fmt = (n: number | null) => (n === null ? "" : n.toLocaleString(locale, { maximumFractionDigits: 6 }));

  const dl = async (kind: "csv" | "json") => {
    if (!js) return;
    const file = `${selected.id.replace(/[^A-Za-z0-9_.-]+/g, "_")}.${kind === "csv" ? "csv" : "json"}`;
    const ok = await confirm({
      title: t("v3.d1.dl.title", { what: kind === "csv" ? "CSV" : "JSON-stat" }),
      body: t("v3.d1.dl.body", { n: js.values.size, file }),
      confirmLabel: t("c.download"),
    });
    if (!ok) return;
    if (kind === "csv") download(file, toCsv(js), "text/csv;charset=utf-8");
    else download(file, raw, "application/json");
  };

  return (
    <div>
      <ScreenTitle no={1} title={t("v3.d1.title")}>
        <Button onClick={() => go(0)} data-testid="d1-back"><ArrowLeft className="h-3.5 w-3.5" /> {t("v3.d1.back")}</Button>
        <a className="inline-flex h-8 items-center gap-1.5 rounded border border-slate-300 px-3 text-[13px] hover:bg-slate-50" href={`https://databrowser2.tuik.gov.tr/#/tr/tuik/${encodeURIComponent(selected.id)}`} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /> {t("v3.d1.openSrc")}</a>
      </ScreenTitle>

      <div className="mb-3">
        <h2 className="text-[15px] font-semibold text-[#1F2A44]" data-testid="d1-title">{title}</h2>
        <div className="text-[11.5px] text-slate-500">{selected.path.join("  ›  ")} · <code>{selected.id}</code></div>
      </div>

      {status === "loading" && <InfoCard>{t("v3.d1.loading")}</InfoCard>}
      {status === "error" && (
        <div className="space-y-2">
          <InfoCard tone="error">{errText(t, error)}</InfoCard>
          <Button onClick={() => openDataset(selected)}>{t("v3.d1.retry")}</Button>
        </div>
      )}

      {js && (
        <Body js={js} loading={status === "loading"} filters={filters} fmt={fmt} view={view} setView={setView} apply={applyFilters} dl={dl} sourceId={selected.id} />
      )}
    </div>
  );
}

function Body({ js, loading, filters, fmt, view, setView, apply, dl, sourceId }: {
  js: JsData; loading: boolean; filters: Filters; fmt: (n: number | null) => string; view: "table" | "pivot" | "chart";
  setView: (v: "table" | "pivot" | "chart") => void; apply: (f: Filters) => Promise<void>; dl: (k: "csv" | "json") => void; sourceId: string;
}) {
  const { t } = useT();
  const vary = useMemo(() => varyingDims(js), [js]);
  const time = js.dims.find((d) => d.id === js.timeDim);
  const obs = js.values.size;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label={t("v3.d1.stat.obs")} value={obs.toLocaleString()} />
        <Stat label={t("v3.d1.stat.cells")} value={js.total.toLocaleString()} />
        <Stat label={t("v3.d1.stat.dims")} value={`${vary.length} / ${js.dims.length}`} sub={t("v3.d1.stat.dims.sub")} />
        <Stat label={t("v3.d1.stat.time")} value={time && time.codes.length ? `${time.codes[0]}–${time.codes[time.codes.length - 1]}` : "—"} />
      </div>
      {obs > 50000 && <InfoCard tone="warn">{t("v3.d1.big", { n: obs.toLocaleString() })}</InfoCard>}

      <FilterPanel key={jsKey(js)} js={js} filters={filters} loading={loading} apply={apply} />

      <Card
        title={
          <div className="flex gap-0.5" role="tablist">
            {(["table", "pivot", "chart"] as const).map((v) => (
              <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} data-testid={`view-${v}`}
                className={clsx("rounded px-3 py-1 text-xs font-medium", view === v ? "bg-[#1F2A44] text-white" : "text-slate-700 hover:bg-slate-100")}>{t(`v3.d1.view.${v}`)}</button>
            ))}
          </div>
        }
        right={<>
          <Button size="sm" onClick={() => dl("csv")} data-testid="d1-dl-csv"><Download className="h-3.5 w-3.5" /> {t("v3.d1.dl.csv")}</Button>
          <Button size="sm" onClick={() => dl("json")}><Download className="h-3.5 w-3.5" /> {t("v3.d1.dl.json")}</Button>
        </>}
      >
        {view === "table" && <TableView js={js} />}
        {view === "pivot" && <PivotView js={js} fmt={fmt} />}
        {view === "chart" && <ChartView js={js} />}
      </Card>

      <div className="text-[11.5px] text-slate-500">{t("v3.d1.attr", { id: sourceId })}</div>
    </div>
  );
}

function FilterPanel({ js, filters, loading, apply }: { js: JsData; filters: Filters; loading: boolean; apply: (f: Filters) => Promise<void> }) {
  const { t } = useT();
  const [draft, setDraft] = useState<Record<string, string[]>>(() => Object.fromEntries(js.dims.map((d) => [d.id, d.codes])));
  const [q, setQ] = useState<Record<string, string>>({});

  const sel = (id: string) => draft[id] ?? [];
  const toggle = (id: string, code: string) => setDraft({ ...draft, [id]: sel(id).includes(code) ? sel(id).filter((c) => c !== code) : [...sel(id), code] });
  const dirty = js.dims.some((d) => sel(d.id).length !== d.codes.length || !d.codes.every((c) => sel(d.id).includes(c)));
  const empty = js.dims.some((d) => sel(d.id).length === 0);

  const run = () => {
    const f: Filters = { ...filters };
    for (const d of js.dims) {
      const s = sel(d.id);
      const all = s.length === d.codes.length;
      f[d.id] = all && filters[d.id] == null ? null : s;
    }
    void apply(f);
  };
  const loadAll = (id: string) => void apply({ ...filters, [id]: null });

  return (
    <Card title={t("v3.d1.filters")} right={<Button size="sm" variant="primary" disabled={!dirty || empty || loading} onClick={run} data-testid="f-apply">{loading ? t("v3.d1.loading") : t("v3.d1.f.apply")}</Button>}>
      <p className="mb-2 text-[12px] text-slate-600">{t("v3.d1.f.hint")}</p>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {js.dims.map((d) => (
          <fieldset key={d.id} className="rounded border border-slate-200 p-2">
            <legend className="px-1 text-[12px] font-semibold text-slate-800">{d.label}</legend>
            <div className="mb-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
              <span>{t("v3.d1.f.selected", { n: sel(d.id).length, total: d.codes.length })}</span>
              <button className="text-sky-700 underline" onClick={() => setDraft({ ...draft, [d.id]: d.codes })}>{t("v3.d1.f.all")}</button>
              <button className="text-sky-700 underline" onClick={() => setDraft({ ...draft, [d.id]: [] })}>{t("v3.d1.f.none")}</button>
              {filters[d.id] && filters[d.id]!.length > 0 && <button className="text-sky-700 underline" onClick={() => loadAll(d.id)} data-testid={`f-loadall-${d.id}`}>{t("v3.d1.f.loadAll")}</button>}
            </div>
            {d.codes.length > 10 && <input className={clsx(inputCls, "mb-1 h-7 text-xs")} placeholder={t("v3.d1.f.search")} aria-label={`${d.label} ${t("v3.d1.f.search")}`} value={q[d.id] ?? ""} onChange={(e) => setQ({ ...q, [d.id]: e.target.value })} />}
            <div className="max-h-36 space-y-0.5 overflow-auto text-[12px]">
              {d.codes.filter((c) => !q[d.id] || labelOf(d, c).toLowerCase().includes(q[d.id].toLowerCase())).map((c) => (
                <label key={c} className="flex cursor-pointer items-start gap-1.5"><input className="mt-0.5" type="checkbox" checked={sel(d.id).includes(c)} onChange={() => toggle(d.id, c)} /><span>{labelOf(d, c)}</span></label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
      {empty && <div className="mt-2 text-[12px] text-[#C92830]">{t("v3.d1.f.empty")}</div>}
    </Card>
  );
}

function TableView({ js }: { js: JsData }) {
  const { t } = useT();
  const rows = useMemo(() => toRows(js, { limit: 5000 }), [js]);
  const cols: Col[] = [...js.dims.map((d, i) => ({ key: `d${i}`, label: d.label, width: 130 })), { key: "v", label: t("v3.d1.table.value"), type: "num", width: 100 }];
  const trs: TRow[] = rows.map((r, i) => ({ id: i + 2, cells: { ...Object.fromEntries(r.labels.map((l, k) => [`d${k}`, l])), v: r.value } }));
  return (
    <div>
      <DataTable sheetName={t("v3.d1.table.sheet")} columns={cols} rows={trs} height={420} maxRows={1000} />
      {js.values.size > 1000 && <div className="mt-1 text-[11.5px] text-slate-500">{t("v3.d1.table.limit", { n: 1000 })}</div>}
    </div>
  );
}

function sliceDefaults(js: JsData, used: string[]) {
  return Object.fromEntries(js.dims.filter((d) => !used.includes(d.id)).map((d) => [d.id, d.codes[0]]));
}

function SliceSelectors({ js, used, slice, setSlice }: { js: JsData; used: string[]; slice: Record<string, string>; setSlice: (s: Record<string, string>) => void }) {
  const { t } = useT();
  const rest = js.dims.filter((d) => !used.includes(d.id) && d.codes.length > 1);
  if (!rest.length) return null;
  return (
    <>
      {rest.map((d) => (
        <Field key={d.id} label={t("v3.d1.slice", { dim: d.label })}>
          <select className={inputCls} value={slice[d.id] ?? d.codes[0]} onChange={(e) => setSlice({ ...slice, [d.id]: e.target.value })} aria-label={d.label}>
            {d.codes.map((c) => <option key={c} value={c}>{labelOf(d, c)}</option>)}
          </select>
        </Field>
      ))}
    </>
  );
}

function PivotView({ js, fmt }: { js: JsData; fmt: (n: number | null) => string }) {
  const { t } = useT();
  const vary = varyingDims(js);
  const [rowDim, setRowDim] = useState(() => (vary.find((d) => d.id === js.timeDim) ?? vary[0])?.id ?? "");
  const [colDim, setColDim] = useState(() => vary.find((d) => d.id !== rowDim)?.id ?? "");
  const [slice, setSlice] = useState<Record<string, string>>({});
  if (vary.length < 2) return <InfoCard>{t("v3.d1.pivot.need")}</InfoCard>;
  const rd = js.dims.find((d) => d.id === rowDim)!, cd = js.dims.find((d) => d.id === colDim)!;
  const used = [rowDim, colDim];
  const p = pivot(js, rowDim, colDim, { ...sliceDefaults(js, used), ...slice });
  return (
    <div className="space-y-3">
      <div className="grid gap-2 md:grid-cols-4">
        <Field label={t("v3.d1.pivot.rows")}><select className={inputCls} value={rowDim} onChange={(e) => { setRowDim(e.target.value); if (e.target.value === colDim) setColDim(vary.find((d) => d.id !== e.target.value)!.id); }} aria-label={t("v3.d1.pivot.rows")}>{vary.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}</select></Field>
        <Field label={t("v3.d1.pivot.cols")}><select className={inputCls} value={colDim} onChange={(e) => { setColDim(e.target.value); if (e.target.value === rowDim) setRowDim(vary.find((d) => d.id !== e.target.value)!.id); }} aria-label={t("v3.d1.pivot.cols")}>{vary.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}</select></Field>
        <SliceSelectors js={js} used={used} slice={slice} setSlice={setSlice} />
      </div>
      <div className="max-h-[420px] overflow-auto rounded border border-slate-300">
        <table className="border-separate border-spacing-0 text-[12.5px]" data-testid="pivot-table">
          <thead className="sticky top-0 z-10"><tr><th className="sticky left-0 border-b border-r border-slate-300 bg-[#e6e6e6] px-2 py-1 text-left">{rd.label} ╲ {cd.label}</th>{p.cols.map((c) => <th key={c} className="whitespace-nowrap border-b border-r border-slate-300 bg-[#f3f3f3] px-2 py-1 text-right">{labelOf(cd, c)}</th>)}</tr></thead>
          <tbody>
            {p.rows.map((r, i) => (
              <tr key={r}><th className="sticky left-0 whitespace-nowrap border-b border-r border-slate-300 bg-[#f3f3f3] px-2 py-0.5 text-left font-medium">{labelOf(rd, r)}</th>
                {p.cells[i].map((v, j) => <td key={j} className="border-b border-r border-slate-200 px-2 py-0.5 text-right tabular-nums">{fmt(v)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ChartView({ js }: { js: JsData }) {
  const { t, locale } = useT();
  const vary = varyingDims(js);
  const [xDim, setXDim] = useState(() => (vary.find((d) => d.id === js.timeDim) ?? vary[0])?.id ?? "");
  const [sDim, setSDim] = useState(() => vary.find((d) => d.id !== xDim)?.id ?? "");
  const [slice, setSlice] = useState<Record<string, string>>({});
  if (!vary.length) return <InfoCard>{t("v3.d1.chart.need")}</InfoCard>;
  const used = [xDim, sDim].filter(Boolean);
  const s = series(js, xDim, sDim || null, { ...sliceDefaults(js, used), ...slice });
  const isTime = xDim === js.timeDim;
  const common = { data: s.data, margin: { top: 8, right: 16, left: 0, bottom: 8 } };
  const axes = (<><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="x" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} width={56} tickFormatter={(v) => Number(v).toLocaleString(locale)} /><Tooltip formatter={(v) => (typeof v === "number" ? v.toLocaleString(locale) : String(v))} /><Legend wrapperStyle={{ fontSize: 11 }} /></>);
  return (
    <div className="space-y-3">
      <div className="grid gap-2 md:grid-cols-4">
        <Field label={t("v3.d1.chart.x")}><select className={inputCls} value={xDim} onChange={(e) => { setXDim(e.target.value); if (e.target.value === sDim) setSDim(""); }} aria-label={t("v3.d1.chart.x")}>{vary.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}</select></Field>
        <Field label={t("v3.d1.chart.series")} hint={t("v3.d1.chart.maxSeries")}><select className={inputCls} value={sDim} onChange={(e) => setSDim(e.target.value)} aria-label={t("v3.d1.chart.series")}><option value="">{t("v3.d1.chart.none")}</option>{vary.filter((d) => d.id !== xDim).map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}</select></Field>
        <SliceSelectors js={js} used={used} slice={slice} setSlice={setSlice} />
      </div>
      <div style={{ width: "100%", height: 360 }} data-testid="chart-box">
        <ResponsiveContainer>
          {isTime ? (
            <LineChart {...common}>{axes}{s.keys.map((k, i) => <Line key={k.key} type="monotone" dataKey={k.key} name={k.label} stroke={COLORS[i % COLORS.length]} dot={s.data.length < 30} connectNulls isAnimationActive={false} />)}</LineChart>
          ) : (
            <BarChart {...common}>{axes}{s.keys.map((k, i) => <Bar key={k.key} dataKey={k.key} name={k.label} fill={COLORS[i % COLORS.length]} isAnimationActive={false} />)}</BarChart>
          )}
        </ResponsiveContainer>
      </div>
      <Collapsible title={t("v3.d1.chart.note.title")}>{t("v3.d1.chart.note")}</Collapsible>
    </div>
  );
}
