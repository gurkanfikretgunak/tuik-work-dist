"use client";
import { Clipboard, Download, Mail, Printer } from "lucide-react";
import { useMemo, useState } from "react";
import { useConfirm } from "@/components/confirm";
import { Badge, Button, Card, Collapsible, Field, InfoCard, ScreenTitle, Stat, inputCls } from "@/components/ui";
import { toCsv } from "@/lib/csv";
import { reportCsvs, reportHtml, ruleJson, summaryText } from "@/lib/outputs";
import { buildReport } from "@/lib/report";
import { JOB_ALL_COLS, RESULT_COLS_EXTRA, SHARE_COLS, download, employeeShareCsv, employeeZipFiles, fillTemplate, ilShareCsv, resultRows, unassignedRows, zipBlob } from "@/lib/share";
import { activeEmployees, activeJobs, useStore } from "@/lib/store";

const TEMPLATES = {
  calisan: {
    label: "Çalışana: işleriniz hazır",
    subject: "İş listeniz hazır",
    body: "Merhaba {ad_soyad},\n\n{il} ilinde size atanan {is_sayisi} işe ait liste ekte yer almaktadır. İşleri {son_tarih} tarihine kadar tamamlamanızı rica ederiz.\n\nİyi çalışmalar.",
  },
  il: {
    label: "İl sorumlusuna: özet",
    subject: "{il} ili iş dağıtım özeti",
    body: "Merhaba,\n\n{il} ili için dağıtım tamamlandı: toplam {is_sayisi} iş çalışanlara atanmıştır. Ayrıntılı liste ekte yer almaktadır. Son tarih: {son_tarih}.\n\nİyi çalışmalar.",
  },
  yonetici: {
    label: "Yöneticiye: genel özet",
    subject: "İş dağıtımı genel özeti",
    body: "Merhaba,\n\nİş dağıtımı tamamlanmıştır.\n\n{ozet}\n\nİyi çalışmalar.",
  },
} as const;

