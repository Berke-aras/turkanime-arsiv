#!/usr/bin/env python3
"""GitHub sosyal önizleme görselini ve sitenin og:image'ini üretir.

    pip install pillow
    python3 scripts/social-gorsel.py

Neden burada: GitHub arama sonuçlarında ve paylaşılan linklerde çıkan görsel (§7.6).
Sanat, README'deki `docs/assets/loop-1.gif` animasyonunun bir karesi — repodaki görsel
dille aynı kalsın diye yeni bir çizim aranmadı.

Çıktılar:
  docs/assets/social-preview.png  1280x640  → GitHub Settings > General > Social preview
  og-image.png                    1200x630  → index.html'deki og:image / twitter:image

Yazı tipi: Inter. Render için TTF gerekiyor; repodaki `fonts/*.woff2` PIL tarafından
okunamadığı için TTF'ler Google Fonts'tan geçici bir dizine indiriliyor (repoya girmiyor).
Ağ yoksa script sistem fontuna düşer ve bunu söyler.
"""
import os, re, subprocess, sys, tempfile, urllib.request
from PIL import Image, ImageDraw, ImageFont, ImageFilter

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GECICI = os.path.join(tempfile.gettempdir(), 'tka-inter-ttf')
UA_ESKI = 'Mozilla/4.0'   # eski user-agent: Google Fonts woff2 yerine ttf veriyor

BG1, BG2 = (10, 12, 17), (21, 24, 39)
ACCENT, ACCENT2 = (108, 141, 255), (143, 108, 255)
BEYAZ, GRI, CIP_ZEMIN, CIP_KENAR = (238, 240, 246), (183, 188, 203), (25, 29, 39), (53, 60, 80)

# Katalog sayıları: kaynak/data.js'ten okunuyor ki görsel veriyle birlikte tazelensin.
def sayilar():
    metin = open(os.path.join(KOK, 'kaynak', 'data.js'), encoding='utf-8').read()
    kayitlar = re.findall(r'\[("(?:[^"\\]|\\.)*"),(?:[^][]|\[[^]]*\])*?\]', metin)
    bolum = link = 0
    for m in re.finditer(r',(\d+),(\d+)\]', metin):
        bolum += int(m.group(1)); link += int(m.group(2))
    return len(kayitlar), bolum, link

def tr(n):
    return f'{n:,}'.replace(',', '.')

def fontlar():
    os.makedirs(GECICI, exist_ok=True)
    yollar = {}
    try:
        css = urllib.request.urlopen(urllib.request.Request(
            'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;800&display=swap',
            headers={'User-Agent': UA_ESKI}), timeout=20).read().decode()
        for agirlik, url in re.findall(r'font-weight: (\d+);\s*font-display: swap;\s*src: url\((https://[^)]+\.ttf)\)', css):
            yol = os.path.join(GECICI, f'Inter-{agirlik}.ttf')
            if not os.path.exists(yol):
                urllib.request.urlretrieve(url, yol)
            yollar[int(agirlik)] = yol
    except Exception as e:                       # ağ yoksa sistem fontuna düş
        print(f'! Inter indirilemedi ({e}); sistem fontu kullanılacak', file=sys.stderr)
    return yollar

YOLLAR = {}
def font(agirlik, boyut):
    yol = YOLLAR.get(agirlik)
    return ImageFont.truetype(yol, boyut) if yol else ImageFont.load_default(boyut)

