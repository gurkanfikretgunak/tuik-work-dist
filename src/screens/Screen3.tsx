"use client";
import { ArrowRight, FileUp } from "lucide-react";
import { useMemo, useState } from "react";
import { useConfirm } from "@/components/confirm";
import { DataTable, type Col, type TRow } from "@/components/DataTable";
import { FileDrop } from "@/components/FileDrop";
import { Badge, Button, Card, Collapsible, InfoCard, ScreenTitle, Stat } from "@/components/ui";
import { parseJobs } from "@/lib/csv";
import { effCap, round1, sumEffCap, weightOf } from "@/lib/engine";
import { activeEmployees, activeJobs, useStore } from "@/lib/store";

export default function Screen3() {
  const confirm = useConfirm();
  const { jobs, jobFile, jobsConfirmed, employees, rules, setJobs, patchJobs, setJobsConfirmed, go, log } = useStore();
  const [fatal, setFatal] = useState("");

  const onText = async (text: string, name: string) => {
    const r = parseJobs(text);
    if (r.fatal) return setFatal(r.fatal);
    setFatal("");
    if (jobs.length) {
      const ok = await confirm({ title: "Mevcut iş listesi değiştirilsin mi?", body: "Yüklü işler ve varsa dağıtım sonucu silinecek.", confirmLabel: "Değiştir", tone: "danger" });
      if (!ok) return;
    }
    const bad = r.rows.filter((x) => x.errors.length).length;
    setJobs(r.rows, { name, total: r.rows.length, errorRows: bad, at: new Date().toISOString() });
    log("is_yuklendi", `İş dosyası yüklendi: ${name} (${r.rows.length} satır, ${bad} hatalı)`, { dosya: name, satir: r.rows.length, hatali: bad });
  };
  const loadSample = async () => onText(await (await fetch("/ornek/isler.csv")).text(), "isler.csv (örnek)");

  const toggle = (id: number) => patchJobs((rs) => rs.map((r) => (r.rowNo === id ? (r.errors.length && !r.included ? r : { ...r, included: !r.included }) : r)));
  const toggleAll = (c: boolean, ids: number[]) => {
    const s = new Set(ids);
    patchJobs((rs) => rs.map((r) => (s.has(r.rowNo) && (!c || r.errors.length === 0) ? { ...r, included: c } : r)));
  };

  const emps = useMemo(() => activeEmployees(employees), [employees]);
  const act = useMemo(() => activeJobs(jobs), [jobs]);

  const stats = useMemo(() => {
    const cap = sumEffCap(emps);
    const load = act.reduce((s, j) => s + weightOf(j, rules), 0);
    const iller = [...new Set(act.map((j) => j.il))].sort((a, b) => a.localeCompare(b, "tr"));
    const perIl = iller.map((il) => {
      const c = emps.filter((e) => e.aktif && e.il === il).reduce((s, e) => s + effCap(e), 0);
      const l = act.filter((j) => j.il === il).reduce((s, j) => s + weightOf(j, rules), 0);
      return { il, cap: c, load: l, gap: Math.max(0, l - c), noStaff: !emps.some((e) => e.aktif && e.il === il) };
    });
    const kir = act.filter((j) => j.yerlesim_tipi === "Kır").length;
    const empIds = new Set(employees.map((r) => r.data.calisan_id));
    const badPrev = act.filter((j) => j.onceki_ay_gorusen_calisan_id && !empIds.has(j.onceki_ay_gorusen_calisan_id));
    return { cap, load, perIl, kir, badPrev, gorusme: act.reduce((s, j) => s + j.gorusme_sayisi, 0) };
  }, [act, emps, rules, employees]);

  const unitLbl = rules.kapasiteBirimi === "puan" ? "puan" : "iş";
  const gap = stats.load - stats.cap;
  const noStaffIl = stats.perIl.filter((x) => x.noStaff);
  const ilGaps = stats.perIl.filter((x) => x.gap > 0 && !x.noStaff);

  const rows: TRow[] = jobs.map((r) => ({ id: r.rowNo, cells: { ...r.data }, errors: r.errors, checked: r.included, dim: !r.included }));
  const cols: Col[] = [
    { key: "is_id", label: "is_id", width: 80 },
    { key: "il", label: "il", width: 80 },
    { key: "ilce", label: "ilce", width: 90 },
    { key: "mahalle", label: "mahalle", width: 100 },
    { key: "yerlesim_tipi", label: "yerlesim_tipi", width: 90 },
    { key: "birim_no", label: "birim_no", width: 90 },
    { key: "gorusme_sayisi", label: "gorusme_sayisi", type: "num", width: 100 },
    { key: "onceki_ay_gorusen_calisan_id", label: "onceki_ay_gorusen_calisan_id", width: 160 },
    { key: "oncelik", label: "oncelik", width: 70 },
    { key: "anket_turu", label: "anket_turu", width: 140 },
  ];

  const badRows = jobs.filter((r) => r.errors.length);
  const next = async () => {
    const ok = await confirm({
      title: "İş listesi onaylansın ve dağıtıma geçilsin mi?",
      body: (
        <>
          <p>
            <b>{act.length}</b> iş kullanılacak ({jobs.length - act.length} satır dışarıda bırakıldı). Toplam yük <b>{round1(stats.load)} {unitLbl}</b>, efektif kapasite <b>{round1(stats.cap)}</b>.
          </p>
          {gap > 0 && <p className="mt-1 font-medium text-[#C92830]">Dikkat: kapasite açığı {round1(gap)} {unitLbl}. Bazı işler atanamayabilir.</p>}
        </>
      ),
      confirmLabel: "Onayla ve devam et",
    });
    if (!ok) return;
    setJobsConfirmed(true);
    log("is_onaylandi", `İş listesi onaylandı: ${act.length} iş kullanılacak, ${jobs.length - act.length} satır atlandı`, { kullanilan: act.length, atlanan: jobs.length - act.length });
    go(4);
  };

  return (
    <div>
      <ScreenTitle no={3} title="İş Yükleme ve Doğrulama">
        <Button onClick={loadSample} data-testid="load-sample-job">
          <FileUp className="h-3.5 w-3.5" /> Örnek veri yükle
        </Button>
      </ScreenTitle>
      <div className="mb-3">
        <Collapsible title="Doğrulama ve kontroller nasıl çalışır?">
          <ul className="list-inside list-disc space-y-0.5">
            <li>
              <b>isler.csv</b> okunur ve her satır doğrulanır; hatalı hücreler kırmızı, satır numarası ve sebebi aşağıdaki rapordadır.
            </li>
            <li>Satır başındaki kutuyla işin dağıtıma dahil edilip edilmeyeceğine siz karar verirsiniz. Hatalı satırlar otomatik atlanır; düzeltip yeniden yükleyebilirsiniz.</li>
            <li>Çapraz kontroller: toplam yük ≤ efektif kapasite mi, il bazında açık var mı, çalışanı olmayan ilde iş var mı, önceki ay ID&apos;leri personelde var mı.</li>
          </ul>
        </Collapsible>
      </div>

      {fatal && (
        <div className="mb-3">
          <InfoCard tone="error" title="Dosya okunamadı">
            {fatal}
          </InfoCard>
        </div>
      )}

      {jobs.length === 0 ? (
        <FileDrop onText={onText} label="isler.csv dosyasını sürükleyin veya seçin" />
      ) : (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-6">
            <Stat label="Kullanılacak iş" value={act.length} sub={`toplam ${jobs.length} satır`} />
            <Stat label="Toplam görüşme" value={stats.gorusme} />
            <Stat label="İl sayısı" value={stats.perIl.length} />
            <Stat label="Kır / kent" value={`${stats.kir} / ${act.length - stats.kir}`} sub={act.length ? `%${Math.round((stats.kir / act.length) * 100)} kır` : ""} />
            <Stat label={`Yük / kapasite (${unitLbl})`} value={`${round1(stats.load)} / ${round1(stats.cap)}`} tone={gap > 0 ? "red" : "green"} />
            <Stat label="Doluluk tahmini" value={stats.cap > 0 ? `%${Math.round((stats.load / stats.cap) * 100)}` : "—"} tone={gap > 0 ? "red" : undefined} />
          </div>

          <div className="mb-3 grid gap-3 lg:grid-cols-2">
            <Card title="Çapraz kontroller (personele karşı)">
              <div className="space-y-1.5">
                {gap > 0 ? (
                  <InfoCard tone="error">
                    Toplam iş yükü kapasiteyi aşıyor: <b>{round1(gap)} {unitLbl}</b> açık var.
                  </InfoCard>
                ) : (
                  <InfoCard tone="ok">Toplam iş yükü efektif kapasiteye sığıyor.</InfoCard>
                )}
                {ilGaps.length > 0 && (
                  <InfoCard tone="warn" title="İl bazında kapasite açığı">
                    {ilGaps.map((x) => `${x.il}: ${round1(x.gap)}`).join(" · ")}
                  </InfoCard>
                )}
                {noStaffIl.length > 0 && (
                  <InfoCard tone="error" title="Çalışanı olmayan ilde iş var">
                    {noStaffIl.map((x) => x.il).join(", ")} — bu işler (il kuralı zorunluysa) atanamayacak.
                  </InfoCard>
                )}
                {stats.badPrev.length > 0 && (
                  <InfoCard tone="warn" title="Önceki ay çalışan ID'si personelde yok">
                    {stats.badPrev.length} iş: {[...new Set(stats.badPrev.map((j) => j.onceki_ay_gorusen_calisan_id))].join(", ")}
                  </InfoCard>
                )}
              </div>
            </Card>
            <Card title={`Hata raporu (${badRows.length} satır)`}>
              {badRows.length === 0 ? (
                <Badge tone="green">Hatalı satır yok</Badge>
              ) : (
                <div className="max-h-40 overflow-auto">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="text-left text-slate-500">
                        <th className="pr-2">Satır</th>
                        <th className="pr-2">Sütun</th>
                        <th>Sebep</th>
                      </tr>
                    </thead>
                    <tbody>
                      {badRows.flatMap((r) =>
                        r.errors.map((e, i) => (
                          <tr key={`${r.rowNo}-${i}`} className="border-t border-slate-100" data-testid="error-row">
                            <td className="pr-2 tabular-nums">{r.rowNo}</td>
                            <td className="pr-2 font-mono">{e.col}</td>
                            <td className="text-red-800">{e.msg}</td>
                          </tr>
                        )),
                      )}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={() => patchJobs((rs) => rs.map((r) => (r.errors.length ? { ...r, included: false } : r)))}>
                  Hatalı satırları atla
                </Button>
                <Button size="sm" onClick={() => setJobs([], { name: "", total: 0, errorRows: 0, at: "" })}>
                  Dosyayı kaldır ve yeniden yükle
                </Button>
              </div>
            </Card>
          </div>

          <DataTable sheetName={jobFile?.name ?? "isler.csv"} columns={cols} rows={rows} onToggle={toggle} onToggleAll={toggleAll} height={380} />
        </>
      )}

      <div className="mt-3 flex items-center justify-between">
        <Button onClick={() => go(2)}>← Kurallar</Button>
        <div className="flex items-center gap-2">
          {jobsConfirmed && <Badge tone="green">Onaylandı</Badge>}
          <Button variant="primary" disabled={act.length === 0} onClick={next} data-testid="jobs-next">
            Onayla ve dağıtıma geç <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
