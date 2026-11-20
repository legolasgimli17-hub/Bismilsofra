# Pilot raporları — tanımlar, kapsam ve kontrol listesi
20 Kasım 2026, Bismil Sofra v1 pilot şartnamesi

## Çalışan özellikler
- Yönetici ekranında tüm platform ve restoran bazında; işletme sahibi/yöneticisi kendi restoranında 7 veya 30 günlük günlük sipariş raporlarını görür.
- Dönem günleri `Europe/Istanbul` yerel tarihine göre belirlenir; boş günler sıfır satırı ile gelir.
- `orders` oluşturulan, `accepted` `accepted_at IS NOT NULL`, `delivered` restoranın teslim edildi statüsü, `expired` kabul süresi aşımı, `cancelled` müşteri/restoran iptali, `rejected` doğrudan ret, `delivery_failed` teslim edilemedi statüsü.
- Ortalama kabul zamanı yalnız `accepted_at` kaydı olan siparişlerde, `accepted_at - created_at` saniye ortalamasıdır.
- Tekrar sipariş müşterisi seçili dönem ve scope içinde `>=2` sipariş oluşturmuş tekil müşteri sayısıdır. Geçmiş toplam müşteri sadakati anlamına gelmez.
- `delivered_total_kurus` yalnızca `teslim_edildi` durumundaki siparişlerin toplamıdır. **Tahsilat doğrulaması, net restoran kazancı, platform komisyonu veya banka/vergisel gelir kanıtı değildir.** Gerçek para bu uygulama üzerinden tahsil edilmez.
- Report endpoints PII döndürmez (telefon, e-posta, sipariş ID, müşteri ID, adres veya not). Tek müşteri seviyesinde liste yoktur.
- Merchant raporu için imzalı MFA + owner/manager; admin raporu için geçerli son 10 dakika MFA + platform_admins gereklidir.

## Biten/bekleyen
- Backend SQL ve UI, gerçek PostgreSQL 17/JWT auth testlerinden geçmeden birleştirilemez.
- Kullanıcı ziyaret → sepete ekleme → sipariş dönüşüm hunisi henüz yoktur; izinli analitik gerektirir, rakam uydurulmaz.
- Kontrat/komisyon tarifeleri, fatura, banka mutabakatı, iadeler ve tahsilat doğrulaması henüz yoktur.
- Fiziksel cihaz ve 5 gerçek restoran 2–4 hafta pilotu yapılmadı; rapor metrikleri pilot sonuçları olarak sunulamaz.
