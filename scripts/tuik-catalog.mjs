// TÜİK Veri Portalı kataloğunun anlık görüntüsünü public/tuik/catalog.json olarak yazar (çevrimdışı katalog için).
// Kullanım: node scripts/tuik-catalog.mjs
import { writeFileSync } from "node:fs";
const URL_ = "https://databrowser2.tuik.gov.tr/api/core/nodes/1/catalog";
const res = await fetch(URL_, { headers: { Accept: "application/json", "User-Agent": "tuik-work-dist/educational" } });
if (!res.ok) throw new Error("HTTP " + res.status);
const cat = await res.json();
const paths = new Map();
const walk = (c, path) => {
  const p = [...path, c.label];
  for (const id of c.datasetIdentifiers ?? []) if (!paths.has(id)) paths.set(id, p);
  for (const ch of c.childrenCategories ?? []) walk(ch, p);
};
for (const g of cat.categoryGroups) for (const c of g.categories) walk(c, []);
const datasets = Object.entries(cat.datasetMap).map(([id, v]) => ({
  id, title: v.title, description: v.description ?? "", type: v.datasetType ?? "", path: paths.get(id) ?? [],
}));
datasets.sort((a, b) => a.path.join(">").localeCompare(b.path.join(">")) || a.title.localeCompare(b.title));
const out = { fetchedAt: new Date().toISOString(), source: "https://databrowser2.tuik.gov.tr", count: datasets.length, datasets };
writeFileSync("public/tuik/catalog.json", JSON.stringify(out));
console.log(`${datasets.length} veri seti yazıldı`);
