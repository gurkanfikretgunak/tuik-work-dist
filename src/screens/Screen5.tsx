"use client";
import clsx from "clsx";
import { ArrowRight, MoveRight, RotateCw } from "lucide-react";
import { useMemo, useState } from "react";
import { Modal, useConfirm } from "@/components/confirm";
import { Badge, Button, Card, Collapsible, FillBar, InfoCard, ScreenTitle, Stat, inputCls } from "@/components/ui";
import { checkMove, computeLoads, effCap, round1, weightOf } from "@/lib/engine";
import { executeDistribution } from "@/lib/run";
import { activeEmployees, activeJobs, useStore } from "@/lib/store";
import type { Job } from "@/lib/types";

const TABS = ["Il / mahalle dağılımı", "Uyarılar", "Atanamayanlar", "Doluluk dengesi"] as const;

export default function Screen5() {
  const confirm = useConfirm();
  const { employees, jobs, rules, result, patchAssignments, log, go } = useStore();
  const emps = useMemo(() => activeEmployees(employees).filter((e) => e.aktif), [employees]);
  const allEmps = useMemo(() => activeEmployees(employees), [employees]);
  const js = useMemo(() => activeJobs(jobs), [jobs]);
  const [selId, setSelId] = useState<string | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>(TABS[0]);
  const [moving, setMoving] = useState<Job | null>(null);
  const [busy, setBusy] = useState(false);

  const A = result?.assignments ?? [];
  const jm = useMemo(() => new Map(js.map((j) => [j.is_id, j])), [js]);
  const loads = useMemo(() => computeLoads(A, js, rules), [A, js, rules]);

  if (!result) {
    return (
      <div>
        <ScreenTitle no={5} title="Ön Onay" />
        <InfoCard tone="warn" title="Geçerli bir dağıtım sonucu yok">
          Personel, kural veya iş listesi değişti ya da dağıtım henüz çalıştırılmadı. Devam etmek için dağıtımı çalıştırın.
        </InfoCard>
        <div className="mt-3">
          <Button variant="primary" onClick={() => go(4)}>
            Dağıtım ekranına git
          </Button>
        </div>
      </div>
    );
  }

  const unit = rules.kapasiteBirimi === "puan" ? "puan" : "iş";
  const assigned = A.filter((a) => a.empId);
  const unassigned = A.filter((a) => !a.empId);
  const fills = emps.map((e) => (effCap(e) > 0 ? (loads.get(e.calisan_id) ?? 0) / effCap(e) : 0));
  const avg = fills.length ? fills.reduce((a, b) => a + b, 0) / fills.length : 0;
  const warnA = A.filter((a) => a.uyari);
  const sel = emps.find((e) => e.calisan_id === selId) ?? emps[0];
  const selJobs = A.filter((a) => a.empId === sel?.calisan_id).map((a) => ({ a, j: jm.get(a.jobId)! })).filter((x) => x.j);

  const redo = async () => {
    const ok = await confirm({
      title: "Yeniden dağıtılsın mı?",
      body: <>Mevcut sonuç{A.some((a) => a.manuel) ? " ve manuel değişiklikleriniz" : ""} silinip dağıtım baştan yapılacak.</>,
      confirmLabel: "Yeniden dağıt",
      tone: "danger",
    });
    if (!ok) return;
    setBusy(true);
    await executeDistribution();
    setBusy(false);
  };

  const toApprove = async () => {
    if (unassigned.length > 0) {
      const ok = await confirm({
        title: "Atanamayan işler var",
        body: <>{unassigned.length} iş atanamadı. Yine de onay ekranına geçmek istiyor musunuz? Bu işler ayrı dosyada (atanamayan_isler.csv) çıktı olarak verilecek.</>,
        confirmLabel: "Yine de geç",
      });
      if (!ok) return;
    }
    go(6);
  };

  return (
    <div>
      <ScreenTitle no={5} title="Ön Onay">
        <Button onClick={() => go(1)}>Kapasiteleri değiştir</Button>
        <Button onClick={() => go(2)}>Kuralları değiştir</Button>
        <Button onClick={redo} disabled={busy}>
          <RotateCw className="h-3.5 w-3.5" /> Yeniden dağıt
        </Button>
        <Button variant="primary" onClick={toApprove} data-testid="to-approve">
          Onaya geç <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </ScreenTitle>

      <div className="mb-3">
        <Collapsible title="Bu ekranda ne yapılır?">
          Sonucu inceleyin. Soldan bir çalışan seçin, sağda işlerini görün ve &quot;Taşı&quot; ile başka çalışana verin. Her manuel değişiklikte kapasite ve zorunlu kural kontrolü yapılır; ihlal varsa
          uyarılır ve onayınız istenir. Tüm değişiklikler süreç raporuna işlenir.
        </Collapsible>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-6">
        <Stat label="Toplam iş" value={A.length} />
        <Stat label="Atanan" value={assigned.length} tone="green" />
        <Stat label="Atanamayan" value={unassigned.length} tone={unassigned.length ? "red" : "green"} />
        <Stat label="Uyarı" value={warnA.length} tone={warnA.length ? "amber" : undefined} />
        <Stat label="Ortalama doluluk" value={`%${Math.round(avg * 100)}`} />
        <Stat label="Manuel değişiklik" value={A.filter((a) => a.manuel).length} />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <Card title="Çalışanlar" className="lg:col-span-2">
          <ul className="max-h-[360px] divide-y divide-slate-100 overflow-auto">
            {emps.map((e) => {
              const l = loads.get(e.calisan_id) ?? 0;
              const f = effCap(e) > 0 ? l / effCap(e) : 0;
              return (
                <li key={e.calisan_id}>
                  <button
                    onClick={() => setSelId(e.calisan_id)}
                    data-testid={`emp-${e.calisan_id}`}
                    className={clsx("w-full px-2 py-1.5 text-left hover:bg-slate-50", sel?.calisan_id === e.calisan_id && "bg-sky-50")}
                  >
                    <div className="flex items-center justify-between text-[12.5px]">
                      <span className="font-medium text-slate-900">
                        {e.calisan_id} · {e.ad_soyad}
                      </span>
                      <span className="tabular-nums text-slate-700">
                        {round1(l)}/{round1(effCap(e))}
                      </span>
                    </div>
                    <div className="mb-0.5 text-[11px] text-slate-500">{e.il}</div>
                    <FillBar value={f} />
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card title={sel ? `${sel.ad_soyad} — işleri (${selJobs.length})` : "İşler"} className="lg:col-span-3">
          <div className="max-h-[360px] overflow-auto">
            <table className="w-full text-[12.5px]">
              <thead className="sticky top-0 bg-white text-left text-slate-500">
                <tr>
                  <th className="pr-2">İş</th>
                  <th className="pr-2">İl</th>
                  <th className="pr-2">Mahalle</th>
                  <th className="pr-2">K/K</th>
                  <th className="pr-2 text-right">Görüşme</th>
                  <th className="pr-2 text-right">{unit}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {selJobs.map(({ a, j }) => (
                  <tr key={j.is_id} className="border-t border-slate-100">
                    <td className="py-1 pr-2 font-mono">
                      {j.is_id} {a.manuel && <Badge tone="amber">manuel</Badge>} {a.uyari && <Badge tone="red">{a.uyari}</Badge>}
                    </td>
                    <td className="pr-2">{j.il}</td>
                    <td className="pr-2">{j.mahalle}</td>
                    <td className="pr-2">{j.yerlesim_tipi}</td>
                    <td className="pr-2 text-right tabular-nums">{j.gorusme_sayisi}</td>
                    <td className="pr-2 text-right tabular-nums">{round1(weightOf(j, rules))}</td>
                    <td className="text-right">
                      <Button size="sm" onClick={() => setMoving(j)} data-testid={`move-${j.is_id}`}>
                        <MoveRight className="h-3 w-3" /> Başka çalışana taşı
                      </Button>
                    </td>
                  </tr>
                ))}
                {selJobs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-slate-500">
                      Bu çalışana iş atanmadı.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="mt-3">
        <div className="flex gap-0.5 border-b border-slate-200">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={clsx("px-3 py-1.5 text-xs font-medium", tab === t ? "border-b-2 border-[#C92830] text-[#1F2A44]" : "text-slate-600 hover:bg-slate-50")}
            >
              {t === "Uyarılar" ? `Uyarılar (${warnA.length})` : t === "Atanamayanlar" ? `Atanamayanlar (${unassigned.length})` : t}
            </button>
          ))}
        </div>
        <div className="rounded-b-md border border-t-0 border-slate-200 p-3">
          {tab === "Il / mahalle dağılımı" && <IlMahalle A={A} jm={jm} />}
          {tab === "Uyarılar" &&
            (warnA.length === 0 ? (
              <Badge tone="green">Uyarı yok</Badge>
            ) : (
              <ul className="list-inside list-disc text-[12.5px]">
                {warnA.map((a) => (
                  <li key={a.jobId}>
                    {a.jobId} → {a.empId}: {a.uyari}
                  </li>
                ))}
              </ul>
            ))}
          {tab === "Atanamayanlar" &&
            (unassigned.length === 0 ? (
              <Badge tone="green">Atanamayan iş yok</Badge>
            ) : (
              <table className="w-full text-[12.5px]">
                <thead className="text-left text-slate-500">
                  <tr>
                    <th>İş</th>
                    <th>İl / mahalle</th>
                    <th>Sebep</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {unassigned.map((a) => {
                    const j = jm.get(a.jobId)!;
                    return (
                      <tr key={a.jobId} className="border-t border-slate-100">
                        <td className="py-1 font-mono">{a.jobId}</td>
                        <td>
                          {j.il} / {j.mahalle} ({j.yerlesim_tipi})
                        </td>
                        <td className="text-red-800">{a.sebep}</td>
                        <td className="text-right">
                          <Button size="sm" onClick={() => setMoving(j)}>
                            Elle ata
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ))}
          {tab === "Doluluk dengesi" && (
            <div className="grid gap-x-6 gap-y-1.5 md:grid-cols-2">
              {emps.map((e) => (
                <div key={e.calisan_id} className="flex items-center gap-2 text-[12px]">
                  <span className="w-28 truncate">{e.ad_soyad}</span>
                  <div className="flex-1">
                    <FillBar value={effCap(e) > 0 ? (loads.get(e.calisan_id) ?? 0) / effCap(e) : 0} target={avg} />
                  </div>
                  <span className="w-10 text-right tabular-nums">%{Math.round(effCap(e) > 0 ? ((loads.get(e.calisan_id) ?? 0) / effCap(e)) * 100 : 0)}</span>
                </div>
              ))}
              <div className="text-[11px] text-slate-500 md:col-span-2">Çubuk üzerindeki dikey çizgi ortalama doluluğu gösterir.</div>
            </div>
          )}
        </div>
      </div>

      <MoveModal
        job={moving}
        onClose={() => setMoving(null)}
        emps={allEmps.filter((e) => e.aktif)}
        loads={loads}
        onMove={async (job, to, violations) => {
          const cur = A.find((a) => a.jobId === job.is_id);
          const from = cur?.empId ?? null;
          const ok = await confirm({
            title: violations.length ? "Kural ihlaliyle taşınsın mı?" : "İş taşınsın mı?",
            body: (
              <>
                <p>
                  <b>{job.is_id}</b>: {from ? employees.find((r) => r.data.calisan_id === from)?.data.ad_soyad : "atanamayanlar"} → <b>{to.ad_soyad}</b>
                </p>
                {violations.length > 0 && (
                  <ul className="mt-1 list-inside list-disc text-[#C92830]">
                    {violations.map((v) => (
                      <li key={v}>{v}</li>
                    ))}
                  </ul>
                )}
              </>
            ),
            confirmLabel: violations.length ? "İhlale rağmen taşı" : "Taşı",
            tone: violations.length ? "danger" : "primary",
          });
          if (!ok) return false;
          patchAssignments((as) =>
            as.map((a) =>
              a.jobId === job.is_id
                ? { ...a, empId: to.calisan_id, manuel: true, sebep: "", neden: "manuel atama", uyari: violations.length ? `Manuel: ${violations.join("; ")}` : "" }
                : a,
            ),
          );
          log("manuel", `${job.is_id}: ${from ?? "atanamayan"} → ${to.calisan_id}${violations.length ? ` (kural ihlali: ${violations.join("; ")})` : ""}`, {
            is: job.is_id, kimden: from, kime: to.calisan_id, ihlal: violations,
          });
          return true;
        }}
        check={(job, to) => checkMove(job, to, A, allEmps, js, rules)}
      />
    </div>
  );
}

function IlMahalle({ A, jm }: { A: { jobId: string; empId: string | null }[]; jm: Map<string, Job> }) {
  const rows = useMemo(() => {
    const m = new Map<string, { il: string; mah: string; total: number; assigned: number; emps: Set<string> }>();
    for (const a of A) {
      const j = jm.get(a.jobId);
      if (!j) continue;
      const k = `${j.il}|${j.ilce}|${j.mahalle}`;
      const x = m.get(k) ?? { il: j.il, mah: `${j.ilce} / ${j.mahalle}`, total: 0, assigned: 0, emps: new Set<string>() };
      x.total++;
      if (a.empId) {
        x.assigned++;
        x.emps.add(a.empId);
      }
      m.set(k, x);
    }
    return [...m.values()].sort((a, b) => a.il.localeCompare(b.il, "tr") || a.mah.localeCompare(b.mah, "tr"));
  }, [A, jm]);
  return (
    <div className="max-h-64 overflow-auto">
      <table className="w-full text-[12.5px]">
        <thead className="sticky top-0 bg-white text-left text-slate-500">
          <tr>
            <th>İl</th>
            <th>İlçe / mahalle</th>
            <th className="text-right">İş</th>
            <th className="text-right">Atanan</th>
            <th className="text-right">Farklı çalışan</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.il + r.mah} className="border-t border-slate-100">
              <td className="py-0.5">{r.il}</td>
              <td>{r.mah}</td>
              <td className="text-right tabular-nums">{r.total}</td>
              <td className="text-right tabular-nums">{r.assigned}</td>
              <td className="text-right tabular-nums">{r.emps.size}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MoveModal({
  job,
  onClose,
  emps,
  loads,
  onMove,
  check,
}: {
  job: Job | null;
  onClose: () => void;
  emps: ReturnType<typeof activeEmployees>;
  loads: Map<string, number>;
  onMove: (j: Job, to: ReturnType<typeof activeEmployees>[number], v: string[]) => Promise<boolean>;
  check: (j: Job, to: ReturnType<typeof activeEmployees>[number]) => string[];
}) {
  const [to, setTo] = useState("");
  const target = emps.find((e) => e.calisan_id === to);
  const viol = job && target ? check(job, target) : [];
  return (
    <Modal
      open={!!job}
      onClose={() => {
        setTo("");
        onClose();
      }}
      title={job ? `${job.is_id} — başka çalışana taşı` : ""}
      footer={
        <>
          <Button onClick={onClose}>Vazgeç</Button>
          <Button
            variant="primary"
            disabled={!target}
            data-testid="move-confirm"
            onClick={async () => {
              if (job && target && (await onMove(job, target, viol))) {
                setTo("");
                onClose();
              }
            }}
          >
            Taşı
          </Button>
        </>
      }
    >
      {job && (
        <div className="space-y-2.5">
          <div className="text-[12.5px] text-slate-700">
            {job.il} / {job.ilce} / {job.mahalle} · {job.yerlesim_tipi} · {job.gorusme_sayisi} görüşme
          </div>
          <select className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} aria-label="Hedef çalışan" data-testid="move-target">
            <option value="">Çalışan seçin…</option>
            {emps.map((e) => (
              <option key={e.calisan_id} value={e.calisan_id}>
                {e.calisan_id} · {e.ad_soyad} ({e.il}) — {round1(loads.get(e.calisan_id) ?? 0)}/{round1(effCap(e))}
              </option>
            ))}
          </select>
          {target && (viol.length ? (
            <InfoCard tone="error" title="Kural / kapasite ihlali">
              <ul className="list-inside list-disc">
                {viol.map((v) => (
                  <li key={v}>{v}</li>
                ))}
              </ul>
            </InfoCard>
          ) : (
            <InfoCard tone="ok">Kapasite ve zorunlu kurallar açısından uygun.</InfoCard>
          ))}
        </div>
      )}
    </Modal>
  );
}
