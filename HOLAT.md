# Loyiha holati — 14.09.2026, 18:30

> Bu fayl ish qayerda to'xtaganini qayd qiladi. Yangi suhbatda shu fayldan boshlang.

## Qisqacha

«Shodiev Optom Market» (Qarshi, ichimliklar optom savdosi) uchun Windows POS tizimi.
**Versiya 1.4.0** yig'ilgan, GitHubga chiqarilgan, mijoz kompyuteriga o'rnatilgan va ishlayapti.

- Kod: https://github.com/joxa-cyber/Shodiev-POS (public)
- Reliz: https://github.com/joxa-cyber/Shodiev-POS/releases/tag/v1.4.0
- Avtomatik yangilanish: **ishlaydi** (tekshirilgan — `latest.yml` ochiq yuklanadi)

## Tayyor bo'lgan ishlar

| Bo'lim | Holat |
|---|---|
| Sotuv (shtrix-kod, blok/dona, bir nechta parallel savat) | ✅ |
| To'lov (naqd/karta/terminal/qarz, aralash, qaytim) | ✅ |
| Chek chop etish (XP-80T, 80mm, logotip) | ✅ mijoz sinab ko'rdi, chiroyli chiqdi |
| Savdo bo'limi (kunlik cheklar, qayta chop etish) | ✅ |
| Tovarlar + kategoriyalar boshqaruvi | ✅ |
| Kirim (o'rtacha tan narx, boshlang'ich qoldiq kirim sifatida) | ✅ |
| Mijozlar | ✅ |
| Qarzlar (chek va tovar kesimida, qisman to'lov, avans) | ✅ 14 ta alohida sinov |
| Kassa hisobi (istalgan paytda) | ✅ |
| Hisobotlar (savdo, foyda, tovar tahlili, kategoriya, ta'minotchi, narx tarixi) | ✅ |
| Xodimlar va ruxsatlar, filiallar | ✅ |
| Telegram bot (cheklar, kirim, qarz, kunlik hisobot, tugayotgan tovar) | ⚠️ kod tayyor, **sozlanmagan** |
| Zaxira nusxa (lokal + Telegram) | ✅ kod tayyor, Telegramga bog'liq |
| Avtomatik yangilanish | ✅ |
| Savdo grafigi | ✅ |

## Keyingi qadamlar (ertaga)

1. **Mijoz 1.4.0 dagi 3 ta tuzatishni sinab ko'radi:**
   - Boshlang'ich qoldiqli tovar Kirim tarixida ko'rinishi
   - 3-4 ta savat ochib, boshqa bo'limga o'tib qaytish (savatlar saqlanishi)
   - To'lovda «Qarzga» → mijoz tanlash / yangi mijoz qo'shish
2. **Telegram bot sozlash** — hali qilinmagan! @BotFather dan token olish,
   Sozlama → Telegram bot → token + rahbarning chat ID si → sinov xabari.
3. **GitHub token almashtirish** — eski token chatga yozilgan, bekor qilinishi kerak.
   Yangisi `setx GH_TOKEN "..."` orqali muhitga qo'yiladi (chatga yozilmaydi).
   Shundan keyin reliz chiqarish: `npm run publish`.

## Hal qilinmagan / keyinga qolgan savollar

- Optom narx kerakmi? (10 donadan ko'p olsa boshqa narx) — tuzilma tayyor, so'ralmagan
- Qaytariladigan tara — hozircha yo'q deb qabul qilingan

## Mijoz rad etgan takliflar (qayta taklif qilmaslik)

Inventarizatsiya, Excel eksport, kunlik maqsad (plan), tez tugmalar (favoritlar),
skaner ovozi, «mening sotuvlarim», «tovar tugadi» tugmasi (bot avtomatik qiladi).

## Muhim texnik qarorlar

- Qoldiq **faqat donada**; `blok_soni` faqat tezkor kiritish uchun, narx bir xil
- Tan narx **o'rtacha** usulda hisoblanadi (kirimda avtomatik)
- Tan narx chekda va sotuv oynasida **ko'rsatilmaydi**
- Qarz: to'lov eng eski chekdan boshlab taqsimlanadi (`qarz_taqsim` jadvali),
  ortiqcha to'lov `mijozlar.avans` ga tushadi, keyingi qarzdan avtomatik yechiladi
- Offline: hech narsa so'ramaydi, Telegram xabarlari `telegram_navbat` da kutadi
- Savatlar `App.jsx` da saqlanadi (bo'lim almashganda yo'qolmasligi uchun)
- Chek Windows drayveri orqali HTML sifatida chop etiladi (o'zbek harflari to'g'ri chiqadi)
- Baza: `%APPDATA%\shodiev-pos\shodiev-pos.db` (WAL + synchronous=FULL)

## Buyruqlar

```bash
npm run dev        # dasturchi rejimi (vite + electron)
npm run build      # .exe yig'ish (dist-app/)
npm run publish    # yig'ish + GitHub relizga yuborish (GH_TOKEN kerak)
npx electron electron/_sinov.js   # 21 guruh avtomatik sinov
```

## Fayl tuzilishi

```
electron/          - asosiy jarayon (backend)
  main.js          - dastur yadrosi
  db.js            - baza, migratsiyalar, parollar
  schema.sql       - jadvallar
  ipc.js           - BARCHA biznes-mantiq (eng katta fayl)
  hisobot.js       - hisobot so'rovlari (UI va bot uchun umumiy)
  telegram.js      - bot, navbat, xabar shablonlari
  printer.js       - chek HTML va chop etish
  backup.js        - zaxira nusxa
  yangilanish.js   - avtomatik yangilanish
  _sinov.js        - avtomatik sinovlar (relizga kirmaydi)
src/               - interfeys (React)
  App.jsx          - menyu, savatlar holati
  pages/           - Sotuv, Savdo, Panel, Tovarlar, Kirim, Mijozlar,
                     Qarzlar, Kassa, Hisobot, TovarTahlil, Xodimlar, Sozlamalar
  components/      - Ui (modal, toast, ikonka), Grafik, KategoriyaOyna
assets/            - logotip, ikonka
TALABLAR.md        - mijoz talablari va kelishilgan qarorlar
QOLLANMA.md        - mijoz uchun foydalanish qo'llanmasi
HOLAT.md           - shu fayl
```
