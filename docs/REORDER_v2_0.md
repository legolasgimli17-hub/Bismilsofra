# Bismil Sofra v2.0 — Eski siparişi güncel menüyle tekrar hazırlama

## Müşteri akışı
1. Oturum açmış müşteri yalnızca **kendisine ait** `/v1/me/orders/:id` sipariş detayını açar.
2. “Güncel menüyle tekrar hazırla” en son **aktif restoran menüsünü** okur ve eski sipariş satırlarını eşleştirir.
3. Ürün satışı kapanmış, kaldırılmış, seçenek artık mevcut değil/kapalı, zorunlu seçim değişmiş, restoran sipariş almıyor veya adet sınırı aşılmışsa **tek bir satır dahi otomatik sepet oluşturmaz**. Kullanıcı güncel menüden seçim yapar.
4. Eski ve yeni birim fiyat değiştiyse açıkça gösterir. Geçmiş fiyat saklıdır; platform eski ücreti tahsil etmez.
5. Yeni sepet mevcut sepeti değiştirecekse **açık onay** ister; aksi durumda eski sepet korunur.
6. Müşteri kasaya geçtiğinde `/v1/orders/quote` gerçek adres/mahalle ve güncel ürün fiyatlarına göre yeniden teklif verir. Son `/v1/orders` işlemi sunucuda fiyatı tekrar kontrol eder ve idempotency kullanır.

## Güvenlik ve veri minimizasyonu
- Geçmiş sipariş endpoint'i önceden müşterinin ID'sini doğruluyordu; eklenen `product_id`, sadece izinli **kendi sipariş detayında** görünür. Geçmiş `options_snapshot` zaten bu cevaptaydı.
- Geri yüklenen sepet **asla gerçek sipariş oluşturmaz**. Onaylanmamış tarihsel fiyatı API'ye göndermez.
- Fiyat, aktiflik, seçenek ve teslimat kuralları son kararı sunucuda verir.
- Demo hesaplarında bu işlev canlı sipariş oluşturmaz. Üretim Auth0, fotoğraf/CDN, ikincil bildirim sağlayıcısı ve cihaz testleri ayrıca gereklidir.

## Otomatik kontroller
- Fiyat değişimi, ürün kaldırılması, pasif seçenek, yeni zorunlu seçenek, restoranın kapalı olması, adet limitleri, bozuk snapshot ve eski satırların birleştirilmesi.
- Gerçek HTTP+PostgreSQL testlerinde kendi siparişinin `product_id` ve ekstra ID'sini görebilme; başka müşterinin aynı siparişini 404 ile reddetme.
- GitHub Actions'da `npm run test:reorder`, TypeScript, Next.js build ve PostgreSQL entegrasyon testleri.

## Pilot için kalanlar
Gerçek Auth0 tenant, MFA, HTTPS staging, 5 restoranın tablet/telefonlarında kullanım testi, en az iki bağımsız bildirim sağlayıcısı, yedekleme/restore, gerçek yemek fotoğrafları ve 360px/390px erişilebilirlik doğrulaması. Canlı kullanıma hazır olmakla karıştırılmamalı.

**Şartname sabit:** 5→20→50 aktif restoran; Bismil; restoranın kendi kuryesi; yalnızca kapıda nakit/POS.

## Ek sipariş fiyatlandırma tutarlılığı
Fiyat teklifi oluşturan `quoteOrder` kodunda arşivlenmiş seçenek grupları `archived=false` ile filtrelenir. Sipariş kaydı yapan `placeOrder` zaten aynı filtreyi kullanıyordu; teklif ve gerçek sipariş kuralları artık tutarlı. Gerçek HTTP+PostgreSQL testi, pasif yapılmış zorunlu grupta seçimsiz yeni teklifin geçerli olduğunu ve eski pasif seçenek ID'sinin `OPTION_FOREIGN` ile reddedildiğini doğrular.

## Mobil tasarım
Sipariş ayrıntılarında ayrı renk/ikon hiyerarşili tekrar sipariş kartı, 420px altı ekranda tam genişlikli 44px+ tıklama hedefleri, `role=alert` geçersiz ürün açıklamaları ve değişen fiyatların satır satır gösterimi bulunur. Gerçek Android/iOS 360–430px ve ekran okuyucu saha testi hâlâ üretim gerekliliğidir.
