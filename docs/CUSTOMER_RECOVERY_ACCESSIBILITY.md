# Bismil Sofra — Müşteri hata, çevrimdışı ve erişilebilirlik kapısı

## Kodlanan alanlar
- Next.js sayfa/hatalı route sınırı, tüm site için son çare hata ekranı, 404 sayfası ve yükleme ekranı var.
- Hata ekranları istisna gövdesini, yığın izini veya kimlik belirtecini müşteriye göstermez. Yeniden dene, ana sayfa, Siparişlerim yönlendirmeleri bulunur.
- Service worker yalnızca statik ikon, manifest ve /offline.html dosyasını cache'ler. Müşteri hesabı, sipariş, adres, kullanıcıya özel HTML veya API cevabı offline cache'e GİRMEZ.
- Ağ olmadan açılan sayfada sipariş teslim alındı gibi bir sinyal verilmez; aynı siparişin ikinci kez gönderilmemesi için Siparişlerim uyarısı görünür.
- Klavye ile ana içeriğe atlama linki, role=alert/status, aria-live ve reduced-motion tercihine saygı eklendi.

## Otomatik doğrulama
- GitHub CI statik kaynak testi ile offline cache'in özel içerik saklamadığını, hata ekranları ve skip link bulunduğunu kontrol eder.
- Next.js TypeScript ve production build testleri devam eder.
- CI production web server açarak HTTP 404 ve statik offline sayfa smoke testi gerçekleştirir.

## Gerçek telefon ve görsel lisans kontrolü (açık)
- Chrome Android, Safari iOS cihazlarında 320/360/375/390/430 px genişlikte ana sayfa, restoran menüsü, seçenek modalı, checkout, adres, sipariş takibi, işletme ve admin ekranları test edilmeli.
- Klavye sekme sırası, 200% yakınlaştırma, ekran okuyucu, tıklanabilir alan boyutları, odak geri dönüşü, VoiceOver/TalkBack, düşük hız, uçak modu ve tekrar bağlantı senaryoları kontrol edilmeli.
- Buradaki kod fiziksel iPhone/Android cihaz testi geçildiği anlamına gelmez.
- Demo içinde unsplash/pexels kaynaklı harici yemek fotoğrafları vardır. Sadece örnek restoranlarda ve açık demo etiketiyle kullanılır. Kullanım koşulları/medya kaynağı, fotoğrafçı/izin belgesi olmadan gerçek işletme fotoğrafı olarak yayımlanamaz.
- Gerçek restoran görseli için fotoğrafı üreten/çekmiş kişi, içerik sahibinin yazılı kullanım hakkı, ticari/pazarlama izni, varsa marka/kişisel veri izinleri, çekim/işletme bağlamı ve CDN kaynak kaydı tutulmalıdır.
- Gerçek fotoğraf yerine müşteriyi yanıltan kurgu yemek görselleri veya stok fotoğraflar kullanılamaz. Fotoğrafsız ürünlerde bilinçli fallback UI kullanılır.

## Test izleme
1. Gerçek cihaz/ekran okuyucu başına kayıt, ekran görüntüsü ve hata raporu.
2. Ölçülmüş LCP/INP/CLS ve 3G/4G mobil network profili.
3. Eksik görsel/bozuk ürün, internet kesildi, auth token expired, 429/503/500, boş sonuçlar, sipariş fiyatı değişti.
4. Bu senaryolardan kritik seviye açık kalırsa pilotta sipariş alımı açılmaz.

Kullanım için hâlâ gerçek Auth0 ve ayrı staging ortamı gereklidir.
