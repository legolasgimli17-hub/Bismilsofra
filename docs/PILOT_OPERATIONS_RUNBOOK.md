# Bismil Sofra — 5 restoran pilotu operasyon/el değiştirme kılavuzu
Tarih: 22 Kasım 2026. Bu dosya bir ekip atandığını veya gerçek çağrı merkezi kurulduğunu iddia etmez.

## Roller (kişi ve çalışma saatleri sonradan doldurulacak)
- Pilot sorumlusu: [KİŞİ / YETKİ / GÖREV SAATİ]
- Teknik on-call, API/DB: [KİŞİ / İLETİŞİM / YEDEK]
- Restoran ilişkileri: [KİŞİ / YEDEK]
- Müşteri destek: [KURUMSAL HAT / WHATSAPP BUSINESS / E-POSTA / VARDİYA]
- Güvenlik/KVKK: [İHLAL MÜDAHALE SORUMLUSU / HUKUK]

Özel numara veya kişisel WhatsApp hesabı kurumsal destek yerine kullanılmaz. Destek iletişim kanalları test edilmeden uygulamada ilan edilmez.

## Sipariş yaşam döngüsü
1. Müşteri sunucudan geçerli mahalle/adres/ürün/ekstra/fiyat teklifini alır. Onay sonrası Idempotency-Key ile sipariş bir kere yazılır.
2. Sipariş ile aynı veritabanı transaction'ında ilk olay kaydı, birincil outbox ve bağımsız escalation planı oluşur.
3. Restoran paneli SSE + HTTP polling ile yeni siparişi görür. Tarayıcı sesine güvenilmez; imzalı bağımsız iki provider alıcısı gerçek işletme cihazında sınanmalıdır.
4. Restoran kabul/red ve hazırlık/kuryeye verildi/teslim edildi durumlarını günceller. Müşteri kendi siparişini görür; admin MFA ve audit ile itirazı inceleyebilir.
5. Kapıda nakit veya restoran POS cihazıyla tahsilat esnafa aittir. Sistem ödeme alındı kanıtı olmadan tahsil edildi raporu üretmez.

## Olay müdahale sıralaması
**P0 (yeni sipariş restoranlara ulaşmıyor, yanlış fiyat, veri sızıntısı şüphesi, yanlış restorana veri):**
- İlgili servislerde yeni sipariş alımını durdur. Production PILOT_ACCEPT_ORDERS=false yapılandırması dağıtım/restart gerektirir; bunu sadece ayarı yazmak anlık durdurma sağlamaz. Doğrula: POST /v1/orders kapalı ortamda 503 ORDER_INTAKE_CLOSED; gerçek trafik işleyişi operatör tarafından teyit edilir.
- Olay başlangıç saati, sorumlu, etkilenen restoran/sipariş sayısı, ilk tespit ve kurtarma notu oluştur; açıklama/loglara açık adres veya token kopyalama.
- Mevcut aktif siparişleri idempotency key ve durum geçmişinden incele. Yeniden sipariş oluşturarak çözüme çalışma; restoranla kurumsal kayıtlı kanaldan doğrula.
- Güvenlik olayı varsa ilgili credential erişimini sınırla, yetkileri gözden geçir, hukuk/KVKK sorumlusuna eskale et. Gerçek ihlal bildirim yükümlülükleri süreleri hukuken değerlendirilir.

**P1 (bir bildirim kanalı başarısız, worker bayat, SSE kopuk, yoğun 5xx/timeout):**
- GET /readyz, /healthz, işletme/admin MFA'lı worker health ve hata raporlarını kontrol et.
- Worker watchdog'da outbox/escalation/expiry son görülme yaşı >35 saniye ise arka plan süreçlerini incele. Webhook tarafında gerçek alıcı kabulü ve benzersiz eventId dedupe kayıtlarını teyit et.
- Birincil ve bağımsız yedek kanalın aynı sağlayıcı altyapısına bağlı olmadığını kontrol et; tek kanal çalışıyorsa olay riski sürer.
- Bağlantı kesilince SSE'nin yenilenmesi/polling, tarayıcı kapalıyken alarmın bağımsız yedeğe düşmesi için senaryo testi uygula.
- Restoran tarafındaki tablet/telefon sessiz, güç tasarrufunda, çevrimdışı ya da arka planda olabilir; sadece browser sesini kabul kanıtı sayma.

