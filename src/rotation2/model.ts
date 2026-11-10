/** Defter Rotasyon Motoru - 2: iki katmanlı (şehir içi + şehir dışı) model. */

export type Person = { id: string; name: string };
/** region: şehir içi defterlerde -1, şehir dışında Region dizisindeki indeks. weekly: haftalık (özel) defter. */
export type Notebook = { code: string; weekly: boolean; region: number };
/** size: bölgedeki defter sayısı. Tüm bölgelerin toplamı kişi sayısına (n) eşit olmalıdır. */
export type Region = { code: string; name: string; size: number };
export type Tier = "inside" | "outside";

export const TIERS: Tier[] = ["inside", "outside"];

/** n defteri k bölgeye olabildiğince eşit böler (fazlalık baştaki bölgelere): 10/3 → 4,3,3 */
export function splitSizes(n: number, k: number): number[] {
  const base = Math.floor(n / k);
  const extra = n % k;
  return Array.from({ length: k }, (_, i) => base + (i < extra ? 1 : 0));
}

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function defaultRegions(n: number, k = 3): Region[] {
  return splitSizes(n, k).map((size, i) => ({ code: LETTERS[i], name: "", size }));
}

/** Şehir içi: n defter, 1-3-6 numaralı olanlar haftalık (varsayılan). */
export function buildInside(n: number): Notebook[] {
  return Array.from({ length: n }, (_, i) => ({ code: `M${i + 1}`, weekly: [1, 3, 6].includes(i + 1), region: -1 }));
}

/** Şehir dışı: bölge boyutlarına göre defterler; her bölgenin son defteri varsayılan olarak haftalık. */
export function buildOutside(regions: Region[]): Notebook[] {
  return regions.flatMap((r, ri) =>
    Array.from({ length: r.size }, (_, i) => ({ code: `${r.code}${i + 1}`, weekly: i === r.size - 1, region: ri })),
  );
}

export const weeklyOf = (nbs: Notebook[]) => nbs.flatMap((d, i) => (d.weekly ? [i] : []));

export const makePeople = (n: number, old: Person[] = []): Person[] =>
  Array.from({ length: n }, (_, i) => old[i] ?? { id: `P-${String(i + 1).padStart(2, "0")}`, name: "" });

/** Referans çalışma: 10 kişi, Adıyaman 4 / Kilis 3 / Nizip 3 */
export const REFERENCE_REGIONS: Region[] = [
  { code: "A", name: "Adıyaman", size: 4 },
  { code: "K", name: "Kilis", size: 3 },
  { code: "N", name: "Nizip", size: 3 },
];

export function layoutError(n: number, regions: Region[]): "sum" | "empty" | null {
  if (regions.length === 0 || regions.some((r) => r.size < 1)) return "empty";
  if (regions.reduce((s, r) => s + r.size, 0) !== n) return "sum";
  return null;
}
