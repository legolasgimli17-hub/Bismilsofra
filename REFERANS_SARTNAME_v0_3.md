# BİSMİL YEMEK SİPARİŞ PLATFORMU
## Ürün, Teknik ve Ekran Şartnamesi — v0.3

**Tarih:** 17 Kasım 2026  
**Durum:** Ekran haritası eklenmiş geliştirme öncesi taslak; henüz kodlanmadı  
**Kapsam:** Önce profesyonel web/PWA, ardından Android ve iOS  
**Kaynak:** Kullanıcının yüklediği `spec.md v0.1` (5 sayfa), önceki `v0.2` ve bu sohbette onaylanan **en fazla 50 aktif restoran** kararı  
**Not:** Bu belge bir uygulama, sözleşme veya güvenlik sertifikası değildir; geliştirme için karar ve kabul ölçütleri tanımlar.

---

## 0. v0.3 kararları ve değişiklik kaydı

**Kullanıcının kesin kararı:** Platform **en fazla 50 aktif restoran** için planlanacak. Pilot 5 restoran; doğrulama aşamaları 5 → 20 → 50. 100 restoran artık hedef, şart veya sonraki faz değildir. Veritabanında geçmiş/askıya alınmış restoran kayıtları bulunabilir; **yayında ve sipariş kabul edebilen restoran sayısı 50'yi geçemez.** Yeni restoranı etkinleştirme işlemi bu sınırı sunucu tarafında atomik olarak kontrol eder. Bekleme listesi kullanılabilir.

**v0.2'den korunan kararlar:** İlk ürün web/PWA, kendi kuryesini kullanan restoranlar, kapıda nakit/POS, e-posta doğrulamalı kayıt, ayrı müşteri/restoran/admin erişimleri, kontrollü pilot, ileride Android ve iOS, denetlenebilir güvenlik ve sipariş işlemleri.

**v0.3'te eklenen çalışma:**
1. Müşteri, restoran ve yönetici için ekran envanteri ve ekran kimlikleri.
2. Navigasyon, giriş, sipariş, restoran kabulü ve destek akışları.
3. Yükleniyor, boş durum, geçersiz işlem, ağ kesintisi ve hata durumları.
4. Tasarım sistemi için işlevsel ve erişilebilirlik kuralları.
5. Her temel akış için ölçülebilir kabul testleri ve tek geliştiricinin çalışma sırası.
6. Henüz kararlaştırılmamış konuların açık karar listesi.

> **Belgenin statüsü:** Bu dosya onaylanmış ekran tasarımı, çalışan yazılım veya güvenlik sertifikası değildir. Orijinal dosyadaki iş kuralları korunmuş; yeni ekran detayları geliştirme önerisi olarak eklenmiştir.

## 1. Vizyon, hedef kitle ve sınırlar

**Vizyon:** Bismil'de yaşayan kişilerin, ilçedeki restoranlardan güvenli, hızlı ve anlaşılır biçimde yemek sipariş edebildiği; restoranların da siparişleri tek profesyonel panelden yönettiği yerel platform.

**Başlangıç koşulu:** İlçedeki birçok restoranın kendi kuryesi olduğu, sipariş alışkanlığının yaygın olduğu ve merkezden uzak yeni konut sitelerinde talep arttığı kullanıcı gözlemidir; ölçüm ve görüşmelerle doğrulanacaktır.

**Farklılaşma hipotezi:** Yerel restoran kapsamı, adres/mahalleye göre erişilebilir seçenekler, restoranlar için anlaşılır maliyet, kolay sipariş deneyimi ve gerektiğinde hızlı destek. Rakiplerin kuponları nedeniyle ilk günden “her zaman en ucuz” iddiası kurulmayacaktır.

**Pilot:** 5 restoran; gerçek siparişlerde sorunların tespiti; 2–4 hafta boyunca ölçüm. **Kesin kapasite sınırı:** En fazla **50 aktif restoran**; her restorana çok sayıda ürün, çalışan ve teslimat bölgesi. Öncelik doğru çalışan 5 restoran pilotudur.

**İlk sürüm sınırı:** Web/PWA, kapıda nakit veya restoranın POS cihazında kart, restoranın kendi kuryesi. Yerel harita veya canlı kurye GPS takibi ilk sürümde zorunlu değildir.

## 2. Roller ve erişim sınırları

- **Ziyaretçi:** Restoranları ve izin verilen menüleri görür; sipariş vermek için kayıt olur.
- **Müşteri:** Kendi adresleri, sepeti, siparişleri ve oturumları üzerinde işlem yapar.
- **Restoran sahibi/yöneticisi:** Yalnızca yetkili olduğu restoranın ürün, saat, teslimat ve siparişlerini yönetir; personel atar.
- **Restoran çalışanı:** Kendisine atanmış sipariş veya menü yetkilerine erişir; finansal ayarlar ve başka restoranların kayıtlarına erişemez.
- **Platform operasyon yetkilisi:** Gerekli minimum yetkiyle destek, sipariş sorunları ve restoran doğrulama işlemlerini yürütür.
- **Platform ana yöneticisi:** Sistem ayarları, rol atamaları, güvenlik olayları ve denetim kayıtları; kritik işlemler yeniden doğrulama gerektirir.
- **Restoran kuryesi:** İlk sürümde ayrı hesap şart değil. Restoran çalışanı, izin verildiğinde teslimata çıkarıldı/teslim edildi durumlarını günceller. Ayrı kurye uygulaması sonraki aşamadır.

**Temel ilke:** Bir restoranın kullanıcılarının başka restoranların müşteri adreslerine, menülerinin yönetimine veya siparişlerine ulaşması kesinlikle engellenir; bu test edilir.

## 3. Ürün yüzeyleri ve UX tasarım standartları

### 3.1 Müşteri web/PWA ekranları

1. Açılış / adres ve teslimat mahallesi seçimi; adres verilmeden genel restoran gezme seçeneği.
2. Profesyonel giriş/kayıt, e-posta doğrulama, şifre oluşturma/sıfırlama, hesap güvenliği.
3. Ana sayfa: belirgin arama; temiz restoran kartları; açık/kapalı durum, kategori ve seçili kampanya alanı (ileriye dönük).
4. Arama ve filtre: restoran / ürün / mutfak türü; teslimat yapabilenler; açık restoranlar.
5. Restoran sayfası: kapak, minimum tutar, tahmini süre, teslimat ücreti, çalışma saatleri, menü.
6. Ürün detay paneli: zorunlu/isteğe bağlı seçenekler, seçim sınırları, adet ve not.
7. Sepet ve sipariş özeti: kalem kalem fiyat, teslimat, toplam, ödeme tipi, adres.
8. Sipariş onayı ve canlı durum ekranı; gecikme veya reddedilme açıklamaları.
9. Sipariş geçmişi, yeniden sipariş, profil, kayıtlı adresler ve yardım/şikâyet.

### 3.2 Restoran paneli

