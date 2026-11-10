import { createElement, Fragment, type ReactNode } from "react";
import { create } from "zustand";
import { common } from "./dict/common";
import { v1ui } from "./dict/v1ui";
import { v1core } from "./dict/v1core";
import { v2core } from "./dict/v2core";
import { v2ui } from "./dict/v2ui";
import { v3 } from "./dict/v3";

export const LANGS = ["tr", "en", "fr", "de", "ja", "zh"] as const;
export type Lang = (typeof LANGS)[number];
export type Dict = Record<Lang, Record<string, string>>;

export const LANG_META: Record<Lang, { name: string; locale: string; short: string }> = {
  tr: { name: "Türkçe", locale: "tr-TR", short: "TR" },
  en: { name: "English", locale: "en-GB", short: "EN" },
  fr: { name: "Français", locale: "fr-FR", short: "FR" },
  de: { name: "Deutsch", locale: "de-DE", short: "DE" },
  ja: { name: "日本語", locale: "ja-JP", short: "JA" },
  zh: { name: "简体中文", locale: "zh-CN", short: "ZH" },
};

const ALL: Dict[] = [common, v1ui, v1core, v2core, v2ui, v3];
const TABLE: Record<Lang, Record<string, string>> = { tr: {}, en: {}, fr: {}, de: {}, ja: {}, zh: {} };
for (const d of ALL) for (const l of LANGS) Object.assign(TABLE[l], d[l]);
export const TABLES = TABLE;

const KEY = "tuik-lang";

export const useLangStore = create<{ lang: Lang; setLang: (l: Lang) => void }>((set) => ({
  lang: "tr",
  setLang: (lang) => {
    try { localStorage.setItem(KEY, lang); } catch {}
    if (typeof document !== "undefined") document.documentElement.lang = lang;
    set({ lang });
  },
}));

/** İstemci açılışında kayıtlı veya tarayıcı dilini uygular. */
export function initLang() {
  let l: Lang | null = null;
  try { l = localStorage.getItem(KEY) as Lang | null; } catch {}
  if (!l || !LANGS.includes(l)) {
    const nav = (typeof navigator !== "undefined" ? navigator.language : "tr").slice(0, 2).toLowerCase();
    l = (LANGS as readonly string[]).includes(nav) ? (nav as Lang) : "tr";
  }
  useLangStore.getState().setLang(l);
}

type Params = Record<string, ReactNode | number | string>;

function interp(s: string, p?: Params): string {
  return p ? s.replace(/\{(\w+)\}/g, (m, k) => (k in p ? String(p[k]) : m)) : s;
}

/** Bileşen dışı çeviri (motor mesajları, olay günlüğü vb.): geçerli dili kullanır. */
export function tx(key: string, params?: Params, lang?: Lang): string {
  const l = lang ?? useLangStore.getState().lang;
  const s = TABLE[l][key] ?? TABLE.tr[key] ?? key;
  return interp(s, params);
}

/** <b>…</b> ve {param} içeren çeviriyi ReactNode olarak üretir. */
export function rtx(key: string, params?: Params, lang?: Lang): ReactNode {
  const l = lang ?? useLangStore.getState().lang;
  const s = TABLE[l][key] ?? TABLE.tr[key] ?? key;
  const parts = s.split(/(<b>.*?<\/b>|\{\w+\})/g).filter((x) => x !== "");
  return createElement(
    Fragment,
    null,
    ...parts.map((part, i) => {
      const b = /^<b>(.*)<\/b>$/.exec(part);
      if (b) return createElement("b", { key: i }, b[1].replace(/\{(\w+)\}/g, (m, k) => (params && k in params ? String(params[k]) : m)));
      const m = /^\{(\w+)\}$/.exec(part);
      if (m && params && m[1] in params) return createElement(Fragment, { key: i }, params[m[1]] as ReactNode);
      return createElement(Fragment, { key: i }, part);
    }),
  );
}

/** Bileşenlerde kullanın: dil değişince yeniden çizilir. */
export function useT() {
  const lang = useLangStore((s) => s.lang);
  return {
    lang,
    locale: LANG_META[lang].locale,
    t: (key: string, params?: Params) => tx(key, params, lang),
    rt: (key: string, params?: Params) => rtx(key, params, lang),
  };
}
export const useLang = () => useLangStore((s) => s.lang);

// ---- biçimlendirme ----
export const localeOf = () => LANG_META[useLangStore.getState().lang].locale;
export const monthName = (i0: number, lang?: Lang) => {
  const loc = LANG_META[lang ?? useLangStore.getState().lang].locale;
  const s = new Intl.DateTimeFormat(loc, { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2000, ((i0 % 12) + 12) % 12, 1)));
  return s.charAt(0).toLocaleUpperCase(loc) + s.slice(1);
};
export const fmtDateTime = (iso: string | number | Date) => new Date(iso).toLocaleString(localeOf());
export const fmtDate = (iso: string | number | Date) => new Date(iso).toLocaleDateString(localeOf());
export const fmtTime = (iso: string | number | Date) => new Date(iso).toLocaleTimeString(localeOf());
/** Veri enum değerlerini (Kent/Kır, Yüksek/Normal/Düşük) görüntüde geçerli dile çevirir; CSV/şema değeri değişmez. */
export const enumLabel = (v: string) => (`enum.${v}` in TABLE[useLangStore.getState().lang] || `enum.${v}` in TABLE.tr ? tx(`enum.${v}`) : v);
export const collate = (a: string, b: string) => a.localeCompare(b, localeOf());
