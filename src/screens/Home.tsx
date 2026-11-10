"use client";
import { ArrowRight, BookOpen, Shuffle } from "lucide-react";
import { useConfirm } from "@/components/confirm";
import { Badge, Button, Collapsible, InfoCard } from "@/components/ui";
import { useApp } from "@/lib/appstore";
import { useT } from "@/i18n";

export default function Home() {
  const confirm = useConfirm();
  const { t, rt } = useT();
  const setEngine = useApp((s) => s.setEngine);

  const pick = async (e: "v1" | "v2") => {
    const ok = await confirm({
      title: e === "v1" ? t("home.v1.confirm.title") : t("home.v2.confirm.title"),
      body: e === "v1" ? t("home.v1.confirm.body") : t("home.v2.confirm.body"),
      confirmLabel: t("home.confirm.open"),
    });
    if (ok) setEngine(e);
  };

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-3">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-[#C92830]">{t("home.kicker")}</div>
        <h1 className="text-lg font-semibold text-[#1F2A44]">{t("home.title")}</h1>
        <p className="text-[13px] text-slate-600">{t("home.lead")}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <section className="flex flex-col rounded-md border border-slate-200 bg-white" data-testid="engine-v1">
          <header className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
            <div className="flex items-center gap-2 font-semibold text-[#1F2A44]"><Shuffle className="h-4 w-4" /> {t("home.v1.title")}</div>
            <Badge tone="blue">v1</Badge>
          </header>
          <div className="flex-1 space-y-2 p-4 text-[13px] text-slate-700">
            <p>{t("home.v1.desc")}</p>
            <Collapsible title={t("home.v1.flow.title")}>{t("home.v1.flow")}</Collapsible>
          </div>
          <div className="border-t border-slate-200 p-3"><Button variant="primary" onClick={() => pick("v1")} data-testid="pick-v1">{t("home.v1.start")} <ArrowRight className="h-3.5 w-3.5" /></Button></div>
        </section>

        <section className="flex flex-col rounded-md border border-slate-200 bg-white" data-testid="engine-v2">
          <header className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
            <div className="flex items-center gap-2 font-semibold text-[#1F2A44]"><BookOpen className="h-4 w-4" /> {t("home.v2.title")}</div>
            <div className="flex gap-1"><Badge tone="red">{t("home.v2.new")}</Badge><Badge tone="blue">v2</Badge></div>
          </header>
          <div className="flex-1 space-y-2 p-4 text-[13px] text-slate-700">
            <p>{t("home.v2.desc")}</p>
            <Collapsible title={t("home.v2.rules.title")}>
              <ul className="list-inside list-disc space-y-0.5">
                <li>{rt("home.v2.rule1")}</li>
                <li>{t("home.v2.rule2")}</li>
              </ul>
            </Collapsible>
          </div>
          <div className="border-t border-slate-200 p-3"><Button variant="primary" onClick={() => pick("v2")} data-testid="pick-v2">{t("home.v2.start")} <ArrowRight className="h-3.5 w-3.5" /></Button></div>
        </section>
      </div>
      <div className="mt-3"><InfoCard>{rt("home.info", { code: <code>defter_no</code> })}</InfoCard></div>
    </div>
  );
}