- Mobil/tablet/masaüstünde kolay kullanılan büyük butonlu canlı sipariş listesi.
- Sipariş kabul/red; hazırlama, hazır, yola çıktı, teslim edildi / teslim edilemedi durumları.
- Menü, kategori, ürün seçenekleri, fiyat güncelleme, stokta yok/satışta değil.
- Açık/kapalı/meşgul, çalışma saatleri, minimum sepet ve teslimat bölgeleri.
- Personel hesabı ve yetkiler, sipariş geçmişi, basit raporlar ve destek.
- Uyarı için görsel, sesli ve mümkün olduğunda bildirim seçenekleri. Tarayıcı arka plan sesinin her cihazda garanti edilmediği kabul edilir; kaçan siparişi yakalayan alternatif kanal gereklidir.

### 3.3 Yönetim paneli

- Restoran başvurusu ve doğrulama, menü aktarımı, restoran/çalışan yönetimi.
- Sipariş arama, süreç durumları, anlaşmazlık, iptal ve destek kaydı.
- Yetki ve kullanıcı güvenliği; idari aksiyonların denetim kayıtları.
- Günlük sipariş, restoran bazlı başarı, kabul süresi, iptal oranı, tamamlanan siparişler.
- Platform ücretine esas **tamamlanmış sipariş** raporu; bu rapor doğrudan tahsilat değildir.

### 3.4 Tasarım standardı ve kabul ölçütleri

- Büyük platformların kullanım mantığından öğrenilecek; marka, ikon, düzen ve ayırt edici ekranlar birebir kopyalanmayacak.
- Tutarlı renk/boşluk/yazı tipi/buton/kart/boş durum/yükleniyor/hata bileşenleri olan tasarım sistemi.
- 360 px genişliğinde ekran, telefon/tablet/masaüstü; Türkçe karakterler, net ve yalın Türkçe metinler.
- Erişilebilirlik hedefi: WCAG 2.2 AA'ya uygunluk için kontrol listesi; klavyeyle gezinme, yeterli kontrast, dokunma alanları, okunabilir boyut.
- Kullanılabilirlik testi: En az 5 kişinin yardım almadan adres seçip menüden sipariş özeti ekranına ulaşması; engellerin kaydedilmesi.
- Hedef performanslar canlı ölçülür; tanımlanan rakamlar test hedefidir, garanti değildir.

## 4. Sürüm kapsamları

### V1 / pilotta mutlaka olanlar

- E-posta doğrulamalı müşteri kaydı, güvenli şifre ve oturum; restoran/yönetici MFA.
- Restoran, menü, ürün seçenekleri, adres, sepet, sipariş gönderimi ve durum takibi.
- Restoran paneli ve yönetim panelinin kritik akışları.
- Kapıda nakit veya kapıda POS; online kart verisi uygulamada işlenmez.
- Restoranın kendi kuryesi; restoran/mahalle bazında teslimat uygunluğu.
- Müşteri hizmeti ve hata/iptal süreçleri; temel raporlama.
- Mobil uyumlu PWA, izleme, yedekleme ve testler.

### V1'de bilerek olmayanlar

- Uygulama içi online kart tahsilatı/pazaryeri ödeme dağıtımı.
- Otomatik kupon altyapısı, puan/sadakat programı, gelişmiş promosyon finansmanı.
- Kendi kurye filosu, canlı kurye haritası ve ayrı kurye uygulaması.
- Mağazalarda yayımlanan Android/iOS uygulamaları; çoklu dil; market/esnaf pazaryeri.
- Uygulama içi sosyal özellikler; yorum/puanlama (moderasyon tasarımı sonrası).

**Önemli:** İlk pilotta kupon olmasa da menü fiyatı, teslimat ve sipariş toplamları ileride kampanya modülünü güvenle destekleyecek şekilde ayrıştırılır. Kampanyalar ticari doğrulama sonrasında açılır.

## 5. Kayıt, giriş ve şifre kurtarma

**Müşteri kayıt akışı:** E-posta gir → doğrulama bağlantısı/kodu gönder → süreli ve tek kullanımlık tokenı doğrula → güçlü şifre oluştur → şifre yöneticisinin kaydetmesine izin ver → hesap aç → ilk siparişte teslimat telefonu ve adresini al.

- Şifre açık metin tutulmaz; yönetilen, bakımı yapılan kimlik sağlayıcısı tercih edilir.
- Kullanıcı “şifremi unuttum” ile süreli bağlantı üzerinden şifre yeniler; başarılı değişimde eski oturumların geçerliliği politika gereği yeniden değerlendirilir.
- Çok deneme/çok e-posta için hız sınırı, bot ve kötüye kullanım kontrolü. Yanıtlar hesap varlığını gereksiz yere ifşa etmez.
- E-posta alan adı için SPF, DKIM, DMARC; sağlayıcı hatası, spam klasörü, süre dolması ve tekrar gönderme senaryoları test edilir.
- Telefon numarası sipariş teslimatı için doğrulanabilir; OTP zorunluluğu pilot dolandırıcılık ve SMS maliyetine göre belirlenir.
- Tarayıcıya veya cihazın şifre yöneticisine kayıt seçeneği sunulur; “şifreyi kaydetme” uygulamanın açık metin şifre saklaması değildir.
- Restoran ve ana yönetici hesaplarında MFA; kurtarma prosedürü, oturum geçmişi ve kritik ayarlarda yeniden doğrulama.
- Kullanıcı destek ve hesap silme süreçleri; gerekli kayıtların yasal saklama gereklilikleri ayrıca incelenir.

## 6. Sipariş durum makinesi ve hata senaryoları

**Durumlar:**
`beklemede` → `kabul_edildi` → `hazirlaniyor` → `hazir` → `yolda` → `teslim_edildi`

**Terminal alternatifler:** `reddedildi`, `suresi_doldu`, `musteri_iptal`, `restoran_iptal`, `teslim_edilemedi`.

**Geçiş kuralları:**
1. Sistem siparişi oluştururken `beklemede` yazar; restoran kabul/ret verir. Kabul edilmezse süre sonunda `suresi_doldu` olur.
2. Müşteri pilotta yalnızca `beklemede` durumunda tek başına iptal edebilir. Kabul sonrasındaki iptaller destek/restoran politikasıyla ele alınır; taraflar bilgilendirilir.
3. Restoran `kabul_edildi` → `hazirlaniyor` → `hazir` → `yolda` → `teslim_edildi` geçişlerini yapar. Gerekçeli `restoran_iptal` ve `teslim_edilemedi` akışları ayrıca yönetilir.
4. Sistem/operasyon tarafından geçersiz geçişe izin verilmez. Her geçiş `order_events` kaydına aktör, zaman, önceki/yeni durum ve gerekçe ile yazılır.
5. **Önerilen pilot zaman aşımı:** 4 dakika. Restoran bildirim güvenilirliği test edilince değiştirilir. Süre bitmeden alternatif uyarı/operasyon bildirimi planlanır.
6. Restoran reddi, otomatik zaman aşımı veya destek iptalinde müşteri açık bir mesaj görür. Kapıda ödeme için sistemin otomatik para iadesi yoktur; ödeme zaten platform tarafından tahsil edilmemiştir.
7. “Teslim edildi” raporu restoranın beyanıdır; müşteri itirazı ayrı destek kaydı açar, geçmiş sessizce değiştirilmez.

