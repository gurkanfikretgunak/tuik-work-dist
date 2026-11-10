import Papa from "papaparse";
import { z } from "zod";
import type { CellError, Employee, Job, Row } from "./types";

export const EMP_COLS = [
  "calisan_id",
  "ad_soyad",
  "rol",
  "il",
  "ilce",
  "donemlik_kapasite",
  "musait_oran",
  "kir_gorevi_yapabilir",
  "aktif",
  "kapasite_notu",
] as const;
export const EMP_REQUIRED = ["calisan_id", "ad_soyad", "il", "donemlik_kapasite"];

export const JOB_COLS = [
  "is_id",
  "il",
  "ilce",
  "mahalle",
  "yerlesim_tipi",
  "birim_no",
  "gorusme_sayisi",
  "onceki_ay_gorusen_calisan_id",
  "oncelik",
  "anket_turu",
] as const;
export const JOB_REQUIRED = ["is_id", "il", "mahalle", "yerlesim_tipi", "gorusme_sayisi"];

const trLower = (s: string) => s.trim().toLocaleLowerCase("tr");

export function parseBool(v: string | undefined, def: boolean): boolean | null {
  const s = trLower(v ?? "");
  if (s === "") return def;
  if (["evet", "e", "true", "1", "yes", "x", "var"].includes(s)) return true;
  if (["hayır", "hayir", "h", "false", "0", "no", "yok"].includes(s)) return false;
  return null;
}

export function parseNum(v: string | undefined): number {
  const s = (v ?? "").trim().replace(",", ".");
  if (s === "") return NaN;
  return Number(s);
}

export function normYerlesim(v: string | undefined): "Kent" | "Kır" | null {
  const s = trLower(v ?? "");
  if (s === "kent") return "Kent";
  if (s === "kır" || s === "kir") return "Kır";
  return null;
}

export function normOncelik(v: string | undefined): Job["oncelik"] | null {
  const s = trLower(v ?? "");
  if (s === "" || s === "normal") return "Normal";
  if (s === "yüksek" || s === "yuksek") return "Yüksek";
  if (s === "düşük" || s === "dusuk") return "Düşük";
  return null;
}

const req = z.string().trim().min(1, "boş olamaz");
const numStr = (min: number, max: number, def?: number) =>
  z
    .string()
    .trim()
    .transform((s) => (s === "" && def !== undefined ? String(def) : s))
    .pipe(z.string().min(1, "boş olamaz"))
    .transform((s) => Number(s.replace(",", ".")))
    .pipe(
      z
        .number({ error: "sayı olmalı" })
        .refine((n) => Number.isFinite(n), "sayı olmalı")
        .refine((n) => n >= min && n <= max, `${min}–${max} arasında olmalı`),
    );
const boolStr = (def: boolean) =>
  z.string().refine((s) => parseBool(s, def) !== null, "Evet/Hayır olmalı");

const empSchema = z.object({
  calisan_id: req,
  ad_soyad: req,
  rol: z.string(),
  il: req,
  ilce: z.string(),
  donemlik_kapasite: numStr(0, 100000),
  musait_oran: numStr(0, 100, 100),
  kir_gorevi_yapabilir: boolStr(false),
  aktif: boolStr(true),
  kapasite_notu: z.string(),
});

const jobSchema = z.object({
  is_id: req,
  il: req,
  ilce: z.string(),
  mahalle: req,
  yerlesim_tipi: z.string().refine((s) => normYerlesim(s) !== null, "Kent veya Kır olmalı"),
  birim_no: z.string(),
  gorusme_sayisi: numStr(1, 1000),
  onceki_ay_gorusen_calisan_id: z.string(),
  oncelik: z.string().refine((s) => normOncelik(s) !== null, "Yüksek/Normal/Düşük olmalı"),
  anket_turu: z.string(),
});

function issues(err: z.ZodError): CellError[] {
  return err.issues.map((i) => ({ col: String(i.path[0] ?? ""), msg: i.message }));
}

