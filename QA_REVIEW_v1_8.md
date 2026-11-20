# Bismil Sofra v1.8 — Bağımsız ürün / kod kalitesi değerlendirmesi

## Ne gerçekten geliştirildi?
Restoran menüsünde ürüne bağlı seçenek grupları ve ekstra ücretli seçenekler artık işletme panelinden oluşturulabilir ve düzenlenebilir: grup adı, en az/en çok seçim, pasif/aktif grup, seçeneğin adı, tam sayı kuruş fiyatı ve satış durumu.

Yeni CRUD uç noktaları **MFA + rol + restoran kapsamında** korunur; tüm mutasyonlar `audit_logs` içinde kaydedilir. Gruplar ve seçenekler için `revision` sayesinde sessiz eşzamanlı düzenleme kaybı önlenir. Geçmiş siparişin fiyat/seçenek snapshot'ı silinmez.

## Test kanıtları
- [Başarılı ana kod CI çalışması](https://github.com/legolasgimli17-hub/Bismilsofra/actions/runs/44695370434): v1.8 uygulama kodunda TypeScript, Next.js build, backend/unit ve gerçek HTTP+PostgreSQL testleri başarılı.
- Yeni testler: Türkçe isim normalizasyonu, ekstra ücretlerin tam sayı kuruş olması, seçim sınırı, son zorunlu seçeneğin kapatılamaması ve grupların pasife alınıp geri açılabilmesi.
- Gerçek HTTP testi yeni option grubunu/iki ekstra seçeneği oluşturuyor, min seçim zorunluluğunu test ediyor, pasif seçeneği reddediyor, müşteri menüsü ve quote hesaplamasını kontrol ediyor.
- **Canlı müşteri hesabı, gerçek ödeme/kargo, gerçek restoran cihazı ve gerçek Auth0 tenant bu testin parçası değil.**

## Bağımsız riskler

| Öncelik | Açık eksik / risk | Güvenli tamamlanma yolu |
|---|---|---|
| P0 | Auth0 gerçek ortamda bağlı değil | Müşteri e-posta doğrulama, restoran MFA ve yönetici yetkisi canlı HTTP testleri |
| P0 | Gerçek iki bağımsız işletme bildirim sağlayıcısı bağlı değil | Gelen sipariş ve 4 dakika kabul süresi gerçek telefon/tabletlerle test edilmeli |
| P0 | PostgreSQL üretim sunucusu, yedek/restore ve HTTPS staging yok | Yedek geri yükleme provası, gizli anahtarlar, erişim sınırları, staging siparişi |
| P0 | Fotoğraf API'si çalışıyor fakat gerçek S3/R2 ve CDN hesabı bağlı değil | Kısıtlı bucket/token, HTTPS custom domain, gerçek restoran izinli görselleri |
| P1 | Seçenek gruplarında kalıcı silme yok, yalnızca arşivleme var | Önce işletme geri alma/geri yükleme deneyimini sahada doğrula |
| P1 | Müşteri sepetinde eski/pasif seçeneğin neden geçersiz kaldığı daha iyi açıklanmalı | Checkout hata kodu ile kullanıcıya yeniden seçim rehberi |
| P1 | Tablet/telefon ve erişilebilirlik testi yapılmadı | 320–430px, Android/iOS, klavye, ekran okuyucu ve yavaş ağ |
| P1 | Fiziksel restoranların özel menü opsiyonlarını kim girip yönetecek? | 5 gerçek işletme pilotu, ürün seçeneklerini gerçek menüyle karşılaştırma |
| P1 | Webhook işçileri ağ çağrısı boyunca DB bağlantı kilidi tutuyor | Nonblocking lease/outbox işçi tasarımının ayrı performans testi |

## Şartname ve ürün disiplini
Bismil'e özel platform, 5 restoran pilotu, en fazla **50 aktif restoran**, kapıda nakit veya restoran POS'u, restoranın kendi kuryesi. Platform içi online ödeme ve bağımsız kurye filosu açılmadı.

**Tarafsız sonuç:** Restaurant paneli artık gerçek menü yönetimi bakımından daha işlevsel. Ancak Yemeksepeti ve Trendyol Go seviyesinde canlı hizmet güvenilirliği/görsel kalite olduğu iddia edilemez; sağlayıcılar ve saha denemeleri devam etmeli.
