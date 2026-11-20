# Bismil Sofra v1.4 Backend — kurulum ve kalite sınırları

## Amaç

Şartname v0.3 Faz 2/3 çalışmasıdır. 5 restoran pilotu için güvenilir sipariş akışı geliştirme temeli; **henüz pilot/açık servis değildir**. 50 aktif restoran fiziksel slot limiti devam eder; online ödeme ve kendi kurye ağı yoktur.

## Yerel kurulum (geliştirici)

1. Node.js 22+ ve Docker/PostgreSQL 17+ kur. `cp .env.example .env`, **gerçek** OIDC bilgilerinin ve `DATABASE_URL`'in geldiğinden emin ol. PostgreSQL şifresi `POSTGRES_PASSWORD` ile aynı olmalıdır. `.env` dosyasını Git'e koyma.
2. `POSTGRES_PASSWORD='<güçlü yerel şifre>' docker compose up -d`.
3. `npm ci` ve `npm run migrate` — **yalnızca boş geliştirme DB'si** için. Migration takip dosyaları: `001_initial.sql`, `003_reliability.sql`, `004_escalation.sql`. *Kurgusal 002 test verisi otomatik çalışmaz*.
4. Test amaçlı SQL seed: `psql "$DATABASE_URL" -f sql/002_development_example.sql`; gerçek restoran/fiyat değildir.
5. `npm test`; `npm run typecheck`; `npm run dev`; ayrı süreç `npm run worker` (süresi dolan siparişleri kapatır).
6. Bildirim yedek kanalı kurulduğunda ve **güvenilir imzayı doğrulayan alıcı test edildikten sonra**, `ALERT_WEBHOOK_URL`, `ALERT_WEBHOOK_SECRET` ayarlarını girip `npm run worker:outbox` çalıştır.

**v0.5'ten yükseltme:** Şema yedeği ve geri yükleme imkânı doğrulandıktan sonra `BASELINE_V05=YES npm run migrate`. `schema_migrations` daha önce uygulanmış dosyaların SHA-256 değerlerini tutar, düzenlenmiş geçmiş migration'ı reddeder. Üretim DB'sinde deneysel yükseltme yapma.

## Gerçek DB entegrasyonu — yalnızca boş/atıl test DB'de

- Veritabanı adı **`_test`** ile bitmeli ve adresi `localhost` ya da `127.0.0.1` olmalı.
- Test DB'de yukarıdaki migration ve `sql/002_development_example.sql` uygula.
- `INTEGRATION_DATABASE_URL='postgresql://...@127.0.0.1:5432/bismil_sofra_test' npm run test:db`
- Test gerçek DB'ye kalıcı **kurgusal** kullanıcılar, adresler ve siparişler yazar; tekrar yaratılabilir/geçici test DB'si kullan.
- Bu test **güvenli kimlik sağlayıcısı entegre oldu** anlamına gelmez; sipariş servisini doğrudan çağırır. OIDC/MFA ayrı ortam testlerini gerektirir.

## REST API eklemeleri (v0.6)

| Rota | Yetki | Amaç |
|---|---|---|
| `GET /v1/restaurant/:rid/inbox` | Restoran sahibi/yöneticisi veya **açık yetkili** çalışan + MFA | Bekleyen siparişleri ve yakın değişiklikleri ağ kopması sonrası yeniden getir |
| `POST /v1/me/support-cases` | E-postası doğrulanmış kullanıcı | **Yalnızca kendi siparişi** için konu, açıklama ile şikâyet aç |
| `GET /v1/me/support-cases` | E-postası doğrulanmış kullanıcı | Kendi destek kayıtlarını listele |
| `GET /v1/admin/alerts` | Admin + MFA + yakın yeniden doğrulama | 2 dakikadan eski bekleyenler ve bildirim sorunları |
| `GET /v1/admin/notifications/failed` | Admin + MFA + yakın yeniden doğrulama | Başarısız/dead-letter bildirim listesi |
| `POST /v1/admin/notifications/:id/retry` | Admin + MFA + yakın yeniden doğrulama | Eski bildirimi denetim kaydıyla yeniden sıraya al |

**Gönderim uyarıları:** Webhook `x-sofra-event-id` + `x-sofra-signature: sha256=<hex>` başlıklarını taşır; HMAC doğrulama ve `eventId` ile duplicate kontrolü **alıcıda zorunludur**. Aynı olay birden çok kez iletilebilir (at least once). Webhook yalnızca gizli şekilde yöneticinin belirlediği HTTPS adrese gider. E-posta/SMS sağlayıcısına gerçek gönderim henüz yok. Tarayıcı arka plandayken ses garantili değildir; restoranın alternatif alarm kanalı pilot öncesi gereklidir.

