"use client";
import clsx from "clsx";
import { ArrowRight } from "lucide-react";
import { useMemo, useState } from "react";
import { useConfirm } from "@/components/confirm";
import { useT } from "@/i18n";
import { Badge, Button, Card, Collapsible, InfoCard, ScreenTitle, Stat } from "@/components/ui";
import { generatePlans } from "./engine";
import { absenceOf, buildParams, rulesOf } from "./params";
import { monthLabel, useRot } from "./store";
import { validatePlan } from "./validator";

export const nbColor = (d: number, n: number) => `hsl(${Math.round((d * 360) / n)} 65% 87%)`;
const heat = (v: number, max: number) => ({ background: `rgba(31,42,68,${max ? Math.min(0.85, (v / max) * 0.85) : 0})`, color: max && v / max > 0.45 ? "#fff" : "#1b2233" });
const r1 = (x: number) => Math.round(x * 10) / 10;

export default function R3() {
  const confirm = useConfirm();
  const { t, rt, lang } = useT();
  const s = useRot();
  const { n, plan, people, notebooks, result, picked } = s;
  const [sel, setSel] = useState<{ t: number; p: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const rules = rulesOf(s);
  const ab = useMemo(() => absenceOf(s), [s.leaves, s.people, s.startMonth, s.year, s.m, s.leaveThreshold]); // eslint-disable-line react-hooks/exhaustive-deps
  const v = useMemo(() => (plan ? validatePlan(plan, rules) : null), [plan, rules.n, rules.m, rules.g, rules.pairLimit, rules.groups, rules.forbidden, rules.special, rules.specialGap, rules.absent, rules.strategy, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!plan || !v || !result) return (<div><ScreenTitle no={3} title={t("v2ui.r3.title")} /><InfoCard tone="warn">{t("v2ui.needPlan")}</InfoCard><Button className="mt-3" onClick={() => s.go(2)}>{t("v2ui.r3.gotoGen")}</Button></div>);

  const T = v.targets;
  const k1set = new Set(v.k1.map((x) => `${x.months[1]}|${x.person}`));
  const k6set = new Set(v.k6.flatMap((x) => [`${x.months[0]}|${x.person}`, `${x.months[1]}|${x.person}`]));
  const spSet = new Set(rules.special ?? []);
  const maxCount = Math.max(1, ...v.counts.flat());
  const maxPair = Math.max(1, ...v.pairCounts.flat());
  const name = (i: number) => people[i]?.name ?? `P${i + 1}`;
  const nb = (i: number) => notebooks[i]?.name ?? `D${i + 1}`;
  // [ay][kişi] → defterler
  const owned = plan.map((row) => people.map((_, p) => row.flatMap((o, d) => (o === p ? [d] : []))));
  const rowSum = v.counts.map((r) => r.reduce((a, b) => a + b, 0));

  const click = async (mo: number, p: number) => {
    if (!sel || sel.t !== mo || sel.p === p) return setSel({ t: mo, p });
    const a = sel.p, b = p;
    const next = plan.map((r) => [...r]);
    next[mo] = next[mo].map((o) => (o === a ? b : o === b ? a : o));
    const nv = validatePlan(next, rules);
    const issues = [
      !nv.monthlyOk && t("v2ui.r3.issue.monthly", { e: nv.monthlyErrors[0] }),
      nv.k6.length > v.k6.length && t("v2ui.r3.issue.k6", { a: v.k6.length, b: nv.k6.length }),
      nv.k1.length > v.k1.length && t("v2ui.r3.issue.k1", { a: v.k1.length, b: nv.k1.length }),
      nv.pairOver.length > v.pairOver.length && t("v2ui.r3.issue.k2", { a: v.pairOver.length, b: nv.pairOver.length }),
      nv.k3.length > v.k3.length && t("v2ui.r3.issue.k3", { a: v.k3.length, b: nv.k3.length }),
    ].filter(Boolean) as string[];
    const ok = await confirm({
      title: issues.length ? t("v2ui.r3.swap.title.bad") : t("v2ui.r3.swap.title.ok"),
      body: (<><p>{monthLabel(s.startMonth, mo, s.year).ay}: <b>{name(a)}</b> ({owned[mo][a].map((d) => nb(d)).join(", ") || "—"}) ⇄ <b>{name(b)}</b> ({owned[mo][b].map((d) => nb(d)).join(", ") || "—"})</p>
        {issues.length ? <ul className="mt-1 list-inside list-disc text-[#C92830]">{issues.map((i) => <li key={i}>{i}</li>)}</ul> : <p className="mt-1 text-emerald-700">{t("v2ui.r3.swap.ok")}</p>}</>),
      confirmLabel: issues.length ? t("v2ui.r3.swap.confirm.bad") : t("v2ui.r3.swap.confirm.ok"), tone: issues.length ? "danger" : "primary",
    });
    setSel(null);
    if (!ok) return;
    s.setPlan(next);
    s.addLog(t("v2ui.r3.swap.log", { t: mo + 1, a: name(a), b: name(b), i: issues.length ? ` (${issues.join("; ")})` : "" }));
    useRot.setState((x) => ({ swaps: [...x.swaps, { month: mo, a, b, ts: new Date().toISOString() }] }));
  };

  const replan = async () => {
    const ok = await confirm({
      title: t("v2ui.r3.replan.title"),
      body: <>{rt("v2ui.r3.replan.body", { n: s.swaps.length })}</>,
      confirmLabel: t("v2ui.r3.replan.confirm"), tone: "danger",
    });
    if (!ok) return;
    setBusy(true);
    const st = useRot.getState();
    const res = await generatePlans({ ...buildParams(st), seed: st.seed + 101 }, { timeMs: st.timeMs, want: 3 });
    st.setResult(res);
    st.addLog(res.candidates.length ? t("v2ui.r3.replan.log.ok", { c: res.candidates.length }) : t("v2ui.r3.replan.log.none"));
    setBusy(false);
  };

  const status = (ok: boolean, label: string, detail: string) => (
    <li className="flex items-start gap-2 text-[12.5px]"><Badge tone={ok ? "green" : "red"}>{ok ? t("v2ui.badge.pass") : t("v2ui.badge.fail")}</Badge><span><b>{label}</b> — {detail}</span></li>
  );
  const hasLeave = ab.absent.some((r) => r.some(Boolean));

  return (
    <div>
      <ScreenTitle no={3} title={t("v2ui.r3.title")}>
        <Button variant="primary" onClick={() => s.go(4)} data-testid="r3-next">{t("v2ui.r3.next")} <ArrowRight className="h-3.5 w-3.5" /></Button>
      </ScreenTitle>
      <div className="mb-3">
        <Collapsible title={t("v2ui.r3.help.title")}>
          {rt("v2ui.r3.help.body", { mark: t("v2ui.r3.away.mark") })}
        </Collapsible>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {result.candidates.map((c, i) => (
          <Button key={i} size="sm" variant={i === picked ? "primary" : "secondary"} onClick={async () => { if (i === picked) return; if (await confirm({ title: t("v2ui.r3.cand.title", { i: i + 1 }), body: t("v2ui.r3.cand.body"), confirmLabel: t("v2ui.r3.cand.confirm") })) s.pick(i); }}>
            {t("v2ui.r3.cand.label", { i: i + 1, m: c.maxPair, s: c.score, seed: c.seed })}
          </Button>
        ))}
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-6">
        <Stat label={t("v2ui.rules")} value={v.ok ? t("v2ui.pass") : t("v2ui.fail")} tone={v.ok ? "green" : "red"} />
        <Stat label={t("v2ui.r3.stat.dist")} value={`${v.actualD} / ${T.D}`} tone={v.actualD === T.D ? "green" : "amber"} />
        <Stat label={t("v2ui.r3.stat.k1")} value={v.k1.length} tone={v.k1.length ? "red" : "green"} />
        <Stat label={t("v2ui.r3.stat.k2")} value={`${v.maxPair} / ${rules.pairLimit}`} tone={v.pairOver.length ? "red" : "green"} />
        <Stat label={t("v2ui.r3.stat.k3")} value={v.k3.length} tone={v.k3.length ? "red" : "green"} />
        <Stat label={t("v2ui.r3.stat.k6")} value={v.k6.length} tone={v.k6.length ? "red" : "green"} />
      </div>
      {(v.k6.length > 0 || v.monthlyErrors.length > 0) && (
        <div className="mb-3" data-testid="k6-alert">
          <InfoCard tone="error" title={v.k6.length ? t("v2ui.r3.alert.k6") : t("v2ui.r3.alert.monthly")}>
            <div className="mb-1.5">{v.k6.length ? v.k6.slice(0, 5).map((x) => t("v2ui.r3.alert.k6line", { p: name(x.person), m1: x.months[0] + 1, n1: nb(x.notebooks[0]), m2: x.months[1] + 1, n2: nb(x.notebooks[1]) })).join(" · ") : v.monthlyErrors.slice(0, 3).join(" · ")}</div>
            <Button size="sm" variant="danger" disabled={busy} onClick={replan} data-testid="replan">{busy ? t("v2ui.r3.replan.busy") : t("v2ui.r3.replan.confirm")}</Button>
          </InfoCard>
        </div>
      )}

      <Card title={t("v2ui.r3.plan.title")} className="mb-3">
        <div className="overflow-auto">
          <table className="border-separate border-spacing-0 text-[12px]" data-testid="plan-table">
            <thead><tr><th className="sticky left-0 bg-white px-2 py-1 text-left">{t("v2ui.r3.plan.month")}</th>{people.map((p, i) => <th key={i} className="border-b border-slate-200 px-2 py-1" title={p.name}>{p.id}</th>)}</tr></thead>
            <tbody>
              {plan.map((_, mo) => (
                <tr key={mo}>
                  <td className="sticky left-0 whitespace-nowrap bg-white px-2 py-0.5 font-medium">{mo + 1}. {monthLabel(s.startMonth, mo, s.year).ay}{v.targets.k[mo] < n && <span className="ml-1 text-[10px] text-amber-700">({v.targets.k[mo]}/{n})</span>}</td>
                  {people.map((_, p) => {
                    const list = owned[mo][p];
                    const away = ab.absent[mo][p];
                    return (
                      <td key={p} onClick={() => click(mo, p)} data-testid={`cell-${mo}-${p}`}
                        title={away ? t("v2ui.r3.cell.away", { p: name(p), d: ab.days[mo][p] }) : `${name(p)} · ${list.map(nb).join(", ")}${ab.partial[mo][p] ? t("v2ui.r3.cell.partial", { d: ab.days[mo][p] }) : ""}`}
                        style={away ? undefined : { background: list.length ? nbColor(list[0], n) : undefined }}
                        className={clsx("min-w-9 cursor-pointer border border-white px-2 py-0.5 text-center tabular-nums",
                          away && "bg-slate-200 font-semibold text-slate-500 [background-image:repeating-linear-gradient(45deg,transparent,transparent_3px,rgba(0,0,0,.08)_3px,rgba(0,0,0,.08)_6px)]",
                          (k1set.has(`${mo}|${p}`) || k6set.has(`${mo}|${p}`)) && "outline outline-2 -outline-offset-2 outline-[#C92830]",
                          sel?.t === mo && sel.p === p && "ring-2 ring-[#1F2A44]")}>
                        {away ? t("v2ui.r3.away.mark") : list.length ? list.map((d) => `${d + 1}${spSet.has(d) ? "★" : ""}`).join("+") : "—"}
                        {ab.partial[mo][p] && <span className="text-amber-700">•</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {v.openCount > 0 && <div className="mt-1 text-[11.5px] text-slate-600">{rt("v2ui.r3.open", { n: v.openCount })}</div>}
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card title={t("v2ui.r3.val.title")}>
          <ul className="space-y-1.5">
            {status(v.monthlyOk, t("v2ui.r3.val.monthly"), v.monthlyOk ? (hasLeave ? t("v2ui.r3.val.monthly.leave") : t("v2ui.r3.val.monthly.plain")) : v.monthlyErrors.slice(0, 3).join("; "))}
            {status(v.actualD === T.D, t("v2ui.r3.val.d"), t("v2ui.r3.val.d.detail", { a: v.actualD, d: T.D }))}
            {status(v.k1.length === 0, t("v2ui.r3.val.k1", { g: s.g }), v.k1.length ? v.k1.slice(0, 4).map((x) => t("v2ui.r3.val.k1.item", { p: name(x.person), nb: nb(x.notebook), a: x.months[0] + 1, b: x.months[1] + 1 })).join("; ") : t("v2ui.r3.val.none"))}
            {(rules.special?.length ?? 0) > 0 && (rules.specialGap ?? 1) > 0 && status(v.k6.length === 0, t("v2ui.r3.val.k6", { l: (rules.special ?? []).map((i) => notebooks[i]?.no).join(", ") }), v.k6.length ? t("v2ui.r3.val.k6.bad", { n: v.k6.length }) : t("v2ui.r3.val.k6.ok", { l: v.specialCounts.join(", ") }))}
            {status(v.pairOver.length === 0, t("v2ui.r3.val.k2", { l: rules.pairLimit }), v.pairOver.length ? v.pairOver.slice(0, 4).map((x) => `${name(x.from)}→${name(x.to)} ${x.count}×`).join("; ") : t("v2ui.r3.val.k2.ok", { m: v.maxPair }))}
            {status(v.k3.length === 0, t("v2ui.r3.val.k3"), v.k3.length ? v.k3.slice(0, 4).map((x) => t("v2ui.r3.val.k3.item", { p: name(x.person), nb: nb(x.notebook), c: x.count, e: r1(T.e[x.person][x.notebook]) })).join("; ") : t("v2ui.r3.val.k3.ok"))}
            {s.useGroups && status(v.k5.length === 0, t("v2ui.r3.val.k5"), v.k5.length ? t("v2ui.r3.val.k5.bad", { n: v.k5.length }) : t("v2ui.r3.val.none"))}
            {v.forbiddenHits.length > 0 && status(false, t("v2ui.r3.val.forbidden"), t("v2ui.r3.val.forbidden.detail", { n: v.forbiddenHits.length }))}
          </ul>
          {result.relaxed.length > 0 && <div className="mt-2"><InfoCard tone="warn" title={t("v2ui.r3.relaxed.title")}>{result.relaxed.join("; ")}</InfoCard></div>}
        </Card>
        <Card title={t("v2ui.r3.person.title")}>
          <div className="max-h-56 overflow-auto">
            <table className="w-full text-[12px]" data-testid="person-targets">
              <thead className="text-left text-slate-500"><tr><th>{t("v2ui.r3.person.person")}</th><th className="text-right">{t("v2ui.r3.person.avail")}</th><th className="text-right">{t("v2ui.r3.person.target")}</th><th className="text-right">{t("v2ui.r3.person.actual")}</th><th className="text-right">{t("v2ui.r3.person.dev")}</th></tr></thead>
              <tbody>
                {people.map((p, i) => {
                  const dev = rowSum[i] - T.Dp[i];
                  return (<tr key={i} className="border-t border-slate-100"><td>{p.name}</td><td className="text-right tabular-nums">{T.a[i]}</td><td className="text-right tabular-nums">{r1(T.Dp[i])}</td><td className="text-right tabular-nums">{rowSum[i]}</td><td className={clsx("text-right tabular-nums", Math.abs(dev) > 1.5 && "font-semibold text-[#C92830]")}>{dev > 0 ? "+" : ""}{r1(dev)}</td></tr>);
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      <Card title={t("v2ui.r3.count.title")} className="mt-3">
        <Matrix data={v.counts} rowLab={people.map((p) => p.id)} max={maxCount} n={n} bounds={{ lo: T.lo, hi: T.hi, e: T.e }} />
      </Card>
      <Card title={t("v2ui.r3.pair.title")} className="mt-3">
        <Matrix data={v.pairCounts} rowLab={people.map((p) => p.id)} max={maxPair} n={n} limit={rules.pairLimit} />
      </Card>

      <div className="mt-3 flex items-center justify-between">
        <Button onClick={() => s.go(2)}>{t("v2ui.r3.back")}</Button>
        <Button variant="primary" onClick={() => s.go(4)}>{t("v2ui.r3.next")} <ArrowRight className="h-3.5 w-3.5" /></Button>
      </div>
    </div>
  );
}

function Matrix({ data, rowLab, max, n, limit, bounds }: { data: number[][]; rowLab: string[]; max: number; n: number; limit?: number; bounds?: { lo: number[][]; hi: number[][]; e: number[][] } }) {
  const { t } = useT();
  return (
    <div className="overflow-auto">
      <table className="border-separate border-spacing-px text-[11px]">
        <thead><tr><th />{Array.from({ length: n }, (_, i) => <th key={i} className="px-1 font-normal text-slate-500">{i + 1}</th>)}</tr></thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}><th className="pr-1 text-right font-normal text-slate-500">{rowLab[i]}</th>
              {row.map((c, j) => {
                const bad = (limit !== undefined && c > limit) || (bounds && (c < bounds.lo[i][j] || c > bounds.hi[i][j]));
                return <td key={j} title={bounds ? t("v2ui.r3.matrix.target", { e: Math.round(bounds.e[i][j] * 100) / 100 }) : undefined} style={heat(c, max)} className={clsx("h-5 min-w-5 text-center tabular-nums", bad && "outline outline-2 outline-[#C92830]")}>{c || ""}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
