import JSZip from "jszip";
import { toCsv, yesNo } from "./csv";
import type { Assignment, Employee, Job } from "./types";

export const SHARE_COLS = ["is_id", "il", "ilce", "mahalle", "yerlesim_tipi", "birim_no", "gorusme_sayisi", "oncelik", "anket_turu"] as const;
export const RESULT_COLS_EXTRA = ["atanan_calisan_id", "atanan_calisan_adi", "atama_nedeni", "uyari", "manuel_degisti"] as const;
export const JOB_ALL_COLS = [
  "is_id", "il", "ilce", "mahalle", "yerlesim_tipi", "birim_no", "gorusme_sayisi",
  "onceki_ay_gorusen_calisan_id", "oncelik", "anket_turu",
] as const;

export function resultRows(jobs: Job[], A: Assignment[], emps: Employee[]) {
  const em = new Map(emps.map((e) => [e.calisan_id, e]));
  const am = new Map(A.map((a) => [a.jobId, a]));
  return jobs.map((j) => {
    const a = am.get(j.is_id);
    return {
      ...j,
      atanan_calisan_id: a?.empId ?? "",
      atanan_calisan_adi: a?.empId ? em.get(a.empId)?.ad_soyad ?? "" : "",
      atama_nedeni: a?.empId ? a.neden : "",
      uyari: a?.uyari ?? "",
      manuel_degisti: yesNo(!!a?.manuel),
    };
  });
}

export function unassignedRows(jobs: Job[], A: Assignment[]) {
  const am = new Map(A.map((a) => [a.jobId, a]));
  return jobs.filter((j) => !am.get(j.is_id)?.empId).map((j) => ({ ...j, sebep: am.get(j.is_id)?.sebep ?? "" }));
}

/** Çalışana giden dosya: yalnızca kendi işleri, önceki ay çalışan ID'si ve başka çalışan bilgisi yok. */
export function employeeShareCsv(empId: string, jobs: Job[], A: Assignment[]): string {
  const mine = new Set(A.filter((a) => a.empId === empId).map((a) => a.jobId));
  return toCsv(jobs.filter((j) => mine.has(j.is_id)) as unknown as Record<string, unknown>[], SHARE_COLS);
}

export function ilShareCsv(il: string, jobs: Job[], A: Assignment[], emps: Employee[]): string {
  const em = new Map(emps.map((e) => [e.calisan_id, e]));
  const am = new Map(A.map((a) => [a.jobId, a]));
  const rows = jobs
    .filter((j) => j.il === il)
    .map((j) => {
      const id = am.get(j.is_id)?.empId;
      return { ...j, atanan_calisan_id: id ?? "", atanan_calisan_adi: id ? em.get(id)?.ad_soyad ?? "" : "" };
    });
  return toCsv(rows as unknown as Record<string, unknown>[], [...SHARE_COLS, "atanan_calisan_id", "atanan_calisan_adi"]);
}

export function employeeZipFiles(emps: Employee[], jobs: Job[], A: Assignment[]): Record<string, string> {
  const files: Record<string, string> = {};
  for (const e of emps) {
    if (A.some((a) => a.empId === e.calisan_id)) files[`${e.calisan_id}_is_listesi.csv`] = employeeShareCsv(e.calisan_id, jobs, A);
  }
  return files;
}

export async function zipBlob(files: Record<string, string>): Promise<Blob> {
  const z = new JSZip();
  for (const [n, c] of Object.entries(files)) z.file(n, c);
  return z.generateAsync({ type: "blob" });
}

export function download(name: string, data: Blob | string, type = "text/plain;charset=utf-8") {
  const blob = typeof data === "string" ? new Blob([data], { type }) : data;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function fillTemplate(t: string, v: Record<string, string | number>) {
  return t.replace(/\{(\w+)\}/g, (m, k) => (k in v ? String(v[k]) : m));
}
