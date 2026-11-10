# -*- coding: utf-8 -*-
"""
Defter Rotasyon Motoru - 2 (v4) kullanım kılavuzunu (PDF) üretir.

Kurulum (proje bağımlılığı değildir; yalnızca kılavuzu yeniden üretmek için):
  python3 -m venv /tmp/kvenv && /tmp/kvenv/bin/pip install "reportlab==4.2.5"
Çalıştırma:
  /tmp/kvenv/bin/python scripts/kilavuz_v4.py docs/Defter_Rotasyon_Motoru_2_Kullanim_Kilavuzu.pdf
Yazı tipi: macOS Arial / Arial Unicode (Türkçe karakter ve ★ ⇄ için).
"""
import re
import sys

from reportlab.graphics.shapes import Drawing, Line, Rect, String
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (KeepTogether, PageBreak, CondPageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle)
from reportlab.platypus.flowables import HRFlowable

OUT = sys.argv[1] if len(sys.argv) > 1 else "Defter_Rotasyon_Motoru_2_Kullanim_Kilavuzu.pdf"
FD = "/System/Library/Fonts/Supplemental/"
pdfmetrics.registerFont(TTFont("Ar", FD + "Arial.ttf"))
pdfmetrics.registerFont(TTFont("Ar-B", FD + "Arial Bold.ttf"))
pdfmetrics.registerFont(TTFont("Ar-I", FD + "Arial Italic.ttf"))
pdfmetrics.registerFont(TTFont("ArU", FD + "Arial Unicode.ttf"))
pdfmetrics.registerFontFamily("Ar", normal="Ar", bold="Ar-B", italic="Ar-I", boldItalic="Ar-B")
MONO = "Courier"

NAVY = colors.HexColor("#1F2A44")
RED = colors.HexColor("#C92830")
GREY = colors.HexColor("#5B6477")
LIGHT = colors.HexColor("#F1F4F9")
LINE = colors.HexColor("#D5DAE3")

# Arial'da bulunmayan simgeleri Arial Unicode ile yaz.
_face = pdfmetrics.getFont("Ar").face.charToGlyph
_SYM = [c for c in "★⇄→≤≥" if ord(c) not in _face]


def U(s):
    if not _SYM:
        return s
    return re.sub("([" + "".join(_SYM) + "])", r'<font name="ArU">\1</font>', s)


def st(name, **kw):
    base = dict(fontName="Ar", fontSize=10, leading=14.5, textColor=colors.HexColor("#1b2233"), alignment=TA_LEFT)
    base.update(kw)
    return ParagraphStyle(name, **base)


S = {
    "body": st("body", spaceAfter=5),
    "small": st("small", fontSize=8.5, leading=12, textColor=GREY),
    "h1": st("h1", fontName="Ar-B", fontSize=15, leading=19, textColor=NAVY, spaceBefore=10, spaceAfter=4),
    "h2": st("h2", fontName="Ar-B", fontSize=11.5, leading=15, textColor=NAVY, spaceBefore=8, spaceAfter=3),
    "bul": st("bul", leftIndent=13, bulletIndent=2, spaceAfter=2),
    "cell": st("cell", fontSize=8.8, leading=11.6),
    "cellb": st("cellb", fontName="Ar-B", fontSize=8.8, leading=11.6, textColor=colors.white),
    "code": st("code", fontName=MONO, fontSize=8.6, leading=11.5, backColor=LIGHT, borderPadding=(4, 5, 4, 5), spaceBefore=3, spaceAfter=8),
    "note": st("note", fontSize=9.3, leading=13.3, backColor=colors.HexColor("#FFF7E0"), borderColor=colors.HexColor("#F2C94C"), borderWidth=0.6, borderPadding=(5, 6, 5, 6), spaceBefore=4, spaceAfter=9),
    "tip": st("tip", fontSize=9.3, leading=13.3, backColor=colors.HexColor("#EAF6EE"), borderColor=colors.HexColor("#7BC48F"), borderWidth=0.6, borderPadding=(5, 6, 5, 6), spaceBefore=4, spaceAfter=9),
}