def ciz(genislik, yukseklik):
    o = genislik / 1280.0                        # 1280x640 tasarımına göre ölçek
    px = lambda v: int(round(v * o))

    tuval = Image.new('RGB', (genislik, yukseklik))
    d = ImageDraw.Draw(tuval)
    for x in range(genislik):                    # köşegen his veren yatay gradyan
        t = x / genislik
        d.line([(x, 0), (x, yukseklik)], fill=tuple(int(BG1[i] + (BG2[i] - BG1[i]) * t) for i in range(3)))

    # --- sağda README gif'inin bir karesi, sol kenarı zemine eriyor ---
    gif = Image.open(os.path.join(KOK, 'docs/assets/loop-1.gif')); gif.seek(2)
    kare = gif.convert('RGB')
    sanat_g = px(560)
    sanat = kare.resize((sanat_g, int(kare.height * sanat_g / kare.width)), Image.LANCZOS)
    sanat = sanat.filter(ImageFilter.UnsharpMask(radius=1.4, percent=90, threshold=3))
    if sanat.height > yukseklik:                 # yüzler görünsün diye üstten az kırp
        ust = int((sanat.height - yukseklik) * 0.22)
        sanat = sanat.crop((0, ust, sanat_g, ust + yukseklik))
    else:
        sanat = sanat.resize((sanat_g, yukseklik), Image.LANCZOS)
    gecis = px(240)
    maske = Image.new('L', (sanat_g, yukseklik), 255)
    md = ImageDraw.Draw(maske)
    for x in range(gecis):
        md.line([(x, 0), (x, yukseklik)], fill=int(255 * (x / gecis) ** 1.4))
    tuval.paste(sanat, (genislik - sanat_g, 0), maske)

    # --- logo karesi (sitenin ikonuyla aynı gradyan) ---
    lx, ly, ls = px(80), px(92), px(104)
    logo = Image.new('RGB', (ls, ls))
    ld = ImageDraw.Draw(logo)
    for i in range(ls):
        t = i / ls
        ld.line([(0, i), (ls, i)], fill=tuple(int(ACCENT[k] + (ACCENT2[k] - ACCENT[k]) * t) for k in range(3)))
    yuvarlak = Image.new('L', (ls, ls), 0)
    ImageDraw.Draw(yuvarlak).rounded_rectangle([0, 0, ls - 1, ls - 1], radius=px(24), fill=255)
    tuval.paste(logo, (lx, ly), yuvarlak)
    d.text((lx + ls / 2, ly + ls / 2), 'T', font=font(800, px(62)), fill=(255, 255, 255), anchor='mm')

    # --- metinler ---
    d.text((px(80), px(232)), 'TürkAnime Arşivi', font=font(800, px(66)), fill=BEYAZ)
    d.text((px(80), px(318)), 'turkanime.tv kapandı.', font=font(500, px(30)), fill=GRI)
    d.text((px(80), px(358)), 'Geriye kalan arşiv burada yaşıyor.', font=font(500, px(30)), fill=GRI)

    anime, bolum, link = sayilar()
    x = px(80)
    for sayi, etiket in [(tr(anime), 'anime'), (tr(bolum), 'bölüm'), (tr(link), 'izleme linki')]:
        f1, f2 = font(700, px(26)), font(500, px(22))
        g1, g2 = d.textlength(sayi, font=f1), d.textlength(etiket, font=f2)
        w = int(g1 + g2 + px(46))
        d.rounded_rectangle([x, px(430), x + w, px(480)], radius=px(25), fill=CIP_ZEMIN, outline=CIP_KENAR)
        d.text((x + px(18), px(455)), sayi, font=f1, fill=BEYAZ, anchor='lm')
        d.text((x + px(18) + g1 + px(10), px(456)), etiket, font=f2, fill=GRI, anchor='lm')
        x += w + px(12)

    d.text((px(80), px(540)), 'berke-aras.github.io/turkanime-arsiv', font=font(700, px(25)), fill=ACCENT)
    return tuval

if __name__ == '__main__':
    YOLLAR = fontlar()
    for yol, boyut in [('docs/assets/social-preview.png', (1280, 640)), ('og-image.png', (1200, 630))]:
        tam = os.path.join(KOK, yol)
        ciz(*boyut).save(tam, optimize=True)
        print(f'{yol}  {boyut[0]}x{boyut[1]}  {os.path.getsize(tam) // 1024} KB')
