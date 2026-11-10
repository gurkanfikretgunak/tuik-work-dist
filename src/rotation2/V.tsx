"use client";
import clsx from "clsx";
import { ArrowRight } from "lucide-react";
import { useMemo, useState } from "react";
import { useConfirm } from "@/components/confirm";
import { Badge, Button, Card, Collapsible, InfoCard, ScreenTitle, Stat } from "@/components/ui";
import { monthName, useT } from "@/i18n";
import { absenceOf } from "./absence";
import { weeklyOf, type Tier } from "./model";
import { rulesOfState } from "./rules";
import { useRot2 } from "./store";
import { REGION_TOL, validate2 } from "./validator";

const hue = (d: number, n: number) => `hsl(${Math.round((d * 360) / n)} 65% 87%)`;

export default function V() {
  const confirm = useConfirm();
  const { t, lang } = useT();
  const s = useRot2();
  const [sel, setSel] = useState<{ tier: Tier; t: number; p: number } | null>(null);
  const { plans, result } = s;
  const v = useMemo(() => (plans ? validate2(plans, rulesOfState(useRot2.getState())) : null), [plans, s.n, s.m, s.g, s.specialGap, s.inside, s.outside, s.regions, result, lang]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!plans || !v || !result) return (<div><ScreenTitle no={2} title={t("v4.r.title")} /><InfoCard tone="warn">{t("v2ui.needPlan")}</InfoCard><Button className="mt-3" onClick={() => s.go(1)}>{t("v2ui.r3.gotoGen")}</Button></div>);

  const ab = absenceOf(s);
  const click = async (tier: Tier, mo: number, p: number) => {
    if (!sel || sel.tier !== tier || sel.t !== mo || sel.p === p) return setSel({ tier, t: mo, p });
    const a = sel.p, b = p;
    const next = { ...plans, [tier]: plans[tier].map((r) => [...r]) };
    next[tier][mo] = next[tier][mo].map((o) => (o === a ? b : o === b ? a : o));
    const rules = rulesOfState(useRot2.getState());
    const nv = validate2(next, rules)[tier], ov = v[tier];
    const issues = [
      !nv.monthlyOk && t("v2ui.r3.issue.monthly", { e: nv.monthlyErrors[0] }),
      nv.k6.length > ov.k6.length && t("v2ui.r3.issue.k6", { a: ov.k6.length, b: nv.k6.length }),
      nv.k1.length > ov.k1.length && t("v2ui.r3.issue.k1", { a: ov.k1.length, b: nv.k1.length }),
      nv.pairOver.length > ov.pairOver.length && t("v2ui.r3.issue.k2", { a: ov.pairOver.length, b: nv.pairOver.length }),
      nv.k3.length > ov.k3.length && t("v2ui.r3.issue.k3", { a: ov.k3.length, b: nv.k3.length }),
    ].filter(Boolean) as string[];
    const names = (x: number) => plans[tier][mo].flatMap((o, d) => (o === x ? [s[tier][d].code] : [])).join(", ") || "—";
    const ok = await confirm({
      title: issues.length ? t("v2ui.r3.swap.title.bad") : t("v2ui.r3.swap.title.ok"),
      body: (<><p>{tierName(tier)} · {mo + 1}. {monthName((s.startMonth - 1 + mo) % 12)}: <b>{pname(a)}</b> ({names(a)}) ⇄ <b>{pname(b)}</b> ({names(b)})</p>
        {issues.length ? <ul className="mt-1 list-inside list-disc text-[#C92830]">{issues.map((i) => <li key={i}>{i}</li>)}</ul> : <p className="mt-1 text-emerald-700">{t("v2ui.r3.swap.ok")}</p>}</>),
      confirmLabel: issues.length ? t("v2ui.r3.swap.confirm.bad") : t("v2ui.r3.swap.confirm.ok"), tone: issues.length ? "danger" : "primary",
    });
    setSel(null);
    if (!ok) return;
    s.setPlans(next);
    s.addSwap({ tier, month: mo, a, b });
    s.addLog(t("v2ui.r3.swap.log", { t: mo + 1, a: pname(a), b: pname(b), i: issues.length ? ` (${issues.join("; ")})` : "" }));
  };
  const tierName = (k: Tier) => t(k === "inside" ? "v4.tier.inside" : "v4.tier.outside");
  const pname = (i: number) => s.people[i]?.name || s.people[i]?.id || `P${i + 1}`;
  const regionName = (i: number) => s.regions[i]?.name || t("v4.def.region", { n: i + 1 });
  const status = (ok: boolean, label: string, detail: string) => (
    <li className="flex items-start gap-2 text-[12.5px]"><Badge tone={ok ? "green" : "red"}>{ok ? t("v2ui.badge.pass") : t("v2ui.badge.fail")}</Badge><span><b>{label}</b> — {detail}</span></li>
  );

  const planTable = (tier: Tier) => {
    const nbs = s[tier];
    const vt = v[tier];
    const owned = plans[tier].map((row) => s.people.map((_, p) => row.flatMap((o, d) => (o === p ? [d] : []))));
    const bad = new Set([...vt.k1.map((x) => `${x.months[1]}|${x.person}`), ...vt.k6.flatMap((x) => [`${x.months[0]}|${x.person}`, `${x.months[1]}|${x.person}`])]);
    return (
      <div className="overflow-auto">
        <table className="border-separate border-spacing-0 text-[12px]" data-testid={`v4-plan-${tier}`}>
          <thead><tr><th className="sticky left-0 bg-white px-2 py-1 text-left">{t("v2ui.r3.plan.month")}</th>{s.people.map((p, i) => <th key={i} className="border-b border-slate-200 px-2 py-1" title={pname(i)}>{p.id}</th>)}</tr></thead>
          <tbody>
            {plans[tier].map((_, mo) => {
              const idx = s.startMonth - 1 + mo;
              return (
                <tr key={mo}>
                  <td className="sticky left-0 whitespace-nowrap bg-white px-2 py-0.5 font-medium">{mo + 1}. {monthName(idx % 12)} {s.year + Math.floor(idx / 12)}</td>
                  {s.people.map((_, p) => {
                    const list = owned[mo][p];
                    const away = ab.absent[mo]?.[p];
                    return (
                      <td key={p} onClick={() => click(tier, mo, p)} data-testid={`v4-cell-${tier}-${mo}-${p}`}
                        title={away ? t("v2ui.r3.cell.away", { p: pname(p), d: ab.days[mo][p] }) : `${pname(p)} · ${list.map((d) => nbs[d].code).join(", ")}`}
                        style={away ? undefined : { background: list.length ? hue(list[0], s.n) : undefined }}
                        className={clsx("min-w-12 cursor-pointer border border-white px-2 py-0.5 text-center tabular-nums",
                          away && "bg-slate-200 font-semibold text-slate-500",
                          bad.has(`${mo}|${p}`) && "outline outline-2 -outline-offset-2 outline-[#C92830]",
                          sel?.tier === tier && sel.t === mo && sel.p === p && "ring-2 ring-[#1F2A44]")}>
                        {away ? t("v2ui.r3.away.mark") : list.length ? list.map((d) => `${nbs[d].code}${nbs[d].weekly ? "★" : ""}`).join("+") : "—"}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const tierVal = (tier: Tier) => {
    const vt = v[tier];
    const lim = rulesOfState(useRot2.getState()).pairLimit[tier];
    const wk = weeklyOf(s[tier]).map((i) => s[tier][i].code).join(", ");
    return (
      <Card key={tier} title={`${t("v2ui.r3.val.title")} · ${tierName(tier)}`}>
        <ul className="space-y-1.5">
          {status(vt.monthlyOk, t("v2ui.r3.val.monthly"), vt.monthlyOk ? t("v2ui.r3.val.monthly.plain") : vt.monthlyErrors.slice(0, 3).join("; "))}
          {status(vt.k1.length === 0, t("v4.r.val.k1", { g: s.g }), vt.k1.length ? t("v4.r.val.n", { n: vt.k1.length }) : t("v2ui.r3.val.none"))}
          {wk && s.specialGap > 0 && status(vt.k6.length === 0, t("v4.r.val.k6", { l: wk }), vt.k6.length ? t("v4.r.val.n", { n: vt.k6.length }) : t("v2ui.r3.val.none"))}
          {status(vt.pairOver.length === 0, t("v4.r.val.k2", { l: lim }), vt.pairOver.length ? t("v4.r.val.n", { n: vt.pairOver.length }) : t("v2ui.r3.val.k2.ok", { m: vt.maxPair }))}
          {status(vt.k3.length === 0, t("v2ui.r3.val.k3"), vt.k3.length ? t("v4.r.val.n", { n: vt.k3.length }) : t("v2ui.r3.val.k3.ok"))}
        </ul>
      </Card>
    );
  };

  const R = v.region;
  return (
    <div>
      <ScreenTitle no={2} title={t("v4.r.title")}>
        <Button variant="primary" onClick={() => s.go(3)} data-testid="v4-next2">{t("v2ui.r3.next")} <ArrowRight className="h-3.5 w-3.5" /></Button>
      </ScreenTitle>
      <div className="mb-3"><Collapsible title={t("v4.r.help.title")}>{t("v4.r.help.body")}</Collapsible></div>

      <div className="mb-3 space-y-1.5">
        {(["inside", "outside"] as Tier[]).map((tier) => (
          <div key={tier} className="flex flex-wrap items-center gap-2">
            <span className="w-24 text-[12.5px] font-medium">{tierName(tier)}</span>
            {result[tier].candidates.map((c, i) => (
              <Button key={i} size="sm" variant={i === s.picked[tier] ? "primary" : "secondary"} onClick={() => s.pick(tier, i)} data-testid={`v4-cand-${tier}-${i}`}>
                {t("v4.r.cand", { i: i + 1, m: c.maxPair })}
              </Button>
            ))}
          </div>
        ))}
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-5">
        <Stat label={t("v2ui.rules")} value={v.ok ? t("v2ui.pass") : t("v2ui.fail")} tone={v.ok ? "green" : "red"} />
        <Stat label={`${t("v2ui.r3.stat.k2")} · ${t("v4.tier.inside")}`} value={`${v.inside.maxPair} / ${rulesOfState(s).pairLimit.inside}`} tone={v.inside.pairOver.length ? "red" : "green"} />
        <Stat label={`${t("v2ui.r3.stat.k2")} · ${t("v4.tier.outside")}`} value={`${v.outside.maxPair} / ${rulesOfState(s).pairLimit.outside}`} tone={v.outside.pairOver.length ? "red" : "green"} />
        <Stat label={t("v2ui.r3.stat.k6")} value={v.inside.k6.length + v.outside.k6.length} tone={v.inside.k6.length + v.outside.k6.length ? "red" : "green"} />
        <Stat label={t("v4.r.stat.region")} value={R.maxDev.toFixed(2)} sub={t("v4.r.stat.region.sub", { t: REGION_TOL })} tone={v.regionOk ? "green" : "amber"} />
      </div>

      {(["inside", "outside"] as Tier[]).map((tier) => (
        <Card key={tier} title={t("v4.r.plan", { tier: tierName(tier) })} className="mb-3">{planTable(tier)}</Card>
      ))}

      <div className="grid gap-3 lg:grid-cols-2">{tierVal("inside")}{tierVal("outside")}</div>

      <Card title={t("v4.r.region.title")} className="mt-3">
        <div className="mb-2"><InfoCard tone={v.regionOk ? "ok" : "warn"}>{t("v4.r.region.note", { d: R.maxDev.toFixed(2), t: REGION_TOL })}</InfoCard></div>
        <div className="overflow-auto">
          <table className="w-full text-[12px]" data-testid="v4-region-table">
            <thead className="text-left text-slate-500"><tr><th>{t("v2ui.r3.person.person")}</th>{s.regions.map((_, r) => <th key={r} className="text-right">{regionName(r)}</th>)}<th className="text-right">{t("v4.r.region.total")}</th></tr></thead>
            <tbody>
              {s.people.map((_, p) => (
                <tr key={p} className="border-t border-slate-100">
                  <td>{pname(p)}</td>
                  {s.regions.map((_, r) => {
                    const dev = Math.abs(R.counts[p][r] - R.expected[p][r]);
                    return <td key={r} className={clsx("text-right tabular-nums", dev > REGION_TOL && "font-semibold text-amber-700")} title={t("v2ui.r3.matrix.target", { e: Math.round(R.expected[p][r] * 100) / 100 })}>{R.counts[p][r]}</td>;
                  })}
                  <td className="text-right tabular-nums">{R.total[p]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-3 flex items-center justify-between">
        <Button onClick={() => s.go(1)}>{t("v2ui.r3.back")}</Button>
        <Button variant="primary" onClick={() => s.go(3)}>{t("v2ui.r3.next")} <ArrowRight className="h-3.5 w-3.5" /></Button>
      </div>
    </div>
  );
}
