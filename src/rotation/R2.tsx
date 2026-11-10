"use client";
import { ArrowRight, Play, Square } from "lucide-react";
import { useRef, useState } from "react";
import { useConfirm } from "@/components/confirm";
import { useT } from "@/i18n";
import { Button, Card, Collapsible, InfoCard, ScreenTitle, Stat } from "@/components/ui";
import { generatePlans } from "./engine";
import { buildParams, pairLimitOf } from "./params";
import { useRot } from "./store";

export default function R2() {
  const confirm = useConfirm();
  const { t, rt } = useT();
  const s = useRot();
  const [busy, setBusy] = useState(false);
  const [p, setP] = useState(0);
  const [found, setFound] = useState(0);
  const sig = useRef({ cancelled: false });
  const r = s.result;

  const run = async () => {
    const ok = await confirm({
      title: r ? t("v2ui.r2.confirm.title.re") : t("v2ui.r2.confirm.title.new"),
      body: <>{rt("v2ui.r2.confirm.body", { s: s.timeMs / 1000 })}{r && t("v2ui.r2.confirm.reset")}</>,
      confirmLabel: r ? t("v2ui.r2.confirm.ok.re") : t("v2ui.r2.confirm.ok.new"),
      tone: r ? "danger" : "primary",
    });
    if (!ok) return;
    sig.current = { cancelled: false };
    setBusy(true);
    setP(0);
    const t0 = Date.now();
    const res = await generatePlans(buildParams(useRot.getState()), { timeMs: s.timeMs, want: 3, onProgress: (x, f) => { setP(x); setFound(f); }, signal: sig.current });
    s.setResult(res);
    s.addLog(res.candidates.length ? t("v2ui.r2.log.found", { c: res.candidates.length, p: res.usedPairLimit, r: res.relaxed.length ? t("v2ui.r2.log.relaxed") : "", a: res.attempts, ms: Date.now() - t0 }) : t("v2ui.r2.log.none", { a: res.attempts }));
    setBusy(false);
  };

  return (
    <div>
      <ScreenTitle no={2} title={t("v2ui.r2.title")} />
      <div className="mb-3">
        <Collapsible title={t("v2ui.r2.how.title")}>
          {t("v2ui.r2.how.body")}
        </Collapsible>
      </div>
      <Card title={t("v2ui.r2.run.title")}>
        {busy ? (
          <div>
            <div className="mb-1 text-[12.5px]">{rt("v2ui.r2.searching", { n: found })}</div>
            <div className="h-2.5 w-full rounded bg-slate-200"><div className="h-2.5 rounded bg-[#1F2A44] transition-all" style={{ width: `${p * 100}%` }} /></div>
            <Button className="mt-2" size="sm" onClick={() => (sig.current.cancelled = true)}><Square className="h-3 w-3" /> {t("v2ui.r2.cancel")}</Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button variant="primary" onClick={run} data-testid="r2-run"><Play className="h-3.5 w-3.5" /> {r ? t("v2ui.r2.run.re") : t("v2ui.r2.run.new")}</Button>
            <span className="text-xs text-slate-500">{t("v2ui.r2.params", { n: s.n, m: s.m, g: s.g, p: pairLimitOf(s) })}</span>
          </div>
        )}
        {r && !busy && (
          <div className="mt-3 space-y-2" data-testid="r2-result">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Stat label={t("v2ui.r2.stat.cand")} value={r.candidates.length} tone={r.candidates.length ? "green" : "red"} />
              <Stat label={t("v2ui.r2.stat.attempts")} value={r.attempts} />
              <Stat label={t("v2ui.r2.stat.used")} value={r.candidates.length ? r.usedPairLimit : "—"} sub={t("v2ui.r2.stat.wanted", { p: pairLimitOf(s) })} />
              <Stat label={t("v2ui.r2.stat.best")} value={r.candidates[0]?.maxPair ?? "—"} />
            </div>
            {r.relaxed.map((x) => <InfoCard key={x} tone="warn" title={t("v2ui.r2.relaxed")}>{x}</InfoCard>)}
            {r.error && <InfoCard tone="error" title={t("v2ui.r2.notfound")}>{r.error}</InfoCard>}
            {r.candidates.length > 0 && !r.relaxed.length && <InfoCard tone="ok">{t("v2ui.r2.allok")}</InfoCard>}
          </div>
        )}
      </Card>
      <div className="mt-3 flex items-center justify-between">
        <Button onClick={() => s.go(1)}>{t("v2ui.r2.back")}</Button>
        <Button variant="primary" disabled={!r?.candidates.length || busy} onClick={() => s.go(3)} data-testid="r2-next">{t("v2ui.r2.next")} <ArrowRight className="h-3.5 w-3.5" /></Button>
      </div>
    </div>
  );
}
