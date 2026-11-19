# Bismil Sofra v0.8 — Gerçek kalite durumu

## Bu sürümde somut olarak değişenler
- `apps/web/app/page.tsx` Next.js müşteri keşfi: yeni özgün kahve/yeşil palet, mobil hero, kategori fotoğraf kartları, arama, mahalle seçimi, açık/kapalı filtresi, favoriler, sıralama, boş/yükleniyor/hata durumları.
- `apps/web/lib/discovery.ts`: sunulan/uygun restoranları birleştiren test edilebilir sıralama ve Türkçe arama. Bilinmeyen teslimat ücreti **sıfır sayılmaz**. Favori verileri doğrulanır.
- `apps/web/lib/demo.ts`: altı **kurgusal restoran** için farklı kategoriler, ürün listeleri ve örnek bölge/teslimat kapsamı. Bunlar gerçek restoran sanılmamalıdır.
- `apps/web/app/checkout/page.tsx`: örnek sepet hesabı olmadan görülebilir; gerçek sipariş gönderemez. Canlı sipariş akışında sunucu teklif/onay mantığı korunur.
- `apps/web/app/restaurant/page.tsx`: bağlantı kesilince "eski veri" uyarısı, eski kabul/ret işlemlerini engelleme, görünür sekmeye dönünce yeniden sorgulama. **Gerçek zamanlı push değil**.
- `apps/web/public`: PWA manifesti, 192/512 PNG uygulama ikonları, cache sürüm güncellemesi. Kullanıcı/sipariş/API yanıtları service-worker'da önbelleğe alınmaz.
- `tools/import_food_photo.py`: izni alınmış fotoğrafları gerçek fotoğraf olarak WebP'ye hazırlama, EXIF temizleme, boyut/ad doğrulama.

## Kontrol sonuçları
| Kontrol | Durum |
|---|---|
| Önceki backend iş kuralı testleri | 45/45 geçti |
| Sepet testleri | 5/5 geçti |
| Yeni restoran keşfi ve görsel URL testleri | 9/9 geçti |
| Restoran bağlantı sağlığı testleri | 4/4 geçti |
| Fotoğraf dosyası aktarma testleri | 2/2 geçti |
| TypeScript/TSX dosyalarının sözdizimi ayrıştırması | Kontrol edildi; bu, tam `tsc` tip doğrulaması değildir |
| Next.js gerçek `npm run web:build` | **Çalıştırılmadı** — npm paketlerine erişim yok |
| Gerçek PostgreSQL entegre test | **Çalıştırılmadı** — bağımsız DB bağlantısı yok |
| Gerçek kullanıcı kimliği, MFA, API + web uçtan uca | **Çalıştırılmadı** |
| 360 px, 390 px, tablet gerçek tarayıcı screenshot/interaction | **v0.8 için çalıştırılmadı** (Next.js build gerekli) |
| Canlı gerçek yemek fotoğrafı görüntüleme | **Doğrulanmadı** — dış fotoğraf sunucuları engelli |
| 5 pilot restoranın gerçek menüsü, fotoğrafları, teslimat alanı | **Yok** |

## Şartname ekran eşlemesi
- `C-01 / C-02 / C-03 / C-04`: konum/arama/kategori/filtre tasarımı geliştirildi; API/dev ortamı olmadan gerçek akış tamamlandı denemez.
- `C-05 / C-06`: restoran menü ve ürün seçimi önceki çalışan React kaynaklarından korunuyor.
- `C-07`: örnek sepet erişilebilir, tek restoran kuralı korunuyor.
- `C-08–C-12`: canlı backend + yönetilen oturum gerekli; geliştirme hâlâ sürüyor.
- `R-02`: güvenilirlik UX'i iyileştirildi, ama push + yedek alarm eksik.
- `M-*`: admin panelinde sadece operasyon uyarılarının bir bölümü kodlu.

**Pilot yayın kararı: HAYIR.** Gerçek uygulama projesi hazırlandı, fakat doğrulanmış canlı sipariş platformu henüz değil.
