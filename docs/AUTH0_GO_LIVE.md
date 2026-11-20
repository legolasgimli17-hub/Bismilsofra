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
- Yönetici: MFA, kritik işlemlerde **10 dakika içinde** yeniden doğrulama ve işlem kaydı.
- Bağlantı koparsa yeni siparişin `Idempotency-Key` ile güvenle sorgulanması.
- Kimlik sağlayıcısı hizmet dışıysa mevcut siparişlerin kaybolmaması ve sistemin güvenli şekilde başarısız olması.

Auth0 MFA Action referansı: https://support.auth0.com/center/s/article/using-actions-mfa-authentication-method-is-missing-on-first-login
Auth0 özel claim referansı: https://support.auth0.com/center/s/article/adding-custom-claims-to-tokens

Bu belge bir sağlayıcı kurulum rehberidir; tenant kurulumu veya üretimde kimlik doğrulama tamamlandığı anlamına gelmez.

## v2.2 çok faktör doğrulama ayrımı

OIDC `amr` içinde yalnızca `otp`, `totp`, `webauthn` veya `hwk` olması, ikinci bir faktörün gerçekten tamamlandığını **kanıtlamaz**. API, bu tekil yöntemleri restoran veya yönetici MFA'sı olarak kabul etmez.

API'nin tanıdığı `amr: ["mfa"]` işareti veya aynı güven seviyesindeki adlandırılmış imzalı `OIDC_MFA_CLAIM`, gerçek Post-Login Action tarafından **tamamlanmış MFA olayından sonra** üretilmelidir. Gerçek Auth0 tenant bağlantısı yapılmadan ve güçlü/kırık oturum testleri geçmeden yetkilendirme canlı kabul edilmemelidir.
