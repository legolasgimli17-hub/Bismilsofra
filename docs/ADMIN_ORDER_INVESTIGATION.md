# Platform yönetimi — Sipariş numarasıyla inceleme
Tarih: 21 Kasım 2026. Kapsam: Bismil Sofra v1 pilot şartnamesindeki admin sipariş arama.

## Yönetici nasıl kullanır?
1. Müşteriden veya restorandan iletilen **ilk 8 hane** ya da tam UUID formatındaki sipariş numarasını `/admin` > **Sipariş inceleme** alanına yaz.
2. Sistem en fazla 5 eşleşme döndürür; kısa numara yalnızca son 180 günü tarar. Tam UUID, eski siparişlerde de kullanılabilir. Sonuçta yalnız restoran, durum, zaman, yöntem, toplam gösterilir.
3. İlgili kaydı **Geçmişi incele** ile açınca sunucu denetim kaydına `admin_order_investigation` olayı ekler; ürünler, tutarlar ve statü geçmişi gelir.
4. Liste/ayrıntı yanıtlarında müşteri adı, e-posta, telefon, adres, adres tarifi veya sipariş notu yoktur. Serbest metin ret/açıklama geçmişi yalnız detayda gösterilir; bu açıklama kişisel bilgi içerebileceğinden dikkatli eriş.
5. İlgili destek talebini aynı yönetici ekranındaki destek yönetiminden ayrıca incele; bu ekran sipariş durumunu geriye çekmez, yeni ödeme/iadeye müdahale etmez.

## Kontroller
- Tüm uçlar imzalı JWT, doğrulanmış e-posta, **son 10 dakika MFA** ve `platform_admins` üyeliği gerektirir.
- Tam eşleşme veya 8 haneli prefix dışı aramalar 400; rastgele alt dize veya toplu listeleme yok.
- Belirli sipariş detayı okununca PII'siz audit eklenir; eksik ID 404.
- Birim testleri / PostgreSQL gerçek HTTP imzalı JWT kontrolü / tenant verisi ve indeksli sipariş kaydı kullanımı CI ile doğrulanır.
- KVKK saklama/silme ve gerçek destek ekibi yetkilendirmeleri ayrı pilot işi.
