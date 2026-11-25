# Bismil Sofra — Auth0 canlı bağlantı hazırlığı

**Durum:** Kod yerel bir OIDC/JWKS servisi ve gerçek PostgreSQL üzerinde HTTP testiyle doğrulanmıştır. Canlı bir Auth0 tenant'ına bağlanmış değildir. Aşağıdaki adımlar tamamlanana kadar gerçek siparişe açma.

## 1. Uygulama ve API

- Auth0'dan ayrı bir **Single Page Application** ve ona bağlı, belirli bir **Custom API Audience** oluştur.
- Allowed Callback/Logout/Web Origins: yalnızca uygulamanın gerçek HTTPS alan adlarını kullan. Genel `*` kullanma.
- API için `OIDC_ISSUER` (`https://TENANT_DOMAIN/`), `OIDC_AUDIENCE` (Custom API identifier), `OIDC_JWKS_URL` (`https://TENANT_DOMAIN/.well-known/jwks.json`) belirle.
- Müşteri kimliği doğrulanmış e-posta taşımalı; restoran ve yöneticiler için ayrıca MFA zorunlu.
- İmzalı **access token** kullan: ID token'ı API'ye göndermek güvenli değildir.

## 2. Auth0 Action — özel erişim tokenı claim'leri

Auth0 özel API access token'larında `email_verified` her zaman bulunmaz. Post-Login Action'da yalnızca Auth0 tarafından doğrulanmış `event.user.email_verified` bilgisini, isim alanlı bir claim'e yaz.

Aşağıdaki örnek **değişiklik yapılmadan canlıya alınmamalı**: örnek `https://bismilsofra.example/claims` URI'sini kendi yönettiğin namespace ile eşleştir ve uygulama yapılandırmasını aynı değere güncelle. MFA mekanizmasının tamamlanıp tamamlanmadığı ayrı bir Action sırasıyla doğrulanmalıdır.

```js
exports.onExecutePostLogin = async (event, api) => {
  const namespace = 'https://bismilsofra.example/claims';
  if (!event.user?.email_verified || !event.user?.email) {
    api.access.deny('Sipariş verebilmek için önce e-posta adresini doğrula.');
    return;
  }
  api.accessToken.setCustomClaim(namespace + '/email_verified', true);
  api.accessToken.setCustomClaim(namespace + '/email', event.user.email);

  // Bu Action, tamamlanmış MFA challenge'ından SONRA çalışmalıdır.
  // MFA'yı yalnızca kayıtlı olması nedeniyle var sayma.
  const methods = event.authentication?.methods || [];
  const completedMfa = methods.filter(m => m.name === 'mfa' && m.timestamp).at(-1);
  if (completedMfa) {
    api.accessToken.setCustomClaim(namespace + '/mfa', true);
    const mfaTime = Math.floor(Date.parse(completedMfa.timestamp) / 1000);
    if (Number.isFinite(mfaTime)) api.accessToken.setCustomClaim(namespace + '/mfa_at', mfaTime);
  }
};
```

Auth0 Dashboard üzerinde Action'ın **Post Login Flow**'a bağlandığını, gerçekten tamamlanmış MFA'dan sonra çalıştığını ve JWT access token'da imzalı claim'leri gördüğünü doğrula. Auth0'nun güncel MFA Actions kuralları tenant ayarlarına göre değişebilir; ilk kurulumu gerçek test kullanıcılarıyla doğrula.

Backend varsayılan adları:
- `OIDC_VERIFIED_CLAIM=https://bismilsofra.example/claims/email_verified`
- `OIDC_EMAIL_CLAIM=https://bismilsofra.example/claims/email`
- `OIDC_MFA_CLAIM=https://bismilsofra.example/claims/mfa`
- `OIDC_MFA_AT_CLAIM=https://bismilsofra.example/claims/mfa_at`

**Güvenlik:** Bu claim'ler yalnızca doğru issuer, audience, imza, algoritma ve süre doğrulandıktan sonra kabul edilir. Tarayıcıdan gönderilen düz JSON'a veya kullanıcı profilindeki istemci verisine güvenilmez. Üretimde HTTPS issuer/JWKS zorunludur.

## 3. Son test kapıları

- Gerçek müşteri hesabı: doğrulanmamış e-posta reddi, doğrulanmış giriş, çıkış, süresi dolan token, şifre sıfırlama.
- Restoran sahibi: MFA'sız erişim reddi, MFA sonrası kendi restoranının siparişleri, başka restoranın verisine erişememe.
- Yönetici: MFA ile paneli aç, 10 dakikalık süre dolduktan sonra panelde yeniden doğrulama uyarısını gör. **Yeniden kimlik doğrula** düğmesiyle Auth0 girişini aç, sağlayıcıda MFA'yı tamamla ve aynı panel bölümüne döndüğünü doğrula. API'nin yeni imzalı doğrulama zamanını kabul ettiğini ve işlemin denetim kaydına işlendiğini kontrol et.
- Bağlantı koparsa yeni siparişin `Idempotency-Key` ile güvenle sorgulanması.
- Kimlik sağlayıcısı hizmet dışıysa mevcut siparişlerin kaybolmaması ve sistemin güvenli şekilde başarısız olması.

