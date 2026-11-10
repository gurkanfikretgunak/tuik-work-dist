"use client";
import clsx from "clsx";
import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";
import { useConfirm } from "@/components/confirm";
import { Badge, Button, Card, Collapsible, Field, InfoCard, ScreenTitle, inputCls } from "@/components/ui";
import { useStore } from "@/lib/store";
import { DEFAULT_RULESET, RULE_META, type RuleSet } from "@/lib/types";

const TEMPLATES: { name: string; desc: string; make: () => RuleSet }[] = [
  { name: "Dengeli (önerilen)", desc: "İl ve kır zorunlu; mahalle ve doluluk dengesi tercih.", make: () => structuredClone(DEFAULT_RULESET) },
  {
    name: "Süreklilik odaklı",
    desc: "Geçen ay görüşen kişi aynı kalmaya çalışır (tercih).",
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
    name: "Rotasyon (zorunlu)",
    desc: "Geçen ay görüşen kişiye aynı iş verilmez.",
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
    name: "Boş liste",
    desc: "Tüm kurallar kapalı; kendiniz seçersiniz.",
    make: () => ({ ...structuredClone(DEFAULT_RULESET), rules: DEFAULT_RULESET.rules.map((r) => ({ ...r, enabled: false, mandatory: false })) }),
  },
];

