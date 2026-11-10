export type Employee = {
  calisan_id: string;
  ad_soyad: string;
  rol: string;
  il: string;
  ilce: string;
  donemlik_kapasite: number;
  musait_oran: number;
  kir_gorevi_yapabilir: boolean;
  aktif: boolean;
  kapasite_notu: string;
};

export type Job = {
  is_id: string;
  il: string;
  ilce: string;
  mahalle: string;
  yerlesim_tipi: "Kent" | "Kır";
  birim_no: string;
  gorusme_sayisi: number;
  onceki_ay_gorusen_calisan_id: string;
  oncelik: "Yüksek" | "Normal" | "Düşük";
  anket_turu: string;
};

/** msg erişim anında geçerli dile çevrilir (getter); hatalar dizilerde referansla taşınmalı, {...err} yayılımı getter'ı dondurur. */
export type CellError = { col: string; key: string; params?: Record<string, string | number>; readonly msg: string };

export type Row<T> = {
  rowNo: number; // CSV'deki satır numarası (başlık = 1)
  data: T;
  errors: CellError[];
  included: boolean; // satır başı onay kutusu
};

export type EmpRow = Row<Employee>;
export type JobRow = Row<Job>;

export type FileInfo = {
  name: string;
  total: number;
  errorRows: number;
  at: string;
};

export type RuleId = "il" | "mahalle" | "denge" | "kir" | "gecenAy";

export type RuleCfg = { id: RuleId; enabled: boolean; mandatory: boolean };

export type RuleSet = {
  rules: RuleCfg[]; // sıra = öncelik (ilk = en yüksek)
  kirCarpan: number;
  gecenAyYon: "rotasyon" | "sureklilik";
  kapasiteBirimi: "puan" | "is";
  kapasiteModu: "sert" | "orantili";
  sapma: number; // yüzde puan
  kapasiteAsimi: "atanamadi" | "uyari";
  iyilestirme: boolean;
};

export type Assignment = {
  jobId: string;
  empId: string | null;
  neden: string;
  uyari: string;
  manuel: boolean;
  sebep: string; // atanamadıysa sebep
};

export type EventType =
  | "personel_yuklendi"
  | "personel_onaylandi"
  | "kapasite_degisti"
  | "kurallar_secildi"
  | "is_yuklendi"
  | "is_onaylandi"
  | "dagitim"
  | "manuel"
  | "onay"
  | "indirme"
  | "oturum";

export type EventLog = {
  id: number;
  ts: string; // ISO
  type: EventType;
  message: string;
  data?: Record<string, unknown>;
};

import { tx } from "@/i18n";

export function mkErr(col: string, key: string, params?: Record<string, string | number>): CellError {
  return {
    col,
    key,
    params,
    get msg() {
      return tx(key, params);
    },
  };
}

/** Kural etiketleri geçerli dile göre erişim anında çevrilir. */
export const RULE_META = Object.fromEntries(
  (["il", "mahalle", "denge", "kir", "gecenAy"] as const).map((id) => [
    id,
    { get label() { return tx(`rule.${id}.label`); }, get desc() { return tx(`rule.${id}.desc`); } },
  ]),
) as Record<RuleId, { label: string; desc: string }>;

export const DEFAULT_RULESET: RuleSet = {
  rules: [
    { id: "il", enabled: true, mandatory: true },
    { id: "kir", enabled: true, mandatory: true },
    { id: "mahalle", enabled: true, mandatory: false },
    { id: "denge", enabled: true, mandatory: false },
    { id: "gecenAy", enabled: false, mandatory: false },
  ],
  kirCarpan: 1.5,
  gecenAyYon: "rotasyon",
  kapasiteBirimi: "puan",
  kapasiteModu: "orantili",
  sapma: 10,
  kapasiteAsimi: "atanamadi",
  iyilestirme: true,
};
