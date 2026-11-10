"use client";
import clsx from "clsx";
import { Search } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import type { CellError } from "@/lib/types";

export type Col = {
  key: string;
  label: string;
  width?: number;
  type?: "text" | "num" | "bool" | "select";
  options?: string[];
  editable?: boolean;
  render?: (v: unknown, row: TRow) => ReactNode;
};
export type TRow = {
  id: number; // benzersiz (CSV satır no)
  cells: Record<string, unknown>;
  errors?: CellError[];
  checked?: boolean;
  /** true ise satır soluk gösterilir (ör. kullanılmayacak) */
  dim?: boolean;
};

const letter = (i: number) => {
  let s = "";
  let n = i;
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
};

/**
 * MS Office Excel benzeri önizleme tablosu: sütun harfleri, satır numaraları,
 * ızgara çizgileri, formül çubuğu, satır başı onay kutusu, sayfa sekmesi ve durum çubuğu.
 */
export function DataTable({
  columns,
  rows,
  sheetName,
  onToggle,
  onToggleAll,
  onEdit,
  height = 420,
  toolbar,
  maxRows = 1000,
}: {
  columns: Col[];
  rows: TRow[];
  sheetName: string;
  onToggle?: (id: number) => void;
  onToggleAll?: (checked: boolean, ids: number[]) => void;
  onEdit?: (id: number, key: string, value: string | boolean) => void;
  height?: number;
  toolbar?: ReactNode;
  maxRows?: number;
}) {
  const [q, setQ] = useState("");
  const [onlyErr, setOnlyErr] = useState(false);
  const [sel, setSel] = useState<{ r: number; c: number } | null>(null);
  const hasCheck = !!onToggle;

  const view = useMemo(() => {
    const t = q.trim().toLocaleLowerCase("tr");
    return rows.filter((r) => {
      if (onlyErr && !(r.errors && r.errors.length)) return false;
      if (!t) return true;
      return columns.some((c) => String(r.cells[c.key] ?? "").toLocaleLowerCase("tr").includes(t));
    });
  }, [rows, q, onlyErr, columns]);

  const shown = view.slice(0, maxRows);
  const checkedCount = rows.filter((r) => r.checked).length;
  const errCount = rows.filter((r) => r.errors && r.errors.length).length;
  const allChecked = shown.length > 0 && shown.every((r) => r.checked);
  const someChecked = shown.some((r) => r.checked);

  const selRow = sel ? shown[sel.r] : undefined;
  const selCol = sel ? columns[sel.c] : undefined;
  const selVal = selRow && selCol ? selRow.cells[selCol.key] : "";
  const selErr = selRow && selCol ? selRow.errors?.filter((e) => e.col === selCol.key) : [];

  return (
    <div className="overflow-hidden rounded-md border border-slate-300 bg-white text-[12.5px]" data-testid={`sheet-${sheetName}`}>
      {/* Araç çubuğu */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-300 bg-[#f3f3f3] px-2 py-1.5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-1.5 top-1.5 h-3.5 w-3.5 text-slate-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tabloda ara…"
            aria-label="Tabloda ara"
            className="h-7 w-44 rounded border border-slate-300 bg-white pl-6 pr-2 text-xs focus:border-emerald-700 focus:outline-none"
          />
        </div>
        {errCount > 0 && (
          <label className="flex cursor-pointer items-center gap-1 text-xs text-slate-700">
            <input type="checkbox" checked={onlyErr} onChange={(e) => setOnlyErr(e.target.checked)} />
            Yalnızca hatalı satırlar ({errCount})
          </label>
        )}
        <div className="ml-auto flex items-center gap-1.5">{toolbar}</div>
      </div>
      {/* Formül çubuğu */}
      <div className="flex items-center border-b border-slate-300 bg-white text-xs">
        <div className="w-16 border-r border-slate-300 bg-[#f3f3f3] px-2 py-1 text-center font-semibold text-slate-700" data-testid="cell-address">
          {sel && selRow ? `${letter(sel.c)}${selRow.id}` : "—"}
        </div>
        <div className="px-2 italic text-slate-400">fx</div>
        <div className="flex-1 truncate px-2 py-1 text-slate-900" data-testid="cell-value">
          {selVal === undefined || selVal === null ? "" : typeof selVal === "boolean" ? (selVal ? "Evet" : "Hayır") : String(selVal)}
        </div>
        {selErr && selErr.length > 0 && <div className="px-2 text-[#C92830]">⚠ {selErr.map((e) => e.msg).join("; ")}</div>}
      </div>
      {/* Izgara */}
      <div className="overflow-auto bg-white" style={{ maxHeight: height }}>
        <table className="border-separate border-spacing-0 text-[12.5px]" style={{ minWidth: "100%" }}>
          <thead className="sticky top-0 z-20">
            <tr>
              <th className="sticky left-0 z-30 w-[58px] min-w-[58px] border-b border-r border-slate-300 bg-[#e6e6e6]" />
              {columns.map((c, i) => (
                <th key={c.key} className="border-b border-r border-slate-300 bg-[#e6e6e6] py-0.5 text-center text-[11px] font-normal text-slate-600">
                  {letter(i)}
                </th>
              ))}
            </tr>
            <tr>
              <th className="sticky left-0 z-30 border-b border-r border-slate-300 bg-[#f3f3f3] px-1 py-1">
                {hasCheck && (
                  <input
                    type="checkbox"
                    aria-label="Tümünü seç / bırak"
                    data-testid="check-all"
                    checked={allChecked}
                    ref={(el) => {
                      if (el) el.indeterminate = !allChecked && someChecked;
                    }}
                    onChange={(e) => onToggleAll?.(e.target.checked, shown.map((r) => r.id))}
                  />
                )}
              </th>
              {columns.map((c) => (
                <th
                  key={c.key}
                  style={{ minWidth: c.width ?? 110 }}
                  className="whitespace-nowrap border-b border-r border-slate-300 bg-[#f3f3f3] px-2 py-1 text-left font-semibold text-slate-800"
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r, ri) => {
              const rowErr = r.errors && r.errors.length > 0;
              return (
                <tr key={r.id} className={clsx(r.dim && "opacity-50", hasCheck && !r.checked && "bg-slate-50/70")} data-testid="row">
                  <td
                    className={clsx(
                      "sticky left-0 z-10 border-b border-r border-slate-300 px-1 py-0.5",
                      sel?.r === ri ? "bg-[#d3e3d6] font-semibold" : "bg-[#f3f3f3]",
                    )}
                  >
                    <div className="flex items-center justify-between gap-1">
                      {hasCheck ? (
                        <input
                          type="checkbox"
                          aria-label={`Satır ${r.id} kullanılsın`}
                          checked={!!r.checked}
                          onChange={() => onToggle?.(r.id)}
                        />
                      ) : (
                        <span />
                      )}
                      <span className={clsx("text-[11px] tabular-nums", rowErr ? "text-[#C92830]" : "text-slate-600")}>{r.id}</span>
                    </div>
                  </td>
                  {columns.map((c, ci) => {
                    const cellErr = r.errors?.find((e) => e.col === c.key);
                    const v = r.cells[c.key];
                    const active = sel?.r === ri && sel?.c === ci;
                    return (
                      <td
                        key={c.key}
                        onClick={() => setSel({ r: ri, c: ci })}
                        title={cellErr?.msg}
                        className={clsx(
                          "border-b border-r border-slate-200 px-2 py-0.5 align-middle",
                          c.type === "num" && "text-right tabular-nums",
                          cellErr && "bg-red-100 text-red-900",
                          r.checked === false && "text-slate-400 line-through decoration-slate-300",
                          active && "outline outline-2 -outline-offset-2 outline-emerald-700",
                        )}
                      >
                        <Cell col={c} value={v} row={r} onEdit={onEdit} />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {shown.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="px-3 py-8 text-center text-slate-500">
                  Gösterilecek satır yok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {/* Durum çubuğu + sayfa sekmesi */}
      <div className="flex items-center justify-between border-t border-slate-300 bg-[#f3f3f3] text-xs">
        <div className="flex items-end">
          <div className="border-r border-t-2 border-slate-300 border-t-emerald-700 bg-white px-3 py-1 font-medium text-emerald-800">{sheetName}</div>
        </div>
        <div className="flex gap-4 px-3 py-1 text-slate-600" data-testid="status-bar">
          <span>Satır: {rows.length}</span>
          {hasCheck && <span>Kullanılacak: {checkedCount}</span>}
          {errCount > 0 && <span className="text-[#C92830]">Hatalı: {errCount}</span>}
          {view.length > maxRows && <span>İlk {maxRows} satır gösteriliyor</span>}
        </div>
      </div>
    </div>
  );
}

function Cell({ col, value, row, onEdit }: { col: Col; value: unknown; row: TRow; onEdit?: (id: number, key: string, v: string | boolean) => void }) {
  if (col.render) return <>{col.render(value, row)}</>;
  if (col.editable && onEdit) {
    if (col.type === "bool")
      return (
        <input
          type="checkbox"
          aria-label={`${col.label} satır ${row.id}`}
          checked={!!value}
          onChange={(e) => onEdit(row.id, col.key, e.target.checked)}
        />
      );
    if (col.type === "select")
      return (
        <select
          aria-label={`${col.label} satır ${row.id}`}
          value={String(value)}
          onChange={(e) => onEdit(row.id, col.key, e.target.value)}
          className="w-full bg-transparent text-[12.5px] focus:outline-none"
        >
          {col.options?.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      );
    return (
      <input
        aria-label={`${col.label} satır ${row.id}`}
        defaultValue={String(value ?? "")}
        key={String(value)}
        inputMode={col.type === "num" ? "decimal" : undefined}
        onBlur={(e) => e.target.value !== String(value ?? "") && onEdit(row.id, col.key, e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className={clsx("w-full bg-transparent text-[12.5px] focus:outline-none focus:ring-1 focus:ring-emerald-700", col.type === "num" && "text-right")}
      />
    );
  }
  if (typeof value === "boolean") return <span>{value ? "Evet" : "Hayır"}</span>;
  return <span className="whitespace-nowrap">{value === undefined || value === null ? "" : String(value)}</span>;
}