def P(t, s="body"):
    return Paragraph(U(t), S[s])


def B(items):
    return [Paragraph(U(t), S["bul"], bulletText="•") for t in items] + [Spacer(1, 6)]


def H1(t):
    return [CondPageBreak(60 * mm), Paragraph(U(t), S["h1"]), HRFlowable(width="100%", thickness=1.2, color=RED, spaceAfter=6)]


def H2(t):
    return Paragraph(U(t), S["h2"])


def table(head, rows, widths, zebra=True):
    data = [[Paragraph(U(h), S["cellb"]) for h in head]] + [[Paragraph(U(str(c)), S["cell"]) for c in r] for r in rows]
    t = Table(data, colWidths=widths, repeatRows=1)
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), NAVY), ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.4, LINE), ("LEFTPADDING", (0, 0), (-1, -1), 5), ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]
    if zebra:
        style += [("BACKGROUND", (0, i), (-1, i), LIGHT) for i in range(2, len(data), 2)]
    t.setStyle(TableStyle(style))
    return t


# ---------------------------------------------------------------- çizimler
def flow_drawing():
    w, h = 170 * mm, 24 * mm
    d = Drawing(w, h)
    steps = ["0 Parametreler", "1 Plan üretimi", "2 İnceleme", "3 Onay ve çıktı"]
    bw, gap = 38 * mm, 6 * mm
    for i, s in enumerate(steps):
        x = i * (bw + gap)
        d.add(Rect(x, 4 * mm, bw, 16 * mm, rx=3, ry=3, fillColor=NAVY if i < 3 else RED, strokeColor=None))
        d.add(String(x + bw / 2, 10.6 * mm, s, fontName="Ar-B", fontSize=9.5, fillColor=colors.white, textAnchor="middle"))
        if i < 3:
            d.add(Line(x + bw + 0.8 * mm, 12 * mm, x + bw + gap - 0.8 * mm, 12 * mm, strokeColor=GREY, strokeWidth=1.4))
    return d


def tier_drawing():
    w, h = 170 * mm, 62 * mm
    d = Drawing(w, h)
    d.add(String(0, h - 5 * mm, "Her ay, her kişi:", fontName="Ar-B", fontSize=10, fillColor=NAVY))
    d.add(Rect(0, 22 * mm, 62 * mm, 30 * mm, rx=4, ry=4, fillColor=colors.HexColor("#DCE6F7"), strokeColor=NAVY))
    d.add(String(31 * mm, 44 * mm, "Şehir içi katman", fontName="Ar-B", fontSize=10, fillColor=NAVY, textAnchor="middle"))
    d.add(String(31 * mm, 37 * mm, "n defter (M1 … Mn)", fontName="Ar", fontSize=9, fillColor=NAVY, textAnchor="middle"))
    d.add(String(31 * mm, 30 * mm, "1, 3, 6 haftalık (varsayılan)", fontName="Ar", fontSize=8.5, fillColor=GREY, textAnchor="middle"))
    d.add(Rect(70 * mm, 22 * mm, 100 * mm, 30 * mm, rx=4, ry=4, fillColor=colors.HexColor("#FBE3E4"), strokeColor=RED))
    d.add(String(120 * mm, 44 * mm, "Şehir dışı katman", fontName="Ar-B", fontSize=10, fillColor=RED, textAnchor="middle"))
    regs = [("Bölge A", "4"), ("Bölge B", "3"), ("Bölge C", "3")]
    for i, (n, c) in enumerate(regs):
        x = 74 * mm + i * 32 * mm
        d.add(Rect(x, 25 * mm, 30 * mm, 14 * mm, rx=2, ry=2, fillColor=colors.white, strokeColor=RED))
        d.add(String(x + 15 * mm, 33 * mm, n, fontName="Ar-B", fontSize=8.5, fillColor=RED, textAnchor="middle"))
        d.add(String(x + 15 * mm, 27.6 * mm, c + " defter", fontName="Ar", fontSize=8, fillColor=GREY, textAnchor="middle"))
    d.add(String(0, 14 * mm, "Her iki katmanda ayrı ayrı: K1 tekrar yok · K2 takip sınırı · K3 yıllık eşitlik · K6 haftalık defter peş peşe yok", fontName="Ar", fontSize=8.6, fillColor=GREY))
    d.add(String(0, 8 * mm, "Yalnızca şehir dışında: bölge dengesi (defter sayısıyla orantılı, en yakın eşitlik)", fontName="Ar", fontSize=8.6, fillColor=GREY))
    d.add(String(0, 2 * mm, "Bölge defter sayılarının toplamı = kişi sayısı = her katmandaki defter sayısı", fontName="Ar-B", fontSize=8.6, fillColor=NAVY))
    return d


