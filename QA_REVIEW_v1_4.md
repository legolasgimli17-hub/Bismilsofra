# Bismil Sofra v1.4 — Bağımsız ürün ve mühendislik denetimi (19 Kasım 2026)

## Hangi kaynaklara dayanıyor?
- Şartname: `REFERANS_SARTNAME_v0_3.md` — 5 restoran pilot, 50 aktif restoran sınırı, kapıda nakit/POS ve restoran kuryesi.
- Repo/CI: [PR #2](https://github.com/legolasgimli17-hub/Bismilsofra/pull/2) ve [başarılı CI çalışması 44552494385](https://github.com/legolasgimli17-hub/Bismilsofra/actions/runs/44552494385).
- Karşılaştırma yaklaşımı: Yemeksepeti ve Trendyol Go'nun kamuya açık keşif, sipariş ve işletme operasyonu akışları. Rakiplerin özel kaynak kodlarına erişilmedi.

## Doğrulanmış testler
- **90/90 birim testi**: 55 backend, 5 sepet, 12 keşif, 5 işletme bağlantısı, 13 restoran iş akışı.
- **2/2 gerçek PostgreSQL entegrasyon testi**: sipariş, tenant izolasyonu, imzalı JWT ile HTTP akışı, bildirim tekrar denemesi ve bağımsız escalation worker senaryoları.
- **API ve web TypeScript tip kontrolü** başarılı. **Next.js üretim derlemesi** başarılı.
- **npm ci** ile kilitli bağımlılık dosyasından kurulum doğrulandı.
- Bunlar **canlı Auth0 tenant'ı, gerçek SMS/push sağlayıcısı veya fiziksel mobil cihaz** testleri değildir.

## Düzeltilen kritik eksikler

1. `package-lock.json` artık sürüm kontrolündedir; her CI adımı `npm ci` kullanır. Geçici lockfile bootstrap workflow kaldırılmıştır.
2. `004_escalation.sql` sipariş yaratılmasıyla aynı veritabanı işlemi içinde ikinci uyarıyı kalıcı olarak planlar.
3. `escalation-worker` sipariş hâlâ beklemedeyse ayrı, imzalı webhook'a gönderir; kabul/iptal/süre dolumunda uyarıyı iptal eder, başarısızsa güvenli retry ve dead-letter uygular.
4. Admin + MFA ile kontrol edilen iki bildirim kanalı durumu ve kontrollü eskalasyon yeniden denemesi eklendi. Müşteri adresi/telefonu uyarı gövdesine dahil edilmez.
5. API gerekli migration'lar eksikken açılmaz; `readyz` yeni şemayı da denetler.
6. İzinli gerçek fotoğrafların birinci taraf HTTPS CDN üzerinden gösterilmesi desteklenir; güvenilmeyen resim domainleri reddedilir.
7. Mobil fotoğraf elemanları sabit boyut, tembel yükleme ve `no-referrer` ile güçlendirildi.

## Dışarıdan bakınca devam eden kalite kusurları

| Öncelik | Eksik / risk | Kanıtlanması gereken |
|---|---|---|
| **P0** | Canlı Auth0/OIDC ve gerçek MFA sağlayıcısı henüz bağlanmadı | Gerçek hesapla giriş/çıkış, doğrulama, MFA ve yetki testleri |
| **P0** | İkinci webhook sağlayıcısı ve yedek telefon bildirimi henüz bağlanmadı | İki ayrı sağlayıcı, kilitli telefon ve restoran bağlantısı kopma senaryoları |
| **P0** | Üretim PostgreSQL, yedek/geri yükleme, HTTPS API barındırması yok | İzole staging + geri yükleme provası + gizli anahtar yönetimi |
| **P0** | Birincil bildirim worker'ı HTTP çağrıları sırasında veritabanı transaction/row lock tutuyor | Yoğun akışta bildirim gecikmesi ve worker ölçek testleri; ayrı teslimat lease tasarımı |
| **P1** | Restoranların gerçek menü fotoğrafları ve lisans/izin kayıtları mevcut değil | 5 işletmeden doğrulanmış ürün görselleri, WebP/CDN testi |
| **P1** | Resim yükleme için güvenli işletme paneli/API yok | Yetkili upload, tip/boyut/virus ve storage yetki testleri |
| **P1** | Gerçek mobil cihaz/erişilebilirlik testleri yok | Android, iOS, tablet; yavaş ağ, klavye, ekran okuyucu |
| **P1** | İçerik yönetimi ve restoran onboarding tam değil | Menü, saat, mahalle ve çalışma yetkisi ekranları |
| **P1** | Tek sunucu içi IP-rate-limit ve proxy tanımlaması canlıya uygun şekilde yapılandırılmadı | Reverse-proxy/çok örnekli ortamda rate limit ve yük testleri |

## Sonraki öncelikli karar
1. Staging ortamı (gerçek OIDC, HTTPS API, PostgreSQL, ayar ve gizli bilgiler).
2. Bağımsız iki uyarı sağlayıcısının kaybolma/yeniden teslimat/çift gönderim saha provası; birincil worker DB-lease iyileştirmesi.
3. 5 gerçek restoranın menü, fotoğraf ve kurye operasyonuna uygun onboarding.
4. Mobil E2E akış ve gerçek kullanıcı testleri.
5. Ancak bunlardan sonra 5 restoran pilotu; 50 sınırına kontrollü büyüme.

**Bağımsız sonuç:** Kod kalitesi ve test güvenilirliği önceki prototipten anlamlı biçimde ilerledi. Yine de şu aşamada Yemeksepeti'ne denk canlı operasyonel güvenilirliğe veya görsel kaliteye ulaşıldığını iddia etmek doğru olmaz.
