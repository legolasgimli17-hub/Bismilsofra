# Bismil Sofra v0.9 — Test raporu

## Bu ortamda gerçekleşen testler

- Backend saf iş kuralları / servis testleri: 45 geçti.
- Ön yüz sepet testleri: 5 geçti.
- Restoran keşfi ve favori testleri: 9 geçti.
- Restoran bağlantı tazeliği testleri: 4 geçti.
- Restoran durum akışı ve backend ile uygunluk testleri: 13 geçti.
- **Toplam: 76/76 test geçti.**
- 39 TypeScript / TSX dosyası TypeScript ayrıştırıcısıyla kontrol edildi; sözdizimi hatası bulunmadı.
- Ana CSS dosyası tinycss2 ile ayrıştırıldı; ayrıştırma hatası bulunmadı.

## Yapılamayanlar (geçti diye gösterilmez)

- npm registry erişimi kısıtlı olduğu için `npm install`, `next build` ve tam `tsc --noEmit` kontrolü çalıştırılamadı.
- Gerçek PostgreSQL sunucusu ve OIDC sağlayıcısı olmadığı için API'nin uçtan uca testleri çalıştırılamadı.
- Web/mobil tarayıcıda gerçek kullanıcı etkileşimi, performans ve görsel regresyon testleri yapılmadı.
- GitHub Actions henüz çalışmadı (depo mevcut değil).
- Fotoğraf URL'lerinin sürekli çalışması veya restoran onaylı görsellerin hakları doğrulanmadı.

## Üretim kapıları

Bir pilot için bloklayıcılar: güvenli login/MFA ve rol testi; işleyen DB migration ve yedek kurtarma; aynı siparişin çift gönderimi ve fiyat onayı; gerçek bildirim ve kaçan sipariş prosedürü; onaylı yemek fotoğrafları; KVKK/işletme süreçleri; en az 5 restoranla pilot kabul testi.