## Ertelenmiş kritik işler

- OIDC e-posta doğrulama, MFA/yeniden doğrulama ve gerçek mobil/masaüstü giriş akışları.
- Gerçek PostgreSQL ile `test:db`, migration/güvenlik/performans/yük testleri ve yedek geri yükleme provası.
- Frontend ile API bağlama, oturum ve sepet `Idempotency-Key` yönetimi, SSE/push ve tüm bağlantı kopması durumları.
- Restoran menüsü, çalışma saatleri, mahalle ve personel izinlerini düzenleyebilen yetkili arayüz.
- Güvenli gerçek yemek fotoğrafı depolaması/CDN, PWA offline cache, erişilebilirlik ve kullanıcı testleri.
- Bildirim sağlayıcısı, gerçek e-posta/ses/yedek alarm ve izleme.
- KVKK/tüketici hukuk değerlendirmesi, restoran anlaşmaları, 5 restoran ve 20 kullanıcı saha görüşmeleri.

**Durum:** Kod ve otomatik kurallar test edildi. Üretim güvenliği/test kapsamı onaylanmış değildir.

## İkinci bildirim kanalı (v1.4)
- Siparişin oluşturulduğu transaction'da `restaurant_escalations` kaydı planlanır.
- Kabul edilmeyen sipariş için `ESCALATION_WEBHOOK_URL` ve **farklı** `ESCALATION_WEBHOOK_SECRET` tanımlanıp ayrı süreçte `npm run worker:escalation` çalıştırılır.
- Aynı webhook URL'sini birincil ve ikinci kanal olarak kullanma; alıcı ham gövdede HMAC doğrulamalı ve sabit `eventId` ile duplicate olayları tekilleştirmelidir.
- `GET /v1/admin/escalations` ve `POST /v1/admin/escalations/:id/retry` yalnızca admin+yakın MFA gerektirir.
- `/readyz` ve API açılış kontrolü 004 migration'ını da şart koşar.
- [Operasyon/runbook](../../docs/ALERTS_AND_INCIDENTS.md) ve [bağımsız denetim](../../QA_REVIEW_v1_4.md) detayları içerir.
- Alıcı sağlayıcı/ses/telefon bağımsız saha testleri henüz yapılmadığından pilotu başlatma.

## v1.6 menü düzenleme API'leri

- `POST /v1/restaurant/:rid/categories` ve `PATCH /v1/restaurant/:rid/categories/:cid`
- `POST /v1/restaurant/:rid/products` (varsayılan satışa kapalı)
- `PATCH /v1/restaurant/:rid/products/:pid/details` (zorunlu `revision`, eski sürümde 409)
- `GET /v1/restaurant/:rid/management` kategoriler, ürün sürümleri, mevcut ayarlar

Önce `005_product_revisions.sql` migration'ını çalıştır; `PUBLIC_IMAGE_CDN_HOST` ve web `NEXT_PUBLIC_IMAGE_CDN_HOST` aynı onaylı HTTPS medya sağlayıcısına işaret etmelidir. Fotoğraf URL kaydı gerçek dosya yükleme hizmeti değildir.

[Menü düzenleme ve güvenlik sözleşmesi](../../docs/MENU_EDITOR_v1_6.md).

## v1.7 gerçek restoran medya yüklemesi

`POST /v1/restaurant/:rid/photos`: MFA'lı restoranın `menu` yetkisi, ham `application/octet-stream` JPEG/PNG/WebP, `X-Photo-Rights-Affirmed:true`. Sunucu 5 MB / 20 megapiksel sınırıyla WebP dönüştürür, EXIF'i kaldırır ve S3 uyumlu objeye kaydeder. Geri dönüş `{mediaId,imageUrl,width,height,sizeBytes}`.

Üretim için `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `MEDIA_PUBLIC_ORIGIN`, `PUBLIC_IMAGE_CDN_HOST` sunucu ortamında tanımlanmalı; web `NEXT_PUBLIC_IMAGE_CDN_HOST` aynı alan adına bakmalıdır. Yanlış/eksik yapılandırmada yükleme 503 ile güvenli şekilde durur.

`006_restaurant_media.sql` migration'ı gereklidir. CDN fotoğrafı ürüne bağlanırken sahiplik kaydı REST API'de kontrol edilir. [Ayrıntılı güvenlik ve kurulum](../../docs/PHOTO_UPLOAD_v1_7.md).
