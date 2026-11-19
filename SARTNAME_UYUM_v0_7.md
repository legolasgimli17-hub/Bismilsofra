# Şartname uyum ve açık işler — Bismil Sofra v0.7

| Şartname gereksinimi | Uygulanan | Eksik / risk |
|---|---|---|
| En fazla 50 aktif restoran | PostgreSQL slot kısıtı ve admin aktivasyon servisi | Gerçek DB concurrency testi yok |
| 5 restoranlık ilk pilot | Kapasite planı korundu | Pilot restoran ve gerçek menüler toplanmadı |
| Next.js, React, TypeScript web/PWA | Monorepo `apps/web`, manifest ve kısıtlı service worker | npm build/test ve cihazda kurulum testi yapılamadı |
| Müşteri restoran arama / mahalle | API arama + kategori + zone filtreleri | Gerçek mahalle listesi seed, restoran eşlemesi yok |
| Restoran ve ürün fotoğrafları | API URL alanları, demoda stok fotoğraf URL'leri | Güvenilir fotoğraf depolama/upload ve gerçek restoran fotoğrafları yok |
| Zorunlu/opsiyonel ürün seçenekleri | React menü ve sunucu seçme sınırı | End-to-end test yok |
| Tek restoran sepeti | Sepet fonksiyonunda açık değiştirme onayı | Görsel kullanılabilirlik testi yok |
| Kuruş cinsinden toplam, yeniden hesaplama | quote + transaction içinde `confirmedTotalKurus` kontrolü | Gerçek PostgreSQL entegrasyon testi yok |
| Nakit ve restoran POS, online ödeme yok | Müşteri ekranı ve API | Canlı POS veya online ödeme entegrasyonu özellikle yok |
| Gerçek güvenli giriş / MFA | Auth0 SDK ve backend OIDC doğrulama iskeleti | Gerçek sağlayıcı claim eşlemesi, üretim login ve MFA testleri yok |
| Müşteri siparişleri, iptal, destek | React + API rotaları | Gerçek DB ve sağlayıcı bağlantısı yok |
| Restoran paneli | Bekleyen gelen kutusu, kabul/red, 7 sn polling | Tüm durum yönetimi, canlı/sesli+yedek bildirim tamam değil |
| Admin paneli | Operasyon uyarı ekranı | Restoran/menü/personel yönetim UI'si yok |
| Güvenlik, KVKK, log | API üzerinde bazı rol/tenant ve audit kontrolleri | Uzman incelemesi, saklama/silme sistemi, yedek doğrulama eksik |
| 200 eşzamanlı oturum test hedefi | Şartname hedefi korunuyor | Performans testi yapılmadı |
| Android/iOS | Bilerek yapılmadı | Şartnameye göre PWA'dan sonra Expo/React Native |

Öncelik sırası: 1) GitHub özel depo + CI build, 2) gerçek PostgreSQL migration ve test, 3) OIDC/claim/MFA, 4) örnek olmayan tek restoran gerçek menüsü, 5) ürün/mahalle/sipariş E2E, 6) bildirim yedekliliği ve admin/restoran tamamlanması, 7) 5 restoran pilot kapısı.
