"use client";
import { ArrowRight, BookOpen, Shuffle } from "lucide-react";
import { useConfirm } from "@/components/confirm";
import { Badge, Button, Collapsible, InfoCard } from "@/components/ui";
import { useApp } from "@/lib/appstore";

export default function Home() {
  const confirm = useConfirm();
  const setEngine = useApp((s) => s.setEngine);

  const pick = async (e: "v1" | "v2") => {
    const ok = await confirm({
      title: e === "v1" ? "v1 İş Dağıtım Motoru açılsın mı?" : "v2 Defter Rotasyon Motoru açılsın mı?",
      body: e === "v1" ? "Personel kapasitesine ve kurallara göre iş dağıtımı akışı başlar." : "Önce personel sayısı (N) sorulur; N defter kalıbı otomatik oluşturulur ve aylık rotasyon planı üretilir.",
      confirmLabel: "Aç",
    });
    if (ok) setEngine(e);
  };

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-3">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-[#C92830]">Ana sayfa</div>
        <h1 className="text-lg font-semibold text-[#1F2A44]">Motor seçimi</h1>
        <p className="text-[13px] text-slate-600">Hangi dağıtım motorunu kullanmak istediğinizi seçin. Motorlar birbirinden bağımsızdır; veriler yalnızca tarayıcıda işlenir.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <section className="flex flex-col rounded-md border border-slate-200 bg-white" data-testid="engine-v1">
          <header className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
            <div className="flex items-center gap-2 font-semibold text-[#1F2A44]"><Shuffle className="h-4 w-4" /> İş Dağıtım Motoru</div>
            <Badge tone="blue">v1</Badge>
          </header>
          <div className="flex-1 space-y-2 p-4 text-[13px] text-slate-700">
            <p>İşleri (isler.csv) çalışanlara kapasiteye, ile, mahalleye ve kır/kent koşullarına göre dağıtır. Ön onay, manuel düzenleme, süreç raporu ve paylaşım paketleri içerir.</p>
            <Collapsible title="Akış (9 ekran)">Karşılama → Personel ve kapasite → Kurallar → İş yükleme → Dağıtım → Ön onay → Onay ve çıktı → Süreç raporu → Genel özet ve paylaşım.</Collapsible>
          </div>
          <div className="border-t border-slate-200 p-3"><Button variant="primary" onClick={() => pick("v1")} data-testid="pick-v1">v1 ile başla <ArrowRight className="h-3.5 w-3.5" /></Button></div>
        </section>

        <section className="flex flex-col rounded-md border border-slate-200 bg-white" data-testid="engine-v2">
          <header className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
            <div className="flex items-center gap-2 font-semibold text-[#1F2A44]"><BookOpen className="h-4 w-4" /> Defter Rotasyon Motoru</div>
            <div className="flex gap-1"><Badge tone="red">yeni</Badge><Badge tone="blue">v2</Badge></div>
          </header>
          <div className="flex-1 space-y-2 p-4 text-[13px] text-slate-700">
            <p>N personel ve N defter için yıllık aylık rotasyon planı üretir: aynı defter yakın aylarda aynı kişiye düşmez, kişi–defter dağılımı eşit olur, takip (A→B) tekrarları sınırlanır. Sudoku mantığıyla kısıt tabanlı arama kullanır.</p>
            <Collapsible title="Kurallar ve akış (R0–R4)">
              <ul className="list-inside list-disc space-y-0.5">
                <li><b>K1</b> tekrar yasağı · <b>K2</b> takip yasağı · <b>K3</b> yıllık eşitlik · <b>K5</b> defter grubu dengesi (isteğe bağlı)</li>
                <li>R0 Başlangıç sihirbazı → R1 Parametreler → R2 Plan üretimi → R3 İnceleme ve doğrulama → R4 Onay ve çıktı</li>
              </ul>
            </Collapsible>
          </div>
          <div className="border-t border-slate-200 p-3"><Button variant="primary" onClick={() => pick("v2")} data-testid="pick-v2">v2 ile başla <ArrowRight className="h-3.5 w-3.5" /></Button></div>
        </section>
      </div>
      <div className="mt-3"><InfoCard>v2 ayrı bir modüldür; v1 akışına ve verilerine dokunmaz. Ana araca entegrasyon (<code>defter_no</code> kuralı) sonraki aşamadır.</InfoCard></div>
    </div>
  );
}
