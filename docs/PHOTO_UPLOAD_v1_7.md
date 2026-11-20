# Bismil Sofra v1.7 — Gerçek, güvenli restoran fotoğraf yükleme

## Ne değişti?
Restoran sahibi/yöneticisi veya açık `can_manage_menu` izni verilen MFA'lı personel, `/restaurant/manage` ürün düzenleyicisinde telefondan JPEG/PNG/WebP fotoğraf seçer. Fotoğrafı kullanmaya yetkisi olduğunu onaylar ve güvenli sunucuya yükler. Sunucu dosyayı normalize edip fotoğrafa ait **depolama anahtarı, yükleyen kullanıcı, restoran kimliği, boyut ve URL** bilgisini `restaurant_media` tablosuna kaydeder. Yükleme ardından ürünün menü formuna URL eklenir; ürünün kendisi ancak kullanıcı formu **kaydettiğinde** güncellenir.

## Öncelik: gerçek fotoğraf, güvenli saklama
- Müşteriye gösterilen ürün fotoğrafı **restoranın kendisine ait veya lisanslı** olmalıdır. Kullanıcı fotoğrafı kullanma yetkisini kutucukta açıkça onaylar; işlem `audit_logs` içinde kayıtlıdır. Bu, hak sahipliğinin otomatik hukuken doğrulandığı iddiası değildir.
- Dosya adı, tarayıcının MIME etiketi veya dış URL'si **güvenilir kabul edilmez**. Yalnız JPEG/PNG/WebP sihirli bayt imzaları kabul edilir; SVG, PDF, HTML ve geçersiz dosyalar reddedilir.
- En fazla **5 MB** yükleme, en fazla **20 milyon piksel** çözünürlük. En az 80×80 piksel. Sunucu EXIF yönünü uygulayıp fotoğrafı en çok **1600×1200** piksele küçültür, metaveriyi/konum bilgisini çıkarıp JPEG/PNG/WebP'den normal WebP üretir. En fazla 3 MB çıktı.
- Her dosyaya `restaurants/<restaurantUuid>/photos/<randomUuid>.webp` yolu verilir. URL'deki isim kullanıcı girdisi değildir; medya kaydı belirli restorana aittir.
- REST ürüne yalnızca mevcut, **o restorana ait kayıtlı** CDN URL'si bağlanabilir; sahte/başka restoranın URL'si 409 ile reddedilir.
- Restorandaki ürün oluşturma ve güncelleme geçmiş sipariş fiyatlarını değiştirmez; fotoğraf güncellemesi ürün `revision` eşleşmesine tabidir.
- Görseller public CDN üzerinden gösterilir; **kimlik doğrulama tokenları CDN URL'sine eklenmez.** Müşteri adres, telefon veya hesap ayrıntıları görsel URL'sine konulmaz.

## Kurulum: server-side S3 uyumlu bucket + public CDN
- S3-uyumlu obje depolama (ör. Cloudflare R2, AWS S3 veya testte yerel taklit) üzerinde sadece Bismil Sofra fotoğraflarının bulunduğu, ayrı bir bucket oluştur. **Üretim hesabı henüz bağlı değil.**
- Backend environment: `S3_ENDPOINT` (üretimde **HTTPS**), `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `MEDIA_PUBLIC_ORIGIN` (HTTPS CDN origin), `PUBLIC_IMAGE_CDN_HOST` (aynı origin'in hostname'i).
- Frontend: `NEXT_PUBLIC_IMAGE_CDN_HOST` aynı CDN hostname'idir. S3 access key bilgileri **sadece backend** gizli değişkenlerindedir.
- Sunucu, bu alanlar eksikse **503 PHOTO_STORAGE_NOT_READY** döndürür; rastgele/sahte fotoğraf kaynağına geçmez.
- CDN, backend'in kaydettiği `restaurants/<rid>/photos/<random>.webp` objelerini gerçekten sunmalıdır. Bucket'ın görüntüleme izinleri, web alan adı ve HTTPS yapısı üretime çıkmadan test edilmelidir.
- Backend sürekli çalışan Fastify sunucusudur. S3 nesnelerini kalıcı depolar; geçici sunucu diskine bağımlı değildir. Sunucu fotoğraf işlediğinden API'nin çalıştığı makinenin kaynak kullanımı ve zaman aşımı ölçülmelidir.

## API
`POST /v1/restaurant/:rid/photos`
- Header: `Authorization: Bearer <OIDC access token>`, `Content-Type: application/octet-stream`, `X-Photo-Rights-Affirmed: true`.
- Gövde: **ham JPEG, PNG veya WebP baytları** (JSON/base64 değil). Yanıt: 201 `{mediaId,imageUrl,width,height,sizeBytes}`.
- Yetki: personelin restoran bazlı `menu` izni + imzalı JWT + MFA.
- Her restoran için en fazla 1000 medya kaydı, son 60 dakikada en fazla 40 medya yüklemesi (sistem bazlı yumuşak kota).
- Hatalar: 400 hak onayı, 401/403 kimlik, 413 büyük dosya, 415 desteklenmeyen biçim, 503 depolama yapılandırması eksik, diğerlerinde genel hata. Ham dosya/binary loglanmaz.
- Depolama başarıyla bitip veritabanı kaydı başarısız olursa backend depolama nesnesini silmeyi dener. Harici sağlayıcı silme hatası durumunda manuel orphan-cleanup takibi gerekecektir.

## Testler
- Birim testi: dosya sihirli imzası, WebP işlem sonucu, boyut limitleri, bozuk/SVG dosya reddi, HTTPS CDN ayarları, rastgele obje yolu.
- PostgreSQL + HTTP: yerel imzalı OIDC JWT, MFA yetki sınırı, açık fotoğraf izni, sahte dosya, sahte S3 sunucusuna PUT, `restaurant_media` satırı, yüklenen URL'nin ürünle ilişkilendirilmesi ve başka restoranın/sahte CDN URL'sinin reddi.
- **CI testi canlı Cloudflare/AWS hesabı değildir.** Üretim CDN, erişim anahtarları, alan adı, yükleme bant genişliği ve gerçek Android/iPhone cihazı ayrı aşamalardır.

## Bağımsız risk denetimi
1. Sunucudan fotoğraf işlemeye karşı yoğun yük/DoS: 5 MB, 20 MP, personel MFA, global rate limit ve kayıt bazlı kotalar var. Yine de üretimde dağıtık rate limit ve worker/CPU limitleri eklenmeli.
2. S3 obje PUT sırasında DB kaydı henüz yoktur; hata temizliğinin takip edilmesi ve saklama politikasının doğrulanması gereklidir.
3. Bu sürümde yüklenen görsellerin **silme/replace** döngüsü ve telif itirazı yönetimi tamamlanmadı. Doldurulmuş ürün formu kaydedilmezse medya objesi depolamada kalabilir; retention/GC işi sonraki aşamada.
4. Gerçek fotoğrafın telif ve restoran sahipliği otomatik olarak doğrulanmıyor. İlk 5 restoran pilotunda işletmeyle izin sözleşmesi gerekir.
5. Gerçek kimlik sağlayıcısı, 2 ayrı sipariş alarm sağlayıcısı, KVKK ve cihaz testleri hâlâ P0.
