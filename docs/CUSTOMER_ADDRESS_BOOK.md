# Müşteri adres defteri ve sipariş geçmişinin korunması
21 Kasım 2026, Bismil Sofra v1 şartname müşteri hesabı/checkout.

## Müşteri akışı
- `/account` altında doğrulanmış müşteri kendi kayıtlı adreslerini listeler; yeni adres ekler, mahalle, başlık, telefon, sokak/daire ve adres tarifi düzenleyebilir.
- Sadece kendi kaydını değiştirebilir: `PATCH /v1/me/addresses/:id`. Başkasının veya arşivlenmiş bir adresin ID'si hiçbir veri sızdırmadan 404 döner.
- `POST /v1/me/addresses/:id/archive` fiziksel silme yapmaz: `archived_at` kaydı girer; adres sonraki kullanıcı listesinde görünmez.
- Arşivlenen adresle yeni checkout / quote gönderilemez: `orders` transaction içindeki kesin adres kontrolü `a.archived_at IS NULL` ister.
- Mevcut `orders.address_snapshot` (tarihsel adres) **değiştirilmez**. Daha önce hazırlanmış sipariş ürünleri/teslimat bilgileri etkilenmez. Arşivleme bu geçmişi silme/KVKK silme talebi değildir.
- Müşterinin adres bilgileri yalnız kendi kimliğine bağlı GET yanıtındadır. `audit_logs` yalnız adres ID ve eylemi saklar; telefon/sokak/not loglanmaz.
- En çok 30 aktif adres/hesap; kapatılanları tekrar ekleme yerine yeni adres oluşturulabilir.
- `/checkout` ekranından `Kayıtlı adreslerini düzenle veya kaldır` bağlantısı `/account` sayfasına gider.

## Geliştirme doğrulaması
- Backend adres alanı validasyonu (telefon 05... 11 rakam, mahalle etkin, başlık 45, açıklama 900, teslimat tarifi 400).
- İmzalı JWT + gerçek PostgreSQL HTTP: farklı müşteri erişimi reddi, edit sonrası mevcut sipariş snapshot'ının aynı kalması, archive sonrası liste ve quote/checkout ret, audit gizliliği.
- Mobil: dar ekranda tek sütun alanlar ve minimum 44px butonlar. Gerçek iOS/Android/touch klavye testi hâlâ saha işi.

## Henüz yapılmayan
- KVKK anonimleştirme, veri taşınabilirliği ve yasal saklama süresi/gerçek hesap silme iş akışları ayrıca planlanmalı.
- Harita tabanlı coğrafi adres otomatik doğrulama, kurye anlık konum takibi ve kartla ödeme v1 pilot kapsamında değildir.
