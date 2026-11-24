# Railway: Bismil Sofra staging resources and activation gates
Date: 2026-11-22
Owner repository: `legolasgimli17-hub/Bismilsofra`
No Supabase reuse. Karkalkan is isolated.

## What actually exists
Railway project: `bismil-sofra-staging` (`51339e40-3d5d-477a-844d-1ea9f5011295`), environment `staging` (`7824a866-e0b6-4288-82a9-d5f0b316dc7b`), under the connected personal workspace.

Everything below is **staged-create**, not live:
- `sofra-postgresql-17`: official `postgres:17.6-alpine`, planned region `europe-west4`, persistent `sofra-staging-pgdata` **500 MB**, mounted at `/var/lib/postgresql/data`. Non-secret variables `POSTGRES_DB=bismil_sofra_staging`, `POSTGRES_USER=sofra_staging`, `POSTGRES_INITDB_ARGS=--auth-host=scram-sha-256` are staged.
- `sofra-api`: Fastify container Dockerfile `apps/api/Dockerfile`, production runtime, healthcheck `/readyz`, predeploy migration runner, drain grace 20 seconds, planned `europe-west4`. **`PILOT_ACCEPT_ORDERS=false`** and five-restaurant rollout limit are staged.
- `sofra-outbox-worker`: separate primary alert worker, staged only, source not linked.
- `sofra-fallback-worker`: separate independent escalation worker, staged only, source not linked.

No running service, real PostgreSQL session, publicly trusted HTTPS API, actual Auth0 user, external provider receipt or full-device test has been created by these changes. Railway rejected 1024 MB volume on the connected plan: **500 MB maximum** was reported. Do not treat this as sufficient real production capacity.

## Exact prerequisites before activating cloud resources
1. Railway account owner: verify billing/free-trial limits and intended monthly cap. The **Railway GitHub integration is now connected in the STAGED `sofra-api` source** for `legolasgimli17-hub/Bismilsofra` `main`; this only resolves repository access. It is not a deployment.
2. Database operator: generate an independent strong staging `POSTGRES_PASSWORD` in a secret manager. Set a private-network `DATABASE_URL` for the API and both workers using Railway service references and URL-encoded credentials. Do not use the Karkalkan database or upload a .env.
3. Auth0 tenant owner: configure a **separate staging** Auth0 application/API, allowed callback and logout URLs, HTTPS JWKS issuer/audience and verified test users. At minimum verify customer, merchant owner/staff with actual MFA, and platform administrator with actual MFA. Revoke an account and verify immediate API denial after its token/session expires; test key rotation and account recovery. Do not create fake externally verified accounts.
4. Before exposing any API, set the actual frontend `CORS_ORIGIN`, `OIDC_ISSUER`, `OIDC_AUDIENCE`, `OIDC_JWKS_URL`, suitable hosted PostgreSQL/TLS settings, trusted proxy/edge rate limiter and private networking. Check both 200 `/readyz` and the expected **503 ORDER_INTAKE_CLOSED** for `POST /v1/orders` with order intake disabled.
5. Notification provider owner: configure **two operationally independent** HTTPS channels and 32+ character distinct HMAC secrets. Capture request IDs, provider-side accepted/delivered receipts, recipient acknowledgments, outage/retry/fallback timing, and duplicate-event suppression. Only then start both worker services.
6. Backups: encrypt actual staging dumps, store them off-server, rotate keys, test restore into a **different** isolated database and record RPO/RTO. CI encrypted disposable test backups are not offsite backups.
7. Operator: verify on **physical** Android and iPhone devices, including backgrounding and Wi-Fi/mobile-data loss, merchant alert delivery and order double-submission recovery. Store device + OS + screenshot/video + observed result evidence.
8. Independent security reviewer (not the app author): perform scoped black-box/white-box review with real staging accounts; provide signed report, risk ratings and verified remediation evidence. Code self-review is not independent review.
9. Keep the pilot release gate **NO_GO** until the full external checklist is verified. No real restaurant onboarding or public order intake until written consent, legal/KVKK review and signed service contracts.

## Safe status checks
Read project/environment state in the Railway dashboard and verify each service is either `staged-create` or has an explicitly reviewed deployment. Before accepting the stage changes inspect the exact pending diff and confirm it contains **no public domain enabling customer orders** and **no weak or missing credentials**.

The existing CI workflow for temporary local HTTPS staging and the 50/100/200 simulated signed HTTP checkout suite remain independent of this cloud project. Green CI is not a live provider test.

See also `docs/STAGING_WORKER_TOPOLOGY.md`, `docs/PILOT_OPERATIONS_RUNBOOK.md` and `docs/pilot-release-evidence.json`.

## 24 Kasım 2026 gerçek Railway durum kontrolü — DOĞRULANMADI

Bağlı Railway hesabının `bismil-sofra-staging` / `staging` ortamı doğrudan sorgulandı:

