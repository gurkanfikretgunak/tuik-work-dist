"use client";
import { ArrowRight, CheckCircle2, Download } from "lucide-react";
import { useState } from "react";
import { useConfirm } from "@/components/confirm";
import { Badge, Button, Card, Collapsible, InfoCard, ScreenTitle, Stat } from "@/components/ui";
import { EMP_COLS, toCsv, yesNo } from "@/lib/csv";
import { round1, sumEffCap } from "@/lib/engine";
import { JOB_ALL_COLS, RESULT_COLS_EXTRA, download, resultRows, unassignedRows } from "@/lib/share";
import { activeEmployees, activeJobs, useStore } from "@/lib/store";
import { RULE_META } from "@/lib/types";

export default function Screen6() {
  const confirm = useConfirm();
  const { employees, jobs, rules, result, approved, setApproved, log, go } = useStore();
  const emps = activeEmployees(employees);
  const js = activeJobs(jobs);
  const [pick, setPick] = useState({ sonuc: true, atanamayan: true, kural: true, calisan: false });

  if (!result) {
    return (
      <div>
        <ScreenTitle no={6} title="Onay ve Çıktı" />
        <InfoCard tone="warn">Geçerli bir dağıtım sonucu yok. Önce dağıtımı çalıştırın.</InfoCard>
        <Button className="mt-3" variant="primary" onClick={() => go(4)}>
          Dağıtım ekranına git
        </Button>
      </div>
    );
  }
  const A = result.assignments;
  const okN = A.filter((a) => a.empId).length;
  const un = A.length - okN;
  const manual = A.filter((a) => a.manuel).length;
  const open = rules.rules.filter((r) => r.enabled);

  const approve = async () => {
    const ok = await confirm({
      title: "Dağıtım onaylansın mı?",
      body: (
        <>
          <p>
            <b>{okN}</b> iş atanmış, <b>{un}</b> iş atanamamış durumda; <b>{manual}</b> manuel değişiklik yapıldı.
          </p>
          <p className="mt-1">Onaydan sonra çıktı dosyalarını indirebilirsiniz. Onay olay günlüğüne yazılır.</p>
        </>
      ),
      confirmLabel: "Onayla",
    });
    if (!ok) return;
    setApproved(true);
    log("onay", `Dağıtım onaylandı (${okN} atanan, ${un} atanamayan, ${manual} manuel değişiklik)`, { atanan: okN, atanamayan: un, manuel: manual });
  };

  const ruleJson = () =>
    JSON.stringify(
      {
        olusturma: new Date().toISOString(),
        kurallar: rules.rules.map((r, i) => ({ oncelik: i + 1, kural: RULE_META[r.id].label, id: r.id, acik: r.enabled, tip: r.mandatory ? "zorunlu" : "tercih" })),
        parametreler: {
          kapasiteBirimi: rules.kapasiteBirimi, kapasiteModu: rules.kapasiteModu, kirCarpan: rules.kirCarpan,
          sapma: rules.sapma, gecenAyYon: rules.gecenAyYon, kapasiteAsimi: rules.kapasiteAsimi, iyilestirme: rules.iyilestirme,
        },
        kapasiteAyarlari: employees.map((r) => ({ ...r.data, kullanildi: r.included && r.errors.length === 0 })),
        // Başka kullanıcının aynı ayarlarla dağıtım yapabilmesi için
        ayarSeti: { rules },
      },
      null,
      2,
    );

  const downloadAll = async () => {
    const files: string[] = [];
    if (pick.sonuc) files.push("atama_sonucu.csv");
    if (pick.atanamayan && un > 0) files.push("atanamayan_isler.csv");
    if (pick.kural) files.push("kural_ozeti.json");
    if (pick.calisan) files.push("calisanlar.csv");
    const ok = await confirm({
      title: "Dosyalar indirilsin mi?",
      body: (
        <>
          <ul className="list-inside list-disc">
            {files.map((f) => (
              <li key={f} className="font-mono">{f}</li>
            ))}
          </ul>
          <p className="mt-1 text-slate-600">Dosyalar çalışan adı ve birim numaraları içerir; yalnızca yetkili kişilerle paylaşın.</p>
        </>
      ),
      confirmLabel: "İndir",
    });
    if (!ok) return;
    if (pick.sonuc) download("atama_sonucu.csv", toCsv(resultRows(js, A, emps), [...JOB_ALL_COLS, ...RESULT_COLS_EXTRA]), "text/csv;charset=utf-8");
    if (pick.atanamayan && un > 0) download("atanamayan_isler.csv", toCsv(unassignedRows(js, A), [...JOB_ALL_COLS, "sebep"]), "text/csv;charset=utf-8");
    if (pick.kural) download("kural_ozeti.json", ruleJson(), "application/json");
    if (pick.calisan)
      download("calisanlar.csv", toCsv(employees.filter((r) => r.included).map((r) => ({ ...r.data, kir_gorevi_yapabilir: yesNo(r.data.kir_gorevi_yapabilir), aktif: yesNo(r.data.aktif) })), EMP_COLS), "text/csv;charset=utf-8");
    log("indirme", `Çıktı dosyaları indirildi: ${files.join(", ")}`, { dosyalar: files });
  };

  const chk = (k: keyof typeof pick, label: string, disabled = false) => (
    <label className={`flex items-center gap-2 text-[13px] ${disabled ? "opacity-50" : ""}`}>
      <input type="checkbox" disabled={disabled} checked={pick[k] && !disabled} onChange={(e) => setPick({ ...pick, [k]: e.target.checked })} />
      <span className="font-mono">{label}</span>
    </label>
  );

  return (
    <div>
      <ScreenTitle no={6} title="Onay ve Çıktı" />
      <div className="mb-3">
        <Collapsible title="Çıktı dosyaları ne içerir?">
          <ul className="list-inside list-disc space-y-0.5">
            <li>
              <b>atama_sonucu.csv</b>: girdi sütunları + atanan çalışan, atama nedeni, uyarı ve <code>manuel_degisti</code>.
            </li>
            <li>
              <b>atanamayan_isler.csv</b>: atanamayan işler ve sebepleri (varsa).
            </li>
            <li>
              <b>kural_ozeti.json</b>: kullanılan kurallar, parametreler ve kapasite ayarları; başka bir kullanıcı aynı ayarlarla dağıtım yapabilir.
            </li>
            <li>
              <b>calisanlar.csv</b> (isteğe bağlı): güncel kapasitelerle personel listesi; sonraki dönemde yeniden girilmesin diye.
            </li>
          </ul>
        </Collapsible>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-5">
        <Stat label="Atanan" value={okN} tone="green" />
        <Stat label="Atanamayan" value={un} tone={un ? "red" : "green"} />
        <Stat label="Manuel değişiklik" value={manual} />
        <Stat label="Efektif kapasite" value={round1(sumEffCap(emps))} />
        <Stat label="Açık kural" value={open.length} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="Son özet">
          <ul className="space-y-1 text-[12.5px]">
            {open.map((r) => (
              <li key={r.id} className="flex items-center gap-2">
                <Badge tone={r.mandatory ? "red" : "blue"}>{r.mandatory ? "zorunlu" : "tercih"}</Badge>
                {RULE_META[r.id].label}
              </li>
            ))}
            <li className="pt-1 text-slate-600">
              Kapasite: {rules.kapasiteModu === "sert" ? "sert limit" : "orantılı hedef"} · birim: {rules.kapasiteBirimi === "puan" ? "görüşme puanı" : "iş sayısı"}
            </li>
          </ul>
        </Card>
        <Card title="Onay">
          {approved ? (
            <InfoCard tone="ok">
              <span className="flex items-center gap-1 font-medium">
                <CheckCircle2 className="h-4 w-4" /> Dağıtım onaylandı. Dosyaları indirebilirsiniz.
              </span>
            </InfoCard>
          ) : (
            <>
              <p className="mb-2 text-[12.5px] text-slate-700">Sonucu gözden geçirdiyseniz dağıtımı onaylayın. Onaydan sonra indirme açılır.</p>
              <Button variant="primary" onClick={approve} data-testid="approve">
                <CheckCircle2 className="h-3.5 w-3.5" /> Dağıtımı onayla
              </Button>
            </>
          )}
        </Card>
      </div>

      <Card title="Çıktı dosyaları" className="mt-3">
        <div className="space-y-1.5">
          {chk("sonuc", "atama_sonucu.csv", !approved)}
          {chk("atanamayan", "atanamayan_isler.csv", !approved || un === 0)}
          {chk("kural", "kural_ozeti.json", !approved)}
          {chk("calisan", "calisanlar.csv (güncel kapasitelerle)", !approved)}
        </div>
        <Button className="mt-3" variant="primary" disabled={!approved} onClick={downloadAll} data-testid="download-all">
          <Download className="h-3.5 w-3.5" /> Seçilenleri indir
        </Button>
      </Card>

      <div className="mt-3 flex items-center justify-between">
        <Button onClick={() => go(5)}>← Ön onay</Button>
        <Button variant="primary" disabled={!approved} onClick={() => go(7)} data-testid="to-report">
          Süreç raporunu gör <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