Auth0 MFA Action referansı: https://support.auth0.com/center/s/article/using-actions-mfa-authentication-method-is-missing-on-first-login
Auth0 özel claim referansı: https://support.auth0.com/center/s/article/adding-custom-claims-to-tokens

Bu belge bir sağlayıcı kurulum rehberidir; tenant kurulumu veya üretimde kimlik doğrulama tamamlandığı anlamına gelmez.

## v2.2 çok faktör doğrulama ayrımı

OIDC `amr` içinde yalnızca `otp`, `totp`, `webauthn` veya `hwk` olması, ikinci bir faktörün gerçekten tamamlandığını **kanıtlamaz**. API, bu tekil yöntemleri restoran veya yönetici MFA'sı olarak kabul etmez.

API'nin tanıdığı `amr: ["mfa"]` işareti veya aynı güven seviyesindeki adlandırılmış imzalı `OIDC_MFA_CLAIM`, gerçek Post-Login Action tarafından **tamamlanmış MFA olayından sonra** üretilmelidir. Gerçek Auth0 tenant bağlantısı yapılmadan ve güçlü/kırık oturum testleri geçmeden yetkilendirme canlı kabul edilmemelidir.

## Staging kurulumu: hesap sahibinin yapacağı adımlar (24 Kasım 2026)

**Durum: DOĞRULANMADI.** Bu bölüm sağlayıcı hesabını kendiliğinden oluşturmaz. Kimlik bilgilerini ve erişim token'larını GitHub'a, sohbete veya ekran görüntülerine koyma. Arayüzdeki `onRedirectCallback` yönlendirmesi aynı-origin yol doğrular; bu yalnızca güvenli geri dönüş düzeltmesidir, gerçek Auth0 oturum testi değildir.

