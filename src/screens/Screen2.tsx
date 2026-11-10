"use client";
import clsx from "clsx";
import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";
import { useConfirm } from "@/components/confirm";
import { useT } from "@/i18n";
import { Badge, Button, Card, Collapsible, Field, InfoCard, ScreenTitle, inputCls } from "@/components/ui";
import { useStore } from "@/lib/store";
import { DEFAULT_RULESET, RULE_META, type RuleSet } from "@/lib/types";

const TEMPLATES: { nameKey: string; descKey: string; make: () => RuleSet }[] = [
  { nameKey: "v1ui.s2.tpl.balanced.name", descKey: "v1ui.s2.tpl.balanced.desc", make: () => structuredClone(DEFAULT_RULESET) },
  {
    nameKey: "v1ui.s2.tpl.cont.name",
    descKey: "v1ui.s2.tpl.cont.desc",
    make: () => ({
      ...structuredClone(DEFAULT_RULESET),
      gecenAyYon: "sureklilik",
      rules: [
        { id: "il", enabled: true, mandatory: true },
        { id: "kir", enabled: true, mandatory: true },
        { id: "gecenAy", enabled: true, mandatory: false },
        { id: "mahalle", enabled: true, mandatory: false },
        { id: "denge", enabled: true, mandatory: false },
      ],
    }),
  },
  {
    nameKey: "v1ui.s2.tpl.rot.name",
    descKey: "v1ui.s2.tpl.rot.desc",
    make: () => ({
      ...structuredClone(DEFAULT_RULESET),
      gecenAyYon: "rotasyon",
      rules: [
        { id: "il", enabled: true, mandatory: true },
        { id: "kir", enabled: true, mandatory: true },
        { id: "gecenAy", enabled: true, mandatory: true },
        { id: "mahalle", enabled: true, mandatory: false },
        { id: "denge", enabled: true, mandatory: false },
      ],
    }),
  },
  {
    nameKey: "v1ui.s2.tpl.empty.name",
    descKey: "v1ui.s2.tpl.empty.desc",
    make: () => ({ ...structuredClone(DEFAULT_RULESET), rules: DEFAULT_RULESET.rules.map((r) => ({ ...r, enabled: false, mandatory: false })) }),
  },
];

