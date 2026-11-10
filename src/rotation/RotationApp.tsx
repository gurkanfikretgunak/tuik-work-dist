"use client";
import clsx from "clsx";
import { Check } from "lucide-react";
import { useT } from "@/i18n";
import { useRot } from "./store";
import R0 from "./R0";
import R1 from "./R1";
import R2 from "./R2";
import R3 from "./R3";
import R4 from "./R4";

const SCREENS = [R0, R1, R2, R3, R4];

export default function RotationApp() {
  const { step, maxStep, go } = useRot();
  const { t } = useT();
  const STEPS = [t("v2ui.step.0"), t("v2ui.step.1"), t("v2ui.step.2"), t("v2ui.step.3"), t("v2ui.step.4")];
  const Screen = SCREENS[step];
  return (
    <div>
      <nav aria-label={t("v2ui.nav.aria")} className="no-print -mt-4 mb-4 flex gap-0.5 overflow-x-auto border-b border-slate-200">
        {STEPS.map((s, i) => (
          <button
            key={s}
            disabled={i > maxStep}
            onClick={() => go(i)}
            data-testid={`rstep-${i}`}
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