def mini_plan():
    rows = [["Ay", "P-01", "P-02", "P-03", "P-04"],
            ["Ocak", "M3★", "M4", "M2", "M7"], ["Şubat", "M5", "M9", "M1★", "M2"], ["Mart", "M10", "M6★", "M4", "M3★"]]
    out = [[Paragraph(U(c), S["cell"]) for c in r] for r in rows]
    t = Table(out, colWidths=[24 * mm, 20 * mm, 20 * mm, 20 * mm, 20 * mm])
    t.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.4, LINE), ("BACKGROUND", (0, 0), (-1, 0), LIGHT), ("ALIGN", (1, 0), (-1, -1), "CENTER"),
                           ("TOPPADDING", (0, 0), (-1, -1), 2), ("BOTTOMPADDING", (0, 0), (-1, -1), 2)]))
    return t


# ---------------------------------------------------------------- sayfa
def on_page(c, doc):
    c.saveState()
    c.setFont("Ar", 8)
    c.setFillColor(GREY)
    c.drawString(20 * mm, 11 * mm, "Defter Rotasyon Motoru - 2 (v4) · Kullanım Kılavuzu")
    c.drawRightString(A4[0] - 20 * mm, 11 * mm, "Sayfa %d" % doc.page)
    c.setStrokeColor(LINE)
    c.line(20 * mm, 15 * mm, A4[0] - 20 * mm, 15 * mm)
    c.restoreState()


def cover(c, doc):
    c.saveState()
    c.setFillColor(NAVY)
    c.rect(0, A4[1] - 92 * mm, A4[0], 92 * mm, stroke=0, fill=1)
    c.setFillColor(RED)
    c.rect(0, A4[1] - 95 * mm, A4[0], 3 * mm, stroke=0, fill=1)
    c.setFillColor(colors.white)
    c.setFont("Ar", 11)
    c.drawString(22 * mm, A4[1] - 28 * mm, "TÜİK İş Dağıtım Aracı")
    c.setFont("Ar-B", 27)
    c.drawString(22 * mm, A4[1] - 52 * mm, "Defter Rotasyon Motoru - 2")
    c.setFont("Ar", 15)
    c.drawString(22 * mm, A4[1] - 64 * mm, "(v4) Kullanım Kılavuzu")
    c.setFont("Ar", 10.5)
    c.drawString(22 * mm, A4[1] - 80 * mm, "Şehir içi + şehir dışı · bölge dengesi · izin · elle takas · HTML/PDF rapor")
    c.setFillColor(GREY)
    c.setFont("Ar", 9.5)
    c.drawString(22 * mm, 26 * mm, "Yazar: gurkanfikretgunak")
    c.drawString(22 * mm, 20 * mm, "Sürüm: v4 · Tarih: 10 Kasım 2026")
    c.drawString(22 * mm, 14 * mm, "Veriler yalnızca tarayıcıda işlenir; sunucuya gönderilmez.")
    c.restoreState()


