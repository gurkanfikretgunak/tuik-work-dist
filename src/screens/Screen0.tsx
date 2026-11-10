"use client";
import { ArrowRight, FolderOpen } from "lucide-react";
import { useState } from "react";
import { useConfirm } from "@/components/confirm";
import { Button, Card, Collapsible, InfoCard, ScreenTitle } from "@/components/ui";
import { fmtDateTime, useT } from "@/i18n";
import { readSet, useStore } from "@/lib/store";

export default function Screen0() {
  const confirm = useConfirm();
  const { t, rt } = useT();
  const { go, reset, loadSaved, log, employees, events } = useStore();
  const [saved] = useState(() => readSet());

  const start = async () => {
    const hasWork = employees.length > 0 || events.length > 0;
    const ok = await confirm({
      title: t("v1ui.s0.start.title"),
      body: hasWork ? t("v1ui.s0.start.bodyWork") : t("v1ui.s0.start.bodyEmpty"),
      confirmLabel: t("v1ui.s0.start.confirm"),
      tone: hasWork ? "danger" : "primary",
    });
    if (!ok) return;
    reset();
    go(1);
  };

  const load = async () => {
    if (!saved) return;
    const ok = await confirm({
      title: t("v1ui.s0.load.title"),
      body: rt("v1ui.s0.load.body", { date: fmtDateTime(saved.savedAt), n: saved.employees.length }),
      confirmLabel: t("v1ui.s0.load.confirm"),
    });
    if (!ok) return;
    loadSaved(saved);
    log("oturum", t("v1ui.s0.load.log"), { personel: saved.employees.length });
    go(1);
  };

  const link = (href: string, name: string) => (
    <a className="text-sky-700 underline" href={href} download>
      {name}
    </a>
  );

  return (
    <div className="mx-auto max-w-4xl">
      <ScreenTitle no={0} title={t("step.v1.0")} />
      <Card>
        <p className="text-[13.5px] leading-relaxed text-slate-800">{t("v1ui.s0.intro")}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="primary" onClick={start} data-testid="start-new">
            {t("v1ui.s0.startBtn")} <ArrowRight className="h-3.5 w-3.5" />
          </Button>
          <Button onClick={load} disabled={!saved} data-testid="load-saved">
            <FolderOpen className="h-3.5 w-3.5" /> {t("v1ui.s0.loadBtn")}
          </Button>
          {!saved && <span className="self-center text-xs text-slate-500">{t("v1ui.s0.noSaved")}</span>}
        </div>
      </Card>

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <InfoCard title={t("v1ui.s0.c1.title")}>{t("v1ui.s0.c1.body")}</InfoCard>
        <InfoCard title={t("v1ui.s0.c2.title")}>{t("v1ui.s0.c2.body")}</InfoCard>
        <InfoCard title={t("v1ui.s0.c3.title")} tone="ok">{t("v1ui.s0.c3.body")}</InfoCard>
      </div>

      <div className="mt-3 space-y-2">
        <Collapsible title={t("v1ui.s0.flow.title")} defaultOpen>
          <ol className="list-inside list-decimal space-y-0.5">
            <li>{t("v1ui.s0.flow.1")}</li>
            <li>{t("v1ui.s0.flow.2")}</li>
            <li>{t("v1ui.s0.flow.3")}</li>
            <li>{t("v1ui.s0.flow.4")}</li>
            <li>{t("v1ui.s0.flow.5")}</li>
            <li>{t("v1ui.s0.flow.6")}</li>
            <li>{t("v1ui.s0.flow.7")}</li>
            <li>{t("v1ui.s0.flow.8")}</li>
          </ol>
        </Collapsible>
        <Collapsible title={t("v1ui.s0.files.title")}>
          <p>{rt("v1ui.s0.files.p1")}</p>
          <p className="mt-1">{rt("v1ui.s0.files.p2", { emp: link("/ornek/calisanlar.csv", "calisanlar.csv"), jobs: link("/ornek/isler.csv", "isler.csv") })}</p>
        </Collapsible>
        <Collapsible title={t("v1ui.s0.kvkk.title")}>{t("v1ui.s0.kvkk.body")}</Collapsible>
      </div>
    </div>
  );
}
