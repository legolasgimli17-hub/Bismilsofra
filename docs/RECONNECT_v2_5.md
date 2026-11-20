# v2.5 — Merchant browser reconnect hardening

## Kök sebep
`AuthGate`, her render'da yeni `token` closure üreterek onu dependency olarak kullanan effect'leri tekrar çalıştırabiliyordu. Bu durum sık tekrar sorgu ve gereksiz bağlantı/rate-limit yükü riski oluşturuyordu. Artık auth SDK fonksiyonuna bağımlı `useCallback` kullanılır.

## Restoran davranışı
- `offline` tarayıcı olayında aktif inbox HTTP isteği iptal edilir, eski sonuçlar devre dışı kalır ve `canActOnInbox` işlemleri derhal kapatır.
- Yeniden `online` veya görünür sekme olayı geldiğinde 7 saniyeyi beklemeden sunucuya tekrar bağlanılır.
- Önceki istek `AbortController` ile iptal edilir. Dönüşteki yanıt yalnızca **aynı restoran ID, aynı en son istek sequence, iptal edilmemiş istek ve online tarayıcı** koşullarıyla işlenir.
- Sipariş değişiklikleri browser state'de tahmin edilmez; yalnızca sunucudan tazelenen snapshot eyleme izin verir.
- Sadece görünür sekmede 7 saniyede bir normal polling devam eder. Sekme askıda/telefon uykuda iken ses garantisi yoktur.

## Test ve sınırlamalar
`inbox-health.test.ts` offline durumda işlem reddini, eski/iptal edilmiş/diğer restoran yanıtlarını kontrol eder. CI TypeScript/Next.js ve API/PostgreSQL testleri devam eder.

Tarayıcı network olayları fiziksel uçtan uca cihaz testi yerine geçmez. Gerçek iki bildirim sağlayıcısı, sağlayıcı bağımsızlığı, fiziksel alarm, Auth0 MFA ve backup/restore provaları hâlâ açılış kapısıdır.
