import Papa from "papaparse";

export type Leave = { id: number; personId: string; start: string; end: string; note: string; included: boolean };
export type LeaveError = { col: string; msg: string };

/** YYYY-MM-DD, DD.MM.YYYY veya DD/MM/YYYY → UTC gün sayısı (epoch gün) */
export function parseDay(s: string): number | null {
  const t = (s ?? "").trim();
  let y: number, mo: number, d: number;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (m) [y, mo, d] = [+m[1], +m[2], +m[3]];
  else if ((m = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(t))) [d, mo, y] = [+m[1], +m[2], +m[3]];
  else return null;
  const dt = Date.UTC(y, mo - 1, d);
  const chk = new Date(dt);
  if (chk.getUTCFullYear() !== y || chk.getUTCMonth() !== mo - 1 || chk.getUTCDate() !== d) return null;
  return Math.floor(dt / 86400000);
}

export const daysInMonth = (year: number, month1: number) => new Date(Date.UTC(year, month1, 0)).getUTCDate();

export function validateLeave(l: Leave, personIds: string[], planStartDay: number, planEndDay: number): LeaveError[] {
  const e: LeaveError[] = [];
  if (!personIds.includes(l.personId)) e.push({ col: "personId", msg: "bilinmeyen personel" });
  const a = parseDay(l.start), b = parseDay(l.end);
  if (a === null) e.push({ col: "start", msg: "geçersiz tarih (YYYY-AA-GG)" });
  if (b === null) e.push({ col: "end", msg: "geçersiz tarih (YYYY-AA-GG)" });
  if (a !== null && b !== null) {
    if (b < a) e.push({ col: "end", msg: "bitiş başlangıçtan önce" });
    else if (b < planStartDay || a > planEndDay) e.push({ col: "start", msg: "plan dönemi dışında" });
  }
  return e;
}

export type Absence = {
  absent: boolean[][]; // [ay][kişi] ay eşiği aştı → "yok"
  partial: boolean[][]; // izin var ama eşik altı
  days: number[][]; // [ay][kişi] izinli gün sayısı
  dim: number[]; // ay gün sayısı
};

/** İzinleri ay bazına indirger. Çakışan günler bir kez sayılır. */
export function computeAbsence(leaves: Leave[], people: string[], startMonth: number, year: number, m: number, threshold: number): Absence {
  const n = people.length;
  const days: number[][] = Array.from({ length: m }, () => Array(n).fill(0));
  const dim: number[] = [];
  const monthStart: number[] = [];
  for (let t = 0; t < m; t++) {
    const idx = startMonth - 1 + t;
    const y = year + Math.floor(idx / 12), mo = (idx % 12) + 1;
    dim.push(daysInMonth(y, mo));
    monthStart.push(Math.floor(Date.UTC(y, mo - 1, 1) / 86400000));
  }
  const seen = people.map(() => new Set<number>());
  for (const l of leaves) {
    const p = people.indexOf(l.personId);
    const a = parseDay(l.start), b = parseDay(l.end);
    if (p < 0 || a === null || b === null || b < a) continue;
    for (let d = a; d <= b; d++) seen[p].add(d);
  }
  for (let p = 0; p < n; p++)
    for (const d of seen[p])
      for (let t = 0; t < m; t++) if (d >= monthStart[t] && d < monthStart[t] + dim[t]) days[t][p]++;
  const absent = days.map((row, t) => row.map((c) => c / dim[t] >= threshold && c > 0));
  const partial = days.map((row, t) => row.map((c, p) => c > 0 && !absent[t][p]));
  return { absent, partial, days, dim };
}

export function planWindow(startMonth: number, year: number, m: number): [number, number] {
  const s = Math.floor(Date.UTC(year, startMonth - 1, 1) / 86400000);
  const idx = startMonth - 1 + m;
  const e = Math.floor(Date.UTC(year + Math.floor(idx / 12), idx % 12, 1) / 86400000) - 1;
  return [s, e];
}

export function parseLeaveCsv(text: string): { rows: Omit<Leave, "id">[]; fatal?: string } {
  const r = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), { header: true, skipEmptyLines: "greedy", transformHeader: (h) => h.trim() });
  const f = r.meta.fields ?? [];
  const miss = ["calisan_id", "baslangic", "bitis"].filter((c) => !f.includes(c));
  if (miss.length) return { rows: [], fatal: `Zorunlu sütun(lar) eksik: ${miss.join(", ")}` };
  return { rows: r.data.map((x) => ({ personId: (x.calisan_id ?? "").trim(), start: (x.baslangic ?? "").trim(), end: (x.bitis ?? "").trim(), note: (x.not ?? "").trim(), included: true })) };
}
