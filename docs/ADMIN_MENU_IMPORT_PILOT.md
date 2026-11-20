# Pilot admin toplu menü aktarma
21 Kasım 2026 | Bismil Sofra v1 ilk 5 restoran kurulumu.

## Kurulum akışı
1. Admin, doğrulanmış ve MFA'sı taze kimlikle /admin'deki kapalı restoran taslağını seçer.
2. Gerçek restoranın izin verdiği menu listesini Excel veya Google Sheets'te **Kategori, Ürün, Açıklama, Fiyat (TL)** sütunlarında düzenler. Tabloyu kopyalayıp aktarım bölümüne yapıştırır.
3. Tarayıcı tüm satırları (1–50) kontrol eder ve **isim/ücret/durum önizlemesi** gösterir. Fiyat TL'den tam sayı kuruşa çevrilir.
4. Onayla aktarılan batch PostgreSQL transaction içinde restoran kaydı kilitlenerek uygulanır. Aynı kategoriler yeniden açılmaz, mevcut ürünler **silinmez**, aynı isimli ürün varsa işlem **tamamen reddedilir**.
5. Ürünler `available=false`, fotoğraf `NULL`, revision=1 ile girilir. Bu ürünler müşteri siparişine **kendiliğinden eklenmez**. Onaylı işletme sahibi /restaurant/manage bölümünde kategorileri, ürünleri, fotoğraf haklarını ve opsiyonları kontrol edip tek tek satışa açar.
6. Aynı işlem anahtarı + aynı içerikle tekrar deneme, tekrar ürün yaratmaz; değişik içerikte anahtar çakışması 409.

## Kasıtlı sınırlar ve güvenlik
- Bu uygulama üçüncü taraf rakip menülerini otomatik kazımaz, izinsiz kullanmaz veya fotoğraflarını indirmez.
- Admin import sadece `active=false` taslak restoran içindir; canlı restoranın menüsünü topluca değiştiremez.
- Ürün sınırı 500/restoran, kategori sınırı 40/restoran, batch sınırı 50 üründür.
- Yeni rol veya gizli admin hesap oluşturma yoktur; kimlik sağlayıcısı MFA, DB platform admin rolü ve 10 dakika taze kimlik gereklidir.
- Transaction + restaurant row lock, tekil `(restaurant_id,import_key)` ve SHA256 payload doğrulaması. Denetim logları yalnız batch ID ve sayıları içerir, ürün isimlerini veya iş iletişimini çoğaltmaz.
- Gerçek menüleri işletme onayı ve doğru lisans olmadan müşterilere göstermeyin.
- İçe aktarma ödeme, fiyat tahsilatı, teslimat süreleri veya restoranın canlı izinlerini değiştirmez.

## Test kanıtları
- Backend satır doğrulama ve tekrarlı kategori/ürün testleri.
- Frontend TSV parsing, Türkçe kuruş, kopyalama hataları testleri.
- Gerçek PostgreSQL+JWT HTTP: taslak import, tekrar deneme, çakışan ürün, aktif restoran ret, eski MFA ve başka kullanıcı reddi, transaction rollback ve audit, mevcut ürünün korunması.
