# Bismil Sofra — Kalite denetimi v1.3 / 19 Kasım 2026

## Kanıtlanmış GitHub CI sonucu
- [En son başarılı CI çalışması](https://github.com/legolasgimli17-hub/Bismilsofra/actions/runs/44547699374), commit `8d1ab6a06f0d1f6cd7eb038a7153f6f202e6b3a5`.
- Verify: **84/84 birim testi** (50 backend, 5 sepet, 11 keşif, 5 bağlantı, 13 işletme), TypeScript API + web kontrolü, Next.js üretim derlemesi — tümü başarılı.
- PostgreSQL 17.6 entegrasyon: **2/2 gerçek DB entegrasyon testi başarılı**. Migration, örnek verinin yüklenmesi, sunucuda fiyat hesaplama, sipariş durumu/geçmişi, tokenlı HTTP API, yetkilendirme, yanlış/yeniden sipariş, yeni sipariş listesi ve bildirim yeniden denemesi sınandı.
- HTTP testi **gerçek Fastify sunucusu + gerçek PostgreSQL + kriptografik olarak imzalanan RSA/JWT + yerel JWKS fixture** kullanır. **Gerçek Auth0 tenant'ı değildir**.

## Gerçek kusurların kapatılması
1. `/readyz` PostgreSQL'e yanlış parametre sayısı gönderiyordu — düzeltildi; artık HTTP testinde gerçekten çağrılıyor.
2. Gerçek HTTP/JWT testleri yoktu — eklendi. İmzasız/yanlış imzalı token, doğrulanmamış e-posta, yanlış tenant ve MFA'sız işletme erişimi reddediliyor.
3. Restoranın 7 saniyelik yenileme istekleri yarışarak eski verinin üzerine yazabiliyordu — artan sıra numarası kontrolü eklendi.
4. Yeni siparişleri sadece sayfaya bakarak fark etmek gerekiyordu — **kullanıcı onaylı sekme-içi sesli uyarı** ve her yeni sipariş için bir defalık bildirim mantığı eklendi. Bu push/telefon kilitliyken alarm garantisi değildir.
5. Auth0 API erişim tokenlarında standart `email_verified` alanının her zaman olmaması — imzalı, namespaced doğrulama, e-posta ve MFA claim'leri desteklendi; kurulum prosedürü `docs/AUTH0_GO_LIVE.md` içinde.

## Durdurucu eksikler — 5 restoranlık canlı pilot henüz açılamaz
- [ ] **Gerçek Auth0** tenant ve Post Login Action kurulumları, gerçek müşteri ve restoran MFA testleri.
- [ ] **Prod bildirimi**: cihaz/uygulama kapalıyken yedek alarm, idempotent webhook alıcısı, push veya güvenilir ikincil kanal, teslimat gözetimi.
- [ ] **Tekrarlanabilir kurulum**: `package-lock.json` versiyonlanmalı, CI `npm ci` kullanmalı.
- [ ] **Yayınlanan geliştirme ortamı**: HTTPS domain, API, DB, gizli değişkenler, izleme, yedekleme ve geri yükleme provası.
- [ ] **Gerçek restoran fotoğrafları**: izinli kaynaktan menü görselleri alınmalı, WebP işlemesi ve depolama/CDN doğrulanmalı.
- [ ] **Mobil gerçek cihaz testleri**: sepet, konum, yavaş internet, erişilebilirlik ve arka plan yenileme.
- [ ] **İşletme saha provası**: en az 5 restoran için bildirim düşmeme/kabul süresi/adres/teslimat senaryoları.

Kapsam değişmez: Bismil, pilotta 5 restoran, en fazla 50 aktif restoran; online ödeme veya ayrı kurye filosu yok, kapıda nakit ve restoran POS'u var.

**Bağımsız değerlendirme:** Kodun test edilebilirliği kayda değer iyileşti. Ancak canlı kimlik sağlayıcısı, gerçek SMS/push/ikincil alarm ve sahadaki restoran cihazları bulunmadan Yemeksepeti ölçeğinde operasyonel güvenilirlik sağlandığını iddia edemeyiz.
