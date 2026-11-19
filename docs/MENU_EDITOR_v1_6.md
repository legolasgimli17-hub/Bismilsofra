# Bismil Sofra v1.6 — Gerçek restoran menü düzenleyicisi

## Bu aşamada tamamlanan somut uygulama
MFA ile giriş yapmış, yetkili restoran sahibi/yöneticisi veya `can_manage_menu` verilmiş çalışan; `/restaurant/manage` sayfasında:
- Kategori oluşturur, kategoriyi yeniden adlandırır. Her restorana en fazla 40 kategori; aynı kategorinin Türkçe büyük/küçük harf farklı tekrarları reddedilir.
- Ürün adı, açıklaması, fiyatı, kategori ve onaylı fotoğraf adresi belirleyerek **yeni taslak ürün** oluşturur. Taslak varsayılan `available=false` olur, işletme ayrıca satışa açar. Her restoranda en fazla 500 ürün.
- Mevcut ürünün bilgi/fiyat/fotoğraf/kategori alanlarını düzenler. Sunucudaki `revision` ile aynı ürünün eşzamanlı düzenlemelerindeki veri kaybı 409 `PRODUCT_CONFLICT` olarak reddedilir.
- Ürünün satışa açık durumunu değiştirir. Bu işlem detay güncellemesinden ayrıdır.
- Müşteriye yansıyacak yeni fiyat her sipariş anında sunucuda yeniden hesaplanır. Önceki siparişin ürün/fiyat `order_items` snapshot'ı değişmez.

## Güvenlik ve sınırlar
- Bütün API istekleri gerçek JWT (issuer, audience, süre, imza) ve personel MFA / `menu` yetki kontrolüne tabidir.
- `restaurant_id` sorgularda zorunlu; ürün ve kategori başka bir restoranın kaydına bağlanamaz.
- Kategori oluşturma ve ürün kontenjanı transaction içindeki restoran satır kilidiyle yönetilir. Ürün güncellemesinde optimistic concurrency uygulanır.
- Bütün değişikliklerde aktörün ID'si, işlem ve hedef ID'si `audit_logs` tablosuna yazılır; müşteri PII'si menü kayıtlarına eklenmez.
- Fiyat **tam sayı kuruş** olarak saklanır; arayüzdeki 149,90 TL biçimi yanlışlıkla ondalık/küsurat hesap hatasına dönüştürülmez.
- Ürün fotoğrafı ya `/photos/...webp` gibi uygulamanın önceden eklenmiş lisanslı dosyası ya da `PUBLIC_IMAGE_CDN_HOST` ile güvenilirliği belirlenmiş **kendi** HTTPS CDN'i olmalıdır. `NEXT_PUBLIC_IMAGE_CDN_HOST` aynı hostu istemcide tanımlar.
- `/photos/...` referansı tek başına dosyanın mevcut olduğuna dair kanıt değildir. Bu sürüm **web arayüzünden fotoğraf yükleme yapmaz**; üretim görsel depolaması ve işletme izin kayıtları ayrıca gerekir.

## API
- `GET /v1/restaurant/:rid/management` kategorileri, ürünlerin `revision` değerlerini ve çalışma/teslimat bilgilerini döndürür.
- `POST /v1/restaurant/:rid/categories` — `{name}`, yeni kategori.
- `PATCH /v1/restaurant/:rid/categories/:cid` — `{name}`, kategorinin adı.
- `POST /v1/restaurant/:rid/products` — `{categoryId,name,description,priceKurus,imageUrl}` yeni satışa kapalı taslak.
- `PATCH /v1/restaurant/:rid/products/:pid/details` — tüm ürün detayları + zorunlu `revision`, veri çakışmasında 409.
- `PATCH /v1/restaurant/:rid/products/:pid` — `{available}`, mevcut satışa aç/kapat.

## Sürüm geçişi ve doğrulama
- Önce `005_product_revisions.sql` checksum doğrulamalı migration ile uygulanmalı. API migration yoksa başlamaz.
- Yeni REST endpoint'leri gerçek PostgreSQL 17 ve imzalı JWT'lerle HTTP entegrasyon testine dahil edildi.
- Sahnede gerçek Auth0 tenant, canlı menü fotoğraf depolaması, fiziksel restoran/tablet testleri ve gerçek alıcı push/SMS bağlantısı olmadığı sürece 5 restoranlık pilot halka açılmaz.
- Şartname korunur: Bismil, 5 restoran pilotu, en fazla 50 aktif restoran, yalnızca kapıda nakit/POS ve restoranın kendi kuryesi.