**Zorunlu hata testleri:** İki kez basılan sipariş düğmesi; eşzamanlı iki satın alma; restoranın internetinin kesilmesi; fiyatın sepetten sonra değişmesi; restoranın kapanması; ürünün bitmesi; yanlış mahalle; başarısız bildirim; gecikmiş yeniden deneme.

## 7. Sipariş ve ücret hesaplama kuralları

- Tüm fiyatlar **kuruş cinsinden tam sayı** saklanır.
- Fiyat, ürün seçeneği, minimum tutar ve toplam sunucuda yeniden hesaplanır; istemci tutarı dikkate alınmaz.
- Sipariş anındaki ürün adı, seçenekler, birim fiyat, teslimat ücreti ve toplam “snapshot” olarak saklanır.
- Her sipariş yaratma isteği `(user_id, idempotency_key)` ile tekilleştirilir; aynı anahtar farklı içerik için kullanılırsa hata verilir.
- Veritabanı işlemi (transaction) ve benzersizlik kısıtları sayesinde yarım sipariş veya çift sipariş engellenir.
- Bir sepet tek restoran içindir. Farklı restorandan ürün ekleme halinde açık onayla sepet değişir.
- Sipariş notu, teslimat iletişimi ve kişisel veriler yalnızca gerekli yetkililer tarafından görülebilir.
- Restoranın teslimat ücreti, minimum tutarı ve mahalle uygunluğu sipariş verildiği anda kontrol edilir.
- Raporlar için sadece “oluşturulmuş” değil, “tamamlanmış / iptal / itirazlı” ayrımı yapılır.

## 8. Bismil mahalleleri, siteler ve teslimat modeli

**İlk karar:** Mesafe yarıçapı yerine **restoran bazlı teslimat bölgesi listesi** kullan. Mahalle/site eşlemesini ve gerektiğinde adres istisnalarını yönetim panelinden değiştir.

- Müşteri mahalleyi ve mümkünse site/bina bilgisini seçer; açık adres + kat/daire + tarif girer.
- Harita pini yardımcı olabilir ama tek zorunlu yöntem olmamalıdır; pin yanlış olabilir.
- Her restoran farklı bölgelere farklı minimum sepet ve teslimat ücreti belirleyebilir (veri modeli buna hazır olur); pilotta sabit restoran bazlı ücret tercih edilebilir.
- Restoranın teslimat yapamadığı konuma sipariş verilemez; neden açıklanır.
- Teslimat süresi varsayımsal sabit rakamlarla gösterilmez; restoranın onayladığı servis tahminlerine dayanır.
- Yeni siteler için adres tarifleri ve eksik adres düzeltme mekanizması özellikle test edilir.
- Restoranın kendi kurye sorumluluğu, teslimat şartları ve anlaşmazlık süreçleri yazılı sözleşmede netleştirilir.

## 9. Veri modeli — eklenmiş tablolar ve kısıtlar

**Orijinalden korunan tablolar:** `users`, `addresses`, `restaurants`, `restaurant_staff`, `categories`, `products`, `option_groups`, `options`, `orders`, `order_items`, `order_events`.

**Eklenmesi önerilenler:**
- `restaurant_hours` ve `restaurant_closures`: vardiya/özel günler ve geçici kapatma.
- `delivery_zones` ve `restaurant_delivery_zones`: mahalle/site kapsamı ve bölgeye özel ücret/minimum.
- `restaurant_settings`: sipariş kabul süresi, çalışma/yoğunluk ayarları, tahmini süre.
- `restaurant_documents` (gerekliyse): doğrulama, gizli ve sınırlı erişim.
- `notifications`: kanal, alıcı, idempotency/teslim durumu, tekrar denemeler.
- `support_cases`: müşteri/restoran itirazı, olay bağlantısı ve çözüm tarihi.
- `audit_logs`: idari yetki ve kritik ayar değişiklikleri.
- `billing_periods`, `restaurant_fees`: sözleşmeli komisyon/abonelik raporu ve mutabakat.
- `order_items` içine ürün/opsiyon ID'leri + sipariş anı kopyaları; sipariş kaydı eski menü silinse de bozulmaz.

**Kısıtlar:** Tüm restoran bağlı kayıtlar için `restaurant_id` kapsamı; benzersiz ID ve gerekli yabancı anahtarlar; yetki testleri; geçmiş hareketler üzerinde kontrolsüz güncelleme/silmenin engellenmesi.

Veritabanı tabloları ve ilişki şeması teknik tasarım sırasında migration dosyalarına dönüştürülecektir.

## 10. Teknik mimari — önerilen başlangıç

- **Frontend:** Next.js + React + TypeScript; responsive PWA ve ortak tasarım sistemi.
- **Backend:** NestJS + TypeScript; `auth`, `restaurants`, `catalog`, `delivery`, `orders`, `notifications`, `billing`, `admin` modülleri. Başlangıçta **modüler monolit**, gereksiz mikroservis yok.
- **Veritabanı:** Yönetilen PostgreSQL; Prisma veya Drizzle'dan biri seçilip migration stratejisi sabitlenir.
- **Kimlik:** Profesyonel yönetilen sağlayıcı; e-posta doğrulama, oturum, MFA ve token ömrü test edilir. Özel kimlik sistemini sıfırdan yazmayız.
- **Gerçek zamanlı:** Restoran panelinde SSE veya WebSocket + yeniden bağlanma, durum sorgulamayla uzlaşma; önemli uyarı için bağımsız alternatif kanal.
- **Arka plan işleri:** Gerektikçe kuyruk/worker (yeniden deneme, e-posta ve zaman aşımı). Redis ilk günden mecburi değildir.
- **E-posta:** Alan adı doğrulanmış gönderim hizmeti; gönderim/dönüş hataları izlenir.
- **Görseller:** Güvenli dosya depolama, optimize fotoğraflar, CDN ve yükleme sınırlamaları.
- **İzleme:** Hata takibi, uptime, temel performans, yapılandırılmış log ve uyarılar.
- **Ortamlar:** Yerel geliştirme, test/staging ve üretim ayrı; gizli anahtarlar ayrı; güvenli CI/CD.
- **Mobil sonraki aşama:** Expo/React Native; aynı backend, mobilde uygun oturum ve bildirim akışları.

**İlke:** Sağlayıcı değişse bile sipariş kuralları mümkün olduğunca uygulamanın kendi backend'inde kalmalıdır.

## 11. Güvenlik, mahremiyet ve kalite kapıları

**Güvenlik hedefi:** OWASP ASVS Seviye 2'yi referans alan doğrulanabilir kontroller; bağımsız test olmadan “daha güvenli” veya “hacklenemez” iddiası yok.