story = []
story += [Spacer(1, 108 * mm)]
story += [P("<b>Bu kılavuz kimler için?</b> Defter rotasyon planını hazırlayan ve onaylayan birim yöneticileri ile bu aracı kullanan analistler için hazırlanmıştır. Aracı daha önce hiç kullanmamış biri, bu kılavuzla ilk planını yaklaşık on dakikada üretebilir.", "body")]
story += [P("Kılavuz, aracın dördüncü motoru olan <b>Defter Rotasyon Motoru - 2 (v4)</b> ile ilgilidir. Mevcut v2 motoru değişmeden durur; v4 onun ikiz bir kardeşidir ve aynı arama motorunu iki katmanlı (şehir içi + şehir dışı) bir düzende kullanır.", "body")]
story += [PageBreak()]

# 1
story += H1("1. Amaç ve kapsam")
story += [P("Bazı iş akışlarında her personelin her ay bir <b>şehir içi</b> ve bir <b>şehir dışı</b> defter üstlenmesi gerekir. Defterlerin aylar içinde adil ve kurallara uygun biçimde el değiştirmesi elle yapıldığında hataya açıktır. v4 motoru, kuralları sağlayan bir yıllık planı otomatik üretir; planı sizin incelemenize, düzeltmenize ve onayınıza sunar."),
          P("Motor şunları yapar:")]
story += B([
    "Her ay her kişiye <b>1 şehir içi + 1 şehir dışı</b> defter atar.",
    "İki katmanı birbirinden bağımsız çözer; kuralları her katmanda <b>ayrı ayrı</b> sayar.",
    "Şehir dışı defterleri <b>bölgelere</b> ayırır ve görevleri bölgeler arasında en yakın eşitlikte dağıtır.",
    "İzinleri (K7) hesaba katar, haftalık defterlerin peş peşe aylarda aynı kişiye gelmesini önler.",
    "Planı renkli tabloda gösterir, kuralları doğrular, elle takasa izin verir ve HTML/PDF rapor üretir.",
])
story += [P("<b>Gizlilik:</b> Hiçbir veri sunucuya gönderilmez, giriş yapılmaz. Tüm hesaplama tarayıcınızda yapılır. Yalnızca dil tercihiniz tarayıcıda saklanır.", "tip")]
story += [P("<b>Not:</b> Metindeki Adıyaman, Kilis ve Nizip örneği yalnızca bir <i>referans çalışmadır</i>. Araç şehir adlarına bağlı değildir; bölgeleri ve adlarını siz tanımlarsınız.", "note")]

# 2
story += H1("2. Temel kavramlar")
story += [tier_drawing(), Spacer(1, 4)]
story += [table(["Kavram", "Açıklama"], [
    ["Katman", "Defterlerin iki türü: <b>şehir içi</b> ve <b>şehir dışı</b>. Her katmanda kişi sayısı kadar defter bulunur."],
    ["Bölge", "Şehir dışı defterlerin gruplandığı alan (ad, kısa kod, defter sayısı). Bölge defter sayılarının toplamı kişi sayısına eşit olmalıdır."],
    ["Haftalık defter (★)", "Haftalık özel defter. Aynı kişiye peş peşe aylarda gelmez (K6). Şehir içinde varsayılan 1, 3, 6; şehir dışında her bölgenin son defteri."],
    ["Takip", "Bir defterde A kişisinden sonra B kişisinin gelmesi. Aynı (A→B) çiftinin yıl içinde tekrarı bir sınırla kısıtlanır (K2)."],
    ["Aday plan", "Motorun bulduğu geçerli plan. Her katman için en iyi 3 aday sunulur; birini seçersiniz."],
    ["Tohum", "Aynı parametre ve tohumla aynı plan üretilir; farklı plan için tohumu değiştirin."],
], [38 * mm, 132 * mm])]
story += [Spacer(1, 6), H2("Kurallar")]
story += [table(["Kod", "Kural", "Tür"], [
    ["K1", "Bir defter, aynı kişiye <i>G</i> ay içinde (varsayılan 2) geri dönmez.", "Zorunlu"],
    ["K2", "Aynı devir çifti (A→B) yıl içinde en fazla bir sınır kadar tekrarlanır. Sınır otomatik hesaplanır; sağlanamazsa +1 gevşetilir ve bildirilir.", "Zorunlu"],
    ["K3", "Yıllık eşitlik: kişi × defter sayıları, gerçekleşen dağıtım sayısından türetilen hedef aralığında kalır.", "Zorunlu"],
    ["K6", "Haftalık (★) defterler aynı kişiye peş peşe aylarda gelmez (aralık ayarlanabilir).", "Zorunlu"],
    ["K7", "İzin: bir ayın belirli oranı (varsayılan %50) ve üstü izinli olan kişi o ay “yok” sayılır; görev almaz.", "Girdi"],
    ["Bölge dengesi", "Şehir dışında kişinin bölge başına görev sayısı, bölgenin defter sayısıyla orantılı hedefe en yakın olur. Tolerans 1,5.", "Yumuşak"],
], [24 * mm, 120 * mm, 26 * mm])]
story += [P("“Zorunlu” kurallar iki katmanda da sağlanmazsa plan <b>Kaldı</b> olarak işaretlenir. “Yumuşak” kural bir sapma gösterir ama planı geçersiz kılmaz.", "small")]

