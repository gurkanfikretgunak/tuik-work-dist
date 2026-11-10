export type CatalogItem = { id: string; title: string; description: string; type: string; path: string[] };
export type CatalogData = { fetchedAt: string; source: string; count: number; datasets: CatalogItem[]; live?: boolean };

type LiveCat = {
  categoryGroups: { categories: LiveCategory[] }[];
  datasetMap: Record<string, { title: string; description?: string; datasetType?: string }>;
};
type LiveCategory = { label: string; datasetIdentifiers?: string[]; childrenCategories?: LiveCategory[] };

/** /api/tuik/catalog yanıtını (canlı) anlık görüntü biçimine çevirir; scripts/tuik-catalog.mjs ile aynı mantık. */
export function buildFromLive(raw: unknown, now = new Date()): CatalogData {
  const cat = raw as LiveCat;
  if (!cat?.datasetMap || !Array.isArray(cat.categoryGroups)) throw new Error("bad_catalog");
  const paths = new Map<string, string[]>();
  const walk = (c: LiveCategory, path: string[]) => {
    const p = [...path, c.label];
    for (const id of c.datasetIdentifiers ?? []) if (!paths.has(id)) paths.set(id, p);
    for (const ch of c.childrenCategories ?? []) walk(ch, p);
  };
  for (const g of cat.categoryGroups) for (const c of g.categories) walk(c, []);
  const datasets = Object.entries(cat.datasetMap).map(([id, v]) => ({ id, title: v.title, description: v.description ?? "", type: v.datasetType ?? "", path: paths.get(id) ?? [] }));
  datasets.sort((a, b) => a.path.join(">").localeCompare(b.path.join(">")) || a.title.localeCompare(b.title));
  return { fetchedAt: now.toISOString(), source: "https://databrowser2.tuik.gov.tr", count: datasets.length, datasets, live: true };
}

export const topCategories = (items: CatalogItem[]) => {
  const m = new Map<string, number>();
  for (const i of items) m.set(i.path[0] ?? "", (m.get(i.path[0] ?? "") ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};

export function searchCatalog(items: CatalogItem[], query: string, top: string | null, locale: string): CatalogItem[] {
  const q = query.trim().toLocaleLowerCase(locale);
  const words = q ? q.split(/\s+/) : [];
  return items.filter((i) => {
    if (top !== null && (i.path[0] ?? "") !== top) return false;
    if (!words.length) return true;
    const hay = `${i.title} ${i.id} ${i.description} ${i.path.join(" ")}`.toLocaleLowerCase(locale);
    return words.every((w) => hay.includes(w));
  });
}
