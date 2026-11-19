# Bismil Sofra — Gerçek fotoğraf ve mobil kalite kapıları

Hedef: Yemeksepeti/Trendyol Go gibi büyük servislerdeki **akıcı ve güvenilir kullanıcı deneyimi** kalitesine yaklaşmak. Markalarını, kodlarını veya arayüzlerini birebir kopyalamak hedef değildir.

## Fotoğraf kaynağı politikası

- **Gerçek işletme görselleri:** restoranın çektiği veya kullanma izni verdiği yemek/fotoğraf dosyaları. Gerçek restoran adı ya da ürününü stok fotoğrafıyla yanıltıcı biçimde eşleştirmeyin.
- **Örnek demo:** Unsplash/Pexels gibi izin koşulları ayrıca doğrulanan fotoğraf servislerine dış bağlantılar yalnızca `TASARIM ÖNİZLEMESİ` etiketli kurgusal örnek içerikte kullanılabilir.
- **Uydurma restoran, puan, sipariş zamanı veya stok fotoğrafını gerçek satıcı fotoğrafı diye gösterme:** yasak.
- Lisans kanıtını/işletme iznini yönetim kayıtlarında saklayın. Google görsel sonuçlarını rastgele kopyalamayın.

## Kayıtlı gerçek fotoğraf ekleme

1. Restoran sahibinden onaylı JPEG/PNG/WebP dosyasını al, ürün adı ve hangi görselle eşleştiğini doğrula.
2. `python tools/import_food_photo.py --input /path/to/approved.jpg --slug restoran-urun-adi` ile fotoğrafı içeri aktar.
3. Çıktı `apps/web/public/photos/restoran-urun-adi.webp` olarak WebP'ye dönüştürülür; EXIF meta verisi temizlenir ve görsel en fazla 1600×1200 piksel olur.
4. Veritabanındaki restoran/ürün `cover_url` veya `image_url` alanında yalnızca ilgili `/photos/...webp` yolu kullanılabilir.
5. Medya sayısı arttığında onaylı fotoğrafları kendi depolama/CDN'ine taşı. Sadece tek bir güvenilen HTTPS hostname'ini `NEXT_PUBLIC_IMAGE_CDN_HOST` olarak ayarla; uygulama diğer bilinmeyen görsel domainlerini reddeder.
6. Görseli tarayıcıda önizle; görsel açılmıyorsa uydurma yemek illüstrasyonu yerine dürüst **fotoğraf mevcut değil** durumu gösterilir.

**Eksik:** Buradaki CLI, kurgusal ortam veya depo dosyası için geliştirme aracıdır; işletmenin web panelinden doğrudan yükleme yapan kimliği doğrulanmış üretim upload API'si henüz yoktur. Önce 5 restoranlık pilot için yönetici tarafından denetimli aktarım kullanılabilir.

## Mobil inceleme listesi (henüz doğrulandı diye işaretlenmedi)

- [ ] 320 / 360 / 375 / 390 / 430 / 768 / 1024 / 1440 px genişliklerde ana sayfa, menü, sepet, adres, sipariş takibi ve restoran tablet paneli.
- [ ] Tek elle rahat kullanılabilir, en az 44 px dokunma hedefleri, belirgin odak halkası, erişilebilir ürün ve ücret etiketleri.
- [ ] Resimler kadrajdan taşmıyor, metinler 2 satırda kesilmiyor, yatay scroll oluşmuyor.
- [ ] Yavaş mobil ağda boş sayfa yerine yükleniyor/bağlantı koptu/yeniden dene durumları.
- [ ] Yanlış ücret gösterilmiyor: mahalle seçilmeden teslimat ücreti kesin kabul edilmiyor.
- [ ] Sipariş iki kez gönderilmiyor; ağ kesilirse aynı `Idempotency-Key` ile sorgulanabiliyor.
- [ ] İşletme paneli, bağlantı ve veri tazeliği bozulduğunda durum değişikliği yaptırmıyor.
- [ ] Klavye ve ekran okuyucu ile filtre, ürün seçenekleri, adres ve ödeme kullanımı.
- [ ] Gerçek Android/Chrome ve iOS/Safari cihazlarıyla karşılaştırmalı kontrol.
- [ ] Web Vitals hedefleri mobil saha ölçümüyle değerlendirilecek; henüz LCP/CLS/INP ölçüm sonucu yok.

## Düşük bütçe önceliği

Önce beş gerçek restoranla izinli ürün fotoğraflarını ve menülerin doğruluğunu sağla; dosya optimizasyonu ve CDN sonrasında aynı görselleri 50 restorana ölçekle. Şartnameye yeni online ödeme, kupon veya ayrı kurye sistemi ekleme.
