# TÜİK İş Dağıtım Aracı

Girişsiz, sunucusuz (tarayıcıda çalışan) iş dağıtım aracı. Akış: Personel → Kapasite → Kurallar → İş yükleme → Dağıtım → Ön onay → Onay/Çıktı → Süreç raporu → Genel özet ve paylaşım.

```bash
npm install --legacy-peer-deps
npm run dev      # http://localhost:3000
npx vitest run   # motor, CSV ve KVKK testleri
```

Örnek veri: `public/ornek/` (üretici: `scripts/ornek-veri.mjs`). Next.js + TypeScript, Tailwind, PapaParse, Zod, Zustand, Recharts, JSZip.
