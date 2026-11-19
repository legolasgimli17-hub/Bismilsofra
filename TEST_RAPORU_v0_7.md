# Bismil Sofra v0.7 — Doğrulanmış test raporu

**Yerel test yürütme:** 19 Kasım 2026

| Kontrol | Sonuç |
|---|---|
| Backend saf iş kuralı / servis testleri | **45 geçti, 0 hata** (`node --experimental-strip-types --test apps/api/test/*.test.ts`) |
| Sepet mantığı testleri | **5 geçti, 0 hata** (`node --experimental-strip-types --test apps/web/lib/cart.test.ts`) |
| TS / TSX sözdizimi inceleme | **32 kaynak dosya**, 0 parse hatası (global TypeScript parser) |
| Web `npm install` / `next build` | **YAPILAMADI**: npm registry DNS/network erişimi engelli |
| TypeScript tam tip denetimi (`next build`) | **YAPILAMADI**: React/Next bağımlılıkları mevcut değil |
| Gerçek PostgreSQL ile migrasyon + entegrasyon | **YAPILMADI**: hazır PostgreSQL/kimlik sağlayıcı erişimi yok |
| Auth0 gerçek kayıt/giriş ve MFA | **YAPILMADI**: sağlayıcı tenant/Action yapılandırılmadı |
| Tarayıcıda gerçek Next.js ekran görüntüsü / E2E | **YAPILAMADI**: Next.js paketi kurulamadı |
| Gerçek sipariş bildirimleri, 50 restoran yük testi | **YAPILMADI** |

**Önemli güvenlik testi:** `apps/api/test/confirmation.test.ts` içerisindeki 4 test fiyat teklifi, onay alınmadan gönderim, eski fiyatla gönderim ve geçerli onayı denetler. Müşteri tarafından onaylanan toplam, gerçek fiyatın kaynağı değildir; sipariş oluştururken sunucuda transaction içinde tekrar hesaplanır.

**Yorum:** 50 başarılı kontrol, tüm ürünün çalıştığı veya canlıya hazır olduğu anlamına gelmez. Backend'in gerçek veritabanıyla, frontend'in gerçek paketlerle derlenmesi ve Auth0 JWT/MFA yapılandırmasının ayrı entegrasyon ve tarayıcı testleri gerekir.
