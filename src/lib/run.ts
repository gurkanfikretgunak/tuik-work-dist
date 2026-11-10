import { runDistribution } from "./engine";
import { activeEmployees, activeJobs, useStore } from "./store";
import { RULE_META } from "./types";

export async function executeDistribution(onProgress?: (p: number) => void) {
  const s = useStore.getState();
  const emps = activeEmployees(s.employees);
  const jobs = activeJobs(s.jobs);
  const t0 = performance.now();
  const assignments = await runDistribution(emps, jobs, s.rules, onProgress);
  const durationMs = Math.max(1, Math.round(performance.now() - t0));
  const runCount = s.runCount + 1;
  useStore.setState({ runCount });
  s.setResult({
    assignments,
    durationMs,
    runCount,
    at: new Date().toISOString(),
    unitLabel: s.rules.kapasiteBirimi === "puan" ? "puan" : "iş",
  });
  const ok = assignments.filter((a) => a.empId).length;
  s.log(
    "dagitim",
    `Dağıtım çalıştırıldı (${runCount}. kez): ${ok} atanan, ${assignments.length - ok} atanamayan, ${durationMs} ms`,
    { sure_ms: durationMs, calistirma: runCount, atanan: ok, atanamayan: assignments.length - ok, kurallar: s.rules.rules.filter((r) => r.enabled).map((r) => RULE_META[r.id].label) },
  );
  return assignments;
}
