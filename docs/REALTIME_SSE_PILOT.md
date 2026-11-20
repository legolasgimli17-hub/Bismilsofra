# Bismil Sofra — Şartname madde 10: canlı sipariş akışı
Tarih: 21.11.2026 | Kapsam: geliştirme kodu, henüz saha/cihaz onayı değil.

## Kullanıcı deneyimi
1. Sipariş yaratılınca `order_events` içine append-only satır yazılır. PostgreSQL trigger commit sonrasında `NOTIFY` yayımlar; başarısız/rollback edilmiş transaction sinyal üretmez.
2. Her API işleminde **tek** PostgreSQL `LISTEN` oturumu `bismil_order_events` kanalından yalnız UUID bazlı kiracı sinyali okur. Tarayıcıya UUID/telefon/adres **gönderilmez**; sadece `event: changed\ndata: {}\n\n` yollanır.
3. Restoranın `/v1/restaurant/:rid/events` bağlantısı **Bearer + doğrulanmış e-posta + MFA + restaurant_staff:view** olmadan açılmaz. Müşteri `/v1/me/orders/:id/events` bağlantısını yalnız kendi siparişinde açabilir. Personel hesabı kapatılmış ya da rolü geri alınmışsa sonraki olay öncesi DB üzerinden tekrar doğrulanır; stream kapatılır.
4. Tarayıcı tarafı EventSource değildir; `fetch` içinde Authorization header kullanır. Token adres çubuğuna veya loglanabilen URL parametresine konulmaz. Her **45 saniyede** bağlantı kapatılır; yeniden bağlanma yeni JWT alır.
5. SSE bağlantısı olmadığında **mevcut 7 saniyelik restoran**, 10 saniyelik müşteri HTTP eşitlemesi çalışır. SSE çalışırken de düzenli tam snapshot alınır. İlk bağlantıda, her yeniden bağlanmada ve sekmenin tekrar görünür olmasında sunucu durumu tekrar sorgulanır. NOTIFY dayanıklı bir kuyruk değildir; kaybolan olaylar snapshot ile düzeltilir.
6. Sesli uyarı kullanıcı butona basmadan açılmaz. Kabul bekleyen sipariş varsa **yaklaşık 11 saniyede bir**, yalnız görünür ve güncel REST snapshot olan sekmede çalar; onay/ret/süre dolduğunda durur. İlk gelişte de ses çalar. Görselde bekleyen sipariş sayısı ve **ses kapalı** uyarısı kalıcıdır.
7. Dar ekranlarda sipariş kabul/ret düğmeleri en az 54px yüksek; 370px altında tek sütun.

## Gereken dağıtım doğrulamaları
- `ORDER_EVENTS_LISTEN_DATABASE_URL` ile transaction pooler yerine **direct/session-capable** PostgreSQL. Transaction pooler üstünden LISTEN geçerli değildir. Ayrı bir uzun yaşayan PostgreSQL connection (API replika başına 1) kullanılır; yalnız HTTPS ile erişilen uzun yaşayan Node API sürecinde çalışmalıdır.
- Reverse proxy `text/event-stream` için buffering kapalı, kısa idle timeout uygulanmamalı, CORS yalnız güvenilir origin. 15 saniyelik heartbeat var.
- Tarayıcı arka planda, ekran kilitliyken veya işletim sistemi enerji tasarrufundayken ses ve fetch devamlılığı **garanti değildir**. Gerçek **birincil + bağımsız ikincil uyarı kanalı** ve restoranın telefon/tablet saha denemesi olmadan gerçek müşteriye açılmamalı.
- Canlı performans/kapasite testi: 5 restoran, 10–20 açık SSE istemcisi, çoklu API replika, network drop, DB listener failover; p95 gecikme ve bağlantı kullanımını ölç.
- JWT imza doğrulama Auth0 gerçek tenant ile uçtan uca sınanmalı. Testin imzalı yerel JWT/JWKS'i prod konfigürasyon kanıtı değildir.
- Bildirim sağlayıcısına teslim edilme telefonun gerçekten çalması demek değildir.
- SSE sinyali müşteri/ürün PII'si taşımadığı için değişiklik sonrası her yetkili istemci **yetkilendirilmiş HTTP snapshot** okur.

## Kontrol listesi
- [x] İmzalı JWT + MFA + kiracı / müşteri order ownership kontrolü
- [x] Migration ile transactional NOTIFY, tek paylaşılan DB listener
- [x] PII'siz SSE invalidation, kısa token ömrü ve yeniden bağlanma
- [x] Kesintide HTTP polling, ilk/geri dönüşte full reconciliation
- [x] Onay beklerken isteğe bağlı tekrarlayan ses ve mobil büyük butonlar
- [ ] Canlı Auth0, direct DB session ve TLS üstünde gerçek servis dağıtımı
- [ ] Bağımsız birincil/ikincil SMS/push/telefon alarm servisleri
- [ ] Android/iOS/tablet kilit/uyku/tarayıcı kesilmesi saha testleri
- [ ] 5 gerçek restoranda siparişin kayıpsız yakalandığına dair ölçüm
