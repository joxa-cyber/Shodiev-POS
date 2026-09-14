# POS tizimi — talablar (ishchi hujjat)

> Bu hujjat suhbat davomida to'ldirib boriladi. Aniqlanmagan joylar `?` bilan belgilangan.

## 1. Biznes haqida

- Firma ichimliklar savdosi bilan shug'ullanadi (ishlab chiqarmaydi, faqat sotadi).
- Assortiment universal: Pepsi, Cola, Fanta, turli gazli/gazsiz suvlar va h.k.
- Har xil o'lchamdagi tovarlar: 0.5L, 0.7L bankali (can), 1.5L, 2L va h.k.
- Sotuv **donalab** ham, **blok/pachka** ham bo'ladi (masalan 2 dona 1.5L + 2 blok 2L).
- 19 litrli ballon — hozir yo'q, kelajakda bo'lishi mumkin.
- Fiskal / soliq ONKM talabi YO'Q.

## 2. Sotuv jarayoni (hozirgi holat)

Mijoz do'konga keladi -> kerakli tovarlarni aytadi -> kassir chekka kiritadi ->
mijoz to'laydi -> tovarni olib ketadi. Dostavka yo'q.

## 3. Texnik shartlar

- Platforma: **Windows desktop app** (to'liq Windowsda ishlaydi).
- Jihoz: **chek printeri** ulanadi.
- Shtrix-kod skaner: hozir yo'q, **kelajakda qo'shiladi** -> dastur hozirdan shtrix-kodni
  qo'llab-quvvatlaydigan qilib yoziladi (keyboard-wedge, qo'shimcha ish talab qilmaydi).
- Do'konda doimiy internet (Wi-Fi) va elektr bor.
- Kassa: odatda 1 kishi ishlatadi, lekin 1 kompyuter.

## 4. Foydalanuvchi rollari

- **Rahbar (direktor)** — alohida akkaunt. To'liq kirish: foyda, hisobotlar, sozlamalar.
- **Xodim (kassir)** — alohida akkaunt. Faqat sotuv.

## 5. Asosiy maqsad (eng muhimi)

Rahbar hozir o'z biznesini ko'ra olmayapti. Kerak bo'lgan ko'rsatkichlar:

- Foyda (kunlik / oylik / jami)
- Savdo hajmi, eng ko'p sotilgan tovarlar
- Pul kirimlari: **naqd** va **karta** alohida
- Qoldiqlar

## 6. Telegram bot

- Har bir sotuv (chek) **real vaqtda** rahbarning Telegram botiga yuboriladi.
- Bot orqali hisobotlar: **kunlik, haftalik, oylik** — rahbar kompyuterdagi
  akkauntida nimani ko'rsa, botda ham xuddi shuni ko'ra olishi kerak.

## 7. Qabul qilingan qarorlar

| Masala | Qaror |
|---|---|
| Blok / dona | Narx ikkalasida bir xil -> qoldiq **faqat donada** sanaladi. `blok_soni` faqat tezkor kiritish uchun (2 blok = 12 dona) |
| Tan narx | **O'rtacha** usul. Kirimni xodim ham kirita oladi, lekin rahbarga darhol Telegramga xabar ketadi |
| Tan narx maxfiyligi | Chekda YO'Q, sotuv oynasida YO'Q. Faqat kirim oynasida va rahbar hisobotlarida |
| Shtrix-kod | **Hozirdan to'liq ishlaydi** (skaner keyboard-wedge rejimida) |
| Offline | Hech narsa so'ramaydi, oddiy ishlayveradi. Telegram xabarlari navbatda turadi, internet kelganda o'zi yuboriladi |
| Telegram bot | Sozlamada rahbarning chat_id si. Faqat o'shanga yozadi |
| Filial | Ko'p filialga tayyor. Rahbar login/parol yaratadi, filial va ruxsatlarni belgilaydi |
| To'lov turlari | Naqd / Karta / Terminal / **Qarz** — aralash ham bo'ladi |
| Qarz | Mijozlar bazasi, qarz qoldig'i, qarz to'lash, tarix |
| Rahbar huquqi | Istalgan narsani (narx, nom, qoldiq, chek) o'zgartira oladi |
| Chegirma / qaytarish | YO'Q (rahbar uchun chekni bekor qilish bor) |
| Logo | Mijoz bergan 1-variant (oq fonda qora) — chek uchun 400px oq-qora qilib tayyorlandi |
| Til | To'liq o'zbekcha |

## 8. Texnologiya

- **Electron + React + SQLite** (better-sqlite3)
- Bitta `.exe` o'rnatuvchi, internet talab qilmaydi
- Chek Windows drayveri orqali HTML sifatida chop etiladi -> o'zbek harflari (o', g') to'g'ri chiqadi
- Baza: `%APPDATA%\Shodiev POS\shodiev-pos.db` (WAL + synchronous=FULL: svet o'chsa ham yozuv yo'qolmaydi)

## 9. Hali aniqlanmagan

- [ ] Optom narx (10 donadan ko'p olsa boshqa narx) kerakmi? — tuzilma tayyor, kerak bo'lsa qo'shiladi
- [ ] Qaytariladigan tara — hozircha yo'q deb qabul qilindi
