# i18n kuralları (tr varsayılan; en, fr, de, ja, zh)

Çekirdek: `src/i18n/index.ts`. Dil deposu `useLangStore`; seçici `App.tsx` başlığında.

## API
- **Bileşenlerde:** `const { t, rt, lang, locale } = useT();`
  - `t("anahtar", { n: 5 })` → string, `{n}` yer tutucularını doldurur.
  - `rt("anahtar", { n: <b>5</b> })` → ReactNode; çeviri metninde `<b>kalın</b>` ve `{param}` (ReactNode olabilir) kullanılabilir.
- **Bileşen dışı (motor, günlük, dışa aktarma):** `tx("anahtar", params)` ve `rtx(...)`; geçerli dili okur.
  Bu fonksiyonlar bir `useMemo` içinde kullanılıyorsa bağımlılığa `lang` (veya `useLang()`) ekleyin; aksi halde dil değişince eski metin kalır.
- **Biçimleme:** `monthName(i0)` (0–11), `fmtDateTime/fmtDate/fmtTime(...)`, `collate(a,b)`; `toLocaleString("tr-TR")` / `localeCompare(..., "tr")` KULLANMAYIN.
- Anahtar adları sabit string literal olmalı: `t("v1.s3.title")` — test bu literalleri tarar. Dinamik anahtar gerekiyorsa şablon dize kullanın ama tüm olası anahtarları sözlüğe ekleyin.

## Sözlük
- Her ekip kendi dosyasına yazar: `src/i18n/dict/<dosya>.ts`, `export const <ad>: Dict = { tr: {...}, en: {...}, fr: {...}, de: {...}, ja: {...}, zh: {...} }`.
- Altı dilde AYNI anahtarlar, boş değer yok, `{yer_tutucu}` adları ve `<b>` sayısı tüm dillerde aynı olmalı. Kontrol: `npx vitest run src/i18n`.
- Anahtar öneki: dosyaya göre (`v1ui.`, `v1core.`, `v2core.`, `v2ui.` + ekran/ alan). `common.ts` (c.*, step.*, rule.*, app.*) hazır; yeniden tanımlamayın, `t("c.back")` gibi kullanın.
- Çeviri kalitesi: doğal, kısa, arayüz dili. Resmî terimler: TÜİK = TurkStat (en), TÜİK (diğer dillerde kısaltma korunur). "Defter" = notebook (en), carnet (fr), Heft (de), 帳簿 (ja), 账册 (zh). "Kır/kent" = rural/urban. Tarih, sayı ve birimler için yerel biçim.
- Çevrilmeyecekler: CSV sütun adları (calisan_id, is_id, atanan_calisan_id, defter_no, … şema), dosya adları (atama_sonucu.csv …), örnek veri dosyaları, JSON anahtarları, kimlikler (C-001), `data-testid`'ler, kod yorumları.
  Dışa aktarılan CSV/JSON'daki değer metinleri (Evet/Hayır, atama nedeni, uyarı) ise şemanın parçasıdır: BU SÜRÜMDE değişmez/ya da teknik kodla kalır — bkz. ekip talimatı.
- Kalan çevrilmemiş metni bulmak için: `node scripts/i18n-scan.mjs <yol>`.

## Doğrulama
`npx tsc --noEmit`, `npx eslint src`, `npx vitest run` temiz olmalı.