# 3
story += H1("3. Hızlı başlangıç")
story += [flow_drawing(), Spacer(1, 4)]
story += [P("Ekranın üstündeki sekmeler dört adımı gösterir. Bir adıma yalnızca önceki adımı tamamladıktan sonra geçebilirsiniz.")]
story += B([
    "Ana sayfada <b>Defter Rotasyon Motoru - 2</b> kartında <b>v4 ile başla</b> düğmesine basın ve açılan onayı kabul edin.",
    "Örnek görmek istiyorsanız <b>Örnek çalışmayı yükle</b> düğmesine basın (10 kişi; Adıyaman 4, Kilis 3, Nizip 3 defter).",
    "<b>Plan üretimine geç</b> → <b>Planı üret</b> ile yaklaşık 6 saniyede planı oluşturun.",
    "<b>İncelemeye geç</b>: her katman için adayları, tabloları ve doğrulamaları gözden geçirin.",
    "<b>Onaya geç</b> → <b>Planı onayla</b>. Onaydan sonra çıktıları ve HTML raporu indirebilirsiniz.",
])
story += [P("<b>İpucu:</b> Parametrelerden birini değiştirdiğinizde mevcut plan silinir; böylece ekrandaki plan her zaman güncel parametrelere aittir.", "tip")]

