"use client";
import { useMemo, useState } from "react";
import { Download, Save, Settings2, FileUp, ArrowRight } from "lucide-react";
import { useConfirm, Modal } from "@/components/confirm";
import { DataTable, type Col, type TRow } from "@/components/DataTable";
import { FileDrop } from "@/components/FileDrop";
import { Badge, Button, Card, Collapsible, Field, InfoCard, ScreenTitle, Stat, inputCls } from "@/components/ui";
import { parseEmployees, revalidateEmployee, toCsv, yesNo, EMP_COLS } from "@/lib/csv";
import { effCap, round1 } from "@/lib/engine";
import { activeEmployees, saveSet, useStore } from "@/lib/store";
import { download } from "@/lib/share";
import type { EmpRow, Employee } from "@/lib/types";

export default function Screen1() {
  const confirm = useConfirm();
  const { employees, empFile, empConfirmed, rules, setEmployees, patchEmployees, setEmpConfirmed, go, log } = useStore();
  const [bulk, setBulk] = useState(false);
  const [err, setErr] = useState("");

  const onText = async (text: string, name: string) => {
    const r = parseEmployees(text);
    if (r.fatal) {
      setErr(r.fatal);
      return;
    }
    setErr("");
    const bad = r.rows.filter((x) => x.errors.length).length;
    if (employees.length) {
      const ok = await confirm({ title: "Mevcut personel listesi değiştirilsin mi?", body: "Yüklenmiş personel ve yaptığınız kapasite düzenlemeleri yeni dosyayla değişecek.", confirmLabel: "Değiştir", tone: "danger" });
      if (!ok) return;
    }
    setEmployees(r.rows, { name, total: r.rows.length, errorRows: bad, at: new Date().toISOString() });
    log("personel_yuklendi", `Personel dosyası yüklendi: ${name} (${r.rows.length} satır, ${bad} hatalı)`, { dosya: name, satir: r.rows.length, hatali: bad });
  };

  const loadSample = async () => {
    const t = await (await fetch("/ornek/calisanlar.csv")).text();
    onText(t, "calisanlar.csv (örnek)");
  };

  const toggle = (id: number) => patchEmployees((rs) => rs.map((r) => (r.rowNo === id ? (r.errors.length && !r.included ? r : { ...r, included: !r.included }) : r)));
  const toggleAll = (c: boolean, ids: number[]) => {
    const s = new Set(ids);
    patchEmployees((rs) => rs.map((r) => (s.has(r.rowNo) && (!c || r.errors.length === 0) ? { ...r, included: c } : r)));
  };

  const edit = (id: number, key: string, value: string | boolean) => {
    const row = employees.find((r) => r.rowNo === id);
    if (!row) return;
    const d: Employee = { ...row.data };
    if (key === "donemlik_kapasite" || key === "musait_oran") (d as Record<string, unknown>)[key] = Number(String(value).replace(",", ".")) || 0;
    else (d as Record<string, unknown>)[key] = value;
    const errors = revalidateEmployee(d);
    patchEmployees((rs) => rs.map((r) => (r.rowNo === id ? { ...r, data: d, errors, included: r.included && errors.length === 0 } : r)));
    if (key === "donemlik_kapasite" || key === "musait_oran" || key === "aktif" || key === "kir_gorevi_yapabilir")
      log("kapasite_degisti", `${d.calisan_id}: ${key} → ${typeof value === "boolean" ? yesNo(value) : value} (tek tek düzenleme)`, { calisan: d.calisan_id, alan: key });
  };

  const rows: TRow[] = employees.map((r) => ({
    id: r.rowNo,
    cells: { ...r.data, efektif: round1(effCap(r.data)) },
    errors: r.errors,
    checked: r.included,
    dim: !r.included,
  }));

  const cols: Col[] = [
    { key: "calisan_id", label: "calisan_id", width: 90 },
    { key: "ad_soyad", label: "ad_soyad", width: 140 },
    { key: "rol", label: "rol", width: 80 },
    { key: "il", label: "il", width: 90 },
    { key: "ilce", label: "ilce", width: 90 },
    { key: "donemlik_kapasite", label: "donemlik_kapasite", type: "num", editable: true, width: 120 },
    { key: "musait_oran", label: "musait_oran %", type: "num", editable: true, width: 100 },
    { key: "efektif", label: "efektif kapasite", type: "num", width: 100 },
    { key: "kir_gorevi_yapabilir", label: "kır görevi", type: "bool", editable: true, width: 80 },
    { key: "aktif", label: "aktif", type: "bool", editable: true, width: 60 },
    { key: "kapasite_notu", label: "kapasite_notu", editable: true, width: 200 },
  ];

  const act = useMemo(() => activeEmployees(employees), [employees]);
  const activeOnes = useMemo(() => act.filter((e) => e.aktif), [act]);
  const total = activeOnes.reduce((s, e) => s + effCap(e), 0);
  const byIl = useMemo(() => {
    const m = new Map<string, { n: number; cap: number }>();
    for (const e of activeOnes) {
      const x = m.get(e.il) ?? { n: 0, cap: 0 };
      x.n++;
      x.cap += effCap(e);
      m.set(e.il, x);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], "tr"));
  }, [activeOnes]);

  const warnings: string[] = [];
  for (const e of act) {
    if (e.aktif && effCap(e) === 0) warnings.push(`${e.calisan_id} (${e.ad_soyad}): efektif kapasite 0`);
    else if (e.donemlik_kapasite > 100) warnings.push(`${e.calisan_id}: kapasite ${e.donemlik_kapasite} sıra dışı yüksek`);
  }
  const caps = act.map((e) => e.donemlik_kapasite).filter((x) => x > 0);
  if (caps.length > 3) {
    const mean = caps.reduce((a, b) => a + b, 0) / caps.length;
    for (const e of act) if (e.donemlik_kapasite > mean * 2.5) warnings.push(`${e.calisan_id}: kapasite ortalamanın (${Math.round(mean)}) çok üzerinde`);
  }

  const exportCsv = async () => {
    const ok = await confirm({ title: "Personel listesi indirilsin mi?", body: "Seçili satırlar güncel kapasite ayarlarıyla calisanlar.csv olarak indirilecek. Dosya çalışan adlarını içerir; yalnızca yetkili kişilerle paylaşın.", confirmLabel: "İndir" });
    if (!ok) return;
    download("calisanlar.csv", toCsv(employees.filter((r) => r.included).map((r) => ({ ...r.data, kir_gorevi_yapabilir: yesNo(r.data.kir_gorevi_yapabilir), aktif: yesNo(r.data.aktif) })), EMP_COLS), "text/csv;charset=utf-8");
    log("indirme", "Güncel personel listesi (calisanlar.csv) dışa aktarıldı");
  };

  const save = async () => {
    const ok = await confirm({ title: "Set kaydedilsin mi?", body: "Personel, kapasite ayarları ve kural seti bu tarayıcıda saklanır; sonraki dönemde Karşılama ekranından yüklenebilir. Mevcut kayıtlı set üzerine yazılır.", confirmLabel: "Kaydet" });
    if (!ok) return;
    saveSet({ employees, rules, savedAt: new Date().toISOString() });
    log("oturum", "Personel ve kapasite seti tarayıcıya kaydedildi");
  };

  const next = async () => {
    const noIl = act.length === 0;
    if (noIl) return;
    const ok = await confirm({
      title: "Personel ve kapasite ayarları onaylansın mı?",
      body: (
        <>
          <b>{act.length}</b> satır kullanılacak, <b>{activeOnes.length}</b> aktif çalışan, toplam efektif kapasite <b>{round1(total)}</b>. Onaydan sonra kural seçimine geçilir.
        </>
      ),
      confirmLabel: "Onayla ve devam et",
    });
    if (!ok) return;
    setEmpConfirmed(true);
    log("personel_onaylandi", `Personel ve kapasite ayarları onaylandı (${act.length} satır, kapasite ${round1(total)})`, { aktif: activeOnes.length, kapasite: round1(total) });
    go(2);
  };

  return (
    <div>
      <ScreenTitle no={1} title="Personel Yükleme ve Kapasite Ayarı">
        <Button onClick={loadSample} data-testid="load-sample-emp">
          <FileUp className="h-3.5 w-3.5" /> Örnek veri yükle
        </Button>
      </ScreenTitle>

      <div className="mb-3 space-y-2">
        <Collapsible title="Bu ekranda ne yapılır?">
          <ul className="list-inside list-disc space-y-0.5">
            <li>
              <b>calisanlar.csv</b> yüklenir; tablo MS Excel görünümünde önizlenir. Satır başındaki kutu, o çalışanın dağıtımda <b>kullanılıp kullanılmayacağını</b> belirler.
            </li>
            <li>Kapasite, müsaitlik %, kır görevi, aktif ve not alanları hücre içinde düzenlenir (Enter ile onaylanır).</li>
            <li>
              <b>Efektif kapasite = dönemlik kapasite × müsaitlik oranı</b>. Örnek: 30 kapasite, %50 müsaitlik → 15.
            </li>
            <li>Hatalı satırlar kırmızı işaretlenir ve varsayılan olarak seçili gelmez.</li>
          </ul>
        </Collapsible>
      </div>

      {err && (
        <div className="mb-3">
          <InfoCard tone="error" title="Dosya okunamadı">
            {err}
          </InfoCard>
        </div>
      )}

      {employees.length === 0 ? (
        <FileDrop onText={onText} label="calisanlar.csv dosyasını sürükleyin veya seçin" />
      ) : (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-5">
            <Stat label="Seçili satır" value={act.length} sub={`toplam ${employees.length}`} />
            <Stat label="Aktif çalışan" value={activeOnes.length} />
            <Stat label="Toplam efektif kapasite" value={round1(total)} />
            <Stat label="İl sayısı" value={byIl.length} />
            <Stat label="Hatalı satır" value={employees.filter((r) => r.errors.length).length} tone={employees.some((r) => r.errors.length) ? "red" : "green"} />
          </div>

          <div className="mb-3 grid gap-3 lg:grid-cols-3">
            <Card title="İl bazında kapasite dağılımı" className="lg:col-span-2">
              <div className="flex flex-wrap gap-2">
                {byIl.map(([il, x]) => (
                  <div key={il} className="rounded border border-slate-200 px-2.5 py-1.5">
                    <div className="text-xs font-semibold text-[#1F2A44]">{il}</div>
                    <div className="text-[11.5px] text-slate-600">
                      {x.n} çalışan · kapasite {round1(x.cap)}
                    </div>
                  </div>
                ))}
                {byIl.length === 0 && <span className="text-slate-500">Seçili aktif çalışan yok.</span>}
              </div>
            </Card>
            <Card title="Uyarılar">
              {warnings.length === 0 && !employees.some((r) => r.errors.length) ? (
                <Badge tone="green">Uyarı yok</Badge>
              ) : (
                <ul className="max-h-24 list-inside list-disc space-y-0.5 overflow-auto text-[12px] text-amber-900">
                  {employees.filter((r) => r.errors.length).map((r) => (
                    <li key={r.rowNo} className="text-red-800">
                      Satır {r.rowNo}: {r.errors.map((e) => `${e.col} ${e.msg}`).join("; ")}
                    </li>
                  ))}
                  {warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <DataTable
            sheetName={empFile?.name ?? "calisanlar.csv"}
            columns={cols}
            rows={rows}
            onToggle={toggle}
            onToggleAll={toggleAll}
            onEdit={edit}
            height={380}
            toolbar={
              <>
                <Button size="sm" onClick={() => setBulk(true)} data-testid="bulk-open">
                  <Settings2 className="h-3.5 w-3.5" /> Toplu işlem
                </Button>
                <Button size="sm" onClick={exportCsv}>
                  <Download className="h-3.5 w-3.5" /> CSV dışa aktar
                </Button>
                <Button size="sm" onClick={save}>
                  <Save className="h-3.5 w-3.5" /> Seti kaydet
                </Button>
              </>
            }
          />
        </>
      )}

      {employees.length > 0 && (
        <div className="mt-3 flex items-center justify-between">
          <Button onClick={() => go(0)}>← Karşılama</Button>
          <div className="flex items-center gap-2">
            {empConfirmed && <Badge tone="green">Onaylandı</Badge>}
            <Button variant="primary" onClick={next} disabled={act.length === 0} data-testid="emp-next">
              Onayla ve kurallara geç <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      <BulkModal open={bulk} onClose={() => setBulk(false)} rows={employees} />
    </div>
  );
}

function BulkModal({ open, onClose, rows }: { open: boolean; onClose: () => void; rows: EmpRow[] }) {
  const confirm = useConfirm();
  const { patchEmployees, log } = useStore();
  const [scope, setScope] = useState("secili");
  const [value, setValue] = useState("");
  const [field, setField] = useState<"donemlik_kapasite" | "musait_oran">("donemlik_kapasite");
  const [op, setOp] = useState<"set" | "inc" | "dec">("set");
  const iller = [...new Set(rows.map((r) => r.data.il))].sort((a, b) => a.localeCompare(b, "tr"));
  const roller = [...new Set(rows.map((r) => r.data.rol).filter(Boolean))];

  const match = (r: EmpRow) => {
    if (scope === "secili") return r.included;
    if (scope === "tumu") return true;
    if (scope.startsWith("il:")) return r.data.il === scope.slice(3) && r.included;
    if (scope.startsWith("rol:")) return r.data.rol === scope.slice(4) && r.included;
    return false;
  };
  const n = rows.filter(match).length;
  const num = Number(value.replace(",", "."));
  const valid = value !== "" && Number.isFinite(num) && num >= 0;

  const apply = async () => {
    const lbl = field === "donemlik_kapasite" ? "dönemlik kapasite" : "müsaitlik oranı";
    const opLbl = op === "set" ? `${num} olarak ayarlanacak` : op === "inc" ? `%${num} artırılacak` : `%${num} azaltılacak`;
    const ok = await confirm({ title: "Toplu işlem uygulansın mı?", body: <>{n} çalışanın {lbl} değeri {opLbl}.</>, confirmLabel: "Uygula" });
    if (!ok) return;
    patchEmployees((rs) =>
      rs.map((r) => {
        if (!match(r)) return r;
        const cur = r.data[field];
        let v = op === "set" ? num : op === "inc" ? cur * (1 + num / 100) : cur * (1 - num / 100);
        v = Math.max(0, Math.round(v * 10) / 10);
        if (field === "musait_oran") v = Math.min(100, v);
        const d = { ...r.data, [field]: v };
        const errors = revalidateEmployee(d);
        return { ...r, data: d, errors };
      }),
    );
    log("kapasite_degisti", `Toplu işlem: ${n} çalışan, ${lbl} ${opLbl} (kapsam: ${scope})`, { kisi: n, alan: field, islem: op, deger: num, kapsam: scope });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Toplu kapasite işlemi"
      footer={
        <>
          <Button onClick={onClose}>Vazgeç</Button>
          <Button variant="primary" disabled={!valid || n === 0} onClick={apply} data-testid="bulk-apply">
            Uygula ({n} kişi)
          </Button>
        </>
      }
    >
      <div className="space-y-2.5">
        <Field label="Kapsam">
          <select className={inputCls} value={scope} onChange={(e) => setScope(e.target.value)} aria-label="Kapsam">
            <option value="secili">Seçili satırlar</option>
            <option value="tumu">Tüm satırlar</option>
            {iller.map((i) => (
              <option key={i} value={`il:${i}`}>
                İl: {i}
              </option>
            ))}
            {roller.map((i) => (
              <option key={i} value={`rol:${i}`}>
                Rol: {i}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Alan">
          <select className={inputCls} value={field} onChange={(e) => setField(e.target.value as typeof field)} aria-label="Alan">
            <option value="donemlik_kapasite">Dönemlik kapasite</option>
            <option value="musait_oran">Müsaitlik oranı (%)</option>
          </select>
        </Field>
        <Field label="İşlem">
          <select className={inputCls} value={op} onChange={(e) => setOp(e.target.value as typeof op)} aria-label="İşlem">
            <option value="set">Aynı değeri ata</option>
            <option value="inc">Yüzde olarak artır</option>
            <option value="dec">Yüzde olarak azalt</option>
          </select>
        </Field>
        <Field label={op === "set" ? "Değer" : "Yüzde (%)"} hint="Sayı girin; ondalık için virgül veya nokta.">
          <input className={inputCls} value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" aria-label="Değer" data-testid="bulk-value" />
        </Field>
        <InfoCard>Bu işlem {n} satırı etkiler. Uygulamadan önce onayınız istenecek.</InfoCard>
      </div>
    </Modal>
  );
}
