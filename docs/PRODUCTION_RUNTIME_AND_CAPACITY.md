# Bismil Sofra — Production runtime ve kapasite kalite kapısı

Tarih: 22 Kasım 2026. Bu belge bir **yük testinin sonucu** değil, kodlanmış otomatik kalite kontrolü ve yapılması gereken gerçek staging denemelerinin sınırıdır.

## Kodda sağlanan güvenlik

- Fastify API varsayılan olarak 127.0.0.1 adresinde dinler. Docker, Railway ve Kubernetes benzeri ortamlarda API_BIND_HOST=0.0.0.0 yalnızca güvenilir ağ/HTTPS reverse proxy arkasında açıkça tanımlanmalıdır. PORT geçersizse servis sessizce başka bir portla başlamaz.
- NODE_ENV=production iken gerçek POST /v1/orders varsayılan olarak **kapalıdır** ve 503 ORDER_INTAKE_CLOSED döner. API'nin veya veritabanının çalışması tek başına sipariş kabul etmeye izin vermez.
- Üretimde sipariş açılabilmesi için PILOT_ACCEPT_ORDERS=true; HTTPS CORS_ORIGIN; iki **farklı HTTPS hostname** kullanan birincil ve ikincil bildirim webhook'u; ayrı ve en az 32 karakterli imza anahtarları gerekir.
- Bu kontroller yalnızca konfigürasyon hatasını engeller. Gerçek bildirim teslimini, bağımsız sağlayıcı olmasını ve gerçek telefonun çalmasını kanıtlamaz. Operatör gerçek sağlayıcıları ayrı doğrulamalıdır.
- SIGTERM/SIGINT sırasında yeni yük dengeleyici trafiğini kesebilmek için /readyz 503 draining döner; süreç Fastify bağlantılarını ve DB bağlantı havuzunu kapatmaya çalışır. 20 saniyelik bir sonlandırma sınırı vardır.

## Otomatik ölçüm

- npm run test:api: listener ve üretim sipariş koruma mantığı için testler.
- CI gerçek PostgreSQL 17 üzerinde **kurgusal verilerle** API'yi yerel portta başlatır. GET /v1/restaurants, /v1/zones, /v1/categories ve /healthz uç noktalarına 160 istek / 40 eşzamanlı istek gönderir. Ağ/HTTP hatasında veya p95 6.000 ms'yi aşarsa CI kırmızı olur.
- Yük aracı yalnızca yerel http://127.0.0.1:<port> ya da localhost adresini kabul eder; uzak canlı servise, HTTPS adrese veya yetki gerektiren/sipariş oluşturan endpoint'e yük göndermeyi reddeder.
- Bu 160 istek **1.000 gerçek kullanıcının** ya da 30 eşzamanlı ödeme/siparişin doğrulandığı anlamına gelmez.

## Staging test planı — gerçek müşteri gerektirmez

1. İzole PostgreSQL ve kurgusal hesaplarla 50, ardından 100, ardından 200 simüle oturum. İşlem başına p50/p95/p99 ve 5xx/429 oranını ölç.
2. 30 eşzamanlı sipariş oluşturma denemesinde geçerli/idempotent sipariş adedini, double charge/double order yokluğunu, tenant izolasyonunu, adet/fiyat doğrulamasını ve bildirim outbox kayıtlarını kontrol et. **Gerçek restoran veya müşteri veritabanını kesinlikle kullanma.**
3. Tek kopya ve çok kopya senaryoları ayrı test et: API havuzu max=12 PostgreSQL bağlantısı kullanır; replica sayısıyla çarpılır. SSE sınırı API kopyası başına 300, üye başına 3'tür. 7 saniyelik polling ile alternatif HTTP yükünü ölç.
4. Ağ kopması, PostgreSQL yeniden başlama, birincil ve bağımsız fallback alarm hataları, kuyruk tıkanması, SIGTERM rolling deploy, migration geri dönüşü ve şifreli yedekten geri yükleme tatbikatı.
5. Sonuçlar temelinde performans hedefi, kaynak ve ölçek maliyeti belirle. Sadece CI'da yeşil olmak üretime hazır demek değildir.

## Açık üretim kapıları

- [ ] HTTPS API ve veritabanı barındırma (demo Vercel yalnızca frontend)
- [ ] Gerçek OIDC tenant, doğrulanmış e-posta, MFA, hesap kurtarma
- [ ] İki gerçekten bağımsız ve imza doğrulanmış bildirim kanalı; son cihaz teslim testi
- [ ] Offsite şifreli otomatik yedek ve ayrı staging restore provası
- [ ] Reverse proxy güvenilir IP ayarları, gateway ortak rate-limit ve trafik koruması
- [ ] Ölçülmüş staging 50/100/200 eşzamanlı kullanım, 30 eşzamanlı sipariş, hata senaryoları
- [ ] İzinli gerçek restoran fotoğrafları, 360px erişilebilirlik, fiziksel Android/iPhone UX
- [ ] 5 restoran sözleşmesi, operasyon sorumluları, KVKK ve hukuki kontrol
- [ ] Sonrasında ayrı operatör kararıyla PILOT_ACCEPT_ORDERS=true

Canlı müşteri testi ertelenebilir; fakat tamamlandığını iddia edemeyiz ve production order intake şu anda kapalı kalmalıdır.
