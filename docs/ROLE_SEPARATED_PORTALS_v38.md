# Bismil Sofra v3.8 — işletme ve platform için ayrı çalışma alanları

Bu değişiklik, mevcut Fastify API ve gerçek veritabanı yetkilendirmesinin üzerine **farklı navigasyon ve giriş kapıları** getirir; müşteri, restoran ve platform yöneticisi ekranlarını aynı müşteri üst/alt menüsünde karıştırmaz. Yemeksepeti'nin özgün kodu/arayüzü kullanılmadı.

## Ekranlar
- `/` ve `/checkout`: müşteri keşfi, sepet ve kendi siparişleri.
- `/panel`: giriş/rol seçimi. Erişim vermez; yetkisiz kişilerin özel veri görmesini sağlamaz.
- `/restaurant/overview`: restoran iş ortağının yetkili şubesine ait bekleyen/aktif sipariş sayıları, son 7 günlük satıcı raporu (yalnız owner/manager), hızlı operasyon bağlantıları.
- `/restaurant`: SSE + 7 saniyede bir teyitli sipariş operasyonu; sipariş kabul/ret/durum güncellemeleri. Tarayıcı sesi ancak kullanıcı açarsa çalışır.
- `/restaurant/manage`: menü, fiyat, seçenekler, çalışma saatleri, mahalle ücreti ve izinli çalışan yönetimi. Derin bağlantılar `#merchant-menu`, `#merchant-hours`, `#merchant-zones`, `#merchant-reports`, `#merchant-team`.
- `/admin/overview`: gerçek 7 günlük sipariş metrikleri, restoran kurulum eksikleri, ilk/yedek bildirim hataları ve arka plan işçileri özeti.
- `/admin`: operasyon modüllerinin tamamı, hedefli bağlantılar `#admin-onboarding`, `#admin-reports`, `#admin-users`, `#admin-orders`, `#admin-support`, `#admin-workers`.
- Müşteri menüsü, sepet göstergesi ve alt mobil navigasyon özel panellerin dışında kalır. İş ortakları için koyu yeşil, platform için lacivert/koyu mavi görünüm kullanılır.

## Rol ve yetkilendirme
- Ön uç yönlendirmesi **güvenlik sınırı değil**, sadece kullanıcı deneyimidir. Her özel API isteği gerçek imzalı JWT, Auth0 issuer/audience, MFA ve veritabanı `restaurant_staff` / `platform_admins` yetkileri ile kontrol edilir.
- Restoran layout'u, `GET /v1/me/staff-restaurants` üzerinden en az bir yetkili restoranı doğrulamadan içerikleri göstermez. Başka restorana ait rastgele bir UUID seçilerek erişim genişletilemez; API yine ayrı tenant kontrolü yapar.
- Admin layout'u `GET /v1/admin/alerts` ile MFA + gerçek yönetici yetkisi doğrular; e-posta alanı veya URL'ye bakıp yönetici kabul etmez.
- Kullanıcı oturum kimliği değişince workspace yetkisi yeniden kontrol edilir; eski kullanıcının ekrandaki bilgileri yeni kullanıcıya göstermek için yetki atlanmaz.
- Ön yüz `sessionStorage` içinde yalnız son seçilen **UUID**'yi tutar; rol, token, müşteri adresi, telefon veya parola tutulmaz. UUID, sunucudan gelen yetkili restoran listesinin dışında ise reddedilir.
- Müşterinin platform kontrol paneline tıklaması dahi `ROLE_FORBIDDEN` ya da `AUTH_REQUIRED` cevabı üretmelidir. Bu denetim hem özel layout hem Fastify API'da uygulanır.

## Gerçek veriler, sahte kazanç yok
- Paneldeki toplamlar yalnızca `/v1/restaurant/:rid/inbox`, `/v1/restaurant/:rid/reports`, `/v1/admin/restaurants`, `/v1/admin/alerts`, `/v1/admin/reports` API yanıtlarından çıkar.
- Sunucu yapılandırılmamışsa ilgili alanlar tire veya hata gösterir. **Hayalî 120 sipariş, %98 başarı, 5000 TL gelir** gibi pazarlama sayıları üretilmez.
- `delivered_total_kurus` bir satıcının `teslim edildi` olarak işaretlediği **sipariş değeri**dir; gerçek kapıda tahsilat/banka mutabakatı veya platformun geliri değildir.
- Restoran sipariş butonları yalnız canlı bağlantı ve gerçek `can_manage_orders` hakkıyla çalışır; değişiklikler API'da tekrar doğrulanır.
- Kapalı tarayıcı sekmesindeki ses veya gerçek bildirim garantisi iddia edilmez.

## Teknik doğrulama
`npm run test:portals` müşteri/admin/restoran navigasyon ayrımını ve oturumdaki seçilen restoran UUID'sinin yalnız yetkili listeden seçilebildiğini doğrular. `npm run web:build` yeni App Router sayfalarını derler, mevcut CI ek olarak gerçek PostgreSQL'e karşı tenant/HTTP/JWT testlerini çalıştırır.

Bu değişiklik **yeni ücretli altyapı başlatmaz**. Railway staging servisleri hâlâ `staged-create`. Gerçek Auth0/HTTPS API ve iki bağımsız alıcı kurulmadığından `docs/pilot-release-evidence.json` **NO_GO** olarak kalır. Bir web arayüzünün yeni olması canlı pilot koşullarını karşılamaz.
