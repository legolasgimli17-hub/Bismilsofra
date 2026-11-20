# Bismil Sofra — v2.3.0-beta.1 geliştirme aşaması

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
npm ci
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

## v1.0 güvenilirlik kontrolleri

Restoran siparişleri toplu listeleme API'si artık müşteri adreslerini ve özel notlarını döndürmez; bu bilgiler sadece MFA gerektiren ve restoran kimliğine göre yetkilendirilen ayrıntı çağrısında alınır. `/readyz`, yalnızca DB bağlantısı değil gerekli migration kayıtlarının uygulanmasını da kontrol eder. Bu değişiklikler otomatik testlerle doğrulanır; gerçek PostgreSQL entegrasyonu hâlâ ayrıca çalıştırılmalıdır.

## v1.1 bağımsız ürün denetimi

- Restoranın manuel açık durumuna ek olarak çalışma saatleri, geçici kapanışları ve aktif teslimat bölgesi kontrol edilerek API'de `is_orderable` üretilir.
- Müşteri listesi ve menüsü sipariş uygunluğu için bu alanı kullanır. Sipariş işlemi koşulları ayrıca sunucuda yeniden denetlenir.
- Mahalle seçilmediğinde teslimat ücreti ve minimum sepet rastgele bir mahalleden tahmin edilmez.
- Her büyük sürüm için rakiplerin kamuya açık kullanıcı akışlarını karşılaştıran, şartnameye bağlı tarafsız bir kalite denetimi yapılacaktır. Değerlendirme: [INDEPENDENT_AUDIT_v1_1.md](INDEPENDENT_AUDIT_v1_1.md).
- **Gerçek PostgreSQL üzerinde testler, OIDC giriş ve Next.js üretim derlemesi henüz doğrulanmadı.** Uygulama canlı siparişe hazır değildir.

## v1.4 — kilitli kurulum, bağımsız ikinci uyarı ve fotoğraf hazırlığı

