// Çevrilmemiş (Türkçe karakter içeren) metinleri listeler. Kullanım: node scripts/i18n-scan.mjs [yol-parçası]
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
const filter = process.argv[2] ?? "";
const TR = /[çğıöşüÇĞİÖŞÜ]/;
const out = [];
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) { if (!p.includes("/i18n/dict")) walk(p); continue; }
    if (!/\.(ts|tsx)$/.test(f) || /\.test\.ts$/.test(f) || !p.includes(filter)) continue;
    readFileSync(p, "utf8").split("\n").forEach((line, i) => {
      const t = line.trim();
      if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*") || t.startsWith("{/*")) return;
      if (TR.test(line)) out.push(`${p.replace(process.cwd() + "/", "")}:${i + 1}: ${t.slice(0, 110)}`);
    });
  }
};
walk(join(process.cwd(), "src"));
console.log(out.join("\n"));
console.log(`\n${out.length} satır`);
