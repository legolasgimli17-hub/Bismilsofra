# Bismil Sofra v2.2 — Sepet sürekliliği, canlı kategori ve MFA

## Sepet

Sepet yalnızca anonim restoran/ürün adlarını, seçilen seçenek kimliklerini ve **tahmini** liste fiyatlarını içerir. Adres, telefon, kimlik token'ı veya ödeme verisi localStorage'a **yazılmaz**. Tüm kesin fiyatlar sipariş sırasında sunucuda tekrar hesaplanır.

- Yeni `sofra-cart-v22` anahtarı sekme ve sayfa yenilemeleri arasında paylaşılır.
- Eski `sofra-cart-v07` sessionStorage kaydı, yeni anahtar yoksa yalnızca bir kez okunur ve geçerli ise taşınır.
- `storage` olayları diğer sekmedeki sepet güncellemelerini alır. Aynı sekmede hızlı tıklamalar stale React closure yerine anlık depolama değerinden uygulanır.
- Birden çok sekmede tam olarak aynı anda ayrı yazmalar, localStorage'ın atomic compare-and-swap mekanizması olmadığı için **son yazan kazanır**; bunu atomik / tam eşzamanlı işlem gibi sunma.
- Checkout henüz tarayıcı saklama alanını okumamışsa sahte "boş sepet" göstermez. Kullanıcı sonradan fiyat onayı vermeden sipariş gönderilmez.
- PWA uygulamasında kullanıcı hesabı değişse bile anonim sepet aynı cihazda kalabilir; sepetin kişisel/sipariş bilgisi içermemesi bu nedenle önemlidir. Paylaşılan cihazda sepeti temizleme erişilebilir olmalıdır.

## Canlı kategoriler

`GET /v1/categories` ve `GET /v1/categories?zoneId=UUID` yalnızca aktif restoranların, stokta mevcut ürün kategorilerini sunar. Sipariş kabulü saatlere bağlı olduğundan kategori listesinin **yalnızca şu an açık restoranlara** sınırlandırılması gereksizdir; kapalı restoran menüleri de incelenebilir.

Canlı kategori filtresi kategorinin gerçek tam adını ve satılabilir en az bir ürünü gerektirir. İstemci kategorileri artık sabit demo başlıklarından türetmez; canlı kategori için yanlış yönlendirebilecek stok fotoğrafı kullanılmaz.

## MFA

`otp`, `totp`, `webauthn`, `hwk` tek başına iki ayrı faktör kanıtı değildir. İmzalı JWT'de tamamlanmış `mfa` olayı veya sonradan MFA tamamlandığında üretilmiş imzalı namespaced claim gerekir. Gerçek Auth0 Action ve güncel MFA zaman bilgisi pilotta ayrıca test edilecektir.

## Açık kalite kapıları

Gerçek tarayıcılar arası multi-tab yarışı, fiziksel cihaz E2E, ağ kaybı, gerçek SMS/push sağlayıcıları, yetkili Auth0 tenant, erişilebilirlik, fotoğraf CDN, yedek/geri yükleme ve canlı restoran deneyimleri henüz doğrulanmadı. Scope: Bismil 5→20→50 aktif restoran, kapıda nakit/restoran POS, restoranın kendi kuryesi.
