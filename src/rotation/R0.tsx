"use client";
import { ArrowRight } from "lucide-react";
import { useConfirm } from "@/components/confirm";
import { Button, Card, Collapsible, InfoCard, ScreenTitle, Stat, inputCls } from "@/components/ui";
import { calcMath } from "./math";
import { useRot } from "./store";

export default function R0() {
  const confirm = useConfirm();
  const { n, setN, g, m, go, addLog } = useRot();
  const x = calcMath(n, m, g);

  const next = async () => {
    const ok = await confirm({
      title: "Personel sayısı onaylansın mı?",
      body: <>Bu yıl <b>{n}</b> personel ve <b>{n}</b> defter kalıbı için plan yapılacak. Her kişi her defteri {x.lo === x.hi ? <b>{x.lo}</b> : <b>{x.lo}–{x.hi}</b>} kez alacak.</>,
      confirmLabel: "Onayla ve parametrelere geç",
    });
    if (!ok) return;
    addLog(`Başlangıç: N=${n} personel, ${n} defter kalıbı`);
    go(1);
  };

  return (
    <div className="mx-auto max-w-4xl">
      <ScreenTitle no={0} title="Başlangıç Sihirbazı (R0)" />
      <div className="mb-3 space-y-2">
        <Collapsible title="Bu motor ne yapar?" defaultOpen>
          Plan; aylar satır, kişiler sütun, defter numarası değer olan bir tablodur (sudoku mantığı). Her ay her defter tam bir kişide olur. Bir defter aynı kişiye yakın aylarda tekrar düşmez (K1), her kişi her defteri
          eşit sayıda alır (K3) ve defterin el değiştirme çiftleri (A→B) sınırlı tekrar eder (K2). Her yıl plan önceki yıldan bağımsız, sıfırdan kurulur.
        </Collapsible>
      </div>
      <Card title="Bu yıl kaç personel için defter planı yapılacak? (N)">
        <div className="flex items-end gap-3">
          <label className="block w-40 text-[12.5px]">
            <span className="mb-0.5 block font-medium text-slate-700">Personel sayısı</span>
            <input type="number" min={2} max={60} value={n} onChange={(e) => setN(Math.max(2, Math.min(60, Math.floor(Number(e.target.value) || 2))))} className={inputCls} aria-label="Personel sayısı" data-testid="n-input" />
          </label>
          <span className="pb-1.5 text-xs text-slate-500">Varsayılan: 12 ay, tekrar aralığı G=2. R1&apos;de değiştirilebilir.</span>
        </div>
      </Card>

      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4" data-testid="feas-card">
        <Stat label="Defter kalıbı" value={n} sub="= personel sayısı" />
        <Stat label="Kişi–defter sayısı" value={x.lo === x.hi ? `${x.lo}` : `${x.lo}–${x.hi}`} sub="alt–üst aralık" />
        <Stat label="Fazladan (r = M mod N)" value={x.r} sub={`${x.perPersonLo} defter ${x.lo}×, ${x.perPersonHi} defter ${x.hi}×`} />
        <Stat label="Çift tekrarı alt sınırı" value={x.pairLower} sub={`${x.orderedPairs} olası A→B çifti`} />
      </div>
      <Card title="Uygulanabilirlik" className="mt-3">
        <div className="mb-2 text-[12.5px] text-slate-700">
          Toplam defter devri: <b>{x.totalTransfers}</b> · alt sınır ⌊M/N⌋ = <b>{x.lo}</b>, üst sınır ⌈M/N⌉ = <b>{x.hi}</b>
        </div>
        <div className="space-y-1.5">
          {x.warnings.map((w) => (
            <InfoCard key={w.text} tone={w.tone}>{w.text}</InfoCard>
          ))}
          {x.warnings.length === 0 && <InfoCard tone="ok">Bu N için matematiksel bir engel görünmüyor.</InfoCard>}
        </div>
      </Card>
      <div className="mt-3 flex justify-end">
        <Button variant="primary" disabled={!x.feasible} onClick={next} data-testid="r0-next">
          Onayla ve devam et <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
