# Shodiev POS

«Shodiev Optom Market» uchun ishlab chiqilgan savdo (POS) tizimi — Windows desktop dasturi.

## Imkoniyatlar

- **Sotuv** — shtrix-kod skaneri, blok/dona hisobi, bir vaqtda bir nechta mijoz bilan ishlash
- **To'lov** — naqd / karta / terminal / qarz, aralash to'lov, qaytim hisobi
- **Chek** — 80 mm termal printer (XP-80T), logotip bilan
- **Ombor** — kirim, o'rtacha tan narx, qoldiq, tugayotgan tovarlar ogohlantirishi
- **Qarzlar** — har bir chek va tovar kesimida, qisman to'lovlar, avans
- **Kassa** — istalgan paytda naqd pulni sanab, farqni aniqlash
- **Hisobotlar** — savdo, foyda, tovar tahlili, kategoriyalar, ta'minotchilar, narx o'zgarishlari
- **Telegram bot** — real vaqtda cheklar va hisobotlar rahbarga
- **Offline** — internetsiz to'liq ishlaydi, xabarlar navbatda turadi
- **Zaxira nusxa** — avtomatik, Telegram orqali ham

## Texnologiya

Electron + React + SQLite (better-sqlite3). Ma'lumotlar do'kon kompyuterida saqlanadi.

## Ishga tushirish (dasturchi uchun)

```bash
npm install
npm run dev      # dasturchi rejimi
npm run build    # .exe yig'ish
```

## Yangilanish

Dastur GitHub Releases orqali avtomatik yangilanadi.
