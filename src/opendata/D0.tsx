"use client";
import clsx from "clsx";
import { ExternalLink, RefreshCw, Search } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useConfirm } from "@/components/confirm";
import { Badge, Button, Card, Collapsible, InfoCard, ScreenTitle, inputCls } from "@/components/ui";
import { fmtDateTime, useT } from "@/i18n";
import { searchCatalog, topCategories } from "@/lib/tuikCatalog";
import { useOpen } from "./store";

const PER_PAGE = 12;

export default function D0() {
  const confirm = useConfirm();
  const { t, locale } = useT();
  const { catalog, catalogStatus, query, top, page, setQuery, setTop, setPage, loadCatalog, openDataset } = useOpen();

  useEffect(() => {
    if (catalogStatus === "idle") void loadCatalog(false);
  }, [catalogStatus, loadCatalog]);

  const items = useMemo(() => catalog?.datasets ?? [], [catalog]);
  const tops = useMemo(() => topCategories(items), [items]);
  const found = useMemo(() => searchCatalog(items, query, top, locale), [items, query, top, locale]);
  const pages = Math.max(1, Math.ceil(found.length / PER_PAGE));
  const shown = found.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);

  const refresh = async () => {
    const ok = await confirm({ title: t("v3.d0.refresh.title"), body: t("v3.d0.refresh.body"), confirmLabel: t("v3.d0.refresh.confirm") });
    if (!ok) return;
    try {
      await loadCatalog(true);
    } catch {
      await confirm({ title: t("v3.d0.refresh.failTitle"), body: t("v3.d0.refresh.fail"), infoOnly: true, confirmLabel: t("c.ok") });
    }
  };

  return (
    <div>
      <ScreenTitle no={0} title={t("v3.d0.title")}>
        <Button onClick={refresh} disabled={catalogStatus === "loading"} data-testid="d0-refresh"><RefreshCw className="h-3.5 w-3.5" /> {t("v3.d0.refresh")}</Button>
      </ScreenTitle>

      <div className="mb-3 space-y-2">
        <Collapsible title={t("v3.d0.intro.title")} defaultOpen>{t("v3.d0.intro")}</Collapsible>
        <InfoCard tone="warn" title={t("v3.d0.notice.title")}>
          <ul className="list-inside list-disc space-y-0.5">
            <li>{t("v3.d0.note1")}</li>
            <li>{t("v3.d0.note2")}</li>
            <li>{t("v3.d0.note3")}</li>
          </ul>
        </InfoCard>
      </div>

      {catalogStatus === "loading" && !catalog && <InfoCard>{t("v3.d0.loading")}</InfoCard>}
      {catalogStatus === "error" && <InfoCard tone="error">{t("v3.d0.error")}</InfoCard>}

      {catalog && (
        <>
          <Card className="mb-3">
            <div className="relative mb-2.5">
              <Search className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-slate-400" />
              <input className={clsx(inputCls, "pl-8")} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("v3.d0.search.ph")} aria-label={t("v3.d0.search.aria")} data-testid="d0-search" />
            </div>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("v3.d0.cat.aria")}>
              <button onClick={() => setTop(null)} className={clsx("rounded-full border px-2.5 py-0.5 text-xs", top === null ? "border-[#1F2A44] bg-[#1F2A44] text-white" : "border-slate-300 hover:bg-slate-50")}>{t("v3.d0.all")} · {items.length}</button>
              {tops.map(([name, n]) => (
                <button key={name} onClick={() => setTop(top === name ? null : name)} data-testid="d0-cat"
                  className={clsx("rounded-full border px-2.5 py-0.5 text-xs", top === name ? "border-[#1F2A44] bg-[#1F2A44] text-white" : "border-slate-300 hover:bg-slate-50")}>{name} · {n}</button>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11.5px] text-slate-500">
              <span data-testid="d0-count">{t("v3.d0.count", { shown: found.length, total: items.length })}</span>
              <Badge tone={catalog.live ? "green" : "slate"}>{t(catalog.live ? "v3.d0.live" : "v3.d0.snapshot", { date: fmtDateTime(catalog.fetchedAt) })}</Badge>
            </div>
          </Card>

          {found.length === 0 ? (
            <InfoCard>{t("v3.d0.empty")}</InfoCard>
          ) : (
            <ul className="space-y-2" data-testid="d0-list">
              {shown.map((d) => (
                <li key={d.id} className="rounded-md border border-slate-200 bg-white p-3 hover:border-slate-400">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] font-semibold text-[#1F2A44]">{d.title}</div>
                      <div className="mt-0.5 text-[11.5px] text-slate-500">{d.path.join("  ›  ")}</div>
                      {d.description && d.description !== d.title && <p className="mt-1 line-clamp-2 text-[12px] text-slate-600">{d.description}</p>}
                      <code className="mt-1 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">{d.id}</code>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <a className="text-slate-400 hover:text-slate-700" href={`https://databrowser2.tuik.gov.tr/#/tr/tuik/${encodeURIComponent(d.id)}`} target="_blank" rel="noreferrer" aria-label={t("v3.d1.openSrc")} title={t("v3.d1.openSrc")}><ExternalLink className="h-4 w-4" /></a>
                      <Button variant="primary" size="sm" onClick={() => openDataset(d)} data-testid="d0-open">{t("v3.d0.open")}</Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {pages > 1 && (
            <div className="mt-3 flex items-center justify-center gap-3">
              <Button size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>{t("c.back")}</Button>
              <span className="text-xs text-slate-600">{t("v3.d0.page", { p: page + 1, n: pages })}</span>
              <Button size="sm" disabled={page >= pages - 1} onClick={() => setPage(page + 1)} data-testid="d0-next">{t("c.next")}</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