# 4
story += H1("4. Ekran ekran kullanım")
story += [H2("Adım 0 · Parametreler")]
story += [P("<b>Genel parametreler</b>")]
story += [table(["Alan", "Anlamı", "Varsayılan"], [
    ["Personel sayısı", "Aynı zamanda her katmandaki defter sayısıdır. <b>Değiştirilebilir.</b> Değiştirince bölgeler ve defter listeleri yeniden dağıtılır.", "10"],
    ["Ay sayısı", "Plan kaç ay sürecek.", "12"],
    ["Başlangıç yılı / ayı", "Plan takviminin başlangıcı. İzin tarihleri bu aralıkta olmalıdır.", "Gelecek yıl, Ocak"],
    ["K1: en az ay aralığı (G)", "Aynı defterin aynı kişiye tekrar gelmesi için geçmesi gereken ay.", "2"],
    ["K6: haftalık arası en az ay", "1 = peş peşe aylarda yasak; 0 = kural kapalı.", "1"],
    ["Tohum", "Arama başlangıç değeri; plan çeşitliliği için değiştirin.", "1"],
], [42 * mm, 98 * mm, 30 * mm])]
story += [Spacer(1, 4), P("Altta <b>K2 alt sınırı</b> otomatik gösterilir (10 kişi, 12 ay için 2). Şehir içi ve şehir dışı ayrı sayılır.", "small")]
story += [P("<b>Şehir dışı bölgeleri.</b> Her bölge için ad, kısa kod ve defter sayısı girin; <b>Bölge ekle</b> ile yenisini ekleyebilirsiniz. Toplam rozeti <i>Toplam 10 / 10</i> yeşil olmalıdır. Toplam kişi sayısına eşit değilse kırmızı olur ve plan üretimi engellenir.")]
story += [P("<b>Defter tabloları.</b> Şehir içi ve şehir dışı defterlerin kodlarını düzenleyebilir, <b>Haftalık (★)</b> kutusunu işaretleyip kaldırabilirsiniz. Haftalık defter sayısı, peş peşe yasağı için en fazla “defter sayısı ÷ 2” olmalıdır; aksi halde bir uyarı çıkar.")]
story += [P("<b>Personel.</b> Kimlik (örn. P-01) ve isteğe bağlı ad girilir. Ad boşsa “Personel n” görünür.")]
story += [P("<b>İzin (K7).</b> Kişi, başlangıç ve bitiş tarihini seçip <b>Ekle</b>ye basın; ya da <font name='Courier'>izinler.csv</font> dosyasını sürükleyin. Eşik (%25/%50/%75/%100) bir ayın ne kadarının izinli olması halinde kişinin o ay “yok” sayılacağını belirler. Tablo satırlarını işaretleyerek izni geçici olarak devre dışı bırakabilirsiniz.")]
story += [Paragraph("calisan_id,baslangic,bitis,not<br/>P-03,2027-03-01,2027-03-31,yillik izin<br/>P-07,15.07.2027,25.07.2027,", S["code"])]
story += [P("Tarih biçimleri: YYYY-AA-GG, GG.AA.YYYY veya GG/AA/YYYY. Sütun adları değişmez.", "small")]

story += [H2("Adım 1 · Plan üretimi")]
story += [P("<b>Planı üret</b> düğmesi iki katmanı sırayla arar (toplam süre yaklaşık 6 sn; yarısı şehir içine, yarısı şehir dışına). Şehir dışında çok sayıda aday bulunur ve bölge dengesi en iyi olan üçü saklanır. Sonuç kartında aday sayıları, kullanılan takip sınırı ve en iyi bölge sapması görünür.")]
story += [P("Kurallar istenen sınırla sağlanamazsa takip sınırı kademeli gevşetilir ve sarı bir kartta bildirilir. Hiç plan bulunamazsa kırmızı kart nedenini söyler; genellikle ay veya izin düzenini gevşetmek yeterlidir.", "note")]

story += [H2("Adım 2 · İnceleme")]
story += [P("Üstte her katman için <b>Aday 1–3</b> düğmeleri vardır. İki katmanın adayları birbirinden bağımsız seçilir. Özet kutuları zorunlu kural durumunu, iki katmanın en çok takip sayısını, peş peşe haftalık ihlallerini ve bölge sapmasını gösterir.")]
story += [mini_plan(), Spacer(1, 3), P("Plan tablosu: satırlar aylar, sütunlar kişilerdir. Hücrede o ay kişinin aldığı defterin kodu yazar; <b>★</b> haftalık defteri, <b>İ</b> izinli kişiyi, <b>kırmızı çerçeve</b> K1 veya K6 ihlalini gösterir.", "small")]
story += [P("<b>Elle takas.</b> Aynı ay ve aynı katmanda iki kişinin hücresine sırayla tıklayın. Araç, takasın hangi kuralları bozacağını (örn. “K2 sınırı aşan çift: 0 → 2”) gösterir. Kuralı bozmayan takası onaylayabilir; bozan takası ise yalnızca <i>İhlale rağmen takas et</i> ile yapabilirsiniz. Her takas günlüğe ve rapora yazılır.")]
story += [P("<b>Doğrulama kartları</b> her katman için aylık düzen, K1, K2, K3 ve K6 sonuçlarını Geçti/Kaldı olarak verir. <b>Bölge tablosu</b> her kişinin her bölgede kaç görev aldığını gösterir; farenin üstüne gelince hedef değer görünür.")]

