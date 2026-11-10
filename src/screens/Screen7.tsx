"use client";
import { ArrowRight, Download, Printer } from "lucide-react";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useConfirm } from "@/components/confirm";
import { Badge, Button, Card, Collapsible, InfoCard, ScreenTitle, Stat } from "@/components/ui";
import { reportCsvs, reportHtml } from "@/lib/outputs";
import { buildReport } from "@/lib/report";
import { download } from "@/lib/share";
import { useStore } from "@/lib/store";
import { RULE_META } from "@/lib/types";

const pct = (n: number) => `%${Math.round(n * 100)}`;
const T = ({ head, rows }: { head: string[]; rows: (string | number)[][] }) => (
  <div className="overflow-auto">
    <table className="w-full text-[12.5px]">
      <thead className="bg-slate-50 text-left text-slate-600">
        <tr>
          {head.map((h) => (
            <th key={h} className="border-b border-slate-200 px-2 py-1 font-semibold">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-slate-100">
            {r.map((c, j) => (
              <td key={j} className="px-2 py-1 tabular-nums">
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default function Screen7() {
  const confirm = useConfirm();
  const { employees, jobs, rules, result, events, empFile, jobFile, go, log, approved } = useStore();
  const rep = useMemo(
    () => (result ? buildReport({ employees, jobs, rules, result, events, empFile, jobFile }) : null),
    [employees, jobs, rules, result, events, empFile, jobFile],
  );

  if (!rep || !result)
    return (
      <div>
        <ScreenTitle no={7} title="Süreç Raporu" />
        <InfoCard tone="warn">Rapor için geçerli bir dağıtım sonucu gerekir.</InfoCard>
      </div>
    );

  const exp = async (label: string, fn: () => void) => {
    const ok = await confirm({ title: `${label} indirilsin mi?`, body: "Rapor çalışan adlarını ve iş dağılımını içerir; yalnızca yetkili kişilerle paylaşın.", confirmLabel: "İndir" });
    if (!ok) return;
    fn();
    log("indirme", `Süreç raporu indirildi: ${label}`);
  };
  const printPdf = async () => {
    const ok = await confirm({ title: "PDF olarak kaydedilsin mi?", body: "Tarayıcının yazdırma penceresi açılır; hedef olarak \"PDF olarak kaydet\" seçin.", confirmLabel: "Yazdırma penceresini aç" });
    if (ok) setTimeout(() => window.print(), 100);
  };

  const t = rep.totals;
  const chartEmp = rep.perEmp.filter((p) => p.kapasite > 0).map((p) => ({ ad: p.id, doluluk: Math.round(p.doluluk * 100) }));
  const chartIl = rep.perIl.map((p) => ({ il: p.il, doluluk: Math.round(p.doluluk * 100) }));
  const csvs = reportCsvs(rep);
  const hhmm = (s: string) => new Date(s).toLocaleTimeString("tr-TR");

  return (
    <div>
      <ScreenTitle no={7} title="Süreç Raporu">
        <Button onClick={printPdf} data-testid="print-pdf">
          <Printer className="h-3.5 w-3.5" /> PDF
        </Button>
        <Button onClick={() => exp("rapor (HTML)", () => download("surec_raporu.html", reportHtml(rep, events), "text/html;charset=utf-8"))} data-testid="dl-html">
          <Download className="h-3.5 w-3.5" /> HTML
        </Button>
        <Button onClick={() => exp("rapor (JSON)", () => download("surec_raporu.json", JSON.stringify({ rapor: rep, olaylar: events }, null, 2), "application/json"))}>
          <Download className="h-3.5 w-3.5" /> JSON
        </Button>
        <Button variant="primary" onClick={() => go(8)} data-testid="to-summary">
          Genel özete geç <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </ScreenTitle>

      <div className="no-print mb-3">
        <Collapsible title="Bu rapor nasıl üretilir?">
          Rapor, süreç boyunca tutulan <b>olay günlüğünden</b> ve dağıtım sonucundan otomatik oluşur. Sürecin denetlenebilir ve tekrar anlatılabilir olması için her yükleme, ayar, kural, dağıtım,
          manuel değişiklik ve onay zaman damgasıyla kaydedilir. Rapor PDF (yazdırma), HTML veya JSON olarak indirilebilir; tablolar ayrıca CSV alınabilir.
        </Collapsible>
      </div>

      {!approved && (
        <div className="mb-3">
          <InfoCard tone="warn">Dağıtım henüz onaylanmadı; rapor mevcut durumu gösterir.</InfoCard>
        </div>
      )}

      <div className="space-y-3" id="rapor">
        <Card title="1. Süreç zaman çizelgesi" className="print-page">
          <ol className="space-y-1 text-[12.5px]" data-testid="timeline">
            {events.map((e) => (
              <li key={e.id} className="flex gap-3 border-b border-slate-100 pb-1">
                <span className="w-16 shrink-0 tabular-nums text-slate-500">{hhmm(e.ts)}</span>
                <span>{e.message}</span>
              </li>
            ))}
          </ol>
        </Card>

        <div className="grid gap-3 lg:grid-cols-2">
          <Card title="2. Girdi özeti" className="print-page">
            <T
              head={["Dosya", "Satır", "Hatalı / atlanan"]}
              rows={[
                [rep.files.emp?.name ?? "—", rep.files.emp?.total ?? 0, `${rep.files.emp?.errorRows ?? 0} hatalı · ${employees.filter((r) => !r.included).length} dışarıda`],
                [rep.files.job?.name ?? "—", rep.files.job?.total ?? 0, `${rep.files.job?.errorRows ?? 0} hatalı · ${jobs.filter((r) => !r.included).length} dışarıda`],
              ]}
            />
            {jobs.some((r) => r.errors.length) && (
              <ul className="mt-2 max-h-24 list-inside list-disc overflow-auto text-[12px] text-red-800">
                {jobs.filter((r) => r.errors.length).map((r) => (
                  <li key={r.rowNo}>
                    Satır {r.rowNo}: {r.errors.map((e) => `${e.col} ${e.msg}`).join("; ")}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="3. Kural ve kapasite özeti" className="print-page">
            <ul className="space-y-1 text-[12.5px]">
              {rules.rules.filter((r) => r.enabled).map((r, i) => (
                <li key={r.id} className="flex items-center gap-2">
                  <span className="w-4 text-slate-500">{i + 1}</span>
                  <Badge tone={r.mandatory ? "red" : "blue"}>{r.mandatory ? "zorunlu" : "tercih"}</Badge> {RULE_META[r.id].label}
                </li>
              ))}
            </ul>
            <div className="mt-2 text-[12.5px] text-slate-700">
              Mod: <b>{rules.kapasiteModu === "sert" ? "sert limit" : "orantılı hedef"}</b> · birim: <b>{rules.kapasiteBirimi}</b> · kır çarpanı: <b>{rules.kirCarpan}</b> · toplam efektif kapasite:{" "}
              <b>{t.efektifKapasite}</b>
            </div>
          </Card>
        </div>

        <Card title="4. Dağıtım sonuç metrikleri" className="print-page">
          <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-6">
            <Stat label="Toplam iş" value={t.toplamIs} />
            <Stat label="Atanan" value={t.atanan} sub={pct(t.toplamIs ? t.atanan / t.toplamIs : 0)} tone="green" />
            <Stat label="Atanamayan" value={t.atanamayan} sub={pct(t.toplamIs ? t.atanamayan / t.toplamIs : 0)} tone={t.atanamayan ? "red" : "green"} />
            <Stat label="Ort. doluluk" value={pct(rep.fill.avg)} />
            <Stat label="Min / maks" value={`${pct(rep.fill.min)} / ${pct(rep.fill.max)}`} />
            <Stat label="Std. sapma" value={`${(rep.fill.sd * 100).toFixed(1)} p`} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="mb-1 text-xs font-semibold text-slate-600">Çalışan doluluğu (%)</div>
              <div style={{ width: "100%", height: 200 }}>
                <ResponsiveContainer>
                  <BarChart data={chartEmp}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="ad" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} domain={[0, 110]} />
                    <Tooltip />
                    <ReferenceLine y={100} stroke="#C92830" strokeDasharray="4 2" />
                    <Bar dataKey="doluluk" fill="#1F2A44" isAnimationActive={false}>
                      {chartEmp.map((c, i) => (
                        <Cell key={i} fill={c.doluluk > 100 ? "#C92830" : "#1F2A44"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold text-slate-600">İl bazlı doluluk (%)</div>
              <div style={{ width: "100%", height: 200 }}>
                <ResponsiveContainer>
                  <BarChart data={chartIl}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="il" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} domain={[0, 110]} />
                    <Tooltip />
                    <Bar dataKey="doluluk" fill="#C92830" isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div>
              <div className="mb-1 text-xs font-semibold text-slate-600">Kural uyum oranları</div>
              <T head={["Kural", "Uyumlu", "Toplam", "Oran"]} rows={rep.uyum.map((u) => [u.label, u.ok, u.total, u.total ? pct(u.ok / u.total) : "—"])} />
            </div>
            <div className="text-[12.5px] text-slate-700">
              <div className="mb-1 text-xs font-semibold text-slate-600">Kır / kent ve geçen ay</div>
              <p>
                Kır işi: <b>{rep.kirKent.kir}</b> · Kent işi: <b>{rep.kirKent.kent}</b>
              </p>
              <p>
                Geçen ay çalışanı belli {rep.gecenAy.toplam} işten <b>{rep.gecenAy.ayni}</b> tanesi aynı kişide kaldı, <b>{rep.gecenAy.degisen}</b> tanesi değişti.
              </p>
              <p>
                Dağıtım süresi: {rep.durationMs} ms · yeniden dağıtım sayısı: {rep.redistCount}
              </p>
            </div>
          </div>
        </Card>

        <Card title="5. Atanamayan işler analizi" className="print-page">
          {rep.sebepler.length === 0 ? (
            <Badge tone="green">Atanamayan iş yok</Badge>
          ) : (
            <T head={["Sebep", "Adet", "İşler"]} rows={rep.sebepler.map((s) => [s.sebep, s.adet, s.ids.slice(0, 15).join(", ") + (s.ids.length > 15 ? " …" : "")])} />
          )}
        </Card>

        <Card title={`6. Manuel değişiklik günlüğü (${rep.manuel.length})`} className="print-page">
          {rep.manuel.length === 0 ? (
            <span className="text-[12.5px] text-slate-600">Manuel değişiklik yapılmadı.</span>
          ) : (
            <>
              <T head={["Saat", "Değişiklik"]} rows={rep.manuel.map((e) => [hhmm(e.ts), e.message])} />
              <div className="mt-1 text-[12px] text-slate-600">Manuel değişikliklerin toplam atanan içindeki payı: {pct(t.atanan ? t.manuelSayisi / t.atanan : 0)}</div>
            </>
          )}
        </Card>

        <Card
          title="7. Çalışan bazlı tablo"
          className="print-page"
          right={<Button size="sm" onClick={() => exp("calisan_bazli.csv", () => download("calisan_bazli.csv", csvs["calisan_bazli.csv"], "text/csv;charset=utf-8"))}>CSV</Button>}
        >
          <T
            head={["Çalışan", "Kapasite", "Atanan", "Doluluk", "Kır iş", "Kent iş", "Farklı mahalle"]}
            rows={rep.perEmp.map((p) => [`${p.id} · ${p.ad}`, p.kapasite, p.atanan, pct(p.doluluk), p.kir, p.kent, p.mahalle])}
          />
        </Card>

        <Card
          title="8. İl bazlı tablo"
          className="print-page"
          right={<Button size="sm" onClick={() => exp("il_bazli.csv", () => download("il_bazli.csv", csvs["il_bazli.csv"], "text/csv;charset=utf-8"))}>CSV</Button>}
        >
          <T head={["İl", "Toplam iş", "Atanan", "Çalışan", "Kapasite", "Doluluk"]} rows={rep.perIl.map((p) => [p.il, p.toplam, p.atanan, p.calisan, p.kapasite, pct(p.doluluk)])} />
        </Card>
      </div>

      <div className="no-print mt-3 flex items-center justify-between">
        <Button onClick={() => go(6)}>← Onay ve çıktı</Button>
        <Button
          onClick={async () => {
            const ok = await confirm({ title: "Yeni dağıtım başlatılsın mı?", body: "Mevcut oturumdaki tüm veriler ve sonuçlar silinecek. İndirmediğiniz çıktılar kaybolur.", confirmLabel: "Yeni dağıtım", tone: "danger" });
            if (ok) {
              useStore.getState().reset();
              go(1);
            }
          }}
        >
          Yeni dağıtım
        </Button>
      </div>
    </div>
  );
}
