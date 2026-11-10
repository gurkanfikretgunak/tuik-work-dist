"use client";
import clsx from "clsx";
import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { ConfirmProvider } from "./confirm";
import Screen0 from "@/screens/Screen0";
import Screen1 from "@/screens/Screen1";
import Screen2 from "@/screens/Screen2";
import Screen3 from "@/screens/Screen3";
import Screen4 from "@/screens/Screen4";
import Screen5 from "@/screens/Screen5";
import Screen6 from "@/screens/Screen6";
import Screen7 from "@/screens/Screen7";
import Screen8 from "@/screens/Screen8";

export const STEPS = [
  "Karşılama",
  "Personel ve Kapasite",
  "Kural Seçimi",
  "İş Yükleme",
  "Dağıtım",
  "Ön Onay",
  "Onay ve Çıktı",
  "Süreç Raporu",
  "Genel Özet ve Paylaşım",
];

const SCREENS = [Screen0, Screen1, Screen2, Screen3, Screen4, Screen5, Screen6, Screen7, Screen8];

export function App() {
  const step = useStore((s) => s.step);
  const maxStep = useStore((s) => s.maxStep);
  const go = useStore((s) => s.go);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const Screen = SCREENS[step];

  return (
    <ConfirmProvider>
      <div className="no-print border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1400px] items-center gap-4 px-4 py-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/tuik-logo.svg" alt="TÜİK" className="h-8 w-auto" />
          <div className="border-l border-slate-300 pl-4">
            <div className="text-[13px] font-semibold text-[#1F2A44]">İş Dağıtım Aracı</div>
            <div className="text-[11px] text-slate-500">Veriler yalnızca tarayıcıda işlenir; sunucuya gönderilmez.</div>
          </div>
        </div>
        <nav aria-label="Adımlar" className="mx-auto flex max-w-[1400px] gap-0.5 overflow-x-auto px-4 pb-0">
          {STEPS.map((s, i) => {
            const reachable = i <= maxStep;
            const done = i < maxStep;
            return (
              <button
                key={s}
                disabled={!reachable}
                onClick={() => go(i)}
                aria-current={i === step ? "step" : undefined}
                data-testid={`step-${i}`}
                className={clsx(
                  "flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium",
                  i === step ? "border-[#C92830] text-[#1F2A44]" : "border-transparent",
                  reachable && i !== step && "text-slate-600 hover:bg-slate-50",
                  !reachable && "cursor-not-allowed text-slate-300",
                )}
              >
                <span
                  className={clsx(
                    "flex h-4 w-4 items-center justify-center rounded-full text-[10px]",
                    done ? "bg-emerald-600 text-white" : i === step ? "bg-[#1F2A44] text-white" : "bg-slate-200 text-slate-500",
                  )}
                >
                  {done ? <Check className="h-3 w-3" /> : i}
                </span>
                {s}
              </button>
            );
          })}
        </nav>
      </div>
      <main className="mx-auto max-w-[1400px] px-4 py-4">{mounted ? <Screen /> : null}</main>
    </ConfirmProvider>
  );
}