story += [H2("Adım 3 · Onay ve çıktı")]
story += [P("<b>Planı onayla</b> düğmesi son durumu onaylar (kurallar sağlanmıyorsa uyarır). Onaydan sonra dosya kutuları ve indirme düğmeleri açılır. <b>Seçilenleri indir</b> ayrı dosyaları, <b>ZIP</b> tümünü tek paket olarak indirir. Her indirme öncesi bir gizlilik uyarısı çıkar.")]

# 5
story += H1("5. Çıktı dosyaları")
story += [table(["Dosya", "İçerik"], [
    ["<font name='Courier'>defter_plani_2.csv</font>", "Plan. Sütunlar: yil, ay, calisan_id, katman (sehir_ici / sehir_disi), defter_kodu, bolge_kodu, haftalik (evet / hayir)."],
    ["<font name='Courier'>bolge_dengesi.csv</font>", "Kişi başına bölge sayıları, toplam ve her bölge için hedef (orantılı) değer."],
    ["<font name='Courier'>dogrulama_raporu_2.json</font>", "İki katman için kural sonuçları, en çok takip ve sınır, bölge sapması, gevşetilen kurallar, takas sayısı, olay günlüğü."],
    ["<font name='Courier'>parametreler_2.json</font>", "Tüm girdiler: parametreler, bölgeler, defterler, personel, izinler, seçilen aday, tohum, elle takaslar. Planı yeniden üretmek için yeterlidir."],
    ["<font name='Courier'>rapor_2.html</font>", "Kendi içinde tam, görüntülenebilir rapor (aşağıya bakın)."],
], [56 * mm, 114 * mm])]
story += [Spacer(1, 6), H2("HTML ve PDF rapor")]
story += [P("Onay ekranındaki <b>Rapor</b> kartı üç iş yapar:")]
story += B([
    "<b>Raporu göster:</b> raporu sayfa içinde önizler.",
    "<b>Yazdır / PDF:</b> tarayıcının yazdırma penceresini açar. Hedef olarak <b>“PDF olarak kaydet”</b> seçerek PDF alırsınız. Sayfa düzeni A4 yataydır.",
    "<b>HTML indir:</b> <font name='Courier'>rapor_2.html</font> dosyasını indirir (onaydan sonra). Dosya harici kaynak yüklemez; çevrimdışı açılır ve e-postayla paylaşılabilir.",
])
story += [P("Rapor; parametreleri, iki katmanın plan tablolarını ve kural durumunu, bölge tablosunu, izinleri ve elle takasları içerir. Onaylanmamış plan raporda <b>Taslak</b>, kural bozan plan <b>Kaldı</b> olarak görünür; rapor durumu olduğundan iyi göstermez.", "tip")]

# 6
story += H1("6. Sayısal not: eşitlik ne kadar mümkün?")
story += [P("Bölgelerin defter sayıları farklı olduğunda (örneğin 4 / 3 / 3) kişi başına bölge sayıları tam eşit olamaz; çünkü bölgelerin yıllık toplam slot sayıları farklıdır. Motor bu nedenle <b>eşite en yakın</b> dağılımı hedefler.")]
story += [table(["Plan süresi", "Slot sayısı (A / B / C)", "Kişi başına", "Sonuç"], [
    ["10 ay (ay = kişi)", "40 / 30 / 30", "4 / 3 / 3", "Tam orantılı eşitlik"],
    ["12 ay", "48 / 36 / 36", "4,8 / 3,6 / 3,6", "Kişiler arasında ±1 sapma; hedefe en yakın dağılım seçilir"],
], [34 * mm, 42 * mm, 34 * mm, 60 * mm])]
story += [Spacer(1, 5), P("Varsayılan 10 kişi / 12 ay kurulumunda ölçülen en büyük bölge sapması <b>1,20</b> (tolerans 1,5). Takip sınırı için kuramsal alt sınır, (ay − 1) / (kişi − 1) değerinin yukarı yuvarlanmış halidir; 10 kişi, 12 ay için 2’dir: her devir çifti yıl içinde en fazla 2 kez görülür.")]
story += [P("<b>Haftalık defter uygulanabilirliği:</b> peş peşe yasağı için bir katmandaki haftalık defter sayısı en fazla defter sayısının yarısı kadar olabilir. 10 defterde 3 haftalık defter rahatça sağlanır.", "small")]

