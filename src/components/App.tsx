"use client";
import clsx from "clsx";
import { Check } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import { initLang, LANGS, LANG_META, useLangStore, useT, type Lang } from "@/i18n";
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
import Home from "@/screens/Home";
import RotationApp from "@/rotation/RotationApp";
import OpenDataApp from "@/opendata/OpenDataApp";
import { useApp } from "@/lib/appstore";
import { useConfirm } from "./confirm";

export const STEP_KEYS = Array.from({ length: 9 }, (_, i) => `step.v1.${i}`);

const SCREENS = [Screen0, Screen1, Screen2, Screen3, Screen4, Screen5, Screen6, Screen7, Screen8];

function Inner() {
  const engine = useApp((a) => a.engine);
  const setEngine = useApp((a) => a.setEngine);
  const confirm = useConfirm();
  const { t, lang } = useT();
  const setLang = useLangStore((x) => x.setLang);
  useEffect(() => { initLang(); }, []);
  useEffect(() => { document.title = t("app.title"); }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps
  const step = useStore((s) => s.step);
  const maxStep = useStore((s) => s.maxStep);
  const go = useStore((s) => s.go);
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const Screen = SCREENS[step];

  return (
    <>
      <div className="no-print border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1400px] items-center gap-4 px-4 py-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/tuik-logo.svg" alt="TÜİK" className="h-8 w-auto" />
          <div className="border-l border-slate-300 pl-4">
            <div className="text-[13px] font-semibold text-[#1F2A44]">{engine === "v3" ? t("app.v3") : engine === "v2" ? t("app.v2") : engine === "v1" ? t("app.v1") : t("app.tools")}</div>
            <div className="text-[11px] text-slate-500">{t("app.privacy")}</div>
          </div>
          {engine === "home" && <span className="ml-auto" />}
          {engine !== "home" && (
            <button
              data-testid="to-home"
              onClick={async () => {
                const ok = await confirm({ title: t("app.toHome.title"), body: t("app.toHome.body"), confirmLabel: t("app.toHome.confirm") });
                if (ok) setEngine("home");
              }}
              className="ml-auto rounded border border-slate-300 px-2.5 py-1 text-xs font-medium hover:bg-slate-50"
            >
              {t("app.toHome")}
            </button>
          )}
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="sr-only sm:not-sr-only">{t("app.lang")}</span>
            <select data-testid="lang-select" aria-label={t("app.lang")} value={lang} onChange={(e) => setLang(e.target.value as Lang)} className="h-7 rounded border border-slate-300 bg-white px-1.5 text-xs">
              {LANGS.map((l) => <option key={l} value={l}>{LANG_META[l].name}</option>)}
            </select>
          </label>
        </div>
        {engine === "v1" && (
        <nav aria-label={t("app.steps")} className="mx-auto flex max-w-[1400px] gap-0.5 overflow-x-auto px-4 pb-0">
          {STEP_KEYS.map((key, i) => {
            const reachable = i <= maxStep;
            const done = i < maxStep;
            return (
              <button
                key={key}
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
                {t(key)}
              </button>
            );
          })}
        </nav>
        )}
      </div>
      <main className="mx-auto max-w-[1400px] px-4 py-4">
        {mounted ? engine === "home" ? <Home /> : engine === "v1" ? <Screen /> : engine === "v2" ? <RotationApp /> : <OpenDataApp /> : null}
      </main>
    </>
  );
}

export function App() {
  return (
    <ConfirmProvider>
      <Inner />
    </ConfirmProvider>
  );
}
