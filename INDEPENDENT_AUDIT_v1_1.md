# Bismil Sofra — Bağımsız kalite denetimi (v1.1)

## Rakiplerde kamuya açık olarak gözlenen akışlar
- [Yemeksepeti](https://www.yemeksepeti.com/): adres/teslimat bölgesiyle restoran keşfi; restoran menüsü, filtreleme ve sipariş özeti.
- [Yemeksepeti kullanıcı akışları](https://www.yemeksepeti.com/contents/contact.htm): adres, restoran, sepet ve ödeme seçiminden oluşan belirgin adımlar.
- [Trendyol Go Restoran Paneli](https://apps.apple.com/tr/app/trendyol-go-restoran-paneli/id6449733799): yeni/geçmiş/iptal siparişler ve ürünleri satışa açıp kapatma.
- Bu inceleme kamuya açık sayfalarla sınırlıdır; rakiplerin özel kaynak kodlarına erişim sağlanmamıştır.

## Bağımsız incelemede bulunan ve bu sürümde düzeltilen kusurlar

1. **Yanıltıcı sipariş uygunluğu (öncelik yüksek).** Önceden manuel açık düğmesi açıkken mesai dışındaki veya geçici kapanışı olan restoran 'Sipariş alıyor' etiketini alabiliyordu. API artık `is_orderable` hesabına manuel durum, çalışma saatleri, geçici kapanış ve en az bir aktif teslimat bölgesini dahil ediyor. Liste, keşif filtresi ve menü düğmeleri bu sonucu kullanıyor.
2. **Mahalle seçilmeden teslimat ücreti (öncelik yüksek).** Önceden ilk uygun mahalleden ücret seçilebiliyordu. Mahalle belirtilmemişse API artık minimum sepet ve teslimat ücretini bilinmiyor (`null`) olarak döndürüyor; bölge seçilince yalnızca o bölgenin değerleri gösteriliyor.
3. **Keşif/menü tutarsızlığı.** Filtre, kart etiketi ve menüdeki sepete ekle kontrolü aynı `isRestaurantOrderable` yardımcı fonksiyonunu kullanıyor.

## Şartnameden sapmayan kararlar
- 5 restoranla pilot; en fazla 50 aktif restoran.
- Kapıda nakit veya restoran POS'u; online ödeme ve şirketin kendi kurye ağı ilk sürümde yok.
- Kesin fiyat ve uygunluk sipariş anında PostgreSQL işlemi içinde yeniden doğrulanıyor.
- Gerçek restoran/puan/teslimat süresi uydurulmuyor; önizleme verileri gerçek siparişe izin vermiyor.

## Henüz geçilmemiş kalite kapıları (canlı siparişe geçilmemeli)

**P0 — Önce bitirilmeli**
1. GitHub Actions'ta gerçek Next.js build ve TypeScript kontrolünü doğrula; paket sürümlerini kilitle.
2. Boş, izole gerçek PostgreSQL üzerinde migration + baştan sona sipariş + gece yarısı/geçici kapanış senaryolarını test et.
3. Kimlik sağlayıcısının gerçek e-posta doğrulaması, işletme MFA, yetki sınırları ve oturum süresi akışlarını doğrula.
4. Gerçek işletme bildiriminde kayıp/retry, ses + yedek uyarı ve kopma-sonrası tam liste senaryolarını ölç.

**P1 — Pilot kullanıcı deneyimi**
5. Gerçek restoranlardan izinli fotoğraflar, depolama/CDN ve mobil düşük bağlantı senaryosu.
6. Sipariş iptal/gecikme/teslim edilemedi destek süreçlerini hem müşteri hem işletme için test et.
7. Mobil erişilebilirlik, ekran okuyucu, dokunmatik hedefler, yavaş cihazlar ve ilk kullanıcı araştırması.

## Testlerin gerçekte neyi kanıtladığı
- 83 yerel Node.js birim testi geçti (API: 50; sepet: 5; keşif: 11; bağlantı: 4; işletme akışı: 13).
- Bu testler PostgreSQL sorgusunun sunucuda çalıştığını veya Next.js üretim build'inin başarılı olduğunu kanıtlamaz.
- Public restoran durumu, sayfa açıldıktan sonra değişebilir; son fiyat ve sipariş kabul kararı yine sunucuda yapılır.

## Geliştirme disiplini
Her önemli sürümde şu sırayı uygula: şartname → bağımsız ürün kıyası → kod/akış denetimi → düşük riskli düzeltme → otomatik test → canlı entegrasyon testi → rapor. Önizleme ile gerçek siparişi karıştırma.
