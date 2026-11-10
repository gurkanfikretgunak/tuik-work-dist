"use client";
import clsx from "clsx";
import { ArrowRight } from "lucide-react";
import { useMemo, useState } from "react";
import { useConfirm } from "@/components/confirm";
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
  const s = useRot();
  const { n, plan, people, notebooks, result, picked } = s;
  const [sel, setSel] = useState<{ t: number; p: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const rules = rulesOf(s);
  const ab = useMemo(() => absenceOf(s), [s.leaves, s.people, s.startMonth, s.year, s.m, s.leaveThreshold]); // eslint-disable-line react-hooks/exhaustive-deps
  const v = useMemo(() => (plan ? validatePlan(plan, rules) : null), [plan, rules.n, rules.m, rules.g, rules.pairLimit, rules.groups, rules.forbidden, rules.special, rules.specialGap, rules.absent, rules.strategy]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!plan || !v || !result) return (<div><ScreenTitle no={3} title="Plan İnceleme ve Doğrulama (R3)" /><InfoCard tone="warn">Önce plan üretin.</InfoCard><Button className="mt-3" onClick={() => s.go(2)}>Plan üretimine git</Button></div>);

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

  const click = async (t: number, p: number) => {
    if (!sel || sel.t !== t || sel.p === p) return setSel({ t, p });
    const a = sel.p, b = p;
    const next = plan.map((r) => [...r]);
    next[t] = next[t].map((o) => (o === a ? b : o === b ? a : o));
    const nv = validatePlan(next, rules);
    const issues = [
      !nv.monthlyOk && `Aylık düzen bozuluyor (${nv.monthlyErrors[0]})`,
      nv.k6.length > v.k6.length && `K6 peş peşe özel defter: ${v.k6.length} → ${nv.k6.length}`,
      nv.k1.length > v.k1.length && `K1 ihlali: ${v.k1.length} → ${nv.k1.length}`,
      nv.pairOver.length > v.pairOver.length && `K2 sınırı aşan çift: ${v.pairOver.length} → ${nv.pairOver.length}`,
      nv.k3.length > v.k3.length && `K3 hedef sapması: ${v.k3.length} → ${nv.k3.length}`,
    ].filter(Boolean) as string[];
    const ok = await confirm({
      title: issues.length ? "Kuralı bozan takas yapılsın mı?" : "Defterler takas edilsin mi?",
      body: (<><p>{monthLabel(s.startMonth, t, s.year).ay}: <b>{name(a)}</b> ({owned[t][a].map((d) => nb(d)).join(", ") || "—"}) ⇄ <b>{name(b)}</b> ({owned[t][b].map((d) => nb(d)).join(", ") || "—"})</p>
        {issues.length ? <ul className="mt-1 list-inside list-disc text-[#C92830]">{issues.map((i) => <li key={i}>{i}</li>)}</ul> : <p className="mt-1 text-emerald-700">Zorunlu kurallar bozulmuyor.</p>}</>),
      confirmLabel: issues.length ? "İhlale rağmen takas et" : "Takas et", tone: issues.length ? "danger" : "primary",
    });
    setSel(null);
    if (!ok) return;
    s.setPlan(next);
    s.addLog(`Elle takas: ${t + 1}. ay ${name(a)} ⇄ ${name(b)}${issues.length ? ` (${issues.join("; ")})` : ""}`);
    useRot.setState((x) => ({ swaps: [...x.swaps, { month: t, a, b, ts: new Date().toISOString() }] }));
  };

  const replan = async () => {
    const ok = await confirm({
      title: "Plan yeniden kurulsun mu?",
      body: <>Zorunlu kural ihlali bulundu. Motor, K6 ve izinler dahil tüm zorunlu kurallarla yeni bir plan arayacak; mevcut plan ve <b>{s.swaps.length}</b> elle takas silinecek.</>,
      confirmLabel: "Yeniden planla", tone: "danger",
    });
    if (!ok) return;
    setBusy(true);
    const st = useRot.getState();
    const res = await generatePlans({ ...buildParams(st), seed: st.seed + 101 }, { timeMs: st.timeMs, want: 3 });
    st.setResult(res);
    st.addLog(res.candidates.length ? `İhlal nedeniyle yeniden planlandı (${res.candidates.length} aday)` : "Yeniden planlama: plan bulunamadı");
    setBusy(false);
  };

  const status = (ok: boolean, label: string, detail: string) => (
    <li className="flex items-start gap-2 text-[12.5px]"><Badge tone={ok ? "green" : "red"}>{ok ? "geçti" : "kaldı"}</Badge><span><b>{label}</b> — {detail}</span></li>
  );
  const hasLeave = ab.absent.some((r) => r.some(Boolean));

  return (
    <div>
      <ScreenTitle no={3} title="Plan İnceleme ve Doğrulama (R3)">
        <Button variant="primary" onClick={() => s.go(4)} data-testid="r3-next">Onaya geç <ArrowRight className="h-3.5 w-3.5" /></Button>
      </ScreenTitle>
      <div className="mb-3">
        <Collapsible title="Bu ekranda ne yapılır?">
          Plan tablosunda aynı ayda iki hücreye art arda tıklayarak iki kişinin defterlerini takas edebilirsiniz; takastan önce hangi kuralın bozulacağı gösterilir. <b>İ</b> = o ay izinli (defter verilmez), noktalı hücre = kısmi izin.
          Birden fazla defter &quot;3+7&quot; olarak gösterilir (ek atama). Sayım matrisinde her hücre hedefiyle karşılaştırılır; hedef esas dağıtım sayısı D&apos;den türetilir.
        </Collapsible>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {result.candidates.map((c, i) => (
          <Button key={i} size="sm" variant={i === picked ? "primary" : "secondary"} onClick={async () => { if (i === picked) return; if (await confirm({ title: `Aday ${i + 1} seçilsin mi?`, body: "Mevcut plan ve elle takaslarınız bu adayla değiştirilir.", confirmLabel: "Seç" })) s.pick(i); }}>
            Aday {i + 1} · en çok çift {c.maxPair} · puan {c.score} · tohum {c.seed}
          </Button>
        ))}
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-6">
        <Stat label="Zorunlu kurallar" value={v.ok ? "Geçti" : "Kaldı"} tone={v.ok ? "green" : "red"} />
        <Stat label="Dağıtım (gerçek / D)" value={`${v.actualD} / ${T.D}`} tone={v.actualD === T.D ? "green" : "amber"} />
        <Stat label="K1 ihlali" value={v.k1.length} tone={v.k1.length ? "red" : "green"} />
        <Stat label="K2 en çok çift" value={`${v.maxPair} / ${rules.pairLimit}`} tone={v.pairOver.length ? "red" : "green"} />
        <Stat label="K3 hedef sapması" value={v.k3.length} tone={v.k3.length ? "red" : "green"} />
        <Stat label="K6 peş peşe özel" value={v.k6.length} tone={v.k6.length ? "red" : "green"} />
      </div>
      {(v.k6.length > 0 || v.monthlyErrors.length > 0) && (
        <div className="mb-3" data-testid="k6-alert">
          <InfoCard tone="error" title={v.k6.length ? "Özel (haftalık) defterler peş peşe aynı çalışana gelmiş" : "Aylık düzen bozuk"}>
            <div className="mb-1.5">{v.k6.length ? v.k6.slice(0, 5).map((x) => `${name(x.person)}: ${x.months[0] + 1}. ay ${nb(x.notebooks[0])} → ${x.months[1] + 1}. ay ${nb(x.notebooks[1])}`).join(" · ") : v.monthlyErrors.slice(0, 3).join(" · ")}</div>
            <Button size="sm" variant="danger" disabled={busy} onClick={replan} data-testid="replan">{busy ? "Planlanıyor…" : "Yeniden planla"}</Button>
          </InfoCard>
        </div>
      )}

      <Card title="Plan (ay × personel; hücre = defter)" className="mb-3">
        <div className="overflow-auto">
          <table className="border-separate border-spacing-0 text-[12px]" data-testid="plan-table">
            <thead><tr><th className="sticky left-0 bg-white px-2 py-1 text-left">Ay</th>{people.map((p, i) => <th key={i} className="border-b border-slate-200 px-2 py-1" title={p.name}>{p.id}</th>)}</tr></thead>
            <tbody>
              {plan.map((_, t) => (
                <tr key={t}>
                  <td className="sticky left-0 whitespace-nowrap bg-white px-2 py-0.5 font-medium">{t + 1}. {monthLabel(s.startMonth, t, s.year).ay}{v.targets.k[t] < n && <span className="ml-1 text-[10px] text-amber-700">({v.targets.k[t]}/{n})</span>}</td>
                  {people.map((_, p) => {
                    const list = owned[t][p];
                    const away = ab.absent[t][p];
                    return (
                      <td key={p} onClick={() => click(t, p)} data-testid={`cell-${t}-${p}`}
                        title={away ? `${name(p)} · izinli (${ab.days[t][p]} gün)` : `${name(p)} · ${list.map(nb).join(", ")}${ab.partial[t][p] ? ` · kısmi izin ${ab.days[t][p]} gün` : ""}`}
                        style={away ? undefined : { background: list.length ? nbColor(list[0], n) : undefined }}
                        className={clsx("min-w-9 cursor-pointer border border-white px-2 py-0.5 text-center tabular-nums",
                          away && "bg-slate-200 font-semibold text-slate-500 [background-image:repeating-linear-gradient(45deg,transparent,transparent_3px,rgba(0,0,0,.08)_3px,rgba(0,0,0,.08)_6px)]",
                          (k1set.has(`${t}|${p}`) || k6set.has(`${t}|${p}`)) && "outline outline-2 -outline-offset-2 outline-[#C92830]",
                          sel?.t === t && sel.p === p && "ring-2 ring-[#1F2A44]")}>
                        {away ? "İ" : list.length ? list.map((d) => `${d + 1}${spSet.has(d) ? "★" : ""}`).join("+") : "—"}
                        {ab.partial[t][p] && <span className="text-amber-700">•</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {v.openCount > 0 && <div className="mt-1 text-[11.5px] text-slate-600">Açıkta kalan defter-ay: <b>{v.openCount}</b> (boş bırakma stratejisi)</div>}
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="Doğrulama raporu">
          <ul className="space-y-1.5">
            {status(v.monthlyOk, "Aylık düzen", v.monthlyOk ? (hasLeave ? "izinli kişilere defter yok, her müsait kişi en az 1 defter alıyor" : "her ay her defter bir kişide, her kişi 1 defter") : v.monthlyErrors.slice(0, 3).join("; "))}
            {status(v.actualD === T.D, "Esas dağıtım sayısı D", `gerçekleşen ${v.actualD}, hedef ${T.D}`)}
            {status(v.k1.length === 0, `K1 tekrar yasağı (G=${s.g})`, v.k1.length ? v.k1.slice(0, 4).map((x) => `${name(x.person)} / ${nb(x.notebook)} (${x.months[0] + 1}. ve ${x.months[1] + 1}. ay)`).join("; ") : "ihlal yok")}
            {(rules.special?.length ?? 0) > 0 && (rules.specialGap ?? 1) > 0 && status(v.k6.length === 0, `K6 haftalık özel defterler (${(rules.special ?? []).map((i) => notebooks[i]?.no).join(", ")})`, v.k6.length ? `${v.k6.length} peş peşe durum` : `peş peşe yok; kişi başına özel defter: ${v.specialCounts.join(", ")}`)}
            {status(v.pairOver.length === 0, `K2 takip yasağı (sınır ${rules.pairLimit})`, v.pairOver.length ? v.pairOver.slice(0, 4).map((x) => `${name(x.from)}→${name(x.to)} ${x.count}×`).join("; ") : `en çok tekrar ${v.maxPair}`)}
            {status(v.k3.length === 0, "K3 eşitlik (D tabanlı hedef)", v.k3.length ? v.k3.slice(0, 4).map((x) => `${name(x.person)}/${nb(x.notebook)}=${x.count} (hedef ${r1(T.e[x.person][x.notebook])})`).join("; ") : "tüm kişi–defter sayıları hedef aralığında")}
            {s.useGroups && status(v.k5.length === 0, "K5 grup dengesi (tercih)", v.k5.length ? `${v.k5.length} çeyrekte aynı gruptan tekrar` : "ihlal yok")}
            {v.forbiddenHits.length > 0 && status(false, "Yasak çift", `${v.forbiddenHits.length} ihlal`)}
          </ul>
          {result.relaxed.length > 0 && <div className="mt-2"><InfoCard tone="warn" title="Gevşetilen kurallar">{result.relaxed.join("; ")}</InfoCard></div>}
        </Card>
        <Card title="Kişi bazlı hedef ve gerçekleşen (D tabanlı)">
          <div className="max-h-56 overflow-auto">
            <table className="w-full text-[12px]" data-testid="person-targets">
              <thead className="text-left text-slate-500"><tr><th>Kişi</th><th className="text-right">Müsait ay</th><th className="text-right">Hedef</th><th className="text-right">Gerçek</th><th className="text-right">Sapma</th></tr></thead>
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
      <Card title="Kişi × defter sayım matrisi (K3) — hücre: gerçekleşen, ipucu: hedef" className="mt-3">
        <Matrix data={v.counts} rowLab={people.map((p) => p.id)} max={maxCount} n={n} bounds={{ lo: T.lo, hi: T.hi, e: T.e }} />
      </Card>
      <Card title="Devir matrisi (A→B: defter A'dan B'ye geçiş sayısı, K2)" className="mt-3">
        <Matrix data={v.pairCounts} rowLab={people.map((p) => p.id)} max={maxPair} n={n} limit={rules.pairLimit} />
      </Card>

      <div className="mt-3 flex items-center justify-between">
        <Button onClick={() => s.go(2)}>← Plan üretimi</Button>
        <Button variant="primary" onClick={() => s.go(4)}>Onaya geç <ArrowRight className="h-3.5 w-3.5" /></Button>
      </div>
    </div>
  );
}

function Matrix({ data, rowLab, max, n, limit, bounds }: { data: number[][]; rowLab: string[]; max: number; n: number; limit?: number; bounds?: { lo: number[][]; hi: number[][]; e: number[][] } }) {
  return (
    <div className="overflow-auto">
      <table className="border-separate border-spacing-px text-[11px]">
        <thead><tr><th />{Array.from({ length: n }, (_, i) => <th key={i} className="px-1 font-normal text-slate-500">{i + 1}</th>)}</tr></thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}><th className="pr-1 text-right font-normal text-slate-500">{rowLab[i]}</th>
              {row.map((c, j) => {
                const bad = (limit !== undefined && c > limit) || (bounds && (c < bounds.lo[i][j] || c > bounds.hi[i][j]));
                return <td key={j} title={bounds ? `hedef ${Math.round(bounds.e[i][j] * 100) / 100}` : undefined} style={heat(c, max)} className={clsx("h-5 min-w-5 text-center tabular-nums", bad && "outline outline-2 outline-[#C92830]")}>{c || ""}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