export default function Screen8() {
  const confirm = useConfirm();
  const { employees, jobs, rules, result, events, empFile, jobFile, log, go } = useStore();
  const emps = useMemo(() => activeEmployees(employees), [employees]);
  const js = useMemo(() => activeJobs(jobs), [jobs]);
  const rep = useMemo(() => (result ? buildReport({ employees, jobs, rules, result, events, empFile, jobFile }) : null), [employees, jobs, rules, result, events, empFile, jobFile]);

  const [empSel, setEmpSel] = useState("");
  const [tplKey, setTplKey] = useState<keyof typeof TEMPLATES>("calisan");
  const [subject, setSubject] = useState<string>(TEMPLATES.calisan.subject);
  const [body, setBody] = useState<string>(TEMPLATES.calisan.body);
  const [recipient, setRecipient] = useState("");
  const [deadline, setDeadline] = useState("");
  const [copied, setCopied] = useState("");

  if (!result || !rep)
    return (
      <div>
        <ScreenTitle no={8} title="Genel Özet ve Paylaşım Yardımcıları" />
        <InfoCard tone="warn">Önce bir dağıtım sonucu gerekir.</InfoCard>
      </div>
    );
  const A = result.assignments;
  const t = rep.totals;
  const working = emps.filter((e) => A.some((a) => a.empId === e.calisan_id));
  const iller = rep.perIl.filter((p) => p.atanan > 0).map((p) => p.il);
  const selEmp = working.find((e) => e.calisan_id === (empSel || working[0]?.calisan_id));
  const selCsv = selEmp ? employeeShareCsv(selEmp.calisan_id, js, A) : "";
  const selJobs = selEmp ? js.filter((j) => A.some((a) => a.jobId === j.is_id && a.empId === selEmp.calisan_id)) : [];

  const warnList: string[] = [];
  if (t.atanamayan) warnList.push(`${t.atanamayan} iş atanamadı`);
  rep.perEmp.filter((p) => p.doluluk > 0.95).forEach((p) => warnList.push(`${p.ad}: %${Math.round(p.doluluk * 100)} dolu (aşırı dolu)`));
  rep.perEmp.filter((p) => p.kapasite > 0 && p.doluluk < 0.5).forEach((p) => warnList.push(`${p.ad}: %${Math.round(p.doluluk * 100)} dolu (çok boş)`));
  A.filter((a) => a.uyari).forEach((a) => warnList.push(`${a.jobId}: ${a.uyari}`));

  const guard = async (what: string, contents: string[]) =>
    confirm({
      title: "Paylaşım öncesi: bu dosya hangi bilgileri içeriyor?",
      body: (
        <>
          <p className="font-medium">{what}</p>
          <ul className="my-1 list-inside list-disc">
            {contents.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <p className="text-slate-600">Dosyalar tarayıcıda üretilir, sunucuya gönderilmez. Yalnızca ilgili kişilerle paylaşın.</p>
        </>
      ),
      confirmLabel: "İndir",
    });

  const dlEmployeeZip = async () => {
    const files = employeeZipFiles(emps, js, A);
    if (!(await guard(`${Object.keys(files).length} çalışan için ayrı iş listesi (ZIP)`, ["Yalnızca ilgili çalışanın kendi işleri", "İl, ilçe, mahalle, yerleşim tipi, birim/hane no, görüşme sayısı, öncelik, anket türü", "Önceki ay çalışan bilgisi ve başka çalışanın işleri YOKTUR"]))) return;
    download("calisan_is_listeleri.zip", await zipBlob(files), "application/zip");
    log("indirme", `Çalışan bazlı iş listeleri indirildi (${Object.keys(files).length} dosya)`);
  };
  const dlOne = async () => {
    if (!selEmp) return;
    if (!(await guard(`${selEmp.calisan_id}_is_listesi.csv`, [`${selJobs.length} iş (yalnızca ${selEmp.ad_soyad} için)`, "Birim/hane numarası; kişi adı yok"]))) return;
    download(`${selEmp.calisan_id}_is_listesi.csv`, selCsv, "text/csv;charset=utf-8");
    log("indirme", `${selEmp.calisan_id} iş listesi indirildi`);
  };
  const dlIlZip = async () => {
    const files: Record<string, string> = {};
    for (const il of iller) {
      files[`${il}_is_listesi.csv`] = ilShareCsv(il, js, A, emps);
      const p = rep.perIl.find((x) => x.il === il)!;
      files[`${il}_ozet.txt`] = `${il} ili özeti\nToplam iş: ${p.toplam}\nAtanan: ${p.atanan}\nÇalışan: ${p.calisan}\nKapasite: ${p.kapasite}\nDoluluk: %${Math.round(p.doluluk * 100)}\n`;
    }
    if (!(await guard(`${iller.length} il için paket (ZIP)`, ["Her il için iş listesi + atanan çalışan adı/ID", "Özet sayfası (iş, çalışan, kapasite, doluluk)"]))) return;
    download("il_paketleri.zip", await zipBlob(files), "application/zip");
    log("indirme", `İl bazlı paketler indirildi (${iller.length} il)`);
  };
  const dlAll = async () => {
    const files: Record<string, string> = {
      "atama_sonucu.csv": toCsv(resultRows(js, A, emps), [...JOB_ALL_COLS, ...RESULT_COLS_EXTRA]),
      "kural_ozeti.json": ruleJson(employees, rules),
      "surec_raporu.html": reportHtml(rep, events),
      "surec_raporu.json": JSON.stringify({ rapor: rep, olaylar: events }, null, 2),
      ...reportCsvs(rep),
    };
    if (t.atanamayan) files["atanamayan_isler.csv"] = toCsv(unassignedRows(js, A), [...JOB_ALL_COLS, "sebep"]);
    if (!(await guard("Tüm çıktılar (tek ZIP)", ["Atama sonucu (çalışan adları dahil)", "Atanamayan işler, süreç raporu, kural ve kapasite özeti", "Kural/kapasite dosyası çalışan bilgileri içerir"]))) return;
    download("tum_ciktilar.zip", await zipBlob(files), "application/zip");
    log("indirme", "Tüm çıktılar tek ZIP olarak indirildi");
  };
  const dlRuleSet = async () => {
    if (!(await guard("Kural ve kapasite seti (JSON)", ["Kurallar, parametreler", "Çalışan listesi ve kapasite ayarları (ad-soyad dahil)"]))) return;
    download("kural_kapasite_seti.json", ruleJson(employees, rules), "application/json");
    log("indirme", "Kural ve kapasite seti paylaşım için dışa aktarıldı");
  };
  const dlSummaryPdf = async () => {
    if (await confirm({ title: "Özet yazdırılsın / PDF kaydedilsin mi?", body: "Tarayıcı yazdırma penceresi açılır; PDF için \"PDF olarak kaydet\" seçin.", confirmLabel: "Aç" })) setTimeout(() => window.print(), 100);
  };

  const copy = async (text: string, id: string) => {
    const ok = await confirm({ title: "Panoya kopyalansın mı?", body: <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-2 text-xs">{text}</pre>, confirmLabel: "Kopyala" });
    if (!ok) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      await confirm({ title: "Kopyalanamadı", body: "Tarayıcı pano erişimine izin vermedi. Metni elle seçip kopyalayın.", infoOnly: true, confirmLabel: "Tamam" });
    }
  };

  // şablon değerleri
  const rcpt = tplKey === "calisan" ? working.find((e) => e.calisan_id === (recipient || working[0]?.calisan_id)) : undefined;
  const rcptIl = tplKey === "il" ? recipient || iller[0] : rcpt?.il;
  const vars = {
    ad_soyad: rcpt?.ad_soyad ?? "",
    is_sayisi: tplKey === "calisan" ? A.filter((a) => a.empId === rcpt?.calisan_id).length : A.filter((a) => a.empId && js.find((j) => j.is_id === a.jobId)?.il === rcptIl).length,
    il: rcptIl ?? "",
    son_tarih: deadline ? new Date(deadline).toLocaleDateString("tr-TR") : "{son_tarih}",
    ozet: summaryText(rep),
  };
  const filledBody = fillTemplate(body, vars);
  const filledSubject = fillTemplate(subject, vars);
  const mailto = `mailto:?subject=${encodeURIComponent(filledSubject)}&body=${encodeURIComponent(filledBody)}`;

  const pickTpl = (k: keyof typeof TEMPLATES) => {
    setTplKey(k);
    setSubject(TEMPLATES[k].subject);
    setBody(TEMPLATES[k].body);
    setRecipient("");
  };

  return (
    <div>
      <ScreenTitle no={8} title="Genel Özet ve Paylaşım Yardımcıları">
        <Button variant="primary" onClick={dlAll} data-testid="dl-zip-all">
          <Download className="h-3.5 w-3.5" /> Tümünü indir (ZIP)
        </Button>
      </ScreenTitle>

      <div className="no-print mb-3 space-y-2">
        <Collapsible title="Paylaşım nasıl çalışır?">
          Uygulama girişsiz ve sunucusuz çalıştığı için hiçbir mesaj göndermez. Dosyalar tarayıcıda üretilir; siz indirip kendi kanalınızla iletirsiniz. E-posta taslağı için <code>mailto:</code> bağlantısı
          e-posta uygulamanızı konu ve gövde dolu olarak açar (ek dosyayı elle eklersiniz).
        </Collapsible>
        <InfoCard tone="warn" title="KVKK ve güvenlik">
          Çalışana giden listede başka çalışanların işleri bulunmaz; işlerde kişi adı yerine yalnızca birim/hane numarası kullanılır. Her indirmeden önce &quot;bu dosya hangi bilgileri içeriyor&quot; uyarısı gösterilir.
        </InfoCard>
      </div>

      <Card title="A. Genel özet" right={<>
        <Button size="sm" onClick={dlSummaryPdf}>
          <Printer className="h-3.5 w-3.5" /> Yazdır / PDF
        </Button>
        <Button size="sm" onClick={() => copy(summaryText(rep), "ozet")} data-testid="copy-summary">
          <Clipboard className="h-3.5 w-3.5" /> {copied === "ozet" ? "Kopyalandı" : "Metni kopyala"}
        </Button>
      </>} className="print-page mb-3">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
          <Stat label="Toplam iş" value={t.toplamIs} />
          <Stat label="Atanan" value={t.atanan} tone="green" />
          <Stat label="Atanamayan" value={t.atanamayan} tone={t.atanamayan ? "red" : "green"} />
          <Stat label="Çalışan" value={t.calisan} />
          <Stat label="Ort. doluluk" value={`%${Math.round(rep.fill.avg * 100)}`} />
          <Stat label="İl" value={t.il} />
        </div>
        <div className="mt-3">
          <div className="mb-1 text-xs font-semibold text-slate-600">Dikkat gerektiren noktalar</div>
          {warnList.length === 0 ? <Badge tone="green">Özel bir uyarı yok</Badge> : <ul className="list-inside list-disc text-[12.5px] text-amber-900">{warnList.slice(0, 12).map((w, i) => <li key={i}>{w}</li>)}</ul>}
        </div>
      </Card>

      <div className="no-print">
        <h2 className="mb-2 text-sm font-semibold text-[#1F2A44]">B. Paylaşım yardımcıları</h2>
        <div className="grid gap-3 lg:grid-cols-2">
          <Card title="1. Çalışan bazlı iş listeleri" right={<Button size="sm" onClick={dlEmployeeZip} data-testid="dl-emp-zip"><Download className="h-3.5 w-3.5" /> ZIP</Button>}>
            <p className="mb-2 text-[12px] text-slate-600">Her çalışan için yalnızca kendi işlerini içeren ayrı CSV (örn. <code>C-003_is_listesi.csv</code>). Aşağıda tek çalışanın listesi önizlenir.</p>
            <Field label="Çalışan">
              <select className={inputCls} value={selEmp?.calisan_id ?? ""} onChange={(e) => setEmpSel(e.target.value)} aria-label="Önizlenecek çalışan">
                {working.map((e) => <option key={e.calisan_id} value={e.calisan_id}>{e.calisan_id} · {e.ad_soyad} ({A.filter((a) => a.empId === e.calisan_id).length} iş)</option>)}
              </select>
            </Field>
            <div className="mt-2 max-h-44 overflow-auto rounded border border-slate-200">
              <table className="w-full text-[12px]" data-testid="emp-preview">
                <thead className="sticky top-0 bg-slate-50 text-left"><tr>{SHARE_COLS.map((c) => <th key={c} className="px-1.5 py-1">{c}</th>)}</tr></thead>
                <tbody>{selJobs.map((j) => <tr key={j.is_id} className="border-t border-slate-100">{SHARE_COLS.map((c) => <td key={c} className="px-1.5 py-0.5 whitespace-nowrap">{String(j[c])}</td>)}</tr>)}</tbody>
              </table>
            </div>
            <div className="mt-2 flex gap-2">
              <Button size="sm" onClick={dlOne}><Download className="h-3.5 w-3.5" /> Bu çalışanın CSV&apos;si</Button>
              <Button size="sm" onClick={async () => { if (await confirm({ title: "Liste yazdırılsın mı?", body: "Tarayıcının yazdırma penceresi açılır.", confirmLabel: "Yazdır" })) setTimeout(() => window.print(), 100); }}><Printer className="h-3.5 w-3.5" /> Yazdır</Button>
            </div>
          </Card>

          <div className="space-y-3">
            <Card title="2. İl / bölge bazlı paketler" right={<Button size="sm" onClick={dlIlZip} data-testid="dl-il-zip"><Download className="h-3.5 w-3.5" /> ZIP</Button>}>
              <p className="text-[12px] text-slate-600">Her il için ayrı CSV ve özet sayfası, il sorumlusuna iletilmek üzere. {iller.length} il: {iller.join(", ")}.</p>
            </Card>
            <Card title="4. Dışa aktarma paketi" right={<Button size="sm" onClick={dlAll}><Download className="h-3.5 w-3.5" /> ZIP</Button>}>
              <p className="text-[12px] text-slate-600">Atama sonucu, atanamayanlar, süreç raporu (HTML/JSON/CSV) ve kural özeti tek ZIP içinde.</p>
            </Card>
            <Card title="5. Kural ve kapasite seti paylaşımı" right={<Button size="sm" onClick={dlRuleSet}><Download className="h-3.5 w-3.5" /> JSON</Button>}>
              <p className="text-[12px] text-slate-600">Aynı ayarlarla başka bir kullanıcının dağıtım yapabilmesi için kural ve kapasite dosyası.</p>
            </Card>
          </div>
        </div>

        <Card title="3. Mesaj ve e-posta taslakları" className="mt-3">
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="space-y-2">
              <Field label="Şablon">
                <select className={inputCls} value={tplKey} onChange={(e) => pickTpl(e.target.value as keyof typeof TEMPLATES)} aria-label="Şablon">
                  {Object.entries(TEMPLATES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </Field>
              {tplKey !== "yonetici" && (
                <Field label={tplKey === "calisan" ? "Alıcı çalışan" : "İl"}>
                  <select className={inputCls} value={recipient} onChange={(e) => setRecipient(e.target.value)} aria-label="Alıcı">
                    {tplKey === "calisan" ? working.map((e) => <option key={e.calisan_id} value={e.calisan_id}>{e.ad_soyad}</option>) : iller.map((i) => <option key={i}>{i}</option>)}
                  </select>
                </Field>
              )}
              <Field label="Son tarih">
                <input type="date" className={inputCls} value={deadline} onChange={(e) => setDeadline(e.target.value)} aria-label="Son tarih" />
              </Field>
              <Field label="Konu (düzenlenebilir)"><input className={inputCls} value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Konu" /></Field>
              <Field label="Gövde (düzenlenebilir)" hint="Yer tutucular: {ad_soyad} {is_sayisi} {il} {son_tarih} {ozet}">
                <textarea className={`${inputCls} h-36 py-1`} value={body} onChange={(e) => setBody(e.target.value)} aria-label="Gövde" />
              </Field>
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold text-slate-600">Önizleme</div>
              <div className="rounded border border-slate-200 bg-slate-50 p-3 text-[12.5px]" data-testid="mail-preview">
                <div className="mb-1 font-semibold">{filledSubject}</div>
                <pre className="whitespace-pre-wrap font-sans">{filledBody}</pre>
              </div>
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={() => copy(`${filledSubject}\n\n${filledBody}`, "mesaj")} data-testid="copy-msg"><Clipboard className="h-3.5 w-3.5" /> {copied === "mesaj" ? "Kopyalandı" : "Panoya kopyala"}</Button>
                <Button size="sm" onClick={async () => { if (await confirm({ title: "E-posta uygulaması açılsın mı?", body: "Konu ve gövde dolu olarak varsayılan e-posta uygulamanız açılır. Ek dosyayı elle eklemeniz gerekir.", confirmLabel: "Aç" })) window.location.href = mailto; }} data-testid="mailto"><Mail className="h-3.5 w-3.5" /> E-posta aç</Button>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="no-print mt-3 flex items-center justify-between">
        <Button onClick={() => go(7)}>← Süreç raporu</Button>
        <div className="flex gap-2">
          <Button onClick={() => go(0)}>Başa dön</Button>
          <Button onClick={async () => { if (await confirm({ title: "Yeni dağıtım başlatılsın mı?", body: "Mevcut oturumdaki tüm veriler silinecek.", confirmLabel: "Yeni dağıtım", tone: "danger" })) { useStore.getState().reset(); go(1); } }}>Yeni dağıtım</Button>
        </div>
      </div>
    </div>
  );
}
