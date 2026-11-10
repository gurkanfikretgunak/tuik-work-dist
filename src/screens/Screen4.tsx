"use client";
import { ArrowRight, Play, RotateCw } from "lucide-react";
import { useState } from "react";
import { useConfirm } from "@/components/confirm";
import { Badge, Button, Card, Collapsible, InfoCard, ScreenTitle, Stat } from "@/components/ui";
import { effCap, round1, sumEffCap, weightOf } from "@/lib/engine";
import { executeDistribution } from "@/lib/run";
import { activeEmployees, activeJobs, useStore } from "@/lib/store";
import { RULE_META } from "@/lib/types";

export default function Screen4() {
  const confirm = useConfirm();
  const { employees, jobs, rules, result, go } = useStore();
  const [busy, setBusy] = useState(false);
  const [p, setP] = useState(0);
  const emps = activeEmployees(employees);
  const act = activeJobs(jobs);
  const load = act.reduce((s, j) => s + weightOf(j, rules), 0);
  const cap = sumEffCap(emps);
  const open = rules.rules.filter((r) => r.enabled);
  const unit = rules.kapasiteBirimi === "puan" ? "puan" : "iş";

  const run = async () => {
    const again = !!result;
    const ok = await confirm({
      title: again ? "Dağıtım yeniden çalıştırılsın mı?" : "Dağıtım çalıştırılsın mı?",
      body: (
        <>
          <p>
            <b>{act.length}</b> iş, <b>{emps.filter((e) => e.aktif).length}</b> aktif çalışan ve <b>{open.length}</b> kural ile dağıtım yapılacak.
          </p>
          {again && <p className="mt-1 font-medium text-[#C92830]">Mevcut sonuç ve manuel değişiklikleriniz silinecek.</p>}
        </>
      ),
      confirmLabel: again ? "Yeniden dağıt" : "Çalıştır",
      tone: again ? "danger" : "primary",
    });
    if (!ok) return;
    setBusy(true);
    setP(0);
    await executeDistribution(setP);
    setBusy(false);
  };

  const done = result?.assignments ?? [];
  const okN = done.filter((a) => a.empId).length;

  return (
    <div>
      <ScreenTitle no={4} title="Dağıtım Çalıştırma" />
      <div className="mb-3">
        <Collapsible title="Dağıtım motoru nasıl çalışır?">
          <ol className="list-inside list-decimal space-y-0.5">
            <li>Efektif kapasiteler (ve orantılı modda hedef paylar) hesaplanır.</li>
            <li>İşler il / ilçe / mahalleye göre gruplanır; önce &quot;Yüksek&quot; öncelikliler, sonra büyük puanlılar işlenir.</li>
            <li>Zorunlu kurallar aday çalışanları eler; aday kalmazsa iş sebebiyle atanamadı listesine yazılır.</li>
            <li>Tercih kuralları adayları puanlar; en yüksek puanlı (eşitlikte en az dolu) çalışan seçilir.</li>
            <li>İsteğe bağlı iyileştirme turu doluluk farkını izin verilen sapmaya çeker.</li>
          </ol>
        </Collapsible>
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="İş" value={act.length} />
        <Stat label="Aktif çalışan" value={emps.filter((e) => e.aktif).length} />
        <Stat label={`Toplam yük (${unit})`} value={round1(load)} />
        <Stat label="Efektif kapasite" value={round1(cap)} tone={load > cap ? "red" : "green"} />
      </div>
      <Card title="Kullanılacak kural seti" className="mb-3">
        <div className="flex flex-wrap gap-1.5">
          {open.map((r) => (
            <Badge key={r.id} tone={r.mandatory ? "red" : "blue"}>
              {RULE_META[r.id].label} · {r.mandatory ? "zorunlu" : "tercih"}
            </Badge>
          ))}
          <Badge>{rules.kapasiteModu === "sert" ? "Sert limit" : "Orantılı hedef"}</Badge>
        </div>
      </Card>

      <Card title="Çalıştır">
        {busy ? (
          <div>
            <div className="mb-1 text-[12.5px] text-slate-700">Dağıtım yapılıyor… %{Math.round(p * 100)}</div>
            <div className="h-2.5 w-full rounded bg-slate-200">
              <div className="h-2.5 rounded bg-[#1F2A44] transition-all" style={{ width: `${p * 100}%` }} />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button variant="primary" onClick={run} data-testid="run-dist">
              {result ? <RotateCw className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />} {result ? "Yeniden dağıt" : "Dağıtımı çalıştır"}
            </Button>
            {!result && <span className="text-xs text-slate-500">Çalıştırmadan önce onayınız istenecek.</span>}
          </div>
        )}
        {result && !busy && (
          <div className="mt-3 space-y-2" data-testid="dist-result">
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Atanan" value={okN} tone="green" />
              <Stat label="Atanamayan" value={done.length - okN} tone={done.length - okN ? "red" : "green"} />
              <Stat label="Süre" value={`${result.durationMs} ms`} sub={`${result.runCount}. çalıştırma`} />
            </div>
            {done.length - okN > 0 ? (
              <InfoCard tone="warn">Atanamayan işler var; sebepleri ön onay ekranında &quot;Atanamayanlar&quot; sekmesinde görebilirsiniz.</InfoCard>
            ) : (
              <InfoCard tone="ok">Tüm işler atandı.</InfoCard>
            )}
          </div>
        )}
      </Card>

      <div className="mt-3 flex items-center justify-between">
        <Button onClick={() => go(3)}>← İş yükleme</Button>
        <Button variant="primary" disabled={!result || busy} onClick={() => go(5)} data-testid="to-review">
          Ön onaya geç <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
