"use client";
import { useMemo, useState } from "react";
import { useConfirm } from "@/components/confirm";
import { DataTable, type Col, type TRow } from "@/components/DataTable";
import { FileDrop } from "@/components/FileDrop";
import { Badge, Button, Card, Collapsible, Field, InfoCard, Stat, inputCls } from "@/components/ui";
import { parseLeaveCsv, planWindow, validateLeave } from "./leave";
import { calcTargets } from "./math";
import { absenceOf } from "./params";
import { MONTHS, useRot } from "./store";

const r1 = (x: number) => Math.round(x * 10) / 10;

export default function LeaveSection() {
  const confirm = useConfirm();
  const s = useRot();
  const { people, leaves, m, startMonth, year } = s;
  const [form, setForm] = useState({ p: people[0]?.id ?? "", a: "", b: "", note: "" });
  const [fatal, setFatal] = useState("");
  const ids = people.map((p) => p.id);
  const [w0, w1] = planWindow(startMonth, year, m);
  const ab = useMemo(() => absenceOf(s), [s.leaves, s.people, s.startMonth, s.year, s.m, s.leaveThreshold]); // eslint-disable-line react-hooks/exhaustive-deps
  const T = useMemo(() => calcTargets(s.n, m, ab.absent, s.strategy), [s.n, m, ab, s.strategy]);

  const nextId = () => Math.max(0, ...leaves.map((l) => l.id)) + 1;
  const add = () => {
    const l = { id: nextId(), personId: form.p, start: form.a, end: form.b || form.a, note: form.note, included: true };
    if (validateLeave(l, ids, w0, w1).length) return;
    s.patch({ leaves: [...leaves, l] });
    setForm({ ...form, a: "", b: "", note: "" });
  };
  const formErr = form.a ? validateLeave({ id: 0, personId: form.p, start: form.a, end: form.b || form.a, note: "", included: true }, ids, w0, w1) : [];

  const onCsv = async (text: string, name: string) => {
    const r = parseLeaveCsv(text);
    if (r.fatal) return setFatal(r.fatal);
    setFatal("");
    if (leaves.length && !(await confirm({ title: "Mevcut izin listesi değiştirilsin mi?", body: `${name} dosyasındaki ${r.rows.length} izin satırı mevcut listenin yerine geçer.`, confirmLabel: "Değiştir", tone: "danger" }))) return;
    s.patch({ leaves: r.rows.map((x, i) => ({ ...x, id: i + 1 })) });
    s.addLog(`İzin dosyası yüklendi: ${name} (${r.rows.length} satır)`);
  };

  const cols: Col[] = [
    { key: "personId", label: "calisan_id", editable: true, width: 100 },
    { key: "start", label: "baslangic", editable: true, width: 110 },
    { key: "end", label: "bitis", editable: true, width: 110 },
    { key: "gun", label: "gün", type: "num", width: 50 },
    { key: "note", label: "not", editable: true, width: 160 },
  ];
  const rows: TRow[] = leaves.map((l) => {
    const errors = validateLeave(l, ids, w0, w1);
    const a = Date.parse(l.start), b = Date.parse(l.end);
    return { id: l.id, cells: { ...l, gun: Number.isFinite(a) && Number.isFinite(b) ? Math.round((b - a) / 86400000) + 1 : "" }, errors, checked: l.included && errors.length === 0, dim: !l.included };
  });

  const absentCells = ab.absent.flat().filter(Boolean).length;
  const partialCells = ab.partial.flat().filter(Boolean).length;
  const lows = T.Dp.map((d) => d);
  const person = (i: number) => people[i]?.name ?? "";

  return (
    <Card title="Personel izinleri (K7) ve esas dağıtım sayısı" className="mt-3">
      <div className="mb-3">
        <Collapsible title="İzinler planı nasıl etkiler?">
          <ul className="list-inside list-disc space-y-0.5">
            <li>İzin tek gün de olabilir, aya yayılan bir aralık da. Günler aylara bölünür, çakışan günler bir kez sayılır.</li>
            <li>Bir ayda izin oranı <b>eşiğe</b> ulaşırsa kişi o ay <b>&quot;yok&quot;</b> sayılır ve defter almaz; eşiğin altındaki izinler yalnızca rapora &quot;kısmi izin&quot; olarak düşer.</li>
            <li><b>Ek atama</b>: boşta kalan defterler müsait kişilere ek verilir (kişi başı en fazla 2, her müsait kişi en az 1). <b>Boş bırak</b>: fazla defterler o ay kimseye gitmez.</li>
            <li><b>Eşitlik esas dağıtım sayısı D&apos;ye göre</b> hesaplanır: D = planda fiilen yapılan toplam defter–kişi ataması; kişinin hedef payı D · (müsait ayı) / (toplam müsait ay), her defter D/N pay alır.</li>
          </ul>
        </Collapsible>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="space-y-2.5">
          <Field label="Ay eşiği (kişi o ay yok sayılsın)" hint="Örn. %50: ayın yarısı ve fazlası izinliyse o ay defter verilmez.">
            <select className={inputCls} value={s.leaveThreshold} onChange={(e) => s.patch({ leaveThreshold: Number(e.target.value) })} aria-label="Ay eşiği">
              {[0.25, 0.5, 0.75, 1].map((x) => <option key={x} value={x}>%{x * 100}{x === 0.5 ? " (önerilen)" : ""}</option>)}
            </select>
          </Field>
          <Field label="Açıkta kalan defter">
            <select className={inputCls} value={s.strategy} onChange={(e) => s.patch({ strategy: e.target.value as "ek" | "bos" })} aria-label="Strateji">
              <option value="ek">Müsait kişilere ek atansın (önerilen)</option>
              <option value="bos">Boş bırakılsın</option>
            </select>
          </Field>
          <div className="rounded border border-slate-200 p-2">
            <div className="mb-1 text-xs font-semibold text-slate-600">İzin ekle</div>
            <div className="space-y-1.5">
              <select className={inputCls} value={form.p} onChange={(e) => setForm({ ...form, p: e.target.value })} aria-label="İzinli personel">{people.map((p) => <option key={p.id} value={p.id}>{p.id} · {p.name}</option>)}</select>
              <div className="flex gap-1.5">
                <input type="date" className={inputCls} value={form.a} onChange={(e) => setForm({ ...form, a: e.target.value })} aria-label="Başlangıç" data-testid="leave-start" />
                <input type="date" className={inputCls} value={form.b} onChange={(e) => setForm({ ...form, b: e.target.value })} aria-label="Bitiş (boşsa tek gün)" data-testid="leave-end" />
              </div>
              <input className={inputCls} placeholder="Not (isteğe bağlı)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} aria-label="İzin notu" />
              {formErr.length > 0 && <div className="text-[11.5px] text-[#C92830]">{formErr.map((e) => e.msg).join("; ")}</div>}
              <Button size="sm" disabled={!form.a || formErr.length > 0} onClick={add} data-testid="leave-add">Ekle</Button>
              <div className="text-[11px] text-slate-500">Bitiş boşsa tek günlük izin kaydedilir.</div>
            </div>
          </div>
          <FileDrop onText={onCsv} label="izinler.csv (calisan_id, baslangic, bitis, not)" />
          {fatal && <InfoCard tone="error">{fatal}</InfoCard>}
        </div>

        <div className="lg:col-span-2">
          <DataTable
            sheetName="izinler"
            columns={cols}
            rows={rows}
            height={230}
            onToggle={(id) => s.patch({ leaves: leaves.map((l) => (l.id === id ? { ...l, included: !l.included } : l)) })}
            onToggleAll={(c, idl) => s.patch({ leaves: leaves.map((l) => (idl.includes(l.id) ? { ...l, included: c } : l)) })}
            onEdit={(id, k, v) => s.patch({ leaves: leaves.map((l) => (l.id === id ? { ...l, [k]: String(v) } : l)) })}
            toolbar={leaves.length > 0 && <Button size="sm" onClick={async () => { if (await confirm({ title: "Tüm izinler silinsin mi?", body: `${leaves.length} izin satırı silinecek.`, confirmLabel: "Sil", tone: "danger" })) s.patch({ leaves: [] }); }}>Tümünü sil</Button>}
          />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-5" data-testid="d-card">
        <Stat label="Esas dağıtım sayısı D" value={T.D} sub={s.leaves.length ? `izinsiz ${s.n * m}` : "izin girilmedi"} />
        <Stat label="Yok sayılan kişi-ay" value={absentCells} sub={`${partialCells} kısmi izin`} />
        <Stat label="Kişi başına hedef pay" value={`${r1(Math.min(...lows))}–${r1(Math.max(...lows))}`} />
        <Stat label="Defter başına hedef" value={r1(T.D / s.n)} sub="D / N" />
        <Stat label="Kişi–defter hedefi" value={`${Math.min(...T.lo.flat())}–${Math.max(...T.hi.flat())}`} sub="alt–üst" />
      </div>
      {T.badMonths.length > 0 && (
        <div className="mt-2"><InfoCard tone="error" title="Ek atama yetersiz">Ay {T.badMonths.map((t) => `${t + 1} (${MONTHS[(startMonth - 1 + t) % 12]})`).join(", ")}: müsait kişi, kişi başı en fazla {T.maxPer} defterle tüm defterleri karşılayamıyor. İzinleri azaltın veya &quot;boş bırakılsın&quot; stratejisini seçin.</InfoCard></div>
      )}
      {absentCells > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5 text-[12px]">
          {ab.absent.flatMap((row, t) => row.map((x, p) => (x ? <Badge key={`${t}-${p}`} tone="amber">{MONTHS[(startMonth - 1 + t) % 12]}: {person(p)} yok</Badge> : null)))}
        </div>
      )}
    </Card>
  );
}
