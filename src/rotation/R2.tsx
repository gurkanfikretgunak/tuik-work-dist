"use client";
import { ArrowRight, Play, Square } from "lucide-react";
import { useRef, useState } from "react";
import { useConfirm } from "@/components/confirm";
import { Button, Card, Collapsible, InfoCard, ScreenTitle, Stat } from "@/components/ui";
import { generatePlans } from "./engine";
import { buildParams, pairLimitOf } from "./params";
import { useRot } from "./store";

export default function R2() {
  const confirm = useConfirm();
  const s = useRot();
  const [busy, setBusy] = useState(false);
  const [p, setP] = useState(0);
  const [found, setFound] = useState(0);
  const sig = useRef({ cancelled: false });
  const r = s.result;

  const run = async () => {
    const ok = await confirm({
      title: r ? "Plan yeniden üretilsin mi?" : "Plan üretilsin mi?",
      body: <>Arama en fazla <b>{s.timeMs / 1000} sn</b> sürer.{r && " Mevcut plan ve elle takaslarınız silinir."}</>,
      confirmLabel: r ? "Yeniden üret" : "Üret",
      tone: r ? "danger" : "primary",
    });
    if (!ok) return;
    sig.current = { cancelled: false };
    setBusy(true);
    setP(0);
    const t0 = Date.now();
    const res = await generatePlans(buildParams(useRot.getState()), { timeMs: s.timeMs, want: 3, onProgress: (x, f) => { setP(x); setFound(f); }, signal: sig.current });
    s.setResult(res);
    s.addLog(res.candidates.length ? `Plan üretildi: ${res.candidates.length} aday, çift sınırı ${res.usedPairLimit}${res.relaxed.length ? " (gevşetildi)" : ""}, ${res.attempts} deneme, ${Date.now() - t0} ms` : `Plan bulunamadı (${res.attempts} deneme)`);
    setBusy(false);
  };

  return (
    <div>
      <ScreenTitle no={2} title="Plan Üretimi (R2)" />
      <div className="mb-3">
        <Collapsible title="Üretim nasıl çalışır?">
          Sudoku çözücülerindeki gibi kısıt tabanlı geri izlemeli arama kullanılır: her ay için, en az seçenekli kişiden başlanarak N×N eşleştirme kurulur; uygunluk (K1, K2, K3 ve erişilebilirlik) her adımda
          denetlenir. Çıkmazda geri dönülür, olmazsa farklı tohumla yeniden başlanır. Çift sınırında çözüm bulunamazsa sınır +1 gevşetilir ve bu raporlanır.
        </Collapsible>
      </div>
      <Card title="Çalıştır">
        {busy ? (
          <div>
            <div className="mb-1 text-[12.5px]">Aranıyor… bulunan aday: <b>{found}</b></div>
            <div className="h-2.5 w-full rounded bg-slate-200"><div className="h-2.5 rounded bg-[#1F2A44] transition-all" style={{ width: `${p * 100}%` }} /></div>
            <Button className="mt-2" size="sm" onClick={() => (sig.current.cancelled = true)}><Square className="h-3 w-3" /> İptal</Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button variant="primary" onClick={run} data-testid="r2-run"><Play className="h-3.5 w-3.5" /> {r ? "Yeniden üret" : "Planı üret"}</Button>
            <span className="text-xs text-slate-500">N={s.n} · M={s.m} · G={s.g} · çift sınırı {pairLimitOf(s)}</span>
          </div>
        )}
        {r && !busy && (
          <div className="mt-3 space-y-2" data-testid="r2-result">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Stat label="Aday plan" value={r.candidates.length} tone={r.candidates.length ? "green" : "red"} />
              <Stat label="Deneme" value={r.attempts} />
              <Stat label="Kullanılan çift sınırı" value={r.candidates.length ? r.usedPairLimit : "—"} sub={`istenen ${pairLimitOf(s)}`} />
              <Stat label="En iyi en çok çift tekrarı" value={r.candidates[0]?.maxPair ?? "—"} />
            </div>
            {r.relaxed.map((x) => <InfoCard key={x} tone="warn" title="Kısıt gevşetildi">{x}</InfoCard>)}
            {r.error && <InfoCard tone="error" title="Plan bulunamadı">{r.error}</InfoCard>}
            {r.candidates.length > 0 && !r.relaxed.length && <InfoCard tone="ok">Zorunlu kuralların tümü istenen sınırlarla sağlandı.</InfoCard>}
          </div>
        )}
      </Card>
      <div className="mt-3 flex items-center justify-between">
        <Button onClick={() => s.go(1)}>← Parametreler</Button>
        <Button variant="primary" disabled={!r?.candidates.length || busy} onClick={() => s.go(3)} data-testid="r2-next">İncelemeye geç <ArrowRight className="h-3.5 w-3.5" /></Button>
      </div>
    </div>
  );
}
