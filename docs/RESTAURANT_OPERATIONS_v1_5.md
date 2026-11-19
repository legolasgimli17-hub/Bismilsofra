# Bismil Sofra v1.5 — Restoran operasyon yönetimi

**Uygulama yolu:** `/restaurant/manage` (müşteriler değil, MFA'lı restoran personeli). İşletme sipariş panelindeki bağlantı üzerinden açılır.

## Günlük iş akışları
1. **Restoran aç/kapat:** sahibi veya yöneticisi `is_open`, `accepts_orders`, `is_busy` durumlarını değiştirir. Kaydetme, SQL'de `restaurant_id` ve `active=true` koşullarıyla yapılır; işlem `audit_logs` içine eklenir.
2. **Menü satış durumu:** sahibi, yöneticisi veya açık `can_manage_menu` yetkisi verilen çalışan, yalnızca kendi restoranındaki ürünün satışını açıp kapatır. Fiyatlar yalnızca sunucudan okunur; bu sürümde keyfî fiyat değiştirme yoktur. Ürün görseli eksikse uygulama bunu açıkça gösterir.
3. **Çalışma saatleri:** sahibi veya yöneticisi, yedi günlük takvimi aynı işlemde kaydeder. Saat biçimi `HH:MM`, günler `0=Pazar … 6=Cumartesi`. Günde en fazla üç çalışma aralığı, toplam 21 aralık desteklenir. Gece yarısını aşan aralıkların çakışması, pazar → pazartesi sınırı dâhil, reddedilir.
4. **Teslimat mahalleleri:** sahibi/yöneticisi ancak daha önce restoranına atanmış mahalleyi açıp kapatır ve minimum sepet/teslimat ücretini TL olarak düzenler. Tarayıcı girdisi tam sayı **kuruş** değerine dönüştürülür ve sunucuda tekrar doğrulanır. Fiyat değişirse müşteri son onayda yeni toplamı kabul etmelidir.
5. **Yetki ve müşteri bilgileri:** GET management cevabı siparişlerin müşteri adı, açık adresi, telefonunu içermez. İşletme sipariş detaylarını yetkiyle ayrı endpoint'ten görebilir.

## API
- `GET /v1/restaurant/:rid/management` — `can_manage_menu` yetkisi veya sahibi/yönetici, MFA gerekli.
- `PATCH /v1/restaurant/:rid/availability` — sahibi/yönetici, üç boolean alan.
- `PATCH /v1/restaurant/:rid/products/:pid` — `menu` yetkisi, `available` boolean.
- `PUT /v1/restaurant/:rid/hours` — sahibi/yönetici, `slots: [{dayOfWeek,openTime,closeTime}]`, transaction+audit.
- `PATCH /v1/restaurant/:rid/zones/:zid` — sahibi/yönetici, `{enabled,minBasketKurus,deliveryFeeKurus}`, transaction+audit.

Üretime açılmadan önce gerçek Auth0 sağlayıcısı ve 5 pilot restoranla gerçek işletme yetki atama, menü verisi, arayüz, internet kesintisi ve mobil tarayıcı testleri gerekir. Henüz fotoğraf yükleme API'si, ürün fiyat düzenleme, yeni restoran tanımlama ve satış raporları **tamamlanmadı**.

Bu sürüm Bismil'e özeldir; **en fazla 50 aktif restoran**, pilotta 5 restoran; kapıda nakit/POS ve restoran kuryesi sınırları korunur. Çevrim içi ödeme ve bağımsız kurye filosu eklenmez.