- `package-lock.json` sürüm kontrolüne alındı; GitHub Actions `npm ci` ile aynı bağımlılıkları kurar.
- `004_escalation.sql` siparişin kabul edilmemesi durumunda ikinci kanal alarmını kalıcı olarak planlar. `npm --workspace apps/api run worker:escalation` bağımsız HTTPS/HMAC webhook'a hatırlatma gönderir.
- Admin + MFA panelinde geç kalan siparişler, normal bildirim hataları ve ikinci kanal durumları ayrı izlenir; yetkili yönetici gerekli durumda tekrar deneyebilir.
- API eksik migration'larla başlatılmaz.
- Ürün/kapak fotoğrafları yerel WebP veya yapılandırılmış birinci taraf HTTPS CDN'den gösterilebilir. Gerçek restoran fotoğraflarının depolaması/izinli aktarımı henüz tamamlanmadı.
- **Test kanıtı:** [90 birim testi, 2 PostgreSQL entegrasyonu ve Next.js build](https://github.com/legolasgimli17-hub/Bismilsofra/actions/runs/44552494385).
- **Bağımsız denetim:** [QA_REVIEW_v1_4.md](QA_REVIEW_v1_4.md); [bildirim olay prosedürü](docs/ALERTS_AND_INCIDENTS.md); [gerçek fotoğraf/mobil kalite kapıları](docs/PHOTOS_AND_MOBILE.md).

**Önemli:** Bunlar güvenilir bir uygulamanın temel bileşenleridir; gerçek Auth0 tenant, üretim PostgreSQL, gerçek SMS/push veya fiziksel cihaz pilotu bağlanmış değildir. Canlıya açma kriterleri tamamlanmadan gerçek sipariş kabul edilmemelidir.

## v1.6 — Gerçek restoran menü düzenleyicisi

`/restaurant/manage` üzerinden restoranın kendi kategorilerini oluşturup adlandırması, ürünleri satışa kapalı taslak olarak eklemesi, ürün fiyat/açıklama/kategori/görsel yolunu düzenlemesi ve ürün satışını açıp kapatması desteklenir. Aynı ürün üzerinde eşzamanlı fiyat düzenlemeleri `revision` sürümü ile korunur. Geçmiş siparişlerin fiyatı sabittir.

- [Menü düzenleme API ve kullanım rehberi](docs/MENU_EDITOR_v1_6.md)
- [Bağımsız ürün ve risk değerlendirmesi](QA_REVIEW_v1_6.md)
- Gerçek fotoğraf yükleme servisi ve Auth0 canlı hesap bağlantısı henüz yoktur; test sunucusunda imzalı JWT ve PostgreSQL ile kontrol edilmiştir.

## v1.7 — Restoran telefonundan fotoğraf yükleme

Yeni `/restaurant/manage` menü düzenleyicisi, işletme yetkisi/MFA doğrulanarak JPEG, PNG ve WebP fotoğraflarını **sunucudan güvenle** yükler. Kullanım hakkı onayı zorunludur. Sunucu fotoğrafı 5 MB sınırıyla kontrol eder, WebP formatına çevirir, EXIF/konum metaverisini kaldırır ve restorana özgü medya kaydıyla S3-uyumlu bir depoya yazar.

Ürüne bağlanan harici görsel, aynı restoranın `restaurant_media` kaydında bulunmalıdır; salt URL göndermek yeterli değildir. İşletmenin kendi CDN alan adının yapılandırılması ve gerçek fotoğraf izinlerinin alınması gereklidir.

[Fotoğraf yükleme rehberi](docs/PHOTO_UPLOAD_v1_7.md). Depolama hesabı, gerçek Auth0 ve cihaz testleri yapılmadan canlıya açılamaz.

## v1.8 — Restoranın ürün seçeneklerini yönetmesi

Yeni ürün seçenekleri panelinde restoranın kendi yemekleri için **sos, ekstra malzeme, içecek ve boyut** gibi grupları oluşturması, bunlara ilave fiyat eklemesi, minimum/maksimum seçim kuralı belirlemesi ve grupları pasife alıp tekrar açması mümkündür. Seçenek değişiklikleri `revision` alanlarıyla korunur; geçmiş siparişlere yazılmış fiyat ve ürün snapshots değişmez.

- [Seçenek grupları kullanım/iş kuralları](docs/PRODUCT_OPTIONS_v1_8.md)
- MFA + restoranın `can_manage_menu` yetkisi zorunlu; son sipariş toplamı yalnızca backend tarafından hesaplanır.
- Üretime çıkmak için gerçek Auth0, S3/CDN, iki bağımsız bildirim kanalı ve 5 restoranın sahada test edilmesi hâlâ gereklidir.

## v1.9 — Bildirim işçilerinde çökme kurtarma

`008_outbox_leases.sql` ve `009_escalation_leases.sql` sipariş bildirimi ve bağımsız yedek alarm sağlayıcılarıyla HTTP iletişimi sırasında uzun veritabanı transaction'larını kaldırır. Fencing token, lease süresi ve yeniden deneme vardır. Gerçek iki sağlayıcı ve fiziksel cihazlarla test hâlâ gereklidir.

- [v1.9 güvenilir outbox](docs/OUTBOX_RELIABILITY_v1_9.md)
- [v1.10 ikincil alarm kurtarma](docs/FALLBACK_ALERT_RELIABILITY_v1_10.md)

## v2.0 — Geçmiş siparişi yeniden hazırlama (geliştirme)

Sipariş detayında **Güncel menüyle tekrar hazırla** eylemi: geçmiş ürünleri/opsiyonları canlı menüyle eşler, değişen fiyatları gösterir, eski/kapalı seçenekleri reddeder ve mevcut sepeti açık onay olmadan silmez. Oluşturduğu sepet yalnızca taslaktır; kesin tutar yine backend `quote` + `placeOrder` üzerinden hesaplanır.

- [v2.0 tekrar sipariş rehberi ve güvenlik kuralları](docs/REORDER_v2_0.md)
- `npm run test:reorder`; gerçek HTTP+PostgreSQL sahiplik testi dahil.

## v2.1 — Bağımsız denetim kaynaklı ilk iyileştirmeler

Canlı aramanın ürün adına göre eşleşen restoranları kaybetmesi düzeltildi; bozuk sepet verisi reddedilir, Auth0 kullanıcısı her okuma çağrısında gereksiz veritabanı UPDATE üretmez. API için sınıfa ayrılmış, sınırlı bellek kullanan istek kotası; açık güvenilen-proxy yapılandırması; gerçek HTTP ve regresyon testleri eklendi.

[İlk v2.1 güvenlik/kalite adımı](docs/HARDENING_v2_1.md). Gerçek canlı Auth0, bağımsız ikincil bildirim, yedek/geri yükleme ve fiziksel restoran cihazı testi henüz tamamlanmadı.

## v2.2 — Tutarlı sepet, dinamik kategoriler ve MFA kontrolleri

- Sepet kapalı/yeni sekme ve yeniden yükleme durumlarında `localStorage` ile korunur; eski oturum sepeti bir kez taşınır. Bozuk veriler güvenli şekilde reddedilir, checkout ilk açılışta yanlışlıkla boş sepet göstermez.
- Canlı kategori listesi aktif restoranların mevcut, satışta olan ürünlerinden gelir. Mahalleye göre filtrelenir ve kategori seçimi sunucu sonucuyla aynıdır. Örnek fotoğraflar yalnızca demo içindir.
- JWT içindeki yalnızca `otp`, `totp`, `webauthn` gibi tek faktörlü işaretler restoran MFA koşulunu karşılamaz; doğrulanmış `mfa` işareti veya Auth0 Action'ın imzalı eşdeğer claim'i gerekir.
- Daha fazla bilgi: [v2.2 UX & MFA inceleme notları](docs/CART_AND_CATEGORIES_v2_2.md).

Bu kod sürümü, gerçek sağlayıcı ve saha testlerinin tamamlandığı anlamına gelmez.

## v2.3 — Destek taleplerinde gerçek operasyon akışı

Müşteri, siparişinden destek kaydı açabilir ve `/orders` ekranından durumunu görebilir. Yönetici `/admin` alanında yalnızca doğrulanmış güncel MFA sonrası talepleri listeleyebilir; serbest metin açıklamaları ayrı ve istek üzerine alınır. Yönetici talebi inceleniyor/çözüldü/kapandı aşamalarına taşır, eski duruma dayalı çakışmalı işlemler `409` alır. Her durum değişimi `audit_logs` tablosuna müşteri adresi veya açıklama eklenmeden yazılır.

[Operasyon rehberi](docs/SUPPORT_OPERATIONS_v2_3.md). Otomatik SMS/e-posta bildirimi, para iadesi, gerçek destek ekibi ve sağlayıcı bağlantıları bu kod sürümünün kapsamında değildir; pilot öncesi ayrıca kurulmalı.
