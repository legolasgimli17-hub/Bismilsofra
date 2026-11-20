# Bismil Sofra v2.3 — Destek operasyonları

## Akış
1. Müşteri kendi siparişine bağlı `POST /v1/me/support-cases` ile talep açar. DB'deki müşteri/sipariş composite FK başka kişilerin siparişine talep bağlamayı engeller.
2. Müşteri `GET /v1/me/support-cases` üzerinden yalnızca kendi taleplerini görür. Siparişlerim sayfasında isteğe bağlı “Taleplerimi getir” düğmesi ile güncel durumu sorgular.
3. Yöneticiler sadece gerçek `platform_admins` kaydı ve son 10 dakikada tamamlanmış MFA ile `GET /v1/admin/support-cases` erişimi alır. Liste telefon, adres, müşteri e-postası veya talep serbest metnini içermez.
4. Yalnızca yöneticinin tıkladığı kayıt için `GET /v1/admin/support-cases/:id` müşteri açıklamasını döner.
5. `POST /v1/admin/support-cases/:id/status` `{expectedStatus,to}` ister. Eski durum eşleşmezse 409; geçiş yasaksa 409. Aynı veritabanı transaction'ında audit kaydı eklenir.

## İzin verilen durumlar
- `acik` → `incelemede` veya `cozuldu`
- `incelemede` → `cozuldu`
- `cozuldu` → `incelemede` (yeniden inceleme) veya `kapandi`
- `kapandi` → terminal, tekrar açılamaz

## Sınırlar
- Bu sürüm destek talebini **gerçekten yönetilebilir** hale getirir; gerçek bir destek çalışanının olduğunu veya müşteriye otomatik yanıt gittiğini söylemez.
- Durum güncellemesi SMS/push, para iadesi ya da restorandan ücret kesintisi başlatmaz.
- Yönetici ekranında telefon/açık adres çıkmaz; açıklama kullanıcı tarafından serbest yazıldığı için kişisel bilgi içerebilir. MFA ve yetki kontrolü bu nedenle zorunludur.
- Testler müşteri/kötü aktör izolasyonu, MFA eskimesi, açıklama ayrımı, çakışma kontrolü ve append-only audit'i doğrular.
- KVKK saklama/silme ve operatör prosedürleri, gerçek destek iletişim hattı, olay alarmı ve politika işletim planı henüz canlı uygulamaya alınmadı.

Proje kapsamı değişmedi: Bismil, beş restoranlık pilot ve en fazla 50 aktif restoran, restoranın kendi kuryesi, kapıda nakit / restoran POS.