- Sunucuda nesne bazlı yetki denetimi, restoran kiracılarının sıkı ayrılması; ayrı rol/yetki testleri.
- Admin/esnaf MFA, kısa ömürlü ve güvenli oturumlar, güvenli çerezler, CSRF/XSS/SQLi korumaları.
- Kullanıcı, e-posta ve IP bazlı giriş/OTP/şifre sıfırlama hız sınırları; bot ve spam önlemleri.
- Parola yöneticisi desteği; sistemin şifre veya ödeme kartı bilgisini düz metin olarak saklamaması.
- Güvenli dosya yükleme, gizli anahtar yönetimi, erişim kayıtları, düzenli paket güncellemeleri.
- Şifreli iletişim, kişisel verilere asgari erişim, saklama/silme politikaları ve KVKK süreci.
- Üretim verilerinin test ortamına izinsiz taşınmaması.
- Günlük yedekleme stratejisi, saklama süresi, **geri yükleme denemesi**, hata/olay müdahale planı.
- Kod kalite kontrolü, birim/entegrasyon/E2E testleri, bağımlılık taraması, güvenlik incelemesi ve üretim öncesi yetkili bağımsız test.
- Sipariş ve ödemelerin kaydı kritik olduğundan değişikliklerde iki kişilik gözden geçirme veya bağımsız uzman kontrolü hedeflenir.

## 12. Performans ve kapasiteyi doğrulama

50 aktif restoran hedefi, veritabanına 50 kayıt eklemekten ibaret değildir. Aşağıdaki değerler **ilk test senaryosu** olarak kabul edilir; garanti veya Bismil'e ait ölçülmüş talep değildir.

- Test verisi: 50 aktif restoran, restoran başına 100 ürün, varyasyonlar ve çok sayıda teslimat bölgesi.
- Senaryolar: aynı anda restoran gezme, arama, sepet güncelleme; yoğun sipariş kabul; panel bağlantısının kopması.
- İlk yük testi hedefi: 200 eşzamanlı aktif oturum ve kısa süreli 30 eşzamanlı sipariş gönderme denemesi; başarısızlık/çift kayıt olmaması.
- Performans raporu: p50/p95 API yanıt süreleri, hata oranı, veritabanı sorguları, bildirim gecikmesi ve kaynak kullanımı.
- Kritik test: Siparişlerin %100'ünün güvenilir biçimde kalıcı kayıt alması ve doğru restoran panelinde görünmesi; kayıp/çift sipariş olmaması.
- Yük testinden sonra altyapı artırımı gerekir mi değerlendirilir; 50 restoran için sabit bir sunucu fiyatı iddia edilmez.

## 13. Gelir modeli, operasyon ve maliyetler

**Pilot ödeme:** Müşteri kapıda nakit veya restoranın POS cihazında ödeme yapar. Platform kart bilgisi veya müşteri parasını tahsil etmez.

**Platform kazancı (karar bekliyor):** Restorandan tamamlanan sipariş başına yazılı sözleşmeli hizmet bedeli **veya** aylık abonelik. Pilot dönemde düşük/0 bedel test edilebilir; süre ve koşullar önceden yazılır.

**Mutabakat:** Restoran tamamlanan siparişleri ve itirazlı/iptal siparişleri panelden görür. Platformun raporu doğrudan banka ödemesini kanıtlamaz; faturalama ve tahsilat süreçleri ayrıca düzenlenir.

**Maliyet kategorileri:**
1. Ürün geliştirme: tasarım, kod, test, erişilebilirlik.
2. Aylık altyapı: sunucu, veritabanı, görsel depolama, CDN.
3. İletişim: e-posta/SMS/telefon/bildirim.
4. Operasyon: restoran kurulumları, kullanıcı desteği, sorun yönetimi.
5. Güvenlik: bağımsız denetim, yedekleme, izleme.
6. Ticari: muhasebe, hukuki destek, olası ödeme hizmeti ve pazarlama.

**Ücretsiz yol:** Açık kaynak araçlarla ve ücretsiz katmanlarla prototip/test yapılabilir. Ücretsiz katmanlar canlı ticari hizmetin yedekleme, SLA, e-posta ve güvenilirliğini garanti etmez.  
**Ücretli yol:** Gerçek kullanıcılarla pilot başlarken üretim odaklı barındırma, gönderim servisi, izleme, yedekleme ve güvenlik bütçesi ayrılır. Güncel teklifler alınmadan kesin aylık ücret yazılmaz.

**Yasal değerlendirme kapısı:** Ticari faaliyete başlamadan önce şirket/işletme yetkisi, restoran sözleşmeleri, vergi/fatura, ETBİS gerekliliklerinin uygulanabilirliği, tüketici hakları, mesafeli aracılık ve KVKK konuları ilgili uzmanlarla kontrol edilir. Reşit olmayan bir kurucu varsa sözleşme, ödeme ve resmî hesap işlemlerinde veli/yasal temsilci desteği gerekir.

## 14. Pilot araştırma ve büyüme kararı

### Geliştirmeden önce kanıtlar

- En az 10 restoran görüşmesi: mevcut sipariş kanalları, teslimat bölgeleri, ücretler, sorunlar, istek ve sözleşmeye açıklık.
- En az 20 müşteri görüşmesi: rakip kuponlar, fiyat hassasiyeti, yeni sitelerde teslimat zorluğu, tekrar sipariş nedenleri.
- En az 5 restoranın açık pilot onayı; mevcut menü/fiyatları paylaşma ve siparişleri panelden yönetme hazırlığı.
- Rakip uygulamalardaki gerçek sipariş fiyatları ve promosyonlar örnek sepetlerle karşılaştırılır; müşteri için her zaman daha ucuz olma vaadi verilmez.

### Büyüme aşamaları

1. **5 restoran — pilot:** Sipariş alma/kabul/teslim süreci çalışıyor mu? Restoranlar paneli kullanabiliyor mu? Kritik hata var mı?
2. **20 restoran:** Operasyon, menü güncelleme, destek ve müşteri edinme sürdürülebilir mi?
3. **50 restoran — üst sınır:** Performans, restoran yetkilendirmesi, raporlar, çalışma saatleri ve destek yükü kontrol altında mı? Kapasite dolduğunda yeni aktif restoran açılmaz; başvuru bekleme listesine alınır. Yük, güvenlik, yedek kurtarma ve kullanıcı deneyimi testleri bu sınırda tekrarlanır.

**Pilot KPI'ları:** Ziyaret→sepete ekleme→sipariş dönüşümü, kabul süresi, süresi dolan sipariş oranı, yanlış/eksik sipariş, teslimat sorunu, tekrar sipariş oranı, restoran memnuniyeti, destek yükü ve platformun işlem başına net katkısı. 2–4 hafta veri toplanır.

## 15. Geliştirme sırası ve “tamamlandı” tanımı

**Faz 0 — Ürün araştırması:** İşletme/müşteri görüşmeleri, pilot restoranları ve gelir modeli. Çıktı: onaylı iş akışı.

**Faz 1 — Tasarım:** Ekran haritası, tasarım sistemi, müşteri/restoran/admin prototipleri ve en az 5 kişiyle kullanılabilirlik testi. Çıktı: onaylı tasarım.

**Faz 2 — Temel altyapı:** Proje deposu, CI, ortamlar, veritabanı migrationları, kimlik sağlayıcısı, MFA, rollere dayalı yetki ve testler. Çıktı: güvenli çalışan iskelet.

