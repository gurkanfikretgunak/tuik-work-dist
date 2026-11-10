# TÜİK İş Dağıtım Aracı

Girişsiz, sunucusuz (tarayıcıda çalışan) iş dağıtım aracı. Akış: Personel → Kapasite → Kurallar → İş yükleme → Dağıtım → Ön onay → Onay/Çıktı → Süreç raporu → Genel özet ve paylaşım.

```bash
npm install --legacy-peer-deps
npm run dev      # http://localhost:3000
npx vitest run   # motor, CSV ve KVKK testleri
```

Örnek veri: `public/ornek/` (üretici: `scripts/ornek-veri.mjs`). Next.js + TypeScript, Tailwind, PapaParse, Zod, Zustand, Recharts, JSZip.

## Motorlar
- **v1 — İş Dağıtım Motoru** (`src/screens`, `src/lib`): işleri çalışanlara dağıtır.
- **v2 — Defter Rotasyon Motoru** (`src/rotation`): N personel / N defter için aylık rotasyon planı (K1 tekrar yasağı, K2 takip yasağı, K3 yıllık eşitlik, isteğe bağlı K5). Ana sayfada seçilir.
