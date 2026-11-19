# Bismil Sofra v0.9

**Bismil'e özel, en fazla 50 aktif restoran için tasarlanan yemek sipariş PWA projesi.** Kaynak proje hâlâ geliştirme aşamasındadır; gerçek müşterilerden sipariş almaya hazır değildir.

- `apps/web/` — Next.js 16 / React 19, müşteri ve restoran/yönetici arayüzü, PWA
- `apps/api/` — Fastify / PostgreSQL, fiyatları sunucuda hesaplama, iş kuralları, bildirim outbox işçileri
- `.github/workflows/check.yml` — testler, TypeScript kontrolü, Next.js build
- `tools/` — onaylı yemek fotoğrafları için WebP ve EXIF temizleme aracı
- `REFERANS_SARTNAME_v0_3.md` — 50 restoran kapsamlı ana şartname

## v0.9'da ne değişti?

Restoran gelen sipariş listesinin yanı sıra hazırlanmakta ve teslimatta olan siparişler de panele eklendi. Yetkili işletme çalışanları ürünleri ve teslimat ayrıntılarını açıp görebiliyor; sipariş durumlarının tam sıralı akışını yönetebiliyor. Müşteri adresleri arka plan liste yenilemelerinde taşınmıyor. [Değişikliklerin ayrıntısı](DEGISIKLIKLER_v0_9.md).

## Yerel geliştirme

Gereksinimler: Node.js >=22.16, npm, PostgreSQL, gerçek OIDC sağlayıcısı. Bağımlılıkları kurmak için internet gerekir.

```bash
npm install
npm run test:all
npm run typecheck
npm run web:build
```

Ardından `apps/api/.env.example` ve `apps/web/.env.example` şablonlarını kendi `.env` dosyalarına kopyala; veritabanını ve OIDC sağlayıcısını yapılandır. `apps/api/README.md` ayrıntılı güvenli kurulum bilgisini içerir. Test veritabanında migration ve entegrasyon testlerini ayrıca çalıştır.

Geliştirme sunucuları:

```bash
npm run api:dev
npm run web:dev
```

**Dikkat:** Örnek restoranlar gerçek restoran değildir. Auth/OIDC veya API yokken sipariş verme devre dışı bırakılır. Kapıda nakit veya POS dışında ödeme işlenmez. Restoranların kuryeleri kullanılır; ayrı kurye filosu yoktur.

## GitHub depo bilgisi

Bu projenin ana kod deposu özel GitHub deposudur: `legolasgimli17-hub/Bismilsofra`. Yeni sürümler aynı depo üzerinden sürdürülür. Kodun depoda bulunması üretime hazır olduğu anlamına gelmez; gerçek PostgreSQL/OIDC ve canlı sipariş testleri şarttır.

## Kalite ve sınırlamalar

[TEST_RAPORU_v0_9.md](TEST_RAPORU_v0_9.md) · [MIMARI_KARARLAR_v0_8.md](MIMARI_KARARLAR_v0_8.md) · [FOTOGRAF_POLITIKASI_v0_8.md](FOTOGRAF_POLITIKASI_v0_8.md)

Gerçek PostgreSQL + OIDC, üretim build, güvenilir bildirim/ikincil uyarı, KVKK ve fotoğraf depolama doğrulanmadan gerçek sipariş kabul edilmemelidir.
