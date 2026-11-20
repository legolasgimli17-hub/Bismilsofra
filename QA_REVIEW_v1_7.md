# Bismil Sofra v1.7 — bağımsız ürün ve güvenlik kontrolü (20 Kasım 2026)

## Doğrulanan değişiklik
Gerçek restoranın `/restaurant/manage` arayüzünde dosya seçmesi, yetki/onay kontrolü, JPEG/PNG/WebP işleme, EXIF konum metaverisini silme, S3-uyumlu depolama ve restoran bazlı görsel sahipliği.

## GitHub CI kanıtı
[Başarılı v1.7 PR kontrolü](https://github.com/legolasgimli17-hub/Bismilsofra/actions/runs/44693920857):
- **113/113 birim testi** geçti (API 74, sepet 5, keşif 12, bağlantı 5, işletme 13, ücret ve form 4).
- **2/2 PostgreSQL/HTTP entegrasyon testi** geçti. HTTP testi: kriptografik imzalı JWT, MFA, gerçek PostgreSQL, **yerel taklit S3 endpoint**, binari fotoğraf upload, kötü biçim/izin reddi, restoran bazlı media tablosu ve fotoğrafın ürüne bağlanması.
- API ve web TypeScript tip denetimi, Next.js üretim build başarılı.
- Dependencies `npm ci` ile workspace lockfile'a bağlı: sharp 0.35.5 ve @aws-sdk/client-s3 3.1172.0.

## Kalite kararları
1. Dosyanın isminden veya MIME etiketi üzerinden fotoğraf güveni kurulmaz; sunucu JPEG/PNG/WebP imzası ve gerçekten decode edilebilir içerik ister.
2. Fotoğraflar aynı WebP formatına normalize edilerek metaverisi temizlenir, çözünürlük/boyut sınırlıdır.
3. Sunucu gerçek restoran + MFA + menu izni ister ve yükleme izin onayını audit'e yazar. Fotoğraf CDN URL'sinin ürünle eşleşmesi ancak `restaurant_media` tablosunda **aynı restorana ait** kayıt varsa mümkündür.
4. Varsayılan üretim yapılandırması yoksa sistem güvenli şekilde **503** döner. Sahte fotoğraf bağlantılarına veya yerel geçici diske geri dönmez.
5. Sunucu bileşenleri ve demo kaynakları gerçek fotoğrafa eşdeğer değildir; izinli beş pilot restoranın menüleri hâlâ alınmadı.

## Gerçekte hâlâ çözülmemiş riskler
| Öncelik | Açık risk | Tamamlama şartı |
|---|---|---|
| **P0** | Cloudflare R2/AWS S3 ve kendi HTTPS CDN alan adı yapılandırılmış değil | Ayrı bucket ve kısıtlı token, CDN erişim testi, gizli değişkenlerin güvenli tanımı, gerçek dosya upload |
| **P0** | Gerçek Auth0 tenant ve restoran MFA hâlâ bağlanmadı | Gerçek doğrulanmış müşteri ve restoran hesabı testleri |
| **P0** | Push/SMS/bağımsız yedek kanal henüz bağlı değil | Çalışan iki bağımsız alarm ve restoranda sipariş kaçırmama provası |
| **P0** | Staging ve üretim DB yedeği/restore provası yapılmadı | HTTPS API + Postgres staging + test |
| **P1** | Yüklenmiş ama ürüne hiç bağlanmamış görsellerin temizliği yok | Güvenli retention/GC; kaydedilmiş ürünlere ait görseller silinmemeli |
| **P1** | Restoran fotoğrafının kullanım iznini kullanıcı onaylıyor, hukuki kanıt eksik | Restoranla fotoğraf kullanım sözleşmesi ve kaldırma talebi iş akışı |
| **P1** | Fotoğraf işleme CPU ve kötü niyetli yoğun yük | Gerçek yük testi, dağıtık rate limiting, kaynak sınırlama |
| **P1** | Ürün seçenek grubu/ekstra ücretlerin işletme panelinden düzenlenmesi eksik | Kategori/ürün yönetimi gibi güvenli, test edilmiş seçenek editörü |
| **P1** | Gerçek Android/iPhone ve düşük ağ testleri yapılmadı | 5 restoran pilotu ve temel müşteri akışları |

**Bağımsız karar:** v1.7, önceki sürümdeki "sadece fotoğraf URL'si" eksikliğini gerçek dosya upload altyapısıyla kapatıyor. Ancak gerçek sağlayıcı ve restoran varlıkları bağlanmadan canlı fotoğraf akışının üretimde çalıştığı iddia edilmemelidir. Yemeksepeti seviyesinde görsel/operasyonel kalite henüz doğrulanmış değildir.

Şartname değişmedi: Bismil, 5 restoran pilot, maksimum 50 aktif restoran, kapıda nakit/POS, restoranın kendi kuryesi.
