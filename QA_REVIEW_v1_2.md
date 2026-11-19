# Bismil Sofra — Kalite denetimi v1.2 (2026-11-19)

## Doğrulanmış CI sonucu
GitHub Actions [run 44545145586](https://github.com/legolasgimli17-hub/Bismilsofra/actions/runs/44545145586) / commit `b9666be63897057f3bb85afa08c1b079a2b12002`:
- **verify — SUCCESS**: bağımlılıklar yüklendi; 83 Node.js birim testi, API + web TypeScript kontrolleri ve Next.js üretim derlemesi tamamlandı.
- **integration-postgres — SUCCESS**: izole PostgreSQL 17.6 servisi, checksum kontrollü migration, kurgu test verisi; sunucudan fiyat teklifi, yanlış fiyat reddi, tekrar sipariş engeli, tenant koruması, durum geçişleri, outbox, zaman aşımı ve restoran açık/kapalı durum testleri.
- Entegrasyon testi gerçek PostgreSQL'de çalışır, ancak **gerçek OIDC oturumları, canlı API HTTP testleri, kullanıcı cihazı ve gerçek restoran/kuryeler test edilmemiştir**.

## Bu sürümde nesnel olarak tespit edilip kapatılan hatalar
1. Auth0 kütüphanesi ile React sürümleri uyuşmadığı için `npm install` başarısızdı: React/React DOM `19.2.9` ile düzeltildi. `--legacy-peer-deps` ile hata gizlenmedi.
2. API ve testlerdeki 10 sıkı TypeScript hatası ile Auth0 erişim belirteci türü hatası düzeltildi; TypeScript kontrolü devre dışı bırakılmadı.
3. Fiyat teklifi ve sipariş oluşturma sorgularındaki çalışma saati SQL'inde eksik kapanış parantezi düzeltildi.
4. PostgreSQL entegrasyon testi artık zorunlu `confirmedTotalKurus` alanını gönderiyor; fiyat değişikliği reddini sınayıp 24 saatlik demo çalışma saatlerini doğru temsil ediyor.
5. GitHub Actions'a gerçek PostgreSQL servisi ve dev ortamı dışına veri yazmayı reddeden kurgu test verisi ekleme aracı eklendi.

## Pilot açılışından önce hâlâ kapanması gereken kapılar
- **P0 — Kimlik doğrulama:** gerçek Auth0/OIDC sağlayıcısı ile müşteri e-posta doğrulaması, işletme ve yönetici MFA; API'nin gerçek HTTP uç noktalarıyla testleri.
- **P0 — Bildirimler:** ses/ekran/ikincil uyarı, başarısız teslimat ve bağlantı kopması sonrası işletme siparişini kaçırmama senaryoları.
- **P0 — Bağımlılık kilidi:** `package-lock.json` sürüm kontrolüne alınmalı; CI'de `npm ci` kullanılarak kurulum tekrarlanabilir hâle getirilmeli.
- **P0 — Güvenlik:** çalışma ortamı yapılandırması, gizli anahtarların saklanması, yedek/geri yükleme tatbikatı, KVKK değerlendirmesi.
- **P1 — Ürün kalitesi:** gerçek işletmelerden izinli yemek fotoğrafları; mobil ve erişilebilirlik testi; yönetici/esnaf tam menü ve saat düzenleme ekranları.
- **P1 — Saha doğrulaması:** şartnamedeki 5 işletme pilotu, gerçek kullanıcı ve teslimat senaryoları.

## Ürün kapsamı
Şartname v0.3 esas alınır: en fazla 50 aktif restoran, önce 5 restoranlık pilot; yalnız kapıda nakit/POS; restoranın kendi kuryesi. Çevrimiçi ödeme veya yeni kurye ağı eklenmedi.

**NOT:** Başarılı CI, canlı sipariş kabul etmek için tek başına yeterli değildir.
