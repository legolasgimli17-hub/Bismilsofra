# Bismil Sofra — Sipariş uyarıları, işletme kesintisi ve olay müdahalesi

Bu doküman, en fazla **50 aktif restoran** ve ilk **5 restoran pilotu** için planlanmıştır. Canlı sipariş başlatıldığını göstermez.

## Olay akışı

1. Sipariş PostgreSQL içinde `beklemede` durumuyla oluşturulur. İşlem anında `notification_outbox` için ilk bildirim ve `restaurant_escalations` için ikinci uyarı planı aynı commit içinde oluşur.
2. Birincil webhook worker'ı yeni siparişi **imzalı** `x-sofra-event-id` ve `x-sofra-signature` başlıklarıyla restoranın güvenilir alıcısına iletmeyi dener; başarısızsa kalıcı outbox kaydından tekrar dener. Bu, başarılı HTTP yanıtının fiziksel olarak birinin alarmı duyduğunu kanıtlamadığı anlamına gelir.
3. Sipariş **kabul edilmezse**, ikincil uyarı zamanı genellikle oluşturulduktan 60 saniye sonradır; kısa kabul pencerelerinde daha erkendir. Ayrı `escalation-worker`, ilk kanaldan **bağımsız bir sağlayıcıya** hatırlatma gönderir.
4. Sipariş kabul edilmiş/iptal edilmiş/süresi dolmuşsa ikincil uyarı gönderilmez; kayıt `cancelled_at` ile kapatılır.
5. İkincil teslimat başarısızsa 15, 30, 60, 90… saniyelik aralıklarla yeniden denenir; altı başarısız girişim sonrasında `dead_at` atanır. Yönetici paneli gecikmeleri/hataları görür. Yönetici yalnızca hâlâ bekleyen ve süresi dolmamış sipariş için yeniden deneme başlatabilir.
6. Süresi dolan siparişler `expiry-worker` tarafından güvenli geçişle kapatılır. Bildirimlerin başarısı sipariş durumunun doğruluğundan ayrı tutulur.

## Üretim öncesi yapılandırma

- `DATABASE_URL`: yedekli/kalıcı PostgreSQL; schema migrations 001, 003, 004 uygulanmış olmalı.
- Birincil kanal: `ALERT_WEBHOOK_URL` + rastgele 32+ karakter `ALERT_WEBHOOK_SECRET`.
- Gerçekten **bağımsız** ikincil kanal: `ESCALATION_WEBHOOK_URL` + farklı 32+ karakter `ESCALATION_WEBHOOK_SECRET`. Aynı URL iki kanalda kullanılamaz. İkinci sağlayıcının ayrı altyapısı olması tercih edilir.
- Süreçler: API, `worker` (süre dolumu), `worker:outbox` (ilk bildirim) ve `worker:escalation` ayrı, sağlığı izlenebilir süreçlerdir. Sunucusuz kısa süreli HTTP fonksiyonları bu sürekli worker'ların yerine otomatik geçmez.
- İmzalı webhook alıcısı `sha256=` HMAC imzasını gelen ham HTTP gövdesi üzerinde doğrulamalı; `eventId` değerini kalıcı olarak tekilleştirmelidir. Tekrarlı teslimatlar normaldir.
- Payload müşteri telefonunu, açık adresini ve sipariş notlarını içermez. İşletme detayları JWT + MFA ile korunan API'den okur.

## Gözlemleme ve yanıt verme

| Belirti | İlk müdahale | Sonraki kontrol |
|---|---|---|
| Restoranda yeni sipariş görünmüyor | Tablet ağını ve `/v1/restaurant/:rid/inbox` yanıtını kontrol et | Fallback webhook sağlayıcı sağlığı, `/v1/admin/alerts` |
| Birincil uyarı düşmüyor | Outbox worker süreç/bağlantı hatası | Yönetici tarafından tekrar sıralama, olay ID dedupe |
| İkincil uyarı gecikiyor | Escalation worker ve bağımsız webhook'u kontrol et | `/v1/admin/escalations` (yalnızca admin+MFA), gerekiyorsa `/v1/admin/escalations/:id/retry` |
| Müşteri tekrar sipariş verdiğini düşünüyor | Aynı `Idempotency-Key` ile `/v1/me/orders/by-key/:key` sorgusu | Farklı anahtarla kör tekrar gönderme |
| Restoran bağlantı kaybetti | Panel işlem düğmelerini durdurmalı | Bağlantı gelince tüm bekleyen ve aktif siparişleri sunucudan yeniden almalı |

