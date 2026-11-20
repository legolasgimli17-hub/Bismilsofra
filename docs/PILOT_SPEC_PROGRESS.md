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
| Admin kullanıcı kısıtlama ve personel yönetimi | `users.enabled` ve `restaurant_staff` veritabanı/rol modeli mevcut; tam self-service yönetim eksik | Yönetici arayüzünden gerçek yetkilendirme, kısıtlama/güvenli geri alma testleri |
| Admin raporları / pilot metrikleri | Sipariş olay geçmişi mevcut; günlük/restoran bazlı rapor paneli **eksik** | Sipariş dönüşümü, kabul süresi, kayıp/iptal ve tekrar sipariş oranı |
| Gerçek zamanlı restoran uyarısı | Polling, dayanıklı birincil outbox, ikinci worker, worker watchdog var | **SSE/WebSocket**, kabul edilene dek tekrarlayan alarm, iki bağımsız gerçek sağlayıcı, fiziksel cihaz testi |
| Müşteri destek talepleri | Admin inceleme/kapama, müşteri durum takibi, audit mevcut | Destek çalışanı/iletişim kanalı ve anlaşmazlık süreci |
| Mobil PWA | `manifest.webmanifest`, service worker, responsive düzen mevcut | Gerçek Android/iPhone kurulum, offline/error akışı ve 360px kullanılabilirlik kanıtı |
| DevOps ve yasal | Checksum migration, otomatik test, rate limits, audit mevcut | HTTPS staging, otomatik yedek + **restore provası**, bağımsız güvenlik incelemesi, KVKK ve sözleşmeler |

## Şartnamedeki faz sıralaması: kalan öncelikler
**Faz 2–3 — Geliştirme ortamında eksiksiz dikey akış:** Gerçek Auth0 konfigürasyonu ve 1 gerçek restoranın menü/mahalle/owner/checkout/teslimat denemesi; iki taraflı rol ve ağ hataları. Kod ve CI bu deneyimi hazırlıyor ama saha geçmedi.

**Faz 4 — Kontrollü 5 restoran pilotu:** Yönetici üzerinden restoran kurma (bu PR), personel/kullanıcı yetki yönetimi, **temel raporlar ve pilot KPI**, gerçek bildirim sistemi + SSE/tekrarlayan alarm, kaliteli lisanslı fotoğraflar, mobil deneyim testi, HTTPS/backup/restore, hukuki ve operasyon görevleri.

**Faz 5 — Pilot ölçümünden sonra:** Yalnızca gerekirse kupon, pazaryeri ödeme, native mobil, gelişmiş kurye ve büyüme özellikleri.

## "Tamamlandı" demek için
Her yeni işte: gerçek UI + API + yetkilendirme; olumlu/olumsuz/yarış durumları için test; GitHub PR ve yeşil CI; değişmeyen 50 aktif sınırı; mevcut sipariş geçmişinin korunması; saha gerekiyorsa ayrıca "gerçek cihazda doğrulandı" kanıtı. PR birleştirme tek başına ticari hazır oluş değildir.

## Sonraki geliştirme dilimi
Restoran kurulumu geçtiğinde, **admin üzerinden kullanıcı ve restoran personeli yönetimi ile temel sipariş/performans raporları** şartnamedeki en önemli açık ürün işlevleridir. Sadece bildirim işçileri/polling ile sürüm büyütülmeyecek.
