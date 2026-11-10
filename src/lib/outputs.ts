import { toCsv } from "./csv";
import type { Report } from "./report";
import { RULE_META, type EmpRow, type EventLog, type RuleSet } from "./types";

export function ruleJson(employees: EmpRow[], rules: RuleSet): string {
  return JSON.stringify(
    {
      olusturma: new Date().toISOString(),
      kurallar: rules.rules.map((r, i) => ({ oncelik: i + 1, kural: RULE_META[r.id].label, id: r.id, acik: r.enabled, tip: r.mandatory ? "zorunlu" : "tercih" })),
      parametreler: {
        kapasiteBirimi: rules.kapasiteBirimi, kapasiteModu: rules.kapasiteModu, kirCarpan: rules.kirCarpan,
        sapma: rules.sapma, gecenAyYon: rules.gecenAyYon, kapasiteAsimi: rules.kapasiteAsimi, iyilestirme: rules.iyilestirme,
      },
      kapasiteAyarlari: employees.map((r) => ({ ...r.data, kullanildi: r.included && r.errors.length === 0 })),
      // Başka kullanıcının aynı ayarlarla dağıtım yapabilmesi için
      ayarSeti: { rules },
    },
    null,
    2,
  );
}

const pct = (n: number) => `%${Math.round(n * 100)}`;
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("tr-TR");

export function reportCsvs(r: Report) {
  return {
    "calisan_bazli.csv": toCsv(
      r.perEmp.map((p) => ({ calisan_id: p.id, ad_soyad: p.ad, il: p.il, kapasite: p.kapasite, atanan: p.atanan, doluluk_yuzde: Math.round(p.doluluk * 100), kir_is: p.kir, kent_is: p.kent, farkli_mahalle: p.mahalle })),
      ["calisan_id", "ad_soyad", "il", "kapasite", "atanan", "doluluk_yuzde", "kir_is", "kent_is", "farkli_mahalle"],
    ),
    "il_bazli.csv": toCsv(
      r.perIl.map((p) => ({ il: p.il, toplam_is: p.toplam, atanan: p.atanan, calisan: p.calisan, kapasite: p.kapasite, doluluk_yuzde: Math.round(p.doluluk * 100) })),
      ["il", "toplam_is", "atanan", "calisan", "kapasite", "doluluk_yuzde"],
    ),
  };
}

export function reportHtml(r: Report, events: EventLog[]): string {
  const t = r.totals;
  const tbl = (head: string[], rows: unknown[][]) =>
    `<table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((x) => `<tr>${x.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>Süreç Raporu</title>
<style>body{font:13px Segoe UI,Arial,sans-serif;color:#1b2233;margin:24px;max-width:1000px}h1{color:#1F2A44}h2{color:#1F2A44;border-bottom:2px solid #C92830;padding-bottom:2px;margin-top:22px}
table{border-collapse:collapse;width:100%;margin:6px 0}th,td{border:1px solid #cbd5e1;padding:3px 6px;text-align:left;font-size:12px}th{background:#f1f5f9}.k{display:flex;gap:8px;flex-wrap:wrap}.k div{border:1px solid #cbd5e1;padding:6px 10px;border-radius:4px}.k b{display:block;font-size:18px}</style></head><body>
<h1>TÜİK İş Dağıtım Aracı — Süreç Raporu</h1><p>Oluşturma: ${new Date().toLocaleString("tr-TR")}</p>
<h2>Özet</h2><div class="k"><div>Toplam iş<b>${t.toplamIs}</b></div><div>Atanan<b>${t.atanan}</b></div><div>Atanamayan<b>${t.atanamayan}</b></div><div>Çalışan<b>${t.calisan}</b></div><div>Ortalama doluluk<b>${pct(r.fill.avg)}</b></div><div>Manuel değişiklik<b>${t.manuelSayisi}</b></div></div>
<h2>Süreç zaman çizelgesi</h2>${tbl(["Saat", "Olay"], events.map((e) => [hhmm(e.ts), e.message]))}
<h2>Kural ve kapasite özeti</h2>${tbl(["Öncelik", "Kural", "Tip"], r.rs.rules.filter((x) => x.enabled).map((x, i) => [i + 1, RULE_META[x.id].label, x.mandatory ? "zorunlu" : "tercih"]))}
<p>Kapasite modu: ${r.rs.kapasiteModu === "sert" ? "sert limit" : "orantılı hedef"} · birim: ${r.rs.kapasiteBirimi} · toplam efektif kapasite: ${r.totals.efektifKapasite}</p>
<h2>Dağıtım sonuç metrikleri</h2><p>Doluluk — ortalama ${pct(r.fill.avg)}, en düşük ${pct(r.fill.min)}, en yüksek ${pct(r.fill.max)}, standart sapma ${(r.fill.sd * 100).toFixed(1)} puan.</p>
${tbl(["Kural", "Uyumlu", "Toplam", "Oran"], r.uyum.map((u) => [u.label, u.ok, u.total, u.total ? pct(u.ok / u.total) : "—"]))}
<p>Kır/kent: ${r.kirKent.kir} / ${r.kirKent.kent}. Geçen ay: ${r.gecenAy.toplam} işten ${r.gecenAy.ayni} aynı kişide kaldı, ${r.gecenAy.degisen} değişti.</p>
<h2>Atanamayan işler</h2>${r.sebepler.length ? tbl(["Sebep", "Adet", "İşler"], r.sebepler.map((s) => [s.sebep, s.adet, s.ids.join(", ")])) : "<p>Yok.</p>"}
<h2>Manuel değişiklik günlüğü</h2>${r.manuel.length ? tbl(["Saat", "Değişiklik"], r.manuel.map((e) => [hhmm(e.ts), e.message])) : "<p>Manuel değişiklik yapılmadı.</p>"}
<h2>Çalışan bazlı</h2>${tbl(["Çalışan", "Kapasite", "Atanan", "Doluluk", "Kır", "Kent", "Mahalle"], r.perEmp.map((p) => [`${p.id} ${p.ad}`, p.kapasite, p.atanan, pct(p.doluluk), p.kir, p.kent, p.mahalle]))}
<h2>İl bazlı</h2>${tbl(["İl", "Toplam iş", "Atanan", "Çalışan", "Kapasite", "Doluluk"], r.perIl.map((p) => [p.il, p.toplam, p.atanan, p.calisan, p.kapasite, pct(p.doluluk)]))}
</body></html>`;
}

export function summaryText(r: Report): string {
  const t = r.totals;
  const flags: string[] = [];
  if (t.atanamayan) flags.push(`${t.atanamayan} iş atanamadı`);
  const hi = r.perEmp.filter((p) => p.doluluk > 0.95).length;
  const lo = r.perEmp.filter((p) => p.kapasite > 0 && p.doluluk < 0.5).length;
  if (hi) flags.push(`${hi} çalışan %95 üzeri dolu`);
  if (lo) flags.push(`${lo} çalışan %50 altı dolu`);
  if (t.uyariSayisi) flags.push(`${t.uyariSayisi} atamada uyarı var`);
  return `İş dağıtımı özeti
Toplam iş: ${t.toplamIs} · Atanan: ${t.atanan} · Atanamayan: ${t.atanamayan}
Çalışan: ${t.calisan} · İl: ${t.il} · Ortalama doluluk: ${pct(r.fill.avg)}
Manuel değişiklik: ${t.manuelSayisi}
Dikkat: ${flags.length ? flags.join("; ") : "özel bir uyarı yok"}`;
}
