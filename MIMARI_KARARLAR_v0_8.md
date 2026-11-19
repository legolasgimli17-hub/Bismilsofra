# Bismil Sofra — v0.8 Teknik ve Ürün Kararları

## Kuzey yıldızı
Büyük platformları taklit etmek değil, onların **güvenilir ve hızlı sipariş deneyimi standartlarını** Bismil için daha düşük operasyon maliyetiyle uygulamak. Geliştirme ve yayın birimleri **en fazla 50 aktif restoran**, 5→20→50 aşamalı kabul, teslimatı restoranın kendi kuryesinin yapması, ilk sürümde sadece kapıda nakit/POS ve e-posta doğrulamalı giriş koşullarına bağlıdır.

## Seçilen mimari
- **Frontend:** Next.js (App Router) + React + TypeScript, tek responsive PWA. Müşteri, işletme ve yönetici akışları rol kontrollü ekranlar olarak ayrılır. Müşteri cihazından fiyat, yetki ve sipariş durumu doğrulanmaz.
- **API:** Fastify + TypeScript. **Modüler monolit** prensibi: tek dağıtılabilir servis ama katalog, teslimat, sipariş, bildirim, kimlik ve yönetim işlemleri ayrı modül sınırlarına sahip olacak şekilde geliştirilmeli. Çoklu mikroservis ve mesaj kuyruğunu ilk aşamada zorunlu tutmayız.
- **Veritabanı:** PostgreSQL. Fiyatlar kuruş/tam sayı. Atomik işlem, idempotency anahtarı, sipariş snapshot'ı ve olay geçmişi korunsun. Kalıcı managed DB, geri yükleme denemeleri ve versiyonlu migration şarttır.
- **Kimlik:** Onaylı yönetilen OIDC sağlayıcısı; e-posta doğrulama, restoran ve admin için sağlayıcı doğrulamalı MFA. Özel şifre/OTP motoru yazılmayacak.
- **Bildirim:** Restoranın açık panelinden düzenli sorgu yalnızca **yedek eşitleme**. Üretim için gerçek zamanlı kanal (SSE/WebSocket) + outbox + ayrı ikincil uyarı kanalı şart.
- **Görseller:** Lisanslı ve gerçekten ürünü gösteren fotoğraflar, dosya boyutu kontrolü, EXIF temizleme, WebP ve sonrasında uygulamaya ait CDN/depolama. Demo dış sunucu fotoğrafları **üretim çözümü değildir**.
- **Dağıtım:** Önce özel GitHub deposu ve CI; frontend Vercel'e, API + worker sürekli çalışabilecek ortama, yönetilen DB ayrı. Görsel CDN ve izleme sonradan entegre edilir.

## Neden mikroservis değil?
50 restoran için gereksiz ağ trafiği, bölünmüş transaction, çoklu izleme ve kesinti noktaları kurucunun yükünü artırır. Modüler monolit doğru test ve veritabanı disipliniyle başlangıç ölçeğini destekleyebilir; büyütme kararı **ölçülen** yük ve operasyon verisine göre verilir.

## Renk ve tipografi kararı
Koyu yeşil/kremsi arka plan ve sıcak mercan vurgu, mevcut **geçici görsel yön**; marka ve logo saha araştırması yapılmadan nihai kabul edilmez. Sahte puan, indirim, teslimat süresi veya teyitsiz restoran ismi gösterilmez.

## Performans / erişilebilirlik kapıları
- Telefon 360 px'lik dar ekranda yatay taşma ve tıklanamayan kontrol olmayacak.
- WCAG 2.2 AA hedefi: odak sırası, keyboard, label, durum metni ve kontrast kontrol edilecek.
- Görsellerin gecikmeli yüklenmesi, uygun boyut, düşük veri kullanımı; gerçek cihaz ve yavaş ağ testi yapılacak.
- Basit API sağlık testi değil: bir siparişin gerçek DB'de oluşturulup restoranca kabul edilmesini, kesintiden sonra geri gelmesini ve durum geçmişini kanıtlayan uçtan uca test gerekli.
- Canlı sipariş için **idempotency, DB backup-restore, erişim izolasyonu, bildirim yedekleme, kesinti ve yük testi** geçmeden yayın yok.

## Yapılmayacaklar (pilot dışında)
Online kart tahsilatı, kurye ağı, kurye canlı haritası, sahte kampanya/puan sistemi, karmaşık makine öğrenimi önerileri, Android/iOS mağaza uygulaması ve farklı şehirler. Bunlar v1 şartnamesinde yoktur.
