"use client";
import { ArrowRight, Play, Square } from "lucide-react";
import { useRef, useState } from "react";
import { useConfirm } from "@/components/confirm";
import { Button, Card, Collapsible, InfoCard, ScreenTitle, Stat } from "@/components/ui";
import { useT } from "@/i18n";
import { calcMath } from "../rotation/math";
import { generate2 } from "./engine";
import { layoutError } from "./model";
import { cfgOf, useRot2 } from "./store";
import { regionStats } from "./validator";

export default function G() {
  const confirm = useConfirm();
  const { t, rt } = useT();
  const s = useRot2();
  const [busy, setBusy] = useState(false);
  const [p, setP] = useState(0);
  const sig = useRef({ cancelled: false });
  const r = s.result;
  const invalid = layoutError(s.n, s.regions);

  const run = async () => {
    const ok = await confirm({
      title: r ? t("v2ui.r2.confirm.title.re") : t("v2ui.r2.confirm.title.new"),
      body: <>{rt("v2ui.r2.confirm.body", { s: s.timeMs / 1000 })}{r && t("v2ui.r2.confirm.reset")}</>,
      confirmLabel: r ? t("v2ui.r2.confirm.ok.re") : t("v2ui.r2.confirm.ok.new"),
      tone: r ? "danger" : "primary",
    });
    if (!ok) return;
    sig.current = { cancelled: false };
    setBusy(true); setP(0);
    const t0 = Date.now();
    const cfg = cfgOf(useRot2.getState());
    const res = await generate2(cfg, { timeMs: s.timeMs, signal: sig.current, onProgress: (x) => setP(x) });
    s.setResult(res);
    s.addLog(res.inside.candidates.length && res.outside.candidates.length
      ? t("v4.g.log.found", { a: res.inside.candidates.length, b: res.outside.candidates.length, ms: Date.now() - t0 })
      : t("v4.g.log.none"));
    setBusy(false);
  };

  const both = !!r && r.inside.candidates.length > 0 && r.outside.candidates.length > 0;
  const best = r?.outside.candidates[0] ? regionStats(r.outside.candidates[0].plan, s.outside, s.regions, s.n).maxDev : null;
  const relaxed = r ? [...r.inside.relaxed, ...r.outside.relaxed] : [];

  return (
    <div>
      <ScreenTitle no={1} title={t("v4.g.title")} />
      <div className="mb-3"><Collapsible title={t("v4.g.how.title")}>{t("v4.g.how.body")}</Collapsible></div>
      <Card title={t("v2ui.r2.run.title")}>
        {busy ? (
          <div>
            <div className="mb-1 text-[12.5px]">{t("v4.g.searching")}</div>
            <div className="h-2.5 w-full rounded bg-slate-200"><div className="h-2.5 rounded bg-[#1F2A44] transition-all" style={{ width: `${p * 100}%` }} /></div>
            <Button className="mt-2" size="sm" onClick={() => (sig.current.cancelled = true)}><Square className="h-3 w-3" /> {t("v2ui.r2.cancel")}</Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" disabled={!!invalid} onClick={run} data-testid="v4-run"><Play className="h-3.5 w-3.5" /> {r ? t("v2ui.r2.run.re") : t("v2ui.r2.run.new")}</Button>
            <span className="text-xs text-slate-500">{t("v4.g.params", { n: s.n, m: s.m, g: s.g, p: calcMath(s.n, s.m, s.g).pairLower })}</span>
            {invalid && <span className="text-xs text-[#C92830]">{t("v4.p.regions.bad", { n: s.n })}</span>}
          </div>
        )}
        {r && !busy && (
          <div className="mt-3 space-y-2" data-testid="v4-result">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Stat label={`${t("v4.tier.inside")} · ${t("v4.g.cand")}`} value={r.inside.candidates.length} tone={r.inside.candidates.length ? "green" : "red"} />
              <Stat label={`${t("v4.tier.outside")} · ${t("v4.g.cand")}`} value={r.outside.candidates.length} tone={r.outside.candidates.length ? "green" : "red"} />
              <Stat label={t("v4.g.used")} value={both ? `${r.inside.usedPairLimit} / ${r.outside.usedPairLimit}` : "—"} sub={t("v4.g.used.sub")} />
              <Stat label={t("v4.g.regionBest")} value={best === null ? "—" : best.toFixed(2)} />
            </div>
            {relaxed.map((x) => <InfoCard key={x} tone="warn" title={t("v2ui.r2.relaxed")}>{x}</InfoCard>)}
            {r.inside.error && <InfoCard tone="error" title={`${t("v4.tier.inside")} · ${t("v2ui.r2.notfound")}`}>{r.inside.error}</InfoCard>}
            {r.outside.error && <InfoCard tone="error" title={`${t("v4.tier.outside")} · ${t("v2ui.r2.notfound")}`}>{r.outside.error}</InfoCard>}
            {both && !relaxed.length && <InfoCard tone="ok">{t("v2ui.r2.allok")}</InfoCard>}
          </div>
        )}
      </Card>
      <div className="mt-3 flex items-center justify-between">
        <Button onClick={() => s.go(0)}>{t("v2ui.r2.back")}</Button>
        <Button variant="primary" disabled={!both || busy} onClick={() => s.go(2)} data-testid="v4-next1">{t("v2ui.r2.next")} <ArrowRight className="h-3.5 w-3.5" /></Button>
      </div>
    </div>
  );
}