## Şartname kaynaklı pilot geçiş sınırları

- Sipariş kabul süresi restoran bazında 1–15 dakika; varsayılan 4 dakikadır.
- Arka planda çalışan mobil tarayıcıda ses garantisi **yoktur**; ikinci uyarı alıcısının bir kişiye cihazdan bağımsız eriştiği saha testinde kanıtlanmalıdır.
- İki webhook da aynı fiziksel cihazı uyarıyorsa **gerçek yedeklilik sağlamaz**. Pilot öncesi telefon/tablet kapalı, internet kesik, sağlayıcı kapalı ve mükerrer teslimat testleri gerekir.
- Bu repodaki ikinci worker henüz gerçek dış sağlayıcı hesabına bağlanmadı. GitHub CI ile test edilmesi, canlı SMS/e-posta/push gönderildiğini göstermez.
- Uygulama yalnızca kapıda nakit veya restoranın POS cihazını destekler; online ödeme ve platform kurye filosu kapsamda değildir.

## Güvenlik ve bakım

- `.env`, JWT, müşteri verileri veya webhook gizli anahtarlarını GitHub'a yükleme.
- `schema_migrations` geçmişini ve uygulanmış SQL'i el ile değiştirme; yeni değişiklik için yeni migration yaz.
- Alarm sağlayıcıları API loglarına müşteri kişisel verisi döndürmemeli; fallback worker sağlayıcı hata metnini kaydetmez.
- Her sürümde gerçek PostgreSQL ile sözleşme testini, üretim build'ini ve iki kanallı kesinti provası kontrol listesini yeniden yürüt.

## v2.4 işçi watchdog eklemesi

Migration `010_worker_heartbeats.sql` ile `worker_heartbeats` oluşturulur. `outbox`, `escalation`, `expiry` süreçleri her tamamlanmış çevrimde kendi türünün kaydını günceller. Süreç hiç çalışmamışsa `missing`, son kayıt 35 saniyeden eskiyse `stale`, son çevrimde hata olduysa `error`, teslimat hatası raporlandıysa `delivery_error` görünür.

`/v1/admin/alerts` MFA isteyen yöneticiye `workers` alanını döndürür; yönetici ekranında ayrı bölüm vardır. **API `/readyz` sadece veritabanı/migration hazırlığını gösterir; işçilerin durduğu halde müşteri sipariş API'sini otomatik kapatmak yerine operator alarmı gerekir.** Prod'da üçüncü taraf uptime izleyici veya servis gözlemleyici bu hatayı dışarıdan algılayıp sorumlu kişiyi uyarmalıdır.

Sağlıklı heartbeat, SMS/push servisinin erişilebilirliğinin veya restoranın fiziksel cihazında ses duyulduğunun kanıtı değildir. Sağlayıcıların kendileri için sentetik uçtan uca doğrulamalar ve bağımsız yedek kanal saha provası gerekli.

## v2.5 tarayıcı çevrimdışı / bağlantı dönüşü

Restoran paneli `offline` olayında bekleyen inbox isteğini iptal eder, eski snapshot'ın yeniden bağlanmış gibi görünmesini engeller ve durum değiştirme butonlarını hemen kilitler. `online` ve `visibilitychange` ile yeniden sorgulanır. 7 saniyelik polling başka endpoint'i aşırı yüklememek için eski isteği iptal eder. AuthGate'in token callback'i artık kararlı tutulur; tekrar render gereksiz yeniden polling başlatmaz.

**Sınır:** `navigator.onLine` yalnızca tarayıcı bağlantı sinyalidir; esas doğrulama hâlâ MFA korumalı API sorgusunun başarılı olmasına bağlıdır. Uyuyan telefonda tarayıcı ses garantisi yok; ayrı sağlayıcı ve fiziksel cihaz kabul kanıtı gerekir.
