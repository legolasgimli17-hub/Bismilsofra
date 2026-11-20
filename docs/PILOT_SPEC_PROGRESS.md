# Bismil Sofra — Şartnameye göre gerçek pilot ilerleme tablosu
Tarih: 20 Kasım 2026. Kaynak: 17.11.2026 tarihli `spec.md v0.1` ve `Bismil_Yemek_Platformu_Sartname_v0_2` taslakları, sonradan kararlaştırılan kapsam.

## Çelişen taslaklar için bağlayıcı son karar
- **Bismil içinde, önce 5 restoran, sonra 20, en fazla 50 aktif restoran.** v0.2'nin daha eski `100 restoran` büyüme taslağı sonradan kabul edilen 50 üst sınırıyla değiştirilmiştir; veritabanı 50 aktif slotu zorunlu kılar.
- Restoranın kendi kuryesi teslim eder; kapıda **nakit** ya da **restoranın POS cihazı**. Uygulama müşteri kart verisi almaz ve nakit tahsil etmez.
- Yalnızca **profesyonel web/PWA** pilot. Android/iOS mağaza uygulaması, online kart ödemesi, kampanya/kupon, yorum/puanlama, sadakat, kendi kurye filosu ve market kapsam dışıdır.
- Gerçek restoranlar onay vermeden kurgu menü/fiyat gerçek gibi yayımlanmaz. Demo verileri pilot verisi değildir.

## İlk pilot için şartname izleme tablosu

| Alan | Kod ve otomasyon düzeyi | Pilotta ayrıca gerekli |
| --- | --- | --- |
| Profesyonel müşteri vitrini / kategori / menü | Next.js restoran listesi, mahalle filtresi, ürün seçenekleri, arama, demo ve gerçek API ayrımı var | Gerçek restoran fotoğrafları, cihaz erişilebilirlik testi, sayfa hızı ve kullanıcı denemesi |
| Güvenli müşteri hesabı ve esnaf MFA | İmzalı OIDC token, yetki, test senaryoları var | **Gerçek Auth0 tenant**, doğrulama e-postası, şifre sıfırlama, MFA ve hesap kurtarma uçtan uca |
| Sepet / mahalle / kapıda ödeme | Sunucu fiyat/uygunluk doğrulaması, idempotency, teslimat ücreti, geçmiş sipariş var | Gerçek ilk müşteri akışı, adres anlaşılabilirliği, iptal testleri |
| Restoran sipariş ve menü paneli | Sipariş kabul/red, durum, saat/mahalle/ürün/seçenek/ekstra, reconnect, foto yükleme kodu var | Gerçek tablet/telefon, bildirim sesi ve kayıp bağlantı saha testi |
| **Restoran pilot kurulumu** | **Bu PR:** admin kapalı taslak, doğrulanmış owner, mahalle/ücret, menu/saat kontrolü, aktivasyon/kapatma | 5 gerçek işletme onayı, doğrulanmış hesaplar, izinli görseller, eğitim |
| Admin kullanıcı kısıtlama ve personel yönetimi | **Bu PR:** yönetici tam e-posta eşleşmesiyle hesap durumu değiştirir; restoran sahibi/yöneticisi personel ekler, yetki verir, çıkarır; audit ve tenant izolasyonu testleri | Gerçek Auth0 hesapları, provider session iptali, pilot personel eğitimi |
| Admin raporları / pilot metrikleri | 7/30 gün Türkiye saati günlük sipariş, kabul süresi, iptal/red, süre aşımı, teslim ve tekrarlı müşteri agregaları; işletme ve platform rapor ekranları | 2–4 hafta gerçek siparişle KPI doğrulama; ziyaret→sipariş analitiği ve ticari mutabakat hâlâ eksik |
| Admin sipariş arama / inceleme | **Bu PR:** 8 haneli kısa numara veya tam UUID ile sipariş bulma; yetkili yönetici tarafından PII içermeyen durum ve ürün geçmişini audit kaydıyla inceleme | Canlı pilotta destek ve anlaşmazlık iş akışını uçtan uca doğrulama; gerekiyorsa gerekçeli iletişim bilgisi erişimi |
| Gerçek zamanlı restoran uyarısı | **Bu PR:** REST üstüne kimliği doğrulanmış SSE olay sinyali, PostgreSQL transaction-sonrası NOTIFY, restoran/müşteri canlı yenileme, 11 sn tekrarlayan isteğe bağlı ses, 7 sn HTTP kurtarma | **İki gerçek bağımsız bildirim sağlayıcısı**, test edilmiş direkt/sabit PostgreSQL LISTEN oturumu, fiziksel cihaz ve uzun ağ kesintisi testleri |
| Müşteri destek talepleri | Admin inceleme/kapama, müşteri durum takibi, audit mevcut | Destek çalışanı/iletişim kanalı ve anlaşmazlık süreci |
| Mobil PWA | `manifest.webmanifest`, service worker, responsive düzen mevcut | Gerçek Android/iPhone kurulum, offline/error akışı ve 360px kullanılabilirlik kanıtı |
| DevOps ve yasal | Checksum migration, otomatik test, rate limits, audit; **bu PR:** geçici CI PostgreSQL verisinde mantıksal yedek alıp başka veritabanına restore etme ve sipariş/event/audit doğrulaması | **Canlı ortamda şifreli otomatik yedek, uzak saklama ve gerçek restore tatbikatı**, HTTPS staging, bağımsız güvenlik incelemesi, KVKK ve sözleşmeler |

## Şartnamedeki faz sıralaması: kalan öncelikler
**Faz 2–3 — Geliştirme ortamında eksiksiz dikey akış:** Gerçek Auth0 konfigürasyonu ve 1 gerçek restoranın menü/mahalle/owner/checkout/teslimat denemesi; iki taraflı rol ve ağ hataları. Kod ve CI bu deneyimi hazırlıyor ama saha geçmedi.

**Faz 4 — Kontrollü 5 restoran pilotu:** Yönetici üzerinden restoran kurma (bu PR), personel/kullanıcı yetki yönetimi, **temel raporlar ve pilot KPI**, gerçek bildirim sistemi + SSE/tekrarlayan alarm, kaliteli lisanslı fotoğraflar, mobil deneyim testi, HTTPS/backup/restore, hukuki ve operasyon görevleri.

**Faz 5 — Pilot ölçümünden sonra:** Yalnızca gerekirse kupon, pazaryeri ödeme, native mobil, gelişmiş kurye ve büyüme özellikleri.

## "Tamamlandı" demek için
Her yeni işte: gerçek UI + API + yetkilendirme; olumlu/olumsuz/yarış durumları için test; GitHub PR ve yeşil CI; değişmeyen 50 aktif sınırı; mevcut sipariş geçmişinin korunması; saha gerekiyorsa ayrıca "gerçek cihazda doğrulandı" kanıtı. PR birleştirme tek başına ticari hazır oluş değildir.

## Sonraki geliştirme dilimi
Restoran kurulumu geçtiğinde, **gerçek sağlayıcılarla iki kanallı alarm, gerçek Auth0, fiziksel Android/iPhone testi ve 5 restoran saha pilotu** şartnamedeki en önemli açık ürün işlevleridir. Sadece bildirim işçileri/polling ile sürüm büyütülmeyecek.
