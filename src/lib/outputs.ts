import { fmtDateTime, fmtTime, tx, useLangStore } from "@/i18n";
import { toCsv } from "./csv";
import { reasonText } from "./engine";
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

/** Oran (0–1) → yerel yüzde gösterimi. */
export const pct = (n: number) => tx("v1core.pct", { n: Math.round(n * 100) });
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const hhmm = (iso: string) => fmtTime(iso);

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
  const lang = useLangStore.getState().lang;
  const tbl = (head: string[], rows: unknown[][]) =>
    `<table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((x) => `<tr>${x.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  const kind = (m: boolean) => tx(m ? "v1core.mand" : "v1core.pref");
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>${esc(tx("v1core.rep.docTitle"))}</title>
<style>body{font:13px Segoe UI,Arial,sans-serif;color:#1b2233;margin:24px;max-width:1000px}h1{color:#1F2A44}h2{color:#1F2A44;border-bottom:2px solid #C92830;padding-bottom:2px;margin-top:22px}
table{border-collapse:collapse;width:100%;margin:6px 0}th,td{border:1px solid #cbd5e1;padding:3px 6px;text-align:left;font-size:12px}th{background:#f1f5f9}.k{display:flex;gap:8px;flex-wrap:wrap}.k div{border:1px solid #cbd5e1;padding:6px 10px;border-radius:4px}.k b{display:block;font-size:18px}</style></head><body>
<h1>${esc(tx("v1core.rep.h1"))}</h1><p>${esc(tx("v1core.rep.created", { ts: fmtDateTime(new Date()) }))}</p>
<h2>${esc(tx("v1core.rep.summary"))}</h2><div class="k"><div>${esc(tx("v1core.l.totalJobs"))}<b>${t.toplamIs}</b></div><div>${esc(tx("v1core.l.assigned"))}<b>${t.atanan}</b></div><div>${esc(tx("v1core.l.unassigned"))}<b>${t.atanamayan}</b></div><div>${esc(tx("v1core.l.employees"))}<b>${t.calisan}</b></div><div>${esc(tx("v1core.l.avgFill"))}<b>${pct(r.fill.avg)}</b></div><div>${esc(tx("v1core.l.manualChanges"))}<b>${t.manuelSayisi}</b></div></div>
<h2>${esc(tx("v1core.rep.timeline"))}</h2>${tbl([tx("v1core.rep.time"), tx("v1core.rep.event")], events.map((e) => [hhmm(e.ts), e.message]))}
<h2>${esc(tx("v1core.rep.rulesCap"))}</h2>${tbl([tx("v1core.rep.priority"), tx("v1core.rep.rule"), tx("v1core.rep.type")], r.rs.rules.filter((x) => x.enabled).map((x, i) => [i + 1, RULE_META[x.id].label, kind(x.mandatory)]))}
<p>${esc(tx("v1core.rep.capLine", { mode: tx(r.rs.kapasiteModu === "sert" ? "v1core.mode.sert" : "v1core.mode.orantili"), unit: tx(`v1core.unit.${r.rs.kapasiteBirimi}`), cap: r.totals.efektifKapasite }))}</p>
<h2>${esc(tx("v1core.rep.metrics"))}</h2><p>${esc(tx("v1core.rep.fillLine", { avg: pct(r.fill.avg), min: pct(r.fill.min), max: pct(r.fill.max), sd: (r.fill.sd * 100).toFixed(1) }))}</p>
${tbl([tx("v1core.rep.rule"), tx("v1core.rep.compliant"), tx("v1core.rep.total"), tx("v1core.rep.ratio")], r.uyum.map((u) => [u.label, u.ok, u.total, u.total ? pct(u.ok / u.total) : "—"]))}
<p>${esc(tx("v1core.rep.ruralLine", { rural: r.kirKent.kir, urban: r.kirKent.kent, total: r.gecenAy.toplam, same: r.gecenAy.ayni, changed: r.gecenAy.degisen }))}</p>
<h2>${esc(tx("v1core.rep.unassigned"))}</h2>${r.sebepler.length ? tbl([tx("v1core.rep.reason"), tx("v1core.rep.count"), tx("v1core.rep.jobs")], r.sebepler.map((s) => [reasonText(s.sebep), s.adet, s.ids.join(", ")])) : `<p>${esc(tx("v1core.rep.none"))}</p>`}
<h2>${esc(tx("v1core.rep.manualLog"))}</h2>${r.manuel.length ? tbl([tx("v1core.rep.time"), tx("v1core.rep.change")], r.manuel.map((e) => [hhmm(e.ts), e.message])) : `<p>${esc(tx("v1core.rep.noManual"))}</p>`}
<h2>${esc(tx("v1core.rep.perEmp"))}</h2>${tbl([tx("v1core.l.employee"), tx("v1core.l.capacity"), tx("v1core.l.assignedShort"), tx("v1core.l.fill"), tx("v1core.l.rural"), tx("v1core.l.urban"), tx("v1core.l.neighbourhood")], r.perEmp.map((p) => [`${p.id} ${p.ad}`, p.kapasite, p.atanan, pct(p.doluluk), p.kir, p.kent, p.mahalle]))}
<h2>${esc(tx("v1core.rep.perIl"))}</h2>${tbl([tx("v1core.l.province"), tx("v1core.l.totalJobs"), tx("v1core.l.assignedShort"), tx("v1core.l.employees"), tx("v1core.l.capacity"), tx("v1core.l.fill")], r.perIl.map((p) => [p.il, p.toplam, p.atanan, p.calisan, p.kapasite, pct(p.doluluk)]))}
</body></html>`;
}

export function summaryText(r: Report): string {
  const t = r.totals;
  const flags: string[] = [];
  if (t.atanamayan) flags.push(tx("v1core.sum.unassigned", { n: t.atanamayan }));
  const hi = r.perEmp.filter((p) => p.doluluk >= 0.95).length;
  const lo = r.perEmp.filter((p) => p.kapasite > 0 && p.doluluk < 0.5).length;
  if (hi) flags.push(tx("v1core.sum.high", { n: hi }));
  if (lo) flags.push(tx("v1core.sum.low", { n: lo }));
  if (t.uyariSayisi) flags.push(tx("v1core.sum.warn", { n: t.uyariSayisi }));
  return tx("v1core.sum.text", {
    total: t.toplamIs, assigned: t.atanan, unassigned: t.atanamayan, emps: t.calisan, il: t.il,
    fill: pct(r.fill.avg), manual: t.manuelSayisi, flags: flags.length ? flags.join("; ") : tx("v1core.sum.noFlags"),
  });
}