**Faz 3 — Sipariş dikey dilimi:** Tek restoran + gerçek menü + sepet + mahalle kontrolü + sipariş + restoran kabulü + canlı durum + iptal. Çıktı: bir siparişin baştan sona test edilmesi.

**Faz 4 — 5 restoran pilotu:** Çok kiracılı yetki, yönetim araçları, raporlar, uyarı yedekliliği, hata/ yük testleri, yedek geri yükleme, destek ve mevzuat kontrolü. Çıktı: kontrollü gerçek pilot.

**Faz 5 — Büyütme:** Sürdürülebilir sonuç varsa kampanya, online ödeme, mobil uygulama ve diğer özellikler önceliklendirilir.

**Her özellik için tamamlanma koşulu:** Tasarım onaylı; API ve yetki kuralları tanımlı; olumlu/olumsuz durumlar testli; otomatik testler yeşil; erişilebilirlik ve temel güvenlik kontrolleri geçmiş; izleme/log mevcut; sürüm geri alınabilir.

## 16. Tek kurucu için görev ve destek planı

**Tek kişinin başlatabileceği:** Araştırma, kapsam/tasarım, kodlama pratiği, açık kaynak kütüphaneleri kullanma, otomatik testleri kurma, 5 restoranla pilot ilişki.

**Yardımın kritik olduğu yerler:** Canlı sistem güvenlik incelemesi, ödeme ve ticari sözleşmeler, KVKK ve hukuki değerlendirme, kesinti halinde destek, restoran eğitimi ve müşteri sorunları. Profesyonel destek bir “başarısızlık” değil, sorumluluk paylaşımıdır.

**Pratik kural:** İlk günden 50 restoran açma; yalnız yürütülebilen bir pilot oluştur. 5 restoran için bile gece gelen sipariş/şikâyet ve destek saatleri önceden tanımlanmalıdır.

## 17. Açık kararlar — önerilen varsayılanlar

Aşağıdakiler görüşmeler sonucunda değişebilir; “kesin kararlaştırıldı” olarak okunmamalıdır.

| Karar | v0.3 geçici önerisi |
|---|---|
| Restoran kabul süresi | 4 dakika; gerçek pilotta ölç |
| Teslimat bölgesi | Restoran bazında mahalle/site listesi; gerektiğinde istisna |
| Teslimat bedeli | Restoran bazında sabit başlangıç; bölge bazlı esneklik |
| Pilot platform ücreti | İşletmelerle görüşüldükten sonra yazılı belirle |
| Sipariş zamanlama | V1 dışında |
| Müşteri iptali | Beklemede kendi iptal eder; sonrası destek |
| Online ödeme | V1 dışında; ileride pazaryeri altyapısı |
| Müşteri kaydı | E-posta doğrulama + şifre; telefon teslimat için |
| Mobil uygulama | Önce PWA; sonra Android/iOS |
| Restoranlar | Pilot adayları görüşme ve anlaşmayla kesinleşir |
| Ad/logo/renk | Ayrı marka çalışması sonrası seçilir |
| Kampanyalar | İlk pilotta otomatik kupon yok; model ve veri alanı hazır |
| Sözleşme/destek | Ticari pilot öncesinde tamamlanır |

## 18. İlk gerçek iş paketi (kod yazmadan önce)

1. İlk pilotun hedef teslimat mahallelerini haritada işaretle.
2. 10 restoran için görüşme şablonu ve cevap tablosu oluştur.
3. 20 müşteri için mevcut rakip sipariş/kupon deneyimi görüşmesini hazırla.
4. Kullanıcı yolculuklarını gösteren 3 etkileşimli ekran akışı tasarla: kayıt/giriş, sipariş verme, restoranın siparişi kabul etmesi.
5. **Pilot fiyatlandırması ve teslimat sorumluluğu** için restoranlarla doğrulanacak varsayımları yaz.
6. Görüşmeler olumluysa Faz 2'de geliştirilecek ilk teknik modülleri ve test senaryolarını küçük görevlere böl.

**Bu belge üzerinde çalışırken:** Her yeni sürümde değişiklik günlüğü tut; yapay zekâdan tek seferde tüm sistemi kodlamasını isteme; kritik kodları ve test sonuçlarını uzman görüşü olmadan “güvenli” ilan etme.


## 19. İlk saha görüşmesi — hazır soru listesi

**Restoran sahibine (10 görüşme hedefi):**
1. Günlük paket siparişinizi kabaca kaç adet alıyorsunuz; hangi saatlerde yoğunlaşıyor?
2. Siparişler telefon, WhatsApp ve büyük platformlar arasında nasıl dağılıyor?
3. Kendi kuryeniz hangi mahalle ve yeni sitelere çıkıyor; nereye çıkamıyor?
4. En sık yaşadığınız üç sorun nedir: yanlış adres, sipariş karışması, iptal, kurye gecikmesi veya komisyon?
5. Siparişin tablet/telefondaki panelden gelmesi işinizi kolaylaştırır mı; hangi koşulda zorlaştırır?
6. Yeni müşteri getirebilecek platform için hangi ücret modeli (abonelik / tamamlanan sipariş) mantıklı olur; neden?
7. Pilot için 2–4 hafta menü ve teslimat bilgisini güncel tutup sistemden sipariş almayı kabul eder misiniz?

**Bismil'deki müşteriye (20 görüşme hedefi):**
1. Son üç yemek siparişinizi nereden verdiniz, neden o kanalı seçtiniz?
2. Kupon/indirim olmadan yine aynı restorandan aynı şekilde sipariş verir miydiniz?
3. Yeni sitelerde hangi restoranlar teslimat yapmıyor veya geç getiriyor?
4. Sipariş ekranında sizin için en önemli bilgiler hangileri: toplam fiyat, ücret, süre, menü, destek?
5. Siparişinizde hata olduğunda bugün nasıl çözüyorsunuz?
6. Yeni yerel platformu denemenize sebep olabilecek **tek somut avantaj** ne olurdu?

**Kayıt biçimi:** İşletmenin adı, kategori, bölge, bugün kullanılan yöntem, ölçülebilir problem, pilot isteği ve bir sonraki görüşme sonucu. Müşteri görüşmelerinde gereksiz kişisel bilgi toplanmaz.

**İlk karar eşiği:** Görüşmelerde gerçek ve tekrarlanan bir sorun ortaya çıkmıyorsa, kapsamı büyütmeden önce ürün vaadini yeniden tanımla. Çözüme ilgi tek başına ödeme ve kullanım kanıtı değildir.

---

## 20. Ekran haritası — Faz 1 tasarım kapsamı

**Ekran kodu** tasarım, kod ve testlerde ortak adlandırmadır. Listelenen ekranların hepsi ilk yayında bağımsız sayfa olmak zorunda değildir; bazıları modal, çekmece veya sekme olabilir. Temel amaç eksiksiz kullanıcı yolculuğu oluşturmaktır.

### 20.1 Müşteri: keşif ve hesap

