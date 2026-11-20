# Bismil Sofra v1.9 — Sipariş bildirimlerinde ağ/DB kilidi ayrımı

## Sorun
Önceki `dispatchOutbox` her partiyi bir PostgreSQL transaction içinde `FOR UPDATE SKIP LOCKED` ile seçiyor ve **webhook'un HTTP yanıtını beklerken satır kilidini tutuyordu**. Bir sağlayıcı 3 saniye gecikirse, 10 kayıt için 30 saniyeye varan DB transaction ve bağlantı tutulabiliyordu. Bu, düşük bütçeyle çalışan Bismil pilotunda bile kilit süresi ve kapasite riski yaratır.

## Yeni yöntem (008_outbox_leases.sql)
1. Worker tek `WITH candidate ... FOR UPDATE SKIP LOCKED` sorgusuyla **bir kayıt** seçer ve ona rastgele UUID `lease_token` + 30 saniye `lease_until` yazar; sorgunun transaction'ı **HTTP çağrısından önce kapanır**.
2. Worker müşterinin adresini değil, sadece imzalı, tekrarlanabilir `eventId`, `orderId`, `restaurantId` ve olay türünü gönderir. Webhook süresi 3 saniyeyle sınırlıdır.
3. Başarılı teslimat `WHERE id = ... AND lease_token=...` koşuluyla onaylanır. Süresi geçmiş bir worker başka worker'ın kaydına müdahale edemez.
4. Başarısız teslimat yine token doğrulanarak `attempts` +1 artırılır, backoff planlanır; en fazla 12 denemeden sonra `dead_at` atanır.
5. Worker aniden durursa lease en fazla 30 saniyede biter ve kayıt tekrar gönderilebilir. **Bu nedenle teslimat en az bir kez (at-least-once), asla exactly-once garantisi vermez**.

## Sağlayıcının zorunlu sözleşmesi
- `x-sofra-event-id` kalıcı olarak tekilleştirilmeli; aynı event ID'ye aynı ses/SMS iki defa gönderilmemeli.
- `x-sofra-signature` HMAC-SHA256 ham gövde üzerinde doğrulanmalı.
- HTTP 2xx sadece webhook alıcısının kabulünü gösterir; işletmede gerçek kişinin alarmı duyduğunu **kanıtlamaz**. Ayrı restoran ekranı ve ikinci sağlayıcı hâlâ gerekli.
- Üçüncü tarafın ham hata metni DB'ye kaydedilmez; `last_error='DELIVERY_FAILED'` kullanılır.

## Otomatik testler
- Bağlantı açık transaction'da tutulmuyor: tek bağlantılı havuz ile webhook handler aynı havuzda `SELECT 1` yapabiliyor.
- İki paralel worker aynı olayı teslim etmiyor.
- Worker çökmesi simülasyonu: geçerli lease tekrar alınmıyor; süresi dolduğunda kayıt kurtarılıyor.
- Hatalı sağlayıcı geri denemesi, dead-letter ve eski lease'in onay yetkisinin olmaması.
- Gerçek HTTP + PostgreSQL testleri sipariş ve uyarı zincirini yeniden doğruluyor.

## Kalan üretim kapıları
- Canlı Auth0/MFA, birincil ve bağımsız ikincil sağlayıcı, gerçek restoran cihazları ve kabul süresi saha provası.
- Saatlerce bağlantı kopmasında alarm sağlayıcılarını ve tekrar deneme sınırlarını test etme.
- Üretim DB havuz/latency metriği ve yüksek yük testi.
- İşletme paneli bağlantı sağlığının görünürlüğü ve müşteri sipariş durumunu sorgulayabilme.

Sabit kapsam: İlk 5 restoran, en fazla 50 aktif restoran; kapıda nakit/restoran POS ve kendi kuryesi.
