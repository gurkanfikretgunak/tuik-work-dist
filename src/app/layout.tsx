import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TÜİK İş Dağıtım Aracı",
  description: "Personel kapasitesine ve kurallara göre iş dağıtımı — tarayıcıda çalışır, veri sunucuya gönderilmez.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="min-h-screen bg-white antialiased">{children}</body>
    </html>
  );
}