**P2 (görsel hatası, kullanıcı yanlış sayfa, teknik olmayan şikâyet):**
- Destek kaydı oluştur; şikâyeti ilgili siparişe bağla, gizli metni yalnız ihtiyaç halinde görüntüle; geri bildirimi destekten ver, ham kişisel veri paylaşma.

## Operasyonel paneller ve veri güvenliği
- Her restorana yalnız kendi siparişleri; çalışan rolü en az yetki. Admin yalnız MFA sonrası sınırlı arama ve audit.
- API ve worker logları Authorization, telefon, adres, token veya destek açıklaması içermemeli; redaksiyon ve log retention ayrı denetlenmeli.
- Fotoğraf yüklemeden önce lisans ve restoran onayı. Satışa kapalı demo ürünü gerçekmiş gibi yayımlama.
- Yönetici, normal kullanıcının telefon numarasını tüm siparişlerin listesinde topluca göremez.

## Yedek ve kurtarma
- CI izole PostgreSQL verisini AES-256-GCM şifreleyip ayrı test veritabanına geri yükler; gerçek offsite yedek kurulu değildir.
- Operatör ayrı storage, KMS/secret manager, günlük program, tutma süresi, restore kanıtı, backup başarısızlık alarmı ve RPO/RTO hedefini onaylamalıdır.
- Olay sırasında üretim DB'de kör SQL restore veya veri silme işlemi yapılmaz. Önce ayrı ortamda doğrulama, etki analizi ve geri alma planı gerekir.

## 5 -> 20 -> 50 restoran geçişi
- Üretimde varsayılan aktif restoran limiti **5**. PILOT_ACTIVE_RESTAURANTS_MAX yalnız 5, 20 veya 50 kabul eder. Veritabanı fiziksel olarak 50 üstünü zaten reddeder.
- Bir üst aşamaya geçiş için: gerçek 5 restoranın kayıtlı izni, fiyat/menu kontrolü, bildirim başarı kanıtları, destek kapasitesi, ölçülmüş 7/30 günlük KPI, yedek, rol güvenliği, değişiklik incelemesi gerekir.
- Rollout parametresi değiştirilmesi bir **yayın kararıdır**, özellik kodunun mevcut olmasına bağlı otomatik yapılmaz.

## Gerçek pilotun açılış kararı
docs/pilot-release-evidence.json dosyasında 12 kontrol maddesinin hepsi gerçek reviewer + kanıt linki ile verified olmadan
node tools/pilot-release-gate.mjs --require-go
komutu başarısız olur. GitHub PR/CI yeşil olması yalnızca yazılım testidir, sahayı otomatik onaylamaz.

## İşletme ve müşteri destek taslakları
- Yeni restoran onboarding kaydı: [RESMİ İŞLETME], [SÖZLEŞME], [ÇALIŞAN MFA], [MENÜ ONAYI], [MAHALLE ÜCRETLERİ], [FOTOĞRAF HAKKI], [CİHAZ ALARMI], [TESLİMAT YÖNETİMİ].
- Kurumsal sipariş destek yanıtı: "Siparişinizin güncel kaydını kontrol ediyoruz. Tekrar sipariş vermeden önce Siparişlerim bölümünden durumunu inceleyebilirsiniz. İlgili restoranla doğrulayıp size kayıtlı kanalımız üzerinden bilgi vereceğiz."
- Kurumsal restoran bağlantı kopması talimatı: "Sipariş kuyruğunda eksik görüntü varsa paneli tekrar yükleyin. Kabul edilmiş siparişi tekrar oluşturmadan destek kanalına kısa sipariş numarasını ve sorunu bildirin."

## Gerçek kişilerden önce kapatılacak dış işler
[ ] Gerçek destek vardiyası ve kanal doğrulaması
[ ] Kimlik sağlayıcısı/MFA/rol recovery gerçek testleri
[ ] Bağımsız iki webhook/SMS/telefon provider ile gerçek cihaz kanıtı
[ ] Canlı SSL/DB/backup/uplink izleme ve altyapı alarmı
[ ] 50/100/200 girişli gerçek staging, API replica ölçek ve DB pool
[ ] Fotoğraf hakları ve restoran satış izni
[ ] KVKK ve platform sözleşmesi hukuki onayı; ETBİS/vergisel değerlendirme