export function toEmployee(raw: Record<string, string>): Employee {
  const cap = parseNum(raw.donemlik_kapasite);
  const av = parseNum(raw.musait_oran);
  return {
    calisan_id: (raw.calisan_id ?? "").trim(),
    ad_soyad: (raw.ad_soyad ?? "").trim(),
    rol: (raw.rol ?? "").trim(),
    il: (raw.il ?? "").trim(),
    ilce: (raw.ilce ?? "").trim(),
    donemlik_kapasite: Number.isFinite(cap) ? cap : 0,
    musait_oran: Number.isFinite(av) ? av : 100,
    kir_gorevi_yapabilir: parseBool(raw.kir_gorevi_yapabilir, false) ?? false,
    aktif: parseBool(raw.aktif, true) ?? true,
    kapasite_notu: (raw.kapasite_notu ?? "").trim(),
  };
}

export function toJob(raw: Record<string, string>): Job {
  const n = parseNum(raw.gorusme_sayisi);
  return {
    is_id: (raw.is_id ?? "").trim(),
    il: (raw.il ?? "").trim(),
    ilce: (raw.ilce ?? "").trim(),
    mahalle: (raw.mahalle ?? "").trim(),
    yerlesim_tipi: normYerlesim(raw.yerlesim_tipi) ?? "Kent",
    birim_no: (raw.birim_no ?? "").trim(),
    gorusme_sayisi: Number.isFinite(n) ? n : 1,
    onceki_ay_gorusen_calisan_id: (raw.onceki_ay_gorusen_calisan_id ?? "").trim(),
    oncelik: normOncelik(raw.oncelik) ?? "Normal",
    anket_turu: (raw.anket_turu ?? "").trim(),
  };
}

export type ParseResult<T> = {
  rows: Row<T>[];
  missingColumns: string[];
  delimiter: string;
  fatal?: string;
};

function parseGeneric<T>(
  text: string,
  cols: readonly string[],
  required: string[],
  schema: z.ZodType,
  conv: (raw: Record<string, string>) => T,
  idCol: string,
): ParseResult<T> {
  const clean = text.replace(/^﻿/, "");
  const res = Papa.parse<Record<string, string>>(clean, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim().replace(/^﻿/, ""),
  });
  const fields = res.meta.fields ?? [];
  const missingColumns = required.filter((c) => !fields.includes(c));
  if (missingColumns.length) {
    return { rows: [], missingColumns, delimiter: res.meta.delimiter, fatal: `Zorunlu sütun(lar) eksik: ${missingColumns.join(", ")}` };
  }
  const seen = new Map<string, number>();
  const rows: Row<T>[] = res.data.map((rawIn, i) => {
    const raw: Record<string, string> = {};
    for (const c of cols) raw[c] = (rawIn[c] ?? "").toString();
    const parsed = schema.safeParse(raw);
    const errors = parsed.success ? [] : issues(parsed.error);
    const id = (raw[idCol] ?? "").trim();
    if (id) {
      if (seen.has(id)) errors.push({ col: idCol, msg: `yinelenen kimlik (satır ${seen.get(id)})` });
      else seen.set(id, i + 2);
    }
    return { rowNo: i + 2, data: conv(raw), errors, included: errors.length === 0 };
  });
  return { rows, missingColumns, delimiter: res.meta.delimiter };
}

export const parseEmployees = (text: string) =>
  parseGeneric<Employee>(text, EMP_COLS, EMP_REQUIRED, empSchema, toEmployee, "calisan_id");
export const parseJobs = (text: string) =>
  parseGeneric<Job>(text, JOB_COLS, JOB_REQUIRED, jobSchema, toJob, "is_id");

export function revalidateEmployee(d: Employee): CellError[] {
  const raw: Record<string, string> = {
    ...Object.fromEntries(Object.entries(d).map(([k, v]) => [k, typeof v === "boolean" ? (v ? "Evet" : "Hayır") : String(v)])),
  };
  const r = empSchema.safeParse(raw);
  return r.success ? [] : issues(r.error);
}

export const yesNo = (b: boolean) => (b ? "Evet" : "Hayır");

export function toCsv(rows: Record<string, unknown>[], cols: readonly string[]): string {
  return "﻿" + Papa.unparse({ fields: [...cols], data: rows.map((r) => cols.map((c) => r[c] ?? "")) });
}
