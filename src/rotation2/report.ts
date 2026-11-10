import { fmtDateTime, monthName, tx, useLangStore } from "@/i18n";
import type { Absence } from "../rotation/leave";
import { weeklyOf, type Tier } from "./model";
import type { useRot2 } from "./store";
import { REGION_TOL, type Validation2 } from "./validator";

type St = ReturnType<typeof useRot2.getState>;

const esc = (x: string | number) => String(x).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const hue = (d: number, n: number) => `hsl(${Math.round((d * 360) / n)} 70% 88%)`;

const CSS = `
*{box-sizing:border-box}body{font:12px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;color:#1b2233;margin:0;padding:18px 22px;background:#fff}
h1{font-size:20px;margin:0 0 2px;color:#1F2A44}h2{font-size:14px;margin:18px 0 6px;color:#1F2A44;border-bottom:2px solid #C92830;padding-bottom:2px}
.meta{color:#556;margin-bottom:8px}.ok{color:#15803d;font-weight:600}.bad{color:#C92830;font-weight:600}
table{border-collapse:collapse;margin:4px 0 8px;page-break-inside:avoid}th,td{border:1px solid #d5dae3;padding:2px 6px;text-align:center;font-size:11px;white-space:nowrap}
th{background:#f1f4f9}td.l,th.l{text-align:left}.away{background:#e2e5ea;color:#667;font-weight:600}.bd{outline:2px solid #C92830;outline-offset:-2px}
ul{margin:4px 0 8px;padding-left:18px}.note{color:#556;font-size:11px}
@page{size:A4 landscape;margin:10mm}@media print{body{padding:0}h2{page-break-after:avoid}}
`;

