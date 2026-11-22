# Bismil Sofra — backend container ve staging kurulum sınırları

Bu Docker paketi **canlı sipariş yayını değildir**. Amaç API ve worker'ların bağımlılıklarıyla birlikte sunucuya güvenle taşınabilmesini sağlamaktır.

## Docker görüntüsü
- Depo kökünden: docker build -f apps/api/Dockerfile -t bismil-sofra-api:local .
- NODE_ENV=production, API_BIND_HOST=0.0.0.0, PORT=4000 varsayılanları vardır. Uygulamayı yalnızca HTTPS reverse proxy veya özel iç ağ arkasında sun. Veritabanı portunu veya doğrudan Fastify portunu internete açma.
- Uygulama root değil, node kullanıcısıyla çalışır. Paket yalnızca production bağımlılıklarını ve API kaynak/migration dosyalarını içerir; local .env dosyası, test kayıtları, kullanıcı fotoğrafları, gizli sertifikalar **imaja dahil edilmez**.
- /healthz süreç sağlığını, /readyz gerçek veritabanı ve migration hazır oluşunu gösterir. Container HEALTHCHECK liveness kontrolünü yapar; orkestratör readiness için ayrıca /readyz kullanmalıdır.
- SIGTERM kapanışta yeni trafik yönlendirmesini durdurmaya ve bağlantıları temizlemeye yarar. İmaj tek bir API süreci başlatır; işçiler farklı instance/process olarak çalıştırılmalıdır.
- Production siparişleri PILOT_ACCEPT_ORDERS=true ve gerçek sağlayıcı kanalları kurulmadıkça 503 ile kapalı kalır.

## Gerçek worker süreçleri
Aynı imajdan, ayrı servis/süreç olarak şu komutlar çalıştırılır:
- node --experimental-strip-types apps/api/src/expiry-worker.ts
- node --experimental-strip-types apps/api/src/outbox-worker.ts
- node --experimental-strip-types apps/api/src/escalation-worker.ts

Outbox ve escalation sağlayıcılarının gerçek HTTPS adres ve bağımsız imza anahtarları sadece runtime secret store / ortam değişkenlerinde tutulmalıdır. Her worker için izleme, log, restart policy ve retry/dedupe testleri şarttır. Birinci ve ikinci sağlayıcı aynı altyapı üzerinde olmamalıdır.

## Test otomasyonu
GitHub CI, migration yapılmış **yerel PostgreSQL test veritabanı** varken production moduyla imajı gerçekten build ve run eder. HTTP GET /readyz, GET /v1/zones ve yetkisiz POST /v1/orders → 503 ORDER_INTAKE_CLOSED koşullarını doğrular.

CI, geçici Ubuntu koşucusunda --network host ve sahte issuer URL'leri kullanır. Bunlar üretim dağıtım ayarları değildir: gerçek sunucuda isolated network, TLS ingress, gerçek Auth0 ve secret store gerekir.

## Yapılmamış üretim işlemleri
- Bir üretim sunucusuna deploy yapılmadı.
- Gerçek PostgreSQL hizmeti, monitör ve uzak şifreli yedek yapılandırılmadı.
- Gerçek Auth0, MFA, iki gerçek imzalı bildirim kanalı ve fiziksel telefon testi yok.
- 1.000 eşzamanlı müşteri kapasitesi gösterilmedi; önce 50/100/200 oturum, 30 HTTP order, kademeli yük, kapasite/DB bağlantı ölçümleri ve maliyet modeli tamamlanmalıdır.
- Canlı müşteri testleri şimdilik ertelenmiştir; bunlar geçilmeden production intake açılamaz.

İlgili güvenlik ve kapasite listesi: docs/PRODUCTION_RUNTIME_AND_CAPACITY.md.
