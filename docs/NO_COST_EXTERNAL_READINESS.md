# Bismil Sofra — sıfır ücret şartı ile dış servis ve saha testleri

**Kapsam: 22 Kasım 2026.** Projenin son değişiklikleri ücretsiz test altyapısında geliştirilir; kaynak tüketimine bağlı ücret oluşturabilecek herhangi bir Railway dağıtımı, satın alma veya Auth0 ücretli plan etkinleştirilmez. Bu bir "canlıya çıkış onayı" değildir.

## Gerçek durum (kanıt düzeyleri)

| İstenen iş | Ücretsiz yapılabilen doğrulama | Saha/provizyon için bekleyen |
|---|---|---|
| Kalıcı HTTPS API | CI'da gerçek, fakat geçici Caddy HTTPS + Fastify + PostgreSQL çalıştı | 7/24 kalıcı ücretsiz sunucu ve izleme taahhüt edilemez; ücret veya hesap onayı olmadan açılmayacak |
| Bağımsız PostgreSQL | Test veritabanı bağımsız ve gerçek; Railway'de 500 MB ayrı disk **staged-create** | Kalıcı DB henüz başlatılmadı, veri kapasitesi/backup/restore kanıtı yok |
| Gerçek Auth0 | `tools/real-oidc-staging-smoke.mjs` gerçek sağlayıcı issuer/JWKS ve ayrı müşteri, restoran MFA, admin MFA token'larıyla salt-okunur doğrulama yapar | Gerçek test tenant'ı ve üç test kullanıcısının oluşması, doğrulanmış e-posta/MFA kanıtı, API bağlantısı |
| Bildirim | `tools/notification-https-contract.test.mjs` iki gerçek **yerel HTTPS** alıcısıyla HMAC, tekrarlanan bildirim ID'si ve provider HTTP 503 → fallback sözleşmesini test eder | Birbirinden gerçekten bağımsız iki dış sağlayıcı, teslimat makbuzları ve işletme cihazında uyarı |
| Fiziksel telefon | Chromium emülasyonu 360/390/768 px ile ekran kalitesini kontrol eder | Gerçek Android + iPhone üzerinde ekran, kilit, bildirim, ağ kopması, TalkBack/VoiceOver |
| Bağımsız güvenlik | Otomatik regresyonlar, JWT/tenant/privilege testleri ve npm production audit | Uygulama yazarı dışındaki uzmanın gerçek raporu, düzeltme doğrulaması |

## Ücret doğurmayan çalışma politikası

- Railway'de `bismil-sofra-staging` projesinin PostgreSQL 17, API, outbox ve escalation servisleri **yalnızca staged-create** durumunda tutulur. **Accept Deploy**, `generate_domain`, abonelik yükseltme veya kart ekleme yapılmaz.
- Railway Free planı $0 abonelik ve sınırlı aylık kaynak kredisi verebilir, ama bu 7/24 ücretsiz, kesintisiz ve 100+ aktif müşteriye uygun barındırma garantisi değildir. Kaynak limitleri de dardır.
- GitHub'da repo **private** olduğu için Actions runner dakikaları ve artifact depolaması ücretsiz kotadan düşebilir; kota/hesap harcama ayarı görülmeden yeni kapsamlı bulut CI çalışmaları başlatmak sıfır ücret garantisi sağlamaz. Yeni testleri öncelikle yerel çalıştır; faturalanabilen runner harcamasına bütçe sınırı/ödeme engeli ayarlamadan otomatik CI'nın ücretsiz olduğunu varsayma.
- Auth0 sağlayıcısında sadece resmi **Free** seçenek kullanılabilir; üç test kullanıcı hesabı gerçek kimlik sağlayıcısı üzerinde açılmalı, e-posta ve MFA doğrulanmalı. Gerçek kullanıcıların şifrelerini veya erişim token'larını bu sohbete kopyalama.
- Her iki webhook sağlayıcısının da **gerçek** ücretsiz planı, gönderim limiti, veri işleme koşulları ve sürekli kullanım şartları ayrıca kontrol edilir. Ücretsiz geçici webhook inbox'larına müşteri adresi/telefonu gönderme.

## Gerçek Auth0 testini çalıştırma — ön koşullu ve salt okunur