# 7
story += H1("7. Sık karşılaşılan durumlar")
story += [table(["Durum", "Ne yapmalı?"], [
    ["“Toplam 9 / 10” kırmızı; üret düğmesi pasif", "Bölge defter sayılarının toplamı kişi sayısına eşit olmalı. Bir bölgenin sayısını artırın/azaltın."],
    ["Plan bulunamadı", "Ay sayısını azaltın, G’yi 1 yapın, haftalık defter sayısını düşürün ya da izinleri gözden geçirin; tohumu değiştirip yeniden üretin."],
    ["“Kısıt gevşetildi” kartı", "Otomatik K2 sınırı sağlanamadı, +1 ile bulundu. Plan geçerlidir; rapora gevşetme yazılır."],
    ["Bir ayda izinli kişi çok", "Boş kalan defterler müsait kişilere ek olarak verilir (kişi başı en fazla 2). Bu mümkün değilse hata gösterilir."],
    ["Bölge sapması amber", "Sapma 1,5’in üzerinde; yeniden üretin veya tohumu değiştirin. Yumuşak kuraldır, planı geçersiz kılmaz."],
    ["Elle takas sonrası “Kaldı”", "Takas bir zorunlu kuralı bozdu. Takası geri almak için adayı yeniden seçin (takaslar sıfırlanır)."],
    ["Parametreyi değiştirince plan silindi", "Beklenen davranış; plan her zaman güncel parametreleri yansıtır."],
], [62 * mm, 108 * mm])]

# 8
story += H1("8. Sınırlamalar ve sonraki adımlar")
story += B([
    "Önceki dönemden devam (geçmiş K1/K2 verisini içe aktarma) henüz yok; her plan sıfırdan başlar.",
    "Yasak ve sabit atamalar (belirli kişiyi belirli deftere hiç/mutlaka verme) bu motorda yok.",
    "K6 aralığı iki katmanda ortaktır; katman başına ayrı aralık yoktur.",
    "Arama ana iş parçacığında çalışır; çok büyük personel sayılarında yavaşlayabilir.",
    "Çeviriler (TR, EN, FR, DE, JA, ZH) makine tarafından yazılmıştır; resmî kullanımdan önce gözden geçirilmelidir.",
])
story += [Spacer(1, 10), HRFlowable(width="100%", thickness=0.6, color=LINE), Spacer(1, 4)]
story += [P("<b>Yazar:</b> gurkanfikretgunak · <b>Kaynak kod:</b> proje deposundaki <font name='Courier'>src/rotation2/</font> klasörü. Teknik ayrıntılar için <font name='Courier'>AGENTS.md</font> ve <font name='Courier'>README.md</font> dosyalarına bakın.", "small")]

doc = SimpleDocTemplate(OUT, pagesize=A4, leftMargin=20 * mm, rightMargin=20 * mm, topMargin=18 * mm, bottomMargin=20 * mm,
                        title="Defter Rotasyon Motoru - 2 (v4) Kullanım Kılavuzu", author="gurkanfikretgunak",
                        subject="TÜİK İş Dağıtım Aracı - v4", creator="reportlab")
doc.build(story, onFirstPage=cover, onLaterPages=on_page)
print("yazıldı:", OUT)
