"use client";
import clsx from "clsx";
import { Check } from "lucide-react";
import { useT } from "@/i18n";
import D0 from "./D0";
import D1 from "./D1";
import { useOpen } from "./store";

const SCREENS = [D0, D1];

export default function OpenDataApp() {
  const { t } = useT();
  const { step, maxStep, go } = useOpen();
  const Screen = SCREENS[step];
  return (
    <div>
      <nav aria-label={t("app.steps")} className="no-print -mt-4 mb-4 flex gap-0.5 overflow-x-auto border-b border-slate-200">
        {[0, 1].map((i) => (
          <button key={i} disabled={i > maxStep} onClick={() => go(i)} data-testid={`dstep-${i}`} aria-current={i === step ? "step" : undefined}
            className={clsx("flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium", i === step ? "border-[#C92830] text-[#1F2A44]" : "border-transparent", i <= maxStep && i !== step && "text-slate-600 hover:bg-slate-50", i > maxStep && "cursor-not-allowed text-slate-300")}>
            <span className={clsx("flex h-4 w-4 items-center justify-center rounded-full text-[10px]", i < maxStep ? "bg-emerald-600 text-white" : i === step ? "bg-[#1F2A44] text-white" : "bg-slate-200 text-slate-500")}>
              {i < maxStep ? <Check className="h-3 w-3" /> : i}
            </span>
            {t(`v3.step.${i}`)}
          </button>
        ))}
      </nav>
      <Screen />
    </div>
  );
}