export default function Screen2() {
  const confirm = useConfirm();
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
  if (!rules.rules.some((r) => r.enabled)) errors.push("En az bir kural açık olmalı.");
  if (rules.kapasiteModu === "sert" && rules.kapasiteAsimi === "uyari")
    errors.push("Çelişki: 'Sert limit' modunda kapasite aşımı izni verilemez. Aşımı 'atanamadı listesine düşsün' yapın veya orantılı moda geçin.");
  const on = (id: string) => rules.rules.find((r) => r.id === id)?.enabled;
  if (rules.kapasiteModu === "orantili" && !on("denge")) warns.push("Orantılı hedef modu, 'Kapasiteye orantılı denge' kuralı kapalıyken etkisizdir.");
  if (on("kir") && rules.kirCarpan < 1) warns.push("Kır çarpanı 1'den küçük; kır işleri kentten hafif sayılır.");

  const save = async () => {
    const ok = await confirm({
      title: "Kural seti kaydedilsin mi?",
      body: (
        <>
          <p>Açık kurallar (öncelik sırasıyla):</p>
          <ol className="my-1 list-inside list-decimal">
            {rules.rules.filter((r) => r.enabled).map((r) => (
              <li key={r.id}>
                {RULE_META[r.id].label} — <b>{r.mandatory ? "zorunlu" : "tercih"}</b>
              </li>
            ))}
          </ol>
          <p>
            Kapasite modu: <b>{rules.kapasiteModu === "sert" ? "sert limit" : "orantılı hedef"}</b>, birim: <b>{rules.kapasiteBirimi === "puan" ? "görüşme puanı" : "iş sayısı"}</b>.
          </p>
        </>
      ),
      confirmLabel: "Kaydet ve devam et",
    });
    if (!ok) return;
    setRulesConfirmed(true);
    log("kurallar_secildi", `Kurallar seçildi: ${rules.rules.filter((r) => r.enabled).map((r) => `${RULE_META[r.id].label} (${r.mandatory ? "zorunlu" : "tercih"})`).join(", ")}`, {
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

  const applyTemplate = async (t: (typeof TEMPLATES)[number]) => {
    const ok = await confirm({ title: `"${t.name}" şablonu uygulansın mı?`, body: "Mevcut kural seçimleriniz ve parametreler bu şablonla değiştirilecek.", confirmLabel: "Uygula" });
    if (ok) setRules(t.make());
  };

  return (
    <div>
      <ScreenTitle no={2} title="Kural Seçimi" />
      <div className="mb-3 space-y-2">
        <Collapsible title="Kurallar nasıl çalışır?">
          <ul className="list-inside list-disc space-y-0.5">
            <li>
              <b>Zorunlu</b> kural bir filtredir: kurala uymayan çalışan o işe hiç aday olmaz. Aday kalmazsa iş &quot;atanamadı&quot; listesine sebebiyle düşer.
            </li>
            <li>
              <b>Tercih</b> kural puanlamada kullanılır: kurala uyan adaya ek puan verilir, öncelik sırası yukarıda olan kuralın ağırlığı daha yüksektir.
            </li>
            <li>Mahalle gruplama ve doluluk dengesi doğası gereği tercih kurallarıdır.</li>
            <li>Ok düğmeleriyle öncelik sırasını değiştirin (en üst = en yüksek öncelik).</li>
          </ul>
        </Collapsible>
      </div>

      <Card title="Hazır şablonlar" className="mb-3">
        <div className="grid gap-2 md:grid-cols-4">
          {TEMPLATES.map((t) => (
            <button key={t.name} onClick={() => applyTemplate(t)} className="rounded border border-slate-200 p-2 text-left hover:border-[#1F2A44] hover:bg-slate-50">
              <div className="text-[12.5px] font-semibold text-[#1F2A44]">{t.name}</div>
              <div className="text-[11.5px] text-slate-600">{t.desc}</div>
            </button>
          ))}
        </div>
      </Card>

      <div className="grid gap-3 lg:grid-cols-5">
        <Card title="Kurallar ve öncelik sırası" className="lg:col-span-3">
          <ul className="divide-y divide-slate-200">
            {rules.rules.map((r, i) => {
              const meta = RULE_META[r.id];
              const canMandatory = r.id === "il" || r.id === "kir" || r.id === "gecenAy";
              return (
                <li key={r.id} className={clsx("flex items-start gap-2 py-2", !r.enabled && "opacity-60")} data-testid={`rule-${r.id}`}>
                  <div className="flex flex-col">
                    <button aria-label="Yukarı taşı" className="rounded p-0.5 hover:bg-slate-100 disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)}>
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button aria-label="Aşağı taşı" className="rounded p-0.5 hover:bg-slate-100 disabled:opacity-30" disabled={i === rules.rules.length - 1} onClick={() => move(i, 1)}>
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="w-5 pt-0.5 text-center text-xs font-semibold text-slate-500">{i + 1}</div>
                  <div className="min-w-0 flex-1">
                    <label className="flex cursor-pointer items-center gap-2 text-[13px] font-medium text-slate-900">
                      <input type="checkbox" checked={r.enabled} onChange={(e) => patchRule(i, { enabled: e.target.checked })} aria-label={`${meta.label} aç/kapa`} />
                      {meta.label}
                    </label>
                    <div className="ml-6 text-[11.5px] text-slate-600">{meta.desc}</div>
                  </div>
                  <select
                    className="h-7 rounded border border-slate-300 bg-white px-1.5 text-xs disabled:bg-slate-100"
                    disabled={!r.enabled || !canMandatory}
                    value={r.mandatory ? "z" : "t"}
                    onChange={(e) => patchRule(i, { mandatory: e.target.value === "z" })}
                    aria-label={`${meta.label} zorunlu veya tercih`}
                  >
                    <option value="z">Zorunlu</option>
                    <option value="t">Tercih</option>
                  </select>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card title="Parametreler" className="lg:col-span-2">
          <div className="space-y-2.5">
            <Field label="Kapasite birimi" hint="Görüşme puanında kır işi çarpanla ağırlıklandırılır.">
              <select className={inputCls} value={rules.kapasiteBirimi} onChange={(e) => upd({ kapasiteBirimi: e.target.value as RuleSet["kapasiteBirimi"] })} aria-label="Kapasite birimi">
                <option value="puan">Görüşme puanı (önerilen)</option>
                <option value="is">İş sayısı</option>
              </select>
            </Field>
            <Field label="Kır çarpanı" hint="Örn. 1,5: 2 görüşmelik kır işi = 3 puan.">
              <input className={inputCls} type="number" step="0.1" min="0.5" max="5" value={rules.kirCarpan} onChange={(e) => upd({ kirCarpan: Number(e.target.value) || 1 })} aria-label="Kır çarpanı" />
            </Field>
            <Field label="Kapasite kullanım modu">
              <select className={inputCls} value={rules.kapasiteModu} onChange={(e) => upd({ kapasiteModu: e.target.value as RuleSet["kapasiteModu"] })} aria-label="Kapasite modu">
                <option value="sert">Sert limit — kapasite hiç aşılmaz</option>
                <option value="orantili">Orantılı hedef — herkes aynı doluluk oranına yaklaşır</option>
              </select>
            </Field>
            <Field label="İzin verilen doluluk sapması (yüzde puan)" hint="İyileştirme turu, en dolu ve en az dolu çalışan arasındaki fark bunu aşarsa iş taşır.">
              <input className={inputCls} type="number" min="0" max="50" value={rules.sapma} onChange={(e) => upd({ sapma: Math.max(0, Number(e.target.value) || 0) })} aria-label="Sapma" />
            </Field>
            <Field label="Geçen ay kuralı yönü">
              <select className={inputCls} value={rules.gecenAyYon} onChange={(e) => upd({ gecenAyYon: e.target.value as RuleSet["gecenAyYon"] })} aria-label="Geçen ay yönü">
                <option value="rotasyon">Rotasyon — farklı kişiye ver</option>
                <option value="sureklilik">Süreklilik — aynı kişide kalsın</option>
              </select>
            </Field>
            <Field label="Kapasite aşılırsa">
              <select className={inputCls} value={rules.kapasiteAsimi} onChange={(e) => upd({ kapasiteAsimi: e.target.value as RuleSet["kapasiteAsimi"] })} aria-label="Kapasite aşımı">
                <option value="atanamadi">Fazla işler atanamadı listesine düşsün</option>
                <option value="uyari">En az dolu çalışana atanıp uyarı verilsin</option>
              </select>
            </Field>
            <label className="flex cursor-pointer items-center gap-2 text-[12.5px]">
              <input type="checkbox" checked={rules.iyilestirme} onChange={(e) => upd({ iyilestirme: e.target.checked })} /> İyileştirme turunu çalıştır
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
        <Button onClick={() => go(1)}>← Personel</Button>
        <div className="flex items-center gap-2">
          {rulesConfirmed && <Badge tone="green">Kaydedildi</Badge>}
          <Button variant="primary" disabled={errors.length > 0} onClick={save} data-testid="rules-next">
            Kaydet ve iş yüklemeye geç <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
