# Bismil Sofra — Bağımsız ürün kalite denetimi v1.6

## Mevcut durum
Gerçek Next.js/React ve Fastify/PostgreSQL uygulaması geliştiriliyor. Bu turdaki önemli değişiklik `/restaurant/manage` sayfasında kullanıcıya sunulan menü düzenleme deneyimi.

### Tamamlananlar
- Kategori ekleme/yeniden adlandırma ve menü ürünlerini ekleme/düzenleme.
- Yeni ürünün siparişe açılmadan önce `available=false` olarak kaydedilmesi.
- Ürün fiyatları için gerçek kuruş hesabı ve geçmiş siparişin fiyat snapshot'ını koruma.
- Yetki ve restoran ayrımı; aynı ürüne eşzamanlı müdahalede sürüm çakışmasının 409 ile belirtilmesi.
- Güvenilmeyen rastgele uzaktaki fotoğrafları gerçek ürün görseli olarak kabul etmeme.
- Mobil uyumlu form, ürün önizlemesi, doğrulama ve anlaşılır hata mesajları.

### Uçtan uca test sınırı
- Otomatik test: Node.js birim testleri ve CI'daki gerçek PostgreSQL, JWT üzerinden HTTP uç noktaları.
- Test edilen durumlar: yetkisiz ürün oluşturmanın reddi, yanlış kategori, ürün taslağının satışa kapalı oluşması, fiyat ve açıklamanın değişmesi, eski sürümle yazmanın reddi, eski sipariş fiyatının değişmemesi.
- CI kontrolü başarıyla tamamlanmışsa kaynak kod derlenebilir; **bu fiziksel mobil cihaz ve canlı Auth0 testi değildir**.

### Kalan önemli kusurlar
- **P0:** Gerçek Auth0 tenant + e-posta doğrulama + restoran MFA saha testi.
- **P0:** Gerçek bağımsız push/SMS/çağrı kanalı ile kabul edilmeyen sipariş bildirim provası.
- **P0:** Prod veritabanı, yedek/restore, HTTPS ve izleme.
- **P1:** Yetkili fotoğraf dosyası yükleme hizmeti; dosya imzası, boyut, içerik ve depolama kontrolü. Bu sürüm yalnızca güvenilir URL bilgisini tutar.
- **P1:** Menü seçenek gruplarını/esnek ek ürünleri restoranın kendisinin düzenleyebilmesi. Mevcut ürünlerin opsiyonları korunur ama editör bunları henüz değiştirmez.
- **P1:** Gerçek restoranların fotoğraf ve ürün doğruluğunu yerinde kontrol; 320–430 piksel cihazlarda profesyonel kullanım testleri.
- **P1:** Gelişmiş stok/adet limitleri, sınırlı ürün/saat bazlı kampanyalar. Şartname izni ve pilot ihtiyacı olmadan kapsam büyütülmeyecek.

### Bağımsız yaklaşım
Yemeksepeti veya Trendyol Go'nun özel kaynak kodu kullanılmıyor. Kamuya açık deneyimleri ile kıyaslanan ölçütler: ürün fotoğrafları, hızlı ürün ekleme, kategori, stok, işlem güvenilirliği, bağlantı kesintisi ve erişilebilir mobil tasarım.

**Sonuç:** Ürünü her işlem için geliştirici çağırmaktan çıkarma yönünde ilerleme var. Ancak gerçek fotoğraf yüklemesi ve canlı bildirim/kimlik sağlayıcısı tamamlanmadan uygulamayı yayına hazır olarak değerlendirmek yanlış olur.
