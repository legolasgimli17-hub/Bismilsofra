# Şartname faz 4 — Ekip ve hesap erişimi (pilot)
20 Kasım 2026

## Personel yönetimi
- Restoran sahibi veya yöneticisi kendi restoranının ekip listesini görür; her personelin e-postası, rolü ve açık yetkileri görünür. Başka restoranın personel/hesap listesi görünmez.
- Yeni personel önceden e-postası doğrulanmış, kendi hesabını açmış ve aktif kullanıcı olmalıdır. SMS, geçici şifre veya sessiz yeni hesap oluşturulmaz.
- Restoran sahibi `staff` ve `manager` rollerini atayabilir. Manager sadece `staff` ekler/değiştirir/kaldırır. `owner` rolü bu panelde kaldırılamaz veya düşürülemez.
- Çalışana ayrı ayrı `siparişleri gör`, `sipariş durumu değiştir`, `menüyü düzenle` yetkileri verilir. Sipariş yönetimi için görme izni zorunludur. Manager tüm üç izne sahip olmalıdır.
- Her değişiklik gerçek veritabanı transaction içinde yeniden yetki kontrolü, satır kilidi, eski durum doğrulaması ve PII'siz append-only audit kullanır. Üst sınır: restorana 25 personel.
- Restoran paneline erişim zaten imzalı MFA gerektirir; ekip üyelerinin Auth0 MFA kurulumu gerçek tenant testidir.

## Platform hesap işlemleri
- Platform admini yalnızca tam e-posta eşleşmesiyle doğrulanmış kullanıcı arar; çoklu/benzer isimli hesapları topluca listeleyemez.
- Kısıtlama veya açma işlemi tam ID + beklenen önceki `enabled` durumu + sabit `reasonCode` ile yapılır. Gerekçe alanına keyfi adres/telefon yazılmaz.
- Kendi hesabını kısıtlama; son etkin platform yöneticisini kapatma; aktif restoranın **tek etkin sahibini** kapatma engellenir.
- Kısıtlanan hesapta kimliği doğrulanmış isteklere bile server tarafında `ACCOUNT_DISABLED` döner. Ancak uygulama hesabını kapatmak **Auth0 issuer oturumunu revokasyon ile sonlandırmak değildir**; sağlayıcı oturum kapama veya oturum revokasyonu canlı işletimde ayrıca entegre edilmelidir.
- Gerçek KVKK hesap silme/anonimleştirme ve yasal saklama politikası henüz yapılmadı; kullanıcı kısıtlama verileri silmez.

## Testler ve sınırlamalar
- Birim testleri validasyon/rol atama/tekrarlayan istek ve yetkiler.
- Gerçek PostgreSQL + issuer imzalı JWT HTTP: staff/manager/owner işlem kısıtları, cross tenant, rol yükseltme, disable-self, son admin, son etkin owner, stale updates, iptal sonrası erişim ve audit.
- Bu sürüm raporlama, push/SSE veya gerçek Auth0 tenant entegrasyonunu bitirmez. Bunlar sonraki şartname fazlarının ayrı işleridir.