export default function Screen2() {
  const confirm = useConfirm();
  const { t, rt } = useT();
  const { rules, setRules, rulesConfirmed, setRulesConfirmed, go, log } = useStore();
  const upd = (p: Partial<RuleSet>) => setRules({ ...rules, ...p });

  const move = (i: number, d: -1 | 1) => {
    const a = [...rules.rules];
    const j = i + d;
    if (j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]];
    upd({ rules: a });
  };
  const patchRule = (i: number, p: Partial<RuleSet["rules"][number]>) => upd({ rules: rules.rules.map((r, k) => (k === i ? { ...r, ...p } : r)) });

  const errors: string[] = [];
  const warns: string[] = [];
  if (!rules.rules.some((r) => r.enabled)) errors.push(t("v1ui.s2.err.none"));
  if (rules.kapasiteModu === "sert" && rules.kapasiteAsimi === "uyari")
    errors.push(t("v1ui.s2.err.conflict"));
  const on = (id: string) => rules.rules.find((r) => r.id === id)?.enabled;
  if (rules.kapasiteModu === "orantili" && !on("denge")) warns.push(t("v1ui.s2.warn.prop"));
  if (on("kir") && rules.kirCarpan < 1) warns.push(t("v1ui.s2.warn.kir"));

  const mp = (m: boolean) => (m ? t("v1ui.s2.mandatory") : t("v1ui.s2.preferred"));
  const save = async () => {
    const ok = await confirm({
      title: t("v1ui.s2.save.title"),
      body: (
        <>
          <p>{t("v1ui.s2.save.open")}</p>
          <ol className="my-1 list-inside list-decimal">
            {rules.rules.filter((r) => r.enabled).map((r) => (
              <li key={r.id}>
                {RULE_META[r.id].label} — <b>{mp(r.mandatory)}</b>
              </li>
            ))}
          </ol>
          <p>
            {rt("v1ui.s2.save.mode", {
              mode: rules.kapasiteModu === "sert" ? t("v1ui.s2.mode.hard") : t("v1ui.s2.mode.prop"),
              unit: rules.kapasiteBirimi === "puan" ? t("v1ui.s2.unit.puan") : t("v1ui.s2.unit.is"),
            })}
          </p>
        </>
      ),
      confirmLabel: t("v1ui.s2.save.confirm"),
    });
    if (!ok) return;
    setRulesConfirmed(true);
    log("kurallar_secildi", t("v1ui.s2.save.log", { list: rules.rules.filter((r) => r.enabled).map((r) => `${RULE_META[r.id].label} (${mp(r.mandatory)})`).join(", ") }), {
      kurallar: rules.rules.filter((r) => r.enabled),
      kirCarpan: rules.kirCarpan,
      mod: rules.kapasiteModu,
      birim: rules.kapasiteBirimi,
      sapma: rules.sapma,
      gecenAyYon: rules.gecenAyYon,
      kapasiteAsimi: rules.kapasiteAsimi,
    });
    go(3);
  };

  const applyTemplate = async (tpl: (typeof TEMPLATES)[number]) => {
    const ok = await confirm({ title: t("v1ui.s2.tpl.title", { name: t(tpl.nameKey) }), body: t("v1ui.s2.tpl.body"), confirmLabel: t("v1ui.apply") });
    if (ok) setRules(tpl.make());
  };

  return (
    <div>
      <ScreenTitle no={2} title={t("v1ui.s2.title")} />
      <div className="mb-3 space-y-2">
        <Collapsible title={t("v1ui.s2.help.title")}>
          <ul className="list-inside list-disc space-y-0.5">
            <li>{rt("v1ui.s2.help.1")}</li>
            <li>{rt("v1ui.s2.help.2")}</li>
            <li>{t("v1ui.s2.help.3")}</li>
            <li>{t("v1ui.s2.help.4")}</li>
          </ul>
        </Collapsible>
      </div>

      <Card title={t("v1ui.s2.tplCard")} className="mb-3">
        <div className="grid gap-2 md:grid-cols-4">
          {TEMPLATES.map((tpl) => (
            <button key={tpl.nameKey} onClick={() => applyTemplate(tpl)} className="rounded border border-slate-200 p-2 text-left hover:border-[#1F2A44] hover:bg-slate-50">
              <div className="text-[12.5px] font-semibold text-[#1F2A44]">{t(tpl.nameKey)}</div>
              <div className="text-[11.5px] text-slate-600">{t(tpl.descKey)}</div>
            </button>
          ))}
        </div>
      </Card>

      <div className="grid gap-3 lg:grid-cols-5">
        <Card title={t("v1ui.s2.rulesCard")} className="lg:col-span-3">
          <ul className="divide-y divide-slate-200">
            {rules.rules.map((r, i) => {
              const meta = RULE_META[r.id];
              const canMandatory = r.id === "il" || r.id === "kir" || r.id === "gecenAy";
              return (
                <li key={r.id} className={clsx("flex items-start gap-2 py-2", !r.enabled && "opacity-60")} data-testid={`rule-${r.id}`}>
                  <div className="flex flex-col">
                    <button aria-label={t("v1ui.s2.up")} className="rounded p-0.5 hover:bg-slate-100 disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)}>
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button aria-label={t("v1ui.s2.down")} className="rounded p-0.5 hover:bg-slate-100 disabled:opacity-30" disabled={i === rules.rules.length - 1} onClick={() => move(i, 1)}>
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="w-5 pt-0.5 text-center text-xs font-semibold text-slate-500">{i + 1}</div>
                  <div className="min-w-0 flex-1">
                    <label className="flex cursor-pointer items-center gap-2 text-[13px] font-medium text-slate-900">
                      <input type="checkbox" checked={r.enabled} onChange={(e) => patchRule(i, { enabled: e.target.checked })} aria-label={t("v1ui.s2.toggle", { label: meta.label })} />
                      {meta.label}
                    </label>
                    <div className="ml-6 text-[11.5px] text-slate-600">{meta.desc}</div>
                  </div>
                  <select
                    className="h-7 rounded border border-slate-300 bg-white px-1.5 text-xs disabled:bg-slate-100"
                    disabled={!r.enabled || !canMandatory}
                    value={r.mandatory ? "z" : "t"}
                    onChange={(e) => patchRule(i, { mandatory: e.target.value === "z" })}
                    aria-label={t("v1ui.s2.mandOrPref", { label: meta.label })}
                  >
                    <option value="z">{t("v1ui.s2.opt.mandatory")}</option>
                    <option value="t">{t("v1ui.s2.opt.preferred")}</option>
                  </select>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card title={t("v1ui.s2.params")} className="lg:col-span-2">
          <div className="space-y-2.5">
            <Field label={t("v1ui.s2.p.unit")} hint={t("v1ui.s2.p.unit.hint")}>
              <select className={inputCls} value={rules.kapasiteBirimi} onChange={(e) => upd({ kapasiteBirimi: e.target.value as RuleSet["kapasiteBirimi"] })} aria-label={t("v1ui.s2.p.unit")}>
                <option value="puan">{t("v1ui.s2.p.unit.puan")}</option>
                <option value="is">{t("v1ui.s2.p.unit.is")}</option>
              </select>
            </Field>
            <Field label={t("v1ui.s2.p.mult")} hint={t("v1ui.s2.p.mult.hint")}>
              <input className={inputCls} type="number" step="0.1" min="0.5" max="5" value={rules.kirCarpan} onChange={(e) => upd({ kirCarpan: Number(e.target.value) || 1 })} aria-label={t("v1ui.s2.p.mult")} />
            </Field>
            <Field label={t("v1ui.s2.p.mode")}>
              <select className={inputCls} value={rules.kapasiteModu} onChange={(e) => upd({ kapasiteModu: e.target.value as RuleSet["kapasiteModu"] })} aria-label={t("v1ui.s2.p.mode")}>
                <option value="sert">{t("v1ui.s2.p.mode.hard")}</option>
                <option value="orantili">{t("v1ui.s2.p.mode.prop")}</option>
              </select>
            </Field>
            <Field label={t("v1ui.s2.p.dev")} hint={t("v1ui.s2.p.dev.hint")}>
              <input className={inputCls} type="number" min="0" max="50" value={rules.sapma} onChange={(e) => upd({ sapma: Math.max(0, Number(e.target.value) || 0) })} aria-label={t("v1ui.s2.p.dev.aria")} />
            </Field>
            <Field label={t("v1ui.s2.p.dir")}>
              <select className={inputCls} value={rules.gecenAyYon} onChange={(e) => upd({ gecenAyYon: e.target.value as RuleSet["gecenAyYon"] })} aria-label={t("v1ui.s2.p.dir")}>
                <option value="rotasyon">{t("v1ui.s2.p.dir.rot")}</option>
                <option value="sureklilik">{t("v1ui.s2.p.dir.cont")}</option>
              </select>
            </Field>
            <Field label={t("v1ui.s2.p.over")}>
              <select className={inputCls} value={rules.kapasiteAsimi} onChange={(e) => upd({ kapasiteAsimi: e.target.value as RuleSet["kapasiteAsimi"] })} aria-label={t("v1ui.s2.p.over")}>
                <option value="atanamadi">{t("v1ui.s2.p.over.un")}</option>
                <option value="uyari">{t("v1ui.s2.p.over.warn")}</option>
              </select>
            </Field>
            <label className="flex cursor-pointer items-center gap-2 text-[12.5px]">
              <input type="checkbox" checked={rules.iyilestirme} onChange={(e) => upd({ iyilestirme: e.target.checked })} /> {t("v1ui.s2.p.improve")}
            </label>
          </div>
        </Card>
      </div>

      <div className="mt-3 space-y-2">
        {errors.map((e) => (
          <InfoCard key={e} tone="error">
            {e}
          </InfoCard>
        ))}
        {warns.map((e) => (
          <InfoCard key={e} tone="warn">
            {e}
          </InfoCard>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <Button onClick={() => go(1)}>{t("v1ui.s2.toStaff")}</Button>
        <div className="flex items-center gap-2">
          {rulesConfirmed && <Badge tone="green">{t("v1ui.saved")}</Badge>}
          <Button variant="primary" disabled={errors.length > 0} onClick={save} data-testid="rules-next">
            {t("v1ui.s2.nextBtn")} <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
