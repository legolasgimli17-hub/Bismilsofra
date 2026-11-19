# Bismil Sofra — gerçek fotoğraf standardı (v0.8)

**Kaynak türü:** Demo menülerinde Unsplash/Pexels üzerinde yayınlanmış *fotoğraf URL'leri* kullanılır; AI üretimi çizim veya emoji yemek görseli kullanılmaz. Kaynak sunucuları bu geliştirme ortamında erişilemediğinden görselleri **gerçekten indirip projeye paketlediğimizi söylemiyoruz**. Bu nedenle bağlantı koparsa kartta açık bir "Fotoğraf henüz mevcut değil" yedeği görünür.

- Unsplash lisans bilgisi: https://unsplash.com/license
- Pexels lisans bilgisi: https://www.pexels.com/legal-pages/license/
- İlgili fotoğrafın kaynağını ve varsa telif/kişilik/marka kullanım koşullarını canlıya almadan önce tek tek doğrula. Fotoğrafın *restorana ait ürün* olduğu iddia edilmez.

**Pilot için doğru uygulama:** İşletmeden ürün fotoğraflarının kullanım onayını al; yemek ve fiyatın gerçekten birbirine uyduğunu teyit et; fotoğrafları uygulamaya ait depoda sakla. Dış linklere güvenme. Fotoğraf yoksa başka ürünü aynı ürünmüş gibi gösterme.

**Yerel görsel hazırlama:**

```bash
python tools/import_food_photo.py --input /path/to/izinli_yemek.jpg --slug urun-adi
```

Bu komut dosyayı `apps/web/public/photos/urun-adi.webp` konumuna, büyük kenarı 1600/1200 sınırına uyan optimize bir WebP olarak kaydeder; EXIF'i temizler. UI içinde `/photos/urun-adi.webp` kullanılabilir. Görseli _kendiliğinden_ bir ürünün menüsüne bağlamaz. Araca güvenmeden önce işletme izni ve doğrulama şart.

**Eksik olan üretim parçası:** Kimliği doğrulanmış işletme fotoğraf yükleme servisi, dosya içerik doğrulaması, antivirüs ve içerik denetimi, hız/alan sınırı, obje depolama, CDN, sürümleme ve eski fotoğraf temizleme politikası. Tek başına CLI bunların yerine geçmez.
