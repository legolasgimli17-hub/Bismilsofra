# Bismil Sofra v1.8 — Ürün seçenekleri, ekstra malzemeler ve fiyat kuralları

## Kullanım
Restoran sahibi, yönetici veya `can_manage_menu` izni verilmiş MFA'lı çalışan `/restaurant/manage` sayfasındaki ürününü açar. Ürün düzenleme formunun altında **Seçenekler ve ekstra malzemeler** paneli görünür.

1. Grup ekler: ör. **Ekstra malzemeler**, **İçecek seçimi**, **Acı seviyesi**. Her grup başlangıçta `minSelect=0,maxSelect=1` ile isteğe bağlı oluşturulur.
2. Gruba ekstra seçenekler ekler: ör. **Ekstra kaşar +25,00 TL**, **Sos +0,00 TL**.
3. Grup ayarlarında minimum/maksimum seçim sayısını `0…12` arasında düzenler. Müşterinin zorunlu seçim yapabilmesi için yeterli sayıda **satışta** seçenek olmalıdır.
4. Satışa kapatılan bir seçenek yeni siparişlerde kullanılamaz. Zorunlu grubun son seçeneğinin devre dışı bırakılması engellenir.
5. İstenmeyen grubu **pasif** yapar; yeni müşteri menüsünde gizlenir. Pasif grup veritabanından silinmez ve daha sonra yeniden açılabilir. Geçmiş sipariş verileri korunur.

## Güvenlik
- Tüm API uç noktalarında imzalı kullanıcı tokenı, restoran bazlı `menu` yetkisi ve MFA doğrulanır.
- Grup sayısı **en fazla 8/ürün**, seçenek sayısı **en fazla 12/grup**; isim, ücret, seçim sınırları ve Türkçe harfler sunucuda doğrulanır.
- `007_product_options_editor.sql` mevcut grup/opsiyonlara `revision` alanları ve grup için `archived` alanı ekler.
- Aynı kayda iki çalışanın müdahalesinde eski `revision` değeriyle yapılan işlem 409 `OPTION_CONFLICT` ile reddedilir.
- Ürün/opsiyon fiyatları **tam sayı kuruş** ile sunucuda saklanır; müşteri fiyatı kontrol edemez.
- Siparişin son tutarı sunucuda yeniden hesaplanır. Opsiyon fiyatı veya satış durumu değişmişse eski sepet otomatik onaylanmaz; müşteri güncel fiyatı yeniden onaylar.
- Eski siparişler `order_items.options_snapshot` alanını korur; menü düzenlemesi geçmiş siparişe yansımaz.

## API
- `GET /v1/restaurant/:rid/products/:pid/option-groups` — gruplar ve seçenekler, pasif olanlar dahil.
- `POST /v1/restaurant/:rid/products/:pid/option-groups` — yeni isteğe bağlı grup (`{name}`).
- `PATCH /v1/restaurant/:rid/products/:pid/option-groups/:gid` — `{name,minSelect,maxSelect,archived,revision}`.
- `POST /v1/restaurant/:rid/products/:pid/option-groups/:gid/options` — `{name,priceKurus}`.
- `PATCH /v1/restaurant/:rid/products/:pid/option-groups/:gid/options/:oid` — `{name,priceKurus,available,revision}`.

Aynı restoran sınırı doğrulanır ve bütün mutasyonlar `audit_logs` tablosuna kaydedilir. Yeni seçenekler etkin oluşturulur; ilk grup isteğe bağlı olduğundan ürünün siparişe açılmasını engellemez.

## Pilot öncesi ve bilinçli sınırlar
- Bu sürümde seçenekler kalıcı olarak silinmez; satışa kapatma ve grup pasifleştirme kullanılır.
- `minSelect=0,maxSelect=1` başlangıç ayarları sonradan düzenlenir; işletme bütün grupları kontrol etmeden müşteriye açmamalı.
- **Gerçek Auth0**, gerçek fotoğraf CDN depolaması, restoran bildirimi sağlayıcıları ve mobil gerçek cihaz testleri henüz tamamlanmadı.
- Şartname korunur: Bismil'de 5 restoran pilotu; en fazla 50 aktif restoran; kapıda nakit/POS ve restoranın kendi kuryesi.

## Bağımsız ürün kontrol listesi
- Seçenek adlarının mobil ekranda rahat okunması, fiyatın yanlış anlaşılmaması ve zorunlu seçimin belirgin olması.
- Müşteri önce eski opsiyonu sepete koyup işletme bunu pasife aldığında, ödeme adımında anlaşılır yeniden seçim uyarısı.
- Sadece kendi ürünlerinin seçeneklerini gören işletme hesabı ve farklı restoranın endpoint'ini deneme.
- Restoran menüsünün yavaş bağlantıda yeniden yüklenmesi, aynı seçenek için eşzamanlı düzenlemeler, güncel fiyat onayı.

## v1.8 ekran sağlamlaştırma — müşteri ve restoran paneli
- İsteğe bağlı tek seçimli gruplarda müşteri seçimi **“Seçim istemiyorum”** ile temizleyebilir; zorunlu gruplarda bu seçenek yoktur.
- Birden fazla seçenek alınabilen gruplarda üst sınıra ulaşıldığında diğer işaretlenmemiş seçenekler kilitlenir; mevcut seçimler kaldırılabilir.
- Restoran seçenek editöründeki farklı gruplarda veya seçeneklerde kaydedilmemiş düzenlemeler tek bir kaydetme/yeni veri çekme işleminde sessizce silinmez.
- Kaydedilmemiş satırların eski `revision` değeri korunur; başka cihaz değiştirmişse sunucudaki 409 kontrolü atlanmaz. Kullanıcı tüm yerel taslakları açıkça geri alabilir.
- Artık geçersiz/pasif/ürüne ait olmayan seçeneğe bağlı sepet, sunucu fiyat teklifi alırken açıklayıcı hata ve güncel restoran menüsü bağlantısı gösterir.
- Frontend seçenekleri için `npm run test:product-options` CI doğrulamasına eklendi.