/** Kendi içinde tam (harici kaynaksız) HTML rapor: ekranda görüntülenir, indirilir veya yazdırılıp PDF'ye kaydedilir. */
export function buildReportHtml(s: St, v: Validation2, ab: Absence, pairLimit: { inside: number; outside: number }): string {
  const lang = useLangStore.getState().lang;
  const pname = (i: number) => s.people[i]?.name || s.people[i]?.id || `P${i + 1}`;
  const regionName = (i: number) => s.regions[i]?.name || tx("v4.def.region", { n: i + 1 });
  const tierName = (k: Tier) => tx(k === "inside" ? "v4.tier.inside" : "v4.tier.outside");
  const plans = s.plans!;
  const ml = (mo: number) => { const i = s.startMonth - 1 + mo; return `${mo + 1}. ${monthName(i % 12)} ${s.year + Math.floor(i / 12)}`; };
  const pf = (ok: boolean) => `<span class="${ok ? "ok" : "bad"}">${esc(ok ? tx("v2ui.pass") : tx("v2ui.fail"))}</span>`;

  const planTable = (tier: Tier) => {
    const nbs = s[tier];
    const vt = v[tier];
    const bad = new Set([...vt.k1.map((x) => `${x.months[1]}|${x.person}`), ...vt.k6.flatMap((x) => [`${x.months[0]}|${x.person}`, `${x.months[1]}|${x.person}`])]);
    const head = `<tr><th class="l">${esc(tx("v2ui.r3.plan.month"))}</th>${s.people.map((p, i) => `<th title="${esc(pname(i))}">${esc(p.id)}</th>`).join("")}</tr>`;
    const body = plans[tier].map((row, mo) => `<tr><td class="l">${esc(ml(mo))}</td>${s.people.map((_, p) => {
      const own = row.flatMap((o, d) => (o === p ? [d] : []));
      if (ab.absent[mo]?.[p]) return `<td class="away">${esc(tx("v2ui.r3.away.mark"))}</td>`;
      const bg = own.length ? ` style="background:${hue(own[0], s.n)}"` : "";
      return `<td${bg}${bad.has(`${mo}|${p}`) ? ' class="bd"' : ""}>${own.length ? esc(own.map((d) => `${nbs[d].code}${nbs[d].weekly ? "★" : ""}`).join("+")) : "—"}</td>`;
    }).join("")}</tr>`).join("");
    const wk = weeklyOf(nbs).map((i) => nbs[i].code).join(", ");
    const lines = [
      [tx("v2ui.r3.val.monthly"), vt.monthlyOk],
      [tx("v4.r.val.k1", { g: s.g }), vt.k1.length === 0],
      ...(wk && s.specialGap > 0 ? [[tx("v4.r.val.k6", { l: wk }), vt.k6.length === 0]] : []),
      [tx("v4.r.val.k2", { l: pairLimit[tier] }), vt.pairOver.length === 0],
      [tx("v2ui.r3.val.k3"), vt.k3.length === 0],
    ] as [string, boolean][];
    return `<h2>${esc(tx("v4.r.plan", { tier: tierName(tier) }))}</h2><table>${head}${body}</table>
<ul>${lines.map(([l, ok]) => `<li>${esc(l)} — ${pf(ok)}</li>`).join("")}</ul>`;
  };

  const R = v.region;
  const regionTable = `<table><tr><th class="l">${esc(tx("v2ui.r3.person.person"))}</th>${s.regions.map((_, r) => `<th>${esc(regionName(r))}</th>`).join("")}<th>${esc(tx("v4.r.region.total"))}</th></tr>
${s.people.map((_, p) => `<tr><td class="l">${esc(pname(p))}</td>${s.regions.map((_, r) => `<td${Math.abs(R.counts[p][r] - R.expected[p][r]) > REGION_TOL ? ' class="bd"' : ""}>${R.counts[p][r]}</td>`).join("")}<td>${R.total[p]}</td></tr>`).join("")}</table>
<div class="note">${esc(tx("v4.r.region.note", { d: R.maxDev.toFixed(2), t: REGION_TOL }))}</div>`;

  const params: [string, string | number][] = [
    [tx("v4.p.n"), s.n], [tx("v4.p.m"), s.m], [tx("v4.p.start"), `${monthName(s.startMonth - 1)} ${s.year}`], [tx("v4.p.g"), s.g], [tx("v4.p.gap"), s.specialGap], [tx("v4.p.seed"), s.seed],
    [tx("v4.p.regions"), s.regions.map((r, i) => `${regionName(i)} (${r.code}: ${r.size})`).join(", ")],
  ];
  const leaves = s.leaves.filter((l) => l.included);
  const swaps = s.swaps.map((w) => `${tierName(w.tier)} · ${ml(w.month)}: ${pname(w.a)} ⇄ ${pname(w.b)}`);

  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(tx("v4.rep.title"))}</title><style>${CSS}</style></head><body>
<h1>${esc(tx("v4.rep.title"))}</h1>
<div class="meta">${esc(tx("v4.rep.generated"))}: ${esc(fmtDateTime(new Date()))} · ${esc(tx("v4.rep.status"))}: <span class="${s.approved ? "ok" : "bad"}">${esc(tx(s.approved ? "v4.rep.status.approved" : "v4.rep.status.draft"))}</span> · ${esc(tx("v2ui.rules"))}: ${pf(v.ok)}</div>
<h2>${esc(tx("v4.rep.params"))}</h2><table>${params.map(([k, x]) => `<tr><th class="l">${esc(k)}</th><td class="l">${esc(x)}</td></tr>`).join("")}</table>
${planTable("inside")}${planTable("outside")}
<h2>${esc(tx("v4.r.region.title"))}</h2>${regionTable}
<h2>${esc(tx("v4.rep.leaves"))}</h2>${leaves.length ? `<ul>${leaves.map((l) => `<li>${esc(l.personId)}: ${esc(l.start)} – ${esc(l.end)}${l.note ? ` (${esc(l.note)})` : ""}</li>`).join("")}</ul>` : `<div class="note">${esc(tx("v4.rep.none"))}</div>`}
<h2>${esc(tx("v4.rep.swaps"))}</h2>${swaps.length ? `<ul>${swaps.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : `<div class="note">${esc(tx("v4.rep.none"))}</div>`}
<div class="note">${esc(tx("v4.rep.legend", { mark: tx("v2ui.r3.away.mark") }))}</div>
</body></html>`;
}
