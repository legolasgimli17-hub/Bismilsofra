# İki telefonla özel sipariş provası

Bu prova için geliştirme bilgisayarı çalışır durumda, iki telefon aynı özel Tailscale ağına bağlı ve üç ayrı OIDC test hesabı hazır olmalı. Restoran ve yönetici hesapları gerçek MFA tamamlamalı. Prova ortamında örnek restoran ve örnek adresler kullanın.

## Yerel servisleri açma

1. Bilgisayarı özel ağda `bismil-staging` gibi bir adla kaydedin. Ağa yalnız prova cihazlarına erişim izni verin. Tailscale HTTPS'i etkinleştirip aşağıdaki komutla yerel geçidi yayınlayın. Komutun verdiği HTTPS origin adresini not edin. Tailscale Funnel kullanmayın.

   ```sh
   tailscale serve --bg http://127.0.0.1:4170
   ```

2. Mevcut [Auth0 staging kurulumuna](AUTH0_GO_LIVE.md) göre bu HTTPS origin'i izinli callback, logout ve web origin listelerine ekleyin. Auth0 ayarlarını ve test token bilgilerini ayrı tutun.
3. `STAGING_DB_PASSWORD`, `STAGING_DATABASE_URL`, `STAGING_CORS_ORIGIN`, `STAGING_OIDC_ISSUER`, `STAGING_OIDC_AUDIENCE` ve `STAGING_OIDC_JWKS_URL` değişkenlerini yerel ortamda ayarlayın. CORS origin adım 1'deki tam HTTPS adresidir. PostgreSQL servis adı `db`, veritabanı `bismil_sofra_staging` ve kullanıcı `sofra_staging`. Parolayı URL içinde gerektiği şekilde kodlayın.
4. Depo kökünde ayrı prova projesini başlatın. Ek Compose dosyası kurgusal verilerle siparişe izin veren test modunu açar; bu ayarı pilot veya canlı ortama taşımayın.

   ```sh
   docker compose -f deploy/staging.compose.yml -f deploy/staging.rehearsal.compose.yml up -d --build db migrate api expiry
   ```

5. Web uygulamasını kurun. `NEXT_PUBLIC_API_URL` değerini adım 1'deki HTTPS origin olarak ayarlayın. `NEXT_PUBLIC_AUTH0_DOMAIN`, `NEXT_PUBLIC_AUTH0_CLIENT_ID` ve `NEXT_PUBLIC_AUTH0_AUDIENCE` değerlerini aynı test uygulamasından alın. Build bu değerleri kullanır. Web ve geçit ayrı terminallerde çalışır.

   ```sh
   npm ci
   npm run web:build
   npm --workspace apps/web exec -- next start --hostname 127.0.0.1 --port 3000
   ```

   ```sh
   node tools/private-staging-gateway.mjs
   ```

## Telefon provası

- İki telefondan aynı özel HTTPS adresini açın. `/readyz` hazır olmalı. [Rol ve canlı bağlantı ön kontrolü](AUTH0_GO_LIVE.md#staging-yetki-ve-sipariş-bağlantısı-kontrolü) ile başlayın.
- Yönetici test restoranının menüsünü, teslimat mahallesini, çalışma saatini ve sahip hesabını ayarlar. Müşteri telefondan ürünü ve mahalleyi seçip test siparişini verir. Diğer telefon restoran hesabıyla gelen siparişi görür ve teslimata kadar ilerletir.
- Restoran telefonunda ağı kapatıp açın. Bekleyen siparişin geri geldiğini, müşteri durumunun eşitlendiğini ve aynı siparişin iki kez oluşmadığını gözlemleyin. Gerçek Auth0 ve cihaz doğrulamasını ancak bu adımlardan sonra kaydedin.
- Müşteri telefonunda bir test siparişi gönderirken bağlantı kesilirse aynı sekmeyi yenileyin. **Sipariş durumunu kontrol et** ile kaydı bulun. Gerekirse **Aynı isteği yeniden gönder** düğmesini kullanın ve restoran kuyruğunda aynı siparişin yalnızca bir kez göründüğünü doğrulayın.
- Restoran tarafında kabul sayacının sıfıra indiğinde düğmeleri kapattığını kontrol edin. Cihaz saatini değiştirerek sayacın sunucu saatine uyumunu da doğrulayın.
- Prova sonunda `tailscale serve --https=443 off` ile bu prova için açılan HTTPS rotasını kapatın ve Compose projesini durdurun. Varsayılan Compose kapatma komutu prova veritabanı volume'unu silmez.

## Windows: özel prova ortamını tek komutla açma

Docker Desktop ve Tailscale açıkken güncel depo kökünde çalıştırın. Önceki provadaki `deploy/staging.env` ve `apps/web/.env.local` dosyalarını kullanır. Web derlemesine yalnızca herkese açık SPA ayarları aktarılır. Aynı Compose proje adı ve PostgreSQL volume'u kullanılır.

```powershell
docker compose --env-file deploy/staging.env --env-file apps/web/.env.local -f deploy/staging.compose.yml -f deploy/staging.rehearsal.compose.yml -f deploy/private-web.compose.yml up --build -d
```

İlk web derlemesi internet bağlantısı gerektirir. API ve arayüz yanıt verdikten sonra mevcut özel HTTPS adresini yeni geçide yönlendirin:

```powershell
curl.exe -fsS http://127.0.0.1:4172/readyz
if ($LASTEXITCODE -eq 0) {
  curl.exe -fsS -o NUL http://127.0.0.1:4172/restaurant/overview
  if ($LASTEXITCODE -eq 0) { tailscale serve --bg http://127.0.0.1:4172 }
}
```

Profil bildirim işçilerini varsayılan olarak başlatmaz; webhook provası ayrıca yapılandırılır. Bu özel ortam bilgisayar açıkken erişilebilir. Önceki geçit hâlâ çalışıyorsa yönlendirme `tailscale serve --bg http://127.0.0.1:4171` ile geri alınabilir. Veritabanı volume'unu silmeyin.
