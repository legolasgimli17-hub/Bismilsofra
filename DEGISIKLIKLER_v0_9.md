# Bismil Sofra v0.9 — Şartnameye göre geliştirilenler

Bu sürüm v0.8'in Next.js + React müşteri uygulaması ve Fastify + PostgreSQL backend mimarisini değiştirmeden geliştirildi.

## Yapılan kod değişiklikleri

1. Restoran panelinde `beklemede` siparişleri ile `kabul_edildi`, `hazirlaniyor`, `hazir`, `yolda` durumundaki siparişler farklı sütunlara ayrıldı.
2. Backend'deki restoran gelen kutusu artık `pending` ve `active` listelerini sunuyor. Her iki liste 200 öğeyle sınırlanıyor; sınır aşımı açıkça gösteriliyor.
3. Her yedi saniyede çekilen özet, **adres ve telefon gibi hassas verileri içermiyor**. Bunlar ancak yetkili personel ayrıntıyı açtığında yeni `GET /v1/restaurant/:rid/orders/:id` uç noktasından alınıyor.
4. Yeni ayrıntı uç noktası restoran kimliğini ve personelin sipariş görüntüleme yetkisini doğruluyor. Aynı restoranın ürün ve seçenek snapshot'ları, adres, not ve durum olayları görüntülenebiliyor.
5. Tam restoran iş akışı arayüze eklendi: kabul et, gerekçeyle reddet, hazırlamaya başla, hazır işaretle, kuryeye teslim et, teslim edildi veya gerekçeyle edilemedi işaretle. İptal kararları da gerekçe istiyor.
6. Yalnızca görüntüleme yetkisi olan personelin işlem butonları kullanılamıyor. Bağlantı tazeliği yitirildiğinde işlemler devre dışı kalıyor. **Nihai yetkilendirme ve iş kuralları yine backend'de.**
7. `merchant-workflow.ts` modülüne 13 yeni test eklendi. Bunlardan biri arayüzdeki tüm durum adımlarını backend'in gerçek durum makinesiyle karşılaştırıyor.
8. GitHub Actions'a yeni testler ve TypeScript kontrolü eklendi.

## Bilinçli olarak eklenmeyenler

- Ödeme altyapısı / online kredi kartı tahsilatı
- Ayrı kurye ağı ve kurye mobil uygulaması
- Kupon/puan/yorum özellikleri
- 50 üstünde restoran kapasitesi

## Tamamlanmamış kritik noktalar

- Gerçek kimlik sağlayıcısı ve PostgreSQL bağlantısıyla canlı uçtan uca test
- Push / SMS / yedek alarm kanalı; güvenilir sipariş teslim bildirimi
- Kayıtlı işletmelerin kendi menülerini yönetmesi ve gerçek fotoğrafları yükleyebilmesi
- Üretim performans, erişilebilirlik, güvenlik ve yedek geri yükleme testleri
- GitHub deposunun açılması ve oraya gerçek commit; üretim build

**Bu sürüm bir ürün geliştirme kaynağıdır, pilotta gerçek sipariş almak için henüz yeterli değildir.**