| Kod | Ekran / bileşen | İçerik ve öncelikli hareket | V1 |
|---|---|---|---|
| `C-01` | Karşılama / teslimat konumu | Mahalle/site seçimi; 'Adresi sonra ekle' | Evet |
| `C-02` | Ana sayfa | Arama, kategori, teslimat adresi, restoran kartları, sepet erişimi | Evet |
| `C-03` | Arama / sonuçlar | Yemek ve restoran araması; sonuç sayısı, boş sonuç açıklaması | Evet |
| `C-04` | Filtre ve sıralama | Açık, teslimat uygun, kategori; kolay temizleme | Evet |
| `C-05` | Restoran detay | Menü, fiyatlar, çalışma saati, minimum sepet ve teslimat bilgisi | Evet |
| `C-06` | Ürün detay | Zorunlu/isteğe bağlı seçenek, adet, not, güncel fiyat | Evet |
| `A-01` | Giriş / kayıt seçimi | E-posta ile devam, ayrı giriş bağlantısı | Evet |
| `A-02` | E-posta doğrulama | Kodu/bağlantıyı kontrol et; yeniden gönder ve zaman aşımı | Evet |
| `A-03` | Şifre oluşturma | Geçerli şifre ve anlaşılır hata mesajları | Evet |
| `A-04` | Giriş | Oturum aç; şifremi unuttum | Evet |
| `A-05` | Şifre sıfırlama | Hesap varlığını açıklamayan sonuç mesajı, güvenli bağlantı | Evet |
| `A-06` | Hesap / oturum uyarısı | Güvenlik, çıkış, gerektiğinde yeniden doğrulama | Evet |

**Ana sayfa yerleşim önerisi — mobil:** Üstte teslimat bölgesi ve hesap; altında tek belirgin arama alanı; yatay mutfak kategorileri; 'Sana teslimat yapanlar' restoran listesi; kolay erişilen sepet durumu. Reklam alanı, arama ve restoran listelemesini örtmez. **Masaüstü:** üst gezinme ve filtre yan/üst paneli ile geniş restoran ızgarası.

**Restoran kartı zorunlu verileri:** Restoran adı, görsel, açık/kapalı, teslimat uygunluğu, varsa doğrulanmış tahmini süre, minimum sepet, teslimat ücreti. Puan sistemi V1'de olmadığından uydurma yıldız veya değerlendirme sayısı gösterilmez. İndirim etiketi de gerçek ve etkin bir teklif yoksa çıkmaz.

### 20.2 Müşteri: sepet, sipariş ve destek

| Kod | Ekran / bileşen | İçerik ve öncelikli hareket | V1 |
|---|---|---|---|
| `C-07` | Sepet | Ürün, seçenek, adet, silme, fiyat özeti, tek restoran kuralı | Evet |
| `C-08` | Adreslerim | Adres seçme, ekleme, değiştirme | Evet |
| `C-09` | Adres düzenleyici | Mahalle/site, sokak/bina, daire, tarif, telefon | Evet |
| `C-10` | Sipariş özeti | Son fiyat, teslimat, ödeme tipi, not, onay | Evet |
| `C-11` | Sipariş sonucu | Sipariş numarası ve restorana iletim bilgisi | Evet |
| `C-12` | Aktif sipariş takibi | Durum, işlem zamanı, sorun varsa destek erişimi | Evet |
| `C-13` | Geçmiş siparişler | Son/önceki siparişler, ayrıntılar | Evet |
| `C-14` | Sipariş detay | Kalemler, sipariş anı fiyatı, durum geçmişi, sorun bildir | Evet |
| `C-15` | Profil / tercihler | Kişisel bilgiler, iletişim, güvenlik, çıkış | Evet |
| `C-16` | Yardım / destek talebi | Sipariş bağlı sorun, kategori, durum, yanıt | Evet |
| `C-17` | Hesap silme / mahremiyet | Veri ve oturum talebi, yasal bilgilendirme | Evet |
| `C-18` | Favoriler ve tekrar sipariş | Restoran/ürün favorisi, yeniden sipariş kontrolü | Sonra |
| `C-19` | Kupon / sadakat | Kampanya koşulları ve kupon kullanma | Sonra |

**Kritik sepet kuralı:** Başka restorana geçip ürün eklemeye çalışan kullanıcı, önce mevcut sepetin değişeceği konusunda açıkça bilgilendirilir. Onay olmadan eski sepet silinmez. Sunucudaki güncel fiyat ve bölge uygunluğu, son ödeme/sipariş ekranında tekrar kontrol edilir.

### 20.3 Restoran paneli (müşteri sitesiyle karıştırılmayan ayrı arayüz)

| Kod | Ekran | Yapılması gereken |
|---|---|---|
| `R-01` | Restoran girişi + MFA | Sadece yetkili restoran personeli oturum açar |
| `R-02` | Canlı sipariş ekranı | Yeni sipariş, büyük kabul/ret düğmeleri, süre göstergesi |
| `R-03` | Sipariş ayrıntısı | Ürün seçenekleri, müşteri notu, teslimat bilgisi ve işlem geçmişi |
| `R-04` | Hazırlama / teslimat | Hazırlanıyor, hazır, yolda ve teslim edildi aşamaları |
| `R-05` | Menü yönetimi | Kategoriler, ürünler, görseller, seçenekler |
| `R-06` | Ürün düzenleme | Fiyat, varyasyon, satışa açık/kapalı ayarı |
| `R-07` | Çalışma ve yoğunluk | Saatler, tatil, meşgul, sipariş almayı durdur |
| `R-08` | Teslimat bölgeleri | Mahalle/site, minimum tutar ve bölgeye özgü ücret |
| `R-09` | Personel ve yetkiler | Yetkili roller, oturum/erişim kaldırma |
| `R-10` | Sipariş geçmişi ve rapor | Tamamlanan, reddedilen, iptal edilen ve itirazlı siparişler |
| `R-11` | Bağlantı/bildirim durumu | Ses testi, bağlantı göstergesi, alternatif bildirim seçeneği |
| `R-12` | Destek | Sipariş sorunu veya panel yardımı |

**Restoran ana ekranı ilkesi:** Restoran içeri girdiğinde rapor veya grafiklerden önce **aktif siparişler** görünmeli. Kritik sipariş durumu tek elle, en az dokunuşla güncellenebilmeli. Yeni sipariş kaçırılmasın diye sessiz tarayıcı durumunda ikincil uyarı planı gerekir.

### 20.4 Yönetici paneli

| Kod | Ekran | Yapılması gereken |
|---|---|---|
| `M-01` | Güvenli yönetici girişi | MFA; kritik işlemde yeniden doğrulama |
| `M-02` | Operasyon özeti | Açık siparişler, gecikmeler, panel çevrimdışı durumları |
| `M-03` | Restoran başvuruları | Başvuruyu incele, doğrula, yayınla/askıya al |
| `M-04` | Restoran listesi | En fazla **50 aktif** restoran, arama ve filtre |
| `M-05` | Restoran ayrıntısı | Menüler, teslimat, personel, sözleşme ve faaliyet durumu |
| `M-06` | Sipariş arama | Sipariş numarası, restoran ve durum üzerinden güvenli arama |
| `M-07` | Sipariş sorunları | İptal, eksik teslim, itiraz ve çözüm kaydı |
| `M-08` | Kullanıcı / yetki yönetimi | En az ayrıcalık ilkesiyle kısıtla, kilitle, yetki ver |
| `M-09` | İçerik kontrolü | Yanlış/uygunsuz görsel, menü ve restoran bilgisi |
| `M-10` | Komisyon ve raporlar | Tamamlanan siparişler, itirazlar, mutabakat |
| `M-11` | Bildirim ve sistem durumu | Uyarı hataları, bekleyen işler, operasyon takibi |
| `M-12` | Denetim kayıtları | Kritik değişikliği kim, ne zaman, hangi gerekçeyle yaptı |

