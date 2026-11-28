# Bismil Sofra — şifreli yedekleme ve geri yükleme kapısı

## Bu PR'da kanıtlananlar
- Veritabanı test verisi, gerçek PostgreSQL 17 pg_dump akışından AES-256-GCM ile şifreli dosyaya aktarılır. pg_dump işlemi şifrelenmeden önce runner diskine düz metin dosya bırakmaz.
- GCM başlık doğrulaması, her dosya için yeni 12 bayt IV, 128 bit doğrulama etiketi ve 32 bayt anahtar kullanılır. Çıktılar 0600 erişim izniyle oluşturulur; var olan dosyalar asla üzerine yazılmaz.
- Yanlış anahtar, kesilmiş arşiv ve değişmiş şifreli içerik doğrulamadan geçemez. Açma aracı nihai plaintext dosyayı yalnızca bütünlük doğrulaması başarılıysa yayımlar.
- GitHub CI, test-only rastgele anahtarla şifreli dump üretir, doğrulayarak açar, farklı bir disposable PostgreSQL veritabanına pg_restore uygular ve siparişler + şema bütünlüğünü test eder.
- CI yedekleme işlemi gerçek müşteri, adres, telefon veya işletme verileriyle çalışmaz.

## Operatörün güvenli uygulaması
1. Üretim veritabanı için ayrı, en az yetkili, salt-okunur yedekleme rolü, TLS bağlantısı ve server-side secret store kullan.
2. Şifreleme için 32 rastgele baytlık anahtarı secret manager'da sakla; SOFRA_BACKUP_KEY_B64 ortam değişkenine sunucu tarafında ver. Anahtarı Git'e, CI loguna veya shell geçmişine yazma.
3. Veritabanı bağlantısını güvenilir PGHOST / PGPORT / PGDATABASE / PGUSER / PGPASSWORD ortam değişkenleriyle ver (bağlantı URL'sinde şifreyi komut satırında göstermemeye dikkat et).
4. `node tools/backup-crypto.mjs seal-command /restricted-path/backup-date.sofraenc pg_dump --format=custom --no-owner --no-acl`
5. Şifreli çıktıyı ayrı hesapta, sunucu dışı bir nesne deposuna S3 uyumlu istemciyle, özel bucket, versioning, MFA, retention, immutable retention ve TLS üzerinden yükle. Başarılı uzak kopya ve zaman damgası izleme/uyarı koşuluna bağlı olmalıdır. Uzak kopyayı tekrar indirip `node tools/backup-crypto.mjs verify /restricted-path/downloaded.sofraenc` komutuyla GCM bütünlüğünü düz metin dosyası oluşturmadan doğrula. Bu yalnızca kriptografik bütünlük testidir; gerçek `pg_restore` tatbikatının yerine geçmez.
6. Farklı erişim yetkileriyle staging'de restore provası yap: node tools/backup-crypto.mjs open /restricted-path/backup-date.sofraenc /restricted-temp/backup.dump; yalnız izole database'e pg_restore uygula; migration/checksum, row counts, trigger, audit ve order event zincirini doğrula. Daha sonra plaintext dosyayı güvenli ve kayıtlı şekilde temizle.
7. Geri yükleme anahtarının yedekten ayrı lokasyonda erişilebilirliğini ve kurtarma personeli yetkisini düzenli test et. Anahtar kaybolursa şifreli yedek geri getirilemez.

## Açık gerçek dünya işleri
- Gerçek uzak bucket ve upload doğrulaması YAPILMADI: bağlı storage sağlayıcısı/kimlik bilgisi yok.
- Gerçek anahtar yönetimi/KMS, günlük yedekleme takvimi, retention süreleri ve alarm alıcıları yapılandırılmadı.
- Şifrelemenin mevcut olması production RPO/RTO hedeflerinin sağlandığı anlamına gelmez. RPO ve RTO için iş gereksinimi, ölçüm ve düzenli tatbikat gerekir.
- Binlerce kullanıcının kişisel verisi için gerçek restore yetkileri, veri maskeleme, saklama süresi ve KVKK uzman incelemesi şarttır.
- Bu araç genel bir dosya şifreleme katmanıdır. Sızdırılmış host veya sızmış şifreleme anahtarına karşı tek başına çözüm değildir.

Operasyon sorumlusu ve güvenlik incelemesi olmadan canlı veritabanında çalıştırma. Buradaki test adımları yalnızca disposable CI PostgreSQL için otomatik yürütülür.

## Tek seferlik otomasyon (zamanlayıcıya hazır)
Linux sunucuda özel, 0700 izinli gerçek bir dizin oluştur. `pg_dump` sunucu sürümüyle uyumlu olmalı; PGHOST, PGDATABASE, PGUSER, PGSSLMODE=verify-full, gerektiğinde PGPASSFILE/PGSSLROOTCERT değerlerini ve şifreleme anahtarını güvenli ortamdan sağla. Fotoğraf deposundan ayrı özel bucket ve ayrı erişim anahtarı kullan:
- SOFRA_BACKUP_DIR
- SOFRA_BACKUP_S3_ENDPOINT (HTTPS)
- SOFRA_BACKUP_S3_BUCKET, SOFRA_BACKUP_S3_REGION
- SOFRA_BACKUP_S3_KEY_ID, SOFRA_BACKUP_S3_SECRET
- SOFRA_BACKUP_KEY_B64

`node apps/api/scripts/offsite-backup.mjs` şifreli dump oluşturur, GCM doğrular, ayrı depoya yükler ve uzak nesneyi yeniden okuyarak SHA-256 ve boyut karşılaştırması yapar. Hata olursa çıkış kodu 1; mevcut şifreli arşivleri silmez. S3 tek nesne yüklemesi bu sürümde 5 GB ile sınırlıdır. Günlük operatör zamanlayıcısı, süre aşımı, disk kapasitesi, alarm, bucket erişim/retention ayarları ve gerçek izole restore tatbikatı ayrıca kurulmalıdır. Windows için dosya ACL kontrolü operatöre aittir. Bu otomasyon kendiliğinden çalışmaz ve hiçbir sağlayıcı hesabı oluşturmaz. CI yalnızca sentetik dump ve bellek içi sahte depoyu kullanır; gerçek uzak depolama onayı değildir.
