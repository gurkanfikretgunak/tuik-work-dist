"use client";
import { ArrowRight, FolderOpen } from "lucide-react";
import { useState } from "react";
import { useConfirm } from "@/components/confirm";
import { Button, Card, Collapsible, InfoCard, ScreenTitle } from "@/components/ui";
import { readSet, useStore } from "@/lib/store";

export default function Screen0() {
  const confirm = useConfirm();
  const { go, reset, loadSaved, log, employees, events } = useStore();
  const [saved] = useState(() => readSet());

  const start = async () => {
    const hasWork = employees.length > 0 || events.length > 0;
    const ok = await confirm({
      title: "Yeni dağıtım başlatılsın mı?",
      body: hasWork ? "Mevcut oturumdaki yüklemeler, ayarlar ve sonuçlar silinecek. Bu işlem geri alınamaz." : "Boş bir oturum açılacak ve personel yükleme adımına geçilecek.",
      confirmLabel: "Başlat",
      tone: hasWork ? "danger" : "primary",
    });
    if (!ok) return;
    reset();
    go(1);
  };

  const load = async () => {
    if (!saved) return;
    const ok = await confirm({
      title: "Kayıtlı set yüklensin mi?",
      body: (
        <>
          {new Date(saved.savedAt).toLocaleString("tr-TR")} tarihinde kaydedilen <b>{saved.employees.length}</b> personel satırı, kapasite ayarları ve kural seti
          yüklenecek. Mevcut oturum sıfırlanır.
        </>
      ),
      confirmLabel: "Seti yükle",
    });
    if (!ok) return;
    loadSaved(saved);
    log("oturum", "Kayıtlı personel, kapasite ve kural seti yüklendi", { personel: saved.employees.length });
    go(1);
  };

  return (
    <div className="mx-auto max-w-4xl">
      <ScreenTitle no={0} title="Karşılama" />
      <Card>
        <p className="text-[13.5px] leading-relaxed text-slate-800">
          Bu araç, personelin kapasitesine ve seçtiğiniz kurallara göre işleri çalışanlara dağıtır. Girişsizdir; tüm dosyalar tarayıcınızda işlenir ve sunucuya gönderilmez.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="primary" onClick={start} data-testid="start-new">
            Yeni dağıtım başlat <ArrowRight className="h-3.5 w-3.5" />
          </Button>
          <Button onClick={load} disabled={!saved} data-testid="load-saved">
            <FolderOpen className="h-3.5 w-3.5" /> Kayıtlı seti yükle
          </Button>
          {!saved && <span className="self-center text-xs text-slate-500">Bu tarayıcıda kayıtlı set yok.</span>}
        </div>
      </Card>

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <InfoCard title="1 · Hazırlık">Personel dosyasını (calisanlar.csv) yükler, kişi bazlı kapasiteyi ve müsaitliği ayarlarsınız.</InfoCard>
        <InfoCard title="2 · Kurallar ve iş">Dağıtım kurallarını seçer, ardından işleri (isler.csv) yüklersiniz. Her satırı kullanıp kullanmayacağınıza siz karar verirsiniz.</InfoCard>
        <InfoCard title="3 · Dağıtım ve paylaşım" tone="ok">Sonucu ön onayda inceler, onaylar ve çıktıları, süreç raporunu ve paylaşım paketlerini indirirsiniz.</InfoCard>
      </div>

      <div className="mt-3 space-y-2">
        <Collapsible title="Akış nasıl işler?" defaultOpen>
          <ol className="list-inside list-decimal space-y-0.5">
            <li>Personel ve kapasite ayarı</li>
            <li>Kural seçimi (zorunlu / tercih, öncelik sırası)</li>
            <li>İş yükleme ve doğrulama (kapasite çapraz kontrolü)</li>
            <li>Dağıtım çalıştırma</li>
            <li>Ön onay (inceleme ve manuel düzenleme)</li>
            <li>Onay ve çıktı dosyaları</li>
            <li>Süreç raporu</li>
            <li>Genel özet ve paylaşım yardımcıları</li>
          </ol>
        </Collapsible>
        <Collapsible title="Hangi dosyalar gerekir?">
          <p>
            <b>calisanlar.csv</b> ve <b>isler.csv</b>. Sütun adları örnek dosyalardakiyle aynı olmalıdır. Ayraç (virgül / noktalı virgül) otomatik algılanır.
          </p>
          <p className="mt-1">
            Denemek için örnek dosyaları indirebilirsiniz: <a className="text-sky-700 underline" href="/ornek/calisanlar.csv" download>calisanlar.csv</a> ·{" "}
            <a className="text-sky-700 underline" href="/ornek/isler.csv" download>isler.csv</a>. Sonraki ekranlarda tek tıkla örnek veri yükleme de vardır.
          </p>
        </Collapsible>
        <Collapsible title="Verilerim güvende mi? (KVKK notu)">
          Dosyalar tarayıcı belleğinde tutulur, hiçbir sunucuya gönderilmez. İşlerde kişi adı yerine yalnızca birim / hane numarası bulunmalıdır. Çalışanlara giden listelerde başka
          çalışanların işleri yer almaz. Kalıcı paylaşım bağlantısı bu sürümde yoktur.
        </Collapsible>
      </div>
    </div>
  );
}