**50 restoran üst sınırı yönetimi:** `M-03` ve `M-04` ekranları 'X / 50 aktif restoran' sayacını gösterir. Aktif restoran sayısı 50 olduğunda yeni onaylı işletmeyi yayına alma düğmesi bloke edilir; kullanıcıya açıklama gösterilir. Bu sınır yalnızca arayüzde değil, backend ve veritabanı işlemiyle de korunur. Taslak, reddedilmiş, askıya alınmış ve geçmiş kayıtlar ayrı sayılır. 'Aktif' tanımı: yayında olup sipariş almaya yetkili restoran (geçici olarak saat dışı veya meşgul olsa bile kapasiteyi işgal eder).

### 20.5 Ortak durum ekranları ve öğeleri

- `S-01` Yükleniyor: iskelet görsel, boş beyaz ekran değil.
- `S-02` Liste boş: 'Bu mahalleye teslimat yapan restoran bulunamadı' + adresi değiştir.
- `S-03` Servis hatası: ne olduğu, güvenli yeniden dene, yardım bağlantısı.
- `S-04` İnternet yok: siparişin gönderilip gönderilmediği kesinleşmeden 'başarısız' ilan etme.
- `S-05` Doğrulama hatası: süresi dolmuş bağlantı ve yeniden gönderme akışı.
- `S-06` Restoran kapalı/meşgul: menü görülebilir; sipariş verilemez.
- `S-07` Fiyat/ürün değişti: yeni tutarı açıkça göster, kullanıcı onayı iste.
- `S-08` Onay süresi doldu: restoran siparişi kabul etmedi; başka restoran veya destek.
- `S-09` Erişim yok: kullanıcı yetkisi olmayan ekranı göremez; kişisel veri ifşa edilmez.
- `S-10` Oturum süresi doldu: oturum yenileme/girişe dönüş; sepeti gerekirse korunur.

## 21. Ana gezinme ve sayfa hiyerarşisi

### 21.1 Müşteri mobil

**Üst bar:** teslimat konumu, hesap.  
**Ana içerik:** arama, mutfak kategorileri, teslimat uygun restoranlar.  
**Alt sabit gezinme (öneri):** Keşfet | Siparişlerim | Profil.  
**Sepet:** İçinde ürün varsa ekranın altına, alt gezinmeyi kapatmadan belirgin 'Sepeti görüntüle' özeti. Tek başına sepet sekmesi veya yapışkan sepet çubuğu seçenekleri kullanılabilirlik testinde karşılaştırılır.

### 21.2 Müşteri masaüstü

Sol üst marka, teslimat konumu, geniş arama; sağda giriş/profil ve sepet. Restoranlar ızgara düzende; filtreler kolay görünen bir panelde. Sepet restoran sayfasında uygun genişlikte yan panel olabilir.

### 21.3 Restoran tablet ve telefon

İlk sekme her zaman 'Aktif siparişler'. İkinci 'Menü', üçüncü 'İşletme', dördüncü 'Geçmiş'. Kritik işlem butonları ürün bilgilerinden ayrılır. Sesli uyarı çalışmıyorsa görünür uyarı verilir.

### 21.4 Yönetici

Sol menü veya dar ekranda açılabilir menü: Operasyon | Restoranlar | Siparişler | Destek | Raporlar | Sistem. Ana yönetici dışında güvenlik menüsü yalnızca uygun rol için görünür. Ekranı gizlemek, sunucudaki izin kontrolünün yerine geçmez.

## 22. Uçtan uca kullanıcı yolculukları

### Akış F-01 — İlk kayıt ve adres ekleme

`C-02 / A-01` → e-posta gir → `A-02` doğrula → `A-03` şifre oluştur → güvenli oturum → `C-08/09` adres ekle → `C-02` keşfet.

**Alternatifler:** E-posta gelmedi; bağlantı süresi bitti; yanlış kod; e-posta zaten kullanılıyor; kullanıcı adım ortasında uygulamadan çıktı. Süreli ve sınırlı yeniden gönderme, güvenli hata mesajı ve kaldığı yerden devam mantığı tasarlanır.

**Kabul:** Geçerli doğrulaması olmayan hesap sipariş oluşturamaz. Şifre açık metin saklanmaz. Tarayıcı parola yöneticisi devre dışı bırakılmaz. E-posta adresi doğrulamasının başarısı gerçek sağlayıcıyla test edilir.

### Akış F-02 — Sipariş verme (ana müşteri yolculuğu)

`C-01` mahalle → `C-02/03` restoran seç → `C-05/06` ürün ve seçenekler → `C-07` sepet → `C-09` adres → `C-10` son kontrol → 'Sipariş ver' → `C-11/12` takip.

**Alternatifler:** Restoran meşgul/kapalı; mahalle kapsam dışı; ürün yok; minimum sepet altında; fiyat değişmiş; iki kez tıklama; bağlantı kesildi; sipariş alınmış ama yanıt dönmemiş. Bu durumlarda çift sipariş oluşturulmaz, kesinlik yoksa sipariş durumu numara/istek anahtarıyla sorgulanır.

**Kabul:** Siparişin restoranı, ürün seçenekleri, kapıda ödeme tipi ve toplamı doğru kaydedilir. Başka restoranın ürünleri aynı siparişe karışmaz. Sonradan fiyat değişimi geçmiş siparişi değiştirmez.

### Akış F-03 — Restoran siparişi alır ve teslim eder

`R-02` yeni sipariş uyarısı → `R-03` ayrıntı → kabul/ret → `R-04` hazırlanıyor → hazır → yolda → teslim edildi; müşteri `C-12` üzerinden durumları görür.

**Alternatifler:** 4 dakikalık önerilen kabul süresi dolar; restoran bağlantısı kopar; yanlışlıkla iki personel aynı siparişi işler; teslimat başarısız olur; müşteri itiraz açar.

**Kabul:** Yalnızca izin verilen durum geçişi gerçekleşir. Eşzamanlı iki personelin işlemi veriyi bozmaz. Her geçiş `order_events` tablosundadır. Restoran dışındaki hiçbir personel bu siparişi değiştiremez.

### Akış F-04 — Sorun ve müşteri desteği

`C-14` sipariş detayı → `C-16` sorun bildir → `M-07` destek kaydı → restoranla/ilgili tarafla çözüm → müşteriye sonuç iletilir.

**Kabul:** Destek personeli yalnızca görevine gerekli bilgileri görür; sipariş geçmişi geçmişe dönük gizlice değiştirilmez. Kapıda ödeme alındığı için platform otomatik kart iadesi varmış gibi davranmaz.

