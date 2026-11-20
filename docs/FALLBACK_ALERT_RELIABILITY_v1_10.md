# Bismil Sofra v1.10 — İkincil sipariş alarmı kilit ve kesinti güvenliği

**Kapsam:** Halka açık restoran uygulaması değil, mevcut Bismil Sofra uygulamasının sipariş bildirim güvenilirliği. En fazla 50 aktif restoran ve başlangıçta 5 restoranla pilot.

## Kapattığımız darboğaz
Eskiden bağımsız uyarı sağlayıcısına 3 saniyelik HTTPS POST gönderilirken PostgreSQL transaction ve satır kilidi tutuluyordu. Bu düşük bağlantılı tabletlerle ve iki worker aynı anda çalışırken gereksiz gecikme yaratırdı.

- `009_escalation_leases.sql`: her `restaurant_escalations` kaydı için rastgele `lease_token`, 30 saniyelik `lease_until` ve tutarlılık kısıtı.
- Worker kısa ve atomik bir `FOR UPDATE SKIP LOCKED` sorgusuyla bir kaydı alır; commit bittikten sonra **HTTP çağrısına geçer**.
- Eski worker başka worker tarafından yeniden alınan kaydı teslim edilmiş olarak işaretleyemez (fencing token).
- Başarılı kayıtlar `sent_at`; bitmiş siparişler `cancelled_at`; geçici sağlayıcı hataları yeniden deneme; 6 başarısız denemeden sonra `dead_at`.
- Sağlayıcı hata mesajı veritabanına yazılmaz; yalnızca `DELIVERY_FAILED`.
- Teslimattan hemen önce siparişin hâlâ `beklemede` olup olmadığı tekrar sorgulanır.

## Kanıt ve sınırlar
Gerçek PostgreSQL CI testi tek bağlantılı pool'da webhook sürerken DB sorgusunun tamamlanabildiğini, iki worker'ın aynı olayı aynı anda almamasını, lease'in süresi dolduğunda kurtarmayı ve kabul edilen siparişlerin uyarısını iptal etmeyi denetler. Birim testleri sağlayıcı hatası/backoff, izinli payload ve eski worker fencing kontrolünü içerir.

**At-least-once teslimat:** Provider HTTP yanıtından sonra worker çökerse aynı `x-sofra-event-id` tekrar gönderilebilir. Alıcı bu ID'yi kalıcı olarak tekilleştirmelidir. Sipariş, sorgulandıktan milisaniyeler sonra kabul edilebilir; çok nadiren geç kalmış uyarı gidebilir. Alıcı mesajı göstermeden önce siparişin güncel durumunu güvenli API üzerinden doğrulamalıdır. Bu kod exactly-once veya bir kişinin telefonu duyduğunu garanti etmez.

**Hâlâ P0:** Canlı Auth0, gerçek iki farklı bildirim sağlayıcısı, HTTPS staging ve gerçek 5 restoran/tablet/telefon kesinti provası. Yayına alınmadan önce bu testler şarttır.
