import { describe, expect, it } from "vitest";
import { computeAbsence, parseDay, parseLeaveCsv, validateLeave, type Leave } from "./leave";
import { calcMath, calcTargets } from "./math";

const L = (personId: string, start: string, end: string): Leave => ({ id: 1, personId, start, end, note: "", included: true });

describe("izin modeli", () => {
  it("tarih biçimleri ve geçersizler", () => {
    expect(parseDay("2027-03-05")).toBe(parseDay("05.03.2027"));
    expect(parseDay("2027-02-30")).toBeNull();
    expect(parseDay("abc")).toBeNull();
  });
  it("tek gün izin kısmi, ay boyu izin 'yok'; aya yayılan aralık bölünür", () => {
    const ppl = ["A", "B", "C"];
    const r = computeAbsence([L("A", "2027-01-10", "2027-01-10"), L("B", "2027-01-01", "2027-01-31"), L("C", "2027-01-20", "2027-02-10")], ppl, 1, 2027, 3, 0.5);
    expect(r.days[0]).toEqual([1, 31, 12]);
    expect(r.partial[0]).toEqual([true, false, true]);
    expect(r.absent[0]).toEqual([false, true, false]);
    expect(r.days[1][2]).toBe(10); // Şubat'tan 10 gün
    expect(r.absent[1][2]).toBe(false);
  });
  it("çakışan izinler günü iki kez saymaz", () => {
    const r = computeAbsence([L("A", "2027-01-01", "2027-01-20"), L("A", "2027-01-10", "2027-01-31")], ["A"], 1, 2027, 1, 0.5);
    expect(r.days[0][0]).toBe(31);
  });
  it("doğrulama ve CSV", () => {
    expect(validateLeave(L("X", "2027-01-01", "2027-01-02"), ["A"], 0, 99999999).map((e) => e.col)).toContain("personId");
    expect(parseLeaveCsv("calisan_id;baslangic;bitis;not\nA;2027-01-01;2027-01-05;yıllık").rows[0].note).toBe("yıllık");
    expect(parseLeaveCsv("a,b\n1,2").fatal).toMatch(/eksik/);
  });
});

describe("esas dağıtım sayısı D", () => {
  it("izinsiz: D = N·M, hedef M/N (mevcut K3 ile aynı)", () => {
    const t = calcTargets(9, 12);
    expect(t.D).toBe(108);
    expect(t.lo[0][0]).toBe(1);
    expect(t.hi[0][0]).toBe(2);
    const x = calcMath(9, 12, 2);
    expect([t.lo[3][4], t.hi[3][4]]).toEqual([x.lo, x.hi]);
  });
  it("izinli kişinin payı müsait aya orantılı düşer; ek atamada D sabit kalır", () => {
    const ab = Array.from({ length: 12 }, (_, t) => Array.from({ length: 9 }, (_, p) => p === 0 && t < 3));
    const t = calcTargets(9, 12, ab, "ek");
    expect(t.D).toBe(108);
    expect(t.a[0]).toBe(9);
    expect(t.Dp[0]).toBeCloseTo((108 * 9) / 105, 6);
    expect(t.Dp.reduce((a, b) => a + b, 0)).toBeCloseTo(108, 6);
  });
  it("boş bırakmada D müsait kişi sayısı kadar azalır", () => {
    const ab = Array.from({ length: 12 }, (_, t) => Array.from({ length: 9 }, (_, p) => p === 0 && t < 3));
    expect(calcTargets(9, 12, ab, "bos").D).toBe(108 - 3);
  });
  it("kişi başı en fazla 2 defter: izinli ay sayısı çok ise yetersiz ay işaretlenir", () => {
    const ab = Array.from({ length: 2 }, () => Array.from({ length: 9 }, (_, p) => p < 5));
    expect(calcTargets(9, 2, ab, "ek").badMonths).toEqual([0, 1]);
  });
});
