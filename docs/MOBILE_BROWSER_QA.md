# Bismil Sofra — Gerçek Chromium mobil viewport otomatik testleri

GitHub Actions, Next.js production build'ini localhost üzerinde başlatıp headless Chromium DevTools protokolü üzerinden aşağıdaki dört örnek sayfayı açar:
- ana restoran keşfi
- örnek restoran menüsü (gerçek olmayan demo restoran)
- boş sepet
- 404 sayfası

320, 360, 390, 430, 768 ve 1280 CSS piksel genişliklerinde **24 gerçek tarayıcı navigasyonu** çalışır. Her sayfanın ana içeriği, başlığı, klavye ile "Ana içeriğe geç" bağlantısı ve mobil gezinme elemanı görünür olmalıdır. Tüm belge genişliği viewport'u 2 pikselden fazla aşarsa CI kırmızı olur. Kategori şeridindeki yatay kaydırma istisna sayfa düzeyi overflow'ı gizlemez. Test erişilebilirlik denetimi, renk kontrastı veya fiziksel telefon doğrulaması değildir.

## Risk sınırları
- Headless Chromium gerçek browser engine kullanır ama **gerçek Android Chrome veya iOS Safari değildir**; iOS WebKit davranışı, ekran klavyesi, notch/çentik, touch/gesture, TalkBack, VoiceOver, RAM ve 3G ağ kalitesi ayrı cihaz testleri gerektirir.
- Test sadece demo verisiyle, localhost:3180 üzerinde çalışır; production domain, gerçek müşteri siparişi veya private Auth0 session'a erişemez.
- Chrome'un GitHub runner'da kurulu olması gerekir; eğer yüklü değilse test başarısız olur ve görüntü kalite kanıtı verilmez.
- Test tasarımın estetik olarak en üst düzeyde olduğunu söylemez; yalnızca otomatik olarak ölçülebilen temel responsive problemleri tespit eder.
- Gerçek restoran fotoğrafları, yazılı medya izinleri ve doğru ürün eşleşmesi olmadan sağlandı sayılmaz.

## Saha kabul listesi
[ ] Gerçek Android Chrome 320/360/390/430 px
[ ] Gerçek iOS Safari (iPhone) 375/390/430 px
[ ] Klavye, screen reader, odak, 200% zoom
[ ] 3G/offline, ekran yönü değişimi, bağlantı geri gelmesi
[ ] Restoran paneli gerçek telefon/tablet sesi ve arka plan bildirimi
[ ] Lisanslı gerçek ürün fotoğrafı, responsive crop ve alt metin
[ ] LCP/INP/CLS ölçümü ve kabul edilebilir kullanıcı deneyimi
[ ] Gerçek Auth0 ve müşteri checkout staging denemesi

Bu görevler tamamlanmadan GO/NO_GO manifestindeki mobile_accessibility_devices maddesi "verified" yapılmaz.
