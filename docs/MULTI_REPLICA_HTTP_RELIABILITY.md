# İki API kopyasında gerçek HTTP/JWT sipariş entegrasyonu

## Test edilen
- İzole localhost PostgreSQL 17 _test veritabanında iki ayrı Fastify sunucusu açılır. Her kopya ayrı PostgreSQL LISTEN oturumu ve DB bağlantı havuzu kullanır.
- Yerel JWKS test sağlayıcısı tarafından RS256 ile imzalanmış 10 farklı kurgusal müşteri hesabı iki sunucuda provision edilir.
- Her müşteri için kendi teslimat adresi oluşturulur; iki sunucuya dağıtılarak POST /v1/orders/quote ardından POST /v1/orders üzerinden 10 paralel sipariş gönderilir.
- Aynı idempotency key + gövdeyle diğer API kopyasına tekrar gönderildiğinde replayed:true ve ilk ID dönmelidir. Tam 10 orders kaydı, 10 birincil bildirim ve 10 fallback eskalasyonu doğrulanır.
- Bir müşteri diğerinin siparişini farklı sunucudan okuyamaz.
- Aynı müşteri için iki sunucuya açık SSE bağlantısına PostgreSQL NOTIFY sinyali yansır; kişisel veri veya bearer token döndürülmez.

## Limitler
- 10 gerçek HTTP siparişi + 10 güvenli tekrar, daha önceki 30 doğrudan veritabanı transaction testinden ayrı bir ölçümdür.
- İki API kopyasında RequestLimiter process içinde ayrı çalışır; gerçek paylaşımlı limit yoktur. Testleri zorlamak için IP spoofing veya güvenlik kısıtlamalarını kapatmak yasaktır. Başlangıçta her replica 5 sipariş + 5 tekrar ile 12/dk order bucket limitinin içinde tutulmuştur.
- Bu JWKS sunucusu gerçek Auth0 değildir. 1000 gerçek kullanıcı, 1000 SSE veya gerçek bağımsız bildirim sağlayıcılarının başarılı olduğu kanıtlanmaz.
- Çoklu API DB pool max12, LISTEN ve worker bağlantıları managed PostgreSQL connection budget ile ölçülmelidir.
- Gerçek staging HTTPS/identity, 50/100/200 imzalı kullanıcı, merkezi gateway rate limiter, fiziksel mobil cihazlar ve independent provider testleri olmadan production sipariş açılamaz.

## Sonraki kabul
Gerçek staging'de farklı API replica sayıları, ağ kesilmesi, 30 HTTP checkout, db pool saturation, provider ack, 429/Retry-After, audit ve SSE yeniden bağlanma ölçümü; gerçek kullanıcı ve işletme izinleri ile KVKK/hukuk go/no-go onayı.
