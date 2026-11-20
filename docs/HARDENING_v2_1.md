# Bismil Sofra v2.1 — Bağımsız denetim düzeltmeleri

## Müşteri akışı
- Backend bir ürün adına göre restoran döndürürse canlı arayüz sonuçları tekrar yalnızca restoran adına bakarak elemez. Kurgusal demo modu yine istemcide arar.
- `sessionStorage` kaynaklı sepet JSON'u güvenilmez kabul edilir. Boyut, adet, fiyat, restoran/ürün kimliği ve malzeme listesi doğrulanır. Son ödeme tutarının otoritesi hâlâ sunucudur.

## Güvenlik ve performans
- Doğrulanmış bir kullanıcının her API çağrısında `users` tablosunu gereksiz güncelleme durduruldu. İlk kayıt veya imzalı e-posta değişiminde UPSERT sürer; devre dışı kullanıcıya erişim verilmez.
- Bir dakika pencerede IP bazında sipariş 12, fiyat teklifi 48, fotoğraf yükleme 8, diğer yazma 80, okuma 300. Sınıflar birbirinden bağımsızdır.
- Tek süreçte hız limitçisi en fazla 20.000 anahtar saklar. Dolunca yeni anahtarları reddeder, belleği sonsuza kadar büyütmez. 429 yanıtında `Retry-After` bulunur.
- **Varsayılan güven:** Proxy başlıkları kapalı. `TRUSTED_PROXY_CIDRS` yalnızca gerçek, kontrol edilen dar proxy ağlarıyla yapılandırılmalıdır. Dünyanın tamamını kapsayan IP maskeleri reddedilir.
- **Önemli sınır:** Bu yerel limit **dağıtık/global değildir**. Birden fazla API örneği ve ortak IP/NAT için HTTPS edge/gateway üzerinde merkezi limit, gerçek cihaz testi ve uygun ağ yapılandırması gerekir.
- Gerçek PostgreSQL+imzalı JWT HTTP testleri, tekrar eden sorgularda kullanıcı satırlarının yeniden yazılmadığını, sahte X-Forwarded-For başlığının kotayı aşmadığını doğrular.

## Açık üretim kapıları
Auth0 gerçek tenant/MFA, iki farklı bildirim sağlayıcısı, restorandaki fiziksel cihaz kesinti tatbikatı, HTTPS staging, secret yönetimi, back-up geri yükleme testi, KVKK ve veri saklama politikası, izinli gerçek fotoğraflar/CDN, 5 restoran pilotu, gerçek mobil/erişilebilirlik E2E.

Kapsam değişmedi: 5→20→50 aktif restoran, restoranın kendi kuryesi, kapıda nakit/POS, online ödeme yok.
