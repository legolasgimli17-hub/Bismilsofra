# v2.4 — Arka plan işçileri sağlık kontrolü

## Değişiklik
- Geriye dönük, yeni `010_worker_heartbeats.sql` migration'ı uygulanır; var olan SQL ve sipariş iş kuralları değiştirilmez.
- `outbox` (2 saniye çevrim), `escalation` (3 saniye) ve `expiry` (5 saniye) süreçleri PostgreSQL'de en son çevrim zamanını, sonuç durumunu, en son başarılı işi ve en son hata zamanını tutar.
- Dört durum koşulu vardır: **missing** (süreç hiç rapor vermemiş), **stale** (35 saniye sınırı aşılmış), **error** (çevrim/DB/işleme hatası), **delivery_error** (bildirim sağlayıcıya iletim başarısız) ve **running** (çevrim güncel). Hata metni ve kişisel müşteri bilgileri heartbeat tablosuna yazılmaz.
- `GET /v1/admin/alerts` yalnızca platform yöneticisi + son 10 dakika MFA ile izlenebilir. `/admin` 20 saniyede bir yenilenirken sapmaları uyarır.
- Her worker süreç/konteyneri **ayrı** deploy ve restart politikası gerektirir. `npm run worker:outbox`, `npm run worker:escalation`, `npm run worker` başlangıçta gerçek kimlik bilgisi olmadan tam olarak çalışamaz.
- Tüm işçiler aynı tür isimle yazdığı için sistem, **en az bir örneğin** ayakta olduğunu izler; birden fazla replika içindeki tüm örneklerin tek tek sağlığını kanıtlamaz.

## Alarm prosedürü
1. Yönetici ekranında `missing` veya `stale` → ilgili servis durumu ve DB bağlantısı kontrol edilir, bağımsız operatöre alarm verilir.
2. `error` → işçi proses logları ve DB gecikmesi kontrol edilir. Kaydedilmiş hata mesajı/PII gösterilmez.
3. `delivery_error` → outbox/escalation hata sayıları, iki ayrı webhook sağlayıcısı ve fiziksel restoran cihazı doğrulanır.
4. `running` → sadece süreç çalışıyor demektir; **webhook HTTP 2xx kesin cihaz bildirimi değildir**. Gerçek restoran çalışanının siparişi aldığını gösteren kabul işlemi ayrıca doğrulanmalıdır.
5. İki kanal ve ilk pilot için ayrı, uygulama dışı takip sistemi gerekir; yalnızca bu web sayfasını izlemek kesintilerde yeterli olmaz.

## Testler
- Birim testleri: sıfır kayıt, taze/eski kayıt, teslimat hatası, süreç hatası, geçersiz zaman ve güvenli heartbeat parametreleri.
- Gerçek PostgreSQL ve OIDC JWT HTTP testi: eksik süreç, başarılı çevrim, iletim hatası, süreç hatası, eski heartbeat, yetkisiz müşteri ve eski MFA retleri.
- GitHub CI migration bütünlüğü, TypeScript, Next.js build ve gerçek DB ile test edilmelidir.

## Sınırlar
Gerçek Auth0 tenant, iki ayrı SMS/push sağlayıcısı, müşteri restoran son cihaz ACK, uptime dış alarmı, tam test ortamı, yedekleme / restore ve gerçek 5 restoran pilotu hâlâ üretim ön koşuludur.