1. [Auth0 Dashboard](https://manage.auth0.com/) üzerinde **Bismil Sofra için ayrı staging tenant'ı** oluştur; Karkalkan kimlik sağlayıcısını ve gerçek müşteri hesaplarını yeniden kullanma. **Universal Login** ve e-posta/şifreli Database Connection etkin olsun. Tenant şifre politikası ve güvenli oturum özelliklerini gözden geçir.
2. `Applications → Create Application → Single Page Application` oluştur. Uygulamanın **Client ID'si tarayıcıda görünür; Client Secret'ı frontend'e kesinlikle ekleme.** Auth0 → Applications → APIs → Create API ile yalnız staging'e ait ve birebir aynı kalacak `Identifier` / audience oluştur.
3. `Application URIs` alanlarını birebir kaydet (örnek mevcut sabit Vercel önizleme alanı; gerçekten hangi alanın kullanılacağını önce panelinden doğrula):

   ```text
   Allowed Callback URLs: http://127.0.0.1:3000, https://bismil-sofra-preview.vercel.app
   Allowed Logout URLs: http://127.0.0.1:3000, https://bismil-sofra-preview.vercel.app
   Allowed Web Origins: http://127.0.0.1:3000, https://bismil-sofra-preview.vercel.app
   ```

   `*`, geçici her PR alanı, farklı origin veya rastgele telefon istemcisi ekleme.
4. `Branding → Universal Login` kısmında gerçek **Sign up**, e-posta doğrulama akışını ve **Forgot password / Reset password** adımlarını etkinleştir. `Authentication → Database` bağlantısının staging SPA için açık olduğunu doğrula. `Branding → Email Templates` kısmında **Verify Email** ve **Change Password** şablonlarını ve gönderim ayarlarını incele. Gerçek test e-postası alıp bağlantıdan doğrula; reset bağlantısının bir defalık ve süreli olmasını kontrol et.
5. `Actions → Flows → Login` içindeki mevcut Post-Login Action'ı yukarıdaki örneğe göre düzenle. **İmzalı API access token** içinde `email_verified`, `email` ve yalnız tamamlanmış MFA sonrası `mfa`, `mfa_at` adlandırılmış claim'leri kontrol et. Yalnızca MFA'ya **kayıtlı** olmayı tamamlanmış MFA sanma; `amr=['otp']` tek başına kabul edilmez.
6. **Önemli ücretsiz plan engeli:** 2026 tarihli Auth0 plan/destek açıklamalarında MFA **Free planında kalıcı olarak sunulmuyor**. 22 günlük deneme veya geçici çalışan MFA, sürdürülebilir ücretsiz pilot kanıtı değildir. Ücretli plana izinsiz geçme ve kodda MFA'yı kaldırma. Gerçek ücretsiz alternatif ya da uygun resmi program belirlenmedikçe `real_oidc_mfa_accounts` kapısı **OPEN / DOĞRULANMADI** kalır.
7. En az üç **ayrı, kişisel veri içermeyen** staging test hesabı aç: (a) e-postası doğrulanmış müşteri, (b) gerçekten MFA tamamlayan restoran sahibi, (c) gerçekten MFA tamamlayan platform yöneticisi. Staging veritabanındaki `restaurant_staff` / `platform_admins` rollerini sadece yetkili operatör atayabilir. Client tarafında email'e göre admin belirleme.
8. Yalnızca **ortam değişkenlerini** güvenli sağlayıcı paneline gir (placeholder'ları gerçek değerle değiştir; bu blok gerçek sır içermez):

   ```dotenv
   # Web / Vercel: PUBLIC values; SPA client secret NEVER here
   NEXT_PUBLIC_API_URL=https://api-staging.YOUR_DOMAIN.example
   NEXT_PUBLIC_AUTH0_DOMAIN=YOUR_TENANT.REGION.auth0.com
   NEXT_PUBLIC_AUTH0_CLIENT_ID=YOUR_PUBLIC_SPA_CLIENT_ID
   NEXT_PUBLIC_AUTH0_AUDIENCE=https://api-staging.YOUR_DOMAIN.example

   # API / Railway: server-side only. Reference them using provider secret manager.
   NODE_ENV=production
   CORS_ORIGIN=https://bismil-sofra-preview.vercel.app
   OIDC_ISSUER=https://YOUR_TENANT.REGION.auth0.com/
   OIDC_AUDIENCE=https://api-staging.YOUR_DOMAIN.example
   OIDC_JWKS_URL=https://YOUR_TENANT.REGION.auth0.com/.well-known/jwks.json
   OIDC_VERIFIED_CLAIM=https://bismilsofra.example/claims/email_verified
   OIDC_EMAIL_CLAIM=https://bismilsofra.example/claims/email
   OIDC_MFA_CLAIM=https://bismilsofra.example/claims/mfa
   OIDC_MFA_AT_CLAIM=https://bismilsofra.example/claims/mfa_at
   PILOT_ACCEPT_ORDERS=false

   # Read-only staging probe, local operator shell only; no tokens in GitHub
   STAGING_API_URL=https://api-staging.YOUR_DOMAIN.example
   ```

   Veritabanı bağlantısı `DATABASE_URL` yalnız API/işçi tarafında tutulur; yetkilendirildiği staging PostgreSQL örneğine ait olmalıdır. `ORDER_EVENTS_LISTEN_DATABASE_URL` session-capable gerçek PostgreSQL bağlantısına işaret etmelidir; transaction pooler üzerinden `LISTEN` çalışmaz.
9. Web giriş/kayıt, e-posta doğrulaması, çıkış ve şifre sıfırlamayı **telefon ve masaüstü üzerinde** tamamla. Kısıtlı hesap/MFA'sız/yanlış tenant/yanlış audience/bozuk imza erişimini reddettiğini doğrula; daha sonra `node tools/staging-preflight.mjs` ile HTTPS API sağlık kontrolünü yap. Üç gerçek API access token'ı ile `npm run test:real-oidc-staging` varsa salt okunur rol testini, token'ları yalnız gizli terminalde tanımlayarak çalıştır.
10. Her operatör ve cihaz için **tarih, alan adı, gerçek gözlenen sonuç, test kullanıcısı referansı ve PII içermeyen kanıt** kaydet. Gerçekten yapılmadan `docs/pilot-release-evidence.json` kapılarını `verified` yapma.


### Staging yetki ve sipariş bağlantısı kontrolü

`STAGING_API_URL` izole HTTPS API adresi, `STAGING_RESTAURANT_ID` test restoranının kimliği olmalıdır. Sadece bu ortamdaki üç ayrı test hesabının kısa ömürlü API erişim belirteçlerini geçici olarak `STAGING_CUSTOMER_ACCESS_TOKEN`, `STAGING_MERCHANT_ACCESS_TOKEN` ve `STAGING_ADMIN_ACCESS_TOKEN` ortam değişkenlerine yükleyin. Restoran hesabı test restoranının sahibi olmalıdır. Ardından `npm run test:real-oidc-staging` çalıştırın. İş bitince bu üç değişkeni oturumdan kaldırın.

Araç yalnız GET çağrılarıyla veritabanı hazırlığını, müşteri sipariş listesini, restoran rolü ve kuyruğunu, canlı bağlantının hazır sinyalini, yönetici erişimini ve yetkisiz rol retlerini kontrol eder. Çıktı yalnız kontrol adları ve HTTP durumları içerir. API ilk doğrulanmış girişte yerel kullanıcı kaydı oluşturabilir. Bu kontrol tarayıcı kaydını, parola sıfırlamayı, fiziksel cihazları veya sipariş teslimatını tek başına doğrulamaz.
