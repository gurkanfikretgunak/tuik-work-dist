import { describe, expect, it } from "vitest";
import { computeCompliance, computeLoads, runDistribution, checkMove } from "./engine";
import { parseEmployees, parseJobs } from "./csv";
import { DEFAULT_RULESET, type Employee, type Job, type RuleSet } from "./types";

const emp = (id: string, cap: number, o: Partial<Employee> = {}): Employee => ({
  calisan_id: id, ad_soyad: id, rol: "Anketör", il: "Ankara", ilce: "", donemlik_kapasite: cap,
  musait_oran: 100, kir_gorevi_yapabilir: true, aktif: true, kapasite_notu: "", ...o,
});
const job = (i: number, o: Partial<Job> = {}): Job => ({
  is_id: `IS-${i}`, il: "Ankara", ilce: "Çankaya", mahalle: `M${i % 4}`, yerlesim_tipi: "Kent",
  birim_no: `HN-${i}`, gorusme_sayisi: 1, onceki_ay_gorusen_calisan_id: "", oncelik: "Normal", anket_turu: "x", ...o,
});
const rs = (o: Partial<RuleSet> = {}): RuleSet => ({ ...DEFAULT_RULESET, kapasiteBirimi: "is", ...o });

describe("dağıtım motoru", () => {
  it("orantılı hedef: X=20, Y=30, 40 iş → 16/24", async () => {
    const jobs = Array.from({ length: 40 }, (_, i) => job(i));
    const a = await runDistribution([emp("X", 20), emp("Y", 30)], jobs, rs({ sapma: 0 }));
    const l = computeLoads(a, jobs, rs());
    expect(l.get("X")).toBe(16);
    expect(l.get("Y")).toBe(24);
  });

  it("sert limit: kapasiteyi aşan işler atanamadı", async () => {
    const jobs = Array.from({ length: 30 }, (_, i) => job(i));
    const a = await runDistribution([emp("X", 10), emp("Y", 10)], jobs, rs());
    expect(a.filter((x) => x.empId).length).toBe(20);
    expect(a.filter((x) => !x.empId).every((x) => x.sebep === "Kapasite yetersiz")).toBe(true);
  });

  it("kapasite aşımı 'uyarı' modunda atanır ve uyarı yazılır", async () => {
    const jobs = Array.from({ length: 12 }, (_, i) => job(i));
    const a = await runDistribution([emp("X", 10)], jobs, rs({ kapasiteAsimi: "uyari" }));
    expect(a.every((x) => x.empId === "X")).toBe(true);
    expect(a.filter((x) => x.uyari).length).toBe(2);
  });

  it("ilde çalışan yok ve kır görevi sebepleri", async () => {
    const jobs = [job(1, { il: "Van" }), job(2, { yerlesim_tipi: "Kır" })];
    const a = await runDistribution([emp("X", 10, { kir_gorevi_yapabilir: false })], jobs, rs());
    expect(a[0].sebep).toBe("İlde çalışan yok");
    expect(a[1].sebep).toBe("Kır görevi yapabilen çalışan yok");
  });

  it("kır çarpanı puanı artırır (2 görüşmelik kır = 3 puan)", async () => {
    const jobs = [job(1, { gorusme_sayisi: 2, yerlesim_tipi: "Kır" })];
    const r = rs({ kapasiteBirimi: "puan" });
    const a = await runDistribution([emp("X", 10)], jobs, r);
    expect(computeLoads(a, jobs, r).get("X")).toBe(3);
  });

  it("müsaitlik oranı efektif kapasiteyi düşürür", async () => {
    const jobs = Array.from({ length: 20 }, (_, i) => job(i));
    const a = await runDistribution([emp("X", 30, { musait_oran: 50 })], jobs, rs());
    expect(a.filter((x) => x.empId).length).toBe(15);
  });

  it("geçen ay rotasyon (zorunlu): aynı kişiye verilmez", async () => {
    const r = rs({ rules: DEFAULT_RULESET.rules.map((x) => (x.id === "gecenAy" ? { ...x, enabled: true, mandatory: true } : x)) });
    const jobs = [job(1, { onceki_ay_gorusen_calisan_id: "X" })];
    const a = await runDistribution([emp("X", 10), emp("Y", 10)], jobs, r);
    expect(a[0].empId).toBe("Y");
  });

  it("aynı mahalle tek çalışanda toplanır", async () => {
    const jobs = Array.from({ length: 6 }, (_, i) => job(i, { mahalle: "Kızılay" }));
    const r = rs({ rules: DEFAULT_RULESET.rules.map((x) => (x.id === "denge" ? { ...x, enabled: false } : x)) });
    const a = await runDistribution([emp("X", 20), emp("Y", 20)], jobs, r);
    expect(new Set(a.map((x) => x.empId)).size).toBe(1);
  });

  it("uyum oranı hesaplanır ve manuel taşıma ihlalleri raporlanır", async () => {
    const jobs = Array.from({ length: 10 }, (_, i) => job(i));
    const emps = [emp("X", 10), emp("Y", 10, { il: "İzmir" })];
    const a = await runDistribution(emps, jobs, rs());
    const c = computeCompliance(a, emps, jobs, rs());
    expect(c.il.ok).toBe(c.il.total);
    const v = checkMove(jobs[0], emps[1], a, emps, jobs, rs());
    expect(v.some((x) => x.includes("İl uyuşmuyor"))).toBe(true);
  });
});

describe("csv doğrulama", () => {
  it("noktalı virgül, Türkçe boolean ve hatalı satırlar", () => {
    const t = "calisan_id;ad_soyad;rol;il;ilce;donemlik_kapasite;musait_oran;kir_gorevi_yapabilir;aktif;kapasite_notu\nC-1;A B;Anketör;Ankara;X;20;100;Evet;Evet;\nC-1;D E;Anketör;Ankara;X;abc;100;Belki;Evet;";
    const r = parseEmployees(t);
    expect(r.delimiter).toBe(";");
    expect(r.rows[0].errors).toEqual([]);
    expect(r.rows[1].errors.map((e) => e.col).sort()).toEqual(["calisan_id", "donemlik_kapasite", "kir_gorevi_yapabilir"]);
    expect(r.rows[1].included).toBe(false);
  });
  it("eksik sütun fatal", () => {
    expect(parseJobs("is_id,il\nA,B").fatal).toMatch(/eksik/);
  });
});