### Akış F-05 — Yeni restoranın devreye alınması

`M-03` başvuru → işletme bilgisi kontrolü → menü ve teslimat alanı → `R-01` restoran yöneticisi hesabı/MFA → test siparişi → yayına alma → `M-04` aktif restoran sayacı.

**Kabul:** 50 aktif restoran varken 51. restoran yayına alınamaz; kullanıcıya kapasite dolu açıklaması gösterilir. Onay/red işlemleri denetim kaydına yazılır. İki yönetici eşzamanlı onay verse bile sınır aşılamaz.

## 23. Tasarım sistemi ve görsel kalite standardı

**Hedef:** Yemeksepeti ve Trendyol Go kadar anlaşılır gezinme; onlardan bağımsız, Bismil'e ait özgün kimlik. Marka ve renkler henüz kesinleşmediği için aşağıdakiler *tasarım ilkesi*, onaylanmış marka tasarımı değildir.

| Alan | İlke |
|---|---|
| Tipografi | Okunabilir bir sans-serif ailesi; başlık/gövde/fiyat hiyerarşisi |
| Boşluklar | Tutarlı 4/8 tabanlı boşluk sistemi; sıkışık kartlardan kaçın |
| Renk | Bir ana vurgu rengi, nötr zeminler, semantik başarı/hata/uyarı renkleri |
| Restoran görselleri | Tutarlı oranlar, hızlı yükleme, görsel yoksa kaliteli yer tutucu |
| Butonlar | Birincil işlem belirgin; tehlikeli işlemler onaylı ve ayrı |
| Mobil etkileşim | En az 44×44 CSS px dokunma hedefini tercih et; ekranlarda gerçek cihaz testi |
| Erişilebilirlik | WCAG 2.2 AA kontrol listesi, odak göstergesi, kontrast, metin büyütme |
| Bildirimler | Sadece renk veya sesle bilgi verme; metinsel durum da göster |
| Hata metni | 'Bir hata oluştu' yerine ne yapılabileceğini açıklayan yalın Türkçe |
| Hareket | Ölçülü animasyon; düşük performanslı cihazlarda akıcı gezinme |
| Güven | Ödeme türü, teslimat ücreti ve sipariş durumu son ana kadar açıkça görülür |

**Çalışılması gereken ekran durumları:** Her ana ekran için boş, yükleniyor, başarı, hata, mobil dar ekran, klavye ile kullanım, erişim engeli ve yavaş bağlantı ayrı ayrı tasarlanır. Gerçek indirim veya gerçek puan olmadığı durumda sahte indirim/puan gösterilmez.

## 24. Ekran kabul kriterleri — test edilebilir davranışlar

| Test ID | Beklenen davranış |
|---|---|
| `UX-01` | Konumu olmayan ziyaretçi restoranları genel olarak görebilir; sipariş öncesi adres seçmek zorundadır |
| `UX-02` | Uygun olmayan mahalle için sipariş butonu engellenir ve açıklama sunulur |
| `UX-03` | Kullanıcı aynı restoranda ürün seçeneklerini değiştirince toplam güncellenir |
| `UX-04` | Fiyat değişikliği varsa siparişten önce eski-yeni fiyat açıkça gösterilir |
| `UX-05` | Aynı siparişin çift gönderilmesi iki farklı sipariş üretmez |
| `UX-06` | Sipariş kabul/ret değişikliği müşterinin takip ekranına yansır |
| `UX-07` | Restoran paneli bağlantısı kesilirse durum görünür; tekrar bağlantıda kayıtlarla eşitlenir |
| `UX-08` | Farklı restoran çalışanı başka restorana ait adrese/siparişe erişemez |
| `UX-09` | E-posta doğrulanmadan sipariş oluşturulmaz; hatalı bağlantı güvenli şekilde ele alınır |
| `UX-10` | 50 aktif restoran sayacında yeni restoranı etkinleştirme sunucuda da engellenir |
| `UX-11` | Kapıda POS seçimi, uygulamanın kart bilgisini toplamasına neden olmaz |
| `UX-12` | Dar telefon ekranında giriş, menü, sepet ve takip ekranları yatay kaydırma gerektirmez |
| `UX-13` | Restoran kapalı/meşgul durumları menüde ve sipariş aşamasında tutarlı gösterilir |
| `UX-14` | Sipariş verilmemişken internet koparsa, müşteriye yanlışlıkla 'sipariş alındı' denmez |

## 25. İlk prototip iş paketi — tek kurucu için uygulanabilir sıra

Tüm ekranları aynı anda kodlamak yerine aşağıdaki **dört etkileşimli akışı** tasarlamak daha denetlenebilir olur:

1. **Kayıt akışı:** `A-01 → A-02 → A-03 → C-02` (e-posta doğrulama için prototipte örnek durumlar).
2. **Sipariş akışı:** `C-02 → C-05 → C-06 → C-07 → C-09 → C-10 → C-11/12`.
3. **Restoran akışı:** `R-01 → R-02 → R-03 → R-04`.
4. **Yönetim akışı:** `M-01 → M-03 → M-04 → M-05`.

**Prototipin hedefi:** Gerçek ödeme, SMS, canlı veritabanı veya ticari sipariş başlamadan önce ekranların anlaşılır olup olmadığını sınamak. İlk geliştirilecek teknik dikey dilim, tek restoranlı gerçek API sipariş akışıdır; üretime çıkmak sonraki test ve hukuk aşamasıdır.

**Tek kişiyle çalışma düzeni (öneri):** Her özellik için küçük görev kartı aç; ekranı onayla → API sözleşmesi → yetki kontrolü → otomatik test → elle gerçek cihaz kontrolü → kod incelemesi → sürüm notu. Kritik kayıt/ödeme/güvenlik bileşenleri için bağımsız uzman incelemesi planla.

## 26. Hâlâ açık olan kararlar

Aşağıdakileri kullanıcı kararı veya saha görüşmesi olmadan kesinleşmiş gibi kabul etmiyoruz:

1. Uygulama adı, logo, marka renkleri ve alan adı.
2. İlk pilotta hangi 5 restoranın yer alacağı.
3. Restoran başına komisyon/abonelik ve pilot ücretlendirmesi.
4. Teslimat ücreti ve yeni siteler için restoran bazlı istisnalar.
5. Telefon doğrulama zorunlu mu, yalnızca teslimat iletişimi için mi?
6. Restoran kabul süresi önerilen 4 dakika olarak mı kalacak?
7. İşletme destek saatleri ve kaçan siparişe alternatif bildirim kanalı.
8. Ticari pilotun sözleşme, KVKK ve yasal gerekliliklerinin onayı.

**Şu anki ilerleme durumu:** 50 restoran sınırı ve ekran/yolculuk kapsamı belirlendi. Bir sonraki somut çıktı **C-02 ana sayfa + C-05 restoran + C-07 sepet + A-01/A-02/A-03 kayıt** için özgün, yüksek kaliteli görsel tasarım ve tıklanabilir prototiptir. Bu dosya tek başına uygulanmış tasarım veya çalışan kod değildir.