- `STAGED`: **42 bekleyen değişiklik**. `sofra-api`, `sofra-postgresql-17`, `sofra-outbox-worker`, `sofra-fallback-worker` ve 500 MB disk **staged-create** durumda. **0 çalışan deployment, 0 gerçek sunucu / HTTPS domain**; burada herhangi bir gerçek API preflight çalıştırılabilecek alan adı yok.
- GitHub özel depo bağlantısı `sofra-api` için artık `main` üzerinden **staged**. Daha eski "GitHub bağlantısı çalışmıyor" ifadesi güncel değildir. İki bildirici worker'da kaynak repo bağlantısı hâlâ boş; önce bu servislerin gerçek kaynakları ve komutları gözden geçirilmeli.
- Staged API ortamında `NODE_ENV`, `PORT`, `API_BIND_HOST`, `PILOT_ACCEPT_ORDERS=false` ve pilot cap `5` hazırlanmış; **`DATABASE_URL`, `CORS_ORIGIN`, `OIDC_ISSUER`, `OIDC_AUDIENCE`, `OIDC_JWKS_URL` staged değişiklik listesinde yok.**
- Staged PostgreSQL'de `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_INITDB_ARGS` var; **`POSTGRES_PASSWORD` staged değişiklik listesinde yok.** API/işçi süreçlerinin güvenli açılması mümkün değil.
- `sofra-outbox-worker` için `DATABASE_URL`, `ALERT_WEBHOOK_URL`, `ALERT_WEBHOOK_SECRET`; `sofra-fallback-worker` için `DATABASE_URL`, `ESCALATION_WEBHOOK_URL`, `ESCALATION_WEBHOOK_SECRET` bulunmuyor. **Gerçek sağlayıcı kanıtı yok.**
- Ayrı `expiry-worker` servisi bu Railway projesinde tanımlı değil; pilotta zaman aşımına uğrayan bekleyen siparişler için ayrı işlem gerekir.
- Mevcut Railway planında disk üst sınırı 500 MB ve kullanıma bağlı faturalandırma riski var. Kullanıcının **0 ücret** talebi nedeniyle `Accept Deploy`, public domain veya ücretli plan açılmadı.
- `tools/staging-preflight.mjs` yalnızca gerçek `STAGING_API_URL` altında read-only `/healthz`, `/readyz`, zone/category/restoran listeleme cevaplarını denetler. GitHub CI'da `STAGING_API_URL=http://127.0.0.1:4188 node tools/staging-preflight.mjs` kullanılması **yalnızca izole geçici Docker API'nin çalıştığını** kanıtlar; Railway servisini canlı doğrulamaz.

### Ücretli kaynak açmadan önce işletme sahibinin yapacağı kontrol listesi

1. [Railway projesini aç](https://railway.com/project/51339e40-3d5d-477a-844d-1ea9f5011295) ve **staging** ortamındaki 42 staged değişikliği incele. Hesabın "usage/limits" ve fatura ayarlarını kontrol et. **Bedelsiz, kesintisiz 7/24 hosting garantisi olmadığı için** hesabınla ücret üst sınırı onaylanmadan deploy etme.
2. Kişisel veri / gerçek sipariş koymadan önce ayrı PostgreSQL şifresini Railway **Variables/Secrets** ekranında üret, `POSTGRES_PASSWORD` olarak sakla. `DATABASE_URL` bağlantısını Railway iç ağ ve referans değişkenleriyle oluştur; `.env` commit etme.
3. Auth0 staging kurulumunu `docs/AUTH0_GO_LIVE.md` içindeki adımlarla ayrı tenant'ta tamamla; `CORS_ORIGIN`, `OIDC_ISSUER`, `OIDC_AUDIENCE`, `OIDC_JWKS_URL` gerçek secret/config olarak kaydet. `PILOT_ACCEPT_ORDERS=false` durumunu değiştirme.
4. Bildirimler için iki **gerçekten bağımsız** HTTPS sağlayıcısı ve farklı 32+ karakter HMAC secret oluştur; iki worker'a ayrı repo kaynağı ve environment ayarlarını bağla. Teslimat/alındı kanıtı olmadan pilotu açma.
5. Expiry worker, şifreli offsite backup/restore, risk analizi, erişim sınırlamaları ve gerçek işletme cihazı testleri için sorumlu belirle.
6. Günün birinde yalnızca hesap sahibinin maliyet/kapsam onayıyla gerçek staging başlatıldıktan sonra **kendine ait** sunucu ve terminalde çalıştır:

   ```bash
   export STAGING_API_URL="https://api-staging.YOUR_DOMAIN.example"
   node tools/staging-preflight.mjs
   # Beklenen: 5 endpoint için HTTP 200 ve geçerli JSON dizileri
   ```

   Gizli anahtar, müşterinin adresi veya token'ı terminal çıktısına ekleme. Bu aşamada **Railway preflight: NOT RUN / NOT VERIFIED**, çünkü çalışan Railway API URL'si mevcut değil.
