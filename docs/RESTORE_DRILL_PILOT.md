# PostgreSQL yedekleme ve kurtarma — pilot kalite kapısı
Tarih: 21 Kasım 2026.

## Bu PR'ın otomatik olarak doğruladığı
`integration-postgres` test job'ı artık sadece migration + order/JWT/SSE senaryolarını çalıştırmıyor. Aynı PostgreSQL **17.6** test konteynerinde:
1. Yalnızca `bismil_sofra_test` üzerinde migrasyonlar ve kurgu müşteri/restoran/sipariş olayları işlenir.
2. PostgreSQL 17'nin kendi `pg_dump -Fc` aracıyla test veritabanı **container'ın geçici diski** üzerine yedeklenir; dump bir GitHub artifact'i değildir.
3. Farklı `bismil_sofra_restore_test` veritabanı sıfırdan oluşturulur; `pg_restore --exit-on-error` ile geri yüklenir.
4. **15 veri tablosu** satır sayısı, sipariş ID/durum/tutar özeti, ürün seçeneği ve adres snapshot hash'i, immutable order_events geçmişi ve migration SHA256 kayıtları karşılaştırılır.
5. `order_events_append_only`, `audit_append_only` ve gerçek-zamanlı `order_event_signal` trigger'ları geri yüklemede korunmalıdır.
6. Test veritabanındaki her siparişin en az bir append-only olay kaydı kaldığı doğrulanır.
7. Bir tutarsızlıkta CI başarısız olur; hiçbir gerçek müşteri/üretim verisi kullanılmaz.

## Asla yapılmayanlar
- Üretim veritabanına `DROP`, seed, restore veya destructive işlem yapılmaz.
- Kalıcı yedek, uzak storage, günlük planlama ve retention **henüz kurulmaz**; bu PR yalnızca **kurtarma araçlarının ve veri bütünlüğü karşılaştırmasının testte çalıştığını** kanıtlar.
- CI fixture'ında yer alan kurgu PII örnekleri loglanmaz ya da üçüncü tarafa arşivlenmez.
- Kişisel veriler için yasal saklama/aydınlatma/silme politikası buradaki teknik testin yerine geçmez.

## Canlı pilot öncesi yapılması gerekenler
- Yönetilen PG provider ile şifreli, günlük **otomatik** snapshot/PITR ve gerçek dış depolama politikası; restore için ayrı staging DB.
- Her ay (ve büyük migration öncesi) örnek canlıya benzer anonim/izinli veriyle staging restore ve **kayıt kaybı olmaması** kontrolü. RPO/RTO ölçülmeli; ölçülmediyse vaat edilmez.
- Yedek erişim yetkileri ayrı kısıtlanmalı; anahtarlar .env/secret manager'da; restore audit ve operatör onayı.
- Çalışan üretim DB'sine hiçbir zaman bu CI komutlarını çalıştırma: kullanımı yerel `*_test` ile sınırlı.