Aşağıdaki değişkenler yalnızca operatörün güvenli yerel terminalinde/secret manager'ında saklanır:
`STAGING_API_URL`, `STAGING_OIDC_ISSUER`, `STAGING_OIDC_AUDIENCE`,
`STAGING_CUSTOMER_ACCESS_TOKEN`, `STAGING_MERCHANT_ACCESS_TOKEN`, `STAGING_ADMIN_ACCESS_TOKEN`.

- API origin'i localhost veya ismi açıkça **staging** içeren ayrı bir HTTPS host olmalı.
- Verilen token'lar **ID token değil, API audience'ına basılmış access token** olmalı.
- Restoran hesabı Auth0 imzalı MFA claim ve atanmış test restorana sahip olmalı; yönetici en fazla 10 dakika önce gerçek MFA yapmalı.
- Script gerçek OIDC discovery + JWKS imzasını, issuer/audience ayrımını, üç ayrı subject'i, email verified/MFA, anonim erişim reddini, restoran/admin ve müşteri admin-denial kontrollerini test eder.
- Komut: `node tools/real-oidc-staging-smoke.mjs`. Sırlar eksikse **başarılı sonuç üretmez**. Gerçek kimlik sağlayıcısını sadece read-only kontrol eder; hesap açmaz ve sipariş göndermez.

## Fiziksel cihaz test kaydı — hepsi şu anda BEKLEMEDE

Gerçek cihaz testinde her satır için model, işletim sistemi sürümü, tarayıcı/PWA sürümü, ekran kaydı, kimlik rolü, ağ türü, tarih, gözlenen sonuç ve tester ekle.

| Test senaryosu | Android gerçek cihaz | iPhone gerçek cihaz |
|---|---|---|
| İlk giriş, Auth0 yönlendirme ve oturum kapatma | BEKLEMEDE | BEKLEMEDE |
| Restoran MFA ve 10 dakika sonra yeni doğrulama | BEKLEMEDE | BEKLEMEDE |
| Gerçek menü/görsel, 320-390 px, büyük yazı ve ekran okuyucu | BEKLEMEDE | BEKLEMEDE |
| Sepette seçenek/ekstralar, kapıda ödeme ve çift tıklama koruması | BEKLEMEDE | BEKLEMEDE |
| Wi-Fi → mobil veri, çevrimdışı → yeniden bağlanma, SSE/polling | BEKLEMEDE | BEKLEMEDE |
| Ekran kilitli, sessiz mod, güç tasarrufu: bildirim alımı | BEKLEMEDE | BEKLEMEDE |
| Restoran rolü başka restorana erişemez | BEKLEMEDE | BEKLEMEDE |

Gerçek cihaz veya gerçek sahip/tester olmadan bu satırları PASS yapma. Kişisel veriler içeren ekran kayıtlarını herkese açık GitHub Artifact'e yükleme.

## Bağımsız güvenlik değerlendirmesi için hazır inceleme kapsamı

Test hedefi yalnızca sahibi tarafından açıkça yetkilendirilmiş **staging HTTPS host** ve test kullanıcıları olmalı. Yazılımın yazarı dışından uzman, doğrulanmış kapsam/onay ve rapor gerekir. İncelenecekler:
1. Auth0 issuer/audience imza anahtar değişimi, MFA, token expiry/revocation ve rol yükseltme.
2. Restoran–restoran ve müşteri–müşteri veri izolasyonu, admin MFA, medya yükleme sınırları.
3. 50/100/200 eşzamanlı siparişte fiyat doğrulama, idempotency, stok ve outbox; çift sipariş riski.
4. Genel IP/kimlik kota dağıtımı, API rate limit, saldırıdan kaçınma; güvenlik kontrolleri **yük testleri ile kapatılamaz**.
5. TLS, CORS, hassas loglar, yedek şifreleme/geri yükleme, silme/veri saklama.

Rapor minimum alanları: `reviewer`, `authorization`, `date`, `tested_host`, `scope`, `findings(severity, evidence)`, `remediation`, `retest`, `signature`. Gerçek dış inceleme yapılmadıkça `docs/pilot-release-evidence.json` içindeki `security_independent_review` durumu `open` kalmalı.

**Yayın kararı: NO_GO.** 12 doğrulama kapısının tamamı insan/operatör kanıtıyla doğrulanmadan `PILOT_ACCEPT_ORDERS=true` yapılmaz.
