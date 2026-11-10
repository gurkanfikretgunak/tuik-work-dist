export type RotMath = {
  n: number;
  m: number;
  g: number;
  lo: number;
  hi: number;
  r: number; // M mod N
  perPersonLo: number; // kişi başına alt kez alınan defter sayısı
  perPersonHi: number; // kişi başına üst kez alınan defter sayısı
  totalTransfers: number;
  orderedPairs: number;
  pairLower: number;
  warnings: { tone: "warn" | "error" | "info"; text: string }[];
  feasible: boolean;
};

export function calcMath(n: number, m: number, g: number): RotMath {
  const warnings: RotMath["warnings"] = [];
  let feasible = true;
  const lo = n > 0 ? Math.floor(m / n) : 0;
  const hi = n > 0 ? Math.ceil(m / n) : 0;
  const r = n > 0 ? m % n : 0;
  const pairLower = n > 1 ? Math.ceil((m - 1) / (n - 1)) : 0;
  if (n < 2) {
    feasible = false;
    warnings.push({ tone: "error", text: "En az 2 personel gerekir." });
  }
  if (n >= 2 && n < g + 1) {
    feasible = false;
    warnings.push({ tone: "error", text: `K1 penceresi sığmıyor: ardışık ${g + 1} ayda aynı kişide farklı defter olması için N ≥ ${g + 1} gerekir.` });
  }
  if (n === 3 && g >= 2) warnings.push({ tone: "warn", text: "N=3 ve G=2'de her kişinin 3 aylık penceresi tam bir permütasyon olmak zorunda; serbestlik çok az, çözüm bulunamayabilir. G=1 önerilir." });
  if (n > 0 && n < 4) warnings.push({ tone: "warn", text: "N<4 bu sürümde önerilmez (önerilen aralık 4–30)." });
  if (n > 30) warnings.push({ tone: "warn", text: "N>30: üretim süresi uzayabilir." });
  if (n > m) warnings.push({ tone: "info", text: `N > M: her kişi ${m} farklı defter alır, ${n - m} defteri hiç almaz. Eşitlik, hiç alınmayan defterlerin dengeli dağılması demektir.` });
  if (r === 0 && n > 0 && n <= m) warnings.push({ tone: "info", text: "M, N'ye tam bölünüyor: eşitlik tam olur, herkes her defteri aynı sayıda alır." });
  if (n >= 2 && n <= 5 && n <= m) warnings.push({ tone: "warn", text: `Kişi sayısı az: çift tekrarı en az ${pairLower} olur; motor gerekirse sınırı +1 gevşetip raporlar.` });
  return {
    n, m, g, lo, hi, r,
    perPersonLo: n - r, perPersonHi: r,
    totalTransfers: (m - 1) * n,
    orderedPairs: n * (n - 1),
    pairLower, warnings, feasible,
  };
}
