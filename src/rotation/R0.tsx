"use client";
import { ArrowRight } from "lucide-react";
import { useConfirm } from "@/components/confirm";
import { Button, Card, Collapsible, InfoCard, ScreenTitle, Stat, inputCls } from "@/components/ui";
import { useT } from "@/i18n";
import { calcMath } from "./math";
import { useRot } from "./store";

export default function R0() {
  const confirm = useConfirm();
  const { t, rt } = useT();
  const { n, setN, g, m, go, addLog } = useRot();
  const x = calcMath(n, m, g);

  const next = async () => {
    const ok = await confirm({
      title: t("v2core.r0.confirm.title"),
      body: rt("v2core.r0.confirm.body", { n, k: x.lo === x.hi ? `${x.lo}` : `${x.lo}–${x.hi}` }),
      confirmLabel: t("v2core.r0.confirm.ok"),
    });
    if (!ok) return;
    addLog(t("v2core.r0.log", { n }));
    go(1);
  };

  return (
    <div className="mx-auto max-w-4xl">
      <ScreenTitle no={0} title={t("v2core.r0.title")} />
      <div className="mb-3 space-y-2">
        <Collapsible title={t("v2core.r0.what.title")} defaultOpen>
          {t("v2core.r0.what.body")}
        </Collapsible>
      </div>
      <Card title={t("v2core.r0.card")}>
        <div className="flex items-end gap-3">
          <label className="block w-40 text-[12.5px]">
            <span className="mb-0.5 block font-medium text-slate-700">{t("v2core.r0.n.label")}</span>
            <input type="number" min={2} max={60} value={n} onChange={(e) => setN(Math.max(2, Math.min(60, Math.floor(Number(e.target.value) || 2))))} className={inputCls} aria-label={t("v2core.r0.n.label")} data-testid="n-input" />
          </label>
          <span className="pb-1.5 text-xs text-slate-500">{t("v2core.r0.n.hint")}</span>
        </div>
      </Card>

      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4" data-testid="feas-card">
        <Stat label={t("v2core.r0.stat.nb")} value={n} sub={t("v2core.r0.stat.nb.sub")} />
        <Stat label={t("v2core.r0.stat.pp")} value={x.lo === x.hi ? `${x.lo}` : `${x.lo}–${x.hi}`} sub={t("v2core.r0.stat.pp.sub")} />
        <Stat label={t("v2core.r0.stat.extra")} value={x.r} sub={t("v2core.r0.stat.extra.sub", { a: x.perPersonLo, lo: x.lo, b: x.perPersonHi, hi: x.hi })} />
        <Stat label={t("v2core.r0.stat.pair")} value={x.pairLower} sub={t("v2core.r0.stat.pair.sub", { n: x.orderedPairs })} />
      </div>
      <Card title={t("v2core.r0.feas.title")} className="mt-3">
        <div className="mb-2 text-[12.5px] text-slate-700">
          {rt("v2core.r0.feas.line", { t: x.totalTransfers, lo: x.lo, hi: x.hi })}
        </div>
        <div className="space-y-1.5">
          {x.warnings.map((w) => (
            <InfoCard key={w.text} tone={w.tone}>{w.text}</InfoCard>
          ))}
          {x.warnings.length === 0 && <InfoCard tone="ok">{t("v2core.r0.feas.none")}</InfoCard>}
        </div>
      </Card>
      <div className="mt-3 flex justify-end">
        <Button variant="primary" disabled={!x.feasible} onClick={next} data-testid="r0-next">
          {t("v2core.r0.next")} <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
