# Bismil Sofra — izole staging ve kapasite kalite kapısı (v3.0)

## Sahada olan ve olmayan
- Staging Compose dosyası ayrı bir Docker PostgreSQL 17 volume'u oluşturur. Karkalkan veya mevcut başka veritabanı kullanılmaz.
- Veritabanı migrasyonu bir kere çalışır, ardından API ve expiry worker başlar. API yalnızca localhost:4188 portuna bağlanır.
- Node ortamı production olduğundan gerçek sipariş kabulü açıkça PILOT_ACCEPT_ORDERS=false ile kapalıdır.
- Bu bir ücretsiz, yerel hazırlık paketidir; ayrıca ücretli bulut projesi veya Auth0 hesabı KURULMUŞ DEĞİLDİR.

## Kurulum
1. deploy/staging.env.template dosyasını deploy/staging.env adına kopyala. Güçlü ve yalnız staging'e özel bir veritabanı parolası ve gerçek test OIDC tenant değerleri gir. DATABASE_URL içinde özel şifre karakterlerini percent-encode et.
2. docker compose --env-file deploy/staging.env -f deploy/staging.compose.yml config --quiet
3. docker compose --env-file deploy/staging.env -f deploy/staging.compose.yml up -d --build
4. STAGING_API_URL=http://127.0.0.1:4188 node tools/staging-preflight.mjs
5. Sonuçlar ve veritabanı durumu kontrol edilir; kullanıcı/işletme/admin uçtan uca testleri ayrı JWT test hesaplarıyla yapılır. GitHub HTTP entegrasyon testi sahte ama gerçekten imzalı JWKS üretir. Bu Auth0'nun gerçek ayarlarını doğrulamaz.
6. Kapatmak için docker compose --env-file deploy/staging.env -f deploy/staging.compose.yml down. down -v seçeneği kalıcı staging verilerini siler; rutin kullanımda ÇALIŞTIRMA.

Bu test sırları GitHub'a gönderilmez. Compose config çıktısı veritabanı bilgilerini içerebilir; paylaşma.

## Kullanıcı olmadan otomatik kapasite
GitHub CI'da önce gerçek ve yalnız yerel PostgreSQL üzerinde 30 eşzamanlı sipariş işlemi, idempotency ve bildirim bütünlüğü doğrulanır. İkinci katmanda tools/local-capacity-profiles.sh, 50, 100 ve 200 paralel GET isteğini ayrı ayrı başlatılmış localhost API süreçlerine gönderir; sıfır HTTP hatası ve her profilde p95 <= 8000 ms gerekir.

Bu testler gerçek 50-200 kullanıcı oturumları değildir. 1000 gerçek kullanıcı, ayrı barındırma ve ölçülmüş CPU/RAM/PostgreSQL kapasitesi olmadan kanıtlanamaz. SSE ve polling fallback, DB bağlantı havuzu, kurye/işletme ağı ve provider gecikmeleri ayrıca test edilmelidir.

## Gerçek staging'e çıkış için
- Ayrı veritabanı, gerçek Auth0 test tenant ve HTTPS backend domaini
- Test hesaplarıyla gerçek email doğrulama, login, MFA, roller ve password recovery
- İki ayrı imzalı webhook sağlayıcısı, gerçek teslim ve operasyon yanıt süresi
- En az iki API replica, ortak rate limit, gerçek yedekleme/restore, çoklu kullanıcı yük ölçümü
- Gerçek işletme izni, KVKK ve sözleşme incelemesi, fiziksel mobil cihaz testleri
- Bu sırada production order intake kapalı kalmalı; operatör onayı olmadan açılmamalı

Daha geniş hazırlık listesi: docs/PRODUCTION_RUNTIME_AND_CAPACITY.md.
