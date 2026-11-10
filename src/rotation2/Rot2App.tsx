"use client";
import clsx from "clsx";
import { Check } from "lucide-react";
import { useT } from "@/i18n";
import G from "./G";
import O from "./O";
import P from "./P";
import { useRot2 } from "./store";
import V from "./V";

const SCREENS = [P, G, V, O];

export default function Rot2App() {
  const { step, maxStep, go } = useRot2();
  const { t } = useT();
  const STEPS = [t("v4.step.0"), t("v4.step.1"), t("v4.step.2"), t("v4.step.3")];
  const Screen = SCREENS[step];
  return (
    <div>
      <nav aria-label={t("v4.nav.aria")} className="no-print -mt-4 mb-4 flex gap-0.5 overflow-x-auto border-b border-slate-200">
        {STEPS.map((s, i) => (
          <button
            key={i}
            disabled={i > maxStep}
            onClick={() => go(i)}
            data-testid={`v4step-${i}`}
            aria-current={i === step ? "step" : undefined}
            className={clsx(
              "flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium",
              i === step ? "border-[#C92830] text-[#1F2A44]" : "border-transparent",
              i <= maxStep && i !== step && "text-slate-600 hover:bg-slate-50",
              i > maxStep && "cursor-not-allowed text-slate-300",
            )}
          >
            <span className={clsx("flex h-4 w-4 items-center justify-center rounded-full text-[10px]", i < maxStep ? "bg-emerald-600 text-white" : i === step ? "bg-[#1F2A44] text-white" : "bg-slate-200 text-slate-500")}>
              {i < maxStep ? <Check className="h-3 w-3" /> : i}
            </span>
            {s}
          </button>
        ))}
      </nav>
      <Screen />
    </div>
  );
}
